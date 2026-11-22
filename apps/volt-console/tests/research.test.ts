import { describe, expect, it } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { WEIGHTS, citedKeys, classifyDepth, confidence, evidenceGates, labelFor, recency, registryJsonl, sectionOf, sourceRegisterMarkdown, type SourceRecord } from "../shared/research";

const S: SourceRecord[] = [
  { key: "S01", title: "Client request and intake", publisher: "Client", date: "2026-11", type: "client input", authority: 8 },
  { key: "S02", title: "APQC benchmark: days_to_close", publisher: "APQC (VOLT benchmark table)", date: "n/d", type: "benchmark table", authority: 7 },
  { key: "S03", title: "Value case (client-supplied inputs)", publisher: "VOLT analytics", date: "2026-11", type: "calculation", authority: 6 },
];

const GOOD = `## 1. Executive summary

The close takes 12 days against a 6.5 day median [S02]. (Confidence: HIGH, as of 2026-11)

## 2. Findings

Reconciliation drives the gap [S01] [S03]. (Confidence: MEDIUM, as of 2026-11) The saving is about CAD 4.2M a year [S03]. (Confidence: MEDIUM, as of 2026-11) Intercompany matching is probably manual [INFERENCE].

## 6. Evidence and method

### Scope and method

Depth tier DEEP. Sources are the client's data, the APQC table and the VOLT calculators.

### Contradictions and tensions

None identified.

### Gaps and limitations

No ledger extract was provided.

### Residue

One claim about intercompany volumes could not be sourced and was removed.
`;

describe("depth tiers", () => {
  it("reads depth from the request's language", () => {
    expect(classifyDepth("Give me an exhaustive review of our close for the board")).toBe("EXHAUSTIVE");
    expect(classifyDepth("Build a business case for a five day close")).toBe("DEEP");
    expect(classifyDepth("What is DSO?")).toBe("QUICK");
    expect(classifyDepth("Compare Oracle and SAP for our group")).toBe("STANDARD");
  });
});

describe("confidence model", () => {
  it("weights sum to 1.00", () => {
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });

  it("can be reproduced by hand", () => {
    // 0.9*0.40 + 0.8*0.25 + 0.7*0.20 + 1.0*0.15 = 0.36 + 0.20 + 0.14 + 0.15 = 0.85
    expect(confidence({ evidence: 0.9, quality: 0.8, recency: 0.7, agreement: 1 })).toEqual({ score: 0.85, label: "HIGH" });
    // 0.6*0.40 + 0.5*0.25 + 0.5*0.20 + 0.5*0.15 = 0.24 + 0.125 + 0.10 + 0.075 = 0.54
    expect(confidence({ evidence: 0.6, quality: 0.5, recency: 0.5, agreement: 0.5 })).toEqual({ score: 0.54, label: "LOW" });
  });

  it("labels at the stated boundaries", () => {
    expect([labelFor(0.8), labelFor(0.79), labelFor(0.55), labelFor(0.54)]).toEqual(["HIGH", "MEDIUM", "MEDIUM", "LOW"]);
  });

  it("rejects an input out of range, and weights that do not sum to 1, instead of guessing", () => {
    expect(() => confidence({ evidence: 1.2, quality: 0.5, recency: 0.5, agreement: 0.5 })).toThrow(/between 0 and 1/);
    expect(() => confidence({ evidence: 1, quality: 1, recency: 1, agreement: 1 }, { evidence: 0.5, quality: 0.5, recency: 0.5, agreement: 0.5 })).toThrow(/sum to 1/);
  });

  it("halves recency every half-life, and scores an undated source low", () => {
    const asOf = new Date("2026-11-22T00:00:00Z");
    expect(recency("2026-11", 12, asOf)).toBe(1);
    expect(recency("2025-11", 12, asOf)).toBe(0.5);
    expect(recency("2024-11", 12, asOf)).toBe(0.25);
    expect(recency("n/d", 12, asOf)).toBe(0.3);
  });
});

describe("evidence gates", () => {
  it("pass a well-evidenced draft", () => {
    const gates = evidenceGates(GOOD, S, "DEEP");
    expect(gates.map((g) => [g.id, g.pass])).toEqual([["G1", true], ["G2", true], ["G3", true], ["G4", true], ["G5", true], ["G6", true]]);
  });

  it("do not gate a QUICK answer", () => {
    expect(evidenceGates("DSO is days sales outstanding.", S, "QUICK")).toEqual([]);
  });

  it("G1 blocks a citation that is not in the register (the negative case that must fire)", () => {
    const g = evidenceGates(GOOD + "\nThe market is growing [S09].", S, "DEEP").find((x) => x.id === "G1")!;
    expect(g.pass).toBe(false);
    expect(g.detail).toContain("[S09]");
  });

  it("G1 flags figures with no source key or tag", () => {
    const bare = GOOD.replace("[S02]", "").replace("[S03]. (Confidence: MEDIUM", ". (Confidence: MEDIUM") + "\nCosts fell 30% in a year. Staff fell 12% too. Cycle time fell 4 days. A further 9% followed.";
    const g = evidenceGates(bare, S, "EXHAUSTIVE").find((x) => x.id === "G1")!;
    expect(g.pass).toBe(false);
    expect(g.detail).toContain("no source key");
  });

  it("G2 wants more than one kind of source", () => {
    const one = GOOD.replaceAll("[S01]", "[S03]").replaceAll("[S02]", "[S03]");
    expect(evidenceGates(one, S, "DEEP").find((x) => x.id === "G2")!.pass).toBe(false);
  });

  it("G3 to G5 name the missing section", () => {
    const stripped = GOOD.replace(/### Contradictions and tensions[\s\S]*?(?=### Gaps)/, "").replace(/### Residue[\s\S]*$/, "").replace("### Scope and method", "### Notes");
    const gates = evidenceGates(stripped, S, "DEEP");
    expect(gates.find((g) => g.id === "G3")!.detail).toContain("Contradictions and tensions");
    expect(gates.find((g) => g.id === "G4")!.detail).toContain("Residue");
    expect(gates.find((g) => g.id === "G5")!.detail).toContain("Scope and method");
  });

  it("G6 fails an empty deliverable", () => {
    expect(evidenceGates("  ", S, "STANDARD").find((g) => g.id === "G6")!.pass).toBe(false);
  });
});

describe("registry output", () => {
  it("lists the keys a text cites", () => {
    expect(citedKeys(GOOD)).toEqual(["S02", "S01", "S03"]);
  });

  it("writes the register as a table and as JSON lines, one record per source", () => {
    const md = sourceRegisterMarkdown(S);
    expect(md).toContain("## Source register");
    expect(md).toContain("| S02 | APQC benchmark: days_to_close | APQC (VOLT benchmark table) | n/d | benchmark table | 7 |");
    expect(sourceRegisterMarkdown([])).toBe("");
    const lines = registryJsonl(S).trim().split("\n");
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[1]).key).toBe("S02");
  });

  it("extracts a section by its title", () => {
    expect(sectionOf(GOOD, /residue/)).toContain("could not be sourced");
    expect(sectionOf(GOOD, /nothing here/)).toBeNull();
  });
});

describe("the run's research record", () => {
  const fold = async () => {
    const { applyEvent, newRun } = await import("../src/runState");
    const events = [
      { type: "research", tier: "DEEP" },
      ...S.map((record) => ({ type: "source", record })),
      { type: "source", record: S[1] }, // a repeat must not duplicate
      { type: "tool_call", lane: "rudra", callId: "c1", name: "apqc_benchmark", input: { metric: "days_to_close" } },
      { type: "text_delta", lane: "rudra", text: GOOD },
    ] as import("../shared/events").VoltEvent[];
    return events.reduce(applyEvent, newRun("Build a business case for a five day close", "Rudra", "orchestrate"));
  };

  it("folds the research and source events into the run, once each", async () => {
    const run = await fold();
    expect(run.tier).toBe("DEEP");
    expect(run.sources.map((s) => s.key)).toEqual(["S01", "S02", "S03"]);
  });

  it("appends the source register to every download's text, so each key resolves", async () => {
    const { runDeliverable } = await import("../src/exports");
    const d = runDeliverable(await fold(), false);
    expect(d.markdown).toContain("## Source register");
    expect(d.markdown).toContain("| S03 |");
  });

  it("adds no register to a run that recorded no evidence", async () => {
    const { applyEvent, newRun } = await import("../src/runState");
    const { runDeliverable } = await import("../src/exports");
    const run = applyEvent(newRun("p", "t", "agent"), { type: "text_delta", lane: "rudra", text: "A plain answer." });
    expect(runDeliverable(run, false).markdown).not.toContain("Source register");
  });

  it("builds a research bundle: the report, the registry, the gate results and the search log", async () => {
    const { researchBundle, runDeliverable } = await import("../src/exports");
    const files = unzipSync(researchBundle(runDeliverable(await fold(), false), new Date("2026-11-22T00:00:00Z")));
    expect(Object.keys(files).sort()).toEqual(
      ["analysis/gates.json", "analysis/search-log.md", "contradictions.md", "executive-brief.md", "full-report.md", "query.md", "residue.md", "sources/registry.jsonl"].map((f) => `research/${f}`).sort(),
    );
    const text = (f: string) => strFromU8(files[`research/${f}`]);
    expect(text("query.md")).toContain("Depth tier: DEEP");
    expect(text("sources/registry.jsonl").trim().split("\n")).toHaveLength(3);
    const gates = JSON.parse(text("analysis/gates.json"));
    expect(gates).toMatchObject({ tier: "DEEP", asOf: "2026-11-22", total: 6 });
    expect(gates.passed).toBe(6);
    expect(text("executive-brief.md")).toContain("6.5 day median");
    expect(text("residue.md")).toContain("could not be sourced");
    expect(text("analysis/search-log.md")).toContain("apqc_benchmark");
  });
});
