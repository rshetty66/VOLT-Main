/** The builder/reviewer loop: an independent reviewer checks a draft, and hands back gaps, at most MAX_HANDBACKS times. */
export const MAX_HANDBACKS = 3;

/** True when the user asks for the independent review in words ("have it reviewed", "independent review"). */
export function wantsReviewInText(prompt: string): boolean {
  return /\b(independent(ly)? review(ed)?|have (it|this|that) reviewed|review (it|this|that) (before|independently)|second opinion|reviewer pass)\b/i.test(prompt);
}

export interface Verdict {
  pass: boolean;
  gaps: string[];
}

/**
 * Reads the reviewer's reply: a first line "PASS" or "REVISE", then one "- gap" line per problem.
 * An unreadable reply counts as a pass, so a broken reviewer never traps the run in a loop.
 */
export function parseVerdict(text: string): Verdict {
  const t = text.trim();
  const gaps = t.split("\n").filter((l) => /^\s*[-*]\s+\S/.test(l)).map((l) => l.replace(/^\s*[-*]\s+/, "").trim().slice(0, 400)).slice(0, 8);
  if (/^\W*REVISE\b/i.test(t) && gaps.length) return { pass: false, gaps };
  return { pass: true, gaps: [] };
}

export const REVIEWER_PROMPT = `You are an independent reviewer. You did not write this draft and you have no loyalty to it. You see only the request and the draft.
Check the draft against what was asked: does it answer every part, are the numbers internally consistent, is any claim unsupported or invented, does anything contradict the request.
Reply with PASS on the first line if it is ready for the client. Otherwise reply with REVISE on the first line, then up to 6 lines, each starting "- ", each naming one specific, fixable problem. No praise, no rewriting, no other text.`;
