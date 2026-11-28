/**
 * Intelligence Brain for the Accounting Rule Engine Blueprint (Rakesh, 2026-11-28). Sections A to H, 28 questions, each mapped to
 * a client_config.json field. A blank answer is sent as [to confirm] and is never invented; an attached file (current-state
 * diagram, process notes, prior deck) can stand in for any section.
 */
export interface BlueprintQuestion {
  n: number;
  q: string;
  field: string;
}
export interface BlueprintSection {
  id: string;
  title: string;
  optional?: boolean;
  questions: BlueprintQuestion[];
}

export const BLUEPRINT: BlueprintSection[] = [
  { id: "A", title: "Client and document", questions: [
    { n: 1, q: "Client legal name and short name used in headings", field: "client.name, client.short" },
    { n: 2, q: "Industry / business lines (e.g. consumer lending, retail bank, wealth)", field: "client.industry" },
    { n: 3, q: "Jurisdiction, prudential regulator and reporting currency", field: "client.jurisdiction, client.regulator, client.currency" },
    { n: 4, q: "Document title, version and banner text (leave prepared by blank for an unbranded page)", field: "document.*" },
  ] },
  { id: "B", title: "Current state (the flow being replaced)", questions: [
    { n: 5, q: "What the current-state view covers, and what it explicitly does not cover", field: "current_state.title, current_state.scope_note" },
    { n: 6, q: "Source systems feeding finance, one line each (product, volume if known)", field: "current_state.sources" },
    { n: 7, q: "Legacy integration components in flow order: applies accounting rules? manual? main issue?", field: "current_state.layers" },
    { n: 8, q: "Manual inputs (adjustment files, spreadsheets, reruns) and the component each feeds", field: "current_state.manual_inputs" },
    { n: 9, q: "The GL in this flow", field: "current_state.gl_in_flow" },
    { n: 10, q: "Downstream consumers fed from this flow (securitization, BI, regulatory), out of scope", field: "current_state.outputs" },
    { n: 11, q: "Other entities or landscapes not in this diagram that matter", field: "current_state.not_in_scope_notes" },
  ] },
  { id: "C", title: "Key pain points", questions: [
    { n: 12, q: "Top 3 to 6 pain points, where each occurs, and whether client-stated or assumed", field: "pain_points" },
  ] },
  { id: "D", title: "Target landscape", questions: [
    { n: 13, q: "Data platform for the engine (Databricks, Fabric, Snowflake, other) and cloud", field: "platform.name, platform.cloud" },
    { n: 14, q: "General ledgers to post to, entities on each, and type (Workday, D365, SAP, Oracle, NetSuite)", field: "gls" },
    { n: 15, q: "Consolidation / close tool, hosting, GL connector and main modules (blank if none)", field: "consolidation" },
    { n: 16, q: "Other downstream consumers that must stay unchanged", field: "downstream" },
    { n: 17, q: "Additional sources to onboard later (other entities)", field: "target_extra_sources" },
  ] },
  { id: "E", title: "Products and proof of concept", questions: [
    { n: 18, q: "Products in scope, source system each, and the proof of concept (card, loan, mortgage, mortgage_securitized, deposit, mutual_fund)", field: "products" },
    { n: 19, q: "How each product's accounting is handled today (e.g. Processor + ETL)", field: "products.legacy_handling" },
    { n: 20, q: "Known accounting gaps or open treatments (e.g. payment deferral, rewards liability)", field: "products.gaps" },
    { n: 21, q: "Proof-of-concept target date", field: "poc.target_date" },
  ] },
  { id: "F", title: "Migration", optional: true, questions: [
    { n: 22, q: "Wave plan, if one exists (code, name, scope, exit criteria)", field: "waves" },
    { n: 23, q: "Disposition of legacy components (Replace / Retire / Retain / Unchanged), if agreed", field: "legacy_components" },
  ] },
  { id: "G", title: "Acceleration", optional: true, questions: [
    { n: 24, q: "Accelerators or reusable assets to show (name, what it is, what it saves); no firm names if unbranded", field: "accelerators" },
  ] },
  { id: "H", title: "Assumptions, review items and sources", questions: [
    { n: 25, q: "Client-specific assumptions or dependencies (type, text, owner role, impact if not met, status)", field: "assumptions" },
    { n: 26, q: "Open review items or decisions (item, owner role, when, status)", field: "review_items" },
    { n: 27, q: "Source documents used (name, date, what it informed, confidence)", field: "sources_register" },
    { n: 28, q: "Notes for the Why accounting hubs drivers: multi-GAAP, audit, Finance ownership, multiple GLs, detail off the GL, product change", field: "hub_notes" },
  ] },
];

/** Whether an ask is about an accounting rule engine or hub, so the review screen opens the Intelligence Brain. */
export const isBlueprintAsk = (text: string) => /accounting (rule|rules) engine|rule engine|accounting hub|sub-?ledger|client_config/i.test(text);

/**
 * The Intelligence Brain as a prompt block. Answered fields are passed as given; blank ones as [to confirm]; a skipped section
 * says to use labelled defaults (or the attached files) and never invent client facts.
 */
export function blueprintBlock(answers: Record<number, string>, skipped: Set<string>, files: string[] = [], agents: string[] = GYAN_AGENTS.map((a) => a.id)): string {
  const lines = [
    "## Intelligence Brain: Accounting Rule Engine Blueprint (client_config.json)",
    "- Rule: use each answer as given. A field marked [to confirm] or a skipped section gets a clearly labelled default or stays [to confirm]; never invent client facts, names, volumes or dates.",
    files.length ? `- Attached files may stand in for any section; extract from them before falling back to defaults: ${files.join(", ")}.` : "",
  ].filter(Boolean);
  for (const s of BLUEPRINT) {
    if (skipped.has(s.id)) {
      lines.push(`### ${s.id}. ${s.title}`, "- Skipped: use labelled defaults or [to confirm].");
      continue;
    }
    lines.push(`### ${s.id}. ${s.title}`);
    for (const q of s.questions) lines.push(`- ${q.n}. ${q.q} [${q.field}]: ${answers[q.n]?.trim() || "[to confirm]"}`);
  }
  const team = GYAN_AGENTS.filter((a) => agents.includes(a.id));
  if (team.length) {
    lines.push(
      "## Agent Team & Deep Research Narrative",
      "- Write a deep research narrative on how this agent team runs the rule engine end to end: for each stage (source capture, accounting rules and GL derivation, posting to each GL, reconciliation, controls, close and reporting), which agent acts, its inputs, the control it applies, the evidence it leaves, where a human approves, and where the Finance Critic reperforms the work. Cite only retrieved sources and label every assumption.",
      ...team.map((a) => `- ${a.name} (${a.volt}): ${a.role}.`),
    );
  }
  lines.push(
    "## Final Deliverable",
    "- End with the full deliverable in one piece, ready to download: (1) the Accounting Rule Engine Blueprint document (current state, pain points, target landscape, products and proof of concept, migration, acceleration, assumptions, review items, sources register, why accounting hubs); (2) the populated client_config.json with [to confirm] where blank; (3) the agent operating model table (stage, agent, VOLT agent, control, evidence, human approval).",
  );
  return lines.join("\n");
}

/** The 20 Gyan finance agents (apps/gyan-agents seeds) and the VOLT agent each binds to (plugins/volt/data/finance-workflow-bindings.json). */
export const GYAN_AGENTS: { id: string; name: string; domain: string; volt: string; role: string }[] = [
  { id: "r2r_close_conductor", name: "Month-End Close Conductor", domain: "r2r", volt: "period-close", role: "Coordinate the close calendar and surface critical-path blockers, overdue work, and owner handoffs" },
  { id: "r2r_je_drafter", name: "Automated Journal Entry Drafter", domain: "r2r", volt: "accounting-policy-engine", role: "Draft supported accrual, deferral, and reclassification journals with balanced debits and credits" },
  { id: "r2r_reconciler", name: "Multi-Way Reconciliation Agent", domain: "r2r", volt: "gl-capital-reconciliation", role: "Reconcile bank statement activity to the GL using exact, fuzzy and one-to-many matches" },
  { id: "r2r_intercompany", name: "Intercompany Elimination & Netting Agent", domain: "r2r", volt: "consolidation-reporting-agent", role: "Pair intercompany balances, identify FX and timing differences, and draft netting and elimination proposals" },
  { id: "r2r_fixed_assets", name: "Fixed Asset & Lease Accounting Agent", domain: "r2r", volt: "lease-accounting-agent", role: "Review fixed-asset roll-forwards and draft ASC 842 or IFRS 16 lease amortization schedules" },
  { id: "fpa_variance_flux", name: "Flux & Variance Analysis Agent", domain: "fpa", volt: "budgeting-forecasting", role: "Bridge actual-to-plan or period flux into price, volume, mix, FX and residual effects" },
  { id: "fpa_rolling_forecast", name: "Rolling Forecast & Scenario Modeler", domain: "fpa", volt: "budgeting-forecasting", role: "Draft base, upside and downside rolling forecasts using versioned assumptions and closed actuals" },
  { id: "fpa_cash_flow_13w", name: "13-Week Direct Cash Flow & Liquidity Agent", domain: "fpa", volt: "treasury-management-agent", role: "Produce a 13-week cash forecast from opening liquidity, expected collections, payables and dated commitments" },
  { id: "fpa_workforce_cost", name: "Workforce & Headcount Cost Agent", domain: "fpa", volt: "epm-workforce-planning-lead", role: "Reconcile Workday workforce cost and headcount to GL payroll and isolate timing and allocation differences" },
  { id: "fpa_margin_leakage", name: "SaaS / Unit Economics & Margin Leakage Agent", domain: "fpa", volt: "billing", role: "Explain SaaS and unit-economic margin leakage by reconciling CPQ, billing and GL economics by unit or cohort" },
  { id: "p2p_ap_3way_match", name: "AP Invoice Triage & 3-Way Match Agent", domain: "p2p_o2c", volt: "accounts-payable", role: "Compare invoice lines with purchase orders and receipts and flag exceptions" },
  { id: "o2c_cash_app", name: "Smart Cash Application & Remittance Agent", domain: "p2p_o2c", volt: "accounts-receivable", role: "Match bank receipts and remittance advice to open invoices and propose how to handle short pays and unapplied cash" },
  { id: "o2c_collections", name: "Collections Prioritization & Dunning Agent", domain: "p2p_o2c", volt: "accounts-receivable", role: "Prioritize aged receivables and draft policy-compliant dunning messages for internal review" },
  { id: "p2p_vendor_compliance", name: "Vendor Spend & Contract Compliance Agent", domain: "p2p_o2c", volt: "contracts-renewals", role: "Test vendor invoices against the applicable MSA, rate card, tier, and effective dates to identify overbilling" },
  { id: "ctrl_sox_monitor", name: "Continuous SOX & Internal Controls Monitor", domain: "controls", volt: "internal-audit-agent", role: "Monitor the journal-entry population for SOX control exceptions including segregation-of-duties conflicts" },
  { id: "ctrl_te_policy", name: "T&E and Corporate Card Policy Enforcer", domain: "controls", volt: "internal-audit-agent", role: "Screen expense claims against policy, including duplicate receipts and split claims near approval limits" },
  { id: "ctrl_indirect_tax", name: "Indirect Tax (VAT/GST/Sales Tax) Compliance Agent", domain: "controls", volt: "tax-compliance", role: "Review indirect-tax treatment, including jurisdictional nexus thresholds, registration evidence and exemption support" },
  { id: "ctrl_finance_critic", name: "Finance Critic Verification Agent", domain: "controls", volt: "internal-audit-agent", role: "Independently reperform draft calculations and verify that each citation supports the associated claim" },
  { id: "exec_daily_briefing", name: "Board & CFO Daily Briefing Agent", domain: "executive", volt: "reports-dashboards", role: "Draft a daily executive brief covering cash, bookings, and margin, with exceptions and decision requests" },
  { id: "exec_board_packager", name: "Regulatory & Management Reporting Packager", domain: "executive", volt: "consolidation-reporting-agent", role: "Assemble board-ready P&L, balance sheet, cash flow and MD&A narrative from approved financial artifacts" },
];
