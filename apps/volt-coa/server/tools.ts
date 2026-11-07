/**
 * The two tools the assistant may call. Both are pure: they run the same checks the UI shows, so a chart or
 * mapping is only presented once it has passed. Inputs are re-validated here because eager input streaming
 * skips server-side validation.
 */
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { coaFromCsv, legacyFromCsv, validateCoa, validateMapping, type Check } from "../shared/coa.js";

export const schemas = {
  check_coa: z.object({
    accounts_csv: z.string().describe("The full chart as CSV with header: code,name,type,parent. Type is asset, liability, equity, revenue or expense; parent is blank for a root."),
  }),
  check_mapping: z.object({
    accounts_csv: z.string().describe("The target chart as CSV with header: code,name,type,parent."),
    legacy_csv: z.string().describe("The legacy chart as CSV with header: code,name,target. Target is a target account code, RETIRE, or blank if not yet mapped."),
  }),
};
export type ToolName = keyof typeof schemas;

const descriptions: Record<ToolName, string> = {
  check_coa: "Run the deterministic structure checks on a chart of accounts. Call this on every chart you intend to present and fix any failure first.",
  check_mapping: "Run the deterministic mapping checks (coverage, existing posting targets, no duplicates) for a legacy chart mapped to a target chart. Call this on every mapping you intend to present.",
};

export function toolDefs(): Anthropic.Beta.BetaTool[] {
  return (Object.keys(schemas) as ToolName[]).map((name) => {
    const { $schema: _ignored, ...rest } = z.toJSONSchema(schemas[name]) as Record<string, unknown>;
    return { name, description: descriptions[name], input_schema: rest as Anthropic.Beta.BetaTool.InputSchema, eager_input_streaming: true };
  });
}

export interface ToolOutcome { ok: boolean; content: string; summary: string; checks?: Check[]; proposal?: { kind: "coa" | "legacy"; csv: string } }

const render = (checks: Check[]) => checks.map((c) => `${c.ok ? "PASS" : "FAIL"} ${c.id}: ${c.detail}`).join("\n");
const failed = (checks: Check[]) => checks.filter((c) => !c.ok).length;

export function runTool(name: string, rawInput: unknown): ToolOutcome {
  if (name !== "check_coa" && name !== "check_mapping") return { ok: false, content: `Unknown tool '${name}'`, summary: `Unknown tool '${name}'` };
  const parsed = schemas[name].safeParse(rawInput);
  if (!parsed.success) {
    const msg = `Invalid input for ${name}: ${parsed.error.message}`;
    return { ok: false, content: msg, summary: msg };
  }

  if (name === "check_coa") {
    const { accounts_csv } = parsed.data as z.infer<typeof schemas.check_coa>;
    const { accounts, errors } = coaFromCsv(accounts_csv);
    if (errors.length) return { ok: false, content: errors.join("\n"), summary: errors[0] };
    const checks = validateCoa(accounts);
    const n = failed(checks);
    return {
      ok: true, checks, content: render(checks),
      summary: n === 0 ? `${accounts.length} accounts, all checks pass` : `${accounts.length} accounts, ${n} check(s) fail`,
      proposal: n === 0 ? { kind: "coa", csv: accounts_csv } : undefined,
    };
  }

  const { accounts_csv, legacy_csv } = parsed.data as z.infer<typeof schemas.check_mapping>;
  const target = coaFromCsv(accounts_csv);
  const leg = legacyFromCsv(legacy_csv);
  const errors = [...target.errors, ...leg.errors];
  if (errors.length) return { ok: false, content: errors.join("\n"), summary: errors[0] };
  const checks = validateMapping(target.accounts, leg.legacy, leg.mappings);
  const n = failed(checks);
  return {
    ok: true, checks, content: render(checks),
    summary: n === 0 ? `${leg.legacy.length} legacy accounts, all checks pass` : `${leg.legacy.length} legacy accounts, ${n} check(s) fail`,
    proposal: n === 0 ? { kind: "legacy", csv: legacy_csv } : undefined,
  };
}
