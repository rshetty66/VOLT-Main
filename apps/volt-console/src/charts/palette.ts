/**
 * Chart colours. "dark" matches the console (styles.css tokens); "light" is used for every download, so a
 * chart pasted into a Word page or a slide reads on white. Literal values, because a downloaded SVG cannot
 * resolve the console's CSS variables.
 */
export interface Palette {
  bg: string;
  ink: string;
  muted: string;
  grid: string;
  band: [string, string, string, string];
  series: string;
  series2: string;
  negative: string;
  pass: string;
  fail: string;
  notRun: string;
  font: string;
}

const font = "Inter, system-ui, -apple-system, Segoe UI, sans-serif";

/** Brand colours (shared/brand.ts): quartile bands run from cyan (top) through indigo and gold to orange (bottom). */
export const DARK: Palette = {
  bg: "#1a1e2e",
  ink: "#e6eaf2",
  muted: "#a9b1c7",
  grid: "rgba(255,255,255,0.12)",
  band: ["#0a4b57", "#2a3250", "#554a1d", "#6a2a14"],
  series: "#00e5ff",
  series2: "#d4af37",
  negative: "#ff5722",
  pass: "#00e5ff",
  fail: "#ff5722",
  notRun: "#6c7694",
  font,
};

/** For downloads: dark indigo, gold and orange read on white; cyan is used as its darker shade for contrast. */
export const LIGHT: Palette = {
  bg: "#ffffff",
  ink: "#1a1e2e",
  muted: "#5a6278",
  grid: "#d9dce6",
  band: ["#c9f4fb", "#e4e7f1", "#f4ead0", "#fdd9cb"],
  series: "#1a1e2e",
  series2: "#d4af37",
  negative: "#ff5722",
  pass: "#0097a7",
  fail: "#ff5722",
  notRun: "#8a90a5",
  font,
};
