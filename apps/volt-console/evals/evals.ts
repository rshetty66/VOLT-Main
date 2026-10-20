/**
 * Golden-prompt evals: one fixed request per VOLT workflow (golden.json), run
 * through the same code as the console (startRun, recorder, costs) on a
 * throwaway in-memory database, then scored.
 *
 * - mock (default): a stand-in Messages API; checks every workflow's plumbing.
 * - live: real Claude calls on your key; checks the deliverables too.
 * - judge (live only): Claude scores each deliverable against a rubric, 1 to 5.
 *
 * Results go to evals/results/ and are compared with the previous run of the same mode.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StoredRun } from "../shared/records.js";
import type { Catalog } from "../server/catalog.js";

export interface GoldenCase {
  workflowId: string;
  prompt: string;
  intake: Record<string, string>;
  /** Terms a live deliverable should mention (case-insensitive substrings). */
  mustMention: string[];
}

export interface Check {
  name: string;
  /** "must" checks decide pass or fail; "should" checks are reported. */
  level: "must" | "should";
  pass: boolean | null;
  detail: string;
}

export interface JudgeScore {
  relevance: number;
  specificity: number;
  consistency: number;
  actionability: number;
  average: number;
  notes: string;
  costUsd: number;
}

export interface CaseResult {
  workflowId: string;
  name: string;
  pass: boolean;
  checks: Check[];
  costUsd: number;
  tokens: { input: number; cacheWrite: number; cacheRead: number; output: number };
  seconds: number;
  runStatus: string;
  judge?: JudgeScore;
}

export interface EvalReport {
  mode: "mock" | "live";
  startedAt: string;
  model: string;
  results: CaseResult[];
  passed: number;
  failed: number;
  costUsd: number;
}

const here = path.dirname(fileURLToPath(import.meta.url));
export const GOLDEN_FILE = path.join(here, "golden.json");
export const RESULTS_DIR = path.join(here, "results");

export function loadGolden(file = GOLDEN_FILE): GoldenCase[] {
  return (JSON.parse(fs.readFileSync(file, "utf8")) as { cases: GoldenCase[] }).cases;
}

const words = (s: string) => (s.match(/\S+/g) ?? []).length;

/** Fixed checks on a finished run. */
export function scoreRun(run: StoredRun, golden: GoldenCase, catalog: Catalog, mode: "mock" | "live"): Check[] {
  const wf = catalog.workflowById.get(golden.workflowId)!;
  const expected = wf.phases.flatMap((p, i) => p.agents.map((a) => `${wf.id}:${i}:${a}`));
  const ended = new Set(run.events.filter((e) => e.type === "agent_end" && e.ok).map((e) => (e as { lane: string }).lane));
  const missing = expected.filter((lane) => !ended.has(lane));
  const outputs = new Map<string, string>();
  for (const e of run.events) if (e.type === "text_delta" && e.lane !== "rudra") outputs.set(e.lane, (outputs.get(e.lane) ?? "") + e.text);
  const final = run.finalText;
  const all = `${final}\n${[...outputs.values()].join("\n")}`;
  const minWords = mode === "live" ? 600 : 40;
  const sections: [string, RegExp][] = [
    ["executive summary", /executive summary/i],
    ["recommendations table", /recommendation[\s\S]*?\n\|[^\n]*\|\n\|\s*:?-{3,}/i],
    ["risks", /\brisks?\b/i],
    ["next steps", /next steps?/i],
  ];
  const missingSections = sections.filter(([, re]) => !re.test(final)).map(([n]) => n);
  const withHandoff = [...outputs.values()].filter((t) => /#{1,6}\s*Handoff summary/i.test(t)).length;
  const absent = golden.mustMention.filter((t) => !final.toLowerCase().includes(t.toLowerCase()));
  const stepLimits = run.events.filter((e) => e.type === "status" && /step limit/i.test(e.text)).length;
  const errors = run.events.filter((e) => e.type === "error").map((e) => (e as { message: string }).message);
  return [
    { name: "finished", level: "must", pass: run.status === "done", detail: run.status === "done" ? "done" : `${run.status}${run.error ? `: ${run.error}` : ""}` },
    { name: "every specialist finished", level: "must", pass: missing.length === 0, detail: missing.length ? `missing: ${missing.map((l) => l.split(":")[2]).join(", ")}` : `${expected.length} of ${expected.length}` },
    { name: "deliverable written", level: "must", pass: words(final) >= minWords, detail: `${words(final)} words (at least ${minWords})` },
    { name: "deliverable sections", level: "must", pass: missingSections.length === 0, detail: missingSections.length ? `missing: ${missingSections.join(", ")}` : "summary, recommendations table, risks, next steps" },
    { name: "no broken output", level: "must", pass: !/\bundefined\b|\bNaN\b|\[object Object\]/.test(all), detail: /\bundefined\b|\bNaN\b|\[object Object\]/.test(all) ? "found 'undefined', 'NaN' or '[object Object]'" : "clean" },
    { name: "no errors", level: "must", pass: errors.length === 0, detail: errors.length ? errors.slice(0, 2).join(" | ") : "none" },
    { name: "handoff summaries", level: "should", pass: outputs.size === 0 ? null : withHandoff / outputs.size >= 0.8, detail: `${withHandoff} of ${outputs.size} specialists` },
    { name: "mentions the essentials", level: "should", pass: mode === "live" ? absent.length === 0 : null, detail: mode === "live" ? (absent.length ? `missing: ${absent.join(", ")}` : golden.mustMention.join(", ")) : "live runs only" },
    { name: "no step-limit stops", level: "should", pass: stepLimits === 0, detail: `${stepLimits}` },
  ];
}

const RUBRIC = `You are reviewing a consulting deliverable produced by an AI agent team for the client request below.
Score it from 1 (poor) to 5 (excellent) on each criterion:
- relevance: answers the request and intake as asked, for this client.
- specificity: concrete figures, systems, owners and dates rather than generic advice; states assumptions instead of inventing client facts.
- consistency: no contradictions between sections; figures agree with each other.
- actionability: a leader could act on the recommendations and next steps.
Reply with JSON only: {"relevance":n,"specificity":n,"consistency":n,"actionability":n,"notes":"one sentence on the biggest weakness"}`;

/** Live only: Claude scores a deliverable against the rubric. */
export async function judge(run: StoredRun, golden: GoldenCase, model: string, prices: Record<string, import("../shared/records.js").Price>): Promise<JudgeScore> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const { callCost } = await import("../server/cost.js");
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  const client = new Anthropic(workspace ? { defaultHeaders: { "anthropic-workspace-id": workspace } } : {});
  const intake = Object.entries(golden.intake).map(([k, v]) => `- ${k}: ${v}`).join("\n");
  const msg = await client.messages.create({
    model,
    max_tokens: 600,
    system: RUBRIC,
    messages: [{ role: "user", content: `<request>\n${golden.prompt}\n\nIntake:\n${intake}\n</request>\n\n<deliverable>\n${run.finalText.slice(0, 60_000)}\n</deliverable>` }],
  });
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const j = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  const s = [j.relevance, j.specificity, j.consistency, j.actionability].map(Number);
  return {
    relevance: s[0],
    specificity: s[1],
    consistency: s[2],
    actionability: s[3],
    average: Math.round((s.reduce((a, b) => a + b, 0) / 4) * 100) / 100,
    notes: String(j.notes ?? ""),
    costUsd: callCost(prices, msg.model, { inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens, cacheReadTokens: msg.usage.cache_read_input_tokens ?? 0, cacheWriteTokens: msg.usage.cache_creation_input_tokens ?? 0 }),
  };
}

export interface EvalOptions {
  mode: "mock" | "live";
  /** Workflow ids to run; all when empty. */
  workflows?: string[];
  judge?: boolean;
  judgeModel?: string;
  /** Live: a run stops at this estimated cost. */
  maxUsdPerRun?: number;
  /** Runs at a time. */
  concurrency?: number;
  log?: (line: string) => void;
}

/** Runs the evals and returns the report (it does not write files; see writeReport). */
export async function runEvals(opts: EvalOptions): Promise<EvalReport> {
  const log = opts.log ?? (() => {});
  let mock: Awaited<ReturnType<typeof import("./mock.js").startEvalMock>> | null = null;
  if (opts.mode === "mock") {
    mock = await (await import("./mock.js")).startEvalMock();
    process.env.ANTHROPIC_API_KEY ||= "mock-key";
    process.env.ANTHROPIC_BASE_URL = mock.url;
  }
  const { loadCatalog } = await import("../server/catalog.js");
  const { openDb } = await import("../server/db.js");
  const { startRun } = await import("../server/runs.js");
  const { getRun } = await import("../server/store.js");
  const { createUser } = await import("../server/auth.js");
  const { updateSettings, getSettings } = await import("../server/settings.js");
  const { MODEL } = await import("../server/orchestrator.js");
  const catalog = loadCatalog();
  const golden = loadGolden();
  const missingGolden = catalog.workflows.filter((w) => !golden.some((g) => g.workflowId === w.id)).map((w) => w.id);
  if (missingGolden.length) throw new Error(`No golden prompt for: ${missingGolden.join(", ")}. Add them to evals/golden.json.`);
  const cases = golden.filter((g) => !opts.workflows?.length || opts.workflows.includes(g.workflowId));
  if (!cases.length) throw new Error(`No golden prompt matches ${opts.workflows?.join(", ")}.`);

  const db = await openDb();
  const user = await createUser(db, { email: "evals@volt.local", name: "Evals", role: "admin", password: "evals-only-not-a-login" });
  await updateSettings(db, { runBudgetUsd: opts.maxUsdPerRun ?? 10, monthlyBudgetUsd: 0 }, user.id);
  const settings = await getSettings(db);
  const startedAt = new Date().toISOString();
  const results: CaseResult[] = [];
  const queue = [...cases];
  const worker = async () => {
    for (let g = queue.shift(); g; g = queue.shift()) {
      const t0 = Date.now();
      const handle = await startRun({ db, catalog, mode: "live", userId: user.id }, { prompt: g.prompt, workflowId: g.workflowId, intake: g.intake }, () => {});
      await handle.finished;
      const run = (await getRun(db, handle.runId))!;
      const checks = scoreRun(run, g, catalog, opts.mode);
      const result: CaseResult = {
        workflowId: g.workflowId,
        name: catalog.workflowById.get(g.workflowId)!.name,
        pass: checks.filter((c) => c.level === "must").every((c) => c.pass),
        checks,
        costUsd: run.costUsd,
        tokens: { input: run.inputTokens, cacheWrite: run.cacheWriteTokens, cacheRead: run.cacheReadTokens, output: run.outputTokens },
        seconds: Math.round((Date.now() - t0) / 100) / 10,
        runStatus: run.status,
      };
      if (opts.judge && opts.mode === "live" && run.finalText) {
        try {
          result.judge = await judge(run, g, opts.judgeModel ?? process.env.VOLT_JUDGE_MODEL ?? "claude-sonnet-5-5", settings.prices);
        } catch (err) {
          log(`  judge failed for ${g.workflowId}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      results.push(result);
      const failed = checks.filter((c) => c.pass === false);
      log(`${result.pass ? "PASS" : "FAIL"}  ${g.workflowId.padEnd(36)} ${result.seconds}s${opts.mode === "live" ? `  $${result.costUsd.toFixed(3)}` : ""}${result.judge ? `  judge ${result.judge.average}` : ""}${failed.length ? `  (${failed.map((c) => `${c.name}: ${c.detail}`).join("; ")})` : ""}`);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, opts.concurrency ?? (opts.mode === "mock" ? 6 : 2)) }, worker));
  await db.close();
  mock?.close();
  results.sort((a, b) => cases.findIndex((c) => c.workflowId === a.workflowId) - cases.findIndex((c) => c.workflowId === b.workflowId));
  const passed = results.filter((r) => r.pass).length;
  return {
    mode: opts.mode,
    startedAt,
    model: MODEL,
    results,
    passed,
    failed: results.length - passed,
    costUsd: Math.round(results.reduce((s, r) => s + r.costUsd + (r.judge?.costUsd ?? 0), 0) * 1000) / 1000,
  };
}

/** The most recent earlier report of the same mode, to compare against. */
export function previousReport(mode: "mock" | "live", dir = RESULTS_DIR): EvalReport | null {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(`-${mode}.json`)).sort();
  return files.length ? (JSON.parse(fs.readFileSync(path.join(dir, files.at(-1)!), "utf8")) as EvalReport) : null;
}

/** Workflows that passed before and fail now, or whose judge average fell by more than 0.5. */
export function regressions(now: EvalReport, before: EvalReport | null): string[] {
  if (!before) return [];
  const out: string[] = [];
  for (const r of now.results) {
    const b = before.results.find((x) => x.workflowId === r.workflowId);
    if (!b) continue;
    if (b.pass && !r.pass) out.push(`${r.workflowId}: passed before, fails now`);
    if (b.judge && r.judge && r.judge.average < b.judge.average - 0.5) out.push(`${r.workflowId}: judge ${b.judge.average} -> ${r.judge.average}`);
  }
  return out;
}

export function reportMarkdown(r: EvalReport, regressed: string[]): string {
  const lines = [
    `# VOLT workflow evals: ${r.mode}`,
    "",
    `${r.startedAt.slice(0, 16).replace("T", " ")} UTC, model ${r.model}. ${r.passed} of ${r.results.length} passed.${r.mode === "live" ? ` Estimated cost $${r.costUsd.toFixed(2)}.` : " Mock run: no Claude calls, no cost."}`,
    "",
    regressed.length ? `**Regressions since the previous ${r.mode} run:** ${regressed.join("; ")}` : `No regressions against the previous ${r.mode} run.`,
    "",
    "| Workflow | Result | Seconds | Cost | Judge | Checks not passed |",
    "|---|---|---|---|---|---|",
    ...r.results.map(
      (x) =>
        `| ${x.name} | ${x.pass ? "pass" : "FAIL"} | ${x.seconds} | ${r.mode === "live" ? `$${x.costUsd.toFixed(3)}` : "-"} | ${x.judge ? `${x.judge.average} (${x.judge.notes.replace(/\|/g, "/")})` : "-"} | ${x.checks.filter((c) => c.pass === false).map((c) => `${c.name} (${c.level}): ${c.detail}`).join("; ").replace(/\|/g, "/") || "-"} |`,
    ),
  ];
  return lines.join("\n") + "\n";
}

export function writeReport(r: EvalReport, dir = RESULTS_DIR): { json: string; md: string; regressed: string[] } {
  const regressed = regressions(r, previousReport(r.mode, dir));
  fs.mkdirSync(dir, { recursive: true });
  const stem = path.join(dir, `${r.startedAt.replace(/[:.]/g, "-").slice(0, 19)}-${r.mode}`);
  fs.writeFileSync(`${stem}.json`, JSON.stringify(r, null, 2));
  fs.writeFileSync(`${stem}.md`, reportMarkdown(r, regressed));
  return { json: `${stem}.json`, md: `${stem}.md`, regressed };
}
