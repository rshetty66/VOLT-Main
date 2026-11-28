/**
 * The five required views of a finance transformation deliverable for a mid-size Canadian bank moving its close from
 * 9 to 5 days. Illustrative content for tests and the sample deck; the PCF ids are from APQC PCF Cross-Industry v8.0
 * as the apqc_pcf tool returns them.
 */
const process = {
  title: "Five-day close, D-2 to D+3",
  note: "Seven of the steps move before month-end",
  lanes: ["Entity accounting", "Intercompany", "Group reporting"],
  steps: [
    { id: "ic", lane: "Intercompany", stage: "D-2", name: "Agree intercompany balances", status: "new", pcf: "9.3.2.5 Post and reconcile intercompany transactions [10823]" },
    { id: "gaap", lane: "Entity accounting", stage: "D-2", name: "Post US GAAP differences", status: "new" },
    { id: "cut", lane: "Entity accounting", stage: "D+1", name: "Sub-ledger cut-off", status: "automated" },
    { id: "rec", lane: "Entity accounting", stage: "D+1", name: "Auto-reconcile accounts", status: "automated", pcf: "9.3.2.6 Reconcile general ledger accounts [10824]" },
    { id: "cons", lane: "Group reporting", stage: "D+2", name: "Consolidate", status: "automated" },
    { id: "pack", lane: "Group reporting", stage: "D+3", name: "Sign off reporting pack", status: "manual" },
  ],
  links: [
    { from: "ic", to: "cons", label: "agreed balances" },
    { from: "cut", to: "rec" },
    { from: "rec", to: "cons", label: "trial balance" },
    { from: "gaap", to: "cons" },
    { from: "cons", to: "pack" },
  ],
};

const taxonomy = {
  title: "Record to report: where the five-day close changes the work",
  note: "Change clusters in reconciliation, intercompany and consolidation",
  l1: "Record to report",
  pcf: "9.0 Manage Financial Resources [17058]",
  groups: [
    { name: "Perform general accounting", pcf: "9.3.2", processes: [
      { name: "Process journal entries", pcf: "9.3.2.2", activities: [{ name: "Post recurring US GAAP entries", impact: "high" }, { name: "Review manual journals", impact: "moderate" }] },
      { name: "Reconcile general ledger accounts", pcf: "9.3.2.6", activities: [{ name: "Match account balances", impact: "high" }, { name: "Certify reconciliations", impact: "moderate" }] },
      { name: "Post and reconcile intercompany transactions", pcf: "9.3.2.5", activities: [{ name: "Confirm counterparty balances", impact: "high" }, { name: "Resolve breaks", impact: "high" }, "Net and settle"] },
      { name: "Perform consolidations and process eliminations", pcf: "9.3.2.7", activities: [{ name: "Run consolidation", impact: "moderate" }, { name: "Eliminate intercompany", impact: "high" }] },
    ] },
    { name: "Perform financial reporting", pcf: "9.3.4", processes: [
      { name: "Prepare consolidated financial statements", pcf: "9.3.4.2", activities: [{ name: "Draft variance commentary", impact: "moderate" }, "Board sign-off"] },
      { name: "Perform legal and management consolidation", pcf: "9.3.4.8", activities: [{ name: "Reconcile legal to management view", impact: "moderate" }] },
    ] },
  ],
  source: "APQC PCF Cross-Industry v8.0 [S02]; impact [ESTIMATE]",
};

const business = {
  title: "Business reference architecture: capabilities the close depends on",
  layers: [
    { name: "Product and customer operations", items: [{ name: "Loan and deposit servicing", status: "keep" }, { name: "Treasury dealing", status: "keep" }] },
    { name: "Data provisioning and quality", items: [{ name: "Daily balance provisioning", status: "new" }, { name: "Data quality controls", status: "new" }] },
    { name: "Accounting and close", badge: "Change", items: [{ name: "Rules-based accounting", status: "new" }, { name: "Reconciliation and matching", status: "new" }, { name: "Manual spreadsheet close", status: "retire" }] },
    { name: "Reporting and disclosure", items: [{ name: "Group reporting pack", status: "keep" }, { name: "Regulatory returns", status: "keep" }] },
  ],
  flows: [
    { from: "Loan and deposit servicing", to: "Daily balance provisioning", label: "events" },
    { from: "Daily balance provisioning", to: "Rules-based accounting", label: "balances" },
    { from: "Rules-based accounting", to: "Reconciliation and matching" },
    { from: "Reconciliation and matching", to: "Group reporting pack", label: "certified TB" },
  ],
};

const technology = {
  title: "Technology reference architecture: recommended target",
  layers: [
    { name: "Source systems", items: [{ name: "Core banking", status: "keep" }, { name: "Treasury system", status: "keep" }] },
    { name: "Provisioning area", items: [{ name: "Finance data platform", status: "new" }] },
    { name: "Accounting engines", badge: "Recommended", items: [{ name: "Accounting rules engine", status: "new" }, { name: "Current ERP general ledger", status: "keep" }] },
    { name: "Close and consolidation", items: [{ name: "Reconciliation tool", status: "new" }, { name: "Consolidation platform", status: "new" }, { name: "Spreadsheet reconciliations", status: "retire" }] },
    { name: "Analysis and reporting", items: [{ name: "Reporting and analytics", status: "keep" }] },
  ],
  flows: [
    { from: "Core banking", to: "Finance data platform", label: "transactions" },
    { from: "Treasury system", to: "Finance data platform" },
    { from: "Finance data platform", to: "Accounting rules engine", label: "events" },
    { from: "Accounting rules engine", to: "Current ERP general ledger", label: "journals" },
    { from: "Current ERP general ledger", to: "Reconciliation tool", label: "balances" },
    { from: "Current ERP general ledger", to: "Consolidation platform", label: "trial balance" },
    { from: "Consolidation platform", to: "Reporting and analytics", label: "results" },
  ],
};

const lifecycle = {
  title: "Residential mortgage: where finance changes across the lifecycle",
  note: "Most of the gain is at origination and month-end servicing",
  product: "Residential mortgage",
  stages: [
    { name: "Originate", finance: ["Fees deferred (EIR)", "IFRS 9 stage 1 ECL"], today: "Fees adjusted by spreadsheet at month-end", change: "Rules engine posts fees and ECL at booking", impact: "high" },
    { name: "Service", finance: ["Interest accrual", "Payment allocation"], today: "Accruals reconciled after close", change: "Daily balances reconciled to the GL", impact: "high" },
    { name: "Modify", finance: ["Modification gain or loss"], today: "Calculated off-system", change: "Event triggers the accounting", impact: "moderate" },
    { name: "Arrears", finance: ["Stage 2 or 3 transfer", "Provision top-up"], change: "Staging feeds the close at D-1", impact: "moderate" },
    { name: "Close out", finance: ["Derecognition", "Write-off"], change: "No change", impact: "low" },
  ],
  source: "Illustrative [ASSUMPTION]",
};

const fim = {
  title: "Finance information model: every mortgage balance traces to its contracts",
  balance: { account: "13900 Residential mortgages", value: "CAD 4.2bn", status: "ties" },
  chain: [
    { level: "Source", items: ["Core banking", "Treasury system"] },
    { level: "Instrument", items: ["Mortgage contract", "Daily position"] },
    { level: "Accounting event", items: ["Fee deferral (EIR)", "ECL stage change"] },
    { level: "GL balance", items: ["13900 Residential mortgages"] },
    { level: "Report", items: ["Balance sheet", "Segment P&L"] },
  ],
  adjustments: [
    { level: "instrument", name: "EIR fee deferral", value: "-CAD 3.1M" },
    { level: "gl", name: "ECL management overlay", value: "+CAD 2.0M" },
  ],
  keys: ["Entity", "Business line", "Product", "Credit stage"],
  change: "Lineage reaches the instrument at D+1 instead of stopping at the GL",
  source: "Illustrative [ASSUMPTION]",
};

const aiLens = {
  title: "AI finance lens: finance owns the data spine AI depends on",
  layers: [
    { name: "Finance operating model", items: [{ name: "AI control tower", status: "new" }, { name: "Value capture office", status: "new" }] },
    { name: "Core finance technology and data", items: [{ name: "Accounting hub and subledger", status: "new" }, { name: "Lineage and data quality", status: "new" }, { name: "LLM gateway", status: "new" }] },
    { name: "AI-powered finance decisions", badge: "Biggest prize", items: [{ name: "Reconciliation matcher", status: "new" }, { name: "Journal entry reviewer", status: "new" }, { name: "Balance-sheet twin", status: "new" }] },
    { name: "Stakeholder engagement", items: [{ name: "Ask-the-ledger copilot", status: "new" }, { name: "Living board and ALCO packs", status: "new" }] },
  ],
  flows: [
    { from: "Lineage and data quality", to: "Reconciliation matcher", label: "trusted data" },
    { from: "Reconciliation matcher", to: "Ask-the-ledger copilot", label: "answers" },
  ],
  note: "No lineage, no regulator-ready AI",
};

const agentic = {
  title: "Agentic finance platform: agents inside finance platforms, one control plane",
  layers: [
    { name: "Enterprise systems and data", items: [{ name: "Core banking", status: "keep" }, { name: "Finance lakehouse", status: "new" }] },
    { name: "Integration", items: [{ name: "APIs and events", status: "keep" }, { name: "MCP gateway", status: "new" }] },
    { name: "Core finance", items: [{ name: "GL and accounting hub", status: "keep" }, { name: "Reconciliation and close", status: "keep" }] },
    { name: "Agentic framework", items: [{ name: "Embedded agents", status: "new" }, { name: "Human handoff and sign-off", status: "new" }] },
    { name: "Automation", items: [{ name: "Close task manager", status: "keep" }] },
    { name: "Finance actors and experience", items: [{ name: "Controllers and FP&A", status: "keep" }, { name: "CFO copilot", status: "new" }] },
    { name: "Agentic governance", items: [{ name: "Agent control plane", status: "new" }, { name: "Evaluations against the ledger", status: "new" }] },
  ],
  flows: [
    { from: "Core banking", to: "MCP gateway", label: "balances" },
    { from: "MCP gateway", to: "Embedded agents", label: "context" },
    { from: "Embedded agents", to: "GL and accounting hub", label: "proposals" },
    { from: "GL and accounting hub", to: "CFO copilot", label: "answers" },
  ],
};

const block = (lang: string, o: unknown) => "```" + lang + "\n" + JSON.stringify(o) + "\n```\n";

export const VIEWS = { process, taxonomy, business, technology, lifecycle, fim, aiLens, agentic };

/** The eight views as deliverable markdown, one "##" section each. */
export const VIEWS_MD = `
## Process view: seven close steps move before month-end

${block("process", process)}
## Process taxonomy: change clusters in reconciliation and intercompany

${block("taxonomy", taxonomy)}
## Business reference architecture: three capabilities are new

${block("architecture", business)}
## Technology reference architecture: a rules engine and a reconciliation layer on the current ledger

${block("architecture", technology)}
## Product lifecycle: the mortgage changes most at origination and servicing

${block("lifecycle", lifecycle)}
## Finance information model: the mortgage balance ties to its contracts

${block("fim", fim)}
## AI finance lens: recon and journal agents come first, on a clean data spine

${block("architecture", aiLens)}
## Agentic finance platform: agents sit inside the ledger, under one control plane

${block("architecture", agentic)}`;
