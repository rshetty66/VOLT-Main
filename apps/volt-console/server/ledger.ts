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
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import type { SourceRecord } from "../shared/research.js";
import type { SourceRegistry } from "./research.js";

const AMOUNT = z.string().regex(/^[0-9]+$/, "amount_minor must be an integer string of minor units (cents), e.g. '125000099'");
const PERIOD = z.string().regex(/^[0-9]{4}-(0[1-9]|1[0-2])$/, "period is YYYY-MM");

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
} as const;

export type LedgerToolName = keyof typeof ledgerSchemas;

const descriptions: Record<LedgerToolName, string> = {
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
};

const routes: Record<LedgerToolName, string> = {
  ledger_get_ontology_context: "/v1/tools/get_ontology_context",
  ledger_map_line_item: "/v1/tools/map_line_item",
  ledger_flag_policy_gap: "/v1/tools/flag_policy_gap",
  ledger_propose_journal: "/v1/tools/propose_journal",
  ledger_reverse_journal: "/v1/tools/reverse_journal",
  ledger_coverage: "/v1/tools/coverage",
};

/** Tools whose results are evidence the model may cite (lookups are not). */
const CITABLE: ReadonlySet<LedgerToolName> = new Set(["ledger_map_line_item", "ledger_flag_policy_gap", "ledger_propose_journal", "ledger_reverse_journal", "ledger_coverage"]);

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

export type LedgerResult =
  | { ok: true; envelope: LedgerEnvelope; content: string; summary: string; newSource?: SourceRecord }
  | { ok: false; error: string };

export async function runLedgerTool(name: LedgerToolName, input: unknown, registry: SourceRegistry, signal?: AbortSignal): Promise<LedgerResult> {
  const base = ledgerBaseUrl();
  const token = process.env.VOLT_LEDGER_TOKEN?.trim();
  if (!base || !token) return { ok: false, error: "The VOLT Ledger service is not configured (VOLT_LEDGER_URL and VOLT_LEDGER_TOKEN)." };
  const parsed = ledgerSchemas[name].safeParse(input);
  if (!parsed.success) return { ok: false, error: `Invalid input for ${name}: ${parsed.error.message}` };
  const body: Record<string, unknown> = { ...(parsed.data as Record<string, unknown>) };

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
    content += `\n\n[Source key: ${record.key}] Cite this result as [${record.key}]. Quote numbers only from "display", exactly as written.`;
    if (isNew) newSource = record;
    else content += " (same result as before)";
  }
  const summary = envelope.status === "ok" ? `${name}: ok${envelope.evidence_id ? ` (${envelope.evidence_id})` : ""}` : `${name}: ${envelope.status}`;
  return { ok: true, envelope, content, summary, newSource };
}
