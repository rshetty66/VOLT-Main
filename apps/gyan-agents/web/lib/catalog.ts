export const domainLabels = {
  r2r: "Record to report",
  fpa: "Financial planning & analysis",
  p2p_o2c: "Procure to pay / Order to cash",
  controls: "Controls",
  executive: "Executive",
} as const;

type Domain = keyof typeof domainLabels;
type AgentSummary = { id: string; name: string; description: string; domain: Domain };
type Catalog = { ok: true; agents: AgentSummary[] } | { ok: false };

function isAgent(value: unknown): value is AgentSummary {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return ["id", "name", "description"].every(
    (field) => typeof record[field] === "string" && record[field].trim().length > 0,
  ) && typeof record.domain === "string" && Object.hasOwn(domainLabels, record.domain);
}

export async function getCatalog(): Promise<Catalog> {
  try {
    const base = process.env.GYAN_AGENTS_API_URL ?? "http://127.0.0.1:8000";
    const response = await fetch(`${base.replace(/\/+$/, "")}/agents`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { ok: false };
    const data: unknown = await response.json();
    if (!Array.isArray(data) || !data.every(isAgent)) return { ok: false };
    return { ok: true, agents: data };
  } catch {
    return { ok: false };
  }
}
