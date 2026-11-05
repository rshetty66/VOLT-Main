import type { AssistRequest, CoaEvent, Health } from "../shared/events";

export async function getHealth(): Promise<Health> {
  const r = await fetch("/api/healthz");
  if (!r.ok) throw new Error(`healthz: ${r.status}`);
  return r.json();
}

/** POSTs a request and yields the server-sent events of the reply. */
export async function* streamAssist(req: AssistRequest, signal: AbortSignal): AsyncGenerator<CoaEvent> {
  const r = await fetch("/api/assist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req), signal });
  if (!r.ok || !r.body) throw new Error(`Assist failed: ${r.status} ${await r.text()}`);
  const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const data = frame.split("\n").filter((l) => l.startsWith("data: ")).map((l) => l.slice(6)).join("\n");
      if (data) yield JSON.parse(data) as CoaEvent;
    }
  }
}
