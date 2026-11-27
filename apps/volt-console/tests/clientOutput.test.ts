import {describe,it,expect} from "vitest";
import {cleanTitle,editorialBlocker,wantsLongReport} from "../shared/clientOutput";
import {clientReferences,evidenceGates,type SourceRecord} from "../shared/research";
import {loadCatalog} from "../server/catalog";
import {runLocalTool,schemas} from "../server/tools";
import {FILE_FORMATS} from "../shared/files";

describe("client delivery defaults",()=>{
  const src:SourceRecord[]=["S01","S02"].map(key=>({key,title:key==="S01"?"Private intake":"Published report",type:"report",date:"2026-10",authority:7,publisher:"Institution"}));
  it("resolves cited sources only, without internal scores",()=>{
    const refs=clientReferences("Quarterly disclosure [S02].",src);
    expect(refs).toContain("Published report");expect(refs).not.toMatch(/Private intake|Authority|S01/);
    expect(clientReferences("No citations",src)).toBe("");
  });
  it("keeps citation checks without requiring working-paper headings in client mode",()=>{
    const gates=evidenceGates("See [S99].",src,"DEEP",false);
    expect(gates.find(g=>g.id==="G1")?.pass).toBe(false);expect(gates.map(g=>g.id)).toEqual(["G1","G2","G6"]);
    expect(evidenceGates("See [S99].",src,"DEEP").length).toBe(6);
  });
  it("does not confuse brevity, caveats or estimates with incomplete work",()=>{
    expect(cleanTitle("**Context & Business Ask**")).toBe("Context & Business Ask");
    expect(editorialBlocker("Costs are illustrative. Actual costs were not available.")).toBeUndefined();
    expect(wantsLongReport("One-page summary of our detailed assessment")).toBe(false);
    expect(wantsLongReport("Prepare a comprehensive assessment")).toBe(true);
  });
  const catalog=loadCatalog();
  it("rejects a plausible-looking file citation missing from the run",()=>{
    const input=schemas.create_file.parse({format:"slides",title:"Market outlook",markdown:"A conclusion [S99]."});
    expect(runLocalTool(catalog,"create_file",input,src).ok).toBe(false);
  });
  it.each(FILE_FORMATS)("rejects unresolved file copy before offering a %s card",format=>{
    const input=schemas.create_file.parse({format,title:"Decision",markdown:"Act now [Verify]."});
    expect(runLocalTool(catalog,"create_file",input).ok).toBe(false);
  });
  it("rejects the recall-only formulation seen in the market deck",()=>{
    expect(editorialBlocker("Every deal was compiled from recall of public announcements.")).toBeTruthy();
  });
});
