/**
 * codegen.ts — Builder codegen agent loop (D8).
 *
 * Orchestrates one build: scaffold the workspace, ask the model for the
 * complete file map, apply it, run the gate chain. If a gate fails, the
 * failure evidence goes back to the model for another repair round, up to
 * a bounded maxRounds (default 3: one initial attempt + two repairs, cap 5)
 * — the loop never exceeds the budget and never reports a fake pass.
 * The runner (gates.ts) stays pure; the repair policy lives here alone.
 *
 * Contract artifacts: buildlog.jsonl in the workspace records every stage
 * (scaffold, generate, apply, gates, repair) with timings.
 */
import { generateObject, zodSchema, type ModelMessage } from "ai";
import { z } from "zod";
import { kimiGw, defaultModel } from "../ai/provider";
import { classifyAiError } from "../ai/ai-client";
import type { Workspace } from "./workspace";
import { WorkspaceError } from "./workspace";
import type { BuildSpec } from "./spec";
import { scaffold } from "./scaffold";
import { runGates, summarize, type GateConfig, type GateResult } from "./gates";

const MAX_FILES = 60;
const MAX_FILE_CHARS = 96 * 1024;
const MAX_TOTAL_CHARS = 768 * 1024;
const ALLOWED_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|html|css|md|txt|svg)$/i;

export const fileMapSchema = z.object({
  files: z
    .array(
      z.object({
        path: z.string().min(1).max(300),
        content: z.string().max(MAX_FILE_CHARS),
      }),
    )
    .min(1)
    .max(MAX_FILES),
});

export type FileMap = z.infer<typeof fileMapSchema>;

export interface BuildEvent {
  t: string;
  at: number;
  detail?: Record<string, unknown>;
}

export interface BuildOutcome {
  results: GateResult[];
  summary: string;
  rounds: { used: number; repaired: boolean };
  events: BuildEvent[];
}

export function codegenSystemPrompt(): string {
  return `You are the VOLT Builder codegen agent. You receive one approved build spec (JSON) and you return the COMPLETE file map of a working web application. You never explain, you never omit a file, you never truncate code.

Stack contract (must boot headless with dummy env):
- Vite + React 18 + TypeScript. package.json scripts: "check": "tsc --noEmit", "build": "vite build", "start": "vite preview --port $PORT --strictPort".
- Include: package.json, tsconfig.json, vite.config.ts, index.html, src/main.tsx, src/App.tsx, and one source file per declared screen under src/screens/. Plain CSS or inline styles — no UI kit installs beyond react/react-dom.
- Data: browser localStorage behind a small typed store. State on the screen how to clear it. No backend, no secrets, no network calls to third-party APIs.
- smoke.mjs: a Node script (built-in fetch only, no installs) that verifies the app in three named stages and exits non-zero on the first failure, printing one "stage <name>: ok" line per stage:
  1. html-sanity — APP_URL returns 200 text/html containing the mount element (<div id="root">) and a <script> tag.
  2. assets-200 — every src/href referenced by a <script> or <link> tag in index.html returns 200 (resolve relative URLs against APP_URL).
  3. routes-200 — SMOKE_SCREENS is a JSON array of routes (see the routing contract below); every route returns 200.
- Routing contract: the first screen in the spec is the start screen at "/", every other screen is served at "/<kebab-case-name>".
- Browser contract for the runner's stages 4-5 (no work needed in the app beyond this): every screen's primary-action control carries data-testid="primary-action", and clicking it must change the DOM or navigate without throwing. The verification runner clicks it headlessly and fails the build on console.error, uncaught exceptions, or a click that throws or does nothing.
- Typecheck clean under tsc --noEmit with "strict": true. No any-spam; the app must actually implement the spec's entities, screens, and primary flow.
- Keep it small and real: a complete, working, unglamorous app beats an ambitious shell. Every declared screen exists and renders; the primary action of each screen works against the store.
- path values are repo-relative forward-slash paths (e.g. "src/screens/InvoiceList.tsx"). Allowed extensions: ts, tsx, js, jsx, mjs, cjs, json, html, css, md, txt, svg. Never write spec.json, buildlog.jsonl, or anything under node_modules/ or dist/.`;
}

/** Round 1 asks for the app; repair rounds append the gate evidence. */
export function buildCodegenMessages(
  spec: BuildSpec,
  failure?: string,
): ModelMessage[] {
  const messages: ModelMessage[] = [
    { role: "system", content: codegenSystemPrompt() },
    {
      role: "user",
      content: `Approved build spec:\n${JSON.stringify(spec, null, 2)}\n\nReturn the complete file map as structured output.`,
    },
  ];
  if (failure) {
    messages.push({
      role: "user",
      content: `The previous file map FAILED verification. Do not apologize or explain — return a corrected complete file map.\n\nFailure evidence:\n${failure}`,
    });
  }
  return messages;
}

/** Roll up gate results into the evidence packet the repair round consumes. */
export function failureReport(results: GateResult[]): string {
  const failed = results.find((r) => r.status === "fail");
  if (!failed) return "";
  const lines = results.map(
    (r) =>
      `${r.gate}: ${r.status}${r.errorExcerpt ? ` — ${r.errorExcerpt}` : ""}`,
  );
  return `${summarize(results)}\n${lines.join("\n")}`.slice(0, 12_000);
}

export interface ApplyResult {
  written: string[];
  skipped: { path: string; reason: string }[];
}

/** Apply a generated file map to the workspace, rejecting unsafe entries. */
export async function applyFileMap(
  ws: Workspace,
  map: FileMap,
): Promise<ApplyResult> {
  const written: string[] = [];
  const skipped: { path: string; reason: string }[] = [];
  let total = 0;
  for (const f of map.files) {
    const reason = !ALLOWED_EXT.test(f.path)
      ? "extension not allowed"
      : f.path.startsWith("node_modules/") || f.path.startsWith("dist/")
        ? "path prefix not allowed"
        : (total += f.content.length) > MAX_TOTAL_CHARS
          ? "file map total size cap exceeded"
          : null;
    if (reason) {
      skipped.push({ path: f.path, reason });
      continue;
    }
    try {
      await ws.write(f.path, f.content);
      written.push(f.path);
    } catch (err) {
      skipped.push({
        path: f.path,
        reason: err instanceof WorkspaceError ? err.message : String(err),
      });
    }
  }
  return { written, skipped };
}

export interface CodegenDeps {
  generate?: (args: {
    model: unknown;
    schema: unknown;
    messages: ModelMessage[];
  }) => Promise<{ object: unknown }>;
  modelId?: () => Promise<string>;
  gateRunner?: (
    ws: Workspace,
    spec: BuildSpec,
    config?: GateConfig,
  ) => Promise<GateResult[]>;
  /** Total generation rounds: 1 initial + (maxRounds-1) repairs. Default 3. */
  maxRounds?: number;
}

/**
 * Run one build. Throws only when generation itself is unusable (gateway
 * error, or output that does not match the file-map schema); gate failures
 * are data, returned in the outcome.
 */
export async function runBuild(
  ws: Workspace,
  spec: BuildSpec,
  deps: CodegenDeps = {},
): Promise<BuildOutcome> {
  const maxRounds = Math.max(1, Math.min(5, deps.maxRounds ?? 3));
  const gateRunner = deps.gateRunner ?? ((w, s) => runGates(w, s));
  const events: BuildEvent[] = [];
  // Build events stream to buildlog.jsonl as they happen so the status
  // endpoint can show live progress while a build is still running. The
  // write is awaited: the log must reflect stage order truthfully.
  const push = async (t: string, detail?: Record<string, unknown>) => {
    const event: BuildEvent = { t, at: Date.now(), detail };
    events.push(event);
    await ws.append("buildlog.jsonl", JSON.stringify(event) + "\n");
  };
  await ws.write("buildlog.jsonl", "");

  // Clean tree (spec.json is the resume point), then the trusted skeleton.
  await ws.clear(["spec.json"]);
  await push("clear", { keep: ["spec.json"] });
  await scaffold(ws, spec);
  await push("scaffold");

  let lastFailure: string | undefined;
  let results: GateResult[] = [];
  let roundsUsed = 0;

  for (let round = 1; round <= maxRounds; round++) {
    roundsUsed = round;
    const messages = buildCodegenMessages(spec, lastFailure);
    let map: FileMap;
    const t0 = Date.now();
    try {
      const object = deps.generate
        ? (
            await deps.generate({
              model: deps.modelId ? await deps.modelId() : "test-model",
              schema: fileMapSchema,
              messages,
            })
          ).object
        : (
            await generateObject({
              model: kimiGw(await defaultModel()),
              schema: zodSchema(fileMapSchema),
              messages,
            })
          ).object;
      const parsed = fileMapSchema.safeParse(object);
      if (!parsed.success) {
        throw new Error(
          `codegen round ${round} produced an invalid file map: ${parsed.error.issues
            .map((i) => i.path.join("."))
            .join(", ")}`,
        );
      }
      map = parsed.data;
    } catch (err) {
      throw classifyAiError(err);
    }
    await push("generate", { round, durationMs: Date.now() - t0, files: map.files.length });

    const applied = await applyFileMap(ws, map);
    await push("apply", {
      round,
      written: applied.written.length,
      skipped: applied.skipped,
    });

    results = await gateRunner(ws, spec);
    await push("gates", { round, summary: summarize(results) });
    if (results.every((r) => r.status === "pass")) {
      return {
        results,
        summary: summarize(results),
        rounds: { used: roundsUsed, repaired: roundsUsed > 1 },
        events,
      };
    }
    lastFailure = failureReport(results);
  }

  return {
    results,
    summary: summarize(results),
    rounds: { used: roundsUsed, repaired: roundsUsed > 1 },
    events,
  };
}
