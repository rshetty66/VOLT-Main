/**
 * Real-data sources for the Finance Workbench.
 *
 *   find     Claude's web_search finds the issuer's published financial statements (primary sources first).
 *   extract  Claude reads one filing (web_fetch for a URL, or an uploaded document) and records each
 *            residential-mortgage figure with its page and exact quote. The server keeps the fetched
 *            document, extracts page text, and verify_extraction.py checks every quote and tie (0 tokens).
 *   verify   Re-checks edited or hand-entered figures against a stored document (0 tokens).
 *
 * The web tools run on Anthropic's servers, so they work even where this host cannot reach the issuer.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { loadSkillBody } from "./catalog.js";
import { MODEL } from "./orchestrator.js";
import { FIGURE_IDS, MORTGAGE_FIGURES, standardTies, type EvidenceClass, type Figure } from "../shared/mortgageFigures.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_DIR = process.env.VOLT_PLUGIN_DIR ?? path.resolve(here, "../../../plugins/volt");
const SCRIPTS = path.join(PLUGIN_DIR, "skills", "design-finance-architecture", "scripts");
const PYTHON = process.env.VOLT_PYTHON ?? "python3";
export const MAX_SOURCE_BYTES = 32 * 1024 * 1024;
const MAX_TURNS = 6;

export class SourceError extends Error {
  constructor(public code: "not_found" | "unsupported_type" | "too_large" | "no_document" | "no_figures" | "unreadable", message: string) {
    super(message);
  }
}

export interface SourceSummary {
  /** Store id: one per document and provenance (the same bytes uploaded and fetched are two records). */
  id: string;
  /** sha256 of the document bytes. */
  sha256: string;
  title: string;
  url?: string;
  retrievedAt: string;
  evidenceClass: Exclude<EvidenceClass, "ILLUSTRATIVE_EXAMPLE">;
  kind: "pdf" | "text";
  pageCount: number;
  emptyPages: number[];
}
interface StoredSource extends SourceSummary {
  pages: { page: number; text: string }[];
}
export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  webSearches: number;
  webFetches: number;
}
export interface Candidate {
  title: string;
  url: string;
  period: string;
  publisher: string;
  primary_source: boolean;
}
export interface ExtractionMeta {
  issuer: string;
  period_end: string;
  currency: string;
  scale: Figure["scale"];
  basis: string;
  statement_reference: string;
}
export interface VerificationReport {
  status: string;
  checks: { check_id: string; status: "PASS" | "FAIL" | "NOT_RUN"; scope: string }[];
  blockers: string[];
  limitations: string[];
  run_id?: string;
  input_manifest_hash?: string;
}

const storeDir = () => process.env.VOLT_SOURCES_DIR ?? path.resolve(here, "../data/sources");
const sourceFile = (id: string) => path.join(storeDir(), `${id}.json`);

function runPython(script: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(PYTHON, ["-I", path.join(SCRIPTS, script), ...args], { timeout: 120_000, maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
      const code = err && typeof (err as { code?: unknown }).code === "number" ? (err as { code: number }).code : err ? -1 : 0;
      resolve({ code, stdout, stderr });
    });
  });
}

const summary = ({ pages: _p, ...s }: StoredSource): SourceSummary => s;

/** Stores a document with its provenance and extracts its page text. Text documents split pages on form feeds. */
export async function ingestDocument(data: Buffer, mediaType: string, meta: { title: string; url?: string; retrievedAt?: string; evidenceClass: SourceSummary["evidenceClass"] }): Promise<SourceSummary> {
  if (data.length > MAX_SOURCE_BYTES) throw new SourceError("too_large", `Documents are limited to ${MAX_SOURCE_BYTES / 1024 / 1024} MB.`);
  const sha256 = crypto.createHash("sha256").update(data).digest("hex");
  const id = crypto.createHash("sha256").update(`${sha256}|${meta.evidenceClass}|${meta.url ?? ""}`).digest("hex");
  if (fs.existsSync(sourceFile(id))) return summary(JSON.parse(fs.readFileSync(sourceFile(id), "utf8")));
  let pages: StoredSource["pages"];
  let kind: StoredSource["kind"];
  if (mediaType === "application/pdf" || data.subarray(0, 5).toString("latin1") === "%PDF-") {
    kind = "pdf";
    const tmp = path.join(os.tmpdir(), `volt-src-${id}.pdf`);
    fs.writeFileSync(tmp, data);
    try {
      const r = await runPython("pdf_pages.py", [tmp]);
      const out = JSON.parse(r.stdout || "{}");
      if (r.code !== 0) throw new SourceError("unreadable", out.detail ?? (r.stderr.trim() || "The PDF could not be read."));
      pages = out.pages;
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  } else if (/^text\/|\/csv$/.test(mediaType)) {
    kind = "text";
    pages = data.toString("utf8").split("\f").map((text, i) => ({ page: i + 1, text }));
  } else {
    throw new SourceError("unsupported_type", "Upload a PDF, text or CSV document.");
  }
  const stored: StoredSource = {
    id, sha256, title: meta.title, url: meta.url, retrievedAt: meta.retrievedAt ?? new Date().toISOString(), evidenceClass: meta.evidenceClass,
    kind, pageCount: pages.length, emptyPages: pages.filter((p) => !p.text.trim()).map((p) => p.page), pages,
  };
  fs.mkdirSync(storeDir(), { recursive: true });
  fs.writeFileSync(sourceFile(id), JSON.stringify(stored));
  return summary(stored);
}

function loadSource(id: string): StoredSource {
  if (!/^[a-f0-9]{64}$/.test(id) || !fs.existsSync(sourceFile(id))) throw new SourceError("not_found", "Unknown source document.");
  return JSON.parse(fs.readFileSync(sourceFile(id), "utf8"));
}
export const getSource = (id: string) => summary(loadSource(id));

/** Deterministic check of figures against a stored document's page text (no model call). */
export async function verifyFigures(sourceId: string, figures: Figure[]): Promise<VerificationReport> {
  const src = loadSource(sourceId);
  const doc = {
    tenant_id: "WORKBENCH",
    source: { title: src.title, url: src.url ?? null, sha256: src.sha256, retrieved_at: src.retrievedAt },
    pages: src.pages,
    figures,
    ties: standardTies(figures.map((f) => f.id)),
  };
  const tmp = path.join(os.tmpdir(), `volt-verify-${crypto.randomUUID()}.json`);
  fs.writeFileSync(tmp, JSON.stringify(doc));
  try {
    const r = await runPython("verify_extraction.py", [tmp]);
    if (r.code !== 0 && r.code !== 1) throw new Error(`verify_extraction failed: ${r.stderr || r.stdout}`.slice(0, 500));
    return JSON.parse(r.stdout);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

// ── Claude calls ─────────────────────────────────────────────────────────────

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

const WEB_SEARCH = { type: "web_search_20260209", name: "web_search", max_uses: 5 } as const;
const WEB_FETCH = { type: "web_fetch_20260209", name: "web_fetch", max_uses: 3 } as const;

const RECORD_CANDIDATES: Anthropic.Tool = {
  name: "record_candidates",
  description: "Record the financial-statement documents you found, best match first. Call once, after searching.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["candidates"],
    properties: {
      candidates: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "url", "period", "publisher", "primary_source"],
          properties: {
            title: { type: "string" },
            url: { type: "string", description: "Direct URL of the document, preferably the PDF" },
            period: { type: "string", description: "Fiscal period covered, e.g. fiscal 2025 (year ended October 31, 2025)" },
            publisher: { type: "string", description: "Site that publishes it, e.g. the issuer's investor relations site, SEDAR+ or EDGAR" },
            primary_source: { type: "boolean", description: "True only for the issuer's own site or the official filing system" },
          },
        },
      },
    },
  },
};

const RECORD_FIGURES: Anthropic.Tool = {
  name: "record_figures",
  description:
    "Record the residential-mortgage figures exactly as printed in the document. Call once. Omit any figure the document does not state; never estimate or compute one.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["meta", "figures"],
    properties: {
      meta: {
        type: "object",
        additionalProperties: false,
        required: ["issuer", "period_end", "currency", "scale", "basis", "statement_reference"],
        properties: {
          issuer: { type: "string" },
          period_end: { type: "string", description: "ISO date, e.g. 2025-10-31" },
          currency: { type: "string", description: "ISO 4217 code" },
          scale: { type: "string", enum: ["units", "thousands", "millions", "billions"] },
          basis: { type: "string", description: "Accounting basis stated in the document, e.g. IFRS" },
          statement_reference: { type: "string", description: "Note or table the figures come from" },
        },
      },
      figures: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "value", "page", "quote"],
          properties: {
            id: { type: "string", enum: FIGURE_IDS },
            value: { type: "string", description: "Plain decimal in the document's reporting units, no separators. Positive magnitude, except other_movements which is signed." },
            page: { type: "integer", description: "1-based page number of the PDF (not the printed folio)" },
            quote: { type: "string", description: "Short exact text copied from that page that contains the number, e.g. 'Residential mortgages 412,345'" },
          },
        },
      },
    },
  },
};

const FIGURE_GUIDE = MORTGAGE_FIGURES.map((f) => `- ${f.id}: ${f.label} (${f.hint})`).join("\n");

function systemPrompt(): string {
  const lookup = loadSkillBody("web-source-lookup")?.body ?? "";
  return [
    "You retrieve and transcribe published financial statements for a finance architecture workbench.",
    "Figures you record are checked by code against the document text, so copy numbers and quotes exactly; a figure you cannot see stays out.",
    "Prefer primary sources: the issuer's own investor relations site, SEDAR+ or EDGAR. Never put client names, account numbers or other engagement data in a search query or URL.",
    "",
    "Method for looking up published sources (VOLT skill web-source-lookup; your tools here are web_search and web_fetch):",
    lookup.replace(/^---[\s\S]*?---\s*/, ""),
  ].join("\n");
}

const emptyUsage = (): Usage => ({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, webSearches: 0, webFetches: 0 });

/** Runs Claude until it calls the named record tool; returns that tool input and every server-tool block seen. */
async function untilRecorded(toolName: string, tools: Anthropic.Messages.ToolUnion[], messages: Anthropic.MessageParam[], usage: Usage, signal?: AbortSignal) {
  const blocks: Anthropic.ContentBlock[] = [];
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const stream = getClient().messages.stream(
      {
        model: MODEL,
        max_tokens: 32000,
        system: [{ type: "text", text: systemPrompt(), cache_control: { type: "ephemeral" } }],
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
        tools,
        messages,
      },
      { signal },
    );
    const message = await stream.finalMessage();
    usage.inputTokens += message.usage.input_tokens;
    usage.outputTokens += message.usage.output_tokens;
    usage.cacheReadTokens += message.usage.cache_read_input_tokens ?? 0;
    usage.webSearches += message.usage.server_tool_use?.web_search_requests ?? 0;
    usage.webFetches += message.usage.server_tool_use?.web_fetch_requests ?? 0;
    blocks.push(...message.content);
    if (message.stop_reason === "refusal") throw new SourceError("no_figures", "The model declined this request.");
    const call = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === toolName);
    if (call) return { input: call.input as Record<string, unknown>, blocks };
    messages.push({ role: "assistant", content: message.content });
    if (message.stop_reason === "pause_turn") continue;
    messages.push({ role: "user", content: `Call ${toolName} now with what you found. If you found nothing, call it with an empty list.` });
  }
  throw new SourceError("no_figures", `The model did not call ${toolName}.`);
}

export async function findFilings(issuer: string, period: string, signal?: AbortSignal) {
  const usage = emptyUsage();
  const { input } = await untilRecorded(
    "record_candidates",
    [WEB_SEARCH, RECORD_CANDIDATES],
    [{ role: "user", content: `Find the published annual report or audited consolidated financial statements of ${issuer} for ${period}. Return direct document URLs, best match first, then call record_candidates.` }],
    usage,
    signal,
  );
  return { candidates: (input.candidates ?? []) as Candidate[], usage };
}

/** Extracts figures from a URL (fetched by Claude) or a stored upload, then verifies them deterministically. */
export async function extractFigures(target: { url?: string; sourceId?: string }, signal?: AbortSignal) {
  const usage = emptyUsage();
  const ask = `Record the residential mortgage figures for the most recent period end, from the loans note and the allowance for credit losses tables:\n${FIGURE_GUIDE}\nThen call record_figures.`;
  let source: SourceSummary | undefined;
  let messages: Anthropic.MessageParam[];
  if (target.sourceId) {
    const stored = loadSource(target.sourceId);
    source = summary(stored);
    const text = stored.pages.map((p) => `=== Page ${p.page} ===\n${p.text}`).join("\n\n");
    messages = [{ role: "user", content: [{ type: "document", source: { type: "text", media_type: "text/plain", data: text }, title: stored.title }, { type: "text", text: `${ask}\nPage numbers are the "=== Page n ===" markers.` }] }];
  } else if (target.url && /^https:\/\/[^\s]+$/.test(target.url)) {
    messages = [{ role: "user", content: `Fetch this document with web_fetch: ${target.url}\n${ask}` }];
  } else {
    throw new SourceError("no_document", "Give an https URL or an uploaded document.");
  }

  const tools: Anthropic.Messages.ToolUnion[] = target.sourceId ? [RECORD_FIGURES] : [WEB_FETCH, RECORD_FIGURES];
  const { input, blocks } = await untilRecorded("record_figures", tools, messages, usage, signal);

  if (!source) {
    const fetched = blocks.filter((b): b is Anthropic.WebFetchToolResultBlock => b.type === "web_fetch_tool_result").map((b) => b.content).find((c): c is Anthropic.WebFetchBlock => c.type === "web_fetch_result");
    if (!fetched) throw new SourceError("no_document", "The document could not be fetched, so its figures cannot be verified. Download it and upload it instead.");
    const src = fetched.content.source;
    const data = src.type === "base64" ? Buffer.from(src.data, "base64") : Buffer.from(src.data, "utf8");
    source = await ingestDocument(data, src.media_type, { title: fetched.content.title ?? fetched.url, url: fetched.url, retrievedAt: fetched.retrieved_at ?? undefined, evidenceClass: "PUBLIC_FILING" });
  }

  const meta = input.meta as ExtractionMeta;
  const raw = (input.figures ?? []) as { id: string; value: string; page: number; quote: string }[];
  const seen = new Set<string>();
  const figures: Figure[] = raw
    .filter((f) => FIGURE_IDS.includes(f.id) && !seen.has(f.id) && seen.add(f.id))
    .map((f) => ({
      id: f.id,
      label: MORTGAGE_FIGURES.find((m) => m.id === f.id)!.label,
      value: f.value,
      scale: meta.scale,
      currency: meta.currency,
      period: meta.period_end,
      page: f.page,
      quote: f.quote,
      evidence_class: source!.evidenceClass,
    }));
  if (!figures.length) throw new SourceError("no_figures", "No residential mortgage figures were found in this document.");
  const report = await verifyFigures(source.id, figures);
  return { source, meta, figures, report, usage };
}
