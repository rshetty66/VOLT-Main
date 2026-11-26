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
.reveal .slides>section{block-size:100%;padding:40px 56px 32px;overflow:hidden}
/* Measuring pass (before reveal.js starts): every slide laid out at 1280 x 720 so the fit script can paginate it. */
.measuring .reveal .slides{position:static;inline-size:1280px;block-size:auto;transform:none}
.measuring .reveal .slides>section{display:block!important;position:relative!important;inset:auto!important;inline-size:1280px;block-size:720px;transform:none!important;opacity:1!important;visibility:visible!important}
.reveal .slides>section.cover{display:flex!important;flex-direction:column;justify-content:center;background:radial-gradient(900px 520px at 85% 15%,#0f2a33 0,transparent 70%)}
.reveal h1,.reveal h2{font-family:Georgia,"Times New Roman",serif;font-weight:400;color:var(--tx);text-transform:none;letter-spacing:0;text-wrap:balance;margin:0}
.reveal h1{font-size:52px;line-height:1.12;max-inline-size:1000px}
.reveal h2{font-size:32px;line-height:1.2;max-inline-size:1080px}
.reveal .slide>p,.reveal .slide>blockquote{max-inline-size:1000px}
.reveal p.cap{font-weight:600;color:var(--mu);font-size:14px;text-transform:uppercase;letter-spacing:.08em;margin:18px 0 8px}
.reveal .head{display:flex;gap:16px;align-items:baseline;border-bottom:1px solid var(--bd);padding-bottom:12px;margin-bottom:22px}
.reveal .head .kick{display:block;font-size:13px;text-transform:uppercase;letter-spacing:.1em;color:var(--mu);font-weight:600;margin-bottom:6px}
.reveal .head .cont{color:var(--dim);font-weight:400;text-transform:none;letter-spacing:0}
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
@media print{.reveal .slides>section{overflow:hidden}}
`;

const DECK_SCRIPT = `
(function(){
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  /*
   * Fit every slide to 16:9 with no scrolling. Each slide is measured at 1280 x 720; what does not fit moves to a
   * "continued" slide after it. Lists, tables, card grids and KPI strips split between items (a table repeats its
   * header); a heading-like line (a bold paragraph such as "Exhibit 3: ...") stays with what follows it; one exhibit
   * that is taller than a whole slide is scaled down to fit instead.
   */
  var root = document.documentElement;
  root.classList.add('measuring');
  function kids(slide){ return Array.prototype.slice.call(slide.querySelector('.body').children); }
  function items(el){ return el.tagName === 'TABLE' ? Array.prototype.slice.call(el.tBodies[0] ? el.tBodies[0].rows : []) : /^(UL|OL)$/.test(el.tagName) || el.classList.contains('cards') || el.classList.contains('kgrid') ? Array.prototype.slice.call(el.children) : []; }
  function isLead(el){ return el && el.tagName === 'P' && el.children.length === 1 && el.firstElementChild.tagName === 'STRONG' && el.textContent.trim() === el.firstElementChild.textContent.trim(); }
  function shell(el){ var c = el.cloneNode(false); if (el.tagName === 'TABLE') { if (el.tHead) c.appendChild(el.tHead.cloneNode(true)); c.appendChild(document.createElement('tbody')); } if (el.tagName === 'OL') c.start = (el.start || 1) + items(el).length; return c; }
  function next(slide){
    var s = document.createElement('section'); s.className = 'slide';
    var head = slide.querySelector('.head').cloneNode(true), k = head.querySelector('.kick');
    if (!head.querySelector('.cont')) { var m = document.createElement('span'); m.className = 'cont'; m.textContent = ' (continued)'; (k || head.querySelector('h2')).appendChild(m); }
    var b = document.createElement('div'); b.className = 'body';
    s.appendChild(head); s.appendChild(b); slide.parentNode.insertBefore(s, slide.nextSibling); return s;
  }
  function bottom(el){ return el.getBoundingClientRect().bottom; }
  function fit(slide){
    for (var guard = 0; guard < 60; guard++) {
      var limit = slide.getBoundingClientRect().top + slide.clientHeight - parseFloat(getComputedStyle(slide).paddingBottom);
      var box = slide.querySelector('.body'), room = limit - box.getBoundingClientRect().top, need = box.scrollHeight;
      // A slight overflow shrinks the slide's text a little rather than leaving a near-empty continued slide.
      if (need > room && room / need >= 0.82) { box.style.zoom = (room / need).toFixed(3); return; }
      var body = kids(slide), i = 0;
      while (i < body.length && bottom(body[i]) <= limit + 1) i++;
      if (i >= body.length) return;
      var el = body[i], list = items(el), moved = null;
      if (list.length > 1) {
        var j = 0;
        while (j < list.length && bottom(list[j]) <= limit + 1) j++;
        if (j > 0 && j < list.length) {
          var part = shell(el), to = el.tagName === 'TABLE' ? part.tBodies[0] : part;
          list.slice(j).forEach(function(n){ to.appendChild(n); });
          moved = [part].concat(body.slice(i + 1));
        }
      }
      if (!moved) {
        var k = i;
        while (k > 0 && (isLead(body[k - 1]) || body[k].classList.contains('src'))) k--;
        if (k > 0) moved = body.slice(k);
        else {
          // Only lead lines (and its exhibit) sit above it, so it cannot move: shrink the tallest block by the overflow.
          var t = body.slice(0, i + 1).reduce(function(a, b){ return b.getBoundingClientRect().height > a.getBoundingClientRect().height ? b : a; });
          var th = t.getBoundingClientRect().height;
          t.style.zoom = Math.max(0.4, (th - (bottom(el) - limit)) / th).toFixed(3);
          moved = body.slice(i + 1);
          if (!moved.length) return;
        }
      }
      var ns = next(slide);
      var nb = ns.querySelector('.body');
      moved.forEach(function(n){ nb.appendChild(n); });
      slide = ns;
    }
  }
  Array.prototype.slice.call(document.querySelectorAll('.reveal .slides > section.slide')).forEach(fit);
  root.classList.remove('measuring');
  var build = '.slide .body > ul > li, .slide .body > ol > li, .slide .body > .cards > .card, .slide .kgrid > .kpi';
  if (!/print-pdf/.test(location.search)) Array.prototype.forEach.call(document.querySelectorAll(build), function(el){ el.classList.add('fragment', 'fade-up'); });
  function draw(slide){ Array.prototype.forEach.call(slide.querySelectorAll('figure.chart'), function(f, i){ setTimeout(function(){ f.classList.add('in'); }, reduce ? 0 : 120 * i); }); }
  Reveal.initialize({ hash: true, width: 1280, height: 720, margin: 0.04, center: false, slideNumber: 'c/t', transition: reduce ? 'none' : 'fade',
    pdfSeparateFragments: false, plugins: [RevealNotes] });
  Reveal.on('ready', function(e){ draw(e.currentSlide); });
  Reveal.on('slidechanged', function(e){ draw(e.currentSlide); });
})();
`;

/**
 * One section's slides: a slide per "###" subsection, so a long section never becomes one tall slide. A subsection
 * (or a section) that opens with a bold one-line paragraph takes it as the slide's headline, the action title, with
 * the section and subsection names above it as a kicker.
 */
export function sectionSlides(title: string, html: string): { kicker: string; headline: string; html: string }[] {
  const section = esc(plain(title));
  return html
    .split(/(?=<h3[\s>])/)
    .map((part) => {
      const h3 = /^<h3[^>]*>([\s\S]*?)<\/h3>\s*/.exec(part);
      const sub = h3 ? h3[1].trim() : "";
      let body = h3 ? part.slice(h3[0].length) : part;
      const lead = /^\s*<p><strong>((?:(?!<\/?strong>)[\s\S])*?)<\/strong><\/p>\s*/.exec(body);
      const headline = lead && !/^Exhibit\b/i.test(lead[1]) ? lead[1].trim() : "";
      if (headline) body = body.slice(lead![0].length);
      return headline
        ? { kicker: sub ? `${section} | ${sub}` : section, headline, html: body }
        : { kicker: sub ? section : "", headline: sub || section, html: body };
    })
    .filter((s) => s.html.trim() || s.headline !== section);
}

/** The full deck: a cover, then each section's slides. Pages carry trusted, already-rendered HTML, as in voltHtml. */
export function voltDeck(d: HtmlDeliverable, assets: RevealAssets): string {
  const slides = d.pages.flatMap((p, i) =>
    sectionSlides(p.title, i === 0 ? withSoWhat(p.html) : p.html).map((s) => {
      const { html, notes } = speakerNotes(s.html);
      const head = `<div class="head"><span class="no">${String(i + 1).padStart(2, "0")}</span><div>${s.kicker ? `<span class="kick">${s.kicker}</span>` : ""}<h2>${s.headline}</h2></div></div>`;
      return `<section class="slide">${head}<div class="body">${referenceLayout(html)}</div>${notes ? `<aside class="notes">${notes}</aside>` : ""}</section>`;
    }),
  );
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
