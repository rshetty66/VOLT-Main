import { useEffect, useState, type ReactElement } from "react";
import { DARK, LIGHT, type Palette } from "./palette";
import { renderMermaid } from "./mermaid";
import { staticMarkup } from "./staticMarkup";
import { datedName, downloadBlob, downloadText, svgToPng } from "../download";

/** Light-palette SVG markup for a chart, used by every download. */
export async function chartSvg(render: (p: Palette) => ReactElement): Promise<string> {
  return staticMarkup(render(LIGHT));
}

function DownloadButtons({ name, svg }: { name: string; svg: () => Promise<string> }) {
  const [busy, setBusy] = useState(false);
  const run = async (kind: "svg" | "png") => {
    setBusy(true);
    try {
      const markup = await svg();
      if (kind === "svg") downloadText(datedName(name, "svg"), markup, "image/svg+xml");
      else downloadBlob(datedName(name, "png"), await svgToPng(markup, 2));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="visual-actions">
      <button className="btn ghost sm" disabled={busy} onClick={() => run("svg")} aria-label={`Download ${name} as SVG`}>SVG</button>
      <button className="btn ghost sm" disabled={busy} onClick={() => run("png")} aria-label={`Download ${name} as PNG`}>PNG</button>
    </div>
  );
}

/** A chart on screen (dark) with SVG and PNG downloads (light). */
export function ChartFrame({ name, render }: { name: string; render: (p: Palette) => ReactElement }) {
  return (
    <figure className="visual">
      {render(DARK)}
      <DownloadButtons name={name} svg={() => chartSvg(render)} />
    </figure>
  );
}

/** A ```mermaid block from agent output, rendered as a diagram. Falls back to the source if it does not parse. */
export function MermaidDiagram({ code }: { code: string }) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    // Wait for the block to stop changing: agent output streams in, and a half-written diagram does not parse.
    const t = setTimeout(() => {
      renderMermaid(code, "dark").then(
        (s) => live && (setSvg(s), setError("")),
        (e) => live && setError(String(e?.message ?? e)),
      );
    }, 400);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [code]);

  if (error)
    return (
      <figure className="visual">
        <pre><code>{code}</code></pre>
        <figcaption className="muted" style={{ fontSize: 11 }}>Diagram could not be drawn: {error.split("\n")[0]}</figcaption>
      </figure>
    );
  return (
    <figure className="visual mermaid">
      {svg ? <div className="mermaid-svg" dangerouslySetInnerHTML={{ __html: svg }} /> : <span className="muted"><span className="spinner" /> drawing diagram</span>}
      {svg && <DownloadButtons name="diagram" svg={() => renderMermaid(code, "default")} />}
    </figure>
  );
}
