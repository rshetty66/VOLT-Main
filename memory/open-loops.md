# Open loops

Add new items with the date. Mark finished items done with the date; never silently drop one.

- [ ] 2026-11-24: Draft PR 91 (goal planner, `plan_finance_goal`) awaits Rakesh's merge OK.
- [ ] 2026-11-24: Skills prune of `plugins/volt/skills` (via `import_volt.py`) comes next, as its own PR.
- [ ] 2026-11-24: Cost work (spend cap, usage log, model routing) is paused until the very end. 2026-11-25: Rakesh asked for model routing and per-run usage now (draft PR); a hard spend cap is still not built.
- [ ] 2026-11-24: Rakesh to set `VOLT_AUTH_MODE=username` in Render.
- [ ] 2026-11-24: FSDF is not yet run on a real Oracle database.
- [ ] 2026-11-24: Draft PR for this memory-first agent system awaits Rakesh's review and merge OK.
- [x] 2026-11-24: #95, #96, #98 (charts, HTML template, create_file) and fixes #100 to #103 merged. Open option: a server PDF library (pdfkit) for one-click PDF.
- [ ] 2026-11-25: Draft PR: VOLT HTML deliverable follows Rakesh's reference layout (KPI strip, card grids, lettered sections, walkthrough bar). Awaits his review and merge OK.
- [ ] 2026-11-24: Draft PR #99 (web research with cited, retrieved sources) awaits Rakesh's merge OK. After merge he sets `VOLT_WEB_RESEARCH=on` in Render (optional `VOLT_WEB_MAX_SEARCHES`, default 20) and an org admin allows web search and web fetch in the Claude Console. Not yet live-tested.
- [ ] 2026-11-25: Draft PR for the consulting PPT template skill and the VOLT PowerPoint export rework awaits Rakesh's review and merge OK. Waterfall, target-line and process charts are still pictures in the VOLT export. Deck fonts are Georgia and Arial (Rakesh, 2026-11-25).
- [x] 2026-11-25: PR #108 scope questions before the first message of each VOLT chat (client type, outcome, reporting basis, deliverable, depth; defaults, skip, change chip). Awaits Rakesh's review and merge OK. Merged 2026-11-25 on Rakesh's MERGE.
- [x] 2026-11-25: Draft PR: VOLT model router (Haiku triage, Sonnet specialists and quick asks, Opus for deliverable leads and workflow synthesis; estimated cost per chat and per model; `VOLT_ROUTING=off` to undo). Merged as #109 on 2026-11-25. Not yet live-tested against the API; Sonnet-vs-Opus specialist A/B awaits Rakesh's spend OK.
- [ ] 2026-11-25: Draft PR for projects, saved chats, archive, knowledge base and project memory awaits Rakesh's review and merge OK. URL fetch not tested against the live internet from the build sandbox. Watch disk use on the 1 GB disk.
- [ ] 2026-11-26: Draft PR: ScrapeGraph rendered fallback for knowledge-base URLs (opt-in via SCRAPEGRAPH_API_KEY). Awaits Rakesh's review and merge OK; after merge he adds the key in Render. Agent-Reach kept out (cookie and shell risk). Not live-tested against the ScrapeGraph API.
- [ ] 2026-11-26: Draft PR: Accounting Hub agent (accounting-hub-page skill + build_accounting_hub tool, five-tab page, verifier). Generic only, no consulting-firm names (Rakesh). Awaits his review and merge OK. Not live-tested against the API. Branding options: VOLT (default) and client light; confirm with Rakesh.
- [ ] 2026-11-27: PR #133 AnimationChart (opt-in, ANIMATIONCHART_API_KEY in Render; only for requests that ask for animation; falls back to VOLT charts). Not live-tested (sandbox proxy blocks animationchart.com). Vendor has template-only Terms/Privacy, no SOC 2/ISO, data region not stated: keep client data out until reviewed. Rakesh to rotate the leaked key and set the new one in Render.
