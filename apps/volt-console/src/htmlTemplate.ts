import { toneFor } from "../shared/brand";

/**
 * The VOLT HTML deliverable: one self-contained, offline page in the house style. A sticky header carries the VOLT
 * mark and a numbered tab per section; the first page opens with the title and the answer in a "So what" panel; charts
 * reveal as their page opens; process flows are interactive (select a step for its detail, or play the walkthrough).
 * Everything prints, one section per page. No external fonts, scripts or images.
 *
 * Design follows the Impeccable skill (.claude/skills/impeccable): colour on meaning only, one authored motion per
 * exhibit with a reduced-motion path, content visible before any script runs, AA contrast, themed focus and selection.
 */

export interface HtmlPage {
  title: string;
  html: string;
}

export interface HtmlDeliverable {
  title: string;
  subtitle?: string;
  pages: HtmlPage[];
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

/** The answer first: the summary page's opening paragraph becomes the "So what" panel. */
function withSoWhat(html: string): string {
  return html.replace(/^\s*<p>([\s\S]*?)<\/p>/, (_m, p: string) => `<aside class="sowhat" aria-label="So what"><b>So what</b><p>${p}</p></aside>`);
}

const CSS = `
:root{--bg:#0a0d14;--p1:#1a1e2e;--p2:#22283b;--p3:#2a3148;--bd:#323a55;--tx:#eef1f7;--mu:#b3bad0;--dim:#8e96ae;
--cyan:#00e5ff;--gold:#d4af37;--orange:#ff5722;--good:#2fd49a;--ease:cubic-bezier(.16,1,.3,1)}
*{box-sizing:border-box}
html{color-scheme:dark}
body{margin:0;background:var(--bg);color:var(--tx);font:15px/1.55 Inter,"Segoe UI",system-ui,-apple-system,Roboto,Helvetica,Arial,sans-serif;font-variant-numeric:tabular-nums}
::selection{background:var(--cyan);color:var(--bg)}
a{color:var(--cyan);text-underline-offset:3px}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;padding:0}
:focus-visible{outline:2px solid var(--cyan);outline-offset:2px}
.top{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:28px;padding:10px 28px;background:#06080d;border-bottom:1px solid var(--bd);flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:10px;white-space:nowrap}
.mark{inline-size:22px;block-size:22px;border-radius:5px;background:var(--cyan);display:grid;place-items:center;color:var(--bg);font-weight:800;font-size:13px}
.brand b{letter-spacing:.08em}
.brand small{color:var(--dim);font-size:12px}
.tabs{display:flex;gap:6px;flex-wrap:wrap}
.tab{padding:7px 14px;border:1px solid var(--bd);background:var(--p1);color:var(--mu);font-size:13px;border-radius:6px;transition:background .15s,color .15s}
.tab span{font-weight:700;margin-right:8px;color:var(--gold)}
.tab:hover{color:var(--tx)}
.tab[aria-selected=true]{background:var(--cyan);border-color:var(--cyan);color:var(--bg)}
.tab[aria-selected=true] span{color:var(--bg)}
main{max-inline-size:1240px;margin:0 auto;padding:32px 28px 48px}
h1{font-family:Georgia,"Times New Roman",serif;font-weight:400;font-size:36px;line-height:1.18;margin:0 0 10px;max-inline-size:1000px;text-wrap:balance}
.lede{color:var(--mu);font-size:16px;margin:0 0 24px}
h2.pt{font-family:Georgia,serif;font-weight:400;font-size:28px;margin:0 0 18px;text-wrap:balance}
h3{font-size:17px;margin:30px 0 10px}
h4{font-size:15px;margin:22px 0 8px;color:var(--mu)}
p,li{max-inline-size:78ch}
.page{animation:in .35s var(--ease)}
@keyframes in{from{opacity:0;transform:translateY(6px)}}
.sowhat{background:#0f2a33;border:1px solid #1d5866;border-radius:10px;padding:16px 20px;margin:0 0 26px;max-inline-size:1000px}
.sowhat b{display:block;color:var(--cyan);font-size:13px;margin-bottom:4px}
.sowhat p{margin:0;font-size:16.5px;max-inline-size:none}
table{border-collapse:collapse;inline-size:100%;margin:14px 0 18px;font-size:14px;background:var(--p1);border-radius:8px;overflow:hidden}
th,td{border-bottom:1px solid var(--bd);padding:8px 11px;text-align:left;vertical-align:top}
th{background:var(--p3);color:var(--tx);font-weight:600}
tr:last-child td{border-bottom:0}
.tone{display:inline-block;padding:1px 9px;border-radius:999px;font-weight:600;font-size:13px}
.tone.high{background:#ff5722;color:#0a0d14}.tone.mid{background:#d4af37;color:#0a0d14}.tone.low{background:#00e5ff;color:#0a0d14}
code{font-family:ui-monospace,Menlo,Consolas,monospace;background:var(--p2);padding:1px 5px;border-radius:4px;font-size:.92em}
pre{background:var(--p1);padding:14px;border-radius:8px;overflow:auto}pre code{background:none;padding:0}
blockquote{margin:14px 0;padding:10px 14px;background:var(--p1);border:1px solid var(--bd);border-radius:8px;color:var(--mu)}
figure{margin:18px 0;overflow-x:auto}
figure svg{max-inline-size:100%;block-size:auto;display:block}
.js figure.chart svg{clip-path:inset(0 100% 0 0)}
.js figure.chart.in svg{clip-path:inset(0 0 0 0);transition:clip-path .8s var(--ease)}
.flow{background:var(--p1);border:1px solid var(--bd);border-radius:10px;padding:8px}
.flow svg{border-radius:8px;min-inline-size:760px}
.vp-step{cursor:pointer;transition:opacity .25s}
.vp-step:hover .vp-card,.vp-step:focus .vp-card{stroke:var(--cyan);stroke-width:2}
.vp-link{transition:opacity .25s}
.flow.walk .vp-step,.flow.walk .vp-link{opacity:.28}
.flow.walk .vp-step.done{opacity:.7}
.flow.walk .vp-step.on,.flow.walk .vp-link.on{opacity:1}
.vp-step.on .vp-card{stroke:var(--cyan);stroke-width:2.5}
.vp-link.on path{stroke:var(--cyan);stroke-width:2.4;stroke-dasharray:6 5;animation:flowdash 1s linear infinite}
@keyframes flowdash{to{stroke-dashoffset:-22}}
.cap{display:grid;grid-template-columns:1fr auto;gap:10px 18px;align-items:center;padding:12px 10px 4px}
.cap .t{font-weight:700;color:var(--cyan);margin-right:8px}
.cap .x{color:var(--mu)}
.ctl{display:flex;gap:6px}
.ctl button{border:1px solid var(--bd);background:var(--p2);padding:6px 12px;border-radius:6px;font-size:13px}
.ctl button:hover{border-color:var(--mu)}
.ctl .play{background:var(--cyan);border-color:var(--cyan);color:var(--bg);font-weight:700;min-inline-size:76px}
.dots{grid-column:1/-1;display:flex;gap:6px;flex-wrap:wrap}
.dots button{inline-size:12px;block-size:12px;border-radius:50%;background:var(--p3);border:1px solid var(--bd)}
.dots button.done{background:#0b6f7d;border-color:#0b6f7d}
.dots button[aria-current=step]{background:var(--cyan);border-color:var(--cyan)}
.detail{display:none;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px 18px;margin:8px 10px 6px;padding:14px;background:var(--p2);border:1px solid var(--bd);border-radius:8px}
.detail.show{display:grid}
.detail h4{grid-column:1/-1;margin:0;color:var(--tx);font-size:16px}
.detail dt{color:var(--dim);font-size:12px}
.detail dd{margin:2px 0 0}
.detail .issue dd{color:#ff8a65;font-weight:600}
.detail .wide{grid-column:1/-1}
footer{border-top:1px solid var(--bd);padding:14px 28px;color:var(--dim);font-size:12px;text-align:center}
@media (max-width:900px){main{padding:22px 16px}h1{font-size:28px}.top{padding:10px 16px;gap:12px}.cap{grid-template-columns:1fr}}
@media (prefers-reduced-motion:reduce){.page{animation:none}.js figure.chart svg{clip-path:none!important;transition:opacity .2s}.vp-link.on path{animation:none}}
@media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact}.top,.ctl,.dots{display:none!important}.page,.page[hidden]{display:block!important;break-after:page}main{max-inline-size:none;padding:12px}.js figure.chart svg{clip-path:none}figure{break-inside:avoid}}
`;

/** Tabs, chart reveal and the process walkthrough. Plain ES2017, no dependencies; the page reads fine without it. */
const SCRIPT = `
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

  $$('.flow').forEach(function(flow){
    var data; try { data = JSON.parse(flow.getAttribute('data-steps') || '[]'); } catch (e) { return; }
    if (!data.length) return;
    var steps = $$('.vp-step', flow), links = $$('.vp-link', flow);
    var cur = -1, timer = 0;
    var cap = document.createElement('div'); cap.className = 'cap';
    cap.innerHTML = '<div aria-live="polite"><span class="t"></span><span class="x"></span></div>' +
      '<div class="ctl"><button type="button" class="back" aria-label="Previous step">Back</button><button type="button" class="play">Play</button><button type="button" class="next" aria-label="Next step">Next</button></div><div class="dots" role="group" aria-label="Steps"></div>';
    var detail = document.createElement('dl'); detail.className = 'detail';
    flow.appendChild(cap); flow.appendChild(detail);
    var t = cap.querySelector('.t'), x = cap.querySelector('.x'), dots = cap.querySelector('.dots'), play = cap.querySelector('.play');
    t.textContent = 'Walk through the process'; x.textContent = 'Select a step, or press Play.';
    data.forEach(function(s, i){ var b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', 'Step ' + (i + 1) + ': ' + s.name); b.addEventListener('click', function(){ stop(); go(i); }); dots.appendChild(b); });
    var dotEls = $$('button', dots);
    function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
    function row(k, v, cls){ return v ? '<div class="' + (cls || '') + '"><dt>' + k + '</dt><dd>' + esc(v) + '</dd></div>' : ''; }
    function go(i){
      cur = Math.max(0, Math.min(data.length - 1, i));
      var s = data[cur];
      flow.classList.add('walk');
      steps.forEach(function(g, j){ g.classList.toggle('on', j === cur); g.classList.toggle('done', j < cur); });
      links.forEach(function(l){ l.classList.toggle('on', +l.getAttribute('data-to') === cur); });
      dotEls.forEach(function(d, j){ d.classList.toggle('done', j < cur); if (j === cur) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current'); });
      t.textContent = (cur + 1) + '. ' + s.name; x.textContent = [s.lane, s.stage, s.system].filter(Boolean).join(' | ');
      detail.innerHTML = '<h4>' + esc(s.name) + '</h4>' + row('Owner', s.owner || s.lane) + row('Stage', s.stage) + row('System', s.system) + row('Control', s.control) + row('Duration', s.duration) + row('Status', s.status) + row('Issue', s.issue, 'issue') + row('Detail', s.detail, 'wide');
      detail.classList.add('show');
    }
    function stop(){ clearInterval(timer); timer = 0; play.textContent = 'Play'; }
    function toggle(){
      if (timer) return stop();
      if (cur >= data.length - 1) cur = -1;
      go(cur + 1); play.textContent = 'Pause';
      timer = setInterval(function(){ if (cur >= data.length - 1) return stop(); go(cur + 1); }, reduce ? 3200 : 2200);
    }
    play.addEventListener('click', toggle);
    cap.querySelector('.next').addEventListener('click', function(){ stop(); go(cur + 1); });
    cap.querySelector('.back').addEventListener('click', function(){ stop(); go(cur - 1); });
    steps.forEach(function(g){
      var i = +g.getAttribute('data-step');
      g.addEventListener('click', function(){ stop(); go(i); });
      g.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); stop(); go(i); } });
    });
    flow.addEventListener('keydown', function(e){
      if (e.target.closest && e.target.closest('.tabs')) return;
      if (e.key === 'ArrowRight') { stop(); go(cur + 1); } else if (e.key === 'ArrowLeft') { stop(); go(cur - 1); }
    });
  });
})();
`;

/** The full page. `pages` carry already-rendered, trusted HTML (the deliverable's markdown and its SVG exhibits). */
export function voltHtml(d: HtmlDeliverable): string {
  const many = d.pages.length > 1;
  const id = (i: number) => `s${i + 1}`;
  const tabs = many
    ? `<nav class="tabs" role="tablist" aria-label="Sections">${d.pages.map((p, i) => `<button class="tab" role="tab" id="t-${id(i)}" aria-controls="${id(i)}" aria-selected="${i === 0}"><span>${String(i + 1).padStart(2, "0")}</span>${esc(p.title)}</button>`).join("")}</nav>`
    : "";
  const body = d.pages
    .map((p, i) => {
      const head = i === 0 ? `<h1>${esc(d.title)}</h1>${d.subtitle ? `<p class="lede">${esc(d.subtitle)}</p>` : ""}` : `<h2 class="pt">${esc(p.title)}</h2>`;
      const html = i === 0 ? withSoWhat(p.html) : p.html;
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
