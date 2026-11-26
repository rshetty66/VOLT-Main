/**
 * How a message is classified before any work starts. The server routes on it (server/deliverable.ts) and the console
 * uses the same rule to skip the intake questions for a lookup or a quick ask.
 */

/**
 * A quick ask: a file or a calculation from figures the user gives ("Build a value case in Excel: 140 FTEs ..."). Rudra
 * answers it alone with the analytics tools and create_file, in one to three minutes, instead of briefing a bench of
 * specialists and writing a full deliverable. Asks for an assessment, strategy, roadmap or design keep the full path.
 */
export function quickAsk(prompt: string): boolean {
  const p = prompt.trim();
  if (!p || p.startsWith("/") || p.length > 300) return false;
  const fileOrCalc = /\b(excel|xlsx|spreadsheet|workbook|csv|pptx|powerpoint|deck|slides?|word|docx|pdf|file|value case|npv|irr|payback|calculate|compute|financial model)\b/i.test(p);
  const study = /\b(assess\w*|diagnos\w*|roadmap|strategy|target operating|operating model|architecture|options|recommend\w*|readiness|transform\w*)\b/i.test(p);
  return fileOrCalc && !study;
}

const LOOKUP = /(^|[\n.;:,?!]\s*)(please\s+|can you\s+|could you\s+)?(list|show|find|which|what|when|where|who|how many|how much|give me|tell me|cite|extract|look up|is there|are there)\b/i;
const STUDY = /\b(assess\w*|diagnos\w*|roadmap|strategy|target operating|operating model|architecture|options|recommend\w*|readiness|transform\w*|business case|plan for|improve|reduce|cut|should (we|i)|how (do|can|should) we|best way)\b/i;

/**
 * A direct question: a lookup, a list or a fact ("list the quarterly results documents on the TD page I added, with
 * their dates"). Rudra answers it alone, in chat, from the knowledge base and tools, without the specialist bench, the
 * deliverable sections or the partner rewrite. Asks for advice, a plan or a design keep the full path.
 */
export function directAsk(prompt: string): boolean {
  const p = prompt.trim();
  if (!p || p.startsWith("/") || p.length > 400) return false;
  return LOOKUP.test(p) && !STUDY.test(p) && !quickAsk(p);
}
