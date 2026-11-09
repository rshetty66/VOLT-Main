/**
 * Mermaid.tsx — inline diagram rendering for ```mermaid blocks in chat.
 * Lazy-loads mermaid (heavy) only when a diagram actually appears.
 * Falls back to the raw code block if the diagram fails to parse.
 */
import { useEffect, useRef, useState } from 'react';

type MermaidApi = (typeof import('mermaid'))['default'];

const DARK_VARS = {
  background: '#1a1a19',
  primaryColor: '#201f1e',
  primaryBorderColor: '#d9a527',
  primaryTextColor: '#e9ebe5',
  secondaryColor: '#1a1a19',
  tertiaryColor: '#201f1e',
  lineColor: '#9b9d95',
  textColor: '#e9ebe5',
  mainBkg: '#201f1e',
  nodeBorder: '#d9a527',
  clusterBkg: '#1a1a19',
  edgeLabelBackground: '#1a1a19',
};

const LIGHT_VARS = {
  background: '#ffffff',
  primaryColor: '#f7f5f0',
  primaryBorderColor: '#d9a527',
  primaryTextColor: '#141414',
  secondaryColor: '#ffffff',
  tertiaryColor: '#f7f5f0',
  lineColor: '#8a8a84',
  textColor: '#141414',
  mainBkg: '#f7f5f0',
  nodeBorder: '#d9a527',
  clusterBkg: '#faf9f6',
  edgeLabelBackground: '#ffffff',
};

/**
 * Shared initializer — chat renders dark, exporters briefly switch to light
 * and restore dark after. initialize() is global, so callers must await
 * their renders before handing control back.
 */
export async function configureMermaid(
  mode: 'dark' | 'light' = 'dark',
): Promise<MermaidApi> {
  const m = (await import('mermaid')).default;
  m.initialize({
    startOnLoad: false,
    theme: 'base',
    themeVariables: {
      ...(mode === 'dark' ? DARK_VARS : LIGHT_VARS),
      fontFamily: 'Geist Mono, monospace',
      fontSize: '12px',
    },
    flowchart: { htmlLabels: false, curve: 'basis' },
  });
  return m;
}

let seq = 0;

export function MermaidBlock({ code }: { code: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const idRef = useRef(`mmd-${++seq}-${Date.now()}`);

  useEffect(() => {
    let live = true;
    configureMermaid('dark')
      .then((m) => m.render(idRef.current, code))
      .then(({ svg }) => {
        if (live) setSvg(svg);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [code]);

  if (failed) {
    return (
      <pre>
        <code>{code}</code>
      </pre>
    );
  }
  if (!svg) {
    return (
      <div className="shimmer my-3 h-32 rounded-lg border border-[var(--volt-line)]" />
    );
  }
  return (
    <div
      className="my-3 overflow-x-auto rounded-lg border border-[var(--volt-line)] bg-[var(--volt-panel)] p-4 [&_svg]:mx-auto [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
