/**
 * gates.ts — standalone Builder verification gate runner (D11).
 *
 * Runs the G0–G4 chain from the output contract against an isolated
 * workspace, in order, stopping at the first failure. The runner is pure
 * verification: it never repairs. The orchestrator owns the bounded repair
 * policy and calls runGates again after each patch.
 *
 *   G0 spec completeness   — schema + policy (see spec.ts)
 *   G1 typecheck           — `npm run check` (configurable)
 *   G2 production build    — `npm run build` + dist artifact exists
 *   G3 bundle boot         — boot built bundle with dummy env, root HTTP 200
 *   G4 smoke test          — boot again, then staged verification:
 *                            the app's own smoke.mjs covers HTML sanity,
 *                            asset 200s and route 200s (fetch-level), and a
 *                            headless-browser probe covers the console-error
 *                            check and the primary-action round-trip when a
 *                            chromium binary is available (D12)
 */
import { spawn } from "child_process";
import net from "net";
import type { Workspace } from "./workspace";
import { checkSpec, type BuildSpec } from "./spec";
import { probeApp, type BrowserProbeResult } from "./browser";

export type GateId = "G0" | "G1" | "G2" | "G3" | "G4";

export type GateStatus = "pass" | "fail" | "skipped";

export interface GateResult {
  gate: GateId;
  status: GateStatus;
  durationMs: number;
  /** Failure output, capped at 20 lines (contract). */
  errorExcerpt?: string;
  /** Non-failure context for a pass/skip (e.g. browser stages skipped). */
  note?: string;
}

export interface GateConfig {
  /** Shell commands — defaults match the platform template scripts. */
  check?: string;
  build?: string;
  start?: string;
  /** Smoke script path relative to the workspace; G4 skips if absent. */
  smoke?: string;
  /** Per-gate timeout. Default 10 min, matching the CI workflow budget. */
  timeoutMs?: number;
  /** Extra env for boot gates (G3/G4). */
  env?: Record<string, string>;
  /** Browser stages of G4 (console-error check + primary-action round-trip). */
  browser?: {
    /** Inject a fake probe in tests; defaults to the real chromium probe. */
    probe?: (url: string) => Promise<BrowserProbeResult>;
    /** Force-disable the browser stages (BUILDER_SMOKE_BROWSER=0 also works). */
    disabled?: boolean;
  };
}

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_EXCERPT_LINES = 20;

const DUMMY_ENV = {
  APP_ID: "dummy",
  APP_SECRET: "dummy",
  KIMI_AUTH_URL: "https://example.com",
  KIMI_OPEN_URL: "https://example.com",
  NODE_ENV: "production",
};

function excerpt(output: string): string {
  const lines = output.trimEnd().split("\n");
  return lines.slice(-MAX_EXCERPT_LINES).join("\n");
}

interface CmdOutcome {
  code: number | null;
  output: string;
  timedOut: boolean;
}

function runCommand(
  cmd: string,
  cwd: string,
  env: Record<string, string>,
  timeoutMs: number,
): Promise<CmdOutcome> {
  return new Promise((resolve) => {
    const child = spawn("/bin/sh", ["-c", cmd], {
      cwd,
      env: { ...process.env, ...env },
      detached: true,
    });
    let output = "";
    const cap = () => {
      if (output.length > 200_000) output = output.slice(-200_000);
    };
    child.stdout.on("data", (d) => {
      output += d.toString();
      cap();
    });
    child.stderr.on("data", (d) => {
      output += d.toString();
      cap();
    });
    const timer = setTimeout(() => {
      try {
        process.kill(-child.pid!, "SIGKILL");
      } catch {
        /* already dead */
      }
    }, timeoutMs);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, output, timedOut: code === null });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ code: 1, output: String(err), timedOut: false });
    });
  });
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.once("error", reject);
    srv.listen(0, () => {
      const addr = srv.address();
      srv.close(() =>
        resolve(typeof addr === "object" && addr ? addr.port : 0),
      );
    });
  });
}

async function probeRoot(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw lastErr ?? new Error("probe timed out");
}

/** Boot the app and wait for root HTTP 200. Caller owns the kill switch. */
async function bootApp(
  startCmd: string,
  ws: Workspace,
  port: number,
  env: Record<string, string>,
  timeoutMs: number,
): Promise<{ ok: boolean; error?: string; kill: () => void }> {
  const child = spawn("/bin/sh", ["-c", startCmd], {
    cwd: ws.root,
    env: { ...process.env, ...env, PORT: String(port) },
    detached: true,
  });
  let bootLog = "";
  child.stdout.on("data", (d) => {
    bootLog += d.toString();
    if (bootLog.length > 50_000) bootLog = bootLog.slice(-50_000);
  });
  child.stderr.on("data", (d) => {
    bootLog += d.toString();
    if (bootLog.length > 50_000) bootLog = bootLog.slice(-50_000);
  });
  const kill = () => {
    try {
      process.kill(-child.pid!, "SIGKILL");
    } catch {
      /* already dead */
    }
  };
  try {
    await probeRoot(`http://localhost:${port}/`, timeoutMs);
    return { ok: true, kill };
  } catch (err) {
    kill();
    const detail = bootLog.trim() ? `\n--- boot log ---\n${excerpt(bootLog)}` : "";
    return { ok: false, error: `${String(err)}${detail}`, kill };
  }
}

/** Boot the app, wait for root HTTP 200, then kill the process group. */
async function bootAndProbe(
  startCmd: string,
  ws: Workspace,
  port: number,
  env: Record<string, string>,
  timeoutMs: number,
): Promise<{ ok: boolean; error?: string }> {
  const r = await bootApp(startCmd, ws, port, env, timeoutMs);
  r.kill();
  return { ok: r.ok, error: r.error };
}

async function gate(
  id: GateId,
  fn: () => Promise<{ ok: boolean; error?: string; note?: string }>,
): Promise<GateResult> {
  const t0 = Date.now();
  try {
    const r = await fn();
    return {
      gate: id,
      status: r.ok ? "pass" : "fail",
      durationMs: Date.now() - t0,
      errorExcerpt: r.ok ? undefined : (r.error ?? "gate failed"),
      note: r.note,
    };
  } catch (err) {
    return {
      gate: id,
      status: "fail",
      durationMs: Date.now() - t0,
      errorExcerpt: String(err),
    };
  }
}

const skipped = (id: GateId, reason: string): GateResult => ({
  gate: id,
  status: "skipped",
  durationMs: 0,
  errorExcerpt: reason,
});

/**
 * Route contract shared with the codegen prompt: the first screen is the
 * start screen at "/", every other screen lives at "/<kebab-case-name>".
 * G4 hands this list to the app's smoke.mjs via the SMOKE_SCREENS env.
 */
export function screenRoutes(spec: BuildSpec): string[] {
  const kebab = (name: string) =>
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  return spec.screens.map((s, i) => (i === 0 ? "/" : `/${kebab(s.name)}`));
}

/**
 * Run the gate chain. Stops at the first failure; later gates are marked
 * skipped with the reason, so a report always shows all five rows.
 */
export async function runGates(
  ws: Workspace,
  spec: BuildSpec,
  config: GateConfig = {},
): Promise<GateResult[]> {
  const timeout = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const results: GateResult[] = [];

  const g0 = await gate("G0", async () => {
    const r = checkSpec(spec);
    return { ok: r.ok, error: r.issues.join("\n") };
  });
  results.push(g0);
  if (g0.status !== "pass") {
    return [...results, ...(["G1", "G2", "G3", "G4"] as GateId[]).map((id) =>
      skipped(id, "not run — G0 failed"),
    )];
  }

  const g1 = await gate("G1", async () => {
    const r = await runCommand(
      config.check ?? "npm run check",
      ws.root,
      {},
      timeout,
    );
    return {
      ok: r.code === 0,
      error: r.timedOut ? `timed out after ${timeout}ms` : excerpt(r.output),
    };
  });
  results.push(g1);
  if (g1.status !== "pass") {
    return [...results, ...(["G2", "G3", "G4"] as GateId[]).map((id) =>
      skipped(id, "not run — G1 failed"),
    )];
  }

  const g2 = await gate("G2", async () => {
    const r = await runCommand(
      config.build ?? "npm run build",
      ws.root,
      {},
      timeout,
    );
    if (r.code !== 0) {
      return {
        ok: false,
        error: r.timedOut ? `timed out after ${timeout}ms` : excerpt(r.output),
      };
    }
    const files = await ws.list();
    const hasIndex = files.some((f) => f === "dist/index.html");
    const hasBoot = files.some((f) => f === "dist/boot.js");
    return {
      ok: hasIndex || hasBoot,
      error:
        hasIndex || hasBoot
          ? undefined
          : "build produced no dist/index.html or dist/boot.js",
    };
  });
  results.push(g2);
  if (g2.status !== "pass") {
    return [...results, ...(["G3", "G4"] as GateId[]).map((id) =>
      skipped(id, "not run — G2 failed"),
    )];
  }

  const bootEnv = { ...DUMMY_ENV, ...config.env };
  const g3 = await gate("G3", async () => {
    const port = await freePort();
    const r = await bootAndProbe(
      config.start ?? "npm run start",
      ws,
      port,
      bootEnv,
      timeout,
    );
    return r;
  });
  results.push(g3);
  if (g3.status !== "pass") {
    return [...results, skipped("G4", "not run — G3 failed")];
  }

  const smokeRel = config.smoke ?? "smoke.mjs";
  if (!(await ws.list()).includes(smokeRel)) {
    // No smoke script generated yet — G4 cannot verify the primary flow.
    // Skipped is honest; a pass without a script would be fake.
    results.push(skipped("G4", `no ${smokeRel} — primary flow unverified`));
    return results;
  }

  const g4 = await gate("G4", async () => {
    const port = await freePort();
    const boot = await bootApp(
      config.start ?? "npm run start",
      ws,
      port,
      bootEnv,
      timeout,
    );
    if (!boot.ok) return { ok: false, error: boot.error };
    try {
      const appUrl = `http://localhost:${port}`;
      const smoke = await runCommand(
        `node ${smokeRel}`,
        ws.root,
        {
          ...bootEnv,
          APP_URL: appUrl,
          SMOKE_SCREENS: JSON.stringify(screenRoutes(spec)),
        },
        timeout,
      );
      if (smoke.code !== 0) {
        return {
          ok: false,
          error: smoke.timedOut
            ? `smoke timed out after ${timeout}ms`
            : excerpt(smoke.output),
        };
      }
      // Browser stages: console-error check + primary-action round-trip.
      // Skipped honestly when no chromium is available or disabled.
      const browserCfg = config.browser ?? {};
      if (
        browserCfg.disabled ||
        process.env.BUILDER_SMOKE_BROWSER === "0"
      ) {
        return { ok: true, note: "smoke passed; browser stages disabled" };
      }
      const probe = browserCfg.probe ?? ((url: string) => probeApp(url));
      const r = await probe(appUrl + "/");
      if (r.skipped) {
        return { ok: true, note: `smoke passed; browser stages skipped (${r.skipped})` };
      }
      if (!r.ok) {
        const parts = [
          ...r.consoleErrors.slice(0, 5),
          r.actionError,
        ].filter(Boolean);
        return {
          ok: false,
          error: `browser probe failed — ${parts.join(" | ") || "unknown"}`,
        };
      }
      return { ok: true, note: "smoke + browser probe passed" };
    } finally {
      boot.kill();
    }
  });
  results.push(g4);

  return results;
}

/** Roll-up line for the chat surface: status leads, process nowhere. */
export function summarize(results: GateResult[]): string {
  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.find((r) => r.status === "fail");
  if (!failed) return `${passed}/${results.length} gates passed`;
  return `gate ${failed.gate} failed after ${failed.durationMs}ms — ${passed} gate(s) passed before it`;
}
