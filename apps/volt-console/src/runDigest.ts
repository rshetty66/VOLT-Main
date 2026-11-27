/**
 * Short key points cut from text VOLT already wrote (the answer, a specialist's section), so the run view can show
 * bullets instead of long prose without a model call. Bullet items come first; prose falls back to its first sentences.
 */

const MAX_POINT = 140;

/** Strips inline Markdown (bold, italics, code, links) so a point reads as plain text. */
export function plain(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(^|\W)[*_](\S[^*_]*?)[*_](?=\W|$)/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    // Source keys and evidence tags read as noise in a short point; the full answer shows them as chips.
    .replace(/\s*\[(S\d{2,3}|INFERENCE|ASSUMPTION|ESTIMATE|SINGLE SOURCE)\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function clip(text: string): string {
  return text.length > MAX_POINT ? `${text.slice(0, MAX_POINT - 1).trimEnd()}…` : text;
}

/** Up to `max` key points from Markdown: its bullet items, or else the first sentences of its paragraphs. */
export function keyPoints(markdown: string, max = 4): string[] {
  const bullets: string[] = [];
  const prose: string[] = [];
  let inCode = false;
  for (const raw of markdown.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("```")) {
      inCode = !inCode;
      continue;
    }
    if (inCode || !line || line.startsWith("#") || line.startsWith("|") || line.startsWith(">") || /^[-*_]{3,}$/.test(line)) continue;
    const item = /^(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (item) {
      const t = plain(item[1]);
      // A bullet that is only a label ("Scope:") says nothing on its own.
      if (t.length > 3 && !/:$/.test(t)) bullets.push(t);
    } else {
      prose.push(plain(line));
    }
  }
  if (bullets.length >= 2) return bullets.slice(0, max).map(clip);
  const sentences = prose
    .join(" ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
  return [...bullets, ...sentences].slice(0, max).map(clip);
}

/** Answers up to this long show in full on the Summary tab; longer ones show key points and open in a panel. */
export const SHORT_ANSWER = 1200;
