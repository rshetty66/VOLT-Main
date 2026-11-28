import { describe, expect, it } from "vitest";
import { activities, CONTAINERS, REFERENCE_MODEL, validateFinanceModel, type FinanceModel } from "../shared/financeReference";
import { taxonomyCounts } from "../shared/views";
import { findPcfElement } from "../server/pcf";
import { financeViewsHtml } from "../src/diagrams/financeViews";
import template from "../src/diagrams/finance-views.html?raw";

const pcfExists = (id: string) => findPcfElement(id) !== null;
const clone = (): FinanceModel => structuredClone(REFERENCE_MODEL);

describe("finance reference model", () => {
  it("matches Master Prompt v3: 58 components, 15 steps, the 5-cycle taxonomy", () => {
    const m = REFERENCE_MODEL;
    expect(Object.keys(m.components)).toHaveLength(58);
    expect(m.steps).toHaveLength(15);
    const counts = m.taxonomy.map(taxonomyCounts);
    expect(m.taxonomy).toHaveLength(5);
    expect(counts.reduce((n, c) => n + c.l2, 0)).toBe(20);
    expect(counts.reduce((n, c) => n + c.l3, 0)).toBe(22);
    expect(activities(m)).toHaveLength(68);
    expect(counts.reduce((n, c) => n + c.high, 0)).toBe(23);
    expect(counts.reduce((n, c) => n + c.moderate, 0)).toBe(25);
  });

  it("puts 11 agents on 17 components and covers 29 activities", () => {
    const m = REFERENCE_MODEL;
    expect(m.agents).toHaveLength(11);
    expect(new Set(m.agents.flatMap((a) => a.on)).size).toBe(17);
    expect(new Set(m.agents.flatMap((a) => a.activities)).size).toBe(29);
  });

  it("has every link resolvable, including each APQC PCF id", () => {
    expect(validateFinanceModel(REFERENCE_MODEL, pcfExists)).toEqual([]);
    for (const keys of Object.values(CONTAINERS)) for (const k of keys) expect(REFERENCE_MODEL.components).toHaveProperty(k);
  });

  it("names each broken link", () => {
    const m = clone();
    m.steps[2].on = ["nope"];
    m.steps[3].chips = [{ target: "op_detbal", segments: "x" }];
    m.agents[1].id = m.agents[0].id;
    m.agents[2].on.push("ghost");
    m.agents[3].activities.push("Invented activity");
    m.capabilities[0].name = "Not a group";
    m.taxonomy[0].groups[0].processes[0].pcf = "99.99.99";
    const errs = validateFinanceModel(m, pcfExists).join("\n");
    for (const s of ['unknown "nope"', 'segments "x"', "used twice", 'unknown component "ghost"', '"Invented activity"', '"Not a group" is not an L2 group', 'L2 group "General Ledger & Journals" has no capability', "99.99.99"]) expect(errs).toContain(s);
  });
});

describe("finance views page", () => {
  it("embeds the model as inert JSON and keeps the title escaped", () => {
    const m = clone();
    m.title = 'Bank <script>alert(1)</script> & "co"';
    m.agents[0].does = "</script><img src=x onerror=alert(1)>";
    const html = financeViewsHtml(m);
    expect(html).not.toContain("__MODEL__");
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("</script><img");
    expect(html).toContain("<title>Bank &lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;co&quot;</title>");
  });

  it("follows the v3 build rules: no innerHTML, no inline handlers, APQC notice, tour", () => {
    expect(template).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
    expect(template).not.toMatch(/\son[a-z]+="/);
    expect(template).toContain("©2026 APQC. ALL RIGHTS RESERVED");
    expect(template).toMatch(/prefers-reduced-motion:reduce/);
    expect(template).toContain('id="tourb"');
    expect(template.match(/^ \["/gm)).toHaveLength(6);
  });
});
