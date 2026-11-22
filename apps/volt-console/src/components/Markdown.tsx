import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { isMermaid } from "../charts/mermaidBlock";
import { MermaidDiagram } from "../charts/Visual";

const components: Components = {
  // A ```mermaid block renders as a diagram instead of a code listing.
  pre({ node, children, ...props }) {
    const first = node?.children[0];
    const cls = first && first.type === "element" ? first.properties?.className : undefined;
    if (isMermaid(Array.isArray(cls) ? cls.join(" ") : String(cls ?? ""))) return <>{children}</>;
    return <pre {...props}>{children}</pre>;
  },
  code({ className, children, ...props }) {
    if (isMermaid(className)) return <MermaidDiagram code={String(children).replace(/\n$/, "")} />;
    return <code className={className} {...props}>{children}</code>;
  },
};

export function Markdown({ text }: { text: string }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{text}</ReactMarkdown>
    </div>
  );
}
