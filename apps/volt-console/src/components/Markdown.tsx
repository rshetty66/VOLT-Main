import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { isArchitecture, isChart, isMermaid, isProcess } from "../charts/mermaidBlock";
import { MermaidDiagram, SpecArchitecture, SpecChart, SpecProcess } from "../charts/Visual";

const components: Components = {
  // A ```mermaid block renders as a diagram instead of a code listing.
  pre({ node, children, ...props }) {
    const first = node?.children[0];
    const cls = first && first.type === "element" ? first.properties?.className : undefined;
    const name = Array.isArray(cls) ? cls.join(" ") : String(cls ?? "");
    if (isMermaid(name) || isChart(name) || isArchitecture(name) || isProcess(name)) return <>{children}</>;
    return <pre {...props}>{children}</pre>;
  },
  code({ className, children, ...props }) {
    if (isProcess(className)) return <SpecProcess code={String(children).replace(/\n$/, "")} />;
    if (isArchitecture(className)) return <SpecArchitecture code={String(children).replace(/\n$/, "")} />;
    if (isChart(className)) return <SpecChart code={String(children).replace(/\n$/, "")} />;
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
