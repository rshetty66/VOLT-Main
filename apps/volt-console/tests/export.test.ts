import fs from "node:fs";
import path from "node:path";
import type { AddressInfo } from "node:net";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { columnShares, contentsOf, markdownBlocks, shortTitle, tocEntries } from "../server/export/blocks";
import { brandLogo } from "../server/export/brand";
import { toneFor } from "../shared/brand";
import { exportDocument, styleFrom } from "../server/export";
import { DECK } from "../server/export/deckTheme";
import { checkPlan, planDeck } from "../server/export/pptx";
import { exportRouter } from "../server/export/route";
import { extractTemplate } from "../server/templates";
import type { ExportRequest } from "../shared/export";

// 1x1 transparent PNG.
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const MD = `Five-day close is achievable in two quarters.

## Current state

The close takes **12 days** today, with *manual* journals in \`SAP FI\`.

- Reconciliations are spreadsheet based
- Intercompany is matched by email

1. Standardise the calendar
2. Automate accruals

| Metric | Client | Top quartile |
|---|---|---|
| Days to close | 12 | 4 |
| Cost per invoice | $8.50 | $2 |
| Automation | 25% | 60% |

## Target architecture

\`\`\`mermaid
flowchart LR
  a[Core] --> b[Hub]
\`\`\`

> Illustrative example.

\`\`\`sql
select 1
\`\`\`
`;

const fixture = (name: string) => new Uint8Array(fs.readFileSync(path.join(__dirname, "fixtures", name)));
const unzip = (b: Uint8Array) => unzipSync(b);
const text = (files: Record<string, Uint8Array>, name: string) => strFromU8(files[name]);

const req = (format: ExportRequest["format"], extra: Partial<ExportRequest> = {}): ExportRequest => ({
  format,
  title: "Five-day close plan",
  subtitle: "VOLT Console, demo mode",
  markdown: MD,
  images: [
    { ref: "chart-0", png: PNG, width: 640, height: 128, caption: "Days to close" },
    { ref: "diagram-0", png: PNG, width: 400, height: 200 },
  ],
  ...extra,
});

describe("markdown to blocks", () => {
  const blocks = markdownBlocks(MD);

  it("keeps headings, inline emphasis, lists, tables, code and quotes in order", () => {
    expect(blocks.map((b) => b.type)).toEqual(["paragraph", "heading", "paragraph", "list", "list", "table", "heading", "image", "quote", "code"]);
    const p = blocks[2];
    expect(p.type === "paragraph" && p.runs.find((r) => r.bold)?.text).toBe("12 days");
    expect(p.type === "paragraph" && p.runs.find((r) => r.italic)?.text).toBe("manual");
    expect(p.type === "paragraph" && p.runs.find((r) => r.code)?.text).toBe("SAP FI");
    const ol = blocks[4];
    expect(ol.type === "list" && ol.ordered).toBe(true);
    const t = blocks[5];
    expect(t.type === "table" && t.header).toEqual(["Metric", "Client", "Top quartile"]);
    expect(t.type === "table" && t.rows[1]).toEqual(["Cost per invoice", "$8.50", "$2"]);
  });

  it("turns the n-th mermaid block into an image reference", () => {
    expect(blocks[7]).toEqual({ type: "image", ref: "diagram-0" });
  });
});

describe("Word export", () => {
  it("writes headings, a real table, images and the template fonts", async () => {
    const profile = extractTemplate(fixture("brand-template.docx"), "brand-template.docx");
    const out = await exportDocument(req("docx"), profile);
    expect(out.mime).toContain("wordprocessingml");
    const files = unzip(out.data);
    const doc = text(files, "word/document.xml");
    expect(doc).toContain("Current state");
    expect(doc).toContain("<w:tbl>");
    expect(doc).toContain("Cost per invoice");
    expect(Object.keys(files).filter((f) => f.startsWith("word/media/")).length).toBe(2);
    const styles = text(files, "word/styles.xml") + doc;
    expect(styles).toContain("Montserrat");
    expect(styles).toContain("Georgia");
  });
});

describe("PowerPoint export", () => {
  it("makes a title slide, one slide per section, picture slides and template fonts", async () => {
    const profile = extractTemplate(fixture("brand-template.pptx"), "brand-template.pptx");
    const out = await exportDocument(req("pptx"), profile);
    const files = unzip(out.data);
    const slides = Object.keys(files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
    expect(slides.length).toBeGreaterThanOrEqual(5);
    const all = slides.map((s) => text(files, s)).join("\n");
    // pptxgenjs writes table cells word by word, so compare the joined text runs.
    const words = [...all.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join("");
    expect(all).toContain("Five-day close plan");
    expect(all).toContain("Current state");
    expect(all).toContain("Target architecture");
    expect(words).toContain("Cost per invoice");
    expect(all).toContain("<a:tbl>");
    expect(Object.keys(files).filter((f) => f.startsWith("ppt/media/")).length).toBeGreaterThanOrEqual(2);
    expect(all).toContain(profile.theme!.fonts.major);
  });
});

describe("Excel export", () => {
  it("writes a summary sheet, one sheet per markdown table and numbers as numbers", async () => {
    const out = await exportDocument(
      req("xlsx", { tables: [{ name: "Benchmarks", columns: ["Metric", "Client"], rows: [["Days to close", 12]] }] }),
      null,
    );
    const files = unzip(out.data);
    const wb = text(files, "xl/workbook.xml");
    expect(wb).toContain('name="Summary"');
    expect(wb).toContain('name="Current state"');
    expect(wb).toContain('name="Benchmarks"');
    const sheets = Object.keys(files).filter((f) => /^xl\/worksheets\/sheet\d+\.xml$/.test(f)).sort();
    const tableSheet = text(files, sheets[1]);
    // "12" is stored as a number (no t="s"), "$8.50" as 8.5 with a currency format, "25%" as 0.25.
    expect(tableSheet).toMatch(/<c r="B2"[^>]*><v>12<\/v>/);
    expect(tableSheet).toMatch(/<c r="B3"[^>]*><v>8.5<\/v>/);
    expect(tableSheet).toMatch(/<c r="B4"[^>]*><v>0.25<\/v>/);
  });
});

describe("export route", () => {
  let base = "";
  const app = express();
  app.use("/api/export", exportRouter(() => null));
  let server: ReturnType<typeof app.listen>;
  beforeAll(async () => {
    server = app.listen(0);
    await new Promise<void>((r) => server.once("listening", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => server.close());

  it("returns the file with a download name", async () => {
    const r = await fetch(`${base}/api/export`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(req("docx")) });
    expect(r.status).toBe(200);
    expect(r.headers.get("content-disposition")).toMatch(/attachment; filename="volt-five-day-close-plan-\d{4}-\d{2}-\d{2}\.docx"/);
    const bytes = new Uint8Array(await r.arrayBuffer());
    expect(bytes[0]).toBe(0x50); // PK zip
  });

  it("rejects a bad request with a JSON error", async () => {
    const r = await fetch(`${base}/api/export`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ format: "pdf", title: "x", markdown: "" }) });
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBeTruthy();
  });

  it("derives styles with VOLT defaults when no template is selected", () => {
    // The VOLT identity: Electric Cyber Blue accent on Deep Space Indigo headings and table headers (gold and orange are signals, not identity).
    expect(styleFrom(null)).toMatchObject({ brand: true, bodyFont: "Calibri", accent: "00E5FF", headingColor: "1A1E2E", headerFill: "1A1E2E" });
  });

  it("is not branded when a client template is selected", () => {
    expect(styleFrom(extractTemplate(fixture("brand-template.docx"), "brand-template.docx")).brand).toBe(false);
  });
});

describe("browser-side deliverable helpers", () => {
  it("finds mermaid blocks in the same order the server numbers them", async () => {
    const { mermaidSources } = await import("../src/exports");
    const md = "x\n\n```mermaid\nflowchart LR\n a-->b\n```\n\n```ts\nconst a = 1\n```\n\n```mermaid\nsequenceDiagram\n A->>B: hi\n```\n";
    expect(mermaidSources(md)).toEqual(["flowchart LR\n a-->b", "sequenceDiagram\n A->>B: hi"]);
    expect(markdownBlocks(md).filter((b) => b.type === "image")).toEqual([{ type: "image", ref: "diagram-0" }, { type: "image", ref: "diagram-1" }]);
  });

  it("adds specialist notes as an appendix only when asked, and turns chart data into sheets", async () => {
    const { runDeliverable, chartTables } = await import("../src/exports");
    const { newRun, applyEvent } = await import("../src/runState");
    const { compareToBenchmark, buildValueCase } = await import("../server/analytics");
    let run = newRun("Five-day close", "Rudra", "orchestrate");
    run = applyEvent(run, { type: "agent_start", lane: "L1", parentLane: "rudra", agentId: "a", name: "SAP FI/CO Specialist", layer: "ERP", icon: "", brief: "" });
    run = applyEvent(run, { type: "text_delta", lane: "L1", text: "Specialist view." });
    run = applyEvent(run, { type: "text_delta", lane: "rudra", text: "Answer first." });
    expect(runDeliverable(run, false).markdown).toBe("Answer first.");
    expect(runDeliverable(run, true).markdown).toContain("## Appendix: specialist notes\n\n### SAP FI/CO Specialist (ERP)\n\nSpecialist view.");

    const vc = buildValueCase({ financeFtes: 100, loadedCostPerFte: 100000, automationPct: 20, oneTimeInvestment: 3_000_000, horizonYears: 3 });
    const sheets = chartTables([
      { id: "1", kind: "benchmark", data: compareToBenchmark("days_to_close", 12) as never },
      { id: "2", kind: "valueCase", data: vc },
    ]);
    expect(sheets.map((t) => t.name)).toEqual(["Benchmarks", "Value case"]);
    expect(sheets[0].rows[0].slice(0, 2)).toEqual(["Days to Close the Books", 12]);
    expect(sheets[1].rows[0]).toEqual([0, null, null, null, -3_000_000]);
  });
});

describe("table of contents", () => {
  const MD4 = `${MD}\n## Next steps\n\n- Agree the target calendar\n`;

  it("numbers the section headings, keeps existing numbers, and is empty below three entries", () => {
    expect(contentsOf(markdownBlocks("## A\n\nx\n\n## B\n\ny\n"))).toEqual([]);
    expect(contentsOf(markdownBlocks("## Alpha\n\n## Beta\n\n## Gamma\n"))).toEqual(["1. Alpha", "2. Beta", "3. Gamma"]);
    expect(contentsOf(markdownBlocks("## 1. Executive summary\n\n## 2. Findings\n\n## 3. Next steps\n"))).toEqual(["1. Executive summary", "2. Findings", "3. Next steps"]);
    expect(contentsOf(markdownBlocks("# One\n\n# Two\n\n# Three\n"))).toEqual(["1. One", "2. Two", "3. Three"]);
    expect(contentsOf(markdownBlocks("## Alpha\n\n## Beta\n"), ["Overview"])).toEqual(["1. Overview", "2. Alpha", "3. Beta"]);
  });

  it("lists a trailing appendix after the numbered sections, unnumbered", () => {
    expect(contentsOf(markdownBlocks("## Alpha\n\n## Beta\n\n## Gamma\n"), [], ["Appendix: Supporting analysis"])).toEqual(["1. Alpha", "2. Beta", "3. Gamma", "Appendix: Supporting analysis"]);
  });

  it("builds table of contents entries: sections numbered, sub-sections one level in, an appendix last, empty below three sections", () => {
    const toc = tocEntries(markdownBlocks("## 1. Summary\n\n### Why\n\n## Findings\n\n### Baseline\n\n#### deeper\n\n## Next steps\n"), ["Appendix"]);
    expect(toc.map((t) => [t.level, t.text])).toEqual([[1, "1. Summary"], [2, "Why"], [1, "2. Findings"], [2, "Baseline"], [1, "3. Next steps"], [1, "Appendix"]]);
    expect(new Set(toc.map((t) => t.id)).size).toBe(toc.length);
    expect(toc.slice(0, 5).every((t) => t.heading)).toBe(true);
    expect(toc[5].heading).toBeUndefined();
    expect(tocEntries(markdownBlocks("## A\n\n## B\n"), ["Appendix"])).toEqual([]);
  });

  it("puts a real table of contents in the Word file: linked lines, dotted leaders, page numbers, and Word updates them on open", async () => {
    const files = unzip((await exportDocument(req("docx", { markdown: MD4 }), null)).data);
    const xml = text(files, "word/document.xml");
    expect(xml).toContain(">Contents<");
    for (const line of ["1. Current state", "2. Target architecture", "3. Next steps", "Appendix: Supporting analysis"]) expect(xml).toContain(line);
    // each line links to a bookmark on its heading and asks for that heading's page
    const anchors = [...xml.matchAll(/<w:hyperlink[^>]*w:anchor="(toc_\d+)"/g)].map((m) => m[1]);
    expect(anchors.length).toBeGreaterThanOrEqual(4);
    for (const a of anchors) {
      expect(xml).toContain(`w:name="${a}"`);
      expect(xml).toContain(`PAGEREF ${a}`);
    }
    expect(xml).toContain('w:leader="dot"');
    expect(text(files, "word/settings.xml")).toContain("w:updateFields");
  });

  it("puts the charts in an appendix after the last section, not before the first", async () => {
    const xml = text(unzip((await exportDocument(req("docx", { markdown: MD4 }), null)).data), "word/document.xml");
    const heading = xml.lastIndexOf("Appendix: Supporting analysis");
    expect(heading).toBeGreaterThan(xml.lastIndexOf("Agree the target calendar"));
    expect(xml).not.toContain(">Results<");
  });

  it("puts a Contents slide in the PowerPoint file, and the chart slides after the body", async () => {
    const files = unzip((await exportDocument(req("pptx", { markdown: MD4 }), null)).data);
    const names = Object.keys(files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((x, y) => Number(x.match(/\d+/)![0]) - Number(y.match(/\d+/)![0]));
    const slides = names.map((n) => text(files, n));
    const contents = slides.find((x) => x.includes(">Contents<"));
    expect(contents).toBeTruthy();
    expect(contents).toContain("2. Target architecture");
    expect(contents).toContain("Appendix: Supporting analysis");
    const last = slides[slides.length - 1];
    expect(last).toContain("Appendix");
  });

  it("makes Contents the first worksheet, pointing each section at its table sheet", async () => {
    const files = unzip((await exportDocument(req("xlsx", { markdown: MD4, images: [] }), null)).data);
    const names = [...text(files, "xl/workbook.xml").matchAll(/<sheet [^>]*name="([^"]+)"/g)].map((m) => m[1]);
    expect(names[0]).toBe("Contents");
    expect(names[1]).toBe("Summary");
    const shared = text(files, "xl/sharedStrings.xml");
    for (const line of ["1. Current state", "2. Target architecture", "3. Next steps"]) expect(shared).toContain(line);
  });

  it("adds no Contents to a short document", async () => {
    const xml = text(unzip((await exportDocument(req("docx", { markdown: "## Only\n\ntext\n", images: [] }), null)).data), "word/document.xml");
    expect(xml).not.toContain(">Contents<");
  });
});

describe("report polish", () => {
  const body = (f: (md: string) => string = (x) => x) => f("## 1. Summary\n\n### Root causes: process design explains the largest share of the gap\n\ntext\n\n## 2. Findings\n\n| Rec | Owner | Priority |\n|---|---|---|\n| Re-sequence the close calendar so the allocation and funds transfer pricing runs finish before period end | CFO | High |\n\n## 3. Next steps\n\ntext\n");

  it("cuts a sub-section's action title at its colon for the Contents, and leaves short or colon-less titles alone", () => {
    expect(shortTitle("Root causes: process design explains the largest share of excess close days")).toBe("Root causes");
    expect(shortTitle("Business case")).toBe("Business case");
    expect(shortTitle("A: long")).toBe("A: long"); // colon too early to be a title
    expect(shortTitle("x".repeat(120)).length).toBeLessThanOrEqual(90);
    const toc = tocEntries(markdownBlocks(body()));
    expect(toc.find((t) => t.level === 2)?.text).toBe("Root causes");
  });

  it("gives long-text columns more of a table's width, keeps every column wide enough for its longest word, and sums to 1", () => {
    const shares = columnShares(["Recommendation", "Owner", "Priority"], [["Re-sequence the close calendar so the allocation and funds transfer pricing runs finish before period end", "CFO", "High"]]);
    expect(shares[0]).toBeGreaterThan(shares[1] * 2);
    // "Priority" (8 characters at 9 pt) needs about 8 * 105 + 220 twips of a 9,360 twip table
    expect(shares[2]).toBeGreaterThanOrEqual((8 * 105 + 220) / 9360 - 1e-9);
    expect(shares[1]).toBeGreaterThanOrEqual((5 * 105 + 220) / 9360 - 1e-9);
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    expect(columnShares([], [])).toEqual([]);
    const many = columnShares(Array.from({ length: 12 }, (_, i) => `column${i}`), []);
    expect(many.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    expect(Math.min(...many)).toBeGreaterThan(0);
  });

  it("writes the Word table with fixed, proportional column widths", async () => {
    const xml = text(unzip((await exportDocument(req("docx", { markdown: body(), images: [] }), null)).data), "word/document.xml");
    expect(xml).toContain('<w:tblLayout w:type="fixed"');
    const widths = [...xml.matchAll(/<w:gridCol w:w="(\d+)"/g)].map((m) => Number(m[1]));
    expect(widths).toHaveLength(3);
    expect(widths[0]).toBeGreaterThan(widths[1] * 2);
  });

  it("prints the deliverable's own title once (on the cover), not again at the top of the body", async () => {
    const md = `# Five-day close plan\n\n${body()}`;
    const xml = text(unzip((await exportDocument(req("docx", { markdown: md, images: [] }), null)).data), "word/document.xml");
    const inBody = xml.split("Five-day close plan").length - 1;
    expect(inBody).toBe(1); // the cover only
  });

  it("starts the body on a new page with a page-break-before paragraph, not a page-break character", async () => {
    const xml = text(unzip((await exportDocument(req("docx", { markdown: body(), images: [] }), null)).data), "word/document.xml");
    expect(xml).toContain("<w:pageBreakBefore");
    expect(xml).not.toContain('<w:br w:type="page"');
  });
});

describe("VOLT branding", () => {
  const media = (files: Record<string, Uint8Array>, dir: string) => Object.keys(files).filter((f) => f.startsWith(dir) && !f.endsWith("/")).length;
  const noImages = (format: ExportRequest["format"]) => req(format, { images: [], subtitle: "22 November 2026" });
  const profile = (name: string) => extractTemplate(fixture(name), name);

  it("finds the logo and reads its size from the PNG header", () => {
    const logo = brandLogo();
    expect(logo && [logo.width, logo.height]).toEqual([895, 335]);
  });

  it("has no logo or picture on the Word cover, and the VOLT line in the footer", async () => {
    const files = unzip((await exportDocument(noImages("docx"), null)).data);
    expect(media(files, "word/media/")).toBe(0);
    const footer = Object.keys(files).find((f) => /^word\/footer\d*\.xml$/.test(f));
    expect(footer && text(files, footer)).toContain("VOLT");
    expect(footer && text(files, footer)).toContain("Orchestrate");
  });

  it("brands the PowerPoint cover (dark, no logo) and content slides", async () => {
    const files = unzip((await exportDocument(noImages("pptx"), null)).data);
    expect(media(files, "ppt/media/")).toBe(0);
    expect(text(files, "ppt/slides/slide1.xml")).toContain(DECK.colors.dk1);
    // The VOLT footer lives on the content layout, so every content slide carries it.
    expect(Object.keys(files).filter((f) => /^ppt\/slideLayouts\/.*\.xml$/.test(f)).some((f) => text(files, f).includes("VOLT"))).toBe(true);
  });

  it("puts the logo band on the Excel sheets", async () => {
    const files = unzip((await exportDocument(noImages("xlsx"), null)).data);
    expect(media(files, "xl/media/")).toBeGreaterThanOrEqual(1);
    expect(Object.keys(files).some((f) => f.startsWith("xl/drawings/"))).toBe(true);
  });

  it("leaves a client template's own look alone: no VOLT logo or footer", async () => {
    const docx = unzip((await exportDocument(noImages("docx"), profile("brand-template.docx"))).data);
    expect(media(docx, "word/media/")).toBe(0);
    expect(Object.keys(docx).some((f) => /^word\/footer/.test(f))).toBe(false);
    const pptx = unzip((await exportDocument(noImages("pptx"), profile("brand-template.pptx"))).data);
    expect(media(pptx, "ppt/media/")).toBe(0);
    const xlsx = unzip((await exportDocument(noImages("xlsx"), profile("brand-template.xlsx"))).data);
    expect(media(xlsx, "xl/media/")).toBe(0);
  });
});

describe("colour coding", () => {
  it("codes priority, risk and status words only in the columns that are about them", () => {
    expect(toneFor("Priority", "High")).toBe("high");
    expect(toneFor("Likelihood", " medium ")).toBe("mid");
    expect(toneFor("Status", "**Green**")).toBe("low");
    expect(toneFor("Position", "Bottom quartile")).toBe("high");
    expect(toneFor("Value", "High")).toBeNull(); // a benefit column is not a warning
    expect(toneFor("Priority", "Soon")).toBeNull();
  });

  it("shades a High priority cell orange and a Low one cyan in the Word file", async () => {
    const md = "## Risks\n\n| Risk | Priority |\n|---|---|\n| Data quality | High |\n| Training | Low |\n";
    const xml = text(unzip((await exportDocument({ format: "docx", title: "T", markdown: md } as ExportRequest, null)).data), "word/document.xml");
    expect(xml).toContain('w:fill="FF5722"');
    expect(xml).toContain('w:fill="00E5FF"');
    const client = text(unzip((await exportDocument({ format: "docx", title: "T", markdown: md } as ExportRequest, extractTemplate(fixture("brand-template.docx"), "brand-template.docx"))).data), "word/document.xml");
    expect(client).not.toContain('w:fill="FF5722"');
  });
});

describe("native PowerPoint charts", () => {
  const chart = (o: object) => "```chart\n" + JSON.stringify(o) + "\n```\n";
  it("writes plain and call-out bar charts as editable charts, never as pictures", async () => {
    const bar = { type: "bar", title: "Close days", labels: ["EMEA", "APAC"], series: [{ name: "Today", values: [12, 9] }] };
    const markdown = "## Baseline\n\n" + chart(bar) + "\n## Bridge\n\n" + chart({ ...bar, highlight: "EMEA" });
    const files = unzip((await exportDocument({ format: "pptx", title: "Charts", markdown, images: [{ ref: "viz-1", png: PNG, width: 720, height: 400 }] }, null)).data);
    const charts = Object.keys(files).filter((n) => /^ppt\/charts\/chart\d+\.xml$/.test(n));
    expect(charts).toHaveLength(2);
    expect(text(files, charts[1])).toContain("EMEA");
    // The rendered picture of the call-out chart is not used: the slide carries the native chart instead.
    const pngs = (f: Record<string, Uint8Array>) => Object.keys(f).filter((n) => n.startsWith("ppt/media/")).length;
    const plain = unzip((await exportDocument({ format: "pptx", title: "Charts", markdown: "## Baseline\n\n" + chart(bar), images: [] }, null)).data);
    expect(pngs(files)).toBe(pngs(plain));
  });
});

describe("consulting deck layout", () => {
  it("keeps VOLT's deck theme in step with the consulting template skill", () => {
    const theme = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../.claude/skills/consulting-ppt-template/assets/theme.json"), "utf8"));
    for (const [k, v] of Object.entries(DECK.colors)) expect(theme.colors[k]).toBe(v);
    expect(theme.fonts).toMatchObject(DECK.fonts);
    for (const [k, v] of Object.entries(DECK.type_pt)) expect(theme.type_pt[k]).toBe(v);
    for (const [k, v] of Object.entries(DECK.grid)) expect(theme.grid[k]).toBe(v);
  });

  it("lays out a board pack without wasted or continuation slides", () => {
    const markdown = fs.readFileSync(path.resolve(__dirname, "fixtures/five-day-close.md"), "utf8");
    const plan = planDeck({ format: "pptx", title: "Five-day close", markdown });
    expect(checkPlan(plan)).toEqual([]);
    // Contents plus one slide per section: the waterfall and the process map are drawn natively, so no section
    // depends on a rendered picture.
    expect(plan.length).toBe(13);
    expect(plan[0].paras.length).toBe(12);
    expect(plan.some((s) => s.title.endsWith("(cont.)"))).toBe(false);
    expect(plan.every((s) => s.kind === "contents" || s.paras.length > 0 || s.exhibit)).toBe(true);
    // KPI tiles and the RAG heatmap are native shapes, and the NPV chart shares a slide with its table.
    const kinds = plan.map((s) => s.exhibit?.kind);
    expect(kinds).toContain("kpi");
    expect(kinds).toContain("heatmap");
    expect(plan.find((s) => s.title.startsWith("USD 1.6M"))?.second?.kind).toBe("chart");
    expect(kinds).toContain("process");
    expect(plan.some((s) => s.exhibit?.kind === "chart" && s.exhibit.spec.type === "waterfall")).toBe(true);
  });

  it("draws waterfalls, target lines, combos and process maps as editable shapes and charts, with no pictures", async () => {
    const chart = (o: object) => "```chart\n" + JSON.stringify(o) + "\n```\n";
    const markdown = fs.readFileSync(path.resolve(__dirname, "fixtures/five-day-close.md"), "utf8") +
      "\n## Target\n\n" + chart({ type: "bar", title: "Days", labels: ["A", "B"], series: [{ name: "Days", values: [12, 9] }], target: { value: 5, label: "Target" }, highlight: "A" }) +
      "\n## Combo\n\n" + chart({ type: "combo", title: "Journals", labels: ["Jan", "Feb"], series: [{ name: "Journals", values: [2400, 2100] }, { name: "Days", values: [12, 11] }] });
    const files = unzip((await exportDocument({ format: "pptx", title: "Close", markdown, images: [] }, null)).data);
    expect(Object.keys(files).filter((n) => n.startsWith("ppt/media/") && !n.endsWith("/"))).toEqual([]);
    const slides = Object.keys(files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).map((n) => text(files, n));
    // The bridge's bars and labels, and the process steps, are shapes with their own text.
    expect(slides.some((x) => x.includes("Target 5 days") && x.includes("ECL &amp; valuations pre-close"))).toBe(true);
    expect(slides.some((x) => x.includes("ECL true-up") && x.includes("CFO sign-off and period lock"))).toBe(true);
    const charts = Object.keys(files).filter((n) => /^ppt\/charts\/chart\d+\.xml$/.test(n)).map((n) => text(files, n));
    // A target is a dashed line series; a combo puts its line on a second value axis.
    expect(charts.some((c) => c.includes("<c:barChart>") && c.includes("<c:lineChart>") && c.includes("Target"))).toBe(true);
    expect(charts.some((c) => (c.match(/<c:valAx>/g) ?? []).length === 2 && c.includes("Journals"))).toBe(true);
  });
});

describe("consulting deck layout", () => {
  it("keeps VOLT's deck theme in step with the consulting template skill", () => {
    const theme = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../.claude/skills/consulting-ppt-template/assets/theme.json"), "utf8"));
    for (const [k, v] of Object.entries(DECK.colors)) expect(theme.colors[k]).toBe(v);
    expect(theme.fonts).toMatchObject(DECK.fonts);
    for (const [k, v] of Object.entries(DECK.type_pt)) expect(theme.type_pt[k]).toBe(v);
    for (const [k, v] of Object.entries(DECK.grid)) expect(theme.grid[k]).toBe(v);
  });

  it("lays out a board pack without wasted or continuation slides", () => {
    const markdown = fs.readFileSync(path.resolve(__dirname, "fixtures/five-day-close.md"), "utf8");
    const plan = planDeck({ format: "pptx", title: "Five-day close", markdown });
    expect(checkPlan(plan)).toEqual([]);
    // Contents plus one slide per section. Without rendered images the waterfall and process sections have nothing
    // to show, so they get no slide and no Contents entry: 10 of the fixture's 12 sections.
    expect(plan.length).toBe(11);
    expect(plan[0].paras.length).toBe(10);
    expect(plan.some((s) => s.title.endsWith("(cont.)"))).toBe(false);
    expect(plan.every((s) => s.kind === "contents" || s.paras.length > 0 || s.exhibit)).toBe(true);
    // KPI tiles and the RAG heatmap are native shapes, and the NPV chart shares a slide with its table.
    const kinds = plan.map((s) => s.exhibit?.kind);
    expect(kinds).toContain("kpi");
    expect(kinds).toContain("heatmap");
    expect(plan.find((s) => s.title.startsWith("USD 1.6M"))?.second?.kind).toBe("chart");
  });
});
