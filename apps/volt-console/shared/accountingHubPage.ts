/**
 * Draws the Accounting Hub page from its content (see accountingHub.ts): one self-contained HTML file with five tabs,
 * inline CSS and JS, no external assets. Layout rules are fixed here so every client's page comes out the same:
 * fixed 1300-wide SVG viewBoxes, detail panels below diagrams, orthogonal arrows routed through the gaps between
 * columns, arrow markers in one always-rendered hidden SVG, SVG text coloured by CSS class, tab-prefixed class names,
 * addEventListener only, and #p<tab>[-<step>] deep links.
 */
import { CONTROL_IDS, EVIDENCE, NFR_AREAS, PRIOR_CLIENT, RESPONSIBILITIES, type HubContent } from "./accountingHub.js";

const EV_LABEL: Record<(typeof EVIDENCE)[number], string> = {
  client_confirmed: "Client-confirmed", source_validated: "Source-validated", hypothesis: "Hypothesis", illustrative: "Illustrative", decision_required: "Decision required",
};
const badge = (st: (typeof EVIDENCE)[number], src?: string) => `<span class="ev ev-${st}">${EV_LABEL[st]}${src ? ` · ${src}` : ""}</span>`;

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const PH = /\[(?:to size|to confirm|\$ ?TBD|TBD)[^\]]*\]/g;
/** Escaped text with unknown figures ("[to size]", "[$ TBD]") in red. */
const rt = (t: string) => esc(t).replace(PH, (m) => `<span class="red">${m}</span>`);

/** Greedy word wrap to at most `lines` lines of `max` characters; a longer text ends in "..." rather than overflowing. */
function wrap(text: string, max: number, lines: number): string[] {
  const out: string[] = [];
  let cur = "";
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= max) cur = next;
    else {
      if (cur) out.push(cur);
      cur = w.length > max ? `${w.slice(0, max - 1)}-` : w;
    }
  }
  if (cur) out.push(cur);
  if (out.length > lines) {
    const kept = out.slice(0, lines);
    kept[lines - 1] = `${kept[lines - 1].slice(0, max - 3).replace(/\s+\S*$/, "")}...`;
    return kept;
  }
  return out;
}

interface Box { id: string; x: number; y: number; w: number; h: number; cls: string; title: string[]; sub: string[] }

const TITLE_PX = 7.3;
const SUB_PX = 6.2;
function measure(id: string, w: number, title: string, sub = "", cls = "", px = TITLE_PX, pad = 16): Box {
  const t = wrap(title, Math.floor((w - pad) / px), 2);
  const s = sub ? wrap(sub, Math.floor((w - 16) / SUB_PX), 2) : [];
  return { id, x: 0, y: 0, w, h: 14 + t.length * 17 + s.length * 14 + 6, cls, title: t, sub: s };
}

function boxSvg(b: Box, extra = ""): string {
  const tx = b.x + b.w / 2;
  let y = b.y + 22;
  const t = b.title.map((l) => { const r = `<text class="bt" x="${tx}" y="${y}">${esc(l)}</text>`; y += 17; return r; }).join("");
  const s = b.sub.map((l) => { const r = `<text class="bs" x="${tx}" y="${y - 2}">${esc(l)}</text>`; y += 14; return r; }).join("");
  return `<g class="bx ${b.cls}" data-id="${esc(b.id)}" tabindex="0"${extra}><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="6"/>${t}${s}</g>`;
}

/** Stacks boxes down a column from y; returns the bottom. */
function stack(boxes: Box[], x: number, y: number, gap = 12): number {
  for (const b of boxes) { b.x = x; b.y = y; y += b.h + gap; }
  return y - gap;
}

const cy = (b: Box) => Math.round(b.y + b.h / 2);
const path = (d: string, cls: string, marker: string, attrs = "") => `<path class="${cls}" d="${d}"${marker ? ` marker-end="url(#${marker})"` : ""}${attrs}/>`;

// ── Tab 01: today ──────────────────────────────────────────────────────────

const COLS = ["source", "provisioning", "engine", "reporting", "users"] as const;
const COL_NAME = { source: "Source systems", provisioning: "Provisioning", engine: "Operational engines", reporting: "Analysis & reporting", users: "Users" };
const T_X = [20, 290, 560, 830, 1100];
const T_W = 180;

function todaySvg(c: HubContent): string {
  const sys = c.today.systems;
  const byId = new Map<string, Box>();
  const col = (id: string) => COLS.indexOf(sys.find((s) => s.id === id)!.column);
  const flows = c.today.flows.filter((f) => byId !== null && f.from !== f.to);
  const skips = flows.filter((f) => col(f.to) - col(f.from) > 1);
  const top = Math.max(76, 52 + skips.length * 7 + 10);
  const onPath = new Map<string, Set<string>>();
  for (const f of flows) for (const end of [f.from, f.to]) (onPath.get(end) ?? onPath.set(end, new Set()).get(end)!).add(f.path);
  let bottom = top;
  COLS.forEach((k, i) => {
    const boxes = sys.filter((s) => s.column === k).map((s) => {
      const tags = new Set<string>(s.tags);
      for (const p of onPath.get(s.id) ?? []) tags.add(p);
      const cls = [...tags].map((t) => ({ accounting: "on-acct", product: "on-prod", custom_logic: "t-custom", manual: "t-manual", gap: "t-gap", other: "" })[t] ?? "").filter(Boolean).join(" ");
      return measure(s.id, T_W, s.name, s.tags.includes("gap") ? `${s.sub ? `${s.sub} · ` : ""}to confirm` : s.sub, cls);
    });
    boxes.forEach((b) => byId.set(b.id, b));
    bottom = Math.max(bottom, stack(boxes, T_X[i], top));
  });
  const lane = new Map<number, number>();
  const gapX = (g: number) => { const k = lane.get(g) ?? 0; lane.set(g, k + 1); return T_X[g] + T_W + 14 + (k % 8) * 8; };
  const back = flows.filter((f) => col(f.to) < col(f.from));
  const backTop = bottom + 18;
  let skipK = 0;
  let backK = 0;
  const arrows = flows.map((f) => {
    const a = byId.get(f.from)!;
    const b = byId.get(f.to)!;
    const i = col(f.from);
    const j = col(f.to);
    let d: string;
    if (j === i + 1) { const gx = gapX(i); d = `M${a.x + a.w} ${cy(a)}H${gx}V${cy(b)}H${b.x - 1}`; }
    else if (j > i) { const ly = 52 + skipK++ * 7; d = `M${a.x + a.w} ${cy(a)}H${gapX(i)}V${ly}H${gapX(j - 1)}V${cy(b)}H${b.x - 1}`; }
    else if (j === i - 1) { const gx = gapX(j); d = `M${a.x} ${cy(a)}H${gx}V${cy(b)}H${b.x + b.w + 1}`; }
    else if (j < i) { const ly = backTop + backK++ * 7; d = `M${a.x} ${cy(a)}H${gapX(i - 1)}V${ly}H${gapX(j)}V${cy(b)}H${b.x + b.w + 1}`; }
    else { const gx = gapX(i); d = `M${a.x + a.w} ${cy(a)}H${gx}V${cy(b)}H${b.x + b.w + 1}`; }
    const p = f.path === "accounting" ? "acct" : f.path === "product" ? "prod" : "other";
    return path(d, `fl p-${p}`, p === "other" ? "ah" : `ah-${p}`);
  });
  let y = Math.max(bottom + 24, backTop + back.length * 7 + 12);
  const bars = [
    `<g class="bar"><rect x="20" y="${y}" width="1260" height="30" rx="5"/><text class="bt" x="650" y="${y + 20}">Governance, controls and audit</text></g>`,
    `<g class="bar"><rect x="20" y="${y + 38}" width="1260" height="30" rx="5"/><text class="bt" x="650" y="${y + 58}">Master and reference data (MDM)</text></g>`,
  ];
  y += 80;
  const plats = c.today.platforms;
  if (plats.length) {
    const w = (1260 - 140 - (plats.length - 1) * 10) / plats.length;
    bars.push(`<text class="ch" x="20" y="${y + 24}" style="text-anchor:start">Platforms</text>`);
    plats.forEach((p, k) => bars.push(`<g class="plat"><rect x="${160 + k * (w + 10)}" y="${y}" width="${w}" height="38" rx="5"/><text class="bs" x="${160 + k * (w + 10) + w / 2}" y="${y + 23}">${esc(wrap(p, Math.floor(w / SUB_PX) - 1, 1)[0])}</text></g>`));
    y += 48;
  }
  const heads = COLS.map((k, i) => `<text class="ch" x="${T_X[i] + T_W / 2}" y="26">${COL_NAME[k]}</text>`).join("");
  const boxes = [...byId.values()].map((b) => boxSvg(b)).join("");
  return `<svg class="dg" id="t1-svg" data-view="all" viewBox="0 0 1300 ${y + 6}" role="img" aria-label="Current-state architecture">${heads}${arrows.join("")}${boxes}${bars.join("")}</svg>`;
}

// ── Tab 02: target hub ─────────────────────────────────────────────────────

interface Target { svg: string; info: Record<string, { name: string; text: string }> }

function targetSvg(c: HubContent): Target {
  const gl = c.gl_platform || "General ledger (platform to confirm)";
  const epm = c.epm || "Close and consolidation (EPM to confirm)";
  const srcs = c.today.systems.filter((s) => s.column === "source" && !s.tags.includes("gap")).slice(0, 8);
  const consumers = c.target.consumers ?? ["EPM drill-back", "Securitization", "Profitability", "BI and analytics", "Regulatory and risk", "Alerts"];
  const X = { src: 20, ing: 232, con: 444, hub: 676, fin: 950, usr: 1160 };
  const W = { src: 160, ing: 168, con: 186, hub: 218, fin: 172, usr: 124 };
  const info: Target["info"] = {};
  const def = (id: string, w: number, title: string, sub: string, text: string, cls = "") => { info[id] = { name: title, text }; return cls === "gold" ? measure(id, w, title, sub, cls, 6.4, 8) : measure(id, w, title, sub, cls); };
  const src = srcs.map((s) => def(`s-${s.id}`, W.src, s.name, s.sub ?? "", `${s.name}: ${s.role} Lands once, through a data contract, into the fabric.`, "src"));
  const ing = [
    def("i1", W.ing, "Batch & CDC ingest", "data contract per source", "Each source lands by file, API or change data capture against a versioned data contract: fields, keys, timing and owner."),
    def("i2", W.ing, "Raw landing (bronze)", "immutable, replayable", "Every record lands unchanged and is kept, so any run can be replayed and any balance traced to what the source sent."),
    def("i3", W.ing, "Completeness & DQ", "counts, totals, rules", "Record counts and control totals are checked against the source (C1) before anything is accounted."),
  ];
  const con = [
    def("c2", W.con, "Reference & master data", "products, org, calendars", "Product, organisation, currency and calendar data are mastered once and versioned by effective date."),
    def("c1", W.con, "Financial Information Model", "conformed contracts and events (silver)", "The FIM conforms every source to one model: contract, party, product, organisation, event, balance and risk measures, at contract grain.", "fim"),
    def("c3", W.con, "Contract golden record", "one key per contract", "One record per contract carries the golden-thread key that follows the contract into every event, journal line and report."),
  ];
  const hub = [
    def("h1", W.hub, "Event classification", "FIM changes become business events", "Changes in the FIM are classified into business events from the product lifecycle catalogue; memo events update the FIM without a journal."),
    def("h2", W.hub, "Accounting matrix", "posting rules, effective-dated", "The posting rules are applied once, to the source transactions: event plus attributes give the debit, credit and GL attributes."),
    def("h3", W.hub, "Sub-ledger", "contract- and event-level detail", "The thick sub-ledger keeps every journal line at contract and event level, with both the effective and the accounting date."),
    def("h4", W.hub, "Governed adjustments", "reasoned, maker-checker", "Adjustments are made at contract or GL level in the hub, with a reason, an approver and lineage, never in a side file."),
    def("h5", W.hub, "Controls & reconciliation", "C1-C17, owned and evidenced", "Completeness, mapping, balancing, reconciliation, cut-off, duplicate, late-event, rounding and suspense controls run on every batch, each with an owner, evidence and a threshold."),
    def("h6", W.hub, "Summarise & map to GL", "at the agreed posting grain", `Detail is summarised to the agreed posting grain in ${gl} format, with the golden-thread reference on each line. Posting grain is a design decision.`),
    def("h7", W.hub, "Rule versioning", "versioned, effective-dated", "Every rule change is versioned, effective-dated and approved under maker-checker (C7), and can be re-run in parallel."),
    def("h8", W.hub, "Line-level lineage", "golden-thread key", "Every GL line drills back to the hub lines, the events and the source records behind it."),
  ];
  const fin = [
    def("f1", W.fin, "Posting adapter", "summarised journals", `Posts the summarised journals to ${gl} through its standard journal interface.`),
    def("f2", W.fin, gl, "GL at the agreed grain", `${gl} receives journals at the agreed posting grain; detail stays in the sub-ledger.`, "gl"),
    def("f3", W.fin, epm, "close and consolidation", `${epm} runs close and consolidation from the GL, with drill-back to the hub.`),
  ];
  const usr = [
    def("u1", W.usr, "Finance ops", "close and accounting", "Run the close from one reconciled source."),
    def("u2", W.usr, "Controllers", "review and sign-off", "Review exceptions, adjustments and reconciliations in one place."),
    def("u3", W.usr, "Risk & regulatory", "golden source", "Report from the same reconciled data the GL is built on."),
    def("u4", W.usr, "Business & FP&A", "profitability", "Profitability and planning by contract, product and segment."),
  ];
  const top = 76;
  const bottoms = [stack(src, X.src, top), stack(ing, X.ing, top, 30), stack(con, X.con, top, 30), stack(hub, X.hub, top, 12), stack(fin, X.fin, top, 30), stack(usr, X.usr, top, 16)];
  const goldY = Math.max(...bottoms) + 34;
  const gw = (W.ing + W.con + W.hub + (X.hub - X.ing - W.ing - W.con) - (consumers.length - 1) * 10) / consumers.length;
  const gold = consumers.map((n, k) => {
    const b = def(`g${k + 1}`, gw, n, "", `${n} reads the golden source: the same reconciled contract and balance data the GL is built from.`, "gold");
    b.x = X.ing + k * (gw + 10); b.y = goldY + 40; return b;
  });
  const goldH = Math.max(...gold.map((b) => b.h));
  gold.forEach((b) => { b.h = goldH; });
  info.gold = { name: "Golden source", text: "One reconciled source for every consumer outside the GL: the conformed FIM plus the sub-ledger, reconciled to the GL by design." };
  const fabric = { x: X.ing - 16, y: 44, w: X.hub + W.hub + 16 - (X.ing - 16), h: goldY + 40 + goldH + 14 - 44 };
  const B = Object.fromEntries([...src, ...ing, ...con, ...hub, ...fin, ...usr].map((b) => [b.id, b]));
  const down = (a: Box, b: Box) => `M${a.x + a.w / 2} ${a.y + a.h}V${b.y - 1}`;
  const up = (a: Box, b: Box) => `M${a.x + a.w / 2} ${a.y}V${b.y + b.h + 1}`;
  const cross = (a: Box, b: Box, gx: number) => `M${a.x + a.w} ${cy(a)}H${gx}V${cy(b)}H${b.x - 1}`;
  const A: [string, string, string][] = [];
  const add = (id: string, d: string, marker = "ah-accent") => A.push([id, d, marker]);
  const bus = X.src + W.src + 26;
  if (src.length) {
    const stubs = src.map((s) => `M${s.x + s.w} ${cy(s)}H${bus}`).join("");
    const ys = [...src.map(cy), cy(B.i1)];
    add("a-src", `${stubs}M${bus} ${Math.min(...ys)}V${Math.max(...ys)}`, "");
    add("a-src2", `M${bus} ${cy(B.i1)}H${B.i1.x - 1}`);
  }
  add("a-i12", down(B.i1, B.i2)); add("a-i23", down(B.i2, B.i3));
  add("a-i3c1", cross(B.i3, B.c1, X.ing + W.ing + 32));
  add("a-c21", down(B.c2, B.c1)); add("a-c13", down(B.c1, B.c3));
  add("a-c3h1", cross(B.c3, B.h1, X.con + W.con + 24));
  for (const [a, b] of [["h1", "h2"], ["h2", "h3"], ["h3", "h4"], ["h4", "h5"], ["h5", "h6"]]) add(`a-${a}${b}`, down(B[a], B[b]));
  const hr = X.hub + W.hub;
  add("a-h72", `M${hr} ${cy(B.h7)}H${hr + 9}V${cy(B.h2)}H${hr + 1}`);
  add("a-h6f1", cross(B.h6, B.f1, hr + 32));
  add("a-f12", down(B.f1, B.f2)); add("a-f23", down(B.f2, B.f3));
  add("a-f2u", cross(B.f2, B.u1, X.fin + W.fin + 18)); add("a-f3u", cross(B.f3, B.u2, X.fin + W.fin + 26));
  add("a-h8g", `M${B.h8.x + B.h8.w / 2} ${B.h8.y + B.h8.h}V${goldY - 1}`);
  const rx = X.fin + W.fin + 10;
  const rec = `M${B.f2.x + B.f2.w} ${cy(B.f2) + 8}H${rx}V${goldY + 15}H${fabric.x + fabric.w - 14}`;
  const heads = [["Sources", X.src, W.src], ["Ingest (bronze)", X.ing, W.ing], ["Conform (silver)", X.con, W.con], ["Accounting hub", X.hub, W.hub], ["Finance core", X.fin, W.fin], ["Users", X.usr, W.usr]]
    .map(([n, x, w]) => `<text class="ch" x="${(x as number) + (w as number) / 2}" y="66">${n}</text>`).join("");
  const arrows = A.map(([idA, d, m]) => path(d, "ar", m, ` data-a="${idA}" pathLength="100"`)).join("");
  const svg = `<svg class="dg" id="t2-svg" viewBox="0 0 1300 ${fabric.y + fabric.h + 12}" role="img" aria-label="Target accounting hub on the data fabric">`
    + `<rect class="fabric" x="${fabric.x}" y="${fabric.y}" width="${fabric.w}" height="${fabric.h}" rx="10"/><text class="ch" x="${fabric.x + 12}" y="${fabric.y - 8}" style="text-anchor:start">DATA FABRIC${c.data_platform ? ` · ${esc(c.data_platform)}` : ""}</text>`
    + heads + arrows
    + `<path class="ar rec" data-a="a-rec" d="${rec}" marker-start="url(#ah-red)" marker-end="url(#ah-red)" pathLength="100"/>`
    + `<g class="bx gold-bar" data-id="gold" tabindex="0"><rect x="${X.ing}" y="${goldY}" width="${fabric.x + fabric.w - 14 - X.ing}" height="30" rx="5"/><text class="bt" x="${(X.ing + fabric.x + fabric.w - 14) / 2}" y="${goldY + 20}">Gold: golden source for all downstream reporting (reconciled to the GL)</text></g>`
    + [...src, ...ing, ...con, ...hub, ...fin, ...usr, ...gold].map((b) => boxSvg(b)).join("")
    + `</svg>`;
  return { svg, info };
}

const PRINCIPLES = [
  "Apply one governed rule framework once, to the source transactions, with controlled and explainable variations by accounting basis, legal entity, jurisdiction and effective date.",
  "Keep balances reconciled by design, with one golden source for all downstream reporting.",
];

function steps(c: HubContent, srcIds: string[]) {
  const gl = c.gl_platform || "the GL";
  const epm = c.epm || "the close and consolidation platform";
  const golds = (c.target.consumers ?? [1, 2, 3, 4, 5, 6]).map((_, k) => `g${k + 1}`);
  return [
    { t: "Two design principles", d: `${PRINCIPLES[0]} ${PRINCIPLES[1]}`, b: [], a: [], overlay: true },
    { t: "Sources land once, through data contracts", d: `Each of the ${srcIds.length} sources sends its data once, by file, API or CDC, against a versioned data contract.`, b: [...srcIds, "i1"], a: ["a-src", "a-src2"] },
    { t: "Raw landing and completeness checks", d: "Records land unchanged in bronze, and counts and control totals are checked against the source before any accounting (C1).", b: ["i1", "i2", "i3"], a: ["a-i12", "a-i23"] },
    { t: "Conform into the Financial Information Model", d: "Silver conforms every source to one model at contract grain, with mastered reference data and one golden record per contract.", b: ["i3", "c1", "c2", "c3"], a: ["a-i3c1", "a-c21", "a-c13"] },
    { t: "Classify business events", d: "Changes to contracts become business events from the product lifecycle catalogue; memo events update the FIM without a journal.", b: ["c3", "h1"], a: ["a-c3h1"] },
    { t: "Apply the accounting rules once", d: "The effective-dated accounting matrix turns each event into balanced journal lines in the sub-ledger, per accounting basis where treatments differ, under versioned rules. An event may create a journal, a memo update, several accounting outputs or none.", b: ["h1", "h2", "h3", "h7"], a: ["a-h1h2", "a-h2h3", "a-h72"] },
    { t: "Governed adjustments and controls", d: "Adjustments are made in the hub with a reason and an approver, and the proposed controls run on every batch, each with an owner and evidence.", b: ["h3", "h4", "h5"], a: ["a-h3h4", "a-h4h5"] },
    { t: `Post to ${gl} at the agreed grain`, d: `Detail stays in the sub-ledger; ${gl} receives journals at the posting grain Finance and Technology agree (summarised by account and segment is the starting proposal), each carrying the golden-thread reference.`, b: ["h5", "h6", "f1", "f2"], a: ["a-h5h6", "a-h6f1", "a-f12"] },
    { t: "Close, consolidate and serve one golden source", d: `${epm} closes and consolidates from the GL with drill-back, and every other consumer reads the same golden source.`, b: ["f2", "f3", "h8", "gold", ...golds, "u1", "u2", "u3", "u4"], a: ["a-f23", "a-f2u", "a-f3u", "a-h8g"] },
    { t: "Reconciled by design", d: `The GL and the golden source come from the same journal lines, so ${gl} ties to the sub-ledger and to every report by construction (C4, C5).`, b: ["f2", "gold", "h5", "h8"], a: ["a-rec"] },
  ];
}

const COMPARE = (gl: string) => ({
  cols: ["Keep the custom code", "Accounting engine inside the GL platform", "Data fabric accounting hub (recommended)"],
  rows: [
    ["Where rules live", "Spread across processors, ETL and manual files", `In the GL platform's accounting engine (${gl})`, "Once, in the hub's effective-dated accounting matrix"],
    ["Data ingestion", "Point-to-point feeds per consumer", "Each source integrates with the GL engine", "Once, through data contracts, into the fabric"],
    ["Load on the GL", "Detail and summaries mixed", "Detail volumes carried by the GL platform", "Posting grain chosen by criteria; summarised by default"],
    ["Close and consolidation", "Manual reconciliations before close", "Improves, but non-GL data still reconciled separately", "Reconciled by design; EPM drills back to contract"],
    ["Golden source for non-GL reporting", "None: each consumer rebuilds its own", "GL detail only; risk and profitability data elsewhere", "One golden source on the fabric for every consumer"],
    ["Change and audit", "Code changes, limited lineage", "Configuration change, lineage inside the GL", "Versioned rules, maker-checker, line-level lineage"],
    ["Trade-offs", "No migration cost; cost and risk keep growing", "Fewer platforms; GL licence and volume cost, data still split", "Needs data platform skills and a parallel run; highest reuse"],
  ],
});

// ── Tab 03: FIM ────────────────────────────────────────────────────────────

type Entity = { name: string; attributes: string[]; sourced: string; used_by: string };
const E = (name: string, attributes: string[], sourced: string, used_by: string): Entity => ({ name, attributes, sourced, used_by });

function entities(c: HubContent): Entity[] {
  if (c.fim.entities) return c.fim.entities;
  const base = [
    E("Party", ["party id", "segment", "residency", "KYC status"], "Customer master and onboarding", "Finance, risk, regulatory"),
    E("Product", ["product code", "terms", "pricing plan", "GL product segment"], "Product master", "Accounting matrix, profitability"),
    E("Organisation", ["legal entity", "branch / cost centre", "business line"], "Organisation hierarchy (MDM)", "GL segments, segment reporting"),
  ];
  const tail = [
    E("Business event", ["event type", "effective date", "accounting date", "source reference"], "Classified in the hub from source changes", "Accounting matrix, sub-ledger"),
    E("Balance", ["balance type", "amount", "currency", "as-of date"], "Derived in the hub from events", "GL, EPM, regulatory, BI"),
  ];
  if (c.client.type === "wealth_asset_manager") return [...base,
    E("Account", ["account id", "mandate", "base currency"], "Record-keeping platform", "Fees, AUM reporting"),
    E("Holding", ["security", "units", "market value"], "Custody and record-keeping", "AUM, risk"),
    E("Fee schedule", ["fee basis", "rate tiers", "billing cycle"], "Fee engine and contracts", "Fee events, revenue"),
    E("Fee event", ["fee type", "period", "amount"], "Fee engine", "Revenue, receivables"),
    E("AUM snapshot", ["date", "AUM", "flows"], "Record-keeping, daily", "Fees, management reporting"),
    E("Intersegment elimination", ["counterparty segment", "amount"], "Hub, from intercompany events", "Consolidation"),
    ...tail];
  if (c.client.type === "insurer") return [...base,
    E("Coverage", ["coverage id", "term", "premium"], "Policy administration", "IFRS 17 grouping, revenue"),
    E("Claim", ["claim id", "reserve", "paid to date"], "Claims system", "Liabilities, risk"),
    E("Reinsurance", ["treaty", "share", "recoverable"], "Reinsurance system", "Reinsurance held"),
    ...tail,
    E("Measurement group", ["portfolio", "cohort", "CSM"], "Actuarial engine", "IFRS 17 measurement")];
  const lending = c.client.type !== "other";
  return [...base,
    E("Collateral", ["collateral type", "value", "LTV"], "Collateral or origination system", "ECL, risk"),
    ...(c.client.type === "consumer_lender" || c.client.type === "retail_bank" ? [E("Securitization / pool", ["pool id", "investor code", "series"], "Securitization hub", "Investor reporting, derecognition")] : []),
    ...tail,
    E("Risk measures", ["ECL stage", "PD / LGD", "days past due"], "Risk / ECL engine", "Allowance, regulatory"),
    E("Rate & pricing", ["rate type", "rate", "FTP rate"], "Pricing and treasury", "Interest accrual, profitability"),
  ].filter((e) => lending || e.name !== "Collateral");
}

function fimSvg(list: Entity[]): string {
  const cx = 650, cyy = 270, n = list.length;
  const w = n > 9 ? 176 : 196, h = 50;
  const centre = `<g class="bx fim-centre" data-id="centre" tabindex="0"><rect x="${cx - 110}" y="${cyy - 36}" width="220" height="72" rx="10"/><text class="bt" x="${cx}" y="${cyy - 4}">Contract</text><text class="bs" x="${cx}" y="${cyy + 16}">golden record, contract grain</text></g>`;
  const parts: string[] = [];
  const lines: string[] = [];
  list.forEach((e, k) => {
    const ang = -Math.PI / 2 + (2 * Math.PI * k) / n;
    const ex = cx + 500 * Math.cos(ang), ey = cyy + 205 * Math.sin(ang);
    const bx = Math.round(Math.max(10, Math.min(1290 - w, ex - w / 2))), by = Math.round(ey - h / 2);
    const clip = (px: number, py: number, hw: number, hh: number, dx: number, dy: number) => { const t = Math.min(hw / Math.abs(dx || 1e-9), hh / Math.abs(dy || 1e-9)); return [px + dx * t, py + dy * t]; };
    const dx = bx + w / 2 - cx, dy = by + h / 2 - cyy;
    const [x1, y1] = clip(cx, cyy, 110, 36, dx, dy);
    const [x2, y2] = clip(bx + w / 2, by + h / 2, w / 2, h / 2, -dx, -dy);
    lines.push(`<line class="ml-spoke" data-e="${k}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`);
    const b = measure(`e${k}`, w, e.name, `${e.attributes.length} key attributes`);
    b.x = bx; b.y = by; b.h = h;
    parts.push(boxSvg(b, ` data-e="${k}"`).replace('class="bx ', 'class="bx ml-ent '));
  });
  return `<svg class="dg" id="t3-svg" viewBox="0 0 1300 510" role="img" aria-label="Financial information model">${lines.join("")}${centre}${parts.join("")}</svg>`;
}

// ── Page ───────────────────────────────────────────────────────────────────

/** Control name, type, frequency and evidence; owner, threshold and escalation come from the content or show 'to confirm'. */
const CONTROLS: Record<(typeof CONTROL_IDS)[number], [string, "Preventive" | "Detective", string, string]> = {
  C1: ["Completeness", "Detective", "Every batch", "Record counts and control totals agree to the source"],
  C2: ["Mapping validity", "Preventive", "Every batch", "Unmapped records go to suspense with an SLA"],
  C3: ["Balancing", "Preventive", "Every batch", "Debits equal credits by batch, entity, currency and basis"],
  C4: ["Sub-ledger to source", "Detective", "Daily", "Sub-ledger balances agree to source by contract"],
  C5: ["GL to sub-ledger", "Detective", "Daily and at close", "GL agrees to the summarised sub-ledger by account and segment"],
  C6: ["Cut-off", "Preventive", "Every batch", "Effective and accounting dates kept; late events post to the open period"],
  C7: ["Rule change control", "Preventive", "Every change", "Rules versioned, effective-dated and approved under maker-checker"],
  C8: ["Lineage and audit", "Detective", "Quarterly and on demand", "GL lines drill back to hub lines, events and source records"],
  C9: ["Duplicate detection and idempotency", "Preventive", "Every batch", "Replayed or duplicate events are rejected and logged"],
  C10: ["Authorisation and segregation of duties", "Preventive", "Continuous", "Approvals and access separated by role"],
  C11: ["Late, corrected and replayed events", "Detective", "Every batch", "Correction and replay register; reversals linked to originals"],
  C12: ["Currency translation and rounding", "Detective", "Daily", "Approved rate source; rounding differences within tolerance"],
  C13: ["Suspense ageing and escalation", "Detective", "Daily", "Aged suspense report with escalation"],
  C14: ["Period close, reopen and post-close adjustments", "Preventive", "Each close", "Period status log; reopen and post-close entries approved"],
  C15: ["Rule deployment, rollback and emergency change", "Preventive", "Every release", "Release record, rollback test, emergency change review"],
  C16: ["Interface failure, recovery and retention", "Detective", "Every run", "Interface monitoring, recovery log, retention schedule"],
  C17: ["Access logging and sensitive data", "Detective", "Monthly", "Access review and masking evidence"],
};

const RESP: Record<(typeof RESPONSIBILITIES)[number], string> = {
  intake: "Event intake and durable storage", rules: "Rule execution and journal creation", replay: "Transaction status and replay prevention",
  corrections: "Corrections, reversals and event versioning", balances: "Sub-ledger balances and period controls", posting: "Posting to the GL",
  reconciliation: "Reconciliation and exception handling", audit: "Audit evidence and lineage",
};
const NFR: Record<(typeof NFR_AREAS)[number], string> = {
  volumes: "Peak and average volumes, latency, close window", resilience: "Availability, recovery time and point, restart",
  security: "Data residency, encryption, privileged access, retention", operations: "Monitoring, alerting, support hours, incident ownership",
  ownership: "Rule ownership across Finance, Product, Technology and Risk", release: "Release management, environment promotion, testing",
  audit: "Audit evidence and operational handoffs",
};


const kpis = (list: [string | number, string, boolean?][]) =>
  `<div class="kpis">${list.map(([v, l, red]) => `<div class="kpi${red ? " kpi-red" : ""}"><div class="kv${String(v).length > 12 ? " kv-sm" : ""}">${rt(String(v))}</div><div class="kl">${esc(l)}</div></div>`).join("")}</div>`;

const soWhat = (s: { text: string; trade_off: string }) =>
  `<div class="sowhat"><div class="sw-h">So what</div><p>${rt(s.text)}</p><p><b>Trade-off:</b> ${rt(s.trade_off)}</p></div>`;

const chev = (items: string[], cls = "") => `<ol class="chev ${cls}">${items.map((t, k) => `<li><span>${k + 1}</span>${esc(t)}</li>`).join("")}</ol>`;

function brandVars(c: HubContent): string {
  if (c.branding.style === "client_light") {
    const p = c.branding.primary ?? "#1A5FB4";
    return `--bg:#F5F6F8;--panel:#FFFFFF;--panel2:#EEF1F5;--line:#D3D9E2;--ink:#1A1E2E;--muted:#5B6478;--accent:${p};--acct:${c.branding.secondary ?? "#B07A00"};--prod:#C2185B;--risk:#E65100;--red:#D32F2F;--gold:#B07A00;--tint:rgba(0,0,0,.04)`;
  }
  if (c.branding.style === "boardroom") {
    return `--bg:#FBF8F1;--panel:#FFFFFF;--panel2:#F3EEE2;--line:#D9D2C1;--ink:#14213D;--muted:#5C6273;--accent:${c.branding.primary ?? "#1F3A68"};--acct:${c.branding.secondary ?? "#8C6D1F"};--prod:#7A1F3D;--risk:#B4441B;--red:#B3261E;--gold:#8C6D1F;--tint:rgba(20,33,61,.04)`;
  }
  return "--bg:#0A0D14;--panel:#121726;--panel2:#1A1E2E;--line:#2C344A;--ink:#E8ECF4;--muted:#9AA3B5;--accent:#00E5FF;--acct:#D4AF37;--prod:#E0607E;--risk:#FF5722;--red:#FF4D4F;--gold:#D4AF37;--tint:rgba(255,255,255,.04)";
}

const CSS = `*{box-sizing:border-box}html,body{margin:0}body{background:var(--bg);color:var(--ink);font:14px/1.5 "Segoe UI",Arial,sans-serif}
.wrap{max-width:1360px;margin:0 auto;padding:0 20px}
header{position:sticky;top:0;z-index:5;background:var(--panel);border-bottom:1px solid var(--line)}
.hd{display:flex;align-items:center;gap:14px;padding:12px 0 6px;flex-wrap:wrap}.mark{display:flex;gap:3px}.mark i{display:block;width:5px;height:22px;border-radius:2px;background:var(--accent)}.mark i:nth-child(2){background:var(--acct)}.mark i:nth-child(3){background:var(--prod)}.mark i:nth-child(4){background:var(--risk)}
.brand{font:600 16px Georgia,serif}.brand b{color:var(--accent)}.conf{margin-left:auto;font-size:12px;color:var(--muted);border:1px solid var(--line);border-radius:12px;padding:2px 10px}
nav{display:flex;gap:4px;overflow-x:auto;padding-bottom:0}nav a{color:var(--muted);text-decoration:none;padding:8px 12px;border-bottom:2px solid transparent;white-space:nowrap;font-size:13px}nav a.on{color:var(--ink);border-bottom-color:var(--accent)}nav a span{color:var(--accent);margin-right:6px;font-weight:600}
section.tab{display:none;padding:22px 0 30px}section.tab.on{display:block}
.eyebrow{color:var(--acct);font-size:12px;letter-spacing:.12em;text-transform:uppercase;font-weight:600}
h1{font:400 28px/1.25 Georgia,serif;margin:6px 0 8px;max-width:1100px}h2{font:400 20px Georgia,serif;margin:26px 0 10px}h3{font-size:14px;margin:0 0 6px}
.lede{color:var(--muted);max-width:1000px;margin:0 0 16px}
.kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin:14px 0 18px}.kpi{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:10px 12px}.kv{font:600 24px Georgia,serif;color:var(--accent)}.kl{font-size:12px;color:var(--muted)}.kpi-red .kv{color:var(--red)}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 10px}.chip{background:var(--panel2);color:var(--ink);border:1px solid var(--line);border-radius:14px;padding:4px 12px;font:13px "Segoe UI",Arial,sans-serif;cursor:pointer}.chip.on{border-color:var(--accent);color:var(--accent)}
.tag{display:inline-block;background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:1px 8px;margin:2px 4px 2px 0;font-size:12px}
.detail{margin-top:10px;min-height:64px}.detail .dh{font-weight:600;margin-bottom:4px}.muted{color:var(--muted)}.red{color:var(--red);font-weight:600}
.sowhat{border-left:3px solid var(--accent);background:var(--panel);padding:12px 16px;margin:18px 0 10px;border-radius:0 8px 8px 0}.sw-h{font:600 13px "Segoe UI",Arial,sans-serif;color:var(--accent);text-transform:uppercase;letter-spacing:.08em}.sowhat p{margin:6px 0}
.src{font-size:12px;color:var(--muted);border-top:1px solid var(--line);padding-top:8px;margin-top:16px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
table{border-collapse:collapse;width:100%;font-size:13px}th,td{border-bottom:1px solid var(--line);padding:7px 8px;text-align:left;vertical-align:top}th{color:var(--muted);font-weight:600}td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
.chev{list-style:none;display:flex;gap:4px;padding:0;margin:8px 0 14px;flex-wrap:wrap}.chev li{flex:1;min-width:140px;background:var(--panel2);border:1px solid var(--line);padding:10px 18px 10px 14px;clip-path:polygon(0 0,calc(100% - 12px) 0,100% 50%,calc(100% - 12px) 100%,0 100%,10px 50%);font-size:13px}.chev li:first-child{clip-path:polygon(0 0,calc(100% - 12px) 0,100% 50%,calc(100% - 12px) 100%,0 100%)}.chev li span{color:var(--accent);font-weight:700;margin-right:8px}.chev li span.red{color:var(--red);margin:0}.mf-stages li{cursor:pointer}.chev li.on{background:var(--panel);color:var(--accent);box-shadow:inset 0 -2px 0 var(--accent)}.mf-trace li span{color:var(--ink);font-weight:400;margin:0}.mf-trace li span.red{color:var(--red);font-weight:600}.kv-sm{font-size:16px!important;line-height:1.3}
footer{border-top:1px solid var(--line);color:var(--muted);font-size:12px;padding:14px 0 24px}
svg.dg{width:100%;height:auto;display:block;font-family:"Segoe UI",Arial,sans-serif}
svg.dg text{fill:var(--ink);text-anchor:middle}svg.dg text.bt{font-size:13.5px;font-weight:600}svg.dg text.bs{fill:var(--muted);font-size:11.5px}svg.dg text.ch{fill:var(--acct);font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
svg.dg .bx{cursor:pointer;transition:opacity .25s}svg.dg .bx rect{fill:var(--panel2);stroke:var(--line);stroke-width:1.2}svg.dg .bx:hover rect,svg.dg .bx.sel rect{stroke:var(--accent);stroke-width:2}
svg.dg .bx.t-gap rect{fill:none;stroke-dasharray:5 4;stroke:var(--muted)}svg.dg .bar rect,svg.dg .plat rect{fill:var(--tint);stroke:var(--line)}
svg.dg .fl,svg.dg .ar{fill:none;stroke:var(--muted);stroke-width:1.5;transition:opacity .25s}svg.dg .fl.p-acct{stroke:var(--acct)}svg.dg .fl.p-prod{stroke:var(--prod)}svg.dg .ar{stroke:var(--accent)}
.mk{fill:var(--muted)}.mk-acct{fill:var(--acct)}.mk-prod{fill:var(--prod)}.mk-accent{fill:var(--accent)}.mk-red{fill:var(--red)}
svg.dg[data-view="acct"] .fl:not(.p-acct),svg.dg[data-view="acct"] .bx:not(.on-acct),svg.dg[data-view="prod"] .fl:not(.p-prod),svg.dg[data-view="prod"] .bx:not(.on-prod),svg.dg[data-view="custom"] .fl,svg.dg[data-view="custom"] .bx:not(.t-custom),svg.dg[data-view="manual"] .fl,svg.dg[data-view="manual"] .bx:not(.t-manual),svg.dg[data-view="gap"] .fl,svg.dg[data-view="gap"] .bx:not(.t-gap){opacity:.15}
svg.dg[data-view="acct"] .fl.p-acct,svg.dg[data-view="prod"] .fl.p-prod{stroke-width:2.4;stroke-dasharray:8 5;animation:t1flow 1s linear infinite}
svg.dg[data-view="custom"] .bx.t-custom rect,svg.dg[data-view="manual"] .bx.t-manual rect{stroke:var(--red);stroke-width:2.2}svg.dg[data-view="gap"] .bx.t-gap rect{stroke:var(--accent);stroke-width:2}
@keyframes t1flow{to{stroke-dashoffset:-13}}
svg.dg .fabric{fill:none;stroke:var(--accent);stroke-dasharray:8 6;stroke-width:1.4}svg.dg .bx.fim rect{stroke:var(--accent);stroke-width:2}svg.dg .bx.gl rect{stroke:var(--acct)}svg.dg .bx.gold rect,svg.dg .gold-bar rect{stroke:var(--gold)}svg.dg .gold-bar rect{fill:var(--tint)}
svg.dg .ar.rec,svg.wt .ar.rec:not(.on){stroke:var(--red);stroke-dasharray:6 5;stroke-width:2;opacity:0}svg.dg .gold text.bt{font-size:12px}
svg.wt .bx:not(.on),svg.wt .ar:not(.on){opacity:.14}svg.wt .ar.on{opacity:1;stroke-width:2.2;stroke-dasharray:100;stroke-dashoffset:100;animation:t2draw 1s ease forwards}svg.wt .ar.rec.on{stroke-dasharray:6 5;stroke-dashoffset:0;animation:none}svg.wt .bx.on rect{stroke:var(--accent);stroke-width:2}
@keyframes t2draw{to{stroke-dashoffset:0}}
.t2-wrap{position:relative}.t2-overlay{position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);background:var(--panel);border:1px solid var(--accent);border-radius:10px;padding:16px 20px;max-width:560px;display:none;box-shadow:0 10px 30px rgba(0,0,0,.35)}.t2-overlay.on{display:block}.t2-overlay ol{margin:6px 0 0 18px;padding:0}
.t2-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0}.t2-dots{display:flex;gap:5px;margin-left:8px}.t2-dot{width:26px;height:26px;border-radius:13px;border:1px solid var(--line);background:var(--panel2);color:var(--muted);font-size:12px;cursor:pointer}.t2-dot.on{background:var(--accent);color:var(--bg);border-color:var(--accent)}
.t2-step{margin:6px 0 0}.t2-step b{color:var(--accent)}
.t2-cmp td.rec,.t2-cmp th.rec{background:var(--tint);border-left:2px solid var(--accent);border-right:2px solid var(--accent)}.t2-cmp th.rec{color:var(--accent)}
svg.dg .ml-spoke{stroke:var(--line);stroke-width:1.6}svg.dg .ml-spoke.on{stroke:var(--accent);stroke-width:2.4}svg.dg .fim-centre rect{fill:var(--panel);stroke:var(--accent);stroke-width:2.4}
.ml-layer{border-top:3px solid var(--accent)}.ml-layer:nth-child(2){border-top-color:var(--acct)}.ml-layer:nth-child(3){border-top-color:var(--prod)}
.mf-proof{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}.mf-proof .kv{font-size:26px}
.mf-ctl{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:6px 0}.mf-ctl input{width:130px;background:var(--panel2);color:var(--ink);border:1px solid var(--line);border-radius:6px;padding:5px 8px;font:inherit}
.mf-events{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0}.mf-ev{background:var(--panel2);border:1px solid var(--line);border-left:4px solid var(--line);border-radius:6px;padding:8px 10px;cursor:pointer;font:13px "Segoe UI",Arial,sans-serif;color:var(--ink);text-align:left}.mf-ev.manual{border-left-color:var(--risk)}.mf-ev.memo{font-style:italic;color:var(--muted)}.mf-ev.on{border-color:var(--accent);border-left-width:4px}.mf-ev small{display:block;color:var(--muted);font-style:normal}
.mf-ctls{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.mf-c{background:var(--panel2);border:1px solid var(--line);border-radius:6px;padding:8px 10px;font-size:12.5px}.mf-c.on{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}.mf-c b{color:var(--accent)}
.mg-wave{background:var(--panel);border:1px solid var(--line);border-top:3px solid var(--accent);border-radius:8px;padding:10px 12px;cursor:pointer;text-align:left;color:var(--ink);font:13px "Segoe UI",Arial,sans-serif}.mg-wave.on{border-color:var(--accent)}.mg-wave b{display:block;font-size:14px}
.mg-waves{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}
.disp{font-weight:600}.disp-Retire{color:var(--red)}.disp-Replace{color:var(--acct)}.disp-Consolidate{color:var(--prod)}.disp-Retain{color:var(--accent)}
.legend{font-size:12px;color:var(--muted);padding:10px 0 0}.ev{display:inline-block;font:600 11px "Segoe UI",Arial,sans-serif;border-radius:9px;padding:1px 8px;margin:0 2px;border:1px solid currentColor;vertical-align:middle}
.ev-client_confirmed{color:var(--accent)}.ev-source_validated{color:var(--accent);border-style:dashed}.ev-hypothesis{color:var(--acct)}.ev-illustrative{color:var(--muted)}.ev-decision_required{color:var(--red)}
.mf-ev.exc{border-style:dashed}.mf-rule{margin:10px 0}.mf-trace li{min-width:170px}.mf-open{margin:6px 0}.mf-own{font-size:12px;margin-top:4px}tr.tot td{font-weight:600;border-bottom:2px solid var(--line)}
details.alt{margin-top:10px;font-size:13px}details.alt summary{cursor:pointer;color:var(--muted)}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}svg.dg .bx:focus,svg.dg .bx:focus-visible{outline:none}svg.dg .bx:focus-visible rect{stroke:var(--accent);stroke-width:2.6}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}svg.wt .ar.on{stroke-dasharray:none;stroke-dashoffset:0}}
@media (max-width:900px){header{position:static}.kpis,.mf-proof{grid-template-columns:repeat(2,1fr)}.grid2,.grid3,.grid4,.mf-events,.mf-ctls{grid-template-columns:1fr}h1{font-size:22px}}`;

/** The page's script: tabs and deep links, the five tabs' interactions. Data comes from the JSON block; text is set with textContent. */
const JS = `(function(){
var D=JSON.parse(document.getElementById("hub-data").textContent);
var $=function(s,r){return (r||document).querySelector(s)};var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
var PH=/(\\[(?:to size|to confirm|\\$ ?TBD|TBD)[^\\]]*\\])/;
function put(el,text){el.textContent="";String(text).split(PH).forEach(function(p,i){if(!p)return;if(i%2){var s=document.createElement("span");s.className="red";s.textContent=p;el.appendChild(s)}else el.appendChild(document.createTextNode(p))});return el}
function mk(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)put(e,text);return e}
function money(n){return n.toLocaleString("en-CA",{minimumFractionDigits:2,maximumFractionDigits:2})}
var tabs=$$("nav a"),secs=$$("section.tab");
function show(n){tabs.forEach(function(a,i){a.classList.toggle("on",i===n-1)});secs.forEach(function(s,i){s.classList.toggle("on",i===n-1)})}
function route(){var m=/^#p([1-5])(?:-([0-9]+))?$/.exec(location.hash||"");var n=m?+m[1]:1;show(n);window.scrollTo(0,0);if(n===2&&m&&m[2])wt(+m[2]-1);}
window.addEventListener("hashchange",route);
// Tab 1
var t1=$("#t1-svg"),t1d=$("#t1-detail");
$$("#t1-views .chip").forEach(function(c){c.addEventListener("click",function(){$$("#t1-views .chip").forEach(function(x){x.classList.toggle("on",x===c)});t1.setAttribute("data-view",c.getAttribute("data-view"))})});
function t1pick(g){$$(".bx",t1).forEach(function(x){x.classList.toggle("sel",x===g)});var s=D.systems[g.getAttribute("data-id")];if(!s)return;t1d.textContent="";var h=mk("div","dh",s.name+"  ");h.appendChild(mk("span","ev ev-"+s.status,D.ev[s.status]+(s.source?" · "+s.source:"")));t1d.appendChild(h);t1d.appendChild(mk("div","",s.role));if(s.issue){var p=mk("div","");p.appendChild(mk("b","","Issue today: "));p.appendChild(put(document.createElement("span"),s.issue));t1d.appendChild(p)}}
$$(".bx",t1).forEach(function(g){g.addEventListener("click",function(){t1pick(g)});g.addEventListener("keydown",function(e){if(e.key==="Enter")t1pick(g)})});
// Tab 2
var t2=$("#t2-svg"),step=-1,timer=null,ov=$("#t2-overlay"),t2d=$("#t2-detail");
var dots=$("#t2-dots");D.steps.forEach(function(s,i){var b=mk("button","t2-dot",String(i+1));b.title=s.t;b.addEventListener("click",function(){stop();wt(i)});dots.appendChild(b)});
function wt(i){if(i<0)i=0;if(i>=D.steps.length)i=D.steps.length-1;step=i;var s=D.steps[i];t2.classList.add("wt");$("#t2-mode").textContent="Explore";
$$(".bx",t2).forEach(function(g){g.classList.toggle("on",s.b.indexOf(g.getAttribute("data-id"))>=0)});
$$(".ar",t2).forEach(function(a){a.classList.remove("on");void a.getBoundingClientRect();if(s.a.indexOf(a.getAttribute("data-a"))>=0)a.classList.add("on")});
ov.classList.toggle("on",!!s.overlay);$$(".t2-dot").forEach(function(d,k){d.classList.toggle("on",k===i)});
t2d.textContent="";var h=mk("div","t2-step");h.appendChild(mk("b","","Step "+(i+1)+" of "+D.steps.length+": "));h.appendChild(document.createTextNode(s.t));t2d.appendChild(h);t2d.appendChild(mk("div","muted",s.d));
if(history.replaceState)history.replaceState(null,"","#p2-"+(i+1));}
function stop(){if(timer){clearInterval(timer);timer=null;$("#t2-play").textContent="Play"}}
function explore(){stop();step=-1;t2.classList.remove("wt");ov.classList.remove("on");$$(".t2-dot").forEach(function(d){d.classList.remove("on")});$("#t2-mode").textContent="Walkthrough";t2d.textContent="";t2d.appendChild(mk("div","muted","Explore mode: everything is shown. Click any box for its role."));}
$("#t2-restart").addEventListener("click",function(){stop();wt(0)});$("#t2-back").addEventListener("click",function(){stop();wt(step-1)});$("#t2-next").addEventListener("click",function(){stop();wt(step+1)});
$("#t2-play").addEventListener("click",function(){if(timer){stop();return}if(step<0||step>=D.steps.length-1)wt(0);this.textContent="Pause";timer=setInterval(function(){if(step>=D.steps.length-1){stop();return}wt(step+1)},3200)});
$("#t2-mode").addEventListener("click",function(){if(t2.classList.contains("wt"))explore();else wt(0)});
document.addEventListener("keydown",function(e){if(!$("#s2").classList.contains("on")||/INPUT|TEXTAREA/.test(e.target.tagName))return;if(e.key==="ArrowRight"){stop();wt(step+1)}else if(e.key==="ArrowLeft"){stop();wt(step-1)}else if(e.key===" "){e.preventDefault();$("#t2-play").click()}});
$$(".bx",t2).forEach(function(g){g.addEventListener("click",function(){if(t2.classList.contains("wt"))explore();var s=D.info[g.getAttribute("data-id")];if(!s)return;$$(".bx",t2).forEach(function(x){x.classList.toggle("sel",x===g)});t2d.textContent="";t2d.appendChild(mk("div","dh",s.name));t2d.appendChild(mk("div","",s.text))})});
// Tab 3
var t3=$("#t3-svg"),t3d=$("#t3-detail");
function t3pick(k){var e=D.entities[k];$$(".ml-ent",t3).forEach(function(g){g.classList.toggle("sel",+g.getAttribute("data-e")===k)});$$(".ml-spoke",t3).forEach(function(l){l.classList.toggle("on",+l.getAttribute("data-e")===k)});t3d.textContent="";t3d.appendChild(mk("div","dh",e.name));var a=mk("div","");a.appendChild(mk("b","","Key attributes: "));e.attributes.forEach(function(x){a.appendChild(mk("span","tag",x))});t3d.appendChild(a);var s=mk("div","");s.appendChild(mk("b","","Sourced from: "));s.appendChild(document.createTextNode(e.sourced));t3d.appendChild(s);var u=mk("div","");u.appendChild(mk("b","","Used by: "));u.appendChild(document.createTextNode(e.used_by));t3d.appendChild(u)}
$$(".ml-ent",t3).forEach(function(g){g.addEventListener("click",function(){t3pick(+g.getAttribute("data-e"))})});
// Tab 4
var prod=0,stage=-1,ev=null;
function badge(st,src){return mk("span","ev ev-"+st,D.ev[st]+(src?" · "+src:""))}
function amt(){var v=parseFloat($("#mf-amt").value);return isFinite(v)&&v>0?v:1000}
function evs(){var p=D.products[prod];return stage<0?[].concat.apply([],p.stages.map(function(s){return s.events})):p.stages[stage].events}
function drawProd(){$$("#mf-prods .chip").forEach(function(c,i){c.classList.toggle("on",i===prod)});var p=D.products[prod],st=$("#mf-stages");st.textContent="";
var n=0;p.stages.forEach(function(s){n+=s.events.length});var all=mk("li",stage<0?"on":"","ALL · "+n+" events ("+D.cat[p.catalogue]+")");all.tabIndex=0;all.addEventListener("click",function(){stage=-1;drawProd()});st.appendChild(all);
p.stages.forEach(function(s,i){var li=mk("li",i===stage?"on":"",s.name+" · "+s.events.length+(s.events.length===1?" event":" events"));li.tabIndex=0;li.addEventListener("click",function(){stage=i;drawProd()});st.appendChild(li)});
var list=$("#mf-events");list.textContent="";var es=evs();if(!ev||es.indexOf(ev)<0)ev=es[0];
es.forEach(function(e){var b=mk("button","mf-ev"+(e.manual?" manual":"")+(e.memo?" memo":"")+(e.exception?" exc":"")+(e===ev?" on":""));b.appendChild(document.createTextNode(e.name));b.appendChild(mk("small","",(e.exception?"Exception · ":"")+(e.memo?"Memo, no journal · ":"")+(e.manual?"Manual today · ":"")+e.frequency));b.addEventListener("click",function(){ev=e;drawProd()});list.appendChild(b)});
var o=$("#mf-open");o.textContent="";if(p.open_items.length){o.appendChild(mk("b","","Excluded events and unresolved treatments: "));p.open_items.forEach(function(x){o.appendChild(mk("span","tag",x))})}
drawEv()}
function cells(tr,tag,vals,cls){vals.forEach(function(v,i){tr.appendChild(mk(tag,cls[i]||"",v))})}
function field(parent,label,val,red){var c=mk("div","");c.appendChild(mk("div","muted",label));c.appendChild(mk("div",red?"red":"",val||"[to confirm]"));parent.appendChild(c)}
function outputs(e){if(e.memo)return "Memo update only";var l={};e.lines.forEach(function(x){l[x.ledger||"Primary ledger"]=1});var k=Object.keys(l);return "Journal"+(k.length>1?"s on "+k.length+" ledgers: ":": ")+k.join(", ")}
function drawEv(){var d=$("#mf-detail");d.textContent="";var e=ev,a=amt();var h=mk("div","dh",e.name+"  ");h.appendChild(badge(e.status,e.source));if(e.exception)h.appendChild(mk("span","tag","Exception path"));d.appendChild(h);
var g=mk("div","grid3");field(g,"Trigger",e.trigger);field(g,"Frequency",e.frequency);field(g,"Handled today",e.handled_today,e.manual);d.appendChild(g);
var r=mk("div","grid3 mf-rule");field(r,"Product variant, entity, jurisdiction",e.variant);field(r,"Effective and accounting date",e.dates);field(r,"Currency and translation",e.currency);field(r,"Rule version and approval",e.rule_version);field(r,"Reversal, correction, restatement",e.reversal);field(r,"Output",outputs(e));d.appendChild(r);
var tr=mk("ol","chev mf-trace");[["Business event",e.name],["Accounting treatment",e.treatment],["Journal",e.memo?"No journal (memo)":e.lines.length+" lines"],["Balance",e.balance],["Report",e.report]].forEach(function(x){var li=mk("li","");li.appendChild(mk("b","",x[0]+": "));li.appendChild(put(document.createElement("span"),x[1]||"[to confirm]"));tr.appendChild(li)});d.appendChild(tr);
if(e.memo){d.appendChild(mk("p","muted","Memo event: updates the Financial Information Model only; no journal is posted."))}else{var t=document.createElement("table"),th=document.createElement("thead"),hr=document.createElement("tr");th.appendChild(hr);t.appendChild(th);cells(hr,"th",["Ledger","Dr / Cr","Account",D.glFormat,"Debit","Credit"],["","","","","n","n"]);var tb=document.createElement("tbody");t.appendChild(tb);
var groups={};e.lines.forEach(function(l){var k=l.ledger||"Primary";(groups[k]=groups[k]||[]).push(l)});Object.keys(groups).forEach(function(k){var dr=0,cr=0;groups[k].forEach(function(l){var v=l.factor*a;if(l.side==="Dr")dr+=v;else cr+=v;var x=document.createElement("tr");tb.appendChild(x);cells(x,"td",[k,l.side,l.account,l.gl_format,l.side==="Dr"?money(v):"",l.side==="Cr"?money(v):""],["","","","","n","n"])});var x=document.createElement("tr");x.className="tot";tb.appendChild(x);cells(x,"td",["","","Total "+k,"",money(dr),money(cr)],["","","","","n","n"])});
d.appendChild(t);if(D.illustrative)d.appendChild(mk("div","muted","Accounts are illustrative until mapped to the client's chart of accounts."))}
var ro=mk("p","");ro.appendChild(mk("b","","Posting route: "));ro.appendChild(document.createTextNode(e.route));d.appendChild(ro);
var gt=mk("p","");gt.appendChild(mk("b","","Golden thread: "));gt.appendChild(document.createTextNode("contract key + event id "+e.id+" carried from the source record to the hub journal line, the GL line reference and the EPM drill-back."));d.appendChild(gt);
[["FIM entities touched",e.fim],["Analytical attributes (kept, not posted)",e.attributes],["Controls",e.controls.map(function(c){return c+" "+D.controls[c][0]})]].forEach(function(x){var p=mk("div","");p.appendChild(mk("b","",x[0]+": "));(x[1].length?x[1]:["none"]).forEach(function(v){p.appendChild(mk("span","tag",v))});d.appendChild(p)});
$$(".mf-c").forEach(function(c){c.classList.toggle("on",e.controls.indexOf(c.getAttribute("data-c"))>=0)})}
$$("#mf-prods .chip").forEach(function(c,i){c.addEventListener("click",function(){prod=i;stage=-1;ev=null;drawProd()})});$("#mf-amt").addEventListener("input",drawEv);
$("#mf-stages").addEventListener("keydown",function(e){if(e.key==="Enter"&&e.target.tagName==="LI")e.target.click()});
// Tab 5
$$(".mg-wave").forEach(function(b,i){b.addEventListener("click",function(){$$(".mg-wave").forEach(function(x){x.classList.toggle("on",x===b)});var w=D.waves[i],d=$("#mg-detail");d.textContent="";d.appendChild(mk("div","dh",w.id+": "+w.name));var s=mk("div","");s.appendChild(mk("b","","Scope: "));s.appendChild(put(document.createElement("span"),w.scope));d.appendChild(s);var x=mk("div","");x.appendChild(mk("b","","Exit criteria: "));x.appendChild(put(document.createElement("span"),w.exit));d.appendChild(x);var u=mk("div","");u.appendChild(mk("b","","Duration: "));u.appendChild(put(document.createElement("span"),w.duration||"[to size]"));d.appendChild(u)})});
$$("#mg-filter .chip").forEach(function(c){c.addEventListener("click",function(){$$("#mg-filter .chip").forEach(function(x){x.classList.toggle("on",x===c)});var f=c.getAttribute("data-f");$$("#mg-legacy tbody tr").forEach(function(tr){tr.style.display=f==="all"||tr.getAttribute("data-d")===f?"":"none"})})});
drawProd();var first=$(".mg-wave");if(first)first.click();route();
})();`;

const json = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

/** The page name, used for the header, footer and title. */
export const hubTitle = (c: HubContent) => `${c.client.name} Accounting Hub on Data Fabric`;

export function hubPage(c: HubContent): string {
  const name = c.client.name;
  const gl = c.gl_platform || "General ledger (platform to confirm)";
  const sources = c.today.systems.filter((s) => s.column === "source" && !s.tags.includes("gap"));
  const tagged = (t: string) => c.today.systems.filter((s) => s.tags.includes(t as never)).length;
  const paths = new Set(c.today.flows.map((f) => f.path).filter((p) => p !== "other")).size || 1;
  const t2 = targetSvg(c);
  const st = steps(c, sources.slice(0, 8).map((s) => `s-${s.id}`));
  const ents = entities(c);
  const attrs = c.fim.attributes ?? (c.client.type === "wealth_asset_manager" ? ["fee tier", "channel", "advisor", "AUM band", "mandate type"] : c.client.type === "insurer" ? ["cohort", "portfolio", "risk adjustment", "channel", "reinsurance share"] : ["FTP rate", "ECL stage", "PD / LGD", "vintage", "channel", "investor code", "series"]);
  const events = c.maf.products.flatMap((p) => p.stages.flatMap((s) => s.events));
  const journalLines = events.reduce((n, e) => n + e.lines.length, 0);
  const dispo = (d: string) => c.migration.legacy.filter((l) => l.disposition === d).length;
  const register = c.evidence.length
    ? ` Evidence: ${c.evidence.map((e) => `${e.id} ${esc(e.name)}${e.date ? `, ${esc(e.date)}` : ""}${e.section ? `, ${esc(e.section)}` : ""}`).join("; ")}. Uncited statements are unverified.`
    : " No client evidence attached: every statement is a hypothesis until confirmed.";
  const source = (illustrative: boolean) => `<div class="src">Source: ${c.current_state_source ? esc(c.current_state_source) : "hypothesis of current state built from the stated source systems and legacy accounting logic"}; VOLT accounting hub method${illustrative ? "; illustrative" : ""}; Draft for discussion.${register}</div>`;
  const head = (n: number, eyebrow: string, t: { headline: string; lede: string }) => `<div class="eyebrow">${String(n).padStart(2, "0")} · ${esc(eyebrow)}</div><h1>${rt(t.headline)}</h1><p class="lede">${rt(t.lede)}</p>`;
  const recon = c.migration.reconciliation ?? [
    { level: "source_to_hub", item: "Events received (month)", unit: "count", legacy: 1_204_118, hub: 1_204_112, reason: "Six duplicates rejected (C9)" },
    { level: "hub_to_gl", item: "Receivable / principal balance", unit: "amount", legacy: 125_400_000, hub: 125_400_000, reason: "Agrees" },
    { level: "hub_to_gl", item: "Interest income (month)", unit: "amount", legacy: 1_842_315.4, hub: 1_842_410.15, reason: "Timing: accrual cut-off on effective date (C6), permitted" },
    { level: "hub_to_gl", item: "Fee income (month)", unit: "amount", legacy: 212_880, hub: 212_879.96, reason: "Rounding: line-level versus summary rounding, within tolerance (C12)" },
    { level: "hub_to_gl", item: "Charge-offs net of recoveries", unit: "amount", legacy: 401_220, hub: 398_940, reason: "Legacy defect: recoveries netted twice in the legacy job" },
    { level: "hub_to_gl", item: "Suspense", unit: "amount", legacy: 0, hub: 12_450, reason: "Unmapped records held in suspense with an SLA (C2, C13)" },
    { level: "gl_to_report", item: "Receivables in the regulatory return", unit: "amount", legacy: 125_400_000, hub: 125_400_000, reason: "Agrees" },
  ];
  const LEVEL = { source_to_hub: "Source events to hub", hub_to_gl: "Hub to GL", gl_to_report: "GL to reporting" };
  const num = (n: number, unit: string) => unit === "count" ? n.toLocaleString("en-CA") : n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const brandLine = c.branding.style !== "volt" ? `<b>${esc(c.branding.logo_text || name)}</b>` : "<b>VOLT</b> | " + esc(name);
  const data = {
    systems: Object.fromEntries(c.today.systems.map((s) => [s.id, { name: s.name, role: s.role, issue: s.issue, status: s.status, source: s.source }])),
    ev: EV_LABEL,
    cat: { draft: "draft", validated: "validated", in_scope: "in scope" },
    info: t2.info,
    steps: st,
    entities: ents,
    products: c.maf.products,
    controls: CONTROLS,
    waves: c.migration.waves,
    glFormat: `${c.gl_platform || "GL"} format`,
    illustrative: c.accounts_illustrative,
  };
  const views = [["all", "Full architecture"], ["acct", "Accounting path"], ["prod", "Product data path"], ["custom", "Where custom accounting logic lives"], ["manual", "Manual touchpoints"], ["gap", "Gaps vs reference architecture"]];
  const cmp = COMPARE(gl);
  const table = (cols: string[], rows: string[][], cls = "") => `<table${cls ? ` class="${cls}"` : ""}><thead><tr>${cols.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((v) => `<td>${v}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const alt = (items: string[]) => `<details class="alt"><summary>Text version of this diagram</summary><ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul></details>`;
  const sysName = (id: string) => esc(c.today.systems.find((s) => s.id === id)?.name ?? id);

  const tab1 = `<section class="tab" id="s1">${head(1, `${name} today`, c.today)}
${kpis([[sources.length, "source systems"], [tagged("custom_logic"), "places accounting rules are applied"], [paths, "data paths"], [c.today.platforms.length, "platforms to maintain"], [tagged("manual"), "manual inputs", true], [tagged("gap"), "gaps vs reference architecture"]])}
<div class="chips" id="t1-views">${views.map(([v, l], i) => `<button class="chip${i ? "" : " on"}" data-view="${v}">${l}</button>`).join("")}</div>
<div class="panel">${todaySvg(c)}<div class="detail" id="t1-detail"><span class="muted">Click any box for its role, the issue it creates and how far it is evidenced. Dashed boxes are reference capabilities to confirm.</span></div>
${alt([...COLS.map((k) => `${COL_NAME[k]}: ${c.today.systems.filter((s) => s.column === k).map((s) => `${esc(s.name)} (${EV_LABEL[s.status]}${s.tags.includes("custom_logic") ? ", accounting logic" : ""}${s.tags.includes("manual") ? ", manual" : ""}${s.tags.includes("gap") ? ", to confirm" : ""})`).join(", ") || "none"}`), ...c.today.flows.map((f) => `${sysName(f.from)} to ${sysName(f.to)} (${f.path} path)`)])}</div>
<h2>Key principles vs ${esc(name)} today</h2><div class="grid2">${c.today.principles.map((p) => `<div class="panel"><h3>${rt(p.principle)}</h3><div class="muted">${rt(p.today)}</div></div>`).join("")}</div>
<h2>Pain points in the client's words</h2><div class="panel">${c.pain_points.map((p) => `<span class="tag">${rt(p)}</span>`).join("")}</div>
${soWhat(c.today.so_what)}${source(false)}</section>`;

  const own = RESPONSIBILITIES.map((r) => {
    const o = c.target.ownership.find((x) => x.responsibility === r);
    return [esc(RESP[r]), o ? esc(o.component) : rt("[to confirm]"), o ? esc(o.record) : rt("[to confirm]"), o ? badge(o.status, o.source) : badge("decision_required")];
  });
  const grain = c.target.posting_grain ?? { proposal: "Summarised by entity, account, cost centre and product, daily", criteria: "Reconciliation, audit drill-back, regulatory reporting and GL platform volume needs decide the grain; detail stays in the sub-ledger either way.", status: "decision_required" as const };
  const tab2 = `<section class="tab" id="s2">${head(2, "Target accounting hub", c.target)}
${kpis([[1, "governed rule framework, applied once"], [1, "golden source for all reporting"], [sources.length, "sources landed once"], [CONTROL_IDS.length, "proposed controls"], [st.length, "walkthrough steps"], [(c.target.consumers ?? [0, 0, 0, 0, 0, 0]).length, "golden-source consumers"]])}
<div class="t2-bar"><button class="chip" id="t2-restart">Restart</button><button class="chip" id="t2-back">Back</button><button class="chip" id="t2-play">Play</button><button class="chip" id="t2-next">Next</button><div class="t2-dots" id="t2-dots"></div><button class="chip" id="t2-mode" style="margin-left:auto">Walkthrough</button></div>
<div class="panel"><div class="t2-wrap">${t2.svg}<div class="t2-overlay" id="t2-overlay"><div class="sw-h">Two design principles</div><ol>${PRINCIPLES.map((p) => `<li>${p}</li>`).join("")}</ol></div></div><div class="detail" id="t2-detail"><span class="muted">Press Play or Next to walk through the target, or click any box. Arrow keys move between steps.</span></div>
${alt(st.map((s, i) => `Step ${i + 1}, ${esc(s.t)}: ${esc(s.d)}`))}</div>
<h2>Who owns what: data platform versus accounting engine</h2><p class="muted">The data fabric stores and conforms data; it does not by itself provide a controlled sub-ledger. Each responsibility needs a named owner and system of record.</p>
<div class="panel">${table(["Responsibility", "Owning component", "System of record", "Evidence"], own)}</div>
<h2>Posting grain is a decision</h2><div class="panel"><h3>${esc(grain.proposal)} ${badge(grain.status)}</h3><div class="muted">${rt(grain.criteria)}</div></div>
<h2>Three options compared</h2><div class="panel"><table class="t2-cmp"><thead><tr><th></th>${cmp.cols.map((h, i) => `<th${i === 2 ? ' class="rec"' : ""}>${esc(h)}</th>`).join("")}</tr></thead><tbody>${cmp.rows.map((r) => `<tr><th>${esc(r[0])}</th>${r.slice(1).map((v, i) => `<td${i === 2 ? ' class="rec"' : ""}>${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
${soWhat(c.target.so_what)}${source(false)}</section>`;

  const tab3 = `<section class="tab" id="s3">${head(3, "Financial Information Model", c.fim)}
${kpis([[ents.length + 1, "FIM entities"], [3, "accounting and information layers"], [5, "golden-thread steps"], [4, "design principles"], [attrs.length, "analytical attributes, not posted"], [sources.length, "sources conformed"]])}
<div class="panel">${fimSvg(ents)}<div class="detail" id="t3-detail"><span class="muted">Click an entity for its key attributes, where it is sourced and who uses it.</span></div>
${alt([`Contract at the centre, linked to: ${ents.map((e) => esc(e.name)).join(", ")}`, ...ents.map((e) => `${esc(e.name)}: ${e.attributes.map(esc).join(", ")}; sourced from ${esc(e.sourced)}; used by ${esc(e.used_by)}`)])}</div>
<h2>Accounting and information layers</h2><p class="muted">Only the first layer is a chart of accounts. The sub-ledger holds the detail behind it, and the attributes describe it without being posted.</p><div class="grid3">
<div class="panel ml-layer"><h3>GL chart of accounts in ${esc(gl)}</h3><div class="muted">Accounts and segments (entity, account, cost centre, product, intercompany) in ${esc(c.gl_platform || "the GL platform")}'s own format, posted at the agreed grain.</div></div>
<div class="panel ml-layer"><h3>Sub-ledger detail (hub)</h3><div class="muted">Contract- and event-level journal lines per accounting basis, with both dates, the rule version and the golden-thread key.</div></div>
<div class="panel ml-layer"><h3>Analytical attributes (FIM, never posted)</h3><div>${attrs.map((a) => `<span class="tag">${esc(a)}</span>`).join("")}</div></div></div>
<h2>The golden thread</h2>${chev(["Source transaction", "Business event", "Hub journal line", "GL journal line (memo / reference)", "EPM drill-back"])}
<h2>Four principles</h2><div class="grid4">${[["Define once", "Each concept, rule and hierarchy has one definition, used by the GL and every report."], ["Contract grain", "Data is held at contract level; every balance rolls up from contracts."], ["Event-driven", "Every change is a business event; journals come only from events."], ["Two dates", "Effective and accounting dates are both kept, so cut-off and back-dating are controlled."]].map(([h, t]) => `<div class="panel"><h3>${h}</h3><div class="muted">${t}</div></div>`).join("")}</div>
${soWhat(c.fim.so_what)}${source(!c.fim.entities)}</section>`;

  const proof: [string, string][] = [["111", "sub-events across 3 deposit and overdraft products"], ["39", "GL accounts, each traced to the events that post to it"], ["12", "event types"], ["1", "golden-thread key from the core banking engine through the sub-ledger and GL to regulatory reporting"], ["7", "management attributes held in the sub-ledger, not posted to the GL"], ["3", "months of synthetic daily events used to test every rule before UAT"]];
  const proofHtml = c.prior_proof_approved ? `<h2>How we have done this before</h2><p class="muted">Delivered for ${PRIOR_CLIENT}. Figures approved for this audience.</p>
<div class="mf-proof">${proof.map(([v, l]) => `<div class="kpi"><div class="kv">${v}</div><div class="kl">${l}</div></div>`).join("")}</div>` : "";
  const ctl = (k: (typeof CONTROL_IDS)[number]) => c.maf.controls.find((x) => x.id === k);
  const catalogue = c.maf.products.map((p) => p.catalogue === "in_scope" ? "in scope" : p.catalogue);
  const tab4 = `<section class="tab" id="s4">${head(4, "Master Accounting Flow", c.maf)}
${kpis([[c.maf.products.length, "product lifecycles"], [c.maf.products.reduce((n, p) => n + p.stages.length, 0), "lifecycle stages"], [events.length, `business events (${[...new Set(catalogue)].join(", ")})`], [events.filter((e) => e.exception).length, "exception events"], [events.filter((e) => e.manual).length, "events manual today", true], [journalLines, "journal lines"]])}
${proofHtml}
<h2>Method</h2>${chev(["Lifecycle mapped with Product and Finance", "Sub-events and DR / CR agreed in a walkthrough with the engine team", "Golden thread and attributes designed into the model", "Synthetic data tests", "GL-to-transaction drill-back demonstrated"])}
<h2>Six-step Master Accounting Flow</h2>${chev(["Source and data contract", "Product lifecycle event catalogue", "Accounting matrix (posting rules)", "Controls", "Journals and sub-ledger on the FIM", `GL posting and close in ${c.gl_platform || "the GL"}${c.epm ? ` and ${c.epm}` : ""}`])}
<h2>Lifecycle explorer</h2><div class="panel"><div class="mf-ctl"><div class="chips" id="mf-prods">${c.maf.products.map((p, i) => `<button class="chip">${esc(p.name)} · ${esc(p.source)}${i === 0 ? " (proof of concept)" : " (reuse)"}</button>`).join("")}</div><label>Sample amount <input id="mf-amt" type="number" min="1" step="any" value="1000"></label></div>
<ol class="chev mf-stages" id="mf-stages"></ol><div class="muted">Orange edge: manual today. Dashed: exception path. Grey italics: memo event, no journal. Event counts are ${[...new Set(catalogue)].join(" / ")} until validated with Product and Finance.</div><div class="mf-events" id="mf-events"></div><div id="mf-open" class="mf-open"></div><div class="detail" id="mf-detail"></div></div>
<h2>Proposed controls</h2><div class="mf-ctls">${CONTROL_IDS.map((k) => { const o = ctl(k); return `<div class="mf-c" data-c="${k}"><b>${k}</b> ${CONTROLS[k][0]}<div class="muted">${CONTROLS[k][1]} · ${CONTROLS[k][2]} · ${CONTROLS[k][3]}</div><div class="mf-own">Owner ${rt(o?.owner ?? "[to confirm]")} · Threshold ${rt(o?.threshold ?? "[to confirm]")} · Escalation ${rt(o?.escalation ?? "[to confirm]")}</div></div>`; }).join("")}</div>
${soWhat(c.maf.so_what)}${source(c.accounts_illustrative)}</section>`;

  const stages: [string, string][] = [["Shadow", "Hub runs on full production data; no outputs used; every break investigated."], ["Parallel", "Legacy and hub both produce journals; the exit thresholds below hold for the agreed number of closes."], ["Cutover", "GL fed from the hub; legacy runs read-only as a fallback; sign-off by the named owners."], ["Decommission", "Legacy jobs, files and code switched off and archived; run cost released."]];
  const exits = c.migration.exit_thresholds ?? ["Event completeness and duplicate rate", "Journal count and amount differences", "Balance differences by account, entity, currency and accounting basis", "Aged breaks and unresolved exceptions", "Replay and recovery test results", "Sign-off owners and evidence retention"].map((m) => ({ measure: m, threshold: "[to confirm]", owner: "[to confirm]" }));
  const nfr = NFR_AREAS.map((a) => {
    const rows = c.migration.nfr.filter((n) => n.area === a);
    return rows.length ? rows.map((n) => [esc(NFR[a]), rt(n.requirement), badge(n.status, n.source)]) : [[esc(NFR[a]), rt("[to confirm]"), badge("decision_required")]];
  }).flat();
  const KIND = { current_cost: "Current cost", one_time: "One-time cost", ongoing: "Ongoing cost", benefit_quantified: "Quantified benefit", benefit_qualitative: "Qualitative benefit" };
  const value = c.migration.value.length ? c.migration.value : [
    { item: "Run cost of today's accounting logic (code, ETL, platforms, manual files)", kind: "current_cost" as const, amount: "[$ TBD]", evidence: "Client cost baseline, to be supplied", confidence: "low" as const, owner: "[to confirm]" },
    { item: "Implementation and parallel-run transition", kind: "one_time" as const, amount: "[$ TBD]", evidence: "Estimate after the proof of concept", confidence: "low" as const, owner: "[to confirm]" },
    { item: "Hub platform, support and control operation", kind: "ongoing" as const, amount: "[$ TBD]", evidence: "Platform quote and support model", confidence: "low" as const, owner: "[to confirm]" },
    { item: "Legacy components retired", kind: "benefit_quantified" as const, amount: "[$ TBD]", evidence: "Legacy disposition below, once the baseline is validated", confidence: "low" as const, owner: "[to confirm]" },
    { item: "Close confidence, audit evidence, one golden source", kind: "benefit_qualitative" as const, amount: "n/a", evidence: "Controls and lineage design", confidence: "medium" as const, owner: "[to confirm]" },
  ];
  const tab5 = `<section class="tab" id="s5">${head(5, "Migration & parallel run", c.migration)}
${kpis([[c.migration.waves.length, "waves"], [4, "parallel-run stages"], [c.migration.legacy.length, "legacy components dispositioned"], [dispo("Retire"), "components retired"], [c.target_date ? c.target_date : "[to size]", "proof of concept"], ["[$ TBD]", "annual run-cost saving, until the baseline is validated", true]])}
<h2>Waves</h2><div class="mg-waves">${c.migration.waves.map((w) => `<button class="mg-wave"><b>${esc(w.id)} · ${esc(w.name)}</b><span class="muted">${rt(w.scope)}</span><div class="red">${rt(w.duration || "[to size]")}</div></button>`).join("")}</div><div class="panel detail" id="mg-detail"></div>
<h2>Parallel run</h2>${chev(stages.map(([s]) => s))}<div class="grid4">${stages.map(([s, x]) => `<div class="panel"><h3>${s}</h3><div class="muted">Exit: ${x}</div><div class="red">[to size]</div></div>`).join("")}</div>
<h2>Exit thresholds</h2><div class="panel">${table(["Measure", "Threshold", "Sign-off owner"], exits.map((e) => [esc(e.measure), rt(e.threshold), rt(e.owner)]))}<div class="muted">Permitted timing, rounding and policy differences are agreed before the run; there is no blanket zero-variance target.</div></div>
<h2>Illustrative reconciliation at three levels (synthetic)</h2><div class="panel"><table><thead><tr><th>Level</th><th>Item</th><th class="n">Legacy</th><th class="n">Hub</th><th class="n">Variance</th><th>Explained by</th></tr></thead><tbody>${recon.map((r) => `<tr><td>${LEVEL[r.level as keyof typeof LEVEL]}</td><td>${esc(r.item)}</td><td class="n">${num(r.legacy, r.unit)}</td><td class="n">${num(r.hub, r.unit)}</td><td class="n">${num(r.hub - r.legacy, r.unit)}</td><td>${esc(r.reason)}</td></tr>`).join("")}</tbody></table><div class="muted">Synthetic figures to show the reconciliation, not client data.</div></div>
<h2>Legacy disposition</h2><div class="chips" id="mg-filter">${["all", "Retire", "Replace", "Consolidate", "Retain"].map((f, i) => `<button class="chip${i ? "" : " on"}" data-f="${f}">${f === "all" ? "All" : f === "Retain" ? "Retain · repoint" : f}</button>`).join("")}</div>
<div class="panel"><table id="mg-legacy"><thead><tr><th>Legacy component</th><th>Disposition</th><th>Target</th><th>Note</th></tr></thead><tbody>${c.migration.legacy.map((l) => `<tr data-d="${l.disposition}"><td>${esc(l.component)}</td><td class="disp disp-${l.disposition}">${l.disposition}</td><td>${esc(l.target)}</td><td>${rt(l.note ?? "")}</td></tr>`).join("")}</tbody></table></div>
<h2>Non-functional and operating model</h2><div class="panel">${table(["Area", "Requirement", "Evidence"], nfr)}</div>
<h2>Value model</h2><div class="panel">${table(["Item", "Type", "Amount", "Evidence", "Confidence", "Owner"], value.map((v) => [esc(v.item), KIND[v.kind], rt(v.amount), rt(v.evidence), v.confidence, rt(v.owner)]))}<div class="muted">No headcount or cost reduction is shown as a benefit until the client validates the baseline and operating assumptions.</div></div>
${soWhat(c.migration.so_what)}${source(true)}</section>`;

  const nav = [`${name} Today`, "Target Accounting Hub", "Financial Information Model", "Master Accounting Flow", "Migration & Parallel Run"]
    .map((t, i) => `<a href="#p${i + 1}"${i ? "" : ' class="on"'}><span>${String(i + 1).padStart(2, "0")}</span>${esc(t)}</a>`).join("");
  const markers = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${[["ah", "mk"], ["ah-acct", "mk-acct"], ["ah-prod", "mk-prod"], ["ah-accent", "mk-accent"], ["ah-red", "mk-red"]].map(([i, k]) => `<marker id="${i}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="${k}" d="M0 0L10 5L0 10z"/></marker>`).join("")}</defs></svg>`;
  const legend = `<div class="legend">Evidence: ${EVIDENCE.map((e) => badge(e)).join(" ")}</div>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(hubTitle(c))}</title>
<style>:root{${brandVars(c)}}${CSS}</style></head>
<body>${markers}
<header><div class="wrap"><div class="hd"><div class="mark"><i></i><i></i><i></i><i></i></div><div class="brand">${brandLine} · Accounting Hub on Data Fabric</div><div class="conf">Draft for discussion · ${c.confidentiality === "internal" ? "Internal only" : "Client-facing draft"} · ${esc(c.audience)}</div></div><nav>${nav}</nav></div></header>
<main class="wrap">${legend}${tab1}${tab2}${tab3}${tab4}${tab5}</main>
<footer><div class="wrap">${esc(hubTitle(c))}</div></footer>
<script type="application/json" id="hub-data">${json(data)}</script>
<script>${JS}</script>
</body></html>`;
}
