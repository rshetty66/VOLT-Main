import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { loadCatalog } from "../server/catalog";
import { runLocalTool, CONSULTED_TOOLS, ORCHESTRATOR_TOOLS, SPECIALIST_TOOLS } from "../server/tools";
import { madeFile } from "../server/orchestrator";
import { highStakes } from "../server/router";
import { checkHub, hubSchema, type HubContent } from "../shared/accountingHub";
import { hubPage } from "../shared/accountingHubPage";
import { cardDeliverable } from "../src/components/FileCards";
import type { FileSpec } from "../shared/files";

const catalog = loadCatalog();
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/accounting-hub-sample.json"), "utf8"));
const sample = (): HubContent => hubSchema.parse(structuredClone(raw));
const fails = (c: HubContent) => checkHub(c, hubPage(c));

describe("Accounting Hub page", () => {
  it("draws the synthetic sample with every check passing", () => {
    const html = hubPage(sample());
    expect(fails(sample())).toEqual([]);
    expect(html).toMatch(/^<!doctype html>\n<html lang="en">/);
    for (const n of [1, 2, 3, 4, 5]) expect(html).toContain(`<section class="tab" id="s${n}">`);
    expect(html.length).toBeGreaterThan(60_000);
  });

  it("puts arrow markers in one hidden SVG and gives every diagram the class the CSS targets", () => {
    const html = hubPage(sample());
    expect(html.match(/<marker /g)?.length).toBe(5);
    expect(html.indexOf("<marker ")).toBeLessThan(html.indexOf("<header>"));
    for (const id of ["t1-svg", "t2-svg", "t3-svg"]) expect(html).toContain(`<svg class="dg" id="${id}"`);
  });

  it("names no consulting firm and shows prior-delivery proof only when approved", () => {
    const html = hubPage(sample());
    expect(html).not.toMatch(/pwc|pricewaterhouse/i);
    expect(html).not.toContain("digital bank");
    const approved = { ...sample(), prior_proof_approved: true };
    expect(hubPage(approved)).toContain("a Canadian digital bank (client anonymised)");
  });

  it("rejects an unbalanced journal, per ledger", () => {
    const c = sample();
    const ecl = c.maf.products[0].stages.flatMap((s) => s.events).find((e) => e.id === "c-ecl")!;
    ecl.lines[3].factor = 0.02;
    expect(fails(c).join()).toMatch(/c-ecl|ECL allowance top-up \(US GAAP delta\): journal does not balance/);
  });

  it("rejects an excluded name anywhere on the page", () => {
    const c = sample();
    c.today.systems[0].role = "Card processor fed from SAP.";
    expect(fails(c)).toContain("Excluded name 'SAP' appears on the page; remove it everywhere.");
    c.today.systems[0].role = "Prepared with PwC.";
    expect(fails(c).join()).toMatch(/Excluded name 'PwC'/);
  });

  it("needs an exception event, a source for validated claims and text counts that match the catalogue", () => {
    const c = sample();
    for (const s of c.maf.products[1].stages) for (const e of s.events) e.exception = false;
    c.today.systems[0].status = "source_validated";
    c.maf.so_what.text = "12 events are manual today.";
    const f = fails(c).join("\n");
    expect(f).toMatch(/Instalment loans: add at least one exception event/);
    expect(f).toMatch(/needs a source from evidence/);
    expect(f).toMatch(/12 manual events, but the catalogue has 9/);
  });

  it("escapes content and keeps it out of inline handlers", () => {
    const c = sample();
    c.today.systems[0].name = "<img src=x onerror=alert(1)>";
    const html = hubPage(c);
    expect(html).not.toContain("<img src=x");
    expect(html).not.toMatch(/<\/script>[\s\S]*<\/script>[\s\S]*<\/script>/);
    expect(fails(c).some((f) => /inline event handler/.test(f))).toBe(false);
  });
});

describe("build_accounting_hub tool", () => {
  it("is offered to the lead and to a specialist talking to the user, not to consulted specialists", () => {
    expect(ORCHESTRATOR_TOOLS).toContain("build_accounting_hub");
    expect(SPECIALIST_TOOLS).toContain("build_accounting_hub");
    expect(CONSULTED_TOOLS).not.toContain("build_accounting_hub");
  });

  it("returns the page as a file card, or every failure to fix", () => {
    const ok = runLocalTool(catalog, "build_accounting_hub", { content: raw });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    const spec = ok.data as FileSpec;
    expect(spec).toMatchObject({ format: "html", title: "Northwind Consumer Finance Accounting Hub on Data Fabric" });
    expect(ok.reply).toMatch(/review items[\s\S]*accounting policy: Agree the GL posting grain/);
    expect(cardDeliverable(spec, [spec]).hub?.client.name).toBe("Northwind Consumer Finance");

    const bad = runLocalTool(catalog, "build_accounting_hub", { content: { ...raw, client: { name: "X" } } });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toMatch(/client\.type/);
  });

  it("counts as the file this turn and routes the lead to Opus", () => {
    expect(madeFile([{ role: "assistant", content: [{ type: "tool_use", id: "t1", name: "build_accounting_hub", input: {} }] }])).toBe(true);
    expect(highStakes("We need an accounting hub and a master accounting flow for our cards")).toBe(true);
  });

  it("has every content field documented in the skill", () => {
    const skill = fs.readFileSync(path.join(__dirname, "../../../plugins/volt/skills/accounting-hub-page/SKILL.md"), "utf8");
    for (const k of Object.keys(hubSchema.shape)) expect(skill).toContain(`\`${k}\``);
  });
});
