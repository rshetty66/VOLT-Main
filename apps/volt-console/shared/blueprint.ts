/**
 * Accounting Rule Engine Blueprint input questionnaire (Rakesh, 2026-11-28). Sections A to H, 28 questions, each mapped to
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

/** Whether an ask is about an accounting rule engine or hub, so the review screen opens the questionnaire. */
export const isBlueprintAsk = (text: string) => /accounting (rule|rules) engine|rule engine|accounting hub|sub-?ledger|client_config/i.test(text);

/**
 * The questionnaire as a prompt block. Answered fields are passed as given; blank ones as [to confirm]; a skipped section
 * says to use labelled defaults (or the attached files) and never invent client facts.
 */
export function blueprintBlock(answers: Record<number, string>, skipped: Set<string>, files: string[] = []): string {
  const lines = [
    "## Accounting Rule Engine Blueprint Inputs (client_config.json)",
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
  return lines.join("\n");
}
