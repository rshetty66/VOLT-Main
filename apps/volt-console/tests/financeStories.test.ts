import {it,expect} from "vitest";
import {financeStories,financeDiagram,type FinanceProfile} from "../shared/financeStories";
import {optimizeDiagramBrief} from "../shared/diagramBrief";

for(const k of Object.keys(financeStories) as FinanceProfile[])it(`traces ${k} to an owner or stops on missing evidence`,()=>{
  const s=financeStories[k],d=financeDiagram(k),[decision,stop]=d.scenarios!;
  expect(decision.steps.map(step=>step.note)).toEqual([...s.chapters]);
  expect(decision.steps[0].payload).toMatchObject({reference:s.ref,synthetic:true,...s.records});
  expect(decision.steps.at(-1)?.edge).toBe("owner>action");expect(stop.steps.at(-1)?.edge).toBe("verify>hold");
});
it("preserves named systems and literal client mandates",()=>{
  const brief=optimizeDiagramBrief("Hold disputed invoices","SAP S/4HANA and Coupa","Never post automatically; CAD 5,000.00 maximum.");
  expect(brief).toContain("SAP S/4HANA and Coupa");expect(brief).toContain("Never post automatically; CAD 5,000.00 maximum.");expect(brief).toContain("Assumptions (not client facts)");
});
it("does not invent systems or limits when intake is empty",()=>{
  const brief=optimizeDiagramBrief("Explain the close","","");expect(brief).toContain("assume no vendor");expect(brief).toContain("never invent");expect(brief).not.toMatch(/SAP|Oracle|\?/);
});
