import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkLedgerFigures, isLedgerTool, ledgerBaseUrl, ledgerEnabled, ledgerPeople, ledgerToolDefs, runLedgerTool } from "../server/ledger";
import { SourceRegistry } from "../server/research";
import { saveUpload } from "../server/uploads";

const ok = (data: unknown, display: Record<string, string> = {}, evidence_id: string | null = "E000042") =>
  new Response(JSON.stringify({ status: "ok", evidence_id, data, display, warnings: [] }), { status: 200 });

describe("VOLT Ledger tools", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv("VOLT_LEDGER_URL", "http://ledger.test/");
    vi.stubEnv("VOLT_LEDGER_HOSTPORT", "");
    vi.stubEnv("VOLT_LEDGER_TOKEN", "secret-token");
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("is off, and offers no tools, unless the service and token are configured", () => {
    vi.stubEnv("VOLT_LEDGER_TOKEN", "");
    expect(ledgerEnabled()).toBe(false);
    expect(ledgerToolDefs()).toEqual([]);
  });

  it("builds the base URL from the Render hostport when no URL is set", () => {
    vi.stubEnv("VOLT_LEDGER_URL", "");
    vi.stubEnv("VOLT_LEDGER_HOSTPORT", "volt-ledger:8790");
    expect(ledgerBaseUrl()).toBe("http://volt-ledger:8790");
  });

  it("offers the model tools and never a review decision or a driver value", () => {
    const names = ledgerToolDefs().map((t) => t.name);
    expect(names).toEqual(["ledger_get_ontology_context", "ledger_map_line_item", "ledger_map_line_items", "ledger_flag_policy_gap",
      "ledger_propose_journal", "ledger_reverse_journal", "ledger_coverage", "ledger_ingest_upload", "ledger_list_accounts",
      "ledger_get_balances", "ledger_build_statement", "ledger_list_metrics", "ledger_compute_ratio",
      "ledger_propose_allocation_rule", "ledger_run_allocation",
      "ledger_diagnose_coa", "ledger_check_coa_design", "ledger_propose_coa_design", "ledger_propose_coa_mapping",
      "ledger_coa_status", "ledger_resolve_peer_period", "ledger_fetch_peer_documents", "ledger_peer_metrics"]);
    expect(names.some((n) => /driver_value|check_output/.test(n))).toBe(false);
    expect(names.some((n) => /review|decision/.test(n))).toBe(false);
    expect(isLedgerTool("ledger_coverage")).toBe(true);
    expect(isLedgerTool("record_review_decision")).toBe(false);
  });

  it("sends the bearer token and registers a citable result as a source key", async () => {
    fetchMock.mockResolvedValueOnce(ok({ association_id: "mapping:acct:SYNBANK:1000:1", review_item_id: "R000001" }));
    const registry = new SourceRegistry("map the trial balance");
    const r = await runLedgerTool("ledger_map_line_item", {
      account_id: "acct:SYNBANK:1000", concept_id: "canon:Cash", confidence: 0.95, rationale: "Cash at bank",
    }, registry);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://ledger.test/v1/tools/map_line_item");
    expect(init.headers.authorization).toBe("Bearer secret-token");
    expect(r.newSource?.publisher).toBe("VOLT Ledger");
    expect(r.content).toContain(`[Source key: ${r.newSource?.key}]`);
  });

  it("does not register lookups as evidence", async () => {
    fetchMock.mockResolvedValueOnce(ok({ candidates: [] }, {}, null));
    const registry = new SourceRegistry("x");
    const r = await runLedgerTool("ledger_get_ontology_context", { query: "cash" }, registry);
    expect(r.ok && r.newSource).toBeFalsy();
    expect(registry.sources).toHaveLength(1);
  });

  it("refuses money as a JSON number before calling the service", async () => {
    const r = await runLedgerTool("ledger_propose_journal", {
      idempotency_key: "k1", period: "2026-09", kind: "reclass", description: "d",
      lines: [{ account_id: "a", side: "debit", amount_minor: 100, amount_source: "S02" },
        { account_id: "b", side: "credit", amount_minor: 100, amount_source: "S02" }],
    }, new SourceRegistry("x"));
    expect(r.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a journal amount that no earlier ledger result returned", async () => {
    const registry = new SourceRegistry("x");
    fetchMock.mockResolvedValueOnce(ok({ journal_id: "J000001", created: true, total: "125000" }));
    const first = await runLedgerTool("ledger_propose_journal", {
      idempotency_key: "k0", period: "2026-09", kind: "reclass", description: "seed",
      lines: [{ account_id: "a", side: "debit", amount_minor: "125000", amount_source: "S99" },
        { account_id: "b", side: "credit", amount_minor: "125000", amount_source: "S99" }],
    }, registry);
    // S99 does not exist, so the call is refused without reaching the service.
    expect(first.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts an amount copied from an earlier result and strips amount_source from the wire", async () => {
    const registry = new SourceRegistry("x");
    fetchMock.mockResolvedValueOnce(ok({ journal_id: "J000001", created: true, total: "125000" }, { total: "1,250.00 USD" }));
    // A reversal result is citable; use it to seed a known amount the way a balance tool will in step 6.
    const seed = await runLedgerTool("ledger_reverse_journal", { journal_id: "J0", period: "2026-09", reason: "r", idempotency_key: "r1" }, registry);
    expect(seed.ok).toBe(true);
    const key = seed.ok ? seed.newSource!.key : "";

    fetchMock.mockResolvedValueOnce(ok({ journal_id: "J000002", created: true, total: "125000" }));
    const r = await runLedgerTool("ledger_propose_journal", {
      idempotency_key: "k2", period: "2026-09", kind: "reclass", description: "reclass",
      lines: [{ account_id: "a", side: "debit", amount_minor: "125000", amount_source: key },
        { account_id: "b", side: "credit", amount_minor: "125000", amount_source: key }],
    }, registry);
    expect(r.ok).toBe(true);
    const sent = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(sent.lines[0]).not.toHaveProperty("amount_source");
    expect(sent.lines[0].amount_minor).toBe("125000");

    const wrong = await runLedgerTool("ledger_propose_journal", {
      idempotency_key: "k3", period: "2026-09", kind: "reclass", description: "made-up",
      lines: [{ account_id: "a", side: "debit", amount_minor: "125001", amount_source: key },
        { account_id: "b", side: "credit", amount_minor: "125001", amount_source: key }],
    }, registry);
    expect(wrong.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports an unreachable service as a tool error, not a crash", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const r = await runLedgerTool("ledger_coverage", { doc_id: "D0001" }, new SourceRegistry("x"));
    expect(r).toEqual({ ok: false, error: expect.stringContaining("unreachable") });
  });

  it("ingests an uploaded trial balance, detecting dimension columns from the header", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "volt-ledger-"));
    vi.stubEnv("VOLT_DATA_DIR", dir);
    try {
      const csv = "account_code,account_name,debit,credit,business_line,cost_centre\n1000,Cash,100.00,,Treasury,\n";
      const meta = saveUpload({ name: "Q3 TB (final).csv", text: csv, chars: csv.length, truncated: false }, new TextEncoder().encode(csv));
      fetchMock.mockResolvedValueOnce(ok({ doc_id: "D0001" }, { stored: "1" }));
      const r = await runLedgerTool("ledger_ingest_upload", { upload_id: meta.id, client: "SYNBANK", period: "2026-09" }, new SourceRegistry("x"));
      expect(r.ok).toBe(true);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("http://ledger.test/v1/ingest/trial_balance");
      const sent = JSON.parse(init.body);
      expect(sent.filename).toBe("Q3 TB _final_.csv");
      expect(sent.dimensions).toEqual({ BusinessLine: "business_line", CostCentre: "cost_centre" });
      expect(Buffer.from(sent.content_base64, "base64").toString()).toBe(csv);
      expect(sent.currency).toBe("USD");
      const missing = await runLedgerTool("ledger_ingest_upload", { upload_id: "00000000-0000-0000-0000-000000000000", client: "SYNBANK", period: "2026-09" }, new SourceRegistry("x"));
      expect(missing.ok).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("checks only sentences that cite a ledger result, against that result's evidence", async () => {
    const registry = new SourceRegistry("x");
    fetchMock.mockResolvedValueOnce(ok({ value: "31000000000" }, { value: "310,000,000.00 USD" }, "E000077"));
    const r = await runLedgerTool("ledger_compute_ratio", { metric_id: "nii", period: "2026-09" }, registry);
    const key = r.ok ? r.newSource!.key : "";
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ status: "ok", evidence_id: null, data: { unsupported: ["311,000,000.00"] }, display: {}, warnings: [] })));
    const draft = `Market growth was 4.5% [S01].\n\nNII was 311,000,000.00 USD [${key}]. Costs rose.`;
    const out = await checkLedgerFigures(draft, registry);
    expect(out).toEqual({ unsupported: ["311,000,000.00"], sentences: 1 });
    const sent = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(sent).toEqual({ text: `NII was 311,000,000.00 USD [${key}].`, evidence_ids: ["E000077"] });
    expect(await checkLedgerFigures("No ledger figures here [S01].", registry)).toBeNull();
  });

  it("makes peer results citable and refuses a bad fiscal period before calling the service", async () => {
    const registry = new SourceRegistry("x");
    const bad = await runLedgerTool("ledger_resolve_peer_period", { peer_ids: ["td"], period: "2026-Q3" }, registry);
    expect(bad.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(ok([{ peer_id: "rbc", status: "ok" }], { "rbc FY2026-Q3 nii": "C$8,744 million" }, "E000090"));
    const r = await runLedgerTool("ledger_peer_metrics", { doc_ids: ["P00002"], metric_ids: ["nii"] }, registry);
    expect(r.ok && r.newSource?.publisher).toBe("VOLT Ledger");
    expect(r.ok && r.newSource?.type).toBe("public filing");
    expect(fetchMock.mock.calls[0][0]).toBe("http://ledger.test/v1/tools/peer_metrics");
  });

  it("validates a CoA design before calling the service and cites a stored design", async () => {
    const registry = new SourceRegistry("x");
    const bad = await runLedgerTool("ledger_propose_coa_design", { design: { name: "x", segments: [], accounts: [] } }, registry);
    expect(bad.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(ok({ design_id: "coa:0001", version: 1 }, { design: "coa:0001 version 1" }, "E000100"));
    const r = await runLedgerTool("ledger_propose_coa_design", { design: {
      name: "Target", segments: [{ name: "NaturalAccount", length: 5, natural: true }],
      accounts: [{ code: "11100", name: "Cash", class: "asset", concept_id: "canon:CashAndCentralBankBalances" }],
      decisions: [{ topic: "t", choice: "c", rationale: "r" }],
    } }, registry);
    expect(r.ok && r.newSource?.type).toBe("calculation");
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.design.decisions[0]).toEqual({ topic: "t", choice: "c", rationale: "r", alternatives: [], standard_refs: [] });
  });

  it("sends the signed-in person to people-only routes", async () => {
    fetchMock.mockResolvedValueOnce(ok({ recorded: true }));
    const r = await ledgerPeople("POST", "review_decision", "lead", { item_id: "R000001", stage: "engagement_lead", decision: "approve" });
    expect(r.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://ledger.test/v1/people/review_decision");
    expect(init.headers["x-volt-user"]).toBe("lead");
  });
});
