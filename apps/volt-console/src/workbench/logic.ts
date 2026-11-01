/**
 * Pure, model-free logic for the Finance Architecture Workbench: run status, CSV intake for the
 * mapping prover, journal editing presets, chat intent routing and the evidence pack text.
 * The accounting checks themselves stay in the skill's Python validators (server/financeArchitecture.ts).
 */

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

/** Workbench chip: VALIDATED_SCOPED only when both deterministic proofs ran and passed. */
export function runStatus(journal?: Report, mapping?: Report): RunStatus {
  const ran = [journal, mapping].filter((r): r is Report => !!r);
  if (!ran.length) return "NOT_RUN";
  if (ran.some((r) => r.status !== "VALIDATED_SCOPED")) return "BLOCKED";
  return ran.length === 2 ? "VALIDATED_SCOPED" : "PARTIAL";
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

export interface EvidenceInput {
  journal?: Report;
  mapping?: Report;
  preparedBy: string;
  reviewedBy: string;
  generatedAt: string;
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
  return [
    "# Finance architecture evidence pack", "",
    `- Generated: ${e.generatedAt}`,
    `- Run status: ${runStatus(e.journal, e.mapping)}`,
    "- Methodology: design-finance-architecture 2.0.0 (synthetic or controlled data, offline checks only)", "",
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
}
export function sumUsage(events: UsageEvent[]) {
  return events.reduce(
    (t, e) => ({ input: t.input + e.inputTokens, output: t.output + e.outputTokens, cacheRead: t.cacheRead + e.cacheReadTokens, calls: t.calls + 1 }),
    { input: 0, output: 0, cacheRead: 0, calls: 0 },
  );
}
