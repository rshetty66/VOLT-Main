---
name: agentic-diagrams
description: "Build interactive, animated AI-agent architecture diagrams, process flows and business reference architectures as a single standalone HTML file with typed nodes (agent, tool, model, guardrail, human, memory), typed edges, click-for-detail panels, play/step scenario playback with parallel and error paths, and PNG/SVG/JSON export. Use when asked to draw, animate or explain an agentic workflow, multi-agent system, RAG pipeline, human-in-the-loop flow or reference architecture, or to build something like agenticdiagrams.com."
license: MIT
metadata:
  author: rshetty
  version: '1.0'
---

# Agentic Diagrams

Turn a description of an agent system into an interactive diagram: layered nodes, typed edges, and named scenarios that play step by step with example payloads.

## When to Use
- "Draw / animate the architecture of our agent platform"
- Process flows with humans, approvals and error paths
- Business reference architectures for a client deck or review
- Not for plain charts (use a chart tool) or static one-off sketches

## Procedure
1. Gather components and flows. Ask only if the system boundary is unclear; otherwise state assumptions.
2. Map each component to a node type: agent, tool, model, prompt, skill, output, user, human, memory, knowledge, environment, aggregator, gateway, router, channel, trigger, guardrail, observability.
3. Map each connection to an edge kind: request (solid), response (dashed), async (dotted), streaming (animated dash), event, error (red).
4. Keep it readable: at most 14 nodes and about 5 per tier. If more, split into a top-level view plus one diagram per subsystem.
5. Define 2 to 4 scenarios: happy path, escalation to a human, failure or retry. Each step names an edge (`"from>to"`) or several for parallel branches (`"edges":[...]`), a short note, and an optional example payload. Loops and alternatives are separate steps or separate scenarios.
6. Write the spec JSON (see `assets/example-spec.json` for the schema: title, nodes, edges, groups, scenarios).
7. Build: `python3 scripts/build.py spec.json out.html`. The script validates types, edge references and scenario steps, then fills `assets/template.html`. Fix any "spec error" and rebuild.
8. Check the rendering in a headless browser: screenshot at 1280x720 and at phone width, step through each scenario, confirm no overlapping labels, clipped text, or console errors. Adjust node `col`/`row` or edge labels if needed.
9. Deliver the HTML file. Publish as a website only if the user wants a link, and warn that links are public: never include client data or real payloads.

## Rules
- Layout is automatic (left to right by dependency; loops route below). Override with `col` and `row` on a node when needed.
- Use realistic but synthetic payloads.
- Short labels: node label under 20 characters, edge label under 14.
- Mark human approval points and guardrails explicitly; they are the story for finance and regulated clients.
- Export in the file: Export button offers png, svg or json (the JSON is the spec and can be rebuilt).

## Bundled files
- `scripts/build.py`: validate a spec and write the standalone HTML.
- `assets/template.html`: renderer (SVG, playback, themes, export). Edit only to change visuals.
- `assets/example-spec.json`: working example with parallel branches, an escalation and an error edge. Copy and modify.
