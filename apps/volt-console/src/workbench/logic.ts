/**
 * Pure, model-free logic for the Finance Architecture Workbench: run status, CSV intake for the
 * mapping prover, journal editing presets, chat intent routing and the evidence pack text.
 * The accounting checks themselves stay in the skill's Python validators (server/financeArchitecture.ts).
 */

import { toCurrencyUnits, type Figure } from "../../shared/mortgageFigures";

export interface Check {
  check_id: string;
  status: "PASS" | "FAIL" | "NOT_RUN";
  scope: string;
}
export interface Report {
  status: string;
  checks: Check[];
  blockers: string[];
  limitations: string[];
  run_id?: string;
  input_manifest_hash?: string;
}
export interface JournalLine {
  line_id: string;
  journal_id: string;
  account: string;
  debit: string;
  credit: string;
  basis: string;
  ledger: string;
  [field: string]: unknown;
}
export interface JournalDoc {
  tenant_id: string;
  rules: Record<string, unknown>[];
  lines: JournalLine[];
  [field: string]: unknown;
}
export interface BalanceRow {
  entity: string;
  basis: string;
  currency: string;
  period: string;
  account: string;
  balance: string;
}
export type MappingRow = { source: string; targets: { account: string; weight: string }[] } | { source: string; retire: true };
export interface MappingDoc {
  tenant_id: string;
  target_accounts: string[];
  legacy: BalanceRow[];
  mapping: MappingRow[];
  target: BalanceRow[];
}

export type RunStatus = "NOT_RUN" | "PARTIAL" | "BLOCKED" | "VALIDATED_SCOPED";

/**
 * Workbench chip over the proofs a run needs (one argument per proof, undefined when not run yet):
 * VALIDATED_SCOPED only when every one ran and passed; BLOCKED when any failed.
 */
export function runStatus(...proofs: (Report | undefined)[]): RunStatus {
  const ran = proofs.filter((r): r is Report => !!r);
  if (!ran.length) return "NOT_RUN";
  if (ran.some((r) => r.status !== "VALIDATED_SCOPED")) return "BLOCKED";
  return ran.length === proofs.length ? "VALIDATED_SCOPED" : "PARTIAL";
}

/** Minimal RFC 4180 reader: quoted fields, doubled quotes, CRLF, blank lines skipped. Headers are lower-cased. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (!nonEmpty.length) return [];
  const header = nonEmpty[0].map((h) => h.trim().toLowerCase());
  return nonEmpty.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

export interface MappingCsv {
  legacy: string;
  mapping: string;
  target: string;
}

export const SAMPLE_CSV: MappingCsv = {
  legacy: [
    "entity,basis,currency,period,account,balance",
    "BANK-CA,IFRS,CAD,2026-10,100,498000.00",
    "BANK-CA,IFRS,CAD,2026-10,101,-498000.00",
    "BANK-CA,IFRS,CAD,2026-10,102,-2000.00",
    "BANK-CA,IFRS,CAD,2026-10,103,2000.00",
  ].join("\n"),
  mapping: ["source,target_account,weight", "100,LOANS,1", "101,CASH,1", "102,ALLOWANCE,1", "103,EXPENSE,1"].join("\n"),
  target: [
    "entity,basis,currency,period,account,balance",
    "BANK-CA,IFRS,CAD,2026-10,LOANS,498000.00",
    "BANK-CA,IFRS,CAD,2026-10,CASH,-498000.00",
    "BANK-CA,IFRS,CAD,2026-10,ALLOWANCE,-2000.00",
    "BANK-CA,IFRS,CAD,2026-10,EXPENSE,2000.00",
  ].join("\n"),
};

const BALANCE_COLUMNS = ["entity", "basis", "currency", "period", "account", "balance"] as const;

/**
 * Builds a validate_mapping.py document from three CSVs. The target chart of accounts is the set of
 * accounts in the independently supplied target balances, so a mapping to any other account fails
 * M_TARGET_ACCOUNTS_EXIST. A weight of RETIRE marks a source whose balances must all be zero.
 */
export function mappingFromCsv(tenantId: string, csv: MappingCsv): { document: MappingDoc; errors: string[] } {
  const errors: string[] = [];
  const balances = (name: "legacy" | "target"): BalanceRow[] => {
    const rows = parseCsv(csv[name]);
    const missing = BALANCE_COLUMNS.filter((c) => rows.length && !(c in rows[0]));
    if (!rows.length) errors.push(`${name}: no rows`);
    else if (missing.length) errors.push(`${name}: missing columns ${missing.join(", ")}`);
    return rows.map((r) => Object.fromEntries(BALANCE_COLUMNS.map((c) => [c, r[c] ?? ""])) as unknown as BalanceRow);
  };
  const legacy = balances("legacy");
  const target = balances("target");

  const mapRows = parseCsv(csv.mapping);
  const mapMissing = ["source", "target_account", "weight"].filter((c) => mapRows.length && !(c in mapRows[0]));
  if (!mapRows.length) errors.push("mapping: no rows");
  else if (mapMissing.length) errors.push(`mapping: missing columns ${mapMissing.join(", ")}`);
  const bySource = new Map<string, MappingRow>();
  const order: string[] = [];
  for (const r of mapRows) {
    const source = r.source ?? "";
    if (!bySource.has(source)) order.push(source);
    if ((r.weight ?? "").toUpperCase() === "RETIRE") {
      bySource.set(source, { source, retire: true });
      continue;
    }
    const existing = bySource.get(source);
    const target = { account: r.target_account ?? "", weight: r.weight ?? "" };
    if (existing && "targets" in existing) existing.targets.push(target);
    else bySource.set(source, { source, targets: [target] });
  }
  const targetAccounts = [...new Set(target.map((r) => r.account))];
  return {
    document: { tenant_id: tenantId, target_accounts: targetAccounts, legacy, mapping: order.map((s) => bySource.get(s)!), target },
    errors,
  };
}

let lineSeq = 0;
export function addLine(doc: JournalDoc, journalId: string): JournalDoc {
  const template = doc.lines.find((l) => l.journal_id === journalId) ?? doc.lines[0];
  const ids = new Set(doc.lines.map((l) => l.line_id));
  let id: string;
  do id = `N${++lineSeq}`; while (ids.has(id));
  return { ...doc, lines: [...doc.lines, { ...template, line_id: id, journal_id: journalId, account: "", debit: "0.00", credit: "0.00" }] };
}

export function removeLine(doc: JournalDoc, lineId: string): JournalDoc {
  return { ...doc, lines: doc.lines.filter((l) => l.line_id !== lineId) };
}

/**
 * Adds the skill's US CECL delta overlay: on top of the IFRS allowance of 2,000 a US delta book records
 * only the additional 8,000 (CECL 10,000 minus IFRS 2,000) in its own ledger, under an approved USGAAP rule.
 * Idempotent: applying it twice leaves one overlay.
 */
export function withUsDeltaOverlay(doc: JournalDoc): JournalDoc {
  if (doc.lines.some((l) => l.journal_id === "J-USDELTA-001")) return doc;
  const base = doc.lines[0];
  const rule = { tenant_id: doc.tenant_id, rule_id: "MORTGAGE-CECL-DELTA", version: "1", status: "APPROVED", basis: "USGAAP", valid_from: "2026-01-01", valid_to: "2026-12-31", ledger: "CA-USGAAP", disposition: "JOURNAL" };
  const line = (line_id: string, account: string, debit: string, credit: string): JournalLine => ({
    ...base, line_id, journal_id: "J-USDELTA-001", basis: "USGAAP", ledger: "CA-USGAAP", account, debit, credit,
    rule_id: "MORTGAGE-CECL-DELTA", rule_version: "1", measurement_ref: "SYNTHETIC-CECL-DELTA-001",
  });
  return {
    ...doc,
    rules: [...doc.rules, rule],
    lines: [...doc.lines, line("U1", "IMPAIRMENT_EXPENSE", "8000.00", "0.00"), line("U2", "LOAN_ALLOWANCE", "0.00", "8000.00")],
  };
}

export type Intent = "validate_journal" | "validate_mapping" | "evidence_pack" | "model";

/** Deterministic requests run locally at zero model tokens; everything else goes to Claude. */
export function intentOf(text: string): Intent {
  const t = text.toLowerCase();
  if (/\b(validate|check|prove|run)\b.*\bjournal/.test(t)) return "validate_journal";
  if (/\b(validate|check|prove|run)\b.*\bmapping/.test(t)) return "validate_mapping";
  if (/\bevidence\b/.test(t) && /\b(pack|build|show|summar)/.test(t)) return "evidence_pack";
  return "model";
}

export interface EvidenceSource {
  title: string;
  url?: string;
  retrievedAt: string;
  sha256: string;
  evidenceClass: string;
}
export interface EvidenceFigure {
  id: string;
  label: string;
  value: string;
  scale: string;
  currency: string;
  page: number;
  quote: string;
  confirmed: boolean;
}
export interface EvidenceInput {
  journal?: Report;
  mapping?: Report;
  extraction?: Report;
  preparedBy: string;
  reviewedBy: string;
  generatedAt: string;
  dataMode?: "real" | "illustrative";
  sources?: EvidenceSource[];
  figures?: EvidenceFigure[];
}

/** Copyable markdown evidence pack. Sign-off names are recorded as entered; the agent never approves. */
export function evidenceMarkdown(e: EvidenceInput): string {
  const section = (title: string, r?: Report) => {
    if (!r) return [`## ${title}`, "", "Not run.", ""];
    const ran = r.checks.filter((c) => c.status !== "NOT_RUN");
    const notRun = r.checks.filter((c) => c.status === "NOT_RUN");
    return [
      `## ${title}`, "",
      `- Status: ${r.status}`,
      `- Run ID: ${r.run_id ?? "n/a"}`,
      `- Input hash (sha256): ${r.input_manifest_hash ?? "n/a"}`, "",
      "| Check | Result |", "|---|---|",
      ...ran.map((c) => `| ${c.check_id} | ${c.status} |`), "",
      ...(r.blockers.length ? ["Failures:", ...r.blockers.map((b) => `- ${b}`), ""] : []),
      "Not run (outside this utility's scope):", ...notRun.map((c) => `- ${c.check_id}: ${c.scope}`), "",
    ];
  };
  const illustrative = e.dataMode === "illustrative";
  const status = illustrative || !e.dataMode ? runStatus(e.journal, e.mapping) : runStatus(e.extraction, e.journal, e.mapping);
  const cell = (s: string) => s.replace(/\|/g, "/");
  const register = e.sources?.length
    ? ["## Sources", "", "| Document | Evidence class | Location | Retrieved | sha256 |", "|---|---|---|---|---|",
       ...e.sources.map((s) => `| ${cell(s.title)} | ${s.evidenceClass} | ${s.url ?? "uploaded"} | ${s.retrievedAt} | ${s.sha256.slice(0, 16)}... |`), ""]
    : [];
  const figures = e.figures?.length
    ? ["## Figures", "", "| Figure | Value | Unit | Page | Quote | Confirmed |", "|---|---|---|---|---|---|",
       ...e.figures.map((f) => `| ${cell(f.label)} | ${f.value} | ${f.scale} ${f.currency} | ${f.page} | "${cell(f.quote)}" | ${f.confirmed ? "yes" : "no"} |`), ""]
    : [];
  return [
    "# Finance architecture evidence pack", "",
    `- Generated: ${e.generatedAt}`,
    `- Run status: ${status}`,
    illustrative
      ? "- Data: ILLUSTRATIVE_EXAMPLE (synthetic; the user stated real data was not available)"
      : e.dataMode === "real" ? "- Data: real documents (client documents and public filings, cited below)" : "- Data: as supplied",
    "- Methodology: design-finance-architecture 2.0.0 (offline checks only)", "",
    ...register,
    ...figures,
    ...(e.dataMode === "real" ? section("Extraction verification", e.extraction) : []),
    ...section("Journal validation", e.journal),
    ...section("Mapping validation", e.mapping),
    "## Sign-off", "",
    `- Prepared by: ${e.preparedBy.trim() || "not recorded"}`,
    `- Reviewed by: ${e.reviewedBy.trim() || "not yet reviewed"}`, "",
    "This pack records deterministic checks only. It is not an approval: policy review, golden-case comparison, platform testing and release approval are separate gates.",
    "",
  ].join("\n");
}

export interface UsageEvent {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  webSearches?: number;
  webFetches?: number;
}
export function sumUsage(events: UsageEvent[]) {
  return events.reduce(
    (t, e) => ({
      input: t.input + e.inputTokens, output: t.output + e.outputTokens, cacheRead: t.cacheRead + e.cacheReadTokens,
      webSearches: t.webSearches + (e.webSearches ?? 0), webFetches: t.webFetches + (e.webFetches ?? 0), calls: t.calls + 1,
    }),
    { input: 0, output: 0, cacheRead: 0, webSearches: 0, webFetches: 0, calls: 0 },
  );
}

// ── Real data: journals derived from confirmed statement figures ─────────────


const MOVEMENTS = [
  { figure: "provision", name: "Provision for credit losses", code: "PCL", debit: "PROVISION_FOR_CREDIT_LOSSES", credit: "LOAN_ALLOWANCE" },
  { figure: "write_offs", name: "Write-offs", code: "WRITEOFF", debit: "LOAN_ALLOWANCE", credit: "MORTGAGE_PRINCIPAL" },
  { figure: "recoveries", name: "Recoveries", code: "RECOVERY", debit: "CASH", credit: "LOAN_ALLOWANCE" },
];

/**
 * Portfolio-level journals implied by the period's allowance movements, one journal per movement,
 * built only from confirmed figures. The account roles are an illustrative design; the rule is
 * APPROVED only when a person is named as approver, otherwise DRAFT (and the validator blocks it).
 */
export function journalsFromFigures(
  figures: Figure[],
  confirmed: Set<string>,
  ctx: { sourceSha: string; entity: string; basis: string; approvedBy: string },
): { doc: JournalDoc | null; blocked: { journal: string; missing: string[] }[] } {
  const byId = new Map(figures.map((f) => [f.id, f]));
  const blocked: { journal: string; missing: string[] }[] = [];
  const lines: JournalLine[] = [];
  let period = "";
  let currency = "";
  for (const m of MOVEMENTS) {
    const f = byId.get(m.figure);
    if (!f) { blocked.push({ journal: m.name, missing: [`${m.figure} (not in the source)`] }); continue; }
    if (!confirmed.has(f.id)) { blocked.push({ journal: m.name, missing: [`${m.figure} (unconfirmed)`] }); continue; }
    period = f.period;
    currency = f.currency;
    const amount = toCurrencyUnits(f.value.replace(/^-/, ""), f.scale);
    const release = f.value.startsWith("-");
    const journalId = `J-${m.code}-${f.period}`;
    const base = {
      tenant_id: "WORKBENCH", journal_id: journalId, entity: ctx.entity, basis: ctx.basis, ledger: `${ctx.basis}-PRIMARY`,
      period: f.period.slice(0, 7), currency: f.currency, rule_id: "PORTFOLIO-ALLOWANCE", rule_version: "1",
      accounting_date: f.period, source_system: "STATEMENT", event_id: `PORTFOLIO-${m.code}-${f.period}`, event_version: "1",
      measurement_ref: `${ctx.sourceSha.slice(0, 12)}:${f.id}:p${f.page}`,
    };
    const [dr, cr] = release ? [m.credit, m.debit] : [m.debit, m.credit];
    lines.push(
      { ...base, line_id: `${m.code}-1`, account: m.debit, debit: dr === m.debit ? amount : "0.00", credit: dr === m.debit ? "0.00" : amount },
      { ...base, line_id: `${m.code}-2`, account: m.credit, debit: cr === m.debit ? amount : "0.00", credit: cr === m.debit ? "0.00" : amount },
    );
  }
  if (!lines.length) return { doc: null, blocked };
  return {
    doc: {
      tenant_id: "WORKBENCH",
      open_periods: [period.slice(0, 7)],
      currency_precision: { [currency]: 2 },
      rules: [{ tenant_id: "WORKBENCH", rule_id: "PORTFOLIO-ALLOWANCE", version: "1", status: ctx.approvedBy.trim() ? "APPROVED" : "DRAFT", basis: ctx.basis, valid_from: period, valid_to: period, ledger: `${ctx.basis}-PRIMARY`, disposition: "JOURNAL" }],
      lines,
    },
    blocked,
  };
}
