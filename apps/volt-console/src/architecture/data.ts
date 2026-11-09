/**
 * Finance reference architecture content for the Architecture tab: a large Canadian bank with a US subsidiary
 * (D-SIB pattern), seven design patterns, three platform stacks and three other industries. Illustrative only:
 * no bank's figures, names or branding. Vendor boundaries follow
 * plugins/volt/skills/design-finance-architecture/references/platform-matrix.md.
 */

/** k: "a" recommended path, "h" differs from the bank pattern, undefined plain. */
export interface Box {
  t: string;
  s?: string;
  k?: "a" | "h";
}
export interface Column {
  title: string;
  items: Box[];
}
/** [fromColumn, fromItem, toColumn, toItem, dashed?] */
export type Link = [number, number, number, number, "x"?];

export interface Diagram {
  name: string;
  caption: string;
  cols: Column[];
  links?: Link[];
  colW?: number;
  w?: number;
}

export const SEGMENTS = ["Canadian P&C", "US P&C (US bank sub)", "Wealth Management", "Capital Markets", "Corporate Services & Treasury"];

/** Capability rows; a single string spans every segment (shared group capability). */
export const CAPABILITIES: { name: string; cells: string[] | string }[] = [
  { name: "Engage customers", cells: ["Branch, digital, advice centres, broker channel", "Branch and digital, commercial relationship managers", "Advisers, online brokerage, insurance distribution", "Coverage, sales and trading desks", "Group brand, enterprise CRM"] },
  { name: "Originate and service", cells: ["Residential mortgages, HELOCs, cards, deposits, SME lending", "Commercial and consumer loans, deposits, cards", "Fee-based accounts, asset management, life and annuity", "Securities, derivatives, lending, M&A advisory", "Funding, securitisation, hedging"] },
  { name: "Manage risk", cells: ["IFRS 9 ECL staging, retail adjudication", "US CECL allowance, CCAR/DFAST stress tests", "Suitability, market risk on balances", "Market risk (VaR, FRTB), CVA, counterparty credit", "ICAAP, IRRBB, liquidity risk"] },
  { name: "Record and report (finance)", cells: "Event-driven accounting hub, multi-basis GL (IFRS group, US GAAP for the US subsidiary), subledgers, intercompany, IFRS consolidation, management and segment reporting, FTP" },
  { name: "Treasury and capital", cells: "ALM, funds transfer pricing, capital allocation (CET1, leverage), liquidity (LCR, NSFR), wholesale funding" },
  { name: "Regulatory and compliance", cells: ["OSFI returns, FCAC conduct", "FR Y-9C, FFIEC 031, FR Y-14, Reg W", "CIRO and SEC adviser rules", "Trade reporting, Volcker", "OSFI BCAR, LAR, LR, Pillar 3; B-13, E-23"] },
  { name: "Data and technology", cells: "Finance data platform with critical data element lineage (BCBS 239), reference data (COA, entities, products), controls evidence store, identity and SoD" },
];

export const LAYERS = ["Sources", "Events", "Accounting hub", "General ledger", "EPM and close", "Reporting"];

export const REFERENCE: Diagram[] = [
  {
    name: "target-architecture",
    caption: "From business event to regulatory return: six layers of the target finance architecture",
    w: 1080,
    colW: 160,
    cols: [
      { title: "Sources", items: [{ t: "Core banking CA", s: "mortgages, deposits" }, { t: "Core banking US", s: "commercial, consumer" }, { t: "Wealth platform", s: "fees, AUM" }, { t: "Trading and risk", s: "positions, fair values" }, { t: "Risk engines", s: "ECL, CECL, stress" }] },
      { title: "Event layer", items: [{ t: "Business events", s: "versioned, idempotent" }, { t: "Measurement refs", s: "golden cases, model runs" }, { t: "Controls", s: "completeness totals" }] },
      { title: "Accounting hub", items: [{ t: "Rule engine", s: "approved rules per basis", k: "a" }, { t: "Multi-basis", s: "IFRS and US GAAP", k: "a" }, { t: "Subledger", s: "contract balances", k: "a" }] },
      { title: "General ledger", items: [{ t: "CA-IFRS", s: "parent bank, CAD", k: "a" }, { t: "US-USGAAP", s: "US bank, USD", k: "a" }, { t: "US-IFRS", s: "US bank, group basis", k: "a" }] },
      { title: "EPM and close", items: [{ t: "Consolidation", s: "FX, eliminations" }, { t: "Segment and FTP", s: "five segments" }, { t: "Plan and forecast", s: "capital, ICAAP" }] },
      { title: "Reporting", items: [{ t: "IFRS statements", s: "annual, quarterly" }, { t: "OSFI returns", s: "BCAR, LAR, LR, Pillar 3" }, { t: "US returns", s: "FR Y-9C, FFIEC 031, Y-14" }, { t: "Management", s: "segment P&L, KPIs" }] },
    ],
  },
  {
    name: "one-event-two-bases",
    caption: "One event, two bases: a USD 2,000,000 commercial loan posts to US GAAP (CECL allowance 38,500) and IFRS (stage 1 ECL 9,200). Synthetic amounts.",
    w: 760,
    colW: 200,
    cols: [
      { title: "Event", items: [{ t: "CML-FUND-0001 v1", s: "loan funded, USD 2,000,000", k: "a" }] },
      { title: "Accounting hub", items: [{ t: "Rule US-CML-FUND", s: "basis US GAAP", k: "a" }, { t: "Rule US-CML-FUND-IFRS", s: "basis IFRS (group)", k: "a" }] },
      { title: "Ledgers", items: [{ t: "US-USGAAP", s: "allowance 38,500 (lifetime)", k: "a" }, { t: "US-IFRS", s: "ECL 9,200 (12-month)", k: "a" }] },
    ],
    links: [[0, 0, 1, 0], [0, 0, 1, 1], [1, 0, 2, 0], [1, 1, 2, 1]],
  },
];

export interface Pattern extends Diagram {
  fit: "Strong" | "Partial" | "Weak";
  use: string;
  trade: string;
}

export const PATTERNS: Pattern[] = [
  { name: "Accounting hub vs direct feeds", fit: "Strong", caption: "Accounting hub",
    cols: [{ title: "Sources", items: [{ t: "Core banking" }, { t: "Trading" }, { t: "Risk engines" }] }, { title: "Accounting", items: [{ t: "Event hub + rules", s: "versioned rules", k: "a" }] }, { title: "Ledger", items: [{ t: "General ledger", k: "a" }] }],
    use: "Many source systems, several accounting bases, and a need to trace every journal to an event and rule version.",
    trade: "Higher build and run cost; rule governance becomes a permanent function. Direct feeds are cheaper but spread accounting logic across sources." },
  { name: "Multi-basis ledgers", fit: "Strong", caption: "Multi-basis ledgers",
    cols: [{ title: "Event", items: [{ t: "Loan funded", s: "one event", k: "a" }] }, { title: "Rules", items: [{ t: "IFRS rule", k: "a" }, { t: "US GAAP rule", k: "a" }] }, { title: "Ledgers", items: [{ t: "IFRS ledger", s: "group basis", k: "a" }, { t: "US GAAP ledger", s: "US subsidiary", k: "a" }] }],
    links: [[0, 0, 1, 0], [0, 0, 1, 1], [1, 0, 2, 0], [1, 1, 2, 1]],
    use: "A subsidiary reports locally on a different basis (US GAAP, CECL) while the group reports IFRS (ECL).",
    trade: "Two full ledgers double reconciliation. An adjustment-only ledger is lighter but incomplete alone and needs matching COA, calendar and currency." },
  { name: "Product subledger", fit: "Strong", caption: "Product subledger",
    cols: [{ title: "Contracts", items: [{ t: "Mortgages" }, { t: "Cards" }, { t: "Commercial loans" }] }, { title: "Subledger", items: [{ t: "Contract balances", s: "principal, ECL, EIR", k: "a" }] }, { title: "GL", items: [{ t: "Summarised GL", s: "by account + dims", k: "a" }] }],
    use: "Millions of contracts with instrument-level measurement (EIR, ECL staging) that the GL should not hold.",
    trade: "Risk of measuring the same loan twice (core, subledger, hub). Agree one measurement owner per amount." },
  { name: "Centralised EPM", fit: "Strong", caption: "Centralised EPM",
    cols: [{ title: "Ledgers", items: [{ t: "CA-IFRS" }, { t: "US-IFRS" }, { t: "Other entities" }] }, { title: "EPM", items: [{ t: "One EPM platform", s: "consolidate + plan", k: "a" }] }, { title: "Outputs", items: [{ t: "Statements", k: "a" }, { t: "Segments + FTP", k: "a" }, { t: "Forecast", k: "a" }] }],
    links: [[0, 0, 1, 0], [0, 1, 1, 0], [0, 2, 1, 0], [1, 0, 2, 0], [1, 0, 2, 1], [1, 0, 2, 2]],
    use: "One version of actuals for consolidation, segment reporting and planning; metadata governed once.",
    trade: "Federated EPM gives specialist depth but needs a metadata hub and mapping controls." },
  { name: "Data-platform-led finance", fit: "Partial", caption: "Data-platform-led finance",
    cols: [{ title: "Sources", items: [{ t: "Core systems" }, { t: "Market data" }, { t: "Risk" }] }, { title: "Platform", items: [{ t: "Finance lakehouse", s: "governed, versioned", k: "a" }] }, { title: "Consumers", items: [{ t: "GL / hub" }, { t: "EPM" }, { t: "Regulatory" }] }],
    links: [[0, 0, 1, 0], [0, 1, 1, 0], [0, 2, 1, 0], [1, 0, 2, 0], [1, 0, 2, 1], [1, 0, 2, 2]],
    use: "Finance and risk share granular data; regulatory and management reporting need the same detail.",
    trade: "The platform is not a book of record. Keep accounting in the hub and GL, and reconcile the platform to them." },
  { name: "Regulatory lineage spine", fit: "Strong", caption: "Regulatory lineage spine", colW: 118, w: 560,
    cols: [{ title: "Return", items: [{ t: "OSFI cell", s: "e.g. BCAR line", k: "a" }] }, { title: "Reporting", items: [{ t: "Reg. mapping", s: "versioned rules", k: "a" }] }, { title: "Ledger", items: [{ t: "GL + subledger", k: "a" }] }, { title: "Event", items: [{ t: "Source event", s: "id + version", k: "a" }] }],
    use: "Supervisors expect drill-back from a return cell to source (BCBS 239 critical data elements).",
    trade: "Lineage must be designed into event keys and mappings from day one; retrofitting is expensive." },
  { name: "Close orchestration layer", fit: "Partial", caption: "Close orchestration",
    cols: [{ title: "Ledgers", items: [{ t: "GL" }, { t: "Subledgers" }] }, { title: "Close", items: [{ t: "Close tasks", k: "a" }, { t: "Reconciliations", k: "a" }] }, { title: "Sign-off", items: [{ t: "Controller review", k: "a" }] }],
    links: [[0, 0, 1, 0], [0, 1, 1, 1], [1, 0, 2, 0], [1, 1, 2, 0]],
    use: "Day-plus close targets, many entities and SOX or ICFR evidence needs.",
    trade: "A reconciliation tool evidences balances; it does not fix source measurement. Fix upstream breaks first." },
];

export interface Stack {
  id: "oracle" | "sap" | "bob";
  label: string;
  lanes: Box[][];
  caveat: string;
}

export const STACKS: Stack[] = [
  { id: "oracle", label: "Oracle",
    lanes: [[{ t: "Core banking" }, { t: "Trading, risk" }], [{ t: "Integration", s: "OIC or bank ESB" }], [{ t: "Accounting Hub", s: "SLA rules, mapping sets", k: "a" }], [{ t: "Fusion GL", s: "primary ledger", k: "a" }, { t: "Secondary ledger", s: "US GAAP basis", k: "a" }], [{ t: "FCCS", s: "consolidation", k: "a" }, { t: "Planning, ARCS", k: "a" }, { t: "EDM", s: "metadata", k: "a" }], [{ t: "Statements" }, { t: "Reg. reporting", s: "specialist tool" }]],
    caveat: "Verify in tenant: Accounting Hub event uniqueness, effective dates, import and GL acknowledgement. A hub is not a loan cash-flow or ECL model. Choose the secondary-ledger conversion level (balance, journal, subledger, adjustment-only); adjustment-only needs matching COA, calendar and currency." },
  { id: "sap", label: "SAP",
    lanes: [[{ t: "Core banking" }, { t: "Trading, risk" }], [{ t: "Integration", s: "SAP Integration Suite" }], [{ t: "Fioneer FPSL", s: "product subledger", k: "a" }], [{ t: "S/4HANA", s: "Universal Journal", k: "a" }, { t: "Non-leading ledger", s: "US GAAP basis", k: "a" }], [{ t: "Group Reporting", k: "a" }, { t: "Analytics Cloud", s: "planning", k: "a" }], [{ t: "Statements" }, { t: "Reg. reporting", s: "specialist tool" }]],
    caveat: "Verify in tenant: FPSL calculation and posting ownership and licensed scope, so loans are not measured twice across core, FPSL and hub. Check extension-ledger inheritance, currency and fiscal-year variants, and Group Reporting release, FS-item mappings and consolidation units." },
  { id: "bob", label: "Best-of-breed",
    lanes: [[{ t: "Core banking" }, { t: "Trading, risk" }], [{ t: "Data platform", s: "Snowflake or Databricks", k: "a" }], [{ t: "Rules engine", s: "Acct Center or custom", k: "a" }], [{ t: "Cloud GL", s: "multi-book", k: "a" }], [{ t: "OneStream", s: "or Anaplan", k: "a" }], [{ t: "Statements" }, { t: "Reg. reporting", s: "specialist tool" }]],
    caveat: "Verify in tenant: Workday Accounting Center prerequisites, worktag enrichment and drill-through; OneStream cube grain, Flow, Origin and UD dimensions; the exact Anaplan product and its accounting role. A custom rules engine needs its own controls, versioning and audit evidence." },
];

export const COMPARISON: { concern: string; oracle: string; sap: string; bob: string }[] = [
  { concern: "Event hub", oracle: "Accounting Hub (SLA): event classes, rules, mapping sets", sap: "FPSL as product subledger; events via FPSL and integration layer", bob: "Rules engine over the data platform, or Workday Accounting Center" },
  { concern: "Multi-basis", oracle: "Primary plus secondary ledgers; reporting currencies separate", sap: "Leading and non-leading standard ledgers, extension ledgers", bob: "Multi-book in the cloud GL; check book-mapping restrictions" },
  { concern: "Subledger depth", oracle: "Hub derives accounting; measurement stays in source or risk engines", sap: "FPSL can hold instrument-level measurement; agree ownership", bob: "Data platform holds detail; measurement in source or a dedicated engine" },
  { concern: "Consolidation", oracle: "FCCS", sap: "Group Reporting", bob: "OneStream (or Anaplan consolidation, if contracted)" },
  { concern: "Regulatory", oracle: "Specialist tool fed from GL and data mart", sap: "Specialist tool fed from Universal Journal and FPSL", bob: "Specialist tool fed from the data platform" },
  { concern: "Metadata", oracle: "EDM governs dimensions across ERP and EPM", sap: "Master data governance in S/4 and Group Reporting", bob: "Metadata hub required; no single owner by default" },
  { concern: "Key risks", oracle: "Hub mistaken for a measurement engine; secondary-ledger level chosen late", sap: "Double measurement across core, FPSL and hub; licence scope", bob: "Integration and control burden; more vendors to govern" },
];

export interface Industry {
  name: string;
  tag: string;
  reportsTo: string;
  lanes: Box[];
  events: string[];
}

export const INDUSTRIES: Industry[] = [
  { name: "D-SIB bank", tag: "VOLT method pack", reportsTo: "OSFI (BCAR, LAR, LR, Pillar 3); US: FR Y-9C, FFIEC 031",
    lanes: [{ t: "Core banking", s: "loans, deposits" }, { t: "Events", s: "fund, accrue, stage" }, { t: "Hub + subledger", s: "IFRS 9 EIR, ECL" }, { t: "Multi-basis GL", s: "IFRS, US GAAP" }, { t: "EPM", s: "consolidation, FTP" }, { t: "Reg. returns", s: "capital, liquidity" }],
    events: ["Mortgage funded", "ECL stage transfer", "Fee earned (IFRS 15)", "FVTPL revaluation"] },
  { name: "Insurer", tag: "Practitioner pattern", reportsTo: "OSFI (LICAT for life, MCT for P&C); provincial regulators",
    lanes: [{ t: "Policy admin", s: "+ claims" }, { t: "Events", s: "issue, premium, claim" }, { t: "IFRS 17 engine", s: "GMM, PAA, VFA", k: "h" }, { t: "Multi-basis GL", s: "IFRS 17, statutory", k: "h" }, { t: "EPM", s: "CSM roll-forward", k: "h" }, { t: "Reg. returns", s: "LICAT, MCT", k: "h" }],
    events: ["Policy issued (group of contracts)", "Premium received", "Claim incurred", "CSM release for service"] },
  { name: "Utility", tag: "Practitioner pattern", reportsTo: "Provincial energy regulator (rate cases); securities regulator",
    lanes: [{ t: "Billing, metering", s: "+ work orders" }, { t: "Events", s: "bill, capitalise" }, { t: "Project + assets", s: "capex, AFUDC", k: "h" }, { t: "GL", s: "reg. deferral accts", k: "h" }, { t: "EPM", s: "rate base, capex plan", k: "h" }, { t: "Rate filings", s: "+ statements", k: "h" }],
    events: ["Customer billed", "Capital project placed in service", "Regulatory deferral recognised", "Depreciation by asset class"] },
  { name: "Public sector (Canada)", tag: "Practitioner pattern", reportsTo: "PSAS statements; central agency and legislature reporting",
    lanes: [{ t: "Programs, grants", s: "+ procurement" }, { t: "Events", s: "commit, obligate" }, { t: "Fund accounting", s: "appropriations", k: "h" }, { t: "GL", s: "commitments, PSAS", k: "h" }, { t: "EPM", s: "budget vs actual", k: "h" }, { t: "Public accounts", s: "+ central reporting", k: "h" }],
    events: ["Appropriation loaded", "Commitment raised", "Grant expense recognised", "Year-end lapse of unspent authority"] },
];

/** A platform stack drawn on the six-layer frame. */
export const stackDiagram = (s: Stack): Diagram => ({
  name: `stack-${s.id}`,
  caption: `${s.label} stack on the six-layer frame`,
  w: 1080,
  colW: 160,
  cols: LAYERS.map((title, i) => ({ title, items: s.lanes[i] })),
});

/** An industry on the six-layer frame, one box per layer. */
export const industryDiagram = (d: Industry): Diagram => ({
  name: `industry-${d.name.toLowerCase().replace(/[^a-z]+/g, "-")}`,
  caption: `${d.name} on the six-layer frame`,
  w: 1080,
  colW: 160,
  cols: LAYERS.map((title, i) => ({ title, items: [d.lanes[i]] })),
});

/** Markdown summary of the whole tab, used for the PowerPoint, Word and Markdown downloads. */
export function architectureMarkdown(): string {
  const cell = (s: string) => s.replace(/\|/g, "/");
  return [
    "Illustrative reference architecture for a large Canadian bank with a US subsidiary. No bank figures, names or branding; vendor capabilities must be verified in the client's licensed release.",
    "",
    "## Capability map",
    "",
    `| Capability | ${SEGMENTS.join(" | ")} |`,
    `|---|${SEGMENTS.map(() => "---").join("|")}|`,
    ...CAPABILITIES.map((c) => `| ${c.name} | ${typeof c.cells === "string" ? [cell(c.cells), ...SEGMENTS.slice(1).map(() => "(shared)")].join(" | ") : c.cells.map(cell).join(" | ")} |`),
    "",
    "## Design patterns",
    "",
    "| Pattern | D-SIB fit | Use when | Trade-off |",
    "|---|---|---|---|",
    ...PATTERNS.map((p) => `| ${p.name} | ${p.fit} | ${cell(p.use)} | ${cell(p.trade)} |`),
    "",
    "## Platform stacks",
    "",
    "| Concern | Oracle | SAP | Best-of-breed |",
    "|---|---|---|---|",
    ...COMPARISON.map((r) => `| ${r.concern} | ${cell(r.oracle)} | ${cell(r.sap)} | ${cell(r.bob)} |`),
    "",
    ...STACKS.flatMap((s) => [`- **${s.label}:** ${s.caveat}`]),
    "",
    "## Industries",
    "",
    "| Industry | Basis | Signature events | Reports to |",
    "|---|---|---|---|",
    ...INDUSTRIES.map((d) => `| ${d.name} | ${d.tag} | ${d.events.join("; ")} | ${cell(d.reportsTo)} |`),
    "",
  ].join("\n");
}
