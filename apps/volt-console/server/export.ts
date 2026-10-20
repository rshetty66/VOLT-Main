/** Turns a saved run into a Markdown document for review. */
import { ORCHESTRATOR_LANE } from "../shared/events.js";
import type { Engagement, StoredRun } from "../shared/records.js";

export function runToMarkdown(run: StoredRun, engagement: Engagement | null): string {
  const lanes = new Map<string, { name: string; layer: string; text: string }>();
  for (const e of run.events) {
    if (e.type === "agent_start" && e.lane !== ORCHESTRATOR_LANE) lanes.set(e.lane, { name: e.name, layer: e.layer, text: "" });
    if (e.type === "text_delta" && e.lane !== ORCHESTRATOR_LANE) {
      const l = lanes.get(e.lane);
      if (l) l.text += e.text;
    }
  }

  const lines = [`# ${run.title}`, ""];
  if (engagement) lines.push(`**Engagement:** ${engagement.clientName} - ${engagement.title}  `);
  lines.push(`**Run:** ${new Date(run.startedAt).toISOString().slice(0, 16).replace("T", " ")} UTC, ${run.kind}, ${run.mode === "demo" ? "demo mode (agent text is simulated)" : `live, ${run.model}`}  `);
  lines.push(`**Status:** ${run.status}${run.error ? ` (${run.error})` : ""}`, "");
  lines.push("## Request", "", run.prompt, "");
  if (run.intake && Object.keys(run.intake).length) {
    lines.push("## Intake", "", ...Object.entries(run.intake).map(([k, v]) => `- ${k}: ${v}`), "");
  }
  lines.push("## Deliverable", "", run.finalText.trim() || "_No final text was produced._", "");
  const specialists = [...lanes.values()].filter((l) => l.text.trim());
  if (specialists.length) {
    lines.push("## Specialist outputs", "");
    for (const l of specialists) lines.push(`### ${l.name} (${l.layer})`, "", l.text.trim(), "");
  }
  return lines.join("\n");
}
