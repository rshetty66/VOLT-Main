import { describe, expect, it } from "vitest";
import { findPcfElement, lookupPcf, PCF_GUIDE, PCF_SOURCE_LINE, pcfDetail, searchPcf } from "../server/pcf";
import { loadCatalog } from "../server/catalog";
import { ORCHESTRATOR_TOOLS, runLocalTool, schemas, SPECIALIST_TOOLS, CONSULTED_TOOLS } from "../server/tools";

describe("APQC PCF lookup", () => {
  it("carries APQC's copyright notice, as the licence requires", () => {
    expect(PCF_SOURCE_LINE).toMatch(/2026 APQC\. ALL RIGHTS RESERVED/);
    expect(PCF_SOURCE_LINE).toMatch(/provided that all copies of the PCF and any derivative works contain a copy of this notice/);
    expect(lookupPcf({ query: "9.3" }).source.notice).toMatch(/APQC/);
  });

  it("finds an element by PCF ID, by hierarchy ID and by category number", () => {
    expect(findPcfElement("10824")?.hierarchyId).toBe("9.3.2.6");
    expect(findPcfElement("[10824]")?.name).toBe("Reconcile general ledger accounts");
    expect(findPcfElement("9.3")?.pcfId).toBe(10730);
    expect(findPcfElement("9")?.name).toBe("Manage Financial Resources");
    expect(findPcfElement("99999")).toBeNull();
    expect(findPcfElement("close")).toBeNull();
  });

  it("returns lineage, children and metric definitions for one element", () => {
    const d = pcfDetail(findPcfElement("9.3.2")!);
    expect(d.cite).toBe("9.3.2 Perform general accounting [10748]");
    expect(d.lineage).toEqual(["9.0 Manage Financial Resources [17058]", "9.3 Perform general accounting and reporting [10730]"]);
    expect(d.children).toContain("9.3.2.6 Reconcile general ledger accounts [10824]");
    const cat = pcfDetail(findPcfElement("9.0")!);
    expect(cat.lineage).toEqual([]);
    expect(cat.children[0]).toMatch(/^9\.1 /);
    expect(cat.metrics_total).toBeGreaterThan(0);
    expect(cat.metrics[0]).toHaveProperty("formula");
  });

  it("ranks processes from plain words, across word forms", () => {
    expect(searchPcf("general ledger reconciliation", 3).map((e) => e.pcfId)).toContain(10824);
    expect(searchPcf("consolidation eliminations", 3).map((e) => e.pcfId)).toContain(10825);
    expect(searchPcf("intercompany", 5, "9.0").every((e) => e.hierarchyId.startsWith("9."))).toBe(true);
    expect(searchPcf("the and of")).toEqual([]);
  });

  it("runs as an agent tool that every lead and specialist has", () => {
    const catalog = loadCatalog();
    const input = schemas.apqc_pcf.parse({ query: "process journal entries", within: "9.0" });
    const r = runLocalTool(catalog, "apqc_pcf", input);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.summary).toContain("[10820]");
    for (const list of [ORCHESTRATOR_TOOLS, SPECIALIST_TOOLS, CONSULTED_TOOLS]) expect(list).toContain("apqc_pcf");
    expect(PCF_GUIDE).toMatch(/Never write a PCF ID the tool did not return/);
  });
});
