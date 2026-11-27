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
  /** Rises in a waterfall or a KPI that moved the right way. */
  positive: string;
  /** Text for falls and misses: the negative colour, adjusted to pass 4.5:1 on the background. */
  negInk: string;
  /** A KPI tile's background. */
  tile: string;
  /** Categorical colours for stacked bars, donut slices and extra series. */
  cats: string[];
  font: string;
}

const font = "Inter, system-ui, -apple-system, Segoe UI, sans-serif";

/** Brand colours (shared/brand.ts): quartile bands run from cyan (top) through indigo and gold to orange (bottom). */
export const DARK: Palette = {
  bg: "#000000",
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
  positive: "#2fd49a",
  negInk: "#ff8a65",
  tile: "#0d1017",
  cats: ["#00e5ff", "#d4af37", "#ff5722", "#8c9eff", "#2fd49a", "#a9b1c7"],
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
  series2: "#0097a7",
  negative: "#ff5722",
  pass: "#0097a7",
  fail: "#ff5722",
  notRun: "#8a90a5",
  positive: "#13895f",
  negInk: "#c2410c",
  tile: "#f5f6fa",
  cats: ["#1a1e2e", "#0097a7", "#a8841c", "#e64a19", "#5c6bc0", "#6b7280"],
  font,
};

/** The palette for charts drawn on screen: follows the console's theme (light or dark). Downloads always use LIGHT. */
export function screenPalette(): Palette {
  return typeof document !== "undefined" && document.documentElement.dataset.theme === "light" ? LIGHT : DARK;
}
