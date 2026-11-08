/**
 * Mermaid diagrams, loaded on first use so the library never enters the main bundle. Renders are queued
 * because mermaid's configuration is global. Labels are plain SVG text (htmlLabels off), so a diagram
 * can be saved as SVG or drawn to PNG without foreignObject.
 */
type Mermaid = (typeof import("mermaid"))["default"];

let loader: Promise<Mermaid> | null = null;
let queue: Promise<unknown> = Promise.resolve();
let seq = 0;

export function renderMermaid(code: string, theme: "dark" | "default"): Promise<string> {
  const job = queue.then(async () => {
    const mermaid = await (loader ??= import("mermaid").then((m) => m.default));
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme,
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
