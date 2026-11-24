import { useEffect, useLayoutEffect, useRef, useState, type ReactElement } from "react";
import { DARK, LIGHT, type Palette } from "./palette";
import { renderMermaid } from "./mermaid";
import { parseArchSpec, parseChartSpec } from "../../shared/viz";
import { archSvg } from "./specArch";
import { specSvg } from "./specChart";
import { datedName, downloadBlob, downloadText, svgToPng } from "../download";
import { chartGif } from "./gif";

/** Light-palette SVG markup for a chart, used by every download. */
export async function chartSvg(render: (p: Palette) => ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  return renderToStaticMarkup(render(LIGHT));
}

export function DownloadButtons({ name, svg, gif }: { name: string; svg: () => Promise<string>; gif?: () => Promise<Blob> }) {
  const [busy, setBusy] = useState(false);
  const run = async (kind: "svg" | "png" | "gif") => {
    setBusy(true);
    try {
      if (kind === "gif" && gif) return downloadBlob(datedName(name, "gif"), await gif());
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
      {gif && <button className="btn ghost sm" disabled={busy} onClick={() => run("gif")} aria-label={`Download ${name} as an animated GIF`} title="Animated, for slides and email">GIF</button>}
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

/** Length of a chart's entrance: one authored moment, within Impeccable's 500 to 800 ms for a focal entrance. */
const ENTRANCE_MS = 800;

/**
 * Plays a chart's entrance once, the first time it is drawn: returns the progress (0 to 1) to draw at. The chart is
 * fully drawn by default and on any interruption, so it never stays hidden; with reduced motion it only fades (CSS).
 */
function useEntrance(key: string | null): number {
  const [t, setT] = useState(1);
  const played = useRef(false);
  useLayoutEffect(() => {
    if (!key || played.current) return;
    played.current = true;
    if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const x = Math.min(1, (now - start) / ENTRANCE_MS);
      setT(x);
      if (x < 1) raf = requestAnimationFrame(step);
    };
    setT(0);
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      played.current = false;
      setT(1);
    };
  }, [key]);
  return t;
}

/** A ```chart block from agent output: a data chart drawn from its JSON. Shows the source until the JSON is complete. */
export function SpecChart({ code }: { code: string }) {
  const [spec, setSpec] = useState(() => parseChartSpec(code));
  const [waited, setWaited] = useState(false);
  const t = useEntrance(spec ? spec.title + spec.type : null);
  useEffect(() => {
    // Agent output streams in: wait for the block to stop changing before judging it.
    const t = setTimeout(() => {
      setSpec(parseChartSpec(code));
      setWaited(true);
    }, 300);
    return () => clearTimeout(t);
  }, [code]);
  if (!spec)
    return waited ? (
      <figure className="visual">
        <pre><code>{code}</code></pre>
        <figcaption className="muted" style={{ fontSize: 11 }}>Chart could not be drawn: the data is not valid.</figcaption>
      </figure>
    ) : (
      <span className="muted"><span className="spinner" /> drawing chart</span>
    );
  return (
    <figure className="visual spec-chart">
      <div className="mermaid-svg" dangerouslySetInnerHTML={{ __html: specSvg(spec, DARK, { t }) }} />
      <DownloadButtons name={spec.title || "chart"} svg={async () => specSvg(spec, LIGHT)} gif={() => chartGif((f) => specSvg(spec, LIGHT, { t: f }))} />
    </figure>
  );
}

/** An ```architecture block from agent output: an architecture option drawn as a 3D layered stack. */
export function SpecArchitecture({ code }: { code: string }) {
  const [spec, setSpec] = useState(() => parseArchSpec(code));
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      setSpec(parseArchSpec(code));
      setWaited(true);
    }, 300);
    return () => clearTimeout(t);
  }, [code]);
  if (!spec)
    return waited ? (
      <figure className="visual">
        <pre><code>{code}</code></pre>
        <figcaption className="muted" style={{ fontSize: 11 }}>Architecture could not be drawn: the data is not valid.</figcaption>
      </figure>
    ) : (
      <span className="muted"><span className="spinner" /> drawing architecture</span>
    );
  return (
    <figure className="visual spec-arch">
      <div className="mermaid-svg" dangerouslySetInnerHTML={{ __html: archSvg(spec, DARK) }} />
      <DownloadButtons name={spec.title || "architecture"} svg={async () => archSvg(spec, LIGHT)} />
    </figure>
  );
}
