/**
 * Loads apps/volt-console/.env into process.env.
 *
 * Imported first by server/index.ts so settings such as ANTHROPIC_API_KEY,
 * VOLT_MODEL and VOLT_MODE are in place before the other modules read them.
 * Variables already set in the environment win over the file.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ENV_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env");

export function loadConsoleEnv(file = DEFAULT_ENV_FILE): boolean {
  if (!fs.existsSync(file)) return false;
  process.loadEnvFile(file);
  return true;
}

loadConsoleEnv();

// CopilotKit sends usage telemetry to telemetry.copilotkit.ai unless told not to. VOLT keeps it off;
// set COPILOTKIT_TELEMETRY_DISABLED=false in .env to opt in.
process.env.COPILOTKIT_TELEMETRY_DISABLED ??= "true";
