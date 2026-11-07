import "./env.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { z } from "zod";
import { coaFromCsv, legacyFromCsv, validateCoa, validateMapping } from "../shared/coa.js";
import type { CoaEvent, Health, RunMode } from "../shared/events.js";
import { MODEL, runAssist } from "./assist.js";
import { runDemo } from "./demo.js";

/** Live when any Claude credential source is configured; VOLT_MODE overrides. */
export function detectMode(): RunMode {
  const forced = process.env.VOLT_MODE;
  if (forced === "live" || forced === "demo") return forced;
  if (["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_PROFILE"].some((k) => process.env[k])) return "live";
  return fs.existsSync(path.join(os.homedir(), ".config", "anthropic")) ? "live" : "demo";
}

const AssistBody = z.object({
  prompt: z.string().min(1).max(20_000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(100_000) })).max(40).optional(),
  coaCsv: z.string().max(500_000).optional(),
  legacyCsv: z.string().max(500_000).optional(),
});
const ValidateBody = z.object({ coaCsv: z.string().max(500_000), legacyCsv: z.string().max(500_000).optional() });

export function createApp(mode: RunMode = detectMode()) {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/healthz", (_req, res) => {
    const body: Health = { ok: true, mode, model: MODEL };
    res.json(body);
  });

  app.post("/api/validate", (req, res) => {
    const p = ValidateBody.safeParse(req.body);
    if (!p.success) return void res.status(400).json({ error: p.error.message });
    const coa = coaFromCsv(p.data.coaCsv);
    const leg = legacyFromCsv(p.data.legacyCsv ?? "");
    res.json({
      accounts: coa.accounts.length,
      errors: [...coa.errors, ...(p.data.legacyCsv ? leg.errors : [])],
      coaChecks: coa.errors.length ? [] : validateCoa(coa.accounts),
      mappingChecks: coa.errors.length || leg.errors.length || !leg.legacy.length ? [] : validateMapping(coa.accounts, leg.legacy, leg.mappings),
    });
  });

  app.post("/api/assist", async (req, res) => {
    const p = AssistBody.safeParse(req.body);
    if (!p.success) return void res.status(400).json({ error: p.error.message });
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    const ac = new AbortController();
    res.on("close", () => ac.abort());
    const emit = (e: CoaEvent) => { if (!res.writableEnded) res.write(`data: ${JSON.stringify(e)}\n\n`); };
    try {
      if (mode === "live") await runAssist(p.data, emit, ac.signal);
      else runDemo(p.data, emit);
    } catch (err) {
      if (!ac.signal.aborted) emit({ type: "error", message: err instanceof Error ? err.message : String(err) });
    }
    emit({ type: "done" });
    res.end();
  });

  if (process.env.NODE_ENV === "production") {
    const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
    app.use(express.static(dist));
    app.get("/{*splat}", (_req, res) => res.sendFile(path.join(dist, "index.html")));
  }
  return app;
}

// Start only when run directly (tsx server/index.ts), not when imported by tests.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 8788);
  const mode = detectMode();
  createApp(mode).listen(port, () => console.log(`VOLT COA Designer API on :${port} (${mode} mode, ${MODEL})`));
}
