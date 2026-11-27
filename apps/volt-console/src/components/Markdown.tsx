import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { isArchitecture, isChart, isMermaid, isProcess, viewKind } from "../charts/mermaidBlock";
import { MermaidDiagram, SpecArchitecture, SpecChart, SpecProcess, SpecView } from "../charts/Visual";
import { CITE_HREF, TAG_HREF, linkCitations } from "../citations";
import type { SourceRecord } from "../../shared/research";
import { useMemo } from "react";

const components: Components = {
  // A ```mermaid block renders as a diagram instead of a code listing.
  pre({ node, children, ...props }) {
    const first = node?.children[0];
    const cls = first && first.type === "element" ? first.properties?.className : undefined;
    const name = Array.isArray(cls) ? cls.join(" ") : String(cls ?? "");
    if (isMermaid(name) || isChart(name) || isArchitecture(name) || isProcess(name) || viewKind(name)) return <>{children}</>;
    return <pre {...props}>{children}</pre>;
  },
  code({ className, children, ...props }) {
    if (isProcess(className)) return <SpecProcess code={String(children).replace(/\n$/, "")} />;
    if (isArchitecture(className)) return <SpecArchitecture code={String(children).replace(/\n$/, "")} />;
    const view = viewKind(className);
    if (view) return <SpecView kind={view} code={String(children).replace(/\n$/, "")} />;
    if (isChart(className)) return <SpecChart code={String(children).replace(/\n$/, "")} />;
    if (isMermaid(className)) return <MermaidDiagram code={String(children).replace(/\n$/, "")} />;
    return <code className={className} {...props}>{children}</code>;
  },
};

/**
 * An answer in Markdown. With `sources`, source keys ([S02]) render as small numbered chips that open the source
 * (`onCite`), and evidence tags ([INFERENCE]) as muted badges, instead of raw bracket runs.
 */
export function Markdown({ text, sources, onCite }: { text: string; sources?: SourceRecord[]; onCite?: (src: SourceRecord) => void }) {
  const cited = useMemo<Components | null>(() => {
    if (!sources) return null;
    const byKey = new Map(sources.map((s) => [s.key, s]));
    return {
      ...components,
      a({ href, children, node: _n, ...props }) {
        if (href?.startsWith(CITE_HREF)) {
          const key = href.slice(CITE_HREF.length);
          const src = byKey.get(key);
          const label = key.replace(/^S0*/, "");
          if (!src) return <sup className="cite missing" title={`${key}: not in this run's source register`}>{label}</sup>;
          return (
            <sup>
              <button type="button" className="cite" title={`${key} · ${src.title}${src.publisher ? ` (${src.publisher})` : ""}`} aria-label={`Source ${key}: ${src.title}`} onClick={() => onCite?.(src)}>
                {label}
              </button>
            </sup>
          );
        }
        if (href?.startsWith(TAG_HREF)) return <span className="evidence-tag">{children}</span>;
        return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
      },
    };
  }, [sources, onCite]);
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={cited ?? components}>{cited ? linkCitations(text) : text}</ReactMarkdown>
    </div>
  );
}
