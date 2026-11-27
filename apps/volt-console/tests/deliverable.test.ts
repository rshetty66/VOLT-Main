import { describe, expect, it } from "vitest";
import { DEPTH_STANDARD, assessDepth, deliverableStandards, deliverableStructure, leadDeliverableGuide, specialistDeliverableGuide, strengthenPrompt, wantsDeliverable, directAsk } from "../server/deliverable";

describe("client deliverable guide", () => {
  it("reads the section list from run-client-deliverable.md", () => {
    const s = deliverableStructure() ?? "";
    expect(s.toLowerCase()).toContain("executive summary");
    expect(s.toLowerCase()).toContain("recommendations table");
    expect(s.toLowerCase()).toContain("next steps");
  });

  it("reads the writing standards without their frontmatter", () => {
    const s = deliverableStandards() ?? "";
    expect(s).toContain("Lead with the answer");
    expect(s.startsWith("---")).toBe(false);
  });

  it("tells the lead agent to write for the client, in that structure, with numbered sections", () => {
    const g = leadDeliverableGuide();
    expect(g).toContain("The final answer is a client deliverable");
    expect(g.toLowerCase()).toContain("executive summary");
    expect(g).toContain("Do not mention agents, specialists, tools");
    expect(g).toContain("Number the `##` sections");
  });

  it("gives specialists the same writing standard", () => {
    expect(specialistDeliverableGuide()).toContain("Lead with the answer");
  });

  it("adds nothing when the plugin files are missing", () => {
    expect(deliverableStructure("/nonexistent")).toBeNull();
    expect(leadDeliverableGuide("/nonexistent")).toBe("");
    expect(specialistDeliverableGuide("/nonexistent")).toBe("");
  });
});

const filler = (n: number) => Array.from({ length: n }, (_, i) => `Reconciliation effort fell 18% in cycle ${i + 1} against a 12 day baseline.`).join(" ");
const RICH = `# Five-day close

## 1. Executive summary

${filler(40)}

## 2. Findings

### Current-state baseline

${filler(60)}

**Exhibit 1: Close days against APQC** (FY25)

| Metric | Client | Median |
|---|---|---|
| Days to close | 12 | 6.5 |

Source: APQC, 2025.

**Exhibit 2: Root causes**

| Cause | Share |
|---|---|
| Reconciliation | 45% |

Source: client close calendar.

## 3. Recommendations

| Recommendation | Priority |
|---|---|
| Standardise the calendar | High |

### Business case

NPV of CAD 4.2M, payback 18 months. ${filler(60)}

**Exhibit 3: Options scored**

### Roadmap

Phase 1 mobilise, with milestones. ${filler(60)}

## 4. Key risks and assumptions

${filler(40)}

## 5. Next steps

${filler(20)}

\`\`\`chart
{"type":"bar","title":"Close days","labels":["Today","Target"],"series":[{"name":"Days","values":[12,5]}]}
\`\`\`

\`\`\`chart
{"type":"donut","title":"Value by lever","labels":["Automation","Standardisation"],"series":[{"name":"M","values":[3,2]}]}
\`\`\`

\`\`\`mermaid
flowchart LR
  A --> B
\`\`\`

\`\`\`mermaid
gantt
  title Roadmap
  section P1
  Mobilise :2026-01-01, 30d
\`\`\`
`;

describe("depth check", () => {
  it("counts fenced charts and diagrams, and asks for four", () => {
    expect(assessDepth(RICH).visuals).toBe(4);
    const few = assessDepth("```mermaid\nflowchart LR\n A-->B\n```\n");
    expect(few.visuals).toBe(1);
    expect(few.gaps.join(" ")).toContain("at least four");
  });

  it("passes a full deliverable", () => {
    const r = assessDepth(RICH);
    expect(r.gaps).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("names what a thin, high-level answer lacks", () => {
    const r = assessDepth("## Synthesis\n\nA five-day close is achievable. Standardise the calendar and automate reconciliations.");
    expect(r.ok).toBe(false);
    const g = r.gaps.join(" | ");
    expect(g).toContain("words");
    expect(g).toContain("missing a business case");
    expect(g).toContain("missing a roadmap");
    expect(g).toContain("table");
    expect(g).toContain("Source line");
  });

  it("flags references to specialists or tools, which the client must not see", () => {
    expect(assessDepth(RICH + "\nThe specialists agreed that close takes too long.").gaps.join(" ")).toContain("specialists");
  });

  it("ignores diagram code when counting words", () => {
    expect(assessDepth("```mermaid\n" + "a --> b\n".repeat(3000) + "```").words).toBeLessThan(5);
  });

  it("only asks for a full deliverable when the request calls for one", () => {
    expect(wantsDeliverable("Build a plan to cut the close from 12 days to 5")).toBe(true);
    expect(wantsDeliverable("We are a Canadian bank with 40 entities on SAP and want to know where the capital reporting risks are across the group this year")).toBe(true);
    expect(wantsDeliverable("What is DSO?")).toBe(false);
    expect(wantsDeliverable("/compare Oracle and SAP")).toBe(false);
  });

  it("answers a lookup directly instead of escalating it into a deliverable", () => {
    const td = "s\nlist the quarterly results documents on the TD investor relations page I added, with their dates, and cite each one by its source key";
    expect(directAsk(td)).toBe(true);
    expect(wantsDeliverable(td)).toBe(false);
    expect(directAsk("Using only this project's knowledge base, list the quarterly results documents on the TD page I added, with their dates")).toBe(true);
    expect(directAsk("Which entities in the trial balance have a suspense balance?")).toBe(true);
    expect(directAsk("What should we do to cut the close from 12 days to 5?")).toBe(false);
    expect(directAsk("Build a plan to cut the close from 12 days to 5")).toBe(false);
    expect(directAsk("Give me a CSV of the APQC close benchmarks")).toBe(false);
    expect(directAsk("/compare Oracle and SAP")).toBe(false);
  });

  it("sends the gaps back in the rewrite instruction", () => {
    const p = strengthenPrompt(assessDepth("thin"));
    expect(p.startsWith("Partner review")).toBe(true);
    expect(p).toContain("missing a roadmap");
  });

  it("puts the depth and differentiation standard in the lead's instructions", () => {
    expect(leadDeliverableGuide()).not.toContain(DEPTH_STANDARD);
    expect(leadDeliverableGuide(undefined,true)).toContain(DEPTH_STANDARD);
    expect(DEPTH_STANDARD).toContain("3,500 to 6,000 words");
    expect(DEPTH_STANDARD).toContain("Never invent credentials");
    expect(DEPTH_STANDARD).toContain("gantt");
  });
});
