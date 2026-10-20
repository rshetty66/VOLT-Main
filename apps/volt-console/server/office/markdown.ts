/**
 * Turns agent Markdown into a small block model the Word, Excel and PowerPoint
 * builders share: headings, paragraphs, lists (flattened with a level), GFM
 * tables, code, quotes and rules, with bold / italic / code inline runs.
 */
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { List, ListItem, PhrasingContent, Root, RootContent, Table } from "mdast";

export interface Inline {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

export type Block =
  | { kind: "heading"; depth: number; inlines: Inline[] }
  | { kind: "paragraph"; inlines: Inline[] }
  | { kind: "list"; ordered: boolean; items: { level: number; inlines: Inline[] }[] }
  | { kind: "table"; header: Inline[][]; rows: Inline[][][] }
  | { kind: "code"; text: string }
  | { kind: "quote"; blocks: Block[] }
  | { kind: "rule" };

const parser = unified().use(remarkParse).use(remarkGfm);

export function parseMarkdown(md: string): Block[] {
  const tree = parser.runSync(parser.parse(md)) as Root;
  return tree.children.flatMap(toBlocks);
}

export const plain = (inlines: Inline[]) => inlines.map((i) => i.text).join("").replace(/\s+/g, " ").trim();

function inlines(nodes: PhrasingContent[], style: Omit<Inline, "text"> = {}): Inline[] {
  const out: Inline[] = [];
  for (const n of nodes) {
    switch (n.type) {
      case "text":
        out.push({ text: n.value, ...style });
        break;
      case "strong":
        out.push(...inlines(n.children, { ...style, bold: true }));
        break;
      case "emphasis":
        out.push(...inlines(n.children, { ...style, italic: true }));
        break;
      case "delete":
      case "link":
        out.push(...inlines(n.children as PhrasingContent[], style));
        break;
      case "inlineCode":
        out.push({ text: n.value, ...style, code: true });
        break;
      case "break":
        out.push({ text: "\n", ...style });
        break;
      case "html":
        out.push({ text: n.value.replace(/<[^>]+>/g, ""), ...style });
        break;
      default:
        if ("value" in n && typeof n.value === "string") out.push({ text: n.value, ...style });
    }
  }
  return out;
}

function listItems(list: List, level: number): { level: number; inlines: Inline[] }[] {
  return list.children.flatMap((item: ListItem) => {
    const own: Inline[] = [];
    const nested: { level: number; inlines: Inline[] }[] = [];
    for (const child of item.children) {
      if (child.type === "paragraph") {
        if (own.length) own.push({ text: " " });
        own.push(...inlines(child.children));
      } else if (child.type === "list") nested.push(...listItems(child, level + 1));
    }
    return [{ level, inlines: own }, ...nested];
  });
}

function table(t: Table): Block {
  const [head, ...body] = t.children.map((row) => row.children.map((cell) => inlines(cell.children)));
  return { kind: "table", header: head ?? [], rows: body };
}

function toBlocks(node: RootContent): Block[] {
  switch (node.type) {
    case "heading":
      return [{ kind: "heading", depth: node.depth, inlines: inlines(node.children) }];
    case "paragraph":
      return [{ kind: "paragraph", inlines: inlines(node.children) }];
    case "list":
      return [{ kind: "list", ordered: !!node.ordered, items: listItems(node, 0) }];
    case "table":
      return [table(node)];
    case "code":
      return [{ kind: "code", text: node.value }];
    case "blockquote":
      return [{ kind: "quote", blocks: node.children.flatMap(toBlocks) }];
    case "thematicBreak":
      return [{ kind: "rule" }];
    case "html":
      return node.value.trim() ? [{ kind: "paragraph", inlines: [{ text: node.value.replace(/<[^>]+>/g, "") }] }] : [];
    default:
      return [];
  }
}

/** Splits blocks at headings of `depth` (or shallower) into titled sections; text before the first is "". */
export function sections(blocks: Block[], depth = 2): { title: string; blocks: Block[] }[] {
  const out: { title: string; blocks: Block[] }[] = [{ title: "", blocks: [] }];
  for (const b of blocks) {
    if (b.kind === "heading" && b.depth <= depth) out.push({ title: plain(b.inlines), blocks: [] });
    else out.at(-1)!.blocks.push(b);
  }
  return out.filter((s) => s.title || s.blocks.length);
}
