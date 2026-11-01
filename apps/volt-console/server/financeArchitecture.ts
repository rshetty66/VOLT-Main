/**
 * Finance Architecture demo: runs the design-finance-architecture skill's offline Python
 * validators on synthetic or user-edited documents. The Python scripts in the skill are the single
 * source of truth for the checks; this module only shells out to them and returns their report.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_DIR = process.env.VOLT_PLUGIN_DIR ?? path.resolve(here, "../../../plugins/volt");
const SKILL_DIR = path.join(PLUGIN_DIR, "skills", "design-finance-architecture");
const PYTHON = process.env.VOLT_PYTHON ?? "python3";
export const MAX_DOCUMENT_BYTES = 256 * 1024;

export type ValidatorKind = "journal" | "mapping";
export interface ValidatorCheck {
  check_id: string;
  status: "PASS" | "FAIL" | "NOT_RUN";
  scope: string;
}
export interface ValidatorReport {
  status: string;
  checks: ValidatorCheck[];
  blockers: string[];
  limitations: string[];
  run_id?: string;
  input_manifest_hash?: string;
}

const SCRIPTS: Record<ValidatorKind, string> = { journal: "validate_journals.py", mapping: "validate_mapping.py" };
const readAsset = (rel: string) => fs.readFileSync(path.join(SKILL_DIR, rel), "utf8");

/** Synthetic golden-case documents and the lifecycle reference, read from the skill. */
export function demoDocuments() {
  return {
    journal: JSON.parse(readAsset("assets/mortgage-demo.json")),
    mapping: JSON.parse(readAsset("assets/mapping-demo.json")),
    lifecycle: readAsset("references/mortgage-lifecycle.md"),
  };
}

/** Runs one validator on a document; exit 1 (checks failed) still yields a report. */
export async function runValidator(kind: ValidatorKind, document: unknown): Promise<ValidatorReport> {
  const payload = JSON.stringify(document);
  if (Buffer.byteLength(payload) > MAX_DOCUMENT_BYTES) throw new Error(`document exceeds ${MAX_DOCUMENT_BYTES} bytes`);
  const file = path.join(os.tmpdir(), `volt-fa-${crypto.randomUUID()}.json`);
  fs.writeFileSync(file, payload, "utf8");
  try {
    const stdout = await new Promise<string>((resolve, reject) => {
      execFile(PYTHON, ["-I", path.join(SKILL_DIR, "scripts", SCRIPTS[kind]), file], { timeout: 20_000, maxBuffer: 4 * 1024 * 1024 }, (err, out, errOut) => {
        const code = err && typeof (err as { code?: unknown }).code === "number" ? (err as { code: number }).code : err ? -1 : 0;
        if (code === 0 || code === 1) resolve(out);
        else reject(new Error(`validator failed (${err?.message ?? code}): ${errOut || out}`.slice(0, 500)));
      });
    });
    return JSON.parse(stdout) as ValidatorReport;
  } finally {
    fs.rmSync(file, { force: true });
  }
}

/**
 * Multi-basis allowance arithmetic from the skill's golden case, in integer cents so the UI shows
 * exact figures: a full US book posts the whole CECL allowance; a delta overlay on the IFRS base
 * posts only the difference. Posting the full CECL amount on the overlay double counts IFRS.
 */
export function multiBasisAllowance(input: { preAllowance: string; ifrsAllowance: string; ceclAllowance: string }) {
  const cents = (s: string) => {
    if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error(`invalid amount ${s}`);
    const [whole, frac = ""] = s.split(".");
    return BigInt(whole) * 100n + BigInt(frac.padEnd(2, "0"));
  };
  const fmt = (c: bigint) => {
    const neg = c < 0n;
    const a = neg ? -c : c;
    const whole = (a / 100n).toString();
    const frac = a % 100n;
    return `${neg ? "-" : ""}${whole}${frac ? `.${frac.toString().padStart(2, "0")}` : ""}`;
  };
  const pre = cents(input.preAllowance);
  const ifrs = cents(input.ifrsAllowance);
  const cecl = cents(input.ceclAllowance);
  return {
    ifrsNet: fmt(pre - ifrs),
    usNet: fmt(pre - cecl),
    fullBookPosting: fmt(cecl),
    deltaPosting: fmt(cecl - ifrs),
    doubleCountedNet: fmt(pre - ifrs - cecl),
  };
}
