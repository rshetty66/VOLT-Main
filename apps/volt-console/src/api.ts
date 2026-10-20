import type { CatalogResponse, RunRequest, VoltEvent } from "../shared/events";
import type { Engagement, RunSummary, StoredRun } from "../shared/records";

export type EngagementDetail = Engagement & { runs: RunSummary[] };

export const listEngagements = () => getJSON<Engagement[]>("/api/engagements");
export const getEngagementDetail = (id: string) => getJSON<EngagementDetail>(`/api/engagements/${id}`);
export const getStoredRun = (id: string) => getJSON<StoredRun>(`/api/runs/${id}`);
export const runMarkdownUrl = (id: string) => `/api/runs/${id}/markdown`;

export async function createEngagement(input: { clientName: string; title: string; description?: string }): Promise<Engagement> {
  const r = await fetch("/api/engagements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!r.ok) throw new Error(`Could not create the engagement (${r.status})`);
  return r.json();
}

export async function fetchCatalog(): Promise<CatalogResponse> {
  const r = await fetch("/api/catalog");
  if (!r.ok) throw new Error(`Catalog failed: ${r.status}`);
  return r.json();
}

export async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

export async function runTool<T = unknown>(name: string, input: unknown): Promise<{ ok: boolean; data?: T; summary?: string; error?: string }> {
  const r = await fetch(`/api/tools/${name}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  return r.json();
}

/** POSTs a run and yields Server-Sent Events as they arrive. */
export async function* streamRun(req: RunRequest, signal: AbortSignal): AsyncGenerator<VoltEvent> {
  const r = await fetch("/api/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!r.ok || !r.body) throw new Error(`Run failed: ${r.status} ${await r.text()}`);
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
      if (data) yield JSON.parse(data) as VoltEvent;
    }
  }
}
