/**
 * Inline citations in a chat answer. The agents cite by source key ("[S02][S03]") and tag unsupported claims
 * ("[INFERENCE]"); raw, those read as noise. Before rendering, each key becomes a link to "#cite-S02" and each tag a
 * link to "#tag-INFERENCE", which the Markdown view draws as small source chips and tag badges. Fenced and inline code
 * is left alone, so chart JSON and code samples keep their brackets. Downloads use the raw text, not this.
 */
export const CITE_HREF = "#cite-";
export const TAG_HREF = "#tag-";

const TAGS = ["INFERENCE", "ASSUMPTION", "ESTIMATE", "SINGLE SOURCE"];
// A key or a tag in square brackets, not already a link's text ("[S02](...)") and not a reference ("[S02]: ...").
const TOKEN = new RegExp(`\\[(S\\d{2,3}|${TAGS.join("|")})\\](?![(:])`, "g");

export function linkCitations(markdown: string): string {
  // Split on fenced blocks and inline code; only the even parts are prose.
  return markdown
    .split(/(```[\s\S]*?(?:```|$)|`[^`\n]*`)/g)
    .map((part, i) => (i % 2 ? part : part.replace(TOKEN, (_m, t: string) => (t[0] === "S" && /^S\d/.test(t) ? `[${t}](${CITE_HREF}${t})` : `[${t.toLowerCase()}](${TAG_HREF}${t.replace(" ", "-")})`))))
    .join("");
}
