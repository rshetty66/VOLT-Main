/**
 * Minimal streaming mock of POST /v1/messages for the assistant loop, so it runs without an API key.
 * Turn 1: the model calls check_coa with a chart chosen by a marker in the user prompt. Turn 2: it answers.
 */
import http from "node:http";
import type { AddressInfo } from "node:net";

export interface Captured { headers: http.IncomingHttpHeaders; body: any }

export const GOOD_CSV = "code,name,type,parent\n1000,Assets,asset,\n1100,Cash,asset,1000\n";
export const BAD_CSV = "code,name,type,parent\n1000,Assets,asset,\n1100,Cash,expense,1000\n";

const sse = (res: http.ServerResponse, events: any[]) => {
  res.writeHead(200, { "content-type": "text/event-stream" });
  for (const e of events) res.write(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`);
  res.end();
};
const msg = (id: string, blocks: any[], stop: string) => {
  const ev: any[] = [{ type: "message_start", message: { id, type: "message", role: "assistant", model: "claude-opus-5-5", content: [], stop_reason: null, usage: { input_tokens: 100, output_tokens: 0, cache_read_input_tokens: 50 } } }];
  blocks.forEach((b: any, i: number) => {
    if (b.type === "text") {
      ev.push({ type: "content_block_start", index: i, content_block: { type: "text", text: "" } });
      ev.push({ type: "content_block_delta", index: i, delta: { type: "text_delta", text: b.text } });
    } else {
      ev.push({ type: "content_block_start", index: i, content_block: { type: "tool_use", id: b.id, name: b.name, input: {} } });
      ev.push({ type: "content_block_delta", index: i, delta: { type: "input_json_delta", partial_json: JSON.stringify(b.input) } });
    }
    ev.push({ type: "content_block_stop", index: i });
  });
  ev.push({ type: "message_delta", delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 42 } });
  ev.push({ type: "message_stop" });
  return ev;
};

export async function startMockAnthropic(): Promise<{ url: string; requests: Captured[]; close: () => void }> {
  const requests: Captured[] = [];
  let n = 0;
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const b = JSON.parse(body);
      requests.push({ headers: req.headers, body: b });
      n++;
      const last = b.messages.at(-1);
      const hasResults = Array.isArray(last.content) && last.content.some((c: any) => c.type === "tool_result");
      if (hasResults) return sse(res, msg(`m${n}`, [{ type: "text", text: "Final answer." }], "end_turn"));
      const first = JSON.stringify(b.messages[0].content);
      const csv = first.includes("MARK_BAD") ? BAD_CSV : GOOD_CSV;
      sse(res, msg(`m${n}`, [{ type: "tool_use", id: `tu_${n}`, name: "check_coa", input: { accounts_csv: csv } }], "tool_use"));
    });
  });
  await new Promise<void>((r) => server.listen(0, r));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}`, requests, close: () => server.close() };
}
