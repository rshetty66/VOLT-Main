/**
 * Checks the console's settings when it starts, so a typo stops it with a clear
 * message instead of surfacing later as an odd failure. Problems stop the start;
 * warnings are logged. Values come from the environment and apps/volt-console/.env.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DEFAULT_DATA_DIR, DEFAULT_PLUGIN_DIR } from "./paths.js";

export interface ConfigReport {
  problems: string[];
  warnings: string[];
}

const EFFORTS = ["low", "medium", "high", "xhigh", "max"];
const KNOWN = [
  "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_WORKSPACE_ID", "ANTHROPIC_BASE_URL", "ANTHROPIC_PROFILE", "ANTHROPIC_FEDERATION_RULE_ID",
  "VOLT_MODEL", "VOLT_ORCHESTRATOR_EFFORT", "VOLT_SPECIALIST_EFFORT", "VOLT_FALLBACKS", "VOLT_MODE", "VOLT_PLUGIN_DIR", "VOLT_DATA_DIR",
  "VOLT_SPECIALIST_MODEL", "VOLT_SPECIALIST_MAX_STEPS", "VOLT_RUN_BUDGET_USD", "VOLT_MONTHLY_BUDGET_USD", "VOLT_AUTO_RESUME", "VOLT_AUTO_RESUME_HOURS",
  "VOLT_JUDGE_MODEL", "VOLT_LOG_FORMAT", "VOLT_LOG_LEVEL", "VOLT_ALLOWED_ORIGINS", "VOLT_RATE_LIMIT", "VOLT_TRUST_PROXY", "PORT",
];

/** Letters two names have in different places, for "did you mean" (edit distance up to 2). */
function close(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 2) return false;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length] <= 2;
}

/** Whether any Claude credential source is configured (environment or ~/.config/anthropic). */
export function credentialsConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  const keys = ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_PROFILE", "ANTHROPIC_FEDERATION_RULE_ID"];
  return keys.some((k) => env[k]) || fs.existsSync(path.join(os.homedir(), ".config", "anthropic"));
}

export function checkConfig(env: NodeJS.ProcessEnv = process.env): ConfigReport {
  const problems: string[] = [];
  const warnings: string[] = [];
  const set = (k: string) => env[k] !== undefined && env[k] !== "";
  const oneOf = (k: string, allowed: string[]) => {
    if (set(k) && !allowed.includes(env[k]!)) problems.push(`${k}="${env[k]}" must be one of: ${allowed.join(", ")}.`);
  };
  const number = (k: string, min: number, max: number, integer = false) => {
    if (!set(k)) return;
    const n = Number(env[k]);
    if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) problems.push(`${k}="${env[k]}" must be ${integer ? "a whole number" : "a number"} from ${min} to ${max}.`);
  };

  number("PORT", 1, 65535, true);
  oneOf("VOLT_MODE", ["live", "demo"]);
  oneOf("VOLT_FALLBACKS", ["on", "off"]);
  oneOf("VOLT_AUTO_RESUME", ["on", "off"]);
  oneOf("VOLT_ORCHESTRATOR_EFFORT", EFFORTS);
  oneOf("VOLT_SPECIALIST_EFFORT", EFFORTS);
  oneOf("VOLT_LOG_FORMAT", ["json", "pretty"]);
  oneOf("VOLT_LOG_LEVEL", ["debug", "info", "warn", "error"]);
  for (const k of ["VOLT_MODEL", "VOLT_SPECIALIST_MODEL", "VOLT_JUDGE_MODEL"]) {
    if (set(k) && !/^[a-z0-9][a-z0-9.\-]{2,80}$/.test(env[k]!)) problems.push(`${k}="${env[k]}" is not a model id (e.g. claude-opus-5-5).`);
  }
  number("VOLT_SPECIALIST_MAX_STEPS", 2, 16, true);
  number("VOLT_RUN_BUDGET_USD", 0, 100_000);
  number("VOLT_MONTHLY_BUDGET_USD", 0, 1_000_000);
  number("VOLT_AUTO_RESUME_HOURS", 0, 24 * 30);
  number("VOLT_RATE_LIMIT", 10, 100_000, true);

  const key = env.ANTHROPIC_API_KEY;
  if (key !== undefined && key !== "") {
    if (/\s|^["']|["']$/.test(key)) problems.push("ANTHROPIC_API_KEY has spaces or quotes around it; paste the key alone.");
    else if (!key.startsWith("sk-ant-")) warnings.push("ANTHROPIC_API_KEY does not start with sk-ant-; check it was pasted whole.");
  }
  if (set("ANTHROPIC_WORKSPACE_ID") && !/^wrkspc_[A-Za-z0-9]+$/.test(env.ANTHROPIC_WORKSPACE_ID!.trim())) problems.push("ANTHROPIC_WORKSPACE_ID should look like wrkspc_... (from the Claude Console's workspace settings).");
  if (set("ANTHROPIC_BASE_URL") && !/^https?:\/\//.test(env.ANTHROPIC_BASE_URL!)) problems.push("ANTHROPIC_BASE_URL must start with http:// or https://.");
  if (set("VOLT_ALLOWED_ORIGINS")) {
    for (const o of env.VOLT_ALLOWED_ORIGINS!.split(",").map((s) => s.trim()).filter(Boolean)) {
      if (!/^https?:\/\/[^/]+$/.test(o)) problems.push(`VOLT_ALLOWED_ORIGINS entry "${o}" must be an origin such as https://volt.example.com (no path).`);
    }
  }

  // Names that are nearly a known setting, e.g. NTHROPIC_API_KEY or ANTHROPIC_API_KEYS.
  for (const name of Object.keys(env)) {
    if (KNOWN.includes(name) || !/^(V|A|N|AN)/.test(name)) continue;
    const near = KNOWN.find((k) => close(name, k));
    if (near) warnings.push(`${name} is set but not used: did you mean ${near}?`);
  }

  const pluginDir = env.VOLT_PLUGIN_DIR || DEFAULT_PLUGIN_DIR;
  if (!fs.existsSync(path.join(pluginDir, "data", "agents.json"))) problems.push(`No VOLT plugin at ${pluginDir} (set VOLT_PLUGIN_DIR, or run plugins/volt/tools/import_volt.py).`);
  const dataDir = env.VOLT_DATA_DIR || DEFAULT_DATA_DIR;
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.accessSync(dataDir, fs.constants.W_OK);
  } catch {
    problems.push(`The data folder ${dataDir} cannot be written (VOLT_DATA_DIR).`);
  }
  if (env.VOLT_MODE === "live" && !credentialsConfigured(env)) {
    problems.push("VOLT_MODE=live but no Claude credentials are configured (ANTHROPIC_API_KEY).");
  }
  return { problems, warnings };
}
