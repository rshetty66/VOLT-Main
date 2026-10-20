/**
 * Structured logs. One JSON object per line in production (VOLT_LOG_FORMAT=json, the default
 * when NODE_ENV=production), readable lines otherwise. Each entry carries what identifies it:
 * reqId for an API request, runId for a run. Never log prompts, file contents, keys or passwords.
 */
type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
type Fields = Record<string, unknown>;

const json = () => (process.env.VOLT_LOG_FORMAT ?? (process.env.NODE_ENV === "production" ? "json" : "pretty")) === "json";
const min = () => ORDER[(process.env.VOLT_LOG_LEVEL as Level) ?? "info"] ?? ORDER.info;

function fieldValue(v: unknown): unknown {
  if (v instanceof Error) return { name: v.name, message: v.message };
  return v;
}

function write(level: Level, msg: string, fields: Fields = {}) {
  if (ORDER[level] < min() || process.env.VOLT_LOG_LEVEL === "silent") return;
  const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined).map(([k, v]) => [k, fieldValue(v)]));
  const out = level === "error" || level === "warn" ? process.stderr : process.stdout;
  if (json()) {
    out.write(`${JSON.stringify({ time: new Date().toISOString(), level, msg, ...clean })}\n`);
  } else {
    const extra = Object.entries(clean).map(([k, v]) => `${k}=${typeof v === "string" ? (/\s/.test(v) ? JSON.stringify(v) : v) : JSON.stringify(v)}`).join(" ");
    out.write(`${new Date().toTimeString().slice(0, 8)} ${level === "info" ? "" : `${level.toUpperCase()} `}${msg}${extra ? `  ${extra}` : ""}\n`);
  }
}

export const log = {
  debug: (msg: string, fields?: Fields) => write("debug", msg, fields),
  info: (msg: string, fields?: Fields) => write("info", msg, fields),
  warn: (msg: string, fields?: Fields) => write("warn", msg, fields),
  error: (msg: string, fields?: Fields) => write("error", msg, fields),
};
