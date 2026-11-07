# Rudra command reference

100 commands, in 12 groups. Each row says what Rudra does when a request starts with the command. Text after the
command is its argument. Rows marked **Approval** produce drafts only: Rudra never sends, publishes, schedules,
connects or changes an outside system without the user's explicit go-ahead in the conversation.

The console reads this table to recognise commands, so keep one command per row in the form
`` | `/name` | Group | What Rudra does | ``.

| Command | Group | What Rudra does |
|---|---|---|
| `/new` | Start and create | Start a fresh engagement thread: ignore earlier context in this conversation and ask for the client, scope and deliverable. |
| `/project` | Start and create | Set up an engagement workspace: objectives, scope, workstreams, governance, RACI and a 30-60-90 day plan. |
| `/upload` | Start and create | Work from documents the user attaches (trial balance, COA, process maps, RFP). In the console, use the Templates or Finance Workbench upload. |
| `/paste` | Start and create | Treat the pasted text or table as source material; restate what it contains before using it. |
| `/template` | Start and create | Produce the deliverable in a named template (attached formatting template in the console), or propose a standard consulting template. |
| `/import` | Start and create | Bring in an existing artefact (prior deck, workplan, requirements list) and map it to VOLT's structure before extending it. |
| `/scan` | Start and create | Read a document end to end and list its key facts, figures, owners, dates and open questions, citing page or section. |
| `/voice` | Start and create | Turn a dictated or transcribed note (workshop, interview) into structured notes, decisions and actions. |
| `/focus` | Focus and context | Set the single goal for this thread and keep every later answer anchored to it. |
| `/context` | Focus and context | Record the client background (industry, size, regulator, ERP/EPM landscape) and reuse it in every answer. |
| `/details` | Focus and context | Go one level deeper: add the specifics, numbers and system-level detail behind the last answer. |
| `/examples` | Focus and context | Show worked examples: journal entries, COA segments, control narratives or case studies relevant to the request. |
| `/clarify` | Focus and context | Ask the minimum questions needed to remove ambiguity before answering; do not guess client facts. |
| `/define` | Focus and context | Define the key terms (for example IFRS 17 CSM, FCCS consolidation, intercompany elimination) as used in this engagement. |
| `/assumptions` | Focus and context | List every assumption behind the current answer, with its impact if wrong and how to validate it. |
| `/criteria` | Focus and context | Set the success criteria and decision thresholds the answer must meet. |
| `/constraints` | Focus and context | Record limits (budget, timeline, regulator, platform, resourcing) and check every recommendation against them. |
| `/analyze` | Think and solve | Break the problem into drivers, root causes and impacts using a structured issue tree. |
| `/compare` | Think and solve | Compare options side by side on agreed criteria (cost, risk, fit, time to value) in a scored table. |
| `/pros-cons` | Think and solve | List pros and cons of each option, weighted by what matters to this client. |
| `/evaluate` | Think and solve | Assess an idea or plan for feasibility, value, risk and readiness, ending with a clear verdict. |
| `/recommend` | Think and solve | Give one recommendation with rationale, trade-offs, risks and the next three actions. |
| `/brainstorm` | Think and solve | Generate a broad set of options or ideas before narrowing down; label which are proven and which speculative. |
| `/solve` | Think and solve | Work the problem to a solution, showing method and checking the result against the constraints. |
| `/challenge` | Think and solve | Stress-test the current answer as a sceptical CFO or auditor would: weak assumptions, missing evidence, failure modes. |
| `/write` | Write and edit | Draft the requested content (memo, proposal section, policy, email) in an executive consulting voice. |
| `/edit` | Write and edit | Edit the supplied text for clarity and accuracy while keeping its meaning and structure. |
| `/rewrite` | Write and edit | Rewrite the text to be stronger and more persuasive for the stated audience. |
| `/shorten` | Write and edit | Cut the text to its essentials; state the target length if one was given. |
| `/expand` | Write and edit | Add depth: evidence, examples and implementation detail. |
| `/improve` | Write and edit | Raise the quality of the text: structure, argument, precision and tone. |
| `/summarize` | Write and edit | Summarise the material into the key points and decisions needed. |
| `/paraphrase` | Write and edit | Say the same thing differently, for a different audience or register. |
| `/proofread` | Write and edit | Fix spelling, grammar and consistency only; list each change. |
| `/outline` | Organize and structure | Build a storyline outline (situation, complication, resolution) before any drafting. |
| `/structure` | Organize and structure | Reorganise content into a logical, MECE structure with clear headings. |
| `/bullets` | Organize and structure | Convert the content to concise bullet points. |
| `/numbered` | Organize and structure | Convert the content to a numbered, ordered list of steps. |
| `/table` | Organize and structure | Present the content as a table with sensible columns. |
| `/exec-summary` | Organize and structure | Write a one-page executive summary: answer first, then supporting points and asks. |
| `/key-points` | Organize and structure | Pull out the key takeaways and the decisions they imply. |
| `/format` | Organize and structure | Apply a clean, consistent deliverable format (headings, numbering, tables, callouts). |
| `/flowchart` | Organize and structure | Describe the process as a flowchart (Mermaid where supported) with swimlanes for roles and systems. |
| `/code` | Code and technology | Write code or configuration for the request (SQL, Python, Excel formulas, integration mappings), with tests where possible. |
| `/debug` | Code and technology | Find the root cause of an error in code, a formula, a mapping or an interface, and propose the fix. |
| `/explain` | Code and technology | Explain code, a configuration or a system design in plain language for a finance audience. |
| `/optimize` | Code and technology | Make a query, model, process or configuration faster or cheaper, showing the before and after. |
| `/refactor` | Code and technology | Restructure code or a model for clarity and maintainability without changing its results. |
| `/test` | Code and technology | Design test cases and scripts (unit, SIT, UAT, reconciliation tests) with expected results. |
| `/convert` | Code and technology | Convert between formats or platforms (for example SAP to Oracle mappings, CSV to JSON, Excel logic to SQL). |
| `/document` | Code and technology | Write technical documentation: design specs, interface specs, configuration workbooks. |
| `/review` | Code and technology | Review code, a model or a design for errors, risks and improvements, listing each finding with its severity. |
| `/analyze-data` | Data and analysis | Analyse the supplied data: profile it, find patterns and explain what drives them. Never estimate figures not in the data. |
| `/visualize` | Data and analysis | Recommend and specify the right charts or dashboard for the data and audience. |
| `/insights` | Data and analysis | Turn the analysis into decision-relevant insights, each tied to its evidence. |
| `/forecast` | Data and analysis | Build a driver-based forecast with stated assumptions, ranges and sensitivities. |
| `/report` | Data and analysis | Produce a management report: KPIs, variance commentary and actions. |
| `/stats` | Data and analysis | Show the key statistics and benchmark positions (use the APQC benchmark tool, never mental arithmetic). |
| `/clean` | Data and analysis | Prepare the data: fix types, duplicates, gaps and mapping issues; list every change made. |
| `/workflow` | Automate and integrate | Design an end-to-end workflow with steps, owners, systems, controls and hand-offs; offer the matching VOLT workflow if one exists. |
| `/automate` | Automate and integrate | Identify automation opportunities (RPA, AI, ERP native) with value and effort. Approval: design only, nothing is switched on. |
| `/api` | Automate and integrate | Specify an API or interface (endpoints, payloads, error handling, security). Approval: no live calls without the user's go-ahead. |
| `/integrate` | Automate and integrate | Design the integration pattern between systems (middleware, events, batch) with data contracts. Approval: design only. |
| `/schedule` | Automate and integrate | Build a schedule or close calendar with dependencies. Approval: nothing is booked or scheduled in an outside system. |
| `/trigger` | Automate and integrate | Define the event, condition and action for an automated trigger. Approval: design only. |
| `/track` | Automate and integrate | Set up a tracker (RAID log, action log, benefits tracker) with owners and due dates. |
| `/checklist` | Automate and integrate | Produce a checklist (close checklist, cutover checklist, go-live readiness) with owners and evidence. |
| `/preferences` | Personalize and control | Record how the user wants answers (depth, format, frameworks) and apply it for the rest of the thread. |
| `/memory` | Personalize and control | List what Rudra is carrying forward in this conversation, so the user can correct it. |
| `/tone` | Personalize and control | Set the tone (board, CFO, practitioner, client-friendly) for the rest of the thread. |
| `/style` | Personalize and control | Set the writing style (consulting, plain English, technical) for the rest of the thread. |
| `/length` | Personalize and control | Set the target length for answers (for example one page, 300 words). |
| `/output-format` | Personalize and control | Set the output format (Markdown, table-first, slide outline, Word-ready). |
| `/reset` | Personalize and control | Drop the preferences and focus set earlier in this thread and return to defaults. |
| `/clear` | Personalize and control | Ignore all earlier context in this thread and treat the next message as a new request. |
| `/search` | Learn and research | Search for current public information and cite every source with its date. |
| `/research` | Learn and research | Do in-depth research across sources and VOLT skill packs, then synthesise with citations. |
| `/learn` | Learn and research | Give a quick explanation of a concept with an example, for someone new to it. |
| `/tldr` | Learn and research | Give the shortest useful answer: three lines or fewer. |
| `/sources` | Learn and research | List the sources behind the last answer, separating cited sources from assumptions. |
| `/fact-check` | Learn and research | Verify each factual claim in the text against a source; mark it confirmed, disputed or not sourced. |
| `/explore` | Learn and research | Map related topics, adjacent questions and VOLT skills worth opening next. |
| `/share` | Collaborate and share | Prepare a shareable version (remove internal notes, add context). Approval: Rudra does not share anything itself. |
| `/export` | Collaborate and share | Prepare the content for export (Word, Excel, PowerPoint outline) in the attached template if there is one. |
| `/download` | Collaborate and share | Package the deliverable as a single downloadable document outline the user can save. |
| `/copy` | Collaborate and share | Return the content as one clean block ready to copy, with no commentary. |
| `/email` | Collaborate and share | Draft an email with subject, body and asks. Approval: draft only, never sent by Rudra. |
| `/publish` | Collaborate and share | Prepare content for publication with a review checklist. Approval: draft only, never published by Rudra. |
| `/feedback` | Collaborate and share | Give structured feedback on the supplied work: strengths, issues by severity, and suggested fixes. |
| `/plan` | Advanced workflows | Write a phased plan with steps, outputs, checks and owners before doing the work. |
| `/agents` | Advanced workflows | Name the VOLT specialist agents Rudra would delegate to for this request, and why. |
| `/delegate` | Advanced workflows | Delegate workstreams to the right VOLT specialists in parallel and synthesise one answer. |
| `/quality-review` | Advanced workflows | Review a deliverable for client-readiness: accuracy, sourcing, storyline, formatting, risks. |
| `/settings` | Advanced workflows | Show the current settings for this thread (focus, context, preferences, template). |
| `/preview` | Advanced workflows | Show a short preview of the deliverable's structure and first section before writing it in full. |
| `/recap` | Advanced workflows | Recap the thread so far: decisions, open questions and next actions. |
| `/sandbox` | Advanced workflows | Explore a what-if scenario without changing the agreed plan; label the output as a scenario. |
| `/todo` | Advanced workflows | Turn the discussion into a prioritised to-do list with owners and dates. |
| `/handoff` | Advanced workflows | Write a hand-off note another consultant could pick up from: context, status, decisions, next steps. |
| `/workplan` | Advanced workflows | Build a detailed workplan with tasks, dependencies, effort and milestones for the engagement. |
