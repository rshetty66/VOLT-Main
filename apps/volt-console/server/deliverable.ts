/**
 * What a client-facing VOLT deliverable looks like, read from the plugin so the console follows the same files as Claude Code:
 *   skills/client-deliverable-standards/SKILL.md      how to write it (answer first, quantified, sourced exhibits, voice)
 *   commands/run-client-deliverable.md, section 3     what it contains, in order (the table of contents)
 */
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
- Diagrams are limited to one Mermaid flowchart or sequenceDiagram; show every other exhibit as a table, with its Exhibit title and Source line.
- Number the \`##\` sections so they can be cited in a meeting. The numbered section headings become the table of contents of the downloaded file.`;

/** The instructions that make the lead agent's final answer a client deliverable. Empty when the plugin files are missing. */
export function leadDeliverableGuide(pluginDir = PLUGIN_DIR): string {
  const standards = deliverableStandards(pluginDir);
  const structure = deliverableStructure(pluginDir);
  if (!standards && !structure) return "";
  return [
    "## The final answer is a client deliverable",
    structure ? `The deliverable contains, in this order (from the VOLT Client Deliverable Production workflow):\n\n${structure}` : "",
    CONSOLE_RULES,
    standards ? `### Client deliverable standards\n\n${standards}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** What a specialist's notes follow: the same writing standards, since the notes can be handed to the client as an appendix. */
export function specialistDeliverableGuide(pluginDir = PLUGIN_DIR): string {
  const standards = deliverableStandards(pluginDir);
  return standards ? `## Writing standard\nYour notes may go to the client as an appendix, so write them to the standard below. Diagrams: at most one Mermaid flowchart or sequenceDiagram; show other exhibits as tables.\n\n${standards}` : "";
}
