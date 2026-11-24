/**
 * What a client-facing VOLT deliverable looks like, read from the plugin so the console follows the same files as Claude Code:
 *   skills/client-deliverable-standards/SKILL.md      how to write it (answer first, quantified, sourced exhibits, voice)
 *   commands/run-client-deliverable.md, section 3     what it contains, in order (the table of contents)
 */
import { countVisuals } from "../shared/viz.js";
import fs from "node:fs";
import path from "node:path";
import { PLUGIN_DIR, loadSkillBody } from "./catalog.js";

const FRONTMATTER = /^---[\s\S]*?---\s*/;

/** Section 3 ("Synthesise") of the Client Deliverable Production command: the sections of the finished deliverable. */
export function deliverableStructure(pluginDir = PLUGIN_DIR): string | null {
  try {
    const text = fs.readFileSync(path.join(pluginDir, "commands", "run-client-deliverable.md"), "utf8");
    return /^## 3\. Synthesise[^\n]*\n([\s\S]*?)(?=^## )/m.exec(text)?.[1].trim() ?? null;
  } catch {
    return null;
  }
}

/** The writing standards, without their frontmatter. */
export function deliverableStandards(pluginDir = PLUGIN_DIR): string | null {
  return loadSkillBody("client-deliverable-standards", pluginDir)?.body.replace(FRONTMATTER, "").trim() ?? null;
}

const CONSOLE_RULES = `In this console the answer is read by the client, so:
- Do not mention agents, specialists, tools, routing, the console or how the work was done. Where the specialists disagreed, state the position taken and why, without naming them.
- Number the \`##\` sections so they can be cited in a meeting. The numbered section headings become the table of contents of the downloaded file.`;

/**
 * How deep and how differentiated the deliverable must be. It maps onto the five sections of run-client-deliverable.md
 * (which stay the table of contents): the depth lives in the "###" sub-sections under them.
 */
export const DEPTH_STANDARD = `### Depth and differentiation standard

This deliverable is read next to the work of other major consulting firms, and it should win the engagement. Write 3,500 to 6,000 words for an assessment, plan, design or business case (shorter only for a narrow question). Every section carries analysis, not description. Under the five sections above, use these \`###\` sub-sections:

1. **Executive summary** (the first section, \`## 1. Executive summary\`; 200 words or fewer, able to stand alone; open with one headline sentence, then four bullets that each lead with a number): the answer; the quantified prize as a range with its main driver; the recommended path and what it costs; the three decisions the client must take; and the one insight that changes how they should think about the problem.
2. **Findings**: \`### Current-state baseline\` (the client's numbers against APQC benchmarks from apqc_benchmark, and the seven-dimension maturity from score_maturity; any figure the client did not give is stated as an assumption); \`### Root causes\` (a MECE issue tree, each cause quantified and ranked by its contribution to the gap); \`### What good looks like\` (leading practice, with its source); \`### Worked business scenario\` (a realistic scenario for this client with illustrative data: a table of the inputs such as entities, volumes, FTEs, cost per transaction and cycle times, the calculation step by step, and the result against the target; every illustrative figure is tagged [ASSUMPTION] or [ESTIMATE], and a \`chart\` block shows it).
3. **Recommendations**: a recommendations table (recommendation, what changes, owner, priority, value, timing, dependency); \`### Options considered\` (three real options scored against weighted criteria in a table, what each costs and forecloses, and the condition under which another option wins); \`### Target operating model\` or \`### Target architecture\` (design principles, process, roles, systems, data and controls, with one diagram); \`### Business case\` (each value lever with its arithmetic, investment and run cost, NPV, IRR and payback from build_value_case and appraise_investment, a low, base and high range, sensitivity on the two drivers that move the answer, and when the benefits land); \`### Roadmap\` (phases with durations, milestones, dependencies, critical path, resourcing and governance, no-regret moves first, and a Gantt chart).
4. **Key risks and assumptions**: a risk register (risk, likelihood, impact, mitigation, owner); every assumption with how it will be validated; data gaps; and the regulatory and control implications for the client's sector and jurisdiction.
5. **Next steps**: the decisions needed in the next 30 days, a 30-60-90 day plan with owners, and what is needed from the client.

How it wins the work:
- Open with a point of view the client has not heard: a non-obvious, evidenced insight about their situation, not a restatement of the request.
- Be specific to this client. Their numbers, platform, regulator, scale and constraints appear throughout; nothing could be pasted into another client's document.
- Show the arithmetic so the reader can price your credibility, and give ranges with their drivers.
- Sequence with intent: what to do first and why, no-regret moves versus big bets, and what to stop doing.
- Name the trade-offs and the conditions under which you would advise differently.
- Never invent credentials, client names, case studies, statistics or quotes. A figure without a source is labelled [Estimate] with its basis, or [Verify]. Say what data you need rather than assuming it.

Exhibits and visuals: at least five exhibits, and at least four visuals. Most exhibits are tables with an Exhibit title, a Source line and a read-out that says what it means. The visuals are:
- At least two data charts, each a fenced \`\`\`chart block holding one JSON object: {"type":"...","title":"...","unit":"days","labels":["A","B"],"series":[{"name":"Today","values":[12,9]}],"note":"the one-line takeaway","highlight":"A","target":{"value":5,"label":"Target"},"source":"..."}. Every value a number, one \`values\` entry per label; note, highlight (the label to call out) and target (a reference line) are optional and make the point land. Pick the type that fits the message: "waterfall" for a bridge or walk (first and last labels are totals, the ones between are changes: budget to actual, NII walk, cost baseline to target), "bar" or "hbar" to compare (up to three series), "stacked" for the make-up of each total (two to six series), "combo" for a volume and a rate together (two series: bars, then a line on its own axis with "unit2"), "line" for a trend, "donut" for the split of one total, "kpi" for one to six headline tiles (series 0 the value, an optional series 1 the comparison, "better":"down" when a fall is good, optional "trends" of past values per tile), "heatmap" for a matrix such as a readiness or risk view (rows are series, columns are labels; "scale":"rag" with 1 red, 2 amber, 3 green). The numbers must be the ones in your tables.
- At least two Mermaid diagrams where a picture does the work: a flowchart (target architecture or process), a gantt (the roadmap), a quadrantChart (effort against impact), a pie (the split of one total). Plain short labels, no colours in the markup.
- For a process, a close calendar or a data lineage path, show it as a fenced \`\`\`process block, swimlanes the reader can click through step by step, holding one JSON object: {"title":"...","note":"the takeaway","lanes":["Entity accounting","Group reporting"],"steps":[{"id":"cut","lane":"Entity accounting","stage":"D-1","name":"Sub-ledger cut-off","system":"Oracle EBS","control":"Cut-off checklist","owner":"...","duration":"4h","status":"manual|automated|new","issue":"the pain point, if any","detail":"one or two sentences"}],"links":[{"from":"cut","to":"cons","label":"trial balance"}],"source":"..."}. One to six lanes (teams or systems), two to twenty-four steps, up to ten stages (days such as D-2 to D+5, or phases); every step names a lane exactly as listed; links name step ids (leave links out and the steps run in the order written).
- For an architecture, platform, data or operating-model design, show each of the three options as a fenced \`\`\`architecture block, a 3D layered stack with the systems and the data flows between them, holding one JSON object: {"title":"Option B: ...","layers":[{"name":"Source ledgers","items":[{"name":"SAP ECC","status":"retire"},{"name":"Oracle EBS","status":"keep"}]},{"name":"Consolidation","items":[{"name":"OneStream","status":"new"}],"badge":"Recommended"}],"flows":[{"from":"SAP ECC","to":"OneStream","label":"journals"}],"note":"..."}. Two to seven layers listed from the foundation (sources) up to the consumption layer (reporting); one to four real, named systems per layer, each with a status: "new" (to be built or bought), "keep" (stays as it is) or "retire" (to be switched off); an optional short badge (Recommended, Risk); and four to eight flows, the main integrations, each naming a "from" and a "to" system exactly as spelled in the layers, with a label of the data that moves (journals, balances, master data, reports). Use the client's own systems from the request wherever they are named. The scoring table beside it must compare the same three options.
Put each visual next to the text it supports, with a one-line read-out under it.

Colour coding: in the priority, risk and status columns of tables write exactly High, Medium or Low (or Red, Amber or Green). The downloaded files colour these from the VOLT palette.

Files: when the user asks for a file (an Excel model, a deck, a Word report, a CSV, a PDF or a web page), put the full content in create_file and keep the chat answer short: the headline result, the key figures and what the file holds. Do not write the content twice. Give the file an action title. For a deck, each \`##\` is one slide whose heading states its message, with one exhibit and a source line. For a workbook, put inputs, calculations and outputs in separate tables and write formulas ("=B2*C2") instead of typed results, so the model recalculates when an input changes. Use the client template from list_templates when one fits.`;

/**
 * The evidence rules (URES v1 cardinal rules): what makes the deliverable auditable. Checked mechanically by
 * shared/research.ts, so the wording here and the gates there must agree.
 */
export const EVIDENCE_RULES = `### Evidence rules

Every figure and every factual claim must be traceable. A fluent answer with no evidence behind it is the failure these rules exist to prevent.

- Cite by source key. Every tool result comes back with a key, such as [S03], and S01 is always the client's own request and intake. Put the key after the sentence it supports: "The close takes 12 days against a 6.5 day median [S02]." Cite only keys the tools returned. A key you made up is a blocker.
- Never fabricate a source, URL, author, date or statistic. A memory of a paper is not a citation. If nothing supports a claim, tag it [INFERENCE] or [ASSUMPTION] and say what would verify it, or write "No verifiable source found for X". Absence of evidence is not evidence of absence.
- One source is a flag, not a fact. A claim that matters needs two independent keys, or the tag [SINGLE SOURCE].
- Tag each finding with its confidence and the date: (Confidence: HIGH, as of 2026-11). Confidence is 0.40 evidence strength + 0.25 source quality + 0.20 recency + 0.15 cross-source agreement; HIGH is 0.80 or more, MEDIUM 0.55 to 0.79, LOW below. Do not put a LOW claim in the executive summary.
- Separate sourced fact ("According to [S04], ...") from your own synthesis ("Across the sources, the pattern suggests ...").
- Add a sixth section, \`## 6. Evidence and method\`, after Next steps, with these sub-sections: \`### Scope and method\` (state the research depth you were given and what was and was not examined), \`### Evidence map\` (a table: claim, sources, source types, confidence, as-of), \`### Contradictions and tensions\` (each disagreement with the strongest position on both sides, or "none identified"), \`### Gaps and limitations\` (what could not be found and why), and \`### Residue\` (claims that failed the citation or confidence floor, moved here rather than softened). Do not write a source list: the source register is appended from the keys.`;

/** The instructions that make the lead agent's final answer a client deliverable. Empty when the plugin files are missing. */
export function leadDeliverableGuide(pluginDir = PLUGIN_DIR): string {
  const standards = deliverableStandards(pluginDir);
  const structure = deliverableStructure(pluginDir);
  if (!standards && !structure) return "";
  return [
    "## The final answer is a client deliverable",
    structure ? `The deliverable contains, in this order (from the VOLT Client Deliverable Production workflow):\n\n${structure}` : "",
    CONSOLE_RULES,
    DEPTH_STANDARD,
    EVIDENCE_RULES,
    standards ? `### Client deliverable standards\n\n${standards}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** What a specialist's notes follow: the same writing standards, since the notes can be handed to the client as an appendix. */
export function specialistDeliverableGuide(pluginDir = PLUGIN_DIR): string {
  const standards = deliverableStandards(pluginDir);
  return standards ? `## Writing standard\nCite the source key (such as [S03]) that every tool result returns, and never invent a source: tag an unsupported claim [INFERENCE] or [ASSUMPTION]. Your notes may go to the client as an appendix, so write them to the standard below. Go to the depth of a senior practitioner\'s client workpaper, not a summary. Include one worked example with illustrative data (a small table of inputs, the calculation, the result), each illustrative figure tagged [ASSUMPTION] or [ESTIMATE]. If your workstream designs an architecture, show it as one fenced \`\`\`architecture block (JSON: title, layers listed from foundation up, each with a name and one to four items given as {"name","status":"new|keep|retire"}, and "flows" of {"from","to","label"} naming those items). Visuals: up to two Mermaid diagrams (flowchart, gantt, quadrantChart or pie) and one data chart as a fenced \`\`\`chart block with JSON {"type":"bar|hbar|line|donut|stacked|combo|waterfall|kpi|heatmap","title":"...","unit":"...","labels":[...],"series":[{"name":"...","values":[...]}],"note":"takeaway","highlight":"label to call out"} (waterfall: first and last labels are totals); show other exhibits as tables.\n\n${standards}` : "";
}

// ── The depth check: a thin draft is sent back for one rewrite ────────────────────────────────────────────

export interface DepthReport {
  words: number;
  tables: number;
  exhibits: number;
  /** Fenced visuals: data charts and Mermaid diagrams. */
  visuals: number;
  /** What the draft lacks, in words the lead agent can act on. Empty when the draft meets the standard. */
  gaps: string[];
  ok: boolean;
}

export const MIN_WORDS = 2200;
const SECTION_CHECKS: [string, RegExp][] = [
  ["an executive summary", /executive summary|^##\s*(\d+[.)]\s*)?summary/im],
  ["findings (the current-state baseline and root causes)", /finding|current[- ]state|baseline|diagnos/i],
  ["recommendations, with options considered", /recommend/i],
  ["a business case (value, investment, NPV or payback)", /\b(NPV|IRR|payback|business case|ROI)\b/i],
  ["a roadmap (phases, milestones, dependencies)", /roadmap|phase \d|milestone/i],
  ["key risks and assumptions", /risk/i],
  ["next steps", /next steps/i],
];

/** Measures a final answer against the depth standard. Pure, so it can be tested and tuned without a model. */
export function assessDepth(markdown: string): DepthReport {
  const prose = markdown.replace(/```[\s\S]*?```/g, " ");
  const words = (prose.match(/\S+/g) ?? []).length;
  const tables = (markdown.match(/^\|[\s:-]+\|[\s|:-]*$/gm) ?? []).length;
  const exhibits = (markdown.match(/\*\*Exhibit\s+\d+/gi) ?? []).length;
  const visuals = countVisuals(markdown);
  const gaps: string[] = [];
  if (words < MIN_WORDS) gaps.push(`it is about ${words} words; a client deliverable of this kind needs 3,500 to 6,000, with real analysis in each section`);
  for (const [label, re] of SECTION_CHECKS) if (!re.test(markdown)) gaps.push(`it is missing ${label}`);
  if (tables < 3) gaps.push(`it has ${tables} table${tables === 1 ? "" : "s"}; it needs at least three (recommendations, options scored against criteria, a risk register) and five exhibits in all`);
  if (exhibits < 3) gaps.push("its exhibits are not labelled `**Exhibit N: title**` with a Source line and a read-out");
  if (visuals < 4) gaps.push(`it has ${visuals} visual${visuals === 1 ? "" : "s"}; it needs at least four: two data charts in \`\`\`chart blocks (JSON) and two Mermaid diagrams`);
  if (!/\bSource:/i.test(markdown)) gaps.push("no exhibit carries a Source line");
  if (/\b(specialists?|sub-?agents?|consult_agent|find_agents)\b/i.test(prose)) gaps.push("it refers to specialists, agents or tools, which the client must not see");
  return { words, tables, exhibits, visuals, gaps, ok: gaps.length === 0 };
}

/** Whether a request calls for a full client deliverable rather than a short answer or a command. */
export function wantsDeliverable(prompt: string): boolean {
  const p = prompt.trim();
  if (!p || p.startsWith("/")) return false;
  return p.length >= 120 || /\b(plan|assess|assessment|design|business case|roadmap|strategy|recommend|diagnos\w*|benchmark|options|proposal|transform\w*|readiness|architecture|approach|case for)\b/i.test(p);
}

/** The instruction for the one rewrite of a thin draft. */
export function strengthenPrompt(report: DepthReport): string {
  return `Partner review. Your draft does not yet meet the depth standard for a client deliverable that has to win the work:
${report.gaps.map((g) => `- ${g}`).join("\n")}

Rewrite the complete deliverable. Keep everything that is strong and add what is missing, following the depth and differentiation standard and the section structure you were given. Use the analytics tools for every figure you add, and consult the specialists again if a section needs more depth. Return only the full revised deliverable, as the client will read it, with no commentary about this review.`;
}
