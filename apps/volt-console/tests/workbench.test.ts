import { describe, expect, it } from "vitest";
import { demoDocuments, runValidator } from "../server/financeArchitecture";
import {
  SAMPLE_CSV,
  addLine,
  evidenceMarkdown,
  intentOf,
  mappingFromCsv,
  parseCsv,
  removeLine,
  runStatus,
  sumUsage,
  withUsDeltaOverlay,
  type Report,
} from "../src/workbench/logic";

const report = (status: string, failed: string[] = []): Report => ({
  status,
  run_id: `run-${status}`,
  input_manifest_hash: "a".repeat(64),
  checks: [
    ...failed.map((c) => ({ check_id: c, status: "FAIL" as const, scope: "s" })),
    { check_id: "POLICY_ACCURACY", status: "NOT_RUN" as const, scope: "policy review" },
  ],
  blockers: failed.map((c) => `${c}: broken`),
  limitations: ["offline only"],
});

describe("run status chip", () => {
  it("is NOT_RUN before any validation", () => expect(runStatus()).toBe("NOT_RUN"));
  it("is PARTIAL when only one proof has run and passed", () => expect(runStatus(report("VALIDATED_SCOPED"))).toBe("PARTIAL"));
  it("is VALIDATED_SCOPED only when both proofs pass", () =>
    expect(runStatus(report("VALIDATED_SCOPED"), report("VALIDATED_SCOPED"))).toBe("VALIDATED_SCOPED"));
  it("is BLOCKED when any proof fails", () => expect(runStatus(report("VALIDATED_SCOPED"), report("BLOCKED", ["M_WEIGHTS"]))).toBe("BLOCKED"));
});

describe("CSV parsing", () => {
  it("handles quotes, CRLF and blank lines", () => {
    expect(parseCsv('a,b\r\n"x, y","he said ""hi"""\r\n\r\n1,2\n')).toEqual([
      { a: "x, y", b: 'he said "hi"' },
      { a: "1", b: "2" },
    ]);
  });
  it("trims header and cell whitespace", () => expect(parseCsv(" Account , balance \n 100 , 5 ")).toEqual([{ account: "100", balance: "5" }]));
});

describe("mapping from CSV", () => {
  it("builds a document the mapping validator accepts", async () => {
    const built = mappingFromCsv("SYNTHETIC", SAMPLE_CSV);
    expect(built.errors).toEqual([]);
    const r = await runValidator("mapping", built.document);
    expect(r.status).toBe("VALIDATED_SCOPED");
  });

  it("supports retirement rows and derives the target chart from the target balances", () => {
    const built = mappingFromCsv("SYNTHETIC", { ...SAMPLE_CSV, mapping: `${SAMPLE_CSV.mapping}\n199,,RETIRE` });
    expect(built.document.mapping.find((m) => m.source === "199")).toEqual({ source: "199", retire: true });
    expect(built.document.target_accounts).toEqual(["LOANS", "CASH", "ALLOWANCE", "EXPENSE"]);
  });

  it("reports missing columns instead of guessing", () => {
    const built = mappingFromCsv("SYNTHETIC", { ...SAMPLE_CSV, legacy: "entity,account\nBANK-CA,100" });
    expect(built.errors.join(" ")).toMatch(/legacy.*basis.*currency.*period.*balance/);
  });

  it("lets the validator catch a mapping to an account outside the target balances", async () => {
    const built = mappingFromCsv("SYNTHETIC", { ...SAMPLE_CSV, mapping: SAMPLE_CSV.mapping.replace("100,LOANS,1", "100,LOANS_TYPO,1") });
    const r = await runValidator("mapping", built.document);
    expect(r.checks.find((c) => c.check_id === "M_TARGET_ACCOUNTS_EXIST")?.status).toBe("FAIL");
  });
});

describe("journal editing", () => {
  const demo = demoDocuments().journal;

  it("adds and removes lines with fresh ids", () => {
    const added = addLine(demo, "J-ORIG-001");
    expect(added.lines).toHaveLength(9);
    expect(new Set(added.lines.map((l) => l.line_id)).size).toBe(9);
    expect(removeLine(added, added.lines[8].line_id).lines).toHaveLength(8);
  });

  it("adds a US CECL delta overlay that posts 8,000 and still validates", async () => {
    const doc = withUsDeltaOverlay(demo);
    const delta = doc.lines.filter((l) => l.basis === "USGAAP");
    expect(delta.map((l) => [l.account, l.debit, l.credit])).toEqual([
      ["IMPAIRMENT_EXPENSE", "8000.00", "0.00"],
      ["LOAN_ALLOWANCE", "0.00", "8000.00"],
    ]);
    const r = await runValidator("journal", doc);
    expect(r.status).toBe("VALIDATED_SCOPED");
    expect(withUsDeltaOverlay(doc).lines).toHaveLength(doc.lines.length);
  });
});

describe("chat intent routing", () => {
  it.each([
    ["Validate the journal", "validate_journal"],
    ["please prove the mapping", "validate_mapping"],
    ["Build the evidence pack", "evidence_pack"],
    ["How should renewals be treated under IFRS 9?", "model"],
  ])("%s -> %s", (text, intent) => expect(intentOf(text)).toBe(intent));
});

describe("evidence pack", () => {
  it("lists runs, failures and NOT_RUN scope and never claims agent approval", () => {
    const md = evidenceMarkdown({
      journal: report("VALIDATED_SCOPED"),
      mapping: report("BLOCKED", ["M_WEIGHTS"]),
      preparedBy: "R. Shetty",
      reviewedBy: "",
      generatedAt: "2026-11-01T14:00:00Z",
    });
    expect(md).toMatch(/Run status: BLOCKED/);
    expect(md).toMatch(/run-VALIDATED_SCOPED/);
    expect(md).toMatch(/M_WEIGHTS: broken/);
    expect(md).toMatch(/POLICY_ACCURACY/);
    expect(md).toMatch(/Prepared by: R\. Shetty/);
    expect(md).toMatch(/Reviewed by: not yet reviewed/);
    expect(md).toMatch(/not an approval/i);
  });
});

describe("token meter", () => {
  it("sums usage events", () => {
    expect(
      sumUsage([
        { inputTokens: 100, outputTokens: 20, cacheReadTokens: 50 },
        { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0 },
      ]),
    ).toEqual({ input: 110, output: 25, cacheRead: 50, calls: 2 });
  });
});
