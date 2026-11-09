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
  /** Diagram boxes: plain, recommended path, and "differs from the bank" highlight. */
  box: string;
  boxLine: string;
  boxAccent: string;
  boxHighlight: string;
  highlight: string;
  font: string;
}

const font = "Inter, system-ui, -apple-system, Segoe UI, sans-serif";

export const DARK: Palette = {
  bg: "#1e293b",
  ink: "#e2e8f0",
  muted: "#94a3b8",
  grid: "rgba(255,255,255,0.12)",
  band: ["#3d6b62", "#36505e", "#3f4a5c", "#4a4152"],
  series: "#5cc8ad",
  series2: "#9db8ff",
  negative: "#f28b82",
  pass: "#5cc8ad",
  fail: "#f28b82",
  notRun: "#64748b",
  box: "#0f172a",
  boxLine: "#475569",
  boxAccent: "#1e3a33",
  boxHighlight: "#3a2b19",
  highlight: "#f0b36a",
  font,
};

export const LIGHT: Palette = {
  bg: "#ffffff",
  ink: "#1d2622",
  muted: "#5b6862",
  grid: "#d5dbd7",
  band: ["#cfe8df", "#dde7ee", "#e8e6f0", "#f3e3e1"],
  series: "#1f6b5a",
  series2: "#3a5ba0",
  negative: "#b3261e",
  pass: "#1f7a4d",
  fail: "#b3261e",
  notRun: "#8a948f",
  box: "#ffffff",
  boxLine: "#c9d1cd",
  boxAccent: "#e2efeb",
  boxHighlight: "#f8ead9",
  highlight: "#a35a12",
  font,
};
