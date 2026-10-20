/**
 * A stand-in for the Messages API for the mock evals: each specialist looks up a skill,
 * then answers with a short deliverable ending in a handoff summary; Rudra's synthesis
 * answers with the sections a deliverable must have. It checks the plumbing of every
 * workflow (agents exist, phases run, briefs and handoffs flow), not the writing.
 */
import http from "node:http";
import type { AddressInfo } from "node:net";

const send = (res: http.ServerResponse, blocks: any[], stop: string) => {
  const ev: any[] = [{ type: "message_start", message: { id: `m${Date.now()}`, type: "message", role: "assistant", model: "claude-opus-5-5", content: [], stop_reason: null, usage: { input_tokens: 200, output_tokens: 0, cache_read_input_tokens: 800, cache_creation_input_tokens: 300 } } }];
  blocks.forEach((b, i) => {
    if (b.type === "text") {
      ev.push({ type: "content_block_start", index: i, content_block: { type: "text", text: "" } }, { type: "content_block_delta", index: i, delta: { type: "text_delta", text: b.text } });
    } else {
      ev.push({ type: "content_block_start", index: i, content_block: { type: "tool_use", id: b.id, name: b.name, input: {} } }, { type: "content_block_delta", index: i, delta: { type: "input_json_delta", partial_json: JSON.stringify(b.input) } });
    }
    ev.push({ type: "content_block_stop", index: i });
  });
  ev.push({ type: "message_delta", delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 400 } }, { type: "message_stop" });
  res.writeHead(200, { "content-type": "text/event-stream" });
  for (const e of ev) res.write(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`);
  res.end();
};

export async function startEvalMock(): Promise<{ url: string; requests: () => number; close: () => void }> {
  let n = 0;
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      n++;
      const body = JSON.parse(raw);
      const system: string = body.system?.[0]?.text ?? "";
      const last = body.messages.at(-1);
      const answered = Array.isArray(last.content) && last.content.some((c: any) => c.type === "tool_result");
      if (system.includes("You are synthesising")) {
        return send(res, [{ type: "text", text: `# Workflow deliverable (mock)\n\n## Executive summary\nThe specialists agree on three priorities; figures come from the VOLT tools.\n\n## Integrated findings\nEach phase built on the previous one's handoff.\n\n## Recommendations\n| Recommendation | Owner workstream | Priority | Value / risk |\n|---|---|---|---|\n| Standardise the process | Process | High | Faster cycle |\n| Automate reconciliations | Technology | High | Fewer errors |\n\n## Key risks and assumptions\n- Data quality may delay the plan.\n\n## Next steps\n1. Confirm scope with the sponsor.\n` }], "end_turn");
      }
      const agent = system.match(/You are the (.+?) agent \(/)?.[1] ?? "Specialist";
      if (!answered) return send(res, [{ type: "tool_use", id: `tu_${n}`, name: "find_skills", input: { query: agent } }], "tool_use");
      return send(res, [{ type: "text", text: `## ${agent}: contribution (mock)\nLead answer for this phase.\n\n| Item | Finding |\n|---|---|\n| Current state | Documented |\n\n## Handoff summary\n- ${agent} confirms the current state and the next decision.\n` }], "end_turn");
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, requests: () => n, close: () => server.close() };
}
