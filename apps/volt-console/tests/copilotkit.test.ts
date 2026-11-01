import http from "node:http";
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

describe("CopilotKit runtime (alongside assistant-ui)", () => {
  it("keeps CopilotKit telemetry off by default", () => {
    expect(process.env.COPILOTKIT_TELEMETRY_DISABLED).toBe("true");
  });

  it("serves runtime info with the default Claude agent", async () => {
    const r = await fetch(`${base}/info`);
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(JSON.stringify(body)).toContain("default");
  });
});
