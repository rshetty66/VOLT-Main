import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isLedgerTool, ledgerBaseUrl, ledgerEnabled, ledgerToolDefs, runLedgerTool } from "../server/ledger";
import { SourceRegistry } from "../server/research";

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

  it("offers the six model tools and never a review decision", () => {
    const names = ledgerToolDefs().map((t) => t.name);
    expect(names).toEqual(["ledger_get_ontology_context", "ledger_map_line_item", "ledger_flag_policy_gap",
      "ledger_propose_journal", "ledger_reverse_journal", "ledger_coverage"]);
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
});
