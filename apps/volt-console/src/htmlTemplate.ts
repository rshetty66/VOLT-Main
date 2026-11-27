import { toneFor } from "../shared/brand";
import type { ChartSpec } from "../shared/viz";
import { fmt } from "./charts/specChart";
import { VIZ_CSS, VIZ_SCRIPT } from "./charts/vizScript";

/**
 * The VOLT HTML deliverable: one self-contained, offline page in the house style. A sticky header carries the VOLT
 * mark and a numbered tab per section; the first page opens with the title and the answer in a "So what" panel; charts
 * reveal as their page opens; process flows are interactive (select a step for its detail, or play the walkthrough).
 * Everything prints, one section per page. No external fonts, scripts or images.
 *
 * The layout follows Rakesh's reference page (Generic_Future_of_Finance_Pages.html): a serif headline and lede per page,
 * a KPI strip of flat tiles, lettered section labels, card grids, a source line and a walkthrough bar under each flow.
 *
 * Design follows the Impeccable skill (.claude/skills/impeccable): colour on meaning only, one authored motion per
 * exhibit with a reduced-motion path, content visible before any script runs, AA contrast, themed focus and selection.
 */

export interface HtmlPage {
  title: string;
  html: string;
}

/** A companion file carried inside the page (a data: URL), so the offline page can hand it over. */
export interface HtmlFile {
  label: string;
  name: string;
  href: string;
}

export interface HtmlDeliverable {
  title: string;
  subtitle?: string;
  pages: HtmlPage[];
  files?: HtmlFile[];
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Split rendered HTML into pages at each <h2>; what comes before the first one is the summary page. */
export function splitPages(html: string, summaryTitle = "Summary"): HtmlPage[] {
  const parts = html.split(/(?=<h2[\s>])/);
  const pages: HtmlPage[] = [];
  for (const part of parts) {
    const m = /^<h2[^>]*>([\s\S]*?)<\/h2>/.exec(part);
    if (m) pages.push({ title: m[1].replace(/<[^>]+>/g, "").trim(), html: part.slice(m[0].length) });
    else if (part.trim()) pages.push({ title: summaryTitle, html: part });
  }
  return pages.length ? pages : [{ title: summaryTitle, html }];
}

/** Colour-code priority, risk and status cells the same way as the Word and PowerPoint files (shared/brand.ts). */
export function toneTables(html: string): string {
  return html.replace(/<table>([\s\S]*?)<\/table>/g, (table: string) => {
    const head = [...(/<thead>([\s\S]*?)<\/thead>/.exec(table)?.[1] ?? "").matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => m[1].replace(/<[^>]+>/g, ""));
    return table.replace(/<tr>([\s\S]*?)<\/tr>/g, (row: string, cells: string) => {
      let i = 0;
      return `<tr>${cells.replace(/<td([^>]*)>([\s\S]*?)<\/td>/g, (_m: string, attrs: string, inner: string) => {
        const tone = toneFor(head[i++] ?? "", inner.replace(/<[^>]+>/g, ""));
        return tone ? `<td${attrs}><span class="tone ${tone}">${inner}</span></td>` : `<td${attrs}>${inner}</td>`;
      })}</tr>`;
    });
  });
}

/** A number cell's value: "1,577,030", "22.95%", "USD 3.5M", "-0.89"; null for text such as "2.36 (Defined)". */
export function cellNumber(text: string): number | null {
  const t = text.replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, " ").trim().replace(/^(?:USD|CAD|EUR|GBP|\$)\s*/i, "").replace(/\u2212/g, "-");
  const m = /^(-?\d[\d,]*(?:\.\d+)?)\s*(%|[KMB])?$/i.exec(t);
  if (!m) return null;
  const k = { k: 1e3, m: 1e6, b: 1e9 }[(m[2] ?? "").toLowerCase() as "k" | "m" | "b"] ?? 1;
  return parseFloat(m[1].replace(/,/g, "")) * k;
}

/**
 * A visual cue on number tables: in a column where most cells are numbers (at least three, not all equal), each
 * number gets a thin bar scaled to the column's largest absolute value, orange when negative. Text cells are left as
 * they are, so a total row such as "2.36 (Defined)" does not stop its column getting bars.
 */
export function barTables(html: string): string {
  return html.replace(/<table>([\s\S]*?)<\/table>/g, (table: string) => {
    const body = /<tbody>([\s\S]*?)<\/tbody>/.exec(table)?.[1];
    if (!body) return table;
    const rows = [...body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((r) => [...r[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1]));
    const cols = Math.max(0, ...rows.map((r) => r.length));
    const max: (number | null)[] = [];
    for (let c = 1; c < cols; c++) {
      const nums = rows.map((r) => (r[c] === undefined || /class="tone/.test(r[c]) ? null : cellNumber(r[c]))).filter((v): v is number => v !== null);
      const ok = nums.length >= 3 && nums.length >= rows.length * 0.6 && new Set(nums).size > 1;
      max[c] = ok ? Math.max(...nums.map(Math.abs)) || null : null;
    }
    if (!max.some(Boolean)) return table;
    return table.replace(/<tbody>[\s\S]*?<\/tbody>/, (tb: string) =>
      tb.replace(/<tr>([\s\S]*?)<\/tr>/g, (_r: string, cells: string) => {
        let c = 0;
        return `<tr>${cells.replace(/<td([^>]*)>([\s\S]*?)<\/td>/g, (m: string, attrs: string, inner: string) => {
          const top = max[c++];
          const v = top ? cellNumber(inner) : null;
          if (v === null || !top) return m;
          return `<td${attrs}><span class="nb${v < 0 ? " neg" : ""}" style="--w:${Math.round((Math.abs(v) / top) * 100)}%">${inner}</span></td>`;
        })}</tr>`;
      }),
    );
  });
}

/** The answer first: the summary page's opening paragraph becomes the "So what" panel. */
export function withSoWhat(html: string): string {
  return html.replace(/^\s*<p>([\s\S]*?)<\/p>/, (_m, p: string) => `<aside class="sowhat" aria-label="So what"><b>So what</b><p>${p}</p></aside>`);
}

/**
 * The reference layout from plain markdown output: a list whose items all open with a bold lead becomes a card grid
 * (numbered when ordered), "So what:" and "Source:" paragraphs become the panel and the source line, and charts that
 * follow each other sit side by side.
 */
export function referenceLayout(html: string): string {
  return html
    .replace(/<(ul|ol)>((?:(?!<\/?(?:ul|ol)[\s>])[\s\S])*?)<\/\1>/g, (list: string, tag: string, body: string) => {
      const items = [...body.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => /^\s*(?:<p>)?<strong>([\s\S]*?)<\/strong>[\s:.,-]*([\s\S]*?)(?:<\/p>)?\s*$/.exec(m[1]));
      if (items.length < 2 || items.some((m) => !m)) return list;
      const cards = items.map((m, i) => {
        const lead = m![1].replace(/[\s:.]+$/, ""), rest = m![2].trim().replace(/^[a-z]/, (c) => c.toUpperCase());
        return `<div class="card">${tag === "ol" ? `<span class="no">${String(i + 1).padStart(2, "0")}</span>` : ""}<b>${lead}</b>${rest ? `<p>${rest}</p>` : ""}</div>`;
      });
      return `<div class="cards">${cards.join("")}</div>`;
    })
    .replace(/<p><strong>So what:?<\/strong>:?\s*([\s\S]*?)<\/p>/g, (_m, p: string) => `<aside class="sowhat" aria-label="So what"><b>So what</b><p>${p}</p></aside>`)
    .replace(/<p>(?=(?:<(?:em|strong)>)?Sources?:)/g, '<p class="src">')
    .replace(/(?:<figure class="chart"[^>]*>[\s\S]*?<\/figure>\s*){2,}/g, (run: string) => `<div class="figs">${run}</div>`);
}

/** A KPI chart as the reference's strip of flat tiles: value, label, change against the comparison and a sparkline. */
export function kpiStrip(spec: ChartSpec): string {
  const cur = spec.series[0]?.values ?? [], cmp = spec.series[1];
  const unit = spec.unit ? `<small>${esc(spec.unit)}</small>` : "";
  const tiles = spec.labels.map((label, i) => {
    const v = cur[i] ?? 0;
    let delta = "";
    // A zero comparison means there is no baseline (NPV, IRR); "+4.01 vs Today" would say nothing.
    if (cmp && Number.isFinite(cmp.values[i]) && cmp.values[i] !== 0) {
      const d = v - cmp.values[i];
      const tone = d === 0 ? "" : (d > 0) === (spec.better !== "down") ? " good" : " bad";
      const pct = cmp.values[i] ? ` (${d > 0 ? "+" : ""}${Math.round((d / Math.abs(cmp.values[i])) * 1000) / 10}%)` : "";
      delta = `<span class="d${tone}">${d > 0 ? "+" : ""}${fmt(d)}${pct} vs ${esc(cmp.name)}</span>`;
    }
    const tr = spec.trends?.[i];
    let spark = "";
    if (tr && tr.length >= 2) {
      const lo = Math.min(...tr), hi = Math.max(...tr);
      const pts = tr.map((u, j) => `${+((100 * j) / (tr.length - 1)).toFixed(1)},${+(22 - ((u - lo) / (hi - lo || 1)) * 20).toFixed(1)}`).join(" ");
      spark = `<svg class="spark" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}"/></svg>`;
    }
    return `<div class="kpi${spec.highlight === i ? " hl" : ""}"><b class="v">${fmt(v)}${unit}</b><span class="l">${esc(label)}</span>${delta}${spark}</div>`;
  });
  return `<figure class="kpis" aria-label="${esc(spec.title || "Key figures")}">${spec.title ? `<figcaption>${esc(spec.title)}</figcaption>` : ""}<div class="kgrid">${tiles.join("")}</div>${spec.source ? `<p class="src">Source: ${esc(spec.source)}</p>` : ""}</figure>`;
}

export const CSS = `
:root{--bg:#000;--p1:#000;--p2:#0b0d12;--p3:#161a24;--bd:#323a55;--tx:#eef1f7;--mu:#b3bad0;--dim:#8e96ae;
--cyan:#00e5ff;--gold:#d4af37;--orange:#ff5722;--good:#2fd49a;--bad:#ff8a65;--ease:cubic-bezier(.16,1,.3,1);
--vv-accent:var(--cyan);--vv-on-accent:var(--bg);--vv-ink:#dce0ea;--vv-muted:var(--mu);--vv-line:var(--bd);--vv-panel:var(--p1);--vv-tip-bg:var(--p2);--vv-bad:var(--bad)}
*{box-sizing:border-box}
html{color-scheme:dark}
body{margin:0;background:var(--bg);color:var(--tx);font:14px/1.45 Inter,"Segoe UI",system-ui,-apple-system,Roboto,Helvetica,Arial,sans-serif;font-variant-numeric:tabular-nums}
::selection{background:var(--cyan);color:var(--bg)}
a{color:var(--cyan);text-underline-offset:3px}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;padding:0}
:focus-visible{outline:2px solid var(--cyan);outline-offset:2px}
.top{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:28px;padding:10px 28px;background:#000;border-bottom:1px solid var(--bd);flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:10px;white-space:nowrap}
.mark{inline-size:22px;block-size:22px;border-radius:4px;background:var(--cyan);display:grid;place-items:center;color:var(--bg);font-weight:800;font-size:13px}
.brand b{letter-spacing:.08em}
.brand small{color:var(--dim);font-size:12px}
.tabs{display:flex;gap:6px;flex-wrap:wrap}
.tab{padding:7px 14px;border:1px solid var(--bd);background:var(--p1);color:var(--mu);font-size:13px;border-radius:2px;transition:background .15s,color .15s}
.tab span{font-weight:700;margin-right:8px;color:var(--gold)}
.tab:hover{color:var(--tx)}
.tab[aria-selected=true]{background:var(--cyan);border-color:var(--cyan);color:var(--bg)}
.tab[aria-selected=true] span{color:var(--bg)}
main{max-inline-size:1320px;margin:0 auto;padding:28px 28px 40px}
h1,h2.pt{font-family:Georgia,"Times New Roman",serif;font-weight:400;font-size:34px;line-height:1.2;margin:0 0 12px;max-inline-size:1120px;text-wrap:balance}
.lede{color:#d6dbe8;font-size:16px;max-inline-size:820px;margin:0 0 22px}
.page{counter-reset:sec;animation:in .35s var(--ease)}
@keyframes in{from{opacity:0;transform:translateY(6px)}}
.page>h3,.kpis figcaption{font-size:12.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--mu);margin:34px 0 12px;font-weight:600}
.page>h3::before{counter-increment:sec;content:counter(sec,upper-alpha) ". "}
h4{font-size:14px;margin:22px 0 8px;color:var(--mu)}
p,li{max-inline-size:84ch}
.kpis{margin:0 0 8px}
.kpis figcaption{margin-top:0}
.kgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}
.kpi{background:var(--p1);border:1px solid var(--bd);border-top:3px solid var(--cyan);padding:12px 14px;min-block-size:92px;display:flex;flex-direction:column;gap:4px}
.kpi.hl{border-top-color:var(--gold)}
.kpi .v{font-size:28px;font-weight:600;line-height:1.1}
.kpi .v small{font-size:13px;font-weight:400;color:var(--mu);margin-left:5px}
.kpi .l{color:var(--mu);font-size:12px}
.kpi .d{font-size:12px;font-weight:600;color:var(--mu)}
.kpi .d.good{color:var(--good)}.kpi .d.bad{color:var(--bad)}
.spark{inline-size:100%;block-size:24px;margin-top:auto}
.spark polyline{fill:none;stroke:var(--cyan);stroke-width:2;vector-effect:non-scaling-stroke;stroke-linejoin:round}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;margin:12px 0 18px}
.card{background:var(--p1);border:1px solid var(--bd);border-top:3px solid var(--gold);padding:12px 14px}
.card b{display:block;margin-bottom:4px}
.card .no{color:var(--gold);font-weight:700;margin-right:6px;float:left}
.card p{margin:0;color:#cfd4e2;font-size:13px}
.sowhat{background:#000;border:1px solid #1d5866;padding:16px 20px;margin:0 0 26px}
.page>.sowhat:not(:first-child){margin:34px 0 12px}
.sowhat b{display:block;color:var(--cyan);text-transform:uppercase;letter-spacing:.1em;font-size:12px;font-weight:700;margin-bottom:6px}
.sowhat p{margin:0;font-size:15px;max-inline-size:none}
.src{font-size:11.5px;color:var(--dim);margin:6px 0 0}
table{border-collapse:collapse;inline-size:100%;margin:12px 0 18px;font-size:13.5px;background:var(--p1);border:1px solid var(--bd)}
th,td{border-bottom:1px solid var(--bd);padding:7px 10px;text-align:left;vertical-align:top}
th{background:var(--p3);color:var(--tx);font-weight:600}
tr:last-child td{border-bottom:0}
.nb{display:inline-block;min-inline-size:100%;padding-block-end:5px;background:linear-gradient(var(--cyan),var(--cyan)) no-repeat left bottom/var(--w) 3px;font-variant-numeric:tabular-nums}
.nb.neg{background-image:linear-gradient(var(--orange),var(--orange))}
.page .va-band,.page .vp-step{animation:build .6s var(--ease) both}
.page .va-band{animation-delay:calc(var(--va-i,0) * 90ms)}
.page .vp-step{animation-delay:calc(var(--vp-i,0) * 80ms)}
@keyframes build{from{opacity:0;transform:translateY(10px)}}
.tone{display:inline-block;padding:1px 9px;border-radius:999px;font-weight:600;font-size:12.5px}
.tone.high{background:#ff5722;color:#0a0d14}.tone.mid{background:#d4af37;color:#0a0d14}.tone.low{background:#00e5ff;color:#0a0d14}
code{font-family:ui-monospace,Menlo,Consolas,monospace;background:var(--p2);padding:1px 5px;border-radius:3px;font-size:.92em}
pre{background:var(--p1);padding:14px;overflow:auto}pre code{background:none;padding:0}
blockquote{margin:14px 0;padding:10px 14px;background:var(--p1);border:1px solid var(--bd);color:var(--mu)}
figure{margin:14px 0;overflow-x:auto}
figure svg{max-inline-size:100%;block-size:auto;display:block}
.figs{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,560px),1fr));gap:12px;align-items:start}
.figs figure{margin:0}
.js figure.chart svg{clip-path:inset(0 100% 0 0)}
.js figure.chart.in svg{clip-path:inset(0 0 0 0);transition:clip-path .8s var(--ease)}
.flow{background:#000;border:1px solid var(--bd);padding:10px 10px 0}
.flow{overflow:visible}
.flow .cap{margin:10px -10px 0}.flow .detail{margin:0 -10px}
.detail h4{font-family:Georgia,serif;font-weight:400;font-size:15px}
.dots button[aria-current=step]{border-color:var(--gold)}
.files{display:flex;flex-wrap:wrap;gap:8px;margin:-8px 0 22px}
.files a{padding:7px 12px;border:1px solid var(--gold);color:var(--gold);font-size:13px;border-radius:2px;text-decoration:none;white-space:nowrap}
.files a:hover{background:var(--gold);color:var(--bg)}
footer{border-top:1px solid var(--bd);padding:14px 28px;color:var(--mu);font-size:12px;text-align:center}
@media (max-width:1100px){main{padding:20px 16px}h1,h2.pt{font-size:28px}.top{padding:10px 16px;gap:12px}.cap{grid-template-columns:1fr}}
${VIZ_CSS}
@media (prefers-reduced-motion:reduce){.page,.page .va-band,.page .vp-step{animation:none}.js figure.chart svg{clip-path:none!important;transition:opacity .2s}.vp-link.on path{animation:none}}
@media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact}.top,.ctl,.dots,.files{display:none!important}.page,.page[hidden]{display:block!important;break-after:page}main{max-inline-size:none;padding:12px}.js figure.chart svg{clip-path:none}figure,.card,.kpi{break-inside:avoid}}
`;

/** Tabs, chart reveal and the process walkthrough. Plain ES2017, no dependencies; the page reads fine without it. */
export const SCRIPT = `${VIZ_SCRIPT}
(function(){
  document.documentElement.classList.add('js');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $$ = function(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function reveal(page){
    $$('figure.chart', page).forEach(function(f, i){ setTimeout(function(){ f.classList.add('in'); }, reduce ? 0 : 120 * i); });
  }
  var tabs = $$('.tab'), pages = $$('.page');
  function show(id, focus){
    tabs.forEach(function(t){ var on = t.getAttribute('aria-controls') === id; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; if (on && focus) t.focus(); });
    pages.forEach(function(p){ p.hidden = p.id !== id; if (p.id === id) reveal(p); });
    if (history.replaceState) history.replaceState(null, '', '#' + id);
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }
  tabs.forEach(function(t, i){
    t.addEventListener('click', function(){ show(t.getAttribute('aria-controls')); });
    t.addEventListener('keydown', function(e){
      var k = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (k) { e.preventDefault(); show(tabs[(i + k + tabs.length) % tabs.length].getAttribute('aria-controls'), true); }
    });
  });
  var start = location.hash && document.getElementById(location.hash.slice(1));
  if (pages.length) show(start && start.classList.contains('page') ? start.id : pages[0].id);

  var viz = window.voltViz;
  $$('.flow').forEach(function(flow){
    var data; try { data = JSON.parse(flow.getAttribute('data-steps') || '[]'); } catch (e) { return; }
    viz.flow(flow, data);
  });
  $$('figure.chart[data-spec]').forEach(function(fig){
    var spec; try { spec = JSON.parse(fig.getAttribute('data-spec')); } catch (e) { return; }
    viz.chart(fig, spec);
  });
})();
`;

/** A section title without the writer's own "2." numbering: the tab already numbers it. */
export const plain = (t: string) => t.replace(/^\s*\d+[.)]\s+/, "");
/** A tab names its section in a few words: "Findings", not the whole takeaway headline. */
export const tabLabel = (t: string) => plain(t).split(/:\s/)[0];

/** The full page. `pages` carry already-rendered, trusted HTML (the deliverable's markdown and its SVG exhibits). */
export function voltHtml(d: HtmlDeliverable): string {
  const many = d.pages.length > 1;
  const id = (i: number) => `s${i + 1}`;
  const tabs = many
    ? `<nav class="tabs" role="tablist" aria-label="Sections">${d.pages.map((p, i) => `<button class="tab" role="tab" id="t-${id(i)}" aria-controls="${id(i)}" aria-selected="${i === 0}" title="${esc(plain(p.title))}"><span>${String(i + 1).padStart(2, "0")}</span>${esc(tabLabel(p.title))}</button>`).join("")}</nav>`
    : "";
  const files = d.files?.length ? `<nav class="files" aria-label="Files">${d.files.map((f) => `<a href="${esc(f.href)}" download="${esc(f.name)}">Download ${esc(f.label)}</a>`).join("")}</nav>` : "";
  const body = d.pages
    .map((p, i) => {
      const head = i === 0 ? `<h1>${esc(d.title)}</h1>${d.subtitle ? `<p class="lede">${esc(d.subtitle)}</p>` : ""}${files}` : `<h2 class="pt">${esc(plain(p.title))}</h2>`;
      const html = referenceLayout(i === 0 ? withSoWhat(p.html) : p.html.replace(/^\s*<p>/, '<p class="lede">'));
      return `<section class="page" id="${id(i)}"${many ? ` role="tabpanel" aria-labelledby="t-${id(i)}"` : ""}${i > 0 ? " hidden" : ""}>${head}${html}</section>`;
    })
    .join("\n");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="VOLT Console">
<title>${esc(d.title)}</title>
<style>${CSS}</style></head><body>
<header class="top"><div class="brand"><span class="mark" aria-hidden="true">V</span><b>VOLT</b><small>Vision, Orchestrate, Launch, Transform</small></div>${tabs}</header>
<main>
${body}
</main>
<footer>${esc(d.title)}${d.subtitle ? ` | ${esc(d.subtitle)}` : ""} | Prepared with VOLT</footer>
<script>${SCRIPT}</script>
</body></html>
`;
}
