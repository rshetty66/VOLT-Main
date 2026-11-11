/**
 * browser.ts — headless-browser verification probe for Builder G4 (D12).
 *
 * The generated app's own smoke.mjs covers fetch-level stages (HTML sanity,
 * asset 200s, route 200s). The two stages a fetch script cannot honestly
 * cover — "did the app actually mount, click its primary action, and stay
 * quiet in the console" — run here against a real browser, dependency-free:
 *
 *   - launch chromium with --remote-debugging-pipe (fd 3/4), which speaks
 *     the DevTools protocol as JSON messages NUL-delimited over pipes —
 *     no WebSocket client, no npm installs;
 *   - collect Runtime.consoleAPICalled (type "error"), Runtime.exceptionThrown
 *     and error-level Log entries while the page loads;
 *   - click the declared primary action ([data-testid="primary-action"]) and
 *     require a DOM mutation or navigation with no uncaught exception.
 *
 * When no chromium binary is available the probe reports `skipped` and G4
 * passes on the fetch stages alone — an honest skip, never a fake pass.
 */
import { spawn, type ChildProcess } from "child_process";
import { existsSync } from "fs";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

export interface BrowserProbeResult {
  ok: boolean;
  /** console.error calls, uncaught exceptions, error-level log entries. */
  consoleErrors: string[];
  /** Failure detail when the primary-action round-trip did not hold. */
  actionError?: string;
  /** Set (with ok: true) when the probe did not run at all. */
  skipped?: string;
}

const CHROME_CANDIDATES = [
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
];

/** Resolve a chromium binary: env override first, then well-known paths. */
export function chromiumPath(env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.BUILDER_CHROME_PATH) return env.BUILDER_CHROME_PATH;
  for (const candidate of CHROME_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** Minimal DevTools-protocol client over the --remote-debugging-pipe fds. */
class PipeClient {
  private nextId = 1;
  private buffer = "";
  private readonly pending = new Map<
    number,
    { resolve: (v: never) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }
  >();
  onEvent: (method: string, params: Record<string, unknown>) => void = () => {};

  constructor(private readonly proc: ChildProcess) {
    const out = proc.stdio[4];
    if (!out || typeof out === "string") {
      throw new Error("remote-debugging-pipe fd 4 unavailable");
    }
    out.on("data", (d: Buffer) => this.onData(d.toString()));
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    let idx: number;
    while ((idx = this.buffer.indexOf("\0")) >= 0) {
      const raw = this.buffer.slice(0, idx);
      this.buffer = this.buffer.slice(idx + 1);
      if (!raw) continue;
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw);
      } catch {
        continue;
      }
      if (typeof msg.id === "number") {
        const waiter = this.pending.get(msg.id);
        if (!waiter) continue;
        this.pending.delete(msg.id);
        clearTimeout(waiter.timer);
        if (msg.error) {
          waiter.reject(
            new Error(
              `CDP ${String((msg.error as { message?: string }).message)}`,
            ),
          );
        } else {
          waiter.resolve(msg.result as never);
        }
      } else if (typeof msg.method === "string") {
        this.onEvent(msg.method, (msg.params ?? {}) as Record<string, unknown>);
      }
    }
  }

  call<T>(
    method: string,
    params: Record<string, unknown> = {},
    sessionId?: string,
    timeoutMs = 15_000,
  ): Promise<T> {
    const id = this.nextId++;
    const inn = this.proc.stdio[3] as import("stream").Writable | null;
    if (!inn) {
      return Promise.reject(new Error("remote-debugging-pipe fd 3 unavailable"));
    }
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP ${method} timed out`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: resolve as (v: never) => void,
        reject,
        timer,
      });
      inn.write(JSON.stringify({ id, method, params, sessionId }) + "\0");
    });
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const READY_EXPR = `(() => {
  const root = document.querySelector("#root") || document.querySelector("#app");
  return document.readyState === "complete" && !!root && root.children.length > 0;
})()`;

const CLICK_EXPR = `(() => {
  const el = document.querySelector('[data-testid="primary-action"]');
  if (!el) return "missing";
  const before = document.body.innerHTML.length;
  const url = location.href;
  el.click();
  return JSON.stringify({ before, url });
})()`;

const AFTER_CLICK_EXPR = `(() => {
  const after = document.body.innerHTML.length;
  return JSON.stringify({ after, url: location.href });
})()`;

const ERROR_SOURCES = /favicon/i;

/**
 * Load url in headless chromium, watch the console, click the primary
 * action. Returns ok only when the page mounts, the click round-trips, and
 * nothing errored. Never throws — a probe failure is gate data.
 */
export async function probeApp(
  url: string,
  opts: { timeoutMs?: number; chromePath?: string | null } = {},
): Promise<BrowserProbeResult> {
  const chrome = opts.chromePath ?? chromiumPath();
  if (!chrome) {
    return { ok: true, consoleErrors: [], skipped: "no chromium binary found" };
  }
  const timeoutMs = opts.timeoutMs ?? 45_000;
  const profileDir = await mkdtemp(path.join(tmpdir(), "volt-probe-"));
  const child = spawn(
    chrome,
    [
      "--headless",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--remote-debugging-pipe",
      `--user-data-dir=${profileDir}`,
      "about:blank",
    ],
    { stdio: ["ignore", "pipe", "pipe", "pipe", "pipe"], detached: true },
  );
  // Drain stdout/stderr so the pipes can never backpressure the browser.
  child.stdout?.resume();
  child.stderr?.resume();
  const kill = () => {
    try {
      process.kill(-child.pid!, "SIGKILL");
    } catch {
      /* already dead */
    }
  };

  const consoleErrors: string[] = [];
  const noteError = (line: string) => {
    if (!ERROR_SOURCES.test(line)) consoleErrors.push(line);
  };
  let actionError: string | undefined;
  const deadline = Date.now() + timeoutMs;

  try {
    const client = new PipeClient(child);
    client.onEvent = (method, params) => {
      if (method === "Runtime.consoleAPICalled") {
        const p = params as { type?: string; args?: { value?: unknown; description?: string }[] };
        if (p.type === "error" || p.type === "assert") {
          noteError(
            "console.error: " +
              (p.args ?? [])
                .map((a) => String(a.value ?? a.description ?? ""))
                .join(" "),
          );
        }
      } else if (method === "Runtime.exceptionThrown") {
        const p = params as {
          exceptionDetails?: { text?: string; exception?: { description?: string } };
        };
        noteError(
          "uncaught: " +
            (p.exceptionDetails?.exception?.description ??
              p.exceptionDetails?.text ??
              "unknown exception"),
        );
      } else if (method === "Log.entryAdded") {
        const p = params as {
          entry?: { level?: string; text?: string; url?: string };
        };
        if (p.entry?.level === "error") {
          const line =
            "log: " +
            (p.entry.text ?? "") +
            (p.entry.url ? ` (${p.entry.url})` : "");
          noteError(line);
        }
      }
    };

    // Attach to the page target that the about:blank launch created.
    const targets = await client.call<{ targetInfos: { targetId: string; type: string }[] }>(
      "Target.getTargets",
    );
    const page = targets.targetInfos.find((t) => t.type === "page");
    if (!page) throw new Error("no page target in chromium");
    const { sessionId } = await client.call<{ sessionId: string }>(
      "Target.attachToTarget",
      { targetId: page.targetId, flatten: true },
    );

    await client.call("Runtime.enable", {}, sessionId);
    await client.call("Log.enable", {}, sessionId);
    await client.call("Page.enable", {}, sessionId);
    await client.call("Page.navigate", { url }, sessionId);

    // Wait for the app to mount (root element populated).
    let mounted = false;
    while (Date.now() < deadline) {
      const r = await client.call<{ result?: { value?: unknown } }>(
        "Runtime.evaluate",
        { expression: READY_EXPR, returnByValue: true },
        sessionId,
        5_000,
      );
      if (r.result?.value === true) {
        mounted = true;
        break;
      }
      await sleep(300);
    }
    if (!mounted) {
      return {
        ok: false,
        consoleErrors,
        actionError: "app never mounted — #root stayed empty before timeout",
      };
    }

    // Primary-action round-trip: click, then require a DOM mutation or
    // navigation, and give event handlers a beat to throw if they will.
    const click = await client.call<{ result?: { value?: string } }>(
      "Runtime.evaluate",
      { expression: CLICK_EXPR, returnByValue: true },
      sessionId,
    );
    const value = click.result?.value;
    if (value === "missing") {
      actionError =
        'no [data-testid="primary-action"] element on the start screen';
    } else if (typeof value === "string") {
      const before = JSON.parse(value) as { before: number; url: string };
      await sleep(1_000);
      const after = await client.call<{ result?: { value?: string } }>(
        "Runtime.evaluate",
        { expression: AFTER_CLICK_EXPR, returnByValue: true },
        sessionId,
      );
      const state = JSON.parse(after.result?.value ?? "{}") as {
        after?: number;
        url?: string;
      };
      if (
        state.after === before.before &&
        state.url === before.url
      ) {
        actionError =
          "primary action click produced no DOM change or navigation";
      }
    }
    await sleep(300);
    return {
      ok: consoleErrors.length === 0 && !actionError,
      consoleErrors,
      actionError,
    };
  } catch (err) {
    return {
      ok: false,
      consoleErrors,
      actionError: `browser probe failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  } finally {
    kill();
    await rm(profileDir, { recursive: true, force: true }).catch(() => {});
  }
}
