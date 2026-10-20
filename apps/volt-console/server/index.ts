/**
 * Starts the VOLT console: loads the catalogue, opens the database, and serves
 * the API (routes in app.ts) plus, in production, the built React app from dist/.
 */
import "./env.js";
import path from "node:path";
import express from "express";
import { loadCatalog } from "./catalog.js";
import { MODEL } from "./orchestrator.js";
import { DEFAULT_DATA_DIR, openDb } from "./db.js";
import { DIST_DIR } from "./paths.js";
import { markInterruptedRuns } from "./store.js";
import { countUsers } from "./auth.js";
import { createApp } from "./app.js";
import { resumeInterrupted } from "./recovery.js";
import { checkConfig, credentialsConfigured } from "./config.js";
import { log } from "./log.js";
import { scheduleRetention } from "./retention.js";
import type { RunMode } from "../shared/events.js";

// Settings first: a typo should stop the start with a clear message, not fail later.
const config = checkConfig();
for (const w of config.warnings) log.warn(`config: ${w}`);
if (config.problems.length) {
  for (const p of config.problems) log.error(`config: ${p}`);
  log.error("The console did not start: fix the settings above (environment or apps/volt-console/.env).");
  process.exit(1);
}

/** Live when any Claude credential source is configured; VOLT_MODE overrides. */
function detectMode(): RunMode {
  const forced = process.env.VOLT_MODE;
  if (forced === "live" || forced === "demo") return forced;
  return credentialsConfigured() ? "live" : "demo";
}

const catalog = loadCatalog();
const dataDir = process.env.VOLT_DATA_DIR || DEFAULT_DATA_DIR;
const db = await openDb(dataDir);
const interrupted = await markInterruptedRuns(db);
const mode = detectMode();
const app = createApp({ db, catalog, mode });
const recovery = await resumeInterrupted({ db, catalog, mode }, interrupted);
scheduleRetention(db);

if (process.env.NODE_ENV === "production") {
  const dist = DIST_DIR;
  app.use(express.static(dist));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

const port = Number(process.env.PORT ?? 8787);
const users = await countUsers(db);
const server = app.listen(port, () => {
  log.info(`VOLT Agentic Console API on http://localhost:${port} (${mode} mode, model ${MODEL})`, { port, mode, model: MODEL });
  log.info(`Saved data: ${dataDir}${interrupted.length ? ` (${interrupted.length} run(s) interrupted by the last stop)` : ""}`, { dataDir, interrupted: interrupted.length });
  for (const r of recovery.resumed) log.info(`Resumed after restart: ${r.title} (run ${r.from} continues as ${r.to})`, { from: r.from, to: r.to });
  for (const r of recovery.skipped) log.info(`Not resumed: ${r.title || r.id}: ${r.why}`, { runId: r.id });
  log.info(users ? `Sign-in: ${users} user(s)` : "Sign-in: no users yet; open the app to create the first admin account");
  log.info(`Catalog: ${catalog.agents.length} agents, ${catalog.workflows.length} workflows, ${catalog.skills.length} skills from ${catalog.source.name}@${catalog.source.commit?.slice(0, 7) ?? "?"}`);
});
server.on("error", (err: NodeJS.ErrnoException) => {
  log.error(err.code === "EADDRINUSE" ? `Port ${port} is already in use: stop the other server or set PORT.` : "The server could not start.", { err });
  process.exit(1);
});
