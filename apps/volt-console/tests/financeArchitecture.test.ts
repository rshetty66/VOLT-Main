import { describe, expect, it } from "vitest";
import { demoDocuments, multiBasisAllowance, runValidator } from "../server/financeArchitecture";

const failed = (r: { checks: { check_id: string; status: string }[] }) => r.checks.filter((c) => c.status === "FAIL").map((c) => c.check_id);

describe("finance architecture demo", () => {
  const demo = demoDocuments();

  it("ships the synthetic golden case and lifecycle reference from the skill", () => {
    expect(demo.journal.lines).toHaveLength(8);
    expect(demo.lifecycle).toMatch(/Numerical origination golden case/);
  });

  it("validates the mortgage golden case with honest NOT_RUN scope", async () => {
    const r = await runValidator("journal", demo.journal);
    expect(r.status).toBe("VALIDATED_SCOPED");
    expect(failed(r)).toEqual([]);
    const notRun = r.checks.filter((c) => c.status === "NOT_RUN").map((c) => c.check_id);
    expect(notRun).toEqual(expect.arrayContaining(["POLICY_ACCURACY", "APPROVED_MEASUREMENT", "GOLDEN_CASE_MATCH", "AUTHORIZATION"]));
  });

  it("fails a journal changed by one cent", async () => {
    const doc = structuredClone(demo.journal);
    doc.lines[0].debit = "500000.01";
    const r = await runValidator("journal", doc);
    expect(r.status).toBe("BLOCKED");
    expect(failed(r)).toContain("J_BALANCE");
  });

  it("validates the mapping demo", async () => {
    const r = await runValidator("mapping", demo.mapping);
    expect(r.status).toBe("VALIDATED_SCOPED");
  });

  it("reports unreadable input instead of throwing", async () => {
    const r = await runValidator("mapping", "not an object");
    expect(r.status).toBe("BLOCKED");
    expect(failed(r)).toContain("M_STRUCTURE");
  });

  it("computes the IFRS / CECL full-book and delta allowances", () => {
    expect(multiBasisAllowance({ preAllowance: "498000", ifrsAllowance: "2000", ceclAllowance: "10000" })).toEqual({
      ifrsNet: "496000",
      usNet: "488000",
      fullBookPosting: "10000",
      deltaPosting: "8000",
      doubleCountedNet: "486000",
    });
  });
});
