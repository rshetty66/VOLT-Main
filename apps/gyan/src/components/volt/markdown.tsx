/**
 * markdown.tsx — shared ReactMarkdown component map.
 * Routes ```mermaid fences to the diagram renderer and ```chart fences to
 * live charts; other fenced blocks become styled code, inline code a chip.
 * Used by the chat and by Studio's deliverable preview.
 */
import { MermaidBlock } from './Mermaid';
import { ChartBlock } from './ChartBlock';

export const mdComponents = {
  pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  code({
    className,
    children,
  }: {
    className?: string;
    children?: React.ReactNode;
  }) {
    const lang = /language-(\w+)/.exec(className ?? '')?.[1];
    const text = String(children ?? '').replace(/\n$/, '');
    if (lang === 'mermaid') return <MermaidBlock code={text} />;
    if (lang === 'chart') return <ChartBlock code={text} />;
    if (className) {
      return (
        <pre className="my-3 overflow-x-auto rounded-lg border border-[var(--volt-line)] bg-[var(--volt-panel)] p-3 text-[12px] leading-relaxed">
          <code>{text}</code>
        </pre>
      );
    }
    return (
      <code className="rounded bg-[var(--volt-panel-2)] px-1.5 py-0.5 font-mono text-[12px]">
        {children}
      </code>
    );
  },
};
