/**
 * The research engine's server side: one source registry per run. Every tool result that evidence can rest on
 * (a benchmark, a calculation, a skill pack, a web page) is recorded with a key (S01, S02, ...) that goes back to the
 * model with the result. The model may cite only those keys, and the gates (shared/research.ts) check that it did.
 */
import { classifyDepth, type SourceRecord, type Tier } from "../shared/research.js";
import type { ToolName } from "./tools.js";

type NewSource = Omit<SourceRecord, "key">;

const month = () => new Date().toISOString().slice(0, 7);

export class SourceRegistry {
  readonly sources: SourceRecord[] = [];
  readonly tier: Tier;

  constructor(prompt: string) {
    this.tier = classifyDepth(prompt);
    // S01 is always the client's own request and intake: the only evidence about the client's situation.
    this.add({ title: "Client request and intake", publisher: "Client", date: month(), type: "client input", authority: 8 });
  }

  /** Records a source and returns it; a source already recorded (same title, publisher and URL) keeps its key. */
  add(src: NewSource): { record: SourceRecord; isNew: boolean } {
    const same = this.sources.find((s) => s.title === src.title && s.publisher === src.publisher && s.url === src.url);
    if (same) return { record: same, isNew: false };
    const record: SourceRecord = { key: `S${String(this.sources.length + 1).padStart(2, "0")}`, ...src };
    this.sources.push(record);
    return { record, isNew: true };
  }
}

/** What a VOLT tool result can be cited as, or null when it is not evidence (agent and skill lookups, templates). */
export function sourceForTool(name: ToolName, input: unknown): NewSource | null {
  const i = (input ?? {}) as Record<string, unknown>;
  switch (name) {
    case "apqc_benchmark":
      return { title: `APQC benchmark: ${String(i.metric ?? "")}`, publisher: "APQC (VOLT benchmark table)", date: "n/d", type: "benchmark table", authority: 7 };
    case "score_maturity":
      return { title: "VOLT maturity scoring (scores supplied in the request)", publisher: "VOLT analytics", date: month(), type: "calculation", authority: 6 };
    case "appraise_investment":
      return { title: "Investment appraisal (inputs supplied in the request)", publisher: "VOLT analytics", date: month(), type: "calculation", authority: 6 };
    case "build_value_case":
      return { title: "Value case (inputs supplied in the request)", publisher: "VOLT analytics", date: month(), type: "calculation", authority: 6 };
    case "load_skill":
      return { title: `VOLT skill pack: ${String(i.skill_id ?? "")}${i.resource ? ` / ${String(i.resource)}` : ""}`, publisher: "VOLT plugin", date: "n/d", type: "methodology", authority: 6 };
    default:
      return null;
  }
}

/** A source's authority from its domain: a placeholder heuristic until each domain has its own authority ladder. */
function webAuthority(host: string): number {
  if (/\.(gov|edu)(\.[a-z]{2})?$|\.europa\.eu$|^www\.(bis|imf|oecd)\.org$/.test(host)) return 8;
  if (/\.org$/.test(host)) return 6;
  return 4;
}

/** Sources from the results of Claude's web_search tool (opt-in, VOLT_WEB_RESEARCH=on). Defensive: the block shape is read, never assumed. */
export function sourcesFromWebSearch(content: unknown): NewSource[] {
  if (!Array.isArray(content)) return [];
  const out: NewSource[] = [];
  for (const r of content as Record<string, unknown>[]) {
    if (r?.type !== "web_search_result" || typeof r.url !== "string" || typeof r.title !== "string") continue;
    let host = "";
    try {
      host = new URL(r.url).hostname;
    } catch {
      continue;
    }
    const age = typeof r.page_age === "string" ? new Date(r.page_age) : null;
    out.push({ title: r.title, url: r.url, publisher: host, date: age && !Number.isNaN(age.getTime()) ? age.toISOString().slice(0, 7) : "n/d", type: "web page", authority: webAuthority(host) });
  }
  return out;
}
