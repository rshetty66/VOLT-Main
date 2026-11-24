/**
 * VOLT Ledger tools: the console side of the accounting brain (apps/volt-ledger).
 *
 * The model calls these; each call is validated here and forwarded to the private volt-ledger service, which does
 * every calculation and writes an evidence record. The console never computes ledger numbers. Amounts cross the wire
 * as integer strings of minor units, because a JSON number in JavaScript is a float.
 *
 * Enabled only when VOLT_LEDGER_URL (or VOLT_LEDGER_HOSTPORT, set by the Render blueprint) and VOLT_LEDGER_TOKEN
 * are set. Review decisions are people-only and are never offered to the model.
 */
import fs from "node:fs";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import type { SourceRecord } from "../shared/research.js";
import type { SourceRegistry } from "./research.js";
import { listUploads, originalPath } from "./uploads.js";

const AMOUNT = z.string().regex(/^[0-9]+$/, "amount_minor must be an integer string of minor units (cents), e.g. '125000099'");
const PERIOD = z.string().regex(/^[0-9]{4}-(0[1-9]|1[0-2])$/, "period is YYYY-MM");
const FISCAL = z.string().regex(/^FY[0-9]{4}(-(Q[1-4]|H[12]))?$/, "fiscal period is FY2026-Q3, FY2026-H1 or FY2026");

export const ledgerSchemas = {
  ledger_get_ontology_context: z.object({
    query: z.string().optional().describe("Words to match against canonical concepts, e.g. 'fee and commission income'."),
    element_id: z.string().optional().describe("An account (acct:<client>:<code>) or concept (canon:<Name>) id."),
  }),
  ledger_map_line_item: z.object({
    account_id: z.string().describe("acct:<client>:<code>"),
    concept_id: z.string().describe("canon:<Name> from ledger_get_ontology_context"),
    confidence: z.number().min(0).max(1).describe("Your honest probability that a reviewer accepts this mapping."),
    rationale: z.string().max(600),
    uncertainty: z.array(z.string()).optional().describe("What could make this mapping wrong."),
    source_refs: z.array(z.string()).optional().describe("Source keys you relied on, e.g. S03."),
  }),
  ledger_flag_policy_gap: z.object({
    element_ids: z.array(z.string()).min(1),
    gap_type: z.enum(["recognition_basis_mixed", "stage_not_captured", "catch_all_account", "dimension_in_account",
      "lease_model_difference", "capitalisation_policy", "gross_vs_net", "unmappable_sign", "other"]),
    decision_needed: z.string(),
    standard_refs: z.array(z.string()).optional().describe("e.g. 'IFRS 9 B5.4.1'. Stored as [UNVERIFIED]."),
    rationale: z.string(),
    confidence: z.number().min(0).max(1),
  }),
  ledger_propose_journal: z.object({
    idempotency_key: z.string().min(1).max(200),
    period: PERIOD,
    kind: z.enum(["adjustment", "reclass", "gaap_adjustment"]),
    gaap: z.enum(["base", "ifrs", "us-gaap"]).optional(),
    description: z.string(),
    lines: z.array(z.object({
      account_id: z.string(),
      side: z.enum(["debit", "credit"]),
      amount_minor: AMOUNT,
      amount_source: z.string().describe("Source key of the earlier ledger result this amount was copied from."),
      dimensions: z.record(z.string(), z.string()).optional(),
    })).min(2),
    source_refs: z.array(z.string()).optional(),
  }),
  ledger_reverse_journal: z.object({
    journal_id: z.string(),
    period: PERIOD,
    reason: z.string(),
    idempotency_key: z.string().min(1).max(200),
  }),
  ledger_coverage: z.object({
    doc_id: z.string().describe("Trial balance document id, e.g. D0001."),
  }),
  ledger_ingest_upload: z.object({
    upload_id: z.string().regex(/^[a-z0-9-]{6,64}$/i).describe("The upload id shown next to an attached CSV or XLSX trial balance."),
    client: z.string().regex(/^[A-Z0-9]{2,16}$/).describe("Short client code in capitals, e.g. SYNBANK. Becomes part of every account id."),
    period: PERIOD,
    currency: z.string().regex(/^[A-Z]{3}$/).default("USD"),
    dimension_columns: z.record(z.string(), z.string()).optional()
      .describe("Dimension name to column header, e.g. {\"BusinessLine\": \"business_line\"}. Detected from the header row when left out."),
  }),
  ledger_list_accounts: z.object({
    doc_id: z.string().describe("Trial balance document id from ledger_ingest_upload, e.g. D0001."),
  }),
  ledger_get_balances: z.object({
    period: PERIOD,
    element_ids: z.array(z.string()).min(1).max(60).describe("Accounts (acct:...) or concepts (canon:...)."),
    dimensions: z.record(z.string(), z.string()).optional().describe("e.g. {\"BusinessLine\": \"Retail\"}"),
    include_proposals: z.boolean().optional().describe("Add proposed journals (adjustments, allocations). Default false."),
  }),
  ledger_build_statement: z.object({
    period: PERIOD,
    gaap: z.enum(["ifrs", "us-gaap"]).default("ifrs"),
    statement: z.enum(["BS", "IS"]).describe("BS balance sheet, IS income statement."),
    dimensions: z.record(z.string(), z.string()).optional(),
    include_proposals: z.boolean().optional(),
  }),
  ledger_list_metrics: z.object({}),
  ledger_compute_ratio: z.object({
    metric_id: z.string().describe("From ledger_list_metrics, e.g. nii, efficiency_ratio, loan_to_deposit."),
    period: PERIOD,
    dimensions: z.record(z.string(), z.string()).optional().describe("Needed for bl_* metrics, e.g. {\"BusinessLine\": \"Retail\"}."),
    include_proposals: z.boolean().optional().describe("True to include allocations and other proposed journals."),
  }),
  ledger_propose_allocation_rule: z.object({
    pool_accounts: z.array(z.string()).min(1).describe("Accounts holding the cost pool, e.g. the IT cost accounts."),
    pool_filter: z.record(z.string(), z.string()).describe("e.g. {\"CostCentre\": \"IT01\"}"),
    basis: z.enum(["fte", "transaction_count", "rwa"]).describe("The driver. Values are entered by people, never by you."),
    target_dimension: z.string().describe("e.g. BusinessLine"),
    targets: z.array(z.string()).min(1).describe("Members that receive cost, e.g. Retail, Commercial, Wealth."),
    rationale: z.string().max(800),
  }),
  ledger_run_allocation: z.object({
    rule_id: z.string(),
    period: PERIOD,
    idempotency_key: z.string().min(1).max(200),
  }),
  ledger_resolve_peer_period: z.object({
    peer_ids: z.array(z.string()).min(1).describe("Peer ids or groups: big6, canadian_midsize, canadian_banks, cooperatives_and_credit_unions, insurers, maple_pensions, asset_managers."),
    period: FISCAL.optional().describe("FY2026-Q3, FY2026-H1 or FY2026. Leave out for each peer's latest released period."),
  }),
  ledger_fetch_peer_documents: z.object({
    items: z.array(z.object({
      peer_id: z.string(),
      period: FISCAL,
      doc_types: z.array(z.enum(["supplementary_financial_info", "press_release", "report_to_shareholders", "quarterly_report",
        "interim_financial_statements", "mdna", "annual_report"])).default([]),
      url: z.string().url().optional().describe("Only a PDF found on the peer's own investor-relations site."),
    })).min(1).max(40),
  }),
  ledger_peer_metrics: z.object({
    doc_ids: z.array(z.string()).min(1).max(40),
    metric_ids: z.array(z.enum(["nii", "non_interest_income", "total_operating_income", "non_interest_expense", "efficiency_ratio"])).optional(),
  }),
} as const;

export type LedgerToolName = keyof typeof ledgerSchemas;

const descriptions: Record<LedgerToolName, string> = {
  ledger_resolve_peer_period:
    "Which fiscal period is the latest released one for each peer (from the peers' fiscal calendars), or whether a named period is out yet. Call first in any peer comparison.",
  ledger_fetch_peer_documents:
    "Download peers' official results PDFs in parallel from their registered investor-relations sites and store them by hash. Returns a doc_id per stored PDF and a reason per failure.",
  ledger_peer_metrics:
    "Read reported results (net interest income, non-interest income, total revenue, non-interest expenses, efficiency ratio) from stored peer packs. Figures are accepted only where the table ties to its printed total. Quote display values exactly.",
  ledger_get_ontology_context:
    "Look up VOLT's canonical, XBRL-labelled accounting concepts by words, or one account or concept by id (an account comes with its trial-balance rows, sign and current mapping). Use before every mapping.",
  ledger_map_line_item:
    "Propose the canonical concept for one trial-balance account. Low-confidence and first-run mappings go to the engagement lead's review queue. If no concept fits or a policy decision is needed, use ledger_flag_policy_gap instead.",
  ledger_flag_policy_gap:
    "Flag accounts that cannot be mapped or presented without a policy decision (mixed recognition bases, missing credit stage, catch-all balances, dimensions in account codes, lease or capitalisation differences, netting, wrong-sign balances). Always reviewed by a person.",
  ledger_propose_journal:
    "Propose a journal in the proposal ledger (never the client's GL). Never calculate an amount: copy each amount from an earlier ledger result and name that result's source key in amount_source. Unbalanced journals are refused.",
  ledger_reverse_journal: "Propose the reversal of an earlier proposed journal. A journal can be reversed once.",
  ledger_coverage: "Check that every account in an ingested trial balance is mapped or has a policy gap.",
  ledger_ingest_upload:
    "Load an attached CSV or XLSX trial balance into VOLT Ledger. Returns its doc_id, row counts and whether debits equal credits. Do this first when the client attaches a trial balance.",
  ledger_list_accounts: "List every account in an ingested trial balance with its name, side, current mapping and open gaps.",
  ledger_get_balances: "Balances of accounts or concepts for a period, optionally by dimension. Its amounts may be copied into ledger_propose_journal.",
  ledger_build_statement:
    "Build an IFRS or US GAAP balance sheet or income statement from the mapped trial balance, with excluded (unmapped) and flagged (policy gap) accounts and the balance check. Quote its display values exactly.",
  ledger_list_metrics: "List the ratio and KPI definitions VOLT Ledger can compute (NII, efficiency ratio, loan-to-deposit, business-line metrics and more).",
  ledger_compute_ratio: "Compute one metric from the ledger. Never compute a ratio yourself: call this and quote its display value.",
  ledger_propose_allocation_rule:
    "Propose a driver-based allocation rule (which cost pool, which driver, which targets). The engagement lead must approve it in the Ledger review screen before it can run.",
  ledger_run_allocation:
    "Run an approved allocation rule for a period. It splits the pool exactly by the stored driver values and proposes one allocation journal. Refused if the rule is not approved or a driver value is missing.",
};

const routes: Record<LedgerToolName, string> = {
  ledger_get_ontology_context: "/v1/tools/get_ontology_context",
  ledger_map_line_item: "/v1/tools/map_line_item",
  ledger_flag_policy_gap: "/v1/tools/flag_policy_gap",
  ledger_propose_journal: "/v1/tools/propose_journal",
  ledger_reverse_journal: "/v1/tools/reverse_journal",
  ledger_coverage: "/v1/tools/coverage",
  ledger_ingest_upload: "/v1/ingest/trial_balance",
  ledger_list_accounts: "/v1/tools/list_accounts",
  ledger_get_balances: "/v1/tools/get_balances",
  ledger_build_statement: "/v1/tools/build_statement",
  ledger_list_metrics: "/v1/tools/list_metrics",
  ledger_compute_ratio: "/v1/tools/compute_ratio",
  ledger_propose_allocation_rule: "/v1/tools/propose_allocation_rule",
  ledger_run_allocation: "/v1/tools/run_allocation",
  ledger_resolve_peer_period: "/v1/tools/resolve_peer_period",
  ledger_fetch_peer_documents: "/v1/tools/fetch_peer_documents",
  ledger_peer_metrics: "/v1/tools/peer_metrics",
};

/** Tools whose results are evidence the model may cite (lookups are not). */
const CITABLE: ReadonlySet<LedgerToolName> = new Set([
  "ledger_map_line_item", "ledger_flag_policy_gap", "ledger_propose_journal", "ledger_reverse_journal", "ledger_coverage",
  "ledger_ingest_upload", "ledger_get_balances", "ledger_build_statement", "ledger_compute_ratio",
  "ledger_propose_allocation_rule", "ledger_run_allocation", "ledger_resolve_peer_period", "ledger_fetch_peer_documents",
  "ledger_peer_metrics",
]);

/** Dimension columns recognised in a trial balance header when the model does not name them. */
const KNOWN_DIMENSIONS: Record<string, string> = { business_line: "BusinessLine", cost_centre: "CostCentre", cost_center: "CostCentre", credit_stage: "CreditStage", product: "Product" };

export function ledgerBaseUrl(): string | null {
  const url = process.env.VOLT_LEDGER_URL?.trim();
  if (url) return url.replace(/\/+$/, "");
  const hostport = process.env.VOLT_LEDGER_HOSTPORT?.trim();
  return hostport ? `http://${hostport}` : null;
}

export function ledgerEnabled(): boolean {
  return Boolean(ledgerBaseUrl() && process.env.VOLT_LEDGER_TOKEN?.trim());
}

export function isLedgerTool(name: string): name is LedgerToolName {
  return Object.prototype.hasOwnProperty.call(ledgerSchemas, name);
}

export function ledgerToolDefs(): Anthropic.Beta.BetaTool[] {
  if (!ledgerEnabled()) return [];
  return (Object.keys(ledgerSchemas) as LedgerToolName[]).map((name) => {
    const { $schema: _ignored, ...schema } = z.toJSONSchema(ledgerSchemas[name]) as Record<string, unknown>;
    return { name, description: descriptions[name], input_schema: schema as Anthropic.Beta.BetaTool.InputSchema };
  });
}

export interface LedgerEnvelope {
  status: "ok" | "refused" | "not_found" | "not_computable" | "undefined" | "error";
  evidence_id: string | null;
  data: unknown;
  display: Record<string, string>;
  warnings: string[];
}

/** Raw data of each ledger result by source key, so journal amounts can be checked against what tools returned. */
const resultData = new WeakMap<SourceRegistry, Map<string, string>>();
/** The ledger evidence id behind each source key, for the output gate. */
const resultEvidence = new WeakMap<SourceRegistry, Map<string, string>>();

/** Reads an uploaded trial balance from the uploads library into the ledger's ingest body. */
function ingestBody(input: z.infer<typeof ledgerSchemas.ledger_ingest_upload>): Record<string, unknown> | string {
  const meta = listUploads().find((m) => m.id === input.upload_id);
  const file = originalPath(input.upload_id);
  if (!meta || !file) return `Upload ${input.upload_id} is not in the uploads library.`;
  if (!/^(csv|xlsx)$/i.test(meta.ext)) return `${meta.name} is not a CSV or XLSX file; only those can be loaded as a trial balance.`;
  const bytes = fs.readFileSync(file);
  let dimensions = input.dimension_columns;
  if (!dimensions) {
    dimensions = {};
    if (/^csv$/i.test(meta.ext)) {
      const header = bytes.toString("utf8").replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
      for (const h of header) if (KNOWN_DIMENSIONS[h.toLowerCase()]) dimensions[KNOWN_DIMENSIONS[h.toLowerCase()]] = h;
    }
  }
  const filename = `${meta.name.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9._ -]/g, "_").slice(0, 80) || "trial_balance"}.${meta.ext.toLowerCase()}`;
  return { filename, content_base64: bytes.toString("base64"), client: input.client, period: input.period, currency: input.currency, dimensions };
}

export type LedgerResult =
  | { ok: true; envelope: LedgerEnvelope; content: string; summary: string; newSource?: SourceRecord }
  | { ok: false; error: string };

export async function runLedgerTool(name: LedgerToolName, input: unknown, registry: SourceRegistry, signal?: AbortSignal): Promise<LedgerResult> {
  const base = ledgerBaseUrl();
  const token = process.env.VOLT_LEDGER_TOKEN?.trim();
  if (!base || !token) return { ok: false, error: "The VOLT Ledger service is not configured (VOLT_LEDGER_URL and VOLT_LEDGER_TOKEN)." };
  const parsed = ledgerSchemas[name].safeParse(input);
  if (!parsed.success) return { ok: false, error: `Invalid input for ${name}: ${parsed.error.message}` };
  let body: Record<string, unknown> = { ...(parsed.data as Record<string, unknown>) };

  if (name === "ledger_ingest_upload") {
    const built = ingestBody(parsed.data as z.infer<typeof ledgerSchemas.ledger_ingest_upload>);
    if (typeof built === "string") return { ok: false, error: built };
    body = built;
  }

  if (name === "ledger_propose_journal") {
    // The model may only copy amounts that an earlier ledger result returned (phase4-llm-layer.md 2.2).
    const seen = resultData.get(registry) ?? new Map<string, string>();
    const lines = (body.lines as { amount_minor: string; amount_source: string }[]);
    for (const [i, l] of lines.entries()) {
      const data = seen.get(l.amount_source);
      if (!data || !data.includes(`"${l.amount_minor}"`)) {
        return { ok: false, error: `Line ${i + 1}: amount ${l.amount_minor} does not appear in ledger result ${l.amount_source}. Copy amounts from tool results; never calculate them.` };
      }
    }
    body.lines = lines.map(({ amount_source: _s, ...rest }) => rest);
  }

  let envelope: LedgerEnvelope;
  try {
    const res = await fetch(`${base}${routes[name]}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) return { ok: false, error: `VOLT Ledger answered HTTP ${res.status}.` };
    envelope = (await res.json()) as LedgerEnvelope;
  } catch (err) {
    if (signal?.aborted) throw err;
    return { ok: false, error: `VOLT Ledger is unreachable: ${err instanceof Error ? err.message : String(err)}` };
  }

  let content = JSON.stringify(envelope);
  let newSource: SourceRecord | undefined;
  if (envelope.status === "ok" && CITABLE.has(name)) {
    const { record, isNew } = registry.add({
      title: `VOLT Ledger ${name.replace("ledger_", "").replace(/_/g, " ")} (evidence ${envelope.evidence_id ?? "n/a"})`,
      publisher: "VOLT Ledger",
      date: new Date().toISOString().slice(0, 7),
      type: "calculation",
      authority: 8,
    });
    const map = resultData.get(registry) ?? new Map<string, string>();
    map.set(record.key, JSON.stringify(envelope.data));
    resultData.set(registry, map);
    if (envelope.evidence_id) {
      const ev = resultEvidence.get(registry) ?? new Map<string, string>();
      ev.set(record.key, envelope.evidence_id);
      resultEvidence.set(registry, ev);
    }
    content += `\n\n[Source key: ${record.key}] Cite this result as [${record.key}]. Quote numbers only from "display", exactly as written.`;
    if (isNew) newSource = record;
    else content += " (same result as before)";
  }
  const summary = envelope.status === "ok" ? `${name}: ok${envelope.evidence_id ? ` (${envelope.evidence_id})` : ""}` : `${name}: ${envelope.status}`;
  return { ok: true, envelope, content, summary, newSource };
}

/**
 * Output gate (spec section 6): every figure in a sentence that cites a VOLT Ledger source key must appear in the
 * evidence of the cited results. Returns the unsupported figures, or null when nothing was checked.
 */
export async function checkLedgerFigures(draft: string, registry: SourceRegistry, signal?: AbortSignal): Promise<{ unsupported: string[]; sentences: number } | null> {
  const evidence = resultEvidence.get(registry);
  const base = ledgerBaseUrl();
  const token = process.env.VOLT_LEDGER_TOKEN?.trim();
  if (!evidence?.size || !base || !token) return null;
  const sentences = draft.split(/(?<=[.!?])\s+|\n+/).filter((t) => [...t.matchAll(/\[(S\d{2,})\]/g)].some((m) => evidence.has(m[1])));
  if (!sentences.length) return null;
  const ids = [...new Set(sentences.flatMap((t) => [...t.matchAll(/\[(S\d{2,})\]/g)].map((m) => evidence.get(m[1])).filter((x): x is string => !!x)))];
  try {
    const res = await fetch(`${base}/v1/tools/check_output`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ text: sentences.join("\n"), evidence_ids: ids }),
      signal,
    });
    if (!res.ok) return null;
    const env = (await res.json()) as LedgerEnvelope;
    const data = env.data as { unsupported: string[] };
    return { unsupported: data.unsupported, sentences: sentences.length };
  } catch (err) {
    if (signal?.aborted) throw err;
    return null;
  }
}

/**
 * People-only ledger calls (review decisions, driver values, the review list). Never offered to the model: the console
 * calls these from its own routes for a signed-in person, whose name goes in X-Volt-User.
 */
export async function ledgerPeople(method: "GET" | "POST", path: "review_items" | "review_decision" | "driver_value", user: string, body?: unknown): Promise<{ status: number; json: unknown }> {
  const base = ledgerBaseUrl();
  const token = process.env.VOLT_LEDGER_TOKEN?.trim();
  if (!base || !token) return { status: 503, json: { error: "VOLT Ledger is not configured." } };
  try {
    const res = await fetch(`${base}/v1/people/${path}`, {
      method,
      headers: { "content-type": "application/json", authorization: `Bearer ${token}`, "x-volt-user": user },
      body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
    });
    return { status: res.status, json: await res.json().catch(() => ({})) };
  } catch (err) {
    return { status: 502, json: { error: `VOLT Ledger is unreachable: ${err instanceof Error ? err.message : String(err)}` } };
  }
}

/** What the lead needs to know to use the ledger tools well; added to its system prompt only when they are on. */
export const LEDGER_GUIDE = `## VOLT Ledger (accounting brain)
You have ledger_* tools backed by a deterministic accounting service. It computes every number; you reason, map and explain.
- Trial balance: when the client attaches a CSV or XLSX trial balance (it shows an upload id), call ledger_ingest_upload first, then ledger_list_accounts.
- Mapping: map every account to one canonical concept with ledger_map_line_item (use ledger_get_ontology_context to find concepts). When a policy decision is needed (mixed recognition bases, missing credit stage, catch-all balances, dimensions in account codes, lease or capitalisation differences, netting, wrong-sign balances), use ledger_flag_policy_gap instead of forcing a mapping. Finish with ledger_coverage: every account must be mapped or flagged.
- Statements and ratios: ledger_build_statement for IFRS or US GAAP statements, ledger_compute_ratio for every ratio or KPI. Never compute, round or restate a ledger figure yourself: quote the display value exactly and cite its source key. A check in the console rejects ledger-cited figures that do not appear in the cited result.
- Allocation is driver-based: propose a rule with ledger_propose_allocation_rule (pool, driver, targets). Driver values (FTEs, transaction counts, RWA) are entered by people, and the engagement lead approves the rule in the Ledger review screen. Then run it with ledger_run_allocation, and use include_proposals for business-line figures after allocation. If a rule is unapproved or a driver is missing, say exactly what the person must do.
- Journals are proposals only, never posted to the client's ledger. Copy journal amounts from earlier ledger results and name that source key.
- Peer results (internal benchmarking only): ledger_resolve_peer_period, then ledger_fetch_peer_documents (supplementary_financial_info packs), then ledger_peer_metrics. Never type a peer figure from memory or a web page. Report "not verified" peers as such. Peer figures are for the engagement team: do not reproduce peer tables in client deliverables; describe position in ranges instead.
- Mappings below 90% confidence, first-run mappings, every policy gap and every allocation rule go to the engagement lead's review queue. Say which figures are draft because they await review.`;
