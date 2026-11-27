/**
 * The research engine's mechanical core (URES v1): depth tiers, the source registry's shape, the confidence model, and the
 * evidence gates. Pure functions with no I/O, so the server, the browser and the tests all run the same code.
 *
 * Files and gates decide completion, not the model's judgment: a draft either passes `evidenceGates` or it is sent back.
 */

export type Tier = "QUICK" | "STANDARD" | "DEEP" | "EXHAUSTIVE";

/** One source. `date` is YYYY-MM, or "n/d" when the source is undated (which lowers its recency score). */
export interface SourceRecord {
  key: string;
  title: string;
  url?: string;
  publisher: string;
  date: string;
  type: string;
  /** 1 to 10. */
  authority: number;
}

/** Depth is read from the request's language, never silently defaulted to quick when it signals depth. */
export function classifyDepth(prompt: string): Tier {
  const p = prompt.toLowerCase();
  if (/\b(exhaustive|comprehensive review|critical decision|board[- ]level|due diligence)\b/.test(p)) return "EXHAUSTIVE";
  if (/\b(research|deep dive|landscape|analy[sz]e|analysis|assess|assessment|business case|roadmap|strategy|transformation|benchmark|diagnos\w*)\b/.test(p)) return "DEEP";
  if (/\b(brief|quick|summary of|what is|define|explain)\b/.test(p) && p.length < 160) return "QUICK";
  return "STANDARD";
}

// ── Confidence ───────────────────────────────────────────────────────────────

/** The default weights; they must sum to 1.00 so the arithmetic can be checked by hand. */
export const WEIGHTS = { evidence: 0.4, quality: 0.25, recency: 0.2, agreement: 0.15 } as const;

export type Label = "HIGH" | "MEDIUM" | "LOW";

export interface ConfidenceInputs {
  /** Each input is 0 to 1. */
  evidence: number;
  quality: number;
  recency: number;
  agreement: number;
}

export function labelFor(score: number): Label {
  return score >= 0.8 ? "HIGH" : score >= 0.55 ? "MEDIUM" : "LOW";
}

/** The confidence of a finding. An input outside 0 to 1 is an error: the score is never guessed. */
export function confidence(i: ConfidenceInputs, w: Record<keyof ConfidenceInputs, number> = WEIGHTS): { score: number; label: Label } {
  for (const [k, v] of Object.entries(i)) if (!(v >= 0 && v <= 1)) throw new RangeError(`${k} must be between 0 and 1, got ${v}`);
  const total = w.evidence + w.quality + w.recency + w.agreement;
  if (Math.abs(total - 1) > 1e-9) throw new RangeError(`weights must sum to 1.00, got ${total}`);
  const score = Math.round((i.evidence * w.evidence + i.quality * w.quality + i.recency * w.recency + i.agreement * w.agreement) * 1000) / 1000;
  return { score, label: labelFor(score) };
}

/** Recency from a source date: 1 when fresh, halving every `halfLifeMonths`. An undated source scores 0.3. */
export function recency(date: string, halfLifeMonths: number, asOf: Date): number {
  const m = /^(\d{4})-(\d{2})$/.exec(date);
  if (!m) return 0.3;
  const age = (asOf.getUTCFullYear() - Number(m[1])) * 12 + (asOf.getUTCMonth() + 1 - Number(m[2]));
  return Math.round(Math.pow(0.5, Math.max(0, age) / halfLifeMonths) * 1000) / 1000;
}

// ── Citations and the gates ──────────────────────────────────────────────────

const KEY = /\[(S\d{2,3})\]/g;
const TAG = /\[(INFERENCE|ASSUMPTION|ESTIMATE|VERIFY|SINGLE SOURCE)\]/i;

export const citedKeys = (markdown: string): string[] => [...new Set([...markdown.matchAll(KEY)].map((m) => m[1]))];

export interface Gate {
  id: string;
  name: string;
  pass: boolean;
  /** What is wrong, in words the lead agent can act on; for a passing gate, what was checked. */
  detail: string;
}

const heading = (md: string, re: RegExp): string | null => {
  const start = new RegExp(`^#{2,3}[ \\t]*(?:\\d+[.)][ \\t]*)?(?:${re.source})[^\\n]*\\n`, "im").exec(md);
  if (!start) return null;
  const rest = md.slice(start.index + start[0].length);
  const next = /^#{2,3}[ \t]/m.exec(rest);
  return (next ? rest.slice(0, next.index) : rest).trim();
};

/** The text of the first "##" or "###" section whose title matches `re`, or null. */
export const sectionOf = heading;

const FIGURE = /\d[\d,.]*\s?(%|x\b|days?\b|FTE|M\b|K\b|bps|CAD|USD)|[$€£]\s?\d/i;

/** Sentences with a figure but no source key or tag: the "unsourced assertion" the citation gate exists to catch. */
function uncitedFigures(markdown: string): string[] {
  const prose = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .split("\n")
    .filter((l) => !/^\s*(\||#|Source:|\*\*Exhibit)/i.test(l))
    .join(" ");
  return (prose.match(/[^.!?]+[.!?]/g) ?? []).map((x) => x.trim()).filter((x) => FIGURE.test(x) && !/\[S\d{2,3}\]/.test(x) && !TAG.test(x));
}

const LIMIT: Record<Tier, number> = { QUICK: 99, STANDARD: 6, DEEP: 3, EXHAUSTIVE: 1 };

/**
 * The evidence gates for a draft against its source registry. QUICK answers are not gated.
 * G1 citation, G2 diversity, G3 contradictions, G4 confidence and residue, G5 method and gaps, G6 deliverable.
 */
export function evidenceGates(markdown: string, sources: SourceRecord[], tier: Tier, workingPapers=true): Gate[] {
  if (tier === "QUICK") return [];
  const known = new Map(sources.map((s) => [s.key, s]));
  const cited = citedKeys(markdown);
  const dangling = cited.filter((k) => !known.has(k));
  const bare = uncitedFigures(markdown);
  const types = new Set(cited.filter((k) => known.has(k)).map((k) => known.get(k)!.type));
  const labels = [...markdown.matchAll(/confidence:\s*(HIGH|MEDIUM|LOW)/gi)].length;
  const need = tier === "STANDARD" ? 1 : 3;
  const gate = (id: string, name: string, pass: boolean, ok: string, bad: string): Gate => ({ id, name, pass, detail: pass ? ok : bad });
  return [
    gate(
      "G1",
      "Citation",
      dangling.length === 0 && bare.length <= LIMIT[tier],
      `${cited.length} source keys, all in the register; ${bare.length} uncited figures`,
      dangling.length
        ? `it cites ${dangling.map((k) => `[${k}]`).join(", ")}, which ${dangling.length === 1 ? "is" : "are"} not in the source register (cite only keys the tools returned, or tag the claim [INFERENCE] or [ASSUMPTION])`
        : `${bare.length} sentences state a figure with no source key or [INFERENCE]/[ASSUMPTION]/[ESTIMATE] tag (the limit is ${LIMIT[tier]}); for example: "${bare[0]?.slice(0, 110)}"`,
    ),
    gate("G2", "Diversity", types.size >= (tier === "STANDARD" ? 2 : 2), `${types.size} source types cited`, `the cited sources are of ${types.size} type${types.size === 1 ? "" : "s"}; a single kind of source is a flag, not a fact. Use at least two kinds (client data, a benchmark, a methodology, a calculation)`),
    gate("G3", "Contradictions", !!heading(markdown, /contradictions?|tensions?/), "a contradictions section is present", "it has no 'Contradictions and tensions' section; list each disagreement with the strongest position on both sides, or write 'none identified'"),
    gate("G4", "Confidence and residue", labels >= need && !!heading(markdown, /residue/), `${labels} confidence labels; residue section present`, `it needs at least ${need} findings tagged (Confidence: HIGH|MEDIUM|LOW, as of YYYY-MM) and a 'Residue' section for claims that failed the citation or confidence floor (it has ${labels} labels${heading(markdown, /residue/) ? "" : " and no residue section"})`),
    gate("G5", "Method and gaps", !!heading(markdown, /scope and method|method/) && !!heading(markdown, /gaps?( and limitations)?|limitations/), "method and gaps sections present", "it needs a 'Scope and method' section (stating the depth tier) and a 'Gaps and limitations' section"),
    gate("G6", "Deliverable", markdown.trim().length > 0, "the deliverable is not empty", "the deliverable is empty"),
  ].filter(g=>workingPapers||!["G3","G4","G5"].includes(g.id));
}

// ── The source register ──────────────────────────────────────────────────────

const cell = (s: string) => s.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

/** Ordinary exports resolve only the sources actually cited. Full source metadata stays in the research bundle. */
export function clientReferences(markdown:string,sources:SourceRecord[]):string {
  const keys=new Set(citedKeys(markdown));
  const chosen=sources.filter(s=>keys.has(s.key));
  if(!chosen.length)return "";
  return "\n\n## References\n\n"+chosen.map(s=>`- [${s.key}] ${cell(s.title)} (${cell(s.publisher)}, ${cell(s.date)})${s.url ? `: ${s.url}` : ""}`).join("\n");
}

/** The register as a markdown section, appended to every download so the keys in the text always resolve. */
export function sourceRegisterMarkdown(sources: SourceRecord[]): string {
  if (!sources.length) return "";
  const rows = sources.map((s) => `| ${s.key} | ${cell(s.title)}${s.url ? ` (${s.url})` : ""} | ${cell(s.publisher)} | ${s.date} | ${cell(s.type)} | ${s.authority} |`);
  return ["", "## Source register", "", "| Key | Source | Publisher | Date | Type | Authority |", "|---|---|---|---|---|---|", ...rows, ""].join("\n");
}

export const registryJsonl = (sources: SourceRecord[]): string => sources.map((s) => JSON.stringify(s)).join("\n") + (sources.length ? "\n" : "");
