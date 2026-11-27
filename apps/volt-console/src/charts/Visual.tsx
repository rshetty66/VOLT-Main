import { useEffect, useLayoutEffect, useRef, useState, type ReactElement } from "react";
import { DARK, LIGHT, type Palette } from "./palette";
import { renderMermaid } from "./mermaid";
import { parseArchSpec, parseChartSpec, parseProcessSpec } from "../../shared/viz";
import { processSvg } from "./specProcess";
import { archSvg } from "./specArch";
import { specSvg } from "./specChart";
import { voltFileName, downloadBlob, downloadText, svgToPng } from "../download";
import { chartGif } from "./gif";

/** Light-palette SVG markup for a chart, used by every download. */
export async function chartSvg(render: (p: Palette) => ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  return renderToStaticMarkup(render(LIGHT));
}

export function DownloadButtons({ name, svg, gif, onReplay }: { name: string; svg: () => Promise<string>; gif?: () => Promise<Blob>; onReplay?: () => void }) {
  const [busy, setBusy] = useState(false);
  const run = async (kind: "svg" | "png" | "gif") => {
    setBusy(true);
    try {
      if (kind === "gif" && gif) return downloadBlob(voltFileName(name, "gif"), await gif());
      const markup = await svg();
      if (kind === "svg") downloadText(voltFileName(name, "svg", markup), markup, "image/svg+xml");
      else downloadBlob(voltFileName(name, "png", markup), await svgToPng(markup, 2));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="visual-actions">
      {onReplay && <button className="btn ghost sm" onClick={onReplay} aria-label={`Replay ${name} animation`}>Replay</button>}
      <button className="btn ghost sm" disabled={busy} onClick={() => run("svg")} aria-label={`Download ${name} as SVG`}>SVG</button>
      <button className="btn ghost sm" disabled={busy} onClick={() => run("png")} aria-label={`Download ${name} as PNG`}>PNG</button>
      {gif && <button className="btn ghost sm" disabled={busy} onClick={() => run("gif")} aria-label={`Download ${name} as an animated GIF`} title="Animated, for slides and email">GIF</button>}
    </div>
  );
}

/** A chart on screen (dark) with SVG and PNG downloads (light). */
export function ChartFrame({ name, render }: { name: string; render: (p: Palette) => ReactElement }) {
  const [ref, reveal] = useReveal<HTMLElement>();
  return (
    <figure ref={ref} className={`visual ${reveal}`}>
      {render(DARK)}
      <DownloadButtons name={name} svg={() => chartSvg(render)} />
    </figure>
  );
}

/** A ```mermaid block from agent output, rendered as a diagram. Falls back to the source if it does not parse. */
export function MermaidDiagram({ code }: { code: string }) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  const [ref, reveal] = useReveal<HTMLElement>(!!svg);
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
    <figure ref={ref} className={`visual mermaid ${reveal}`}>
      {svg ? <div className="mermaid-svg" dangerouslySetInnerHTML={{ __html: svg }} /> : <span className="muted"><span className="spinner" /> drawing diagram</span>}
      {svg && <DownloadButtons name="diagram" svg={() => renderMermaid(code, "default")} />}
    </figure>
  );
}

/**
 * Wipes a chart or diagram in the first time it scrolls into view. Without IntersectionObserver it shows at once, so
 * nothing stays hidden; with reduced motion the CSS only fades it.
 */
function useReveal<T extends HTMLElement>(ready = true): [React.RefObject<T | null>, string] {
  const ref = useRef<T>(null);
  const [cls, setCls] = useState("");
  useLayoutEffect(() => {
    const el = ref.current;
    if (!ready || !el || typeof IntersectionObserver !== "function") return;
    setCls("reveal-wait");
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      setCls("reveal-in");
      io.disconnect();
    });
    io.observe(el);
    return () => {
      io.disconnect();
      setCls("");
    };
  }, [ready]);
  return [ref, cls];
}

/** Length of a chart's entrance: one authored moment, within Impeccable's 500 to 800 ms for a focal entrance. */
const ENTRANCE_MS = 800;

/**
 * Plays a chart's entrance once, the first time it is drawn: returns the progress (0 to 1) to draw at. The chart is
 * fully drawn by default and on any interruption, so it never stays hidden; with reduced motion it only fades (CSS).
 * It waits until the chart scrolls into view, so a chart drawn below the fold still animates when the reader gets there.
 */
function useEntrance(key: string | null, el: React.RefObject<HTMLElement | null>): number {
  const [t, setT] = useState(1);
  const played = useRef(false);
  useLayoutEffect(() => {
    if (!key || played.current) return;
    played.current = true;
    if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const play = () => {
      const start = performance.now();
      const step = (now: number) => {
        const x = Math.min(1, (now - start) / ENTRANCE_MS);
        setT(x);
        if (x < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    setT(0);
    let io: IntersectionObserver | undefined;
    if (el.current && typeof IntersectionObserver === "function") {
      io = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        io?.disconnect();
        play();
      });
      io.observe(el.current);
    } else play();
    return () => {
      io?.disconnect();
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
  const [replay, setReplay] = useState(0);
  const fig = useRef<HTMLElement>(null);
  const t = useEntrance(spec ? `${spec.title}${spec.type}${replay}` : null, fig);
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
    <figure ref={fig} className="visual spec-chart">
      <div className="mermaid-svg" dangerouslySetInnerHTML={{ __html: specSvg(spec, DARK, { t }) }} />
      <DownloadButtons name={spec.title || "chart"} svg={async () => specSvg(spec, LIGHT)} gif={() => chartGif((f) => specSvg(spec, LIGHT, { t: f }))} onReplay={() => setReplay((n) => n + 1)} />
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

/** A ```process block from agent output: a process flow drawn as swimlanes. Hover a step for its detail. */
export function SpecProcess({ code }: { code: string }) {
  const [spec, setSpec] = useState(() => parseProcessSpec(code));
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      setSpec(parseProcessSpec(code));
      setWaited(true);
    }, 300);
    return () => clearTimeout(t);
  }, [code]);
  if (!spec)
    return waited ? (
      <figure className="visual">
        <pre><code>{code}</code></pre>
        <figcaption className="muted" style={{ fontSize: 11 }}>Process flow could not be drawn: the data is not valid.</figcaption>
      </figure>
    ) : (
      <span className="muted"><span className="spinner" /> drawing process flow</span>
    );
  return (
    <figure className="visual spec-process">
      <div className="mermaid-svg" dangerouslySetInnerHTML={{ __html: processSvg(spec, DARK) }} />
      <DownloadButtons name={spec.title || "process"} svg={async () => processSvg(spec, LIGHT)} />
    </figure>
  );
}
