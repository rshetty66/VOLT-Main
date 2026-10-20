/**
 * Loads apps/volt-console/.env into process.env before any other server module reads it.
 * Imported first in index.ts: ES modules evaluate imports in order, so settings such as
 * VOLT_MODEL are in place before orchestrator.ts reads them. Variables already set in the
 * shell are kept. Without a .env file this does nothing (CI, containers).
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const envFile = fileURLToPath(new URL("../.env", import.meta.url));
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
