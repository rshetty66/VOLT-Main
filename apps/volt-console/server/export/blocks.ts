import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { PhrasingContent, RootContent, List, Table } from "mdast";

/** A format-neutral view of a markdown deliverable that the Word, PowerPoint and Excel writers share. */
export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

export type Block =
  | { type: "heading"; depth: number; text: string }
  | { type: "paragraph"; runs: Run[] }
  | { type: "list"; ordered: boolean; items: { level: number; runs: Run[] }[] }
  | { type: "table"; header: string[]; rows: string[][] }
  | { type: "code"; lang: string; text: string }
  | { type: "quote"; runs: Run[] }
  | { type: "image"; ref: string }
  | { type: "rule" };

function runs(nodes: PhrasingContent[], mark: Omit<Run, "text"> = {}): Run[] {
  const out: Run[] = [];
  for (const n of nodes) {
    if (n.type === "text") out.push({ text: n.value, ...mark });
    else if (n.type === "strong") out.push(...runs(n.children, { ...mark, bold: true }));
    else if (n.type === "emphasis") out.push(...runs(n.children, { ...mark, italic: true }));
    else if (n.type === "inlineCode") out.push({ text: n.value, ...mark, code: true });
    else if (n.type === "break") out.push({ text: "\n", ...mark });
    else if ("children" in n) out.push(...runs(n.children as PhrasingContent[], mark));
    else if ("value" in n && typeof n.value === "string") out.push({ text: n.value, ...mark });
  }
  return out;
}

export const plain = (rs: Run[]) => rs.map((r) => r.text).join("");

function listItems(list: List, level: number): { level: number; runs: Run[] }[] {
  return list.children.flatMap((item) =>
    item.children.flatMap((child) =>
      child.type === "paragraph" ? [{ level, runs: runs(child.children) }] : child.type === "list" ? listItems(child, level + 1) : [],
    ),
  );
}

const cellText = (cell: Table["children"][number]["children"][number]) => plain(runs(cell.children)).trim();

export function markdownBlocks(markdown: string): Block[] {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown);
  const out: Block[] = [];
  let diagrams = 0;
  let vizCharts = 0;
  let archs = 0;
  let procs = 0;
  const visit = (node: RootContent) => {
    switch (node.type) {
      case "heading":
        out.push({ type: "heading", depth: node.depth, text: plain(runs(node.children)).trim() });
        break;
      case "paragraph":
        out.push({ type: "paragraph", runs: runs(node.children) });
        break;
      case "list":
        out.push({ type: "list", ordered: !!node.ordered, items: listItems(node, 0) });
        break;
      case "table": {
        const [head, ...body] = node.children;
        out.push({ type: "table", header: head ? head.children.map(cellText) : [], rows: body.map((r) => r.children.map(cellText)) });
        break;
      }
      case "code":
        if ((node.lang ?? "").toLowerCase() === "mermaid") out.push({ type: "image", ref: `diagram-${diagrams++}` });
        else if ((node.lang ?? "").toLowerCase() === "architecture") out.push({ type: "image", ref: `arch-${archs++}` });
        else if ((node.lang ?? "").toLowerCase() === "process") out.push({ type: "image", ref: `proc-${procs++}` });
        else if ((node.lang ?? "").toLowerCase() === "chart") out.push({ type: "image", ref: `viz-${vizCharts++}` });
        else out.push({ type: "code", lang: node.lang ?? "", text: node.value });
        break;
      case "blockquote":
        out.push({ type: "quote", runs: node.children.flatMap((c) => (c.type === "paragraph" ? runs(c.children) : [])) });
        break;
      case "thematicBreak":
        out.push({ type: "rule" });
        break;
      case "html":
        break;
      default:
        if ("children" in node) (node.children as RootContent[]).forEach(visit);
    }
  };
  tree.children.forEach(visit);
  return out;
}

/** Parses a table cell as a number when it is one: "12", "1,234.5", "$8.50", "25%", "-6M" stays text. */
export function cellValue(s: string): { value: string | number; format?: string } {
  const t = s.trim();
  const num = (x: string) => Number(x.replace(/,/g, ""));
  const plainNum = /^-?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/;
  if (plainNum.test(t)) return { value: num(t), format: t.includes(",") || t.includes(".") ? "#,##0.##" : undefined };
  const pct = /^(-?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?)\s?%$/.exec(t);
  if (pct) return { value: +(num(pct[1]) / 100).toPrecision(12), format: "0.##%" };
  const cur = /^(-?)([$€£])\s?((\d{1,3}(,\d{3})+|\d+)(\.\d+)?)$/.exec(t);
  if (cur) return { value: num(cur[1] + cur[3]), format: `"${cur[2]}"#,##0.00` };
  return { value: t };
}

/**
 * The deliverable's table of contents: its "##" section headings in order, or "#" headings when it has none.
 * Headings that already carry a number ("1. Executive summary") keep it; the others are numbered here.
 * Trailing entries (an appendix) follow, unnumbered. Empty below three numbered entries: a contents list of one or two lines is noise.
 */
export function contentsOf(blocks: Block[], leading: string[] = [], trailing: string[] = []): string[] {
  const h2 = blocks.filter((b): b is Extract<Block, { type: "heading" }> => b.type === "heading" && b.depth === 2);
  const heads = (h2.length ? h2 : blocks.filter((b): b is Extract<Block, { type: "heading" }> => b.type === "heading" && b.depth === 1)).map((b) => b.text);
  const all = [...leading, ...heads];
  if (all.length < 3) return [];
  // Trailing entries (an appendix) are listed last and are not numbered.
  return [...all.map((t, i) => (/^\d+[.)]\s/.test(t) ? t : `${i + 1}. ${t}`)), ...trailing];
}

export interface TocEntry {
  level: 1 | 2;
  text: string;
  /** The bookmark the heading carries, so a Contents line can link to it and ask for its page. */
  id: string;
  /** The heading block this entry stands for; the appendix has none. */
  heading?: Extract<Block, { type: "heading" }>;
}

/**
 * The table of contents: the "##" sections (or "#" when there are none) and the headings one level below them, in order.
 * Sections are numbered as in `contentsOf`. Empty below three sections. `trailing` entries (an appendix) come last, unnumbered.
 */
export function tocEntries(blocks: Block[], trailing: string[] = []): TocEntry[] {
  const heads = blocks.filter((b): b is Extract<Block, { type: "heading" }> => b.type === "heading");
  const top = heads.some((h) => h.depth === 2) ? 2 : 1;
  const sections = heads.filter((h) => h.depth === top);
  if (sections.length < 3) return [];
  const out: TocEntry[] = [];
  let n = 0;
  let id = 0;
  for (const h of heads) {
    if (h.depth === top) {
      n++;
      out.push({ level: 1, text: /^\d+[.)]\s/.test(h.text) ? h.text : `${n}. ${h.text}`, id: `toc_${++id}`, heading: h });
    } else if (h.depth === top + 1 && n > 0) {
      out.push({ level: 2, text: shortTitle(h.text), id: `toc_${++id}`, heading: h });
    }
  }
  trailing.forEach((t) => out.push({ level: 1, text: t, id: `toc_${++id}` }));
  return out;
}

/** A sub-section's name for the Contents: an action title ("Root causes: process design explains most of the gap") is cut at its colon. */
export function shortTitle(text: string): string {
  const i = text.indexOf(": ");
  const head = i >= 3 && i <= 60 ? text.slice(0, i) : text;
  return head.length > 90 ? `${head.slice(0, 87).trimEnd()}...` : head;
}

/**
 * How a table's width is shared out between its columns, as fractions that sum to 1. Every column is first given enough
 * room for its longest word (so "Priority" or "Medium" is not split across lines), and the rest goes to the columns of
 * long text, in proportion to how much text they hold. `totalTwips` is the table's width (6.5 inches by default).
 */
export function columnShares(header: string[], rows: string[][], totalTwips = 9360): number[] {
  const n = header.length;
  if (n === 0) return [];
  const CHAR = 105; // twips per character at 9 pt
  const PAD = 220; // cell margins
  const longestWord = (i: number) => Math.max(...[header[i], ...rows.map((r) => r[i] ?? "")].flatMap((t) => t.split(/\s+/)).map((w) => w.length), 1);
  let floor = header.map((_, i) => Math.min(0.25, (Math.min(longestWord(i), 18) * CHAR + PAD) / totalTwips));
  const floors = floor.reduce((a, b) => a + b, 0);
  if (floors > 0.95) floor = floor.map((f) => (f / floors) * 0.95);
  const weight = header.map((h, i) => {
    const lens = [h.length, ...rows.map((r) => (r[i] ?? "").length)];
    const avg = lens.reduce((a, b) => a + b, 0) / lens.length;
    return Math.min(45, Math.max(5, 0.6 * avg + 0.4 * Math.min(60, Math.max(...lens))));
  });
  const totalWeight = weight.reduce((a, b) => a + b, 0);
  const spare = 1 - floor.reduce((a, b) => a + b, 0);
  return floor.map((f, i) => f + (spare * weight[i]) / totalWeight);
}
