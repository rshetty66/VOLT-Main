/**
 * The finance reference model behind the Diagram Builder's three linked views (Rakesh, 2026-11-28): the reference
 * architecture and its 15-step walkthrough from his Master Prompt v3 (Appendices C and D), the agents that sit on it,
 * the L1-L4 process taxonomy (Appendix B, as TaxonomySpec from views.ts, with APQC PCF hierarchy ids) and the business
 * capabilities. One model, three views: src/diagrams/financeViews.ts draws it; validateFinanceModel keeps every link
 * resolvable so a later chat turn can change the model without breaking a view.
 *
 * Content is illustrative and vendor-neutral until a client's own taxonomy or inventory replaces it.
 */
import type { Impact, TaxonomySpec } from "./views";

export type Flow = "a" | "r" | "ar" | "";
export type CoaLayer = "t" | "k" | "n" | "";
export type SolutionGroup = "1" | "2" | "3" | "4" | "5" | "";
export type Layer = "Source Systems" | "Provisioning Area" | "Operational Engines" | "Common Results Area" | "Analytical Engines" | "Analysis & Reporting" | "Consumers" | "Cross-cutting";

/** One architecture box: title, layer, flow membership, COA layer, solution group, role. */
export type Component = [title: string, layer: Layer, flow: Flow, coa: CoaLayer, group: SolutionGroup, role: string];

/** One walkthrough step. on: component keys or container ids (L_src, G_are ...), or "all". */
export interface WalkStep {
  title: string;
  text: string;
  on?: string[] | "all";
  arrows?: { from: string; to: string; label?: string; red?: boolean }[];
  chips?: { target: string; segments: string }[];
  overlay?: "principles" | "flows";
  reveal?: boolean;
  pulse?: string;
}

export interface Agent {
  id: string;
  name: string;
  on: string[];
  activities: string[];
  approver: string;
  does: string;
  guardrail: string;
}

/** A business capability is an L2 group of the taxonomy; it maps to components and carries maturity (1-3). */
export interface Capability {
  name: string;
  components: string[];
  today: 1 | 2 | 3;
  target: 1 | 2 | 3;
}

export interface FinanceModel {
  title: string;
  components: Record<string, Component>;
  steps: WalkStep[];
  agents: Agent[];
  taxonomy: TaxonomySpec[];
  capabilities: Capability[];
}

const C = (title: string, layer: Layer, flow: Flow, coa: CoaLayer, group: SolutionGroup, role: string): Component => [title, layer, flow, coa, group, role];
const S: Layer = "Source Systems", P: Layer = "Provisioning Area", O: Layer = "Operational Engines", R: Layer = "Common Results Area", A: Layer = "Analytical Engines", X: Layer = "Analysis & Reporting", N: Layer = "Consumers", Z: Layer = "Cross-cutting";

export const COMPONENTS: Record<string, Component> = {
  src_mort: C("Mortgages", S, "ar", "", "", "Mortgage origination and servicing systems; feed contracts, transactions and balances."),
  src_dep: C("Deposits", S, "ar", "", "", "Deposit and current account platforms; feed customer transactions, balances and interest."),
  src_sec: C("Securities", S, "ar", "", "", "Securities trading and custody systems; feed trades, positions and valuations."),
  src_der: C("Derivatives", S, "ar", "", "", "Derivatives trading and confirmation systems; feed trades, cash flows and fair values."),
  src_cc: C("Credit Cards", S, "ar", "", "", "Card issuing and processing platforms; feed transactions, fees and receivable balances."),
  src_oth: C("Other Sources", S, "ar", "", "", "Other product and operational systems, such as payments, leasing and sub-ledgers."),
  src_mkt: C("Market Data", S, "r", "", "", "Prices, curves, rates and volatilities used by valuation and risk engines."),
  src_ref: C("Reference Data", S, "ar", "", "", "Products, counterparties, calendars and other shared reference data."),
  src_cap: C("Capital Data", S, "r", "", "", "Capital instruments and positions used in regulatory capital and stress calculations."),
  src_cust: C("Customers", S, "ar", "", "", "Customer master and relationship data from CRM and onboarding systems."),
  pv_cust: C("Customers", P, "ar", "n", "1", "Conformed customer data with analytical attributes for segmentation and profitability."),
  pv_txn: C("Transactions", P, "ar", "k", "1", "Single landing point for source transactions, carrying the detail the accounting rules need."),
  pv_acc: C("Accounts", P, "ar", "k", "1", "Contract- and account-level data with sub-ledger dimensions."),
  pv_bal: C("Balances", P, "ar", "k", "1", "Source balances at account level, ready for reconciliation and enrichment."),
  pv_dim: C("Enterprise Dimensions", P, "ar", "n", "1", "Shared dimensions such as entity, product, channel and segment, applied the same way to every record."),
  pv_ver: C("Data Verification", P, "ar", "", "1", "Completeness and validity checks on each feed before it is used."),
  pv_dq: C("Data Quality", P, "ar", "", "1", "Data quality rules, scoring and issue management across provisioned data."),
  pv_rec: C("Reconciliation", P, "a", "", "1", "Source-to-provisioning control totals that prove completeness before data moves on."),
  pv_adj: C("Adjustments", P, "a", "", "1", "Governed, audited corrections to provisioned data, applied once for every consumer."),
  op_rules: C("Accounting Rules", O, "a", "k", "2", "Rules that turn each business event into accounting entries, applied once at transaction level."),
  op_detbal: C("Detailed Balances", O, "a", "k", "2", "Accounting balances at full sub-ledger (thick COA) detail, created by the rules engine."),
  op_glbal: C("GL Balances", O, "a", "t", "2", "Summarised balances carrying only the statutory (thin) chart of accounts segments."),
  op_adb: C("ADB", O, "a", "t", "2", "Average daily balances from the ledger, used for margin, pricing and regulatory measures."),
  op_reccons: C("Reconciliation & Consolidation", O, "a", "t", "3", "Account reconciliation, intercompany elimination and group consolidation."),
  op_finadj: C("Financial Adjustments", O, "a", "t", "3", "Top-side and manual adjustments, governed and traceable to the ledger."),
  op_cost: C("Cost Management", O, "ar", "n", "2", "Cost allocation and attribution to products, channels and customers."),
  cr_price: C("Pricing", R, "ar", "n", "1", "Pricing results drawn from the one enriched data set."),
  cr_cust: C("Customer Insight", R, "ar", "n", "1", "Customer-level profitability and behaviour insight."),
  cr_prof: C("Product Profitability", R, "ar", "n", "1", "Product profitability built from reconciled balances, costs and funds transfer pricing."),
  cr_recbal: C("Reconciled Balances", R, "ar", "k", "1", "Balances reconciled to the general ledger: the golden source for downstream reporting."),
  an_mkt: C("Market Risk", A, "r", "", "1", "Market risk measures such as sensitivities and value at risk."),
  an_cred: C("Credit Risk", A, "r", "", "1", "Credit risk parameters, exposures and expected credit loss inputs."),
  an_liq: C("Liquidity Risk", A, "r", "", "1", "Liquidity coverage, funding and cash-flow gap analysis."),
  an_stress: C("Stress Executions", A, "r", "", "1", "Scenario and stress test runs across risk and finance results."),
  an_ftp: C("FTP / Basel", A, "r", "", "1", "Funds transfer pricing and Basel regulatory capital calculations."),
  an_ifrs: C("IFRS 9 / IFRS 17", A, "ar", "", "1", "Expected credit loss (IFRS 9) and insurance contract (IFRS 17) measurement, shared by finance and risk."),
  an_rapm: C("RAPM", A, "r", "n", "1", "Risk-adjusted performance measurement combining balances, costs and capital."),
  an_solv: C("Solvency II", A, "r", "", "1", "Insurance solvency capital calculations, where relevant."),
  an_stat: C("Statistical engines", A, "r", "", "1", "Statistical and model-development workspace that uses reconciled inputs."),
  an_corp: C("Corporate & Other engines", A, "r", "", "1", "Other corporate and analytical engines in a governed sandbox."),
  rp_close: C("Financial Close & Disclosure", X, "a", "", "3", "Period-end close and disclosure from a ledger already reconciled to its detail."),
  rp_stat: C("Statutory Reporting", X, "a", "", "4", "Statutory financial statements and notes."),
  rp_reg: C("Regulatory Reporting & XBRL", X, "r", "", "5", "Regulatory returns and XBRL filings produced from the same enriched results."),
  rp_plan: C("Planning & Forecasting", X, "ar", "", "3", "Budget, forecast and scenario planning on the shared data foundation."),
  rp_fa: C("Financial Analytics", X, "ar", "", "4", "Self-service financial analysis and drill-down."),
  rp_mis: C("Managerial & MIS Reports", X, "ar", "", "4", "Management information and segment reporting."),
  rp_dash: C("Corporate Dashboards", X, "ar", "", "4", "Executive dashboards for leadership and the board."),
  rp_alert: C("Alerts & Exception Mgmt", X, "r", "", "", "Threshold alerts and exception workflows for risk and finance."),
  rp_oprisk: C("Operational Risk & Compliance", X, "r", "", "", "Operational risk events, controls and compliance monitoring."),
  rp_aml: C("Regulatory Compliance (AML/FinCrime)", X, "r", "", "", "Anti-money-laundering and financial crime monitoring and reporting."),
  cn_sh: C("Shareholders", N, "", "", "", "Receive published financial results and disclosures."),
  cn_dir: C("Directors", N, "", "", "", "Use board reporting and dashboards for oversight."),
  cn_cust: C("Customers", N, "", "", "", "Receive statements and product information."),
  cn_an: C("Analysts", N, "", "", "", "Use published results and investor disclosures."),
  cn_reg: C("Regulators", N, "", "", "", "Receive regulatory returns, XBRL filings and supervisory information."),
  x_gov: C("Data Governance & Services Integration", Z, "", "", "", "Ownership, lineage, policies and integration services that keep every layer trusted."),
  x_mdm: C("Master Data Management", Z, "", "", "", "One governed version of accounts, entities, products and customers across all layers."),
  x_e2e: C("End-to-End Management & SLAs", Z, "", "", "", "Orchestration, monitoring and service levels across the whole data and reporting chain."),
};

/** Container ids the walkthrough may name, and the component keys each holds. */
export const CONTAINERS: Record<string, string[]> = {
  L_src: ["src_mort", "src_dep", "src_sec", "src_der", "src_cc", "src_oth", "src_mkt", "src_ref", "src_cap", "src_cust"],
  L_pv: ["pv_cust", "pv_txn", "pv_acc", "pv_bal", "pv_dim", "pv_ver", "pv_dq", "pv_rec", "pv_adj"],
  L_op: ["op_rules", "op_detbal", "op_glbal", "op_adb", "op_reccons", "op_finadj", "op_cost"],
  L_cr: ["cr_price", "cr_cust", "cr_prof", "cr_recbal"],
  L_an: ["an_mkt", "an_cred", "an_liq", "an_stress", "an_ftp", "an_ifrs", "an_rapm", "an_solv", "an_stat", "an_corp"],
  L_rp: ["rp_close", "rp_stat", "rp_reg", "rp_plan", "rp_fa", "rp_mis", "rp_dash", "rp_alert", "rp_oprisk", "rp_aml"],
  L_cn: ["cn_sh", "cn_dir", "cn_cust", "cn_an", "cn_reg"],
  G_are: ["op_rules", "op_detbal"],
  G_gl: ["op_glbal", "op_adb"],
  G_risk: ["an_mkt", "an_cred", "an_liq", "an_stress"],
  G_reg: ["an_ftp", "an_ifrs"],
  G_fm: ["an_rapm", "an_solv"],
  G_sandbox: ["an_stat", "an_corp"],
};
/** Layer headers that can carry a COA chip. */
export const HEADERS = ["H_src", "H_pv", "H_rp", "H_cn"];

export const SOLUTION_GROUPS: Record<string, [string, string]> = {
  "1": ["Data foundation, integration & analytical engines", "#2C5F6E"],
  "2": ["Accounting hub, GL & cost management", "#A63A02"],
  "3": ["Consolidation & close, reconciliation, planning", "#8C6400"],
  "4": ["Statutory reporting & MIS", "#9C2F45"],
  "5": ["Regulatory reporting", "#4F6B2F"],
};

/** Master Prompt v3, Appendix D: the 15 clicks of the reference deck, with the exact connector endpoints. */
export const STEPS: WalkStep[] = [
  { title: "Start with the principles", text: "Apply accounting rules once; enrich reconciled balances into one golden source.", overlay: "principles" },
  { title: "The landscape", text: "Sources, provisioning, operational and analytical engines, reporting, all under common governance.", on: "all", reveal: true },
  { title: "Ingest once", text: "Source transactions land in a single provisioning area, verified and conformed.", on: ["L_src", "pv_txn", "pv_ver", "pv_dq"], arrows: [{ from: "src_sec", to: "pv_txn" }] },
  { title: "Apply rules once", text: "The accounting rules engine creates detailed, thick-COA balances from each event.", on: ["pv_txn", "op_rules", "op_detbal"], arrows: [{ from: "pv_txn", to: "G_are" }], chips: [{ target: "op_detbal", segments: "tk" }] },
  { title: "Thin the GL", text: "Only statutory COA segments reach the general ledger.", on: ["op_detbal", "op_glbal", "op_adb"], arrows: [{ from: "op_detbal", to: "op_glbal" }], chips: [{ target: "op_glbal", segments: "t" }] },
  { title: "Close and disclose", text: "Close and disclose from a ledger that is already reconciled to its detail.", on: ["op_glbal", "rp_close"], arrows: [{ from: "op_glbal", to: "rp_close" }], chips: [{ target: "rp_close", segments: "tk" }] },
  { title: "Balances feed performance", text: "The same balances drive financial management and governed adjustments.", on: ["op_detbal", "op_glbal", "an_rapm", "an_solv", "op_finadj"], arrows: [{ from: "op_detbal", to: "an_rapm", label: "Balances" }, { from: "op_glbal", to: "an_solv", label: "Balances" }, { from: "op_glbal", to: "op_finadj", label: "Financial Adjustments" }] },
  { title: "Add analytical depth", text: "Account and balance feeds bring analytical dimensions.", on: ["L_src", "pv_acc", "pv_bal", "pv_cust", "pv_dim"], arrows: [{ from: "src_ref", to: "pv_acc" }], chips: [{ target: "pv_bal", segments: "n" }] },
  { title: "One enriched data set", text: "Provisioning now carries all three COA layers.", on: ["L_pv"], chips: [{ target: "H_pv", segments: "tkn" }] },
  { title: "Prove completeness", text: "Source-to-provisioning control totals.", on: ["pv_rec"], pulse: "pv_rec" },
  { title: "Reconciled inputs flow on", text: "Reconciled inputs flow to risk and analytical engines.", on: ["pv_rec", "G_sandbox", "G_risk"], arrows: [{ from: "pv_rec", to: "G_sandbox" }] },
  { title: "Report from the golden source", text: "Every report reads the same enriched results.", on: ["L_cr", "rp_mis", "rp_dash", "rp_reg", "rp_alert", "rp_oprisk"], arrows: ["rp_mis", "rp_dash", "rp_reg", "rp_alert", "rp_oprisk"].map((to) => ({ from: "L_cr", to })), chips: [{ target: "H_rp", segments: "tkn" }] },
  { title: "Reconciled by design", text: "Risk and finance results tie back to the ledger without a separate reconciliation.", on: ["cr_recbal", "op_glbal", "cr_prof", "rp_dash", "L_cn"], arrows: [{ from: "cr_recbal", to: "op_glbal", label: "reconciled by design", red: true }, { from: "rp_dash", to: "L_cn" }], chips: [{ target: "cr_prof", segments: "tkn" }] },
  { title: "Two flows, one foundation", text: "Accounting and financial reporting above; risk, performance and regulatory reporting below, on one data foundation.", on: "all", overlay: "flows" },
  { title: "Explore any component", text: "Click any box for detail, or switch view. Turn on Agents to see where they work.", on: "all" },
];

/** VOLT's proposal for where agents sit (hypothesis until a design workshop confirms it). */
export const AGENTS: Agent[] = [
  { id: "ag_dq", name: "Data quality agent", on: ["pv_ver", "pv_dq"], activities: ["Reconcile regulatory to GL"], approver: "Data owner", does: "Runs completeness and validity checks on each feed and drafts the issue note with the failing rows.", guardrail: "Reads provisioned data only; cannot change source or provisioned records." },
  { id: "ag_je", name: "Journal agent", on: ["op_rules", "op_finadj"], activities: ["Draft journal descriptions and support", "Prepare recurring journals", "Estimate accruals", "Document accrual rationale"], approver: "GL accountant", does: "Drafts recurring and accrual journals with support from the rules engine output.", guardrail: "Drafts only; posting stays with a person (segregation of duties)." },
  { id: "ag_rec", name: "Reconciliation agent", on: ["pv_rec", "op_reccons", "cr_recbal"], activities: ["Prepare reconciliations", "Investigate reconciling items", "Draft reconciliation commentary"], approver: "Reconciliation lead certifies", does: "Auto-matches, investigates open items against source rows and drafts the commentary.", guardrail: "Cannot certify; unexplained items stay open." },
  { id: "ag_ic", name: "Intercompany agent", on: ["op_reccons"], activities: ["Match intercompany transactions", "Resolve intercompany breaks", "Eliminate intercompany"], approver: "Intercompany accountant", does: "Matches intercompany daily, names the break owner and proposes the elimination.", guardrail: "Elimination entries need controller approval." },
  { id: "ag_close", name: "Close agent", on: ["rp_close"], activities: ["Manage close calendar", "Track close task status", "Summarise close issues"], approver: "Controller", does: "Tracks the close calendar, chases late tasks and writes the daily close summary.", guardrail: "Cannot sign off a task on anyone's behalf." },
  { id: "ag_disc", name: "Disclosure agent", on: ["rp_stat"], activities: ["Draft financial statement notes", "Prepare disclosure checklists"], approver: "Financial reporting lead", does: "Drafts notes from reconciled balances and checks them against the disclosure checklist.", guardrail: "Every figure cites its balance; no figure without a source." },
  { id: "ag_reg", name: "Regulatory reporting agent", on: ["rp_reg", "an_ftp"], activities: ["Prepare regulatory returns", "Respond to regulator queries", "Regulatory reporting policy and guidelines"], approver: "Head of regulatory reporting", does: "Prepares returns from the golden source and drafts answers to regulator queries.", guardrail: "Submissions are filed by a person." },
  { id: "ag_var", name: "Variance commentary agent", on: ["rp_mis", "rp_fa", "rp_dash"], activities: ["Draft variance commentary", "Answer ad hoc performance queries", "Produce management packs", "Prepare board briefing material"], approver: "FP&A lead", does: "Explains variances from reconciled results and answers ad hoc performance questions.", guardrail: "Numbers come from queries on the golden source, never from the model." },
  { id: "ag_fcst", name: "Forecast agent", on: ["rp_plan"], activities: ["Generate driver-based forecasts", "Run scenario analysis", "Document forecast assumptions"], approver: "FP&A lead", does: "Runs driver-based forecasts and scenarios and documents every assumption.", guardrail: "Assumptions are shown and owned by a person." },
  { id: "ag_pol", name: "Accounting policy agent", on: ["x_gov"], activities: ["Draft accounting policy documentation", "Research technical accounting issues", "Assess new standard impacts"], approver: "Chief accountant", does: "Researches technical issues and drafts policy text with cited standards.", guardrail: "Policy changes are approved by the chief accountant." },
  { id: "ag_ver", name: "Independent verifier", on: ["cr_recbal", "op_glbal"], activities: [], approver: "Not applicable", does: "Re-performs every agent result against reconciled balances before a person sees it. A failed check stops the result.", guardrail: "Separate from the agent that did the work." },
];

/** Master Prompt v3, Appendix B, in the deck's taxonomy format; PCF hierarchy ids where an APQC element fits. */
const tax = (l1: string, pcf: string, groups: [string, [string, string, string[]][]][]): TaxonomySpec => ({
  title: l1,
  l1,
  pcf,
  groups: groups.map(([name, processes]) => ({
    name,
    processes: processes.map(([pname, ppcf, acts]) => ({
      name: pname,
      pcf: ppcf || undefined,
      activities: acts.map((a) => {
        const [n, r] = a.split("|");
        const impact: Impact = r === "H" ? "high" : r === "M" ? "moderate" : "low";
        return { name: n, impact };
      }),
    })),
  })),
  source: "Illustrative taxonomy (Master Prompt v3, Appendix B); GenAI ratings to be validated with the client's AI governance team.",
});

export const TAXONOMY: TaxonomySpec[] = [
  tax("Record to Report (R2R)", "9.3", [
    ["General Ledger & Journals", [["Journal Processing", "9.3.2.2", ["Prepare recurring journals|M", "Draft journal descriptions and support|H", "Review and approve manual journals", "Post and validate journals"]], ["Accruals & Provisions", "9.3.2.4", ["Estimate accruals|M", "Document accrual rationale|H", "Reverse prior-period accruals"]]]],
    ["Intercompany", [["Intercompany Accounting", "9.3.2.5", ["Match intercompany transactions|H", "Resolve intercompany breaks|H", "Settle intercompany balances"]]]],
    ["Account Reconciliation", [["Balance Sheet Reconciliation", "9.3.2.6", ["Prepare reconciliations|M", "Investigate reconciling items|H", "Draft reconciliation commentary|H", "Certify reconciliations"]]]],
    ["Fixed Assets", [["Asset Accounting", "9.3.3", ["Capitalise assets", "Run depreciation", "Review impairment indicators|M"]]]],
  ]),
  tax("Order to Cash (O2C)", "9.2", [
    ["Billing", [["Invoice Management", "9.2.2", ["Generate invoices", "Resolve billing disputes|M", "Draft customer correspondence|H"]]]],
    ["Cash Application", [["Apply Cash", "9.2.3", ["Match remittances to invoices|H", "Investigate unapplied cash|M", "Post cash receipts"]]]],
    ["Collections", [["Collections Management", "9.2.4", ["Prioritise collection worklists|M", "Draft dunning communications|H", "Summarise customer payment history|H", "Escalate overdue accounts"]]]],
    ["Credit", [["Credit Management", "9.2.1", ["Assess customer credit limits|M", "Review credit exceptions"]]]],
  ]),
  tax("Procure to Pay (P2P)", "9.6", [
    ["Procurement", [["Requisition & PO", "", ["Create purchase requisitions", "Answer procurement policy queries|H", "Approve purchase orders"]]]],
    ["Invoice Processing", [["Capture & Match", "9.6.1", ["Extract invoice data|H", "Perform three-way match|M", "Resolve match exceptions|M"]]]],
    ["Payments", [["Payment Runs", "9.6.1", ["Prepare payment proposals", "Screen payments for duplicates|M", "Release payments"]]]],
    ["Supplier Management", [["Supplier Master", "", ["Onboard suppliers|M", "Respond to supplier enquiries|H"]]]],
  ]),
  tax("Account to Report (A2R)", "9.3", [
    ["Close Management", [["Period Close", "", ["Manage close calendar|M", "Track close task status|M", "Summarise close issues|H"]]]],
    ["Consolidation", [["Group Consolidation", "9.3.2.7", ["Load entity results", "Eliminate intercompany|M", "Translate foreign currency"]]]],
    ["External Reporting", [["Statutory Reporting", "9.3.4.6", ["Draft financial statement notes|H", "Prepare disclosure checklists|M", "Review statutory accounts"]], ["Regulatory Reporting", "9.3.4.7", ["Regulatory reporting policy and guidelines|H", "Prepare regulatory returns|M", "Reconcile regulatory to GL|M", "Respond to regulator queries|H"]]]],
    ["Accounting Policy", [["Policy Management", "9.3.1", ["Draft accounting policy documentation|H", "Research technical accounting issues|H", "Assess new standard impacts|M"]]]],
  ]),
  tax("Financial Planning & Analysis (FP&A)", "9.1", [
    ["Planning & Budgeting", [["Annual Budget", "9.1.2", ["Issue budget guidelines|M", "Collect business unit inputs", "Consolidate budget submissions"]]]],
    ["Forecasting", [["Rolling Forecast", "9.1.2", ["Generate driver-based forecasts|M", "Run scenario analysis|M", "Document forecast assumptions|H"]]]],
    ["Performance Reporting", [["Management Reporting", "9.1.5", ["Produce management packs|M", "Draft variance commentary|H", "Answer ad hoc performance queries|H"]]]],
    ["Special Projects", [["Special Projects", "", ["Build business cases|M", "Support M&A analysis|M", "Prepare board briefing material|H"]]]],
  ]),
];

const cap = (name: string, components: string[], today: 1 | 2 | 3, target: 1 | 2 | 3): Capability => ({ name, components, today, target });
/** Maturity is a hypothesis until confirmed in workshops. */
export const CAPABILITIES: Capability[] = [
  cap("General Ledger & Journals", ["op_rules", "op_glbal", "op_finadj"], 2, 3),
  cap("Intercompany", ["op_reccons"], 1, 3),
  cap("Account Reconciliation", ["pv_rec", "op_reccons", "cr_recbal"], 1, 3),
  cap("Fixed Assets", ["src_oth", "op_rules"], 2, 2),
  cap("Billing", ["src_oth"], 2, 2),
  cap("Cash Application", ["src_oth", "pv_txn"], 2, 3),
  cap("Collections", ["src_oth", "cr_cust"], 1, 2),
  cap("Credit", ["an_cred"], 2, 2),
  cap("Procurement", ["src_oth"], 2, 2),
  cap("Invoice Processing", ["src_oth", "pv_txn"], 1, 3),
  cap("Payments", ["src_oth"], 2, 2),
  cap("Supplier Management", ["x_mdm"], 2, 2),
  cap("Close Management", ["rp_close"], 1, 3),
  cap("Consolidation", ["op_reccons"], 1, 3),
  cap("External Reporting", ["rp_stat", "rp_reg"], 2, 3),
  cap("Accounting Policy", ["x_gov"], 1, 2),
  cap("Planning & Budgeting", ["rp_plan"], 2, 2),
  cap("Forecasting", ["rp_plan"], 1, 3),
  cap("Performance Reporting", ["rp_mis", "rp_dash", "rp_fa"], 1, 3),
  cap("Special Projects", ["rp_fa"], 2, 2),
];

export const REFERENCE_MODEL: FinanceModel = { title: "Future-state finance", components: COMPONENTS, steps: STEPS, agents: AGENTS, taxonomy: TAXONOMY, capabilities: CAPABILITIES };

/** Every activity in the taxonomy, with its path. */
export function activities(m: FinanceModel) {
  return m.taxonomy.flatMap((t) => t.groups.flatMap((g) => g.processes.flatMap((p) => p.activities.map((a) => ({ ...a, l1: t.l1, l2: g.name, l3: p.name, pcf: p.pcf })))));
}

/**
 * Every broken link in the model, in words: an unknown component, container, agent activity or capability, a
 * duplicate id, or a PCF id that pcfExists rejects. Empty means every view can draw it. pcfExists is passed in so
 * the browser bundle does not carry the PCF data; the server and the tests pass findPcfElement.
 */
export function validateFinanceModel(m: FinanceModel, pcfExists?: (hierarchyId: string) => boolean): string[] {
  const errs: string[] = [];
  const known = (id: string) => id in m.components || id in CONTAINERS || HEADERS.includes(id);
  m.steps.forEach((s, i) => {
    if (Array.isArray(s.on)) for (const id of s.on) if (!known(id)) errs.push(`Step ${i + 1} highlights unknown "${id}"`);
    for (const a of s.arrows ?? []) for (const id of [a.from, a.to]) if (!known(id)) errs.push(`Step ${i + 1} draws an arrow to unknown "${id}"`);
    for (const c of s.chips ?? []) {
      if (!known(c.target)) errs.push(`Step ${i + 1} puts a COA chip on unknown "${c.target}"`);
      if (!/^[tkn]{1,3}$/.test(c.segments)) errs.push(`Step ${i + 1} has COA segments "${c.segments}"; use t, k and n`);
    }
  });
  const acts = new Set(activities(m).map((a) => a.name));
  const ids = new Set<string>();
  for (const a of m.agents) {
    if (ids.has(a.id)) errs.push(`Agent id "${a.id}" is used twice`);
    ids.add(a.id);
    if (!a.on.length) errs.push(`${a.name} sits on no component`);
    for (const c of a.on) if (!(c in m.components)) errs.push(`${a.name} sits on unknown component "${c}"`);
    for (const n of a.activities) if (!acts.has(n)) errs.push(`${a.name} covers "${n}", which is not an activity in the taxonomy`);
  }
  const groups = new Set(m.taxonomy.flatMap((t) => t.groups.map((g) => g.name)));
  for (const c of m.capabilities) {
    if (!groups.has(c.name)) errs.push(`Capability "${c.name}" is not an L2 group in the taxonomy`);
    for (const k of c.components) if (!(k in m.components)) errs.push(`Capability "${c.name}" maps to unknown component "${k}"`);
  }
  for (const g of groups) if (!m.capabilities.some((c) => c.name === g)) errs.push(`L2 group "${g}" has no capability entry`);
  if (pcfExists)
    for (const t of m.taxonomy)
      for (const id of [t.pcf, ...t.groups.flatMap((g) => [g.pcf, ...g.processes.map((p) => p.pcf)])])
        if (id && !pcfExists(id)) errs.push(`APQC PCF id ${id} does not exist in PCF v8.0`);
  return errs;
}
