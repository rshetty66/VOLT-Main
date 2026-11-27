---
name: uber-agent-skills
description: "Run agent skills like production infrastructure, the Uber way. Use when creating, improving, or evaluating Claude Code skills: the five-stage loop (build, run, measure, evaluate, improve), skill tiers, eval suites with real prompts, with/without ablation, token-cost levers, and agent-filed bug reports (papercuts)."
---

# Agent Skills at Enterprise Scale (Uber method)

Source: Uber Engineering, "How Uber Evals 1 Million Agent Skill Invocations a Month" (Nov 23, 2026), shared by @ubereng Nov 24, 2026. Uber grew a shared skills marketplace from 1 skill (Oct 2025) to 5,000+ in a year, with agents invoking skills 1M+ times a month. The method below is distilled from that article, not copied from it.

## What a skill is

A skill is a Markdown file that teaches an agent to do one job well: creating a pull request, querying a metrics store, outlining a weekly sales presentation. It packages one workflow: a runbook, a team's process, or a task an expert does by hand.

On disk, a skill is a directory with a SKILL.md (name, description, body of instructions), plus scripts and reference files. An agent loads it in three stages, so thousands of skills cost only a short description each:

- **Always loaded:** name and description, about 100 tokens. The agent uses the description to decide whether the skill applies.
- **Loaded when the skill runs:** the body, kept under 500 lines.
- **Loaded on demand:** scripts and references, read only by the step that needs them.

Write the description so the agent can tell in one line when the skill applies and when it does not.

## The loop: build, run, measure, evaluate, improve

1. **Build.** Write the skill (SKILL.md, owner, version) and put it in the marketplace.
2. **Run.** Engineer agents, hosted agents, and background agents invoke it.
3. **Measure.** Usage and retention, cost and latency, errors and traces.
4. **Evaluate.** Structure and behavior, with/without the skill, regression tests.
5. **Improve.** Papercut reports, trace-based edits, owner-reviewed fixes.

Real-world feedback loops back to Build. A skill has a lifecycle: write it, test it, ship it, improve it from what its real runs show, until a better model makes it unnecessary and it retires.

## Organize: one repo, three tiers, one install

- **One repository for all skills.** Version control already gives each skill an owner, a review, and a history. That is the marketplace.
- **Three tiers, with quality expectations rising as a skill graduates.** To graduate, run the eval system plus quality and usefulness checks.
  - **Domain.** Any team starts its own area and names its reviewers. A skill publishes after one peer approval and a CI check, no central group in the way.
  - **Core.** Widely used skills move here. Recommended, tested, maintained by a team, and the platform team reviews every change.
  - **Always-on.** About 100 broadly useful skills are on for everyone, so a new person has skills on the first run: pull requests, code review, tool access, data analysis, chat.
- **One install for every agent.** One CLI that starts each agent type and stores configuration, so the same skills follow the user across Claude Code, Codex, OpenCode, and hosted agents. Config merges in layers (company defaults, team, repo, working directory, user, local override). Later layers add plugins and never remove them, so a repo can declare the plugins everyone working in it needs.

## Discovery

With many skills, finding the right one matters. Keep a find-skills skill that finds and downloads a quality skill and runs it in a workflow. Rank skills by evals and run counts into a quality score, and let people ask which skills their peers use that they don't.

## Write a good skill: spec first, then lint

- **Write the spec first.** A short spec records what the skill must produce, which agents and models it supports, and which tool actions are required or forbidden. Compile the SKILL.md and its test prompts from the spec, and recompile when a model or agent changes, so the skill keeps working while you iterate on the implementation.
- **Linter rules distilled from what makes skills good:**
  - Steps are numbered, each with one objective and some way to at least softly verify it.
  - Each step gives a concrete command and checks its result before the next step.
  - The skill has an error recovery section: a table of failures and their fixes. "Try again" doesn't count.

## Evals: mostly real prompts, graded on trajectory

Build eval suites of about 5% golden cases (fixed input, expected output, tool mocks), 80% real prompts graded on trajectory, and 15% judged by the author. Trajectory means whether the agent used the right skills and tools in the right order, not just whether the outcome looked right.

- Run evals in three places: a background agent platform, a managed sandbox, and a remote dev machine. The clean room catches dependencies on the author's laptop ("it works on my machine" skills that expect certain file paths, cached documents, or OS tooling).
- Evals that pass 70-90% of runs can be more useful than ones that pass 100%. A 100% pass rate may mean the eval is missing meaningful changes in the answer.
- LLM-as-judge works best with a human-annotated set. Authors must create these, collect them from users, and grade them repeatedly.

## Ablation: prove the skill earns its keep

Replay real prompts once with the skill and once without, and let a blind judge pick the better answer. Test whole skills and parts of skills. As models get better, more words can reduce performance, so also test removing words.

Uber's warehouse-query skill, tested this way: without it, sessions made 13% more tool calls, had six times as many tool errors, took 31% longer, and the answer with the skill won 87% of blind comparisons. The biggest wins came from skills that give the agent something it couldn't easily find or understand, like access to internal documents or a way to run warehouse queries. If a skill doesn't win blind comparisons, change it or retire it.

## Cost: tokens are money

A skill that improves the answer also costs context: its instructions, tool calls, and results enter the context, and every later turn pays for that context again. Measure cost per invocation (total cost before the call vs after) and use these levers:

- **Use code over LLMs.** Steps that never vary run in scripts, so the model doesn't read every tool definition and every result. Uber's default MCP install loaded every tool's full description into every call: with 100+ tools, 50,000-70,000 tokens before the user typed anything. Moving fixed flows into utility scripts that call tools through a gateway dropped one 50-row query from about 1.4M tokens to about 900. Block .mcp.json tool-server installs inside skills; call tools through scripts instead.
- **Run the skill in a worker on a cheaper model.** The skill dispatches one subagent, the caller picks its model: small model for lookups, the most capable for correlating results. The large tool result stays in the worker's context and only a bounded summary returns. One tracing skill's cost per invocation fell 46% this way. Measure each skill after its change; one deployment skill showed no drop in its first week.
- **Run the script when the skill loads.** When the result is small and always needed, run the script at load time and put the output in the prompt. One search skill went from four turns to three, mean cost down 32%.
- **Move polling out of the main session.** In Uber's 20 highest-spend sessions, notification turns were about a third of spend. Polling moved to a background agent on a cheaper model.

## Papercuts: agents file their own bugs

A skill can stop working for a thousand reasons: a model upgrade changes how instructions read, a tool changes its flags, a harness changes how it runs the skill. Agents know when they're struggling: 100 turns fighting a weird error, a flag the help text lists and the tool rejects, a command that exits 0 on an error, a query that returns nothing when it should match.

Give every agent an always-available skill to file what it sees as friction. Each report (a *papercut*) states what the agent tried, what it expected, what happened, and what would fix it. Reports go to one dashboard, grouped by skill, then grouped, triaged, root-caused, fixed, evaluated, and measured for regressions before the ticket closes. A person acts at two steps: triage and approval.

Uber's agents filed thousands of papercuts in three months; hundreds were fixed. Real examples: a PR skill wrote the commit message to a shared temp file, so two concurrent sessions changed each other's PRs; a deployment skill passed epoch seconds where the API expects milliseconds; a config lookup returned a different property, with no error, when the key didn't exist; a PR skill waited for CI checks on a repo that has none, repeating the same 404 until timeout.

## Human signals

Independent of what an agent thinks, use human graders on sessions. If a skill opens pull requests, PR comments, iterations, and rejections are signals to improve the skill that created them. Blocked PRs become part of the eval set.

## Start small

Start with one task you already repeat. Define the sources and the format, spell out what a good result looks like (for a weekly update: three key updates, a link for each claim, flag uncertainty), then test it on real weeks to notice gaps. When the skill breaks, the agent reports what was tried, what happened, and possible fixes. Turn each miss into clearer instructions and run again.

## Source

- Uber Engineering blog: https://www.uber.com/uy/en/blog/optimizing-ubers-agent-skills/
- @ubereng post, Nov 24, 2026: https://x.com/ubereng/status/2125008806249930999
- Open format: https://agentskills.io
