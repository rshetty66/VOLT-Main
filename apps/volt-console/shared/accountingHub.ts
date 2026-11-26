/**
 * Accounting Hub page: the content an agent supplies for the five-tab "Accounting Hub on Data Fabric" page (current
 * state, target hub, financial information model, master accounting flow, migration) and the checks it must pass.
 *
 * Content is kept apart from layout: the agent fills this schema, accountingHubPage.ts draws the page with fixed
 * design and technical rules, and checkHub runs the verifier (balanced journals, valid references, exclusions,
 * anonymity, trade-offs, no external references or inline handlers). A page that fails goes back to the agent with
 * every failure named.
 */
import { z } from "zod";

const s = (max: number) => z.string().trim().min(1).max(max);
const id = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,23}$/, "lower-case id, letters, digits, - or _");
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "#RRGGBB");

export const CLIENT_TYPES = ["consumer_lender", "retail_bank", "credit_union", "wealth_asset_manager", "insurer", "other"] as const;
export const CONTROL_IDS = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10", "C11", "C12", "C13", "C14", "C15", "C16", "C17"] as const;
/** How far each statement is evidenced. The page shows it as a badge so a hypothesis never reads as client fact. */
export const EVIDENCE = ["client_confirmed", "source_validated", "hypothesis", "illustrative", "decision_required"] as const;
/** What the hub must say an owner for, so a data platform is never assumed to be the accounting engine. */
export const RESPONSIBILITIES = ["intake", "rules", "replay", "corrections", "balances", "posting", "reconciliation", "audit"] as const;
export const NFR_AREAS = ["volumes", "resilience", "security", "operations", "ownership", "release", "audit"] as const;

const status = z.enum(EVIDENCE);
const ref = z.string().regex(/^S[0-9]{1,2}$/).optional().describe("Evidence id from evidence[], e.g. S1.");
const soWhat = z.object({ text: s(500).describe("The answer for this tab, quantified where the inputs allow."), trade_off: s(300).describe("The trade-off of the recommendation.") });
const tab = z.object({ headline: s(160).describe("Full-sentence action headline."), lede: s(400).describe("Two or three lines under the headline."), so_what: soWhat });

const system = z.object({
  id,
  name: s(40),
  sub: z.string().max(70).optional().describe("Short subtitle, e.g. products or technology."),
  column: z.enum(["source", "provisioning", "engine", "reporting", "users"]),
  tags: z.array(z.enum(["accounting", "product", "custom_logic", "manual", "gap"])).default([])
    .describe("accounting / product: on that data path; custom_logic: accounting rules run here; manual: manual input; gap: a reference capability the client's diagram lacks (drawn dashed, 'to confirm')."),
  role: s(300),
  issue: z.string().max(300).optional().describe("The issue this box creates today."),
  status: status.default("hypothesis"),
  source: ref,
});

const line = z.object({
  ledger: z.string().max(30).optional().describe("Accounting basis or ledger this line posts to, e.g. IFRS, US GAAP delta, Statutory. One event may post to several."),
  side: z.enum(["Dr", "Cr"]),
  account: s(60),
  gl_format: s(60).describe("The account in the GL platform's segment format, e.g. 1000-11050-CC200-PRD010."),
  factor: z.number().positive().max(100).describe("Amount as a multiple of the sample amount (1 = the amount)."),
});

const event = z.object({
  id,
  name: s(70),
  trigger: s(200).describe("What starts it, with the source fields."),
  frequency: s(40),
  handled_today: s(120),
  manual: z.boolean().default(false).describe("Handled manually today."),
  memo: z.boolean().default(false).describe("Updates the FIM only, no journal."),
  exception: z.boolean().default(false).describe("An exception path: failed, duplicate, late, corrected, reversed or backdated event."),
  status: status.default("illustrative"),
  source: ref,
  variant: z.string().max(60).optional().describe("Product variant, legal entity and jurisdiction the rule applies to."),
  dates: z.string().max(120).optional().describe("Effective date and accounting date treatment."),
  currency: z.string().max(80).optional().describe("Currency and translation treatment."),
  rule_version: z.string().max(40).optional(),
  reversal: z.string().max(160).optional().describe("Reversal, correction and restatement treatment."),
  treatment: z.string().max(160).optional().describe("The accounting treatment, in words (trace step 2)."),
  balance: z.string().max(80).optional().describe("The balance it changes (trace step 4)."),
  report: z.string().max(80).optional().describe("The report that shows it (trace step 5)."),
  lines: z.array(line).max(8).default([]),
  route: s(200).describe("Posting route, e.g. hub sub-ledger, summarised daily to the GL by account and cost centre."),
  fim: z.array(s(40)).max(6).default([]).describe("FIM entities touched."),
  attributes: z.array(s(40)).max(8).default([]).describe("Analytical attributes kept, not posted."),
  controls: z.array(z.enum(CONTROL_IDS)).max(8).default([]),
});

const product = z.object({
  name: s(50),
  source: s(40),
  catalogue: z.enum(["draft", "validated", "in_scope"]).default("draft").describe("How far the event catalogue is agreed."),
  stages: z.array(z.object({ name: s(30), events: z.array(event).min(1).max(8) })).min(3).max(10),
  open_items: z.array(s(160)).max(8).default([]).describe("Excluded events and unresolved accounting treatments."),
});

export const hubSchema = z.object({
  client: z.object({ name: s(60), short: z.string().max(20).optional(), type: z.enum(CLIENT_TYPES) }),
  branding: z.object({
    style: z.enum(["volt", "client_light", "boardroom"]).default("volt"),
    primary: hex.optional(),
    secondary: hex.optional(),
    logo_text: z.string().max(30).optional(),
  }).default({ style: "volt" }),
  audience: z.string().max(80).default("Client CFO and Controller"),
  confidentiality: z.enum(["client_draft", "internal"]).default("client_draft"),
  gl_platform: z.string().max(40).optional().describe("Name only this GL. Blank = 'General ledger (platform to confirm)'."),
  epm: z.string().max(40).optional().describe("Close, consolidation and EPM platform."),
  data_platform: z.string().max(80).optional(),
  current_state_source: z.string().max(120).optional().describe("Name and date of the client's current-state diagram, if one was attached."),
  accounts_illustrative: z.boolean().default(true).describe("True unless the accounts come from the client's own MAF documents or chart."),
  target_date: z.string().max(60).optional(),
  evidence: z.array(z.object({
    id: z.string().regex(/^S[0-9]{1,2}$/),
    name: s(100),
    date: z.string().max(30).optional(),
    section: z.string().max(60).optional(),
    kind: z.enum(["policy", "client_document", "interview", "public", "other"]),
  })).max(20).default([]).describe("Sources used, in the order of the source hierarchy: approved policy and client documents, confirmed interviews, public material."),
  prior_proof_approved: z.boolean().default(false).describe("Show the anonymised prior-delivery proof only when its figures and wording are approved for this audience."),
  exclusions: z.array(s(40)).max(20).default([]).describe("Names that must not appear anywhere on the page."),
  pain_points: z.array(s(160)).min(1).max(8),
  legacy_logic: z.array(s(60)).min(1).max(12).describe("Each place accounting rules run today, one component per item."),
  today: tab.extend({
    systems: z.array(system).min(3).max(32),
    flows: z.array(z.object({ from: id, to: id, path: z.enum(["accounting", "product", "other"]) })).max(48),
    platforms: z.array(s(40)).max(8).default([]),
    principles: z.array(z.object({ principle: s(80), today: s(200) })).min(2).max(4),
  }),
  target: tab.extend({
    consumers: z.array(s(30)).min(3).max(6).optional(),
    ownership: z.array(z.object({ responsibility: z.enum(RESPONSIBILITIES), component: s(80), record: s(60).describe("System of record."), status, source: ref })).max(8).default([])
      .describe("Which component owns each hub responsibility; any left out shows as 'to confirm'."),
    posting_grain: z.object({ proposal: s(160), criteria: s(300), status }).optional().describe("The GL posting grain, a design decision."),
  }),
  fim: tab.extend({
    entities: z.array(z.object({ name: s(30), attributes: z.array(s(40)).min(1).max(8), sourced: s(120), used_by: s(120) })).min(6).max(11).optional()
      .describe("Leave out to use the standard entities for the client type."),
    attributes: z.array(s(30)).max(10).optional().describe("Analytical attributes kept in the FIM, never posted."),
  }),
  maf: tab.extend({
    products: z.array(product).min(1).max(2).describe("Proof-of-concept product first, then the second product."),
    controls: z.array(z.object({ id: z.enum(CONTROL_IDS), owner: s(60), threshold: s(80), escalation: s(80) })).max(17).default([])
      .describe("Owner, threshold and escalation per control where known; the rest show 'to confirm'."),
  }),
  migration: tab.extend({
    waves: z.array(z.object({ id: z.string().regex(/^W[0-9]$/), name: s(60), scope: s(240), exit: s(240), duration: z.string().max(30).optional() })).min(3).max(6),
    reconciliation: z.array(z.object({ level: z.enum(["source_to_hub", "hub_to_gl", "gl_to_report"]), item: s(60), unit: z.enum(["amount", "count"]).default("amount"), legacy: z.number(), hub: z.number(), reason: s(120) })).max(10).optional()
      .describe("Synthetic legacy-vs-hub reconciliation rows; leave out for the standard illustration."),
    exit_thresholds: z.array(z.object({ measure: s(80), threshold: s(80), owner: s(60) })).max(8).optional()
      .describe("Parallel-run exit thresholds; leave out to show the standard measures with thresholds to confirm."),
    nfr: z.array(z.object({ area: z.enum(NFR_AREAS), requirement: s(200), status, source: ref })).max(14).default([]).describe("Non-functional and operating-model requirements; areas left out show as 'to confirm'."),
    value: z.array(z.object({ item: s(80), kind: z.enum(["current_cost", "one_time", "ongoing", "benefit_quantified", "benefit_qualitative"]), amount: s(30), evidence: s(120), confidence: z.enum(["high", "medium", "low"]), owner: s(60) })).max(12).default([])
      .describe("Value model rows; amounts without validated evidence stay [$ TBD]."),
    legacy: z.array(z.object({ component: s(60), disposition: z.enum(["Retire", "Replace", "Consolidate", "Retain"]), target: s(80), note: z.string().max(160).optional() })).min(1).max(16),
  }),
  confirm: z.array(z.object({ area: z.enum(["accounting_policy", "regulatory", "security", "data_residency", "architecture", "business_case", "other"]), item: s(200) })).min(3).max(10)
    .describe("Review list before any client-facing use: unresolved accounting policy, regulatory, security, data residency, architecture and business-case decisions."),
});

export type HubContent = z.infer<typeof hubSchema>;
export type HubEvent = z.infer<typeof event>;

/** The anonymised prior-delivery proof, always shown this way: the prior client is never named. */
export const PRIOR_CLIENT = "a Canadian digital bank (client anonymised)";

/** Names the page never carries, whatever the inputs say. */
const ALWAYS_EXCLUDED = ["PwC", "PricewaterhouseCoopers"];

const tokens = (t: string) => new RegExp(`(^|[^A-Za-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^A-Za-z0-9]|$)`, "i");

/** Every failure of the content and the drawn page, as lines the agent can act on. Empty means the page passes. */
export function checkHub(c: HubContent, html: string): string[] {
  const out: string[] = [];
  const ids = new Set<string>();
  const srcIds = new Set(c.evidence.map((e) => e.id));
  const cite = (where: string, st: string, src?: string) => {
    if (src && !srcIds.has(src)) out.push(`${where}: source ${src} is not in evidence[].`);
    if ((st === "source_validated" || st === "client_confirmed") && !src) out.push(`${where}: '${st}' needs a source from evidence[]; otherwise mark it hypothesis.`);
  };
  for (const b of c.today.systems) {
    cite(`today.systems ${b.id}`, b.status, b.source);
    if (ids.has(b.id)) out.push(`today.systems: duplicate id '${b.id}'.`);
    ids.add(b.id);
  }
  for (const f of c.today.flows) {
    if (!ids.has(f.from) || !ids.has(f.to)) out.push(`today.flows: ${f.from} -> ${f.to} names a system that is not in today.systems.`);
    if (f.from === f.to) out.push(`today.flows: ${f.from} flows to itself.`);
  }
  const byCol = new Map<string, number>();
  for (const b of c.today.systems) byCol.set(b.column, (byCol.get(b.column) ?? 0) + 1);
  for (const [col, n] of byCol) if (n > 8) out.push(`today.systems: ${n} boxes in column '${col}' (at most 8 fit); group them.`);

  const evIds = new Set<string>();
  for (const p of c.maf.products) {
    if (!p.stages.some((st) => st.events.some((e) => e.exception))) out.push(`${p.name}: add at least one exception event (failed, duplicate, late, corrected, reversed or backdated).`);
    for (const st of p.stages) {
      for (const e of st.events) {
        const at = `${p.name} / ${st.name} / ${e.name}`;
        if (evIds.has(e.id)) out.push(`maf: duplicate event id '${e.id}'.`);
        evIds.add(e.id);
        cite(at, e.status, e.source);
        if (e.memo) {
          if (e.lines.length) out.push(`${at}: a memo event posts no journal; remove its lines or set memo false.`);
          continue;
        }
        // One event may post to several ledgers (e.g. IFRS and a US GAAP delta); each ledger's journal balances on its own.
        for (const ledger of new Set(e.lines.map((l) => l.ledger ?? ""))) {
          const ls = e.lines.filter((l) => (l.ledger ?? "") === ledger);
          const tag = ledger ? ` (${ledger})` : "";
          const dr = ls.filter((l) => l.side === "Dr");
          const cr = ls.filter((l) => l.side === "Cr");
          if (!dr.length || !cr.length) out.push(`${at}${tag}: needs at least one debit and one credit line.`);
          const diff = dr.reduce((a, l) => a + l.factor, 0) - cr.reduce((a, l) => a + l.factor, 0);
          if (Math.abs(diff) > 1e-9) out.push(`${at}${tag}: journal does not balance (debits minus credits = ${+diff.toFixed(6)} x amount).`);
        }
        if (!e.controls.length) out.push(`${at}: name the controls (C1-C8) that apply.`);
      }
    }
  }
  // Figures the agent writes in the Master Accounting Flow text must match the catalogue it supplied.
  const all = c.maf.products.flatMap((p) => p.stages.flatMap((st) => st.events));
  const counts = {
    events: new Set([all.length, ...c.maf.products.map((p) => p.stages.reduce((n, st) => n + st.events.length, 0))]),
    manual: new Set([all.filter((e) => e.manual).length]),
    exception: new Set([all.filter((e) => e.exception).length]),
  };
  const text = [c.maf.headline, c.maf.lede, c.maf.so_what.text].join(" ");
  const claims: [string, "events" | "manual" | "exception"][] = [
    ...[...text.matchAll(/\b(\d+) (?:[a-z-]+ )?events?\b(?! (?:are |is )?(?:manual|exception))/gi)].map((m) => [m[1], "events"] as [string, "events"]),
    ...[...text.matchAll(/\b(\d+) (?:events? )?(?:are |is )?(manual|exception)/gi)].map((m) => [m[1], m[2].toLowerCase()] as [string, "manual" | "exception"]),
  ];
  for (const [n, k] of claims) if (!counts[k].has(Number(n))) out.push(`maf text says ${n} ${k === "events" ? "events" : `${k} events`}, but the catalogue has ${[...counts[k]].join(" or ")}.`);
  if (c.branding.style === "client_light" && !c.branding.primary) out.push("branding: client_light needs a primary colour (#RRGGBB).");

  const legacy = c.migration.legacy.map((l) => l.component.toLowerCase());
  for (const comp of c.legacy_logic) if (!legacy.some((l) => l.includes(comp.toLowerCase()) || comp.toLowerCase().includes(l))) out.push(`migration.legacy: no disposition for legacy component '${comp}'.`);
  if (!c.migration.legacy.some((l) => /close|consolidat/i.test(`${l.component} ${l.target}`))) out.push("migration.legacy: add close and consolidation, repointed to the EPM.");
  for (const o of c.target.ownership) cite(`target.ownership ${o.responsibility}`, o.status, o.source);
  for (const n of c.migration.nfr) cite(`migration.nfr ${n.area}`, n.status, n.source);
  if (c.migration.waves[0].id !== "W0") out.push("migration.waves: start with W0, the proof of concept.");

  for (const name of [...ALWAYS_EXCLUDED, ...c.exclusions]) if (tokens(name).test(html)) out.push(`Excluded name '${name}' appears on the page; remove it everywhere.`);
  if (/\b(?:src|href)\s*=\s*["']?(?:https?:)?\/\//i.test(html) || /@import|url\(\s*["']?https?:/i.test(html)) out.push("Page carries an external reference.");
  if (/<[^>]+\son[a-z]+\s*=/i.test(html) || /javascript:/i.test(html)) out.push("Page carries an inline event handler or javascript: URL.");
  if (!/<html lang="en">/.test(html)) out.push("Page has no lang attribute.");
  return out;
}
