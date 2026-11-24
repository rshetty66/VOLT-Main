/**
 * Mermaid diagrams, loaded on first use so the library never enters the main bundle. Renders are queued
 * because mermaid's configuration is global. Labels are plain SVG text (htmlLabels off), so a diagram
 * can be saved as SVG or drawn to PNG without foreignObject.
 */
type Mermaid = (typeof import("mermaid"))["default"];

/** Diagram colours from the brand board, for the console (dark) and for downloads (default, on white). */
export const BRAND_THEME = {
  dark: {
    background: "#1a1e2e", primaryColor: "#262c44", primaryTextColor: "#e6eaf2", primaryBorderColor: "#00e5ff", lineColor: "#00e5ff",
    secondaryColor: "#2a3250", tertiaryColor: "#0a0d14", noteBkgColor: "#554a1d", noteTextColor: "#e6eaf2", textColor: "#e6eaf2",
    pie1: "#d4af37", pie2: "#00e5ff", pie3: "#ff5722", pie4: "#6c7694", pie5: "#3a4262", pie6: "#a9b1c7",
    quadrant1Fill: "#0a4b57", quadrant2Fill: "#554a1d", quadrant3Fill: "#2a3250", quadrant4Fill: "#6a2a14",
    taskBkgColor: "#2a3250", taskBorderColor: "#00e5ff", activeTaskBkgColor: "#d4af37", activeTaskBorderColor: "#d4af37", doneTaskBkgColor: "#0a4b57", critBkgColor: "#ff5722", critBorderColor: "#ff5722",
  },
  default: {
    background: "#ffffff", primaryColor: "#e4e7f1", primaryTextColor: "#1a1e2e", primaryBorderColor: "#1a1e2e", lineColor: "#1a1e2e",
    secondaryColor: "#f4ead0", tertiaryColor: "#c9f4fb", noteBkgColor: "#f4ead0", noteTextColor: "#1a1e2e", textColor: "#1a1e2e",
    pie1: "#1a1e2e", pie2: "#d4af37", pie3: "#ff5722", pie4: "#0097a7", pie5: "#5a6278", pie6: "#8a90a5",
    quadrant1Fill: "#c9f4fb", quadrant2Fill: "#f4ead0", quadrant3Fill: "#e4e7f1", quadrant4Fill: "#fdd9cb",
    taskBkgColor: "#e4e7f1", taskBorderColor: "#1a1e2e", activeTaskBkgColor: "#d4af37", activeTaskBorderColor: "#1a1e2e", doneTaskBkgColor: "#c9f4fb", critBkgColor: "#ff5722", critBorderColor: "#ff5722",
  },
} as const;

let loader: Promise<Mermaid> | null = null;
let queue: Promise<unknown> = Promise.resolve();
let seq = 0;

export function renderMermaid(code: string, theme: "dark" | "default"): Promise<string> {
  const job = queue.then(async () => {
    const mermaid = await (loader ??= import("mermaid").then((m) => m.default));
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      themeVariables: BRAND_THEME[theme],
      htmlLabels: false,
      flowchart: { htmlLabels: false },
      fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif",
    });
    // parse() first: render() leaves an error graphic in the page when the source is incomplete or invalid.
    if (!(await mermaid.parse(code, { suppressErrors: true }))) throw new Error("not a valid Mermaid diagram");
    const { svg } = await mermaid.render(`volt-mermaid-${++seq}`, code);
    return svg;
  });
  queue = job.catch(() => undefined);
  return job;
}
