import {describe,it,expect} from "vitest";
import {loadDeliverablePatterns,pickPatterns,deliverablePatternGuide} from "../server/deliverablePatterns";

const library=loadDeliverablePatterns();
describe("deliverable pattern library",()=>{
  it("keeps a distinct, traceable pattern and editorial brief for each original",()=>{
    expect(library).toHaveLength(16);
    expect(new Set(library.map(p=>p.source)).size).toBe(16);
    expect(new Set(library.map(p=>p.id)).size).toBe(16);
    for(const p of library){
      expect(p.source).toMatch(/\.pdf$/); expect(p.pages).toMatch(/\d/);
      for(const x of [p.idea,p.outline,p.exhibit,p.depth])expect(x.length).toBeGreaterThan(30);
      expect(pickPatterns("Create a "+p.title,library)[0]?.id).toBe(p.id);
    }
  });
  it.each([
    ["Give the board a five-year financial plan","financial-plan"],
    ["Audit management's benefits realization claims","benefits-validation"],
    ["Write a change order for the next phase","scope-change"],
    ["Write a forecast methodology note for the CFO","forecast-vintages"],
    ["Assess the revenue shock this quarter","shock-assessment"],
    ["Explain our demand and revenue under alternative paths","demand-outlook"],
    ["Validate these savings for the controller","benefits-validation"],
    ["Build a savings case for procurement","procurement-case"],
    ["Why did the forecast change since the spring release?","forecast-vintages"],
  ])("routes %s", (q,id)=>expect(pickPatterns(q,library)[0]?.id).toBe(id));
  it("keeps examples out of client claims and irrelevant tasks",()=>{
    const guide=deliverablePatternGuide("Create a procurement business case");
    expect(guide).toContain("Signature exhibit:");expect(guide).toContain("not a factual source");
    expect(guide).not.toContain(".pdf");expect(guide).not.toContain("Deloitte");
    expect(deliverablePatternGuide("What is a debit?")).toBe("");
    expect(deliverablePatternGuide("Give me a revenue shock assessment","/nonexistent")).toBe("");
    expect(deliverablePatternGuide("Suggest deliverable ideas for a new engagement")).toContain("Forecast vintage and methodology guide");
  });
});
