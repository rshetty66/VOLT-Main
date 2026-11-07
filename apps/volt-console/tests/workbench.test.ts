import { describe, expect, it } from "vitest";
import { demoDocuments, runValidator } from "../server/financeArchitecture";
import {
  SAMPLE_CSV,
  addLine,
  evidenceMarkdown,
  intentOf,
  journalsFromFigures,
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
  it("is PARTIAL when only one proof has run and passed", () => expect(runStatus(report("VALIDATED_SCOPED"), undefined)).toBe("PARTIAL"));
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
    ).toEqual({ input: 110, output: 25, cacheRead: 50, webSearches: 0, webFetches: 0, calls: 2 });
  });
});

describe("real data: journals from confirmed figures", () => {
  const fig = (id: string, value: string, page = 2): import("../shared/mortgageFigures").Figure => ({
    id, label: id, value, scale: "millions", currency: "CAD", period: "2025-10-31", page, quote: `${id} ${value}`, evidence_class: "PUBLIC_FILING",
  });
  const figures = [fig("provision", "400"), fig("write_offs", "300"), fig("recoveries", "40")];
  const ctx = { sourceSha: "a".repeat(64), entity: "FIXTURE-BANK", basis: "IFRS", approvedBy: "R. Shetty" };

  it("builds one balanced journal per confirmed movement, scaled to currency units", async () => {
    const r = journalsFromFigures(figures, new Set(["provision", "write_offs", "recoveries"]), ctx);
    expect(r.blocked).toEqual([]);
    expect(r.doc!.lines.map((l) => [l.journal_id, l.account, l.debit, l.credit])).toEqual([
      ["J-PCL-2025-10-31", "PROVISION_FOR_CREDIT_LOSSES", "400000000.00", "0.00"],
      ["J-PCL-2025-10-31", "LOAN_ALLOWANCE", "0.00", "400000000.00"],
      ["J-WRITEOFF-2025-10-31", "LOAN_ALLOWANCE", "300000000.00", "0.00"],
      ["J-WRITEOFF-2025-10-31", "MORTGAGE_PRINCIPAL", "0.00", "300000000.00"],
      ["J-RECOVERY-2025-10-31", "CASH", "40000000.00", "0.00"],
      ["J-RECOVERY-2025-10-31", "LOAN_ALLOWANCE", "0.00", "40000000.00"],
    ]);
    expect(r.doc!.lines[0].measurement_ref).toBe("aaaaaaaaaaaa:provision:p2");
    const report = await runValidator("journal", r.doc);
    expect(report.status).toBe("VALIDATED_SCOPED");
  });

  it("blocks a journal whose figure is unconfirmed or missing", () => {
    const r = journalsFromFigures(figures.slice(0, 2), new Set(["provision"]), ctx);
    expect(r.doc!.lines.map((l) => l.journal_id)).toEqual(["J-PCL-2025-10-31", "J-PCL-2025-10-31"]);
    expect(r.blocked).toEqual([
      { journal: "Write-offs", missing: ["write_offs (unconfirmed)"] },
      { journal: "Recoveries", missing: ["recoveries (not in the source)"] },
    ]);
  });

  it("returns no document when nothing is confirmed", () => {
    expect(journalsFromFigures(figures, new Set(), ctx).doc).toBeNull();
  });

  it("keeps the rule DRAFT until a person is named as approver, so the validator blocks it", async () => {
    const r = journalsFromFigures(figures, new Set(["provision"]), { ...ctx, approvedBy: "" });
    expect(r.doc!.rules[0].status).toBe("DRAFT");
    const report = await runValidator("journal", r.doc);
    expect(report.checks.find((c) => c.check_id === "J_RULE_APPROVED")?.status).toBe("FAIL");
  });

  it("posts a provision release (negative provision) on the opposite sides", () => {
    const r = journalsFromFigures([fig("provision", "-25")], new Set(["provision"]), ctx);
    expect(r.doc!.lines.map((l) => [l.account, l.debit, l.credit])).toEqual([
      ["PROVISION_FOR_CREDIT_LOSSES", "0.00", "25000000.00"],
      ["LOAN_ALLOWANCE", "25000000.00", "0.00"],
    ]);
  });
});

describe("run status across three proofs", () => {
  it("needs every slot to pass for VALIDATED_SCOPED", () => {
    expect(runStatus(report("VALIDATED_SCOPED"), report("VALIDATED_SCOPED"), undefined)).toBe("PARTIAL");
    expect(runStatus(report("VALIDATED_SCOPED"), report("VALIDATED_SCOPED"), report("VALIDATED_SCOPED"))).toBe("VALIDATED_SCOPED");
  });
});

describe("evidence pack with sources", () => {
  it("lists each source and each figure with its verification and confirmation", () => {
    const md = evidenceMarkdown({
      extraction: report("VALIDATED_SCOPED"),
      preparedBy: "R. Shetty",
      reviewedBy: "",
      generatedAt: "2026-11-01T16:00:00Z",
      dataMode: "real",
      sources: [{ title: "Annual Report 2025", url: "https://fixture.example/ar.pdf", retrievedAt: "2026-11-01T15:00:00Z", sha256: "b".repeat(64), evidenceClass: "PUBLIC_FILING" }],
      figures: [{ id: "provision", label: "Provision for credit losses", value: "400", scale: "millions", currency: "CAD", page: 2, quote: "Provision for credit losses 400", confirmed: true }],
    });
    expect(md).toMatch(/Data: real documents/);
    expect(md).toMatch(/Annual Report 2025 \| PUBLIC_FILING \| https:\/\/fixture\.example\/ar\.pdf/);
    expect(md).toMatch(/\| Provision for credit losses \| 400 \| millions CAD \| 2 \| "Provision for credit losses 400" \| yes \|/);
    expect(md).toMatch(/Extraction verification/);
  });

  it("labels an illustrative run everywhere", () => {
    const md = evidenceMarkdown({ preparedBy: "", reviewedBy: "", generatedAt: "x", dataMode: "illustrative" });
    expect(md).toMatch(/ILLUSTRATIVE_EXAMPLE/);
  });
});
