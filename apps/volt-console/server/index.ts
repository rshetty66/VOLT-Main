/**
 * Starts the VOLT console: loads the catalogue, opens the database, and serves
 * the API (routes in app.ts) plus, in production, the built React app from dist/.
 */
import "./env.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { loadCatalog } from "./catalog.js";
import { MODEL } from "./orchestrator.js";
import { DEFAULT_DATA_DIR, openDb } from "./db.js";
import { markInterruptedRuns } from "./store.js";
import { countUsers } from "./auth.js";
import { createApp } from "./app.js";
import type { RunMode } from "../shared/events.js";

/** Live when any Claude credential source is configured; VOLT_MODE overrides. */
function detectMode(): RunMode {
  const forced = process.env.VOLT_MODE;
  if (forced === "live" || forced === "demo") return forced;
  const env = ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_PROFILE", "ANTHROPIC_FEDERATION_RULE_ID"];
  if (env.some((k) => process.env[k])) return "live";
  return fs.existsSync(path.join(os.homedir(), ".config", "anthropic")) ? "live" : "demo";
}

const catalog = loadCatalog();
const dataDir = process.env.VOLT_DATA_DIR || DEFAULT_DATA_DIR;
const db = await openDb(dataDir);
const interrupted = await markInterruptedRuns(db);
const mode = detectMode();
const app = createApp({ db, catalog, mode });

if (process.env.NODE_ENV === "production") {
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
  app.use(express.static(dist));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

const port = Number(process.env.PORT ?? 8787);
const users = await countUsers(db);
app.listen(port, () => {
  console.log(`VOLT Agentic Console API on http://localhost:${port} (${mode} mode, model ${MODEL})`);
  console.log(`Saved data: ${dataDir}${interrupted ? ` (${interrupted} interrupted run(s) marked)` : ""}`);
  console.log(users ? `Sign-in: ${users} user(s)` : "Sign-in: no users yet; open the app to create the first admin account");
  console.log(`Catalog: ${catalog.agents.length} agents, ${catalog.workflows.length} workflows, ${catalog.skills.length} skills from ${catalog.source.name}@${catalog.source.commit?.slice(0, 7) ?? "?"}`);
});
