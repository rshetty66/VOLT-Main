import { CSS, SCRIPT, plain, referenceLayout, withSoWhat, type HtmlDeliverable } from "./htmlTemplate";

/**
 * The VOLT HTML slide deck: the same deliverable as the web page (src/htmlTemplate.ts), presented with reveal.js
 * (MIT, bundled, so the file works offline). Each "##" section is a 16:9 slide in the house style; lists and cards
 * build one at a time, charts draw in as their slide opens, process flows keep their walkthrough. Keys: arrows to
 * move, S for the speaker view, Esc for the overview, F for full screen; "?print-pdf" in the address prints a PDF.
 * A paragraph opening with "Notes:" becomes the slide's speaker notes instead of slide text.
 */

/** reveal.js files, passed in so this module stays a pure string builder (src/exports.ts loads them on demand). */
export interface RevealAssets {
  js: string;
  css: string;
  notes: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Inline text must not close its own <script> or <style> element. */
const inline = (s: string) => s.replace(/<\/(script|style)/gi, "<\\/$1").replace(/\/\/# sourceMappingURL=\S+/g, "");

/** "Notes:" paragraphs move into the slide's speaker notes. */
export function speakerNotes(html: string): { html: string; notes: string } {
  const notes: string[] = [];
  const rest = html.replace(/<p>(?:<strong>)?Notes?:(?:<\/strong>)?\s*([\s\S]*?)<\/p>/g, (_m, n: string) => (notes.push(n.trim()), ""));
  return { html: rest, notes: notes.join(" ") };
}

const DECK_CSS = `
html,body,.reveal-viewport{background:var(--bg);color:var(--tx)}
.reveal{font:20px/1.45 Inter,"Segoe UI",system-ui,-apple-system,Roboto,Helvetica,Arial,sans-serif;color:var(--tx);font-variant-numeric:tabular-nums}
.reveal .slides{text-align:left}
.reveal .slides>section{block-size:100%;padding:40px 56px 32px;overflow-y:auto;scrollbar-width:thin}
.reveal .slides>section.cover{display:flex!important;flex-direction:column;justify-content:center;background:radial-gradient(900px 520px at 85% 15%,#0f2a33 0,transparent 70%)}
.reveal h1,.reveal h2{font-family:Georgia,"Times New Roman",serif;font-weight:400;color:var(--tx);text-transform:none;letter-spacing:0;text-wrap:balance;margin:0}
.reveal h1{font-size:52px;line-height:1.12;max-inline-size:1000px}
.reveal h2{font-size:34px;line-height:1.2}
.reveal .head{display:flex;gap:16px;align-items:baseline;border-bottom:1px solid var(--bd);padding-bottom:12px;margin-bottom:20px}
.reveal .head .no{color:var(--gold);font-weight:700;font-size:16px;letter-spacing:.08em}
.reveal .lede{font-size:22px;color:var(--cyan);margin:16px 0 6px}
.reveal .brand{margin-bottom:26px}
.reveal .meta{color:var(--dim);font-size:14px;margin:0}
.reveal ul,.reveal ol{display:block;margin:0 0 14px;padding-inline-start:1.2em}
.reveal li{margin:0 0 8px}
.reveal li::marker{color:var(--cyan)}
.reveal strong,.reveal b{color:#fff}
.reveal table{font-size:16px}
.reveal .sowhat p{font-size:20px}
.reveal .kpi .v{font-size:44px}
.reveal .kpi .l{font-size:16px}
.reveal .card b{font-size:19px}
.reveal .card p{font-size:16px}
.reveal figure.chart,.reveal figure.arch,.reveal figure.diagram{max-inline-size:1000px}
.reveal figure svg{inline-size:100%}
.reveal .progress{color:var(--cyan);block-size:4px}
.reveal .slide-number{background:transparent;color:var(--dim);font-size:12px}
.reveal .controls{color:var(--cyan)}
@media print{.reveal .slides>section{overflow:visible}}
`;

const DECK_SCRIPT = `
(function(){
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var build = 'section.slide > ul > li, section.slide > ol > li, section.slide .cards > .card, section.slide .kgrid > .kpi';
  if (!/print-pdf/.test(location.search)) Array.prototype.forEach.call(document.querySelectorAll(build), function(el){ el.classList.add('fragment', 'fade-up'); });
  function draw(slide){ Array.prototype.forEach.call(slide.querySelectorAll('figure.chart'), function(f, i){ setTimeout(function(){ f.classList.add('in'); }, reduce ? 0 : 120 * i); }); }
  Reveal.initialize({ hash: true, width: 1280, height: 720, margin: 0.04, center: false, slideNumber: 'c/t', transition: reduce ? 'none' : 'fade',
    pdfSeparateFragments: false, plugins: [RevealNotes] });
  Reveal.on('ready', function(e){ draw(e.currentSlide); });
  Reveal.on('slidechanged', function(e){ draw(e.currentSlide); });
})();
`;

/** The full deck: a cover, then one slide per page. Pages carry trusted, already-rendered HTML, as in voltHtml. */
export function voltDeck(d: HtmlDeliverable, assets: RevealAssets): string {
  const slides = d.pages.map((p, i) => {
    const first = i === 0;
    const { html, notes } = speakerNotes(first ? withSoWhat(p.html) : p.html);
    const head = `<div class="head"><span class="no">${String(i + 1).padStart(2, "0")}</span><h2>${esc(plain(p.title))}</h2></div>`;
    return `<section class="slide">${head}${referenceLayout(html)}${notes ? `<aside class="notes">${notes}</aside>` : ""}</section>`;
  });
  const cover = `<section class="cover"><div class="brand"><span class="mark" aria-hidden="true">V</span><b>VOLT</b></div><h1>${esc(d.title)}</h1>${d.subtitle ? `<p class="lede">${esc(d.subtitle)}</p>` : ""}<p class="meta">Prepared with VOLT</p></section>`;
  return `<!doctype html>
<html lang="en" class="js"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="VOLT Console">
<title>${esc(d.title)}</title>
<style>${inline(assets.css)}</style><style>${CSS}${DECK_CSS}</style></head><body>
<div class="reveal"><div class="slides">
${[cover, ...slides].join("\n")}
</div></div>
<script>${inline(assets.js)}</script><script>${inline(assets.notes)}</script>
<script>${SCRIPT}</script><script>${DECK_SCRIPT}</script>
</body></html>
`;
}
