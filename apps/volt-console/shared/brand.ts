/**
 * The VOLT brand board: one palette for the app, the charts and every download (hex without "#").
 * Hex codes as printed on the board. Rudra's Fire Orange is blurry in the photos but reads #FF5722, and the swatch agrees (its green
 * channel measures about 85; #FF5722 has 87, where #FF9722 would be 151).
 */
export const BRAND = {
  obsidian: "0A0D14", // Cosmic Obsidian: page background
  indigo: "1A1E2E", // Deep Space Indigo: surfaces, headings, table headers
  cyan: "00E5FF", // Electric Cyber Blue: primary accent, "good"
  gold: "D4AF37", // Copper Gold: the "medium" signal; never a rule or headline colour
  orange: "FF5722", // Rudra's Fire Orange: the "high" signal only; the identity is cyan on indigo, not orange and amber
  /** The background of the logo image itself (the board photo renders Obsidian as this slate); covers use it so the logo has no visible box. */
  cover: "1E252C",
  tagline: "Vision · Orchestrate · Launch · Transform",
} as const;

/** The colour code for priority, risk and status words in tables: orange needs attention, gold is middling, cyan is good. */
export type Tone = "high" | "mid" | "low";

export const TONE_STYLE: Record<Tone, { fill: string; ink: string }> = {
  high: { fill: BRAND.orange, ink: "FFFFFF" },
  mid: { fill: BRAND.gold, ink: BRAND.indigo },
  low: { fill: BRAND.cyan, ink: BRAND.indigo },
};

const TONE_COLUMNS = /priority|risk|severity|likelihood|impact|status|rating|rag|criticality|quartile|position|readiness|maturity level/i;
const TONE_WORDS: Record<string, Tone> = {
  high: "high", critical: "high", severe: "high", "very high": "high", red: "high", blocked: "high", "off track": "high", failed: "high", fail: "high", "bottom quartile": "high", "4th quartile": "high",
  medium: "mid", moderate: "mid", amber: "mid", yellow: "mid", "at risk": "mid", partial: "mid", "third quartile": "mid", "3rd quartile": "mid", "second quartile": "mid", "2nd quartile": "mid",
  low: "low", minor: "low", green: "low", "on track": "low", complete: "low", completed: "low", done: "low", pass: "low", passed: "low", "top quartile": "low", "1st quartile": "low",
};

/** The tone of a table cell, or null. Only columns that are about priority, risk or status are colour coded. */
export function toneFor(column: string, value: string): Tone | null {
  if (!TONE_COLUMNS.test(column)) return null;
  return TONE_WORDS[value.trim().toLowerCase().replace(/[*_`]/g, "")] ?? null;
}
