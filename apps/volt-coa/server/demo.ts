/**
 * Offline demo: no Claude call. It runs the real deterministic checks on what is on screen and reports them, so the
 * app is usable and testable without an API key. It says plainly that it is not a model answer.
 */
import { coaFromCsv, legacyFromCsv, validateCoa, validateMapping, type Check } from "../shared/coa.js";
import type { AssistRequest, CoaEvent } from "../shared/events.js";

const table = (checks: Check[]) => checks.map((c) => `- ${c.ok ? "PASS" : "FAIL"} \`${c.id}\`: ${c.detail}`).join("\n");

export function runDemo(req: AssistRequest, emit: (e: CoaEvent) => void): void {
  emit({ type: "status", text: "Demo mode: no Claude credentials, running the deterministic checks only" });
  const lines = ["**Demo mode.** This is not a model answer. Add `ANTHROPIC_API_KEY` to get Claude proposals; the checks below are the same ones it must pass.\n"];

  const { accounts, errors } = coaFromCsv(req.coaCsv ?? "");
  if (errors.length || accounts.length === 0) lines.push(`No valid chart is loaded yet (${errors[0] ?? "empty"}).`);
  else {
    const callId = "demo_coa";
    emit({ type: "tool_call", callId, name: "check_coa", input: { accounts: accounts.length } });
    const checks = validateCoa(accounts);
    emit({ type: "tool_result", callId, name: "check_coa", summary: `${accounts.length} accounts, ${checks.filter((c) => !c.ok).length} check(s) fail` });
    lines.push(`### Chart (${accounts.length} accounts)\n${table(checks)}`);

    const leg = legacyFromCsv(req.legacyCsv ?? "");
    if (!leg.errors.length && leg.legacy.length) {
      const m = validateMapping(accounts, leg.legacy, leg.mappings);
      lines.push(`### Mapping (${leg.legacy.length} legacy accounts)\n${table(m)}`);
    }
  }
  emit({ type: "text_delta", text: lines.join("\n\n") });
}
