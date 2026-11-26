/**
 * Scope questions asked once at the start of each chat, before VOLT does any work, so the answer is aimed at one
 * client type, one outcome, one reporting basis and one deliverable instead of drifting across all of them.
 *
 * Each question is a short single choice with a default, so the client can accept the defaults in one click or skip
 * the step. The answers travel with every message in the chat and are added to the brief as one scope block.
 */
import { z } from "zod";

export const SCOPE_QUESTIONS = [
  {
    key: "client_type",
    label: "Client type",
    options: { bank: "Bank", insurer: "Insurer", credit_union: "Credit union", pension: "Pension fund", asset_manager: "Asset manager", other: "Other" },
    fallback: "bank",
  },
  {
    key: "use_case",
    label: "Outcome",
    options: { close: "Faster close", segment_profitability: "Segment profitability", fpa: "FP&A", ops_reports: "Ops reports", coa_design: "CoA and ledger design", advisory: "Strategy or advice" },
    fallback: "close",
  },
  {
    key: "gaap",
    label: "Reporting basis",
    options: { ifrs: "IFRS", us_gaap: "US GAAP", ifrs_us_gaap: "IFRS and US GAAP", local: "Local or statutory" },
    fallback: "ifrs",
  },
  {
    key: "deliverable",
    label: "Deliverable",
    options: { chat: "Answer in chat", html: "HTML report", pptx: "PowerPoint deck", docx: "Word document", xlsx: "Excel workbook" },
    fallback: "chat",
  },
  {
    key: "depth",
    label: "Depth",
    options: { quick: "Quick answer", standard: "Standard", deep: "Deep dive with evidence" },
    fallback: "standard",
  },
] as const;

type Q = (typeof SCOPE_QUESTIONS)[number];
export type Scope = { [K in Q["key"]]: keyof Extract<Q, { key: K }>["options"] };

const option = (q: Q) => z.enum(Object.keys(q.options) as [string, ...string[]]);
export const scopeSchema = z.object(Object.fromEntries(SCOPE_QUESTIONS.map((q) => [q.key, option(q).optional()]))).strict();

/** The default answer to every question. */
export const defaultScope = (): Scope => Object.fromEntries(SCOPE_QUESTIONS.map((q) => [q.key, q.fallback])) as Scope;

/** "Bank · Faster close · IFRS · HTML report · Standard", for the chip that shows the chat's scope. */
export function scopeLabel(scope: Partial<Scope>): string {
  return SCOPE_QUESTIONS.flatMap((q) => {
    const v = scope[q.key] as string | undefined;
    return v ? [(q.options as Record<string, string>)[v]] : [];
  }).join(" · ");
}

const DEPTH: Record<Scope["depth"], string> = {
  quick: "Keep the answer short: the direct answer and the few points that matter, no appendices.",
  standard: "Give a complete but focused answer.",
  deep: "Go deep: cite the evidence for each claim and show the working.",
};

const FILE: Partial<Record<Scope["deliverable"], string>> = { html: "an HTML report", pptx: "a PowerPoint deck", docx: "a Word document", xlsx: "an Excel workbook" };

/** The scope block added to the brief. Stay inside it; it replaces the questions it answers. */
export function scopeBrief(scope: Partial<Scope>): string {
  const lines = SCOPE_QUESTIONS.flatMap((q) => {
    const v = scope[q.key] as string | undefined;
    return v ? [`- ${q.label}: ${(q.options as Record<string, string>)[v]}`] : [];
  });
  if (!lines.length) return "";
  const depth = scope.depth ? ` ${DEPTH[scope.depth]}` : "";
  const file = scope.deliverable && FILE[scope.deliverable] ? ` When the message asks for work, deliver the result as ${FILE[scope.deliverable]} made with create_file.` : "";
  return `## Scope the client set for this chat\n${lines.join("\n")}\nKeep the work inside this scope and do not ask again for anything it answers. If the request clearly falls outside it, say so in one line and go on with the request. The scope is context, not the task: a direct question or a lookup gets a direct answer to what it asks, never a deliverable on the outcome above.${depth}${file}`;
}
