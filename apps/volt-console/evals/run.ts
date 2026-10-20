/**
 *   npm run eval                                             every workflow against the mock (free)
 *   npm run eval -- --live --workflow close-optimization     one workflow on Claude, your key
 *   npm run eval -- --live --workflow a,b --judge            and a Claude score per deliverable
 *   npm run eval -- --live --all                             all 35 on Claude (about $2 each)
 * Options: --max-usd <n> (live per-run stop, default 10), --concurrency <n>.
 * Exits non-zero when a workflow fails a must-pass check or regresses.
 */
import "../server/env.js";
import { runEvals, writeReport } from "./evals.js";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const live = flag("live");
const workflows = value("workflow")?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
if (live && !workflows.length && !flag("all")) {
  console.error("Live evals call Claude on your key (about $2 per workflow). Name workflows with --workflow a,b or pass --all.");
  process.exit(2);
}
if (live && !process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
  console.error("Live evals need ANTHROPIC_API_KEY (in .env or the environment).");
  process.exit(2);
}
if (flag("judge") && !live) console.log("--judge applies to live runs only; ignoring it.");

const report = await runEvals({
  mode: live ? "live" : "mock",
  workflows,
  judge: flag("judge") && live,
  maxUsdPerRun: Number(value("max-usd") ?? 10),
  concurrency: value("concurrency") ? Number(value("concurrency")) : undefined,
  log: (l) => console.log(l),
});
const out = writeReport(report);
console.log(`\n${report.passed} of ${report.results.length} passed.${live ? ` Estimated cost $${report.costUsd.toFixed(2)}.` : ""} Report: ${out.md}`);
if (out.regressed.length) console.log(`Regressions: ${out.regressed.join("; ")}`);
process.exit(report.failed || out.regressed.length ? 1 : 0);
