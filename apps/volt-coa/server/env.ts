/**
 * Loads apps/volt-coa/.env into process.env. Imported first by server/index.ts so ANTHROPIC_API_KEY and the
 * VOLT_* settings are in place before the other modules read them. Variables already set in the environment win.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ENV_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env");

export function loadEnv(file = DEFAULT_ENV_FILE): boolean {
  if (!fs.existsSync(file)) return false;
  process.loadEnvFile(file);
  return true;
}

loadEnv();
