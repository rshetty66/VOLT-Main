/**
 * Copilot config conformance — converts the workbench-copilot architecture
 * review into permanent assertions. Fails loudly on upgrade drift
 * (CopilotKit bump, zod override, model change, weakened guardrails).
 */
import http from "node:http";
import fs from "node:fs";
import type { AddressInfo } from "node:net";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let server: http.Server;
let base = "";

beforeAll(async () => {
  process.env.ANTHROPIC_API_KEY ??= "test-key";
  await import("../server/env");
  const { copilotkitHandler, COPILOTKIT_PATH } = await import("../server/copilotkit");
  const app = express();
  app.use(copilotkitHandler());
  server = app.listen(0);
  await new Promise<void>((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}${COPILOTKIT_PATH}`;
});
afterAll(() => server?.close());

const copilotSource = () =>
  fs.readFileSync(new URL("../server/copilotkit.ts", import.meta.url), "utf8");

describe("copilot config conformance", () => {
  it("keeps CopilotKit telemetry off by default", () => {
    expect(process.env.COPILOTKIT_TELEMETRY_DISABLED).toBe("true");
  });

  it("resolves the expected model unless VOLT_MODEL deliberately overrides", async () => {
    // The copilot shares the console's MODEL. If VOLT_MODEL is set, the
    // guardrail prompt may need re-tuning on that model — make it visible.
    const { MODEL } = await import("../server/orchestrator");
    expect(MODEL).toBe(process.env.VOLT_MODEL ?? "claude-opus-5-5");
  });

  it("declares the agent caps the guardrail budget assumes", () => {
    const src = copilotSource();
    expect(src).toMatch(/maxSteps:\s*8\b/);
    expect(src).toMatch(/maxOutputTokens:\s*8000\b/);
  });

  it("keeps all five guardrails in the agent prompt", () => {
    const src = copilotSource();
    for (const guard of [
      /never invent figures/i,
      /page (number|and quote|s)/i, // page+quote citation duty
      /never set an approver/i, // no sign-off
      /illustrative example/i, // redirect, not self-switch
      /confirm_figures/, // HITL tool named
    ]) {
      expect(src).toMatch(guard);
    }
  });

  it("mounts with cors off and channels off", () => {
    const src = copilotSource();
    expect(src).toMatch(/cors:\s*false/);
    expect(src).toMatch(/activateChannels:\s*false/);
  });

  it("rejects a malformed body with an error status, not a hang", async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    try {
      const r = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ not json",
        signal: ctrl.signal,
      });
      expect(r.status).toBeGreaterThanOrEqual(400);
    } finally {
      clearTimeout(timer);
    }
  });
});
