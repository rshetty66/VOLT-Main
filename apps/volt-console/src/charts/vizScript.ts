/**
 * Interactive charts and animated process flows, as one plain ES2017 script with no dependencies. The HTML deliverable
 * and the slide deck inline it; the console runs the same text once (installViz), so a chart or a flow behaves the
 * same in a chat answer and in a downloaded page, offline, on a locked-down desktop. It defines window.voltViz:
 *
 *   voltViz.chart(figure, spec, { render })  hover or arrow keys for a tooltip, click a legend entry to dim a series,
 *                                            click a label to focus it (or open its drill breakdown), "Data" for a table
 *   voltViz.flow(figure, steps)              Play / Next walkthrough, a token travelling along each hand-off, a lane
 *                                            focus (click a lane name), a "Pain points" filter and a detail panel
 *
 * Everything works from the SVG's data attributes (data-i, data-s on chart marks; data-step, data-lane on steps), so
 * the drawing is never redrawn here, and a page without script still reads.
 */
export const VIZ_SCRIPT = `
(function(){
  if (window.voltViz) return;
  var reduce0 = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Reduced motion, or the static view the page and deck toolbars switch on: no tokens, draws or timers that move.
  function still(){ return reduce0 || document.documentElement.classList.contains('static'); }
  var reduce = reduce0;
  var $$ = function(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function fmt(v){
    var a = Math.abs(v);
    if (a >= 1e9) return +(v / 1e9).toFixed(1) + 'B';
    if (a >= 1e6) return +(v / 1e6).toFixed(1) + 'M';
    if (a >= 1e4) return +(v / 1e3).toFixed(0) + 'K';
    return String(+v.toFixed(a < 10 ? 2 : a < 100 ? 1 : 0));
  }
  function signed(v){ return (v > 0 ? '+' : '') + fmt(v); }
  function el(tag, cls, html){ var e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; }

  function chart(fig, spec, o){
    if (!fig || !spec || fig.__vv) return;
    fig.__vv = 1;
    o = o || {};
    var top = spec, crumb = null, off = {}, focus = -1, hover = -1;
    var bar = el('div', 'vv-bar'), tip = el('div', 'vv-tip'), table = el('div', 'vv-table');
    tip.hidden = true; tip.setAttribute('role', 'status'); table.hidden = true;
    bar.innerHTML = '<span class="vv-crumb"></span><span class="vv-hint"></span><button type="button" class="vv-data" aria-expanded="false">Data</button>';
    // The tooltip lives on the body, fixed to the viewport: a scrolling or scaled (slide) container cannot clip it.
    fig.classList.add('vv'); document.body.appendChild(tip); fig.appendChild(bar); fig.appendChild(table);
    var crumbEl = bar.querySelector('.vv-crumb'), hint = bar.querySelector('.vv-hint'), dataBtn = bar.querySelector('.vv-data');
    function svg(){ return fig.querySelector('svg'); }
    function unit(){ return spec.unit ? ' ' + spec.unit : ''; }
    function drillable(i){ return !crumb && spec.drill && spec.drill[i]; }
    function colour(i, s){
      var m = fig.querySelector('.vm[data-i="' + i + '"][data-s="' + s + '"] path, .vm[data-i="' + i + '"][data-s="' + s + '"] circle, .vm[data-i="' + i + '"][data-s="' + s + '"] rect:not([fill=transparent])');
      var c = m && (m.getAttribute('fill') !== 'none' && m.getAttribute('fill') || m.getAttribute('stroke'));
      return c && c.indexOf('url(') < 0 ? c : '';
    }
    function content(i){
      var lab = spec.labels[i], u = unit(), rows = [], t = spec.type, s0 = spec.series[0].values;
      if (t === 'waterfall') {
        var n = s0.length, total = i === 0 || i === n - 1, run = 0;
        for (var k = 0; k <= i; k++) run = k === 0 || k === n - 1 ? s0[k] : run + s0[k];
        rows.push([total ? 'Total' : 'Change', total ? fmt(s0[i]) + u : signed(s0[i]) + u, colour(i, 0)]);
        if (!total) rows.push(['Running total', fmt(run) + u, '']);
      } else if (t === 'donut') {
        var sum = s0.reduce(function(a, b){ return a + b; }, 0) || 1;
        rows.push([spec.series[0].name || 'Value', fmt(s0[i]) + u, colour(i, 0)], ['Share', Math.round(s0[i] / sum * 1000) / 10 + '%', '']);
      } else if (t === 'kpi') {
        rows.push([spec.series[0].name || 'Value', fmt(s0[i]) + u, '']);
        if (spec.series[1]) { var d = s0[i] - spec.series[1].values[i]; rows.push(['vs ' + spec.series[1].name, signed(d) + u, '']); }
      } else {
        spec.series.forEach(function(s, k){ if (!off[k]) rows.push([s.name || 'Value', fmt(s.values[i]) + (k === 1 && spec.unit2 ? ' ' + spec.unit2 : u), colour(i, k)]); });
        if (t === 'stacked') rows.push(['Total', fmt(spec.series.reduce(function(a, s, k){ return a + (off[k] ? 0 : s.values[i]); }, 0)) + u, '']);
        if (spec.target && rows.length) {
          var first = spec.series[0].values[i], gap = first - spec.target.value;
          rows.push(['vs ' + (spec.target.label || 'target'), signed(gap) + u, '']);
        }
        if (t !== 'stacked' && spec.series.length === 1 && s0.length > 1) {
          var prev = i > 0 ? s0[i - 1] : null;
          if (prev !== null && t === 'line') rows.push(['vs ' + spec.labels[i - 1], signed(s0[i] - prev) + u, '']);
        }
      }
      return '<b>' + esc(lab) + '</b>' + rows.map(function(r){ return '<div><span>' + (r[2] ? '<i style="background:' + esc(r[2]) + '"></i>' : '') + esc(r[0]) + '</span><strong>' + esc(r[1]) + '</strong></div>'; }).join('') +
        (drillable(i) ? '<em>Click for the breakdown</em>' : '');
    }
    function place(x, y){
      tip.hidden = false;
      var w = tip.offsetWidth, h = tip.offsetHeight;
      var left = Math.max(4, Math.min(window.innerWidth - w - 4, x + 14)), tp = y - h - 12;
      if (tp < 4) tp = y + 18;
      tip.style.left = left + 'px'; tip.style.top = tp + 'px';
    }
    function show(i, x, y){
      hover = i;
      tip.innerHTML = content(i);
      paint();
      if (x === undefined) {
        var m = fig.querySelector('.vm[data-i="' + i + '"]') || fig.querySelector('[data-i="' + i + '"]'), b = m && m.getBoundingClientRect();
        if (b) { x = b.left + b.width / 2; y = b.top; }
      }
      place(x, y);
    }
    function hide(){ hover = -1; tip.hidden = true; paint(); }
    function paint(){
      var s = svg(); if (!s) return;
      s.classList.toggle('vv-focus', focus >= 0);
      s.classList.toggle('vv-hovering', hover >= 0 && focus < 0);
      $$('[data-i]', s).forEach(function(m){ var i = +m.getAttribute('data-i'); m.classList.toggle('vv-on', i === focus || i === hover); });
      $$('[data-s]', s).forEach(function(m){ if (!m.classList.contains('vl')) m.classList.toggle('vv-off', !!off[m.getAttribute('data-s')]); });
      $$('.vl', s).forEach(function(l){ var k = l.getAttribute('data-s'); l.classList.toggle('vv-off', !!off[k]); l.setAttribute('role', 'button'); l.setAttribute('tabindex', '0'); l.setAttribute('aria-pressed', !off[k]); });
      $$('[data-i]', s).forEach(function(m){ if (drillable(+m.getAttribute('data-i'))) m.classList.add('vv-drill'); });
      if (!s.getAttribute('tabindex')) { s.setAttribute('tabindex', '0'); s.setAttribute('aria-describedby', ''); }
    }
    function legend(k){
      off[k] = !off[k];
      // Never hide every series.
      if (spec.series.every(function(_, j){ return off[j]; })) off[k] = false;
      paint(); if (hover >= 0) tip.innerHTML = content(hover);
      if (!table.hidden) fillTable();
    }
    function fillTable(){
      var u = spec.unit ? ' (' + esc(spec.unit) + ')' : '';
      table.innerHTML = '<table><thead><tr><th scope="col">' + esc(spec.title || 'Label') + '</th>' + spec.series.map(function(s, k){ return off[k] ? '' : '<th scope="col">' + esc(s.name || 'Value') + u + '</th>'; }).join('') + '</tr></thead><tbody>' +
        spec.labels.map(function(l, i){ return '<tr><th scope="row">' + esc(l) + '</th>' + spec.series.map(function(s, k){ return off[k] ? '' : '<td>' + esc(fmt(s.values[i])) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
    }
    function setHint(){
      hint.textContent = crumb ? '' : spec.drill ? 'Click a highlighted label for its breakdown.' : spec.series.length > 1 && /bar|line|stacked|combo/.test(spec.type) ? 'Click a legend entry to hide a series.' : '';
    }
    function draw(next, label){
      var holder = svg() && svg().parentNode;
      var markup = o.render ? o.render(next) : '';
      if (!markup) { var tpl = fig.querySelector('template[data-drill="' + label + '"]'); markup = tpl ? tpl.innerHTML : ''; }
      if (!holder || !markup) return;
      if (!crumb) top.__html = holder.innerHTML;
      holder.innerHTML = markup;
      spec = next; off = {}; focus = -1; hide(); setHint();
      if (!table.hidden) fillTable();
    }
    function drill(i){
      var child = spec.drill[i];
      crumb = spec.labels[i];
      draw(child, i);
      crumbEl.innerHTML = '<button type="button" class="vv-back">Back</button> ' + esc(top.title || 'All') + ' / <b>' + esc(crumb) + '</b>';
      crumbEl.querySelector('.vv-back').addEventListener('click', back);
      crumbEl.querySelector('.vv-back').focus();
    }
    function back(){
      var holder = svg() && svg().parentNode;
      crumb = null; spec = top; off = {}; focus = -1;
      if (holder && top.__html) holder.innerHTML = top.__html;
      crumbEl.innerHTML = ''; hide(); setHint();
      if (!table.hidden) fillTable();
    }
    fig.addEventListener('pointermove', function(e){
      var m = e.target.closest && e.target.closest('[data-i]');
      if (!m || !fig.contains(m)) return hover >= 0 && hide();
      var i = +m.getAttribute('data-i');
      if (i !== hover) tip.innerHTML = content(i), hover = i, paint();
      place(e.clientX, e.clientY);
    });
    fig.addEventListener('pointerleave', hide);
    fig.addEventListener('click', function(e){
      var l = e.target.closest && e.target.closest('.vl');
      if (l) return legend(l.getAttribute('data-s'));
      var m = e.target.closest && e.target.closest('[data-i]');
      if (!m || !svg() || !svg().contains(m)) return;
      var i = +m.getAttribute('data-i');
      if (drillable(i)) return drill(i);
      focus = focus === i ? -1 : i; paint();
    });
    fig.addEventListener('keydown', function(e){
      var l = e.target.closest && e.target.closest('.vl');
      if (l && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); return legend(l.getAttribute('data-s')); }
      if (e.target !== svg()) return;
      var n = spec.labels.length;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); show(hover < 0 ? 0 : (hover + 1) % n); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); show(hover <= 0 ? n - 1 : hover - 1); }
      else if ((e.key === 'Enter' || e.key === ' ') && hover >= 0) { e.preventDefault(); if (drillable(hover)) drill(hover); else { focus = focus === hover ? -1 : hover; paint(); } }
      else if (e.key === 'Escape') { if (crumb) back(); else { focus = -1; hide(); } }
    });
    fig.addEventListener('focusout', function(e){ if (!fig.contains(e.relatedTarget)) hide(); });
    dataBtn.addEventListener('click', function(){
      table.hidden = !table.hidden;
      dataBtn.setAttribute('aria-expanded', !table.hidden);
      dataBtn.textContent = table.hidden ? 'Data' : 'Hide data';
      if (!table.hidden) fillTable();
    });
    // The console redraws the SVG while a chart animates in: keep the reader's choices on every new frame.
    if (window.MutationObserver) new MutationObserver(function(){ paint(); }).observe(fig, { childList: true, subtree: true });
    setHint(); paint();
  }

  function flow(fig, data){
    if (!fig || fig.__vv || !data || !data.length) return;
    fig.__vv = 1;
    fig.classList.add('vv-flow');
    var steps =$$('.vp-step', fig), links = $$('.vp-link', fig), lanes = $$('.vp-lane', fig);
    var cur = -1, timer = 0, lane = -1, issuesOnly = false;
    var issues = data.filter(function(s){ return s.issue; }).length;
    var cap = el('div', 'cap');
    cap.innerHTML = '<div aria-live="polite"><span class="t"></span><span class="x"></span></div>' +
      '<div class="ctl">' + (issues ? '<button type="button" class="pain" aria-pressed="false">Pain points (' + issues + ')</button>' : '') +
      '<button type="button" class="first" aria-label="First step">Start</button><button type="button" class="back" aria-label="Previous step">Back</button><button type="button" class="play">Play</button><button type="button" class="next" aria-label="Next step">Next</button></div><div class="dots" role="group" aria-label="Steps"></div>';
    var detail = el('dl', 'detail');
    fig.appendChild(cap); fig.appendChild(detail);
    var t = cap.querySelector('.t'), x = cap.querySelector('.x'), dots = cap.querySelector('.dots'), play = cap.querySelector('.play'), pain = cap.querySelector('.pain');
    t.textContent = 'Walk through the process'; x.textContent = 'Select a step, press Play, or click a lane name to focus it.';
    data.forEach(function(s, i){ var b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', 'Step ' + (i + 1) + ': ' + s.name); if (s.issue) b.className = 'iss'; b.addEventListener('click', function(){ stop(); go(i); }); dots.appendChild(b); });
    var dotEls = $$('button', dots);
    var sn = el('span', 'sn'); sn.textContent = data.length + ' steps'; dots.appendChild(sn);
    function row(k, v, cls){ return v ? '<div class="' + (cls || '') + '"><dt>' + k + '</dt><dd>' + esc(v) + '</dd></div>' : ''; }
    function filter(){
      steps.forEach(function(g){
        var dim = (lane >= 0 && +g.getAttribute('data-lane') !== lane) || (issuesOnly && !g.hasAttribute('data-issue'));
        g.classList.toggle('vp-dim', dim);
      });
      links.forEach(function(l){
        var a = steps[+l.getAttribute('data-from')], b = steps[+l.getAttribute('data-to')];
        l.classList.toggle('vp-dim', !!(a && b && a.classList.contains('vp-dim') && b.classList.contains('vp-dim')));
      });
      lanes.forEach(function(g){ g.classList.toggle('on', +g.getAttribute('data-lane') === lane); });
      fig.classList.toggle('filtered', lane >= 0 || issuesOnly);
    }
    // A token runs along each hand-off into the current step, so the reader sees the work move.
    function travel(l){
      var path = l.querySelector('path'); if (!path || still() || !path.getTotalLength) return;
      var len = path.getTotalLength(), dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('r', '6'); dot.setAttribute('class', 'vp-token');
      l.appendChild(dot);
      var t0 = 0;
      function step(now){
        if (!t0) t0 = now;
        var k = Math.min(1, (now - t0) / 900), e = 1 - Math.pow(1 - k, 3), p = path.getPointAtLength(e * len);
        dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y);
        if (k < 1) requestAnimationFrame(step); else setTimeout(function(){ if (dot.parentNode) dot.parentNode.removeChild(dot); }, 150);
      }
      requestAnimationFrame(step);
    }
    function go(i){
      var prev = cur;
      cur = Math.max(0, Math.min(data.length - 1, i));
      var s = data[cur];
      fig.classList.add('walk');
      steps.forEach(function(g, j){ g.classList.toggle('on', j === cur); g.classList.toggle('done', j < cur); });
      links.forEach(function(l){ var on = +l.getAttribute('data-to') === cur; l.classList.toggle('on', on); if (on && prev !== cur) travel(l); });
      dotEls.forEach(function(d, j){ d.classList.toggle('done', j < cur); if (j === cur) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current'); });
      sn.textContent = 'Step ' + (cur + 1) + ' / ' + data.length;
      t.textContent = (cur + 1) + '. ' + s.name; x.textContent = [s.lane, s.stage, s.system].filter(Boolean).join(' | ');
      detail.innerHTML = '<h4>' + esc(s.name) + '</h4>' + row('Owner', s.owner || s.lane) + row('Stage', s.stage) + row('System', s.system) + row('APQC PCF', s.pcf) + row('Receives', s.receives) + row('Hands off', s.handsOff) + row('Control', s.control) + row('Duration', s.duration) + row('Status', s.status) + row('Issue', s.issue, 'issue') + row('Detail', s.detail, 'wide');
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
    cap.querySelector('.first').addEventListener('click', function(){ stop(); go(0); });
    cap.querySelector('.back').addEventListener('click', function(){ stop(); go(cur - 1); });
    if (pain) pain.addEventListener('click', function(){ issuesOnly = !issuesOnly; pain.setAttribute('aria-pressed', issuesOnly); filter(); });
    lanes.forEach(function(g){
      var l = +g.getAttribute('data-lane');
      g.setAttribute('role', 'button'); g.setAttribute('tabindex', '0'); g.setAttribute('aria-label', 'Focus lane ' + (g.textContent || ''));
      function pick(){ lane = lane === l ? -1 : l; filter(); }
      g.addEventListener('click', pick);
      g.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    });
    steps.forEach(function(g){
      var i = +g.getAttribute('data-step');
      g.addEventListener('click', function(){ stop(); go(i); });
      g.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); stop(); go(i); } });
      // Hovering a step lights up its hand-offs in and out.
      function mark(on){ links.forEach(function(l){ if (+l.getAttribute('data-from') === i || +l.getAttribute('data-to') === i) l.classList.toggle('hl', on); }); }
      g.addEventListener('pointerenter', function(){ mark(true); });
      g.addEventListener('pointerleave', function(){ mark(false); });
      g.addEventListener('focus', function(){ mark(true); });
      g.addEventListener('blur', function(){ mark(false); });
    });
    fig.addEventListener('keydown', function(e){
      if (e.target.closest && e.target.closest('.tabs')) return;
      if (e.key === 'ArrowRight') { stop(); go(cur + 1); } else if (e.key === 'ArrowLeft') { stop(); go(cur - 1); }
    });
  }

  /*
   * The reference architecture, explorable and played step by step (the master prompt's 7.3 to 7.5), from the SVG's
   * data attributes: data-steps on the drawing, and on each system data-n (name), data-l (layer), data-s (status),
   * data-f (flow), data-k (chart-of-accounts layers), data-c (solution component) and data-d (its role).
   * Modes: Full, Accounting flow, Risk flow, COA layers, Solution components, each shown only when the data has it.
   * The walkthrough lights the step's systems and draws a flow from the step in which both of its ends are lit; going
   * back rebuilds the state from step 1, so it is always exact. Keys: Left, Right, Space, Home.
   */
  var COA = { thin: ['#5f8a54', 'Thin GL segment'], thick: ['#c99a2e', 'Thick sub-ledger dimension'], analytical: ['#d9cfb0', 'Analytical dimension'] };
  var GROUP = ['#2c5f6e', '#a63a02', '#8c6400', '#9c2f45', '#4f6b2f'];
  function arch(fig){
    var svg = fig.querySelector('svg.va'); if (!svg || fig.__arch) return; fig.__arch = 1;
    var json = function(a, d){ try { return JSON.parse(svg.getAttribute(a) || d); } catch (e) { return JSON.parse(d); } };
    var data = json('data-steps', '[]'), groups = json('data-groups', '[]'), ribbons = json('data-ribbons', '{}');
    var chips = $$('.va-chip', svg), flows = $$('.va-flow', svg), tags = $$('.va-tag', svg);
    var has = function(a){ return chips.some(function(c){ return c.hasAttribute(a); }); };
    var modes = [['full', 'Full architecture']];
    if (has('data-f')) modes.push(['a', 'Accounting flow'], ['r', 'Risk flow']);
    if (has('data-k')) modes.push(['k', 'COA layers']);
    if (has('data-c') && groups.length) modes.push(['c', 'Solution components']);
    if (!data.length && modes.length < 2 && !chips.some(function(c){ return c.hasAttribute('data-d'); })) return;
    fig.classList.add('va-x');
    flows.forEach(function(f){ $$('path', f).forEach(function(p){ p.setAttribute('pathLength', '1'); }); });
    var bar = el('div', 'va-modes'); bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Explore the architecture');
    if (data.length) { var pb = el('button', 'va-play'); pb.type = 'button'; pb.textContent = 'Play guided walkthrough'; bar.appendChild(pb); }
    var mbs = modes.map(function(m){ var b = el('button'); b.type = 'button'; b.textContent = m[1]; b.setAttribute('data-mode', m[0]); b.setAttribute('aria-pressed', m[0] === 'full'); bar.appendChild(b); return b; });
    var rib = el('div', 'va-ribbon'), legend = el('div', 'va-legend');
    fig.insertBefore(bar, svg); fig.insertBefore(rib, svg); fig.insertBefore(legend, svg);
    var cap = null, t, x, dots, play, sn, dotEls = [], cur = -1, timer = 0;
    if (data.length) {
      cap = el('div', 'cap', '<div><span class="t"></span><span class="x" aria-live="polite"></span></div><div class="ctl"><button type="button" class="first">Restart</button><button type="button" class="back">Back</button><button type="button" class="play">Play</button><button type="button" class="next">Next</button></div><div class="dots"></div>');
      fig.appendChild(cap);
      t = cap.querySelector('.t'); x = cap.querySelector('.x'); dots = cap.querySelector('.dots'); play = cap.querySelector('.play');
      data.forEach(function(s, i){ var b = el('button'); b.type = 'button'; b.setAttribute('aria-label', 'Step ' + (i + 1) + ': ' + s.t); b.addEventListener('click', function(){ stop(); go(i); }); dots.appendChild(b); });
      dotEls = $$('button', dots); sn = el('span', 'sn'); dots.appendChild(sn);
      // The steps as text, for the static view and print, where nothing plays.
      var ol = el('ol', 'va-list'); data.forEach(function(s){ var li = el('li'); li.innerHTML = '<b>' + esc(s.t) + '</b> ' + esc(s.x); ol.appendChild(li); }); fig.appendChild(ol);
    }
    var detail = el('dl', 'detail'); fig.appendChild(detail);
    function mode(m){
      mbs.forEach(function(b){ b.setAttribute('aria-pressed', b.getAttribute('data-mode') === m); });
      fig.setAttribute('data-mode', m);
      chips.forEach(function(c){
        var f = c.getAttribute('data-f') || '', k = c.getAttribute('data-k') || '', g = c.getAttribute('data-c');
        var on = m === 'full' || (m === 'a' || m === 'r' ? f.indexOf(m) >= 0 : m === 'k' ? !!k : m === 'c' ? !!g : true);
        c.classList.toggle('va-dim', !on);
        var rect = c.querySelector('rect');
        if (rect) rect.style.fill = m === 'c' && g ? GROUP[(+g - 1) % 5] + '55' : m === 'k' && k ? COA[k.split(' ')[0]][0] + '44' : m === 'a' && on ? '#b07a0033' : m === 'r' && on ? '#9c2f4533' : '';
      });
      var list = m === 'a' || m === 'r' ? (ribbons[m] || []) : [];
      rib.innerHTML = list.map(function(s, i){ return '<span>' + (i ? '<i aria-hidden="true">></i>' : '') + esc(s) + '</span>'; }).join('');
      rib.className = 'va-ribbon' + (list.length ? ' on ' + m : '');
      legend.innerHTML = m === 'k' ? Object.keys(COA).map(function(k){ return '<span><i style="background:' + COA[k][0] + '"></i>' + COA[k][1] + '</span>'; }).join('')
        : m === 'c' ? groups.map(function(g, i){ return '<span><i style="background:' + GROUP[i % 5] + '"></i>' + (i + 1) + ' ' + esc(g.name) + (g.platform ? ' <em>' + esc(g.platform) + '</em>' : '') + '</span>'; }).join('') : '';
    }
    mbs.forEach(function(b){ b.addEventListener('click', function(){ stop(); reset(); mode(b.getAttribute('data-mode')); }); });
    function show(c){
      var name = (c.querySelector('title') || {}).textContent || c.getAttribute('data-n');
      var k = (c.getAttribute('data-k') || '').split(' ').filter(Boolean).map(function(v){ return COA[v] ? COA[v][1] : v; }).join(', ');
      var g = c.getAttribute('data-c'), f = c.getAttribute('data-f');
      var row = function(a, b){ return b ? '<div><dt>' + a + '</dt><dd>' + esc(b) + '</dd></div>' : ''; };
      var label = $$('text', c).map(function(n){ return n.textContent; }).join(' ');
      detail.innerHTML = '<h4>' + esc(label || name) + '</h4>' + row('Layer', c.getAttribute('data-l')) + row('Status', { new: 'New', keep: 'Kept', retire: 'Retire' }[c.getAttribute('data-s')]) + row('Flow', f === 'ar' ? 'Accounting and risk' : f === 'a' ? 'Accounting and financial reporting' : f === 'r' ? 'Risk, performance and regulatory' : '') + row('Chart of accounts', k) + row('Solution component', g && groups[+g - 1] ? g + '. ' + groups[+g - 1].name + (groups[+g - 1].platform ? ' (' + groups[+g - 1].platform + ')' : '') : '') + '<div class="wide"><dt>Role</dt><dd>' + esc(c.getAttribute('data-d') || 'No role given.') + '</dd></div>';
      detail.classList.add('show');
      chips.forEach(function(o){ o.classList.toggle('va-sel', o === c); });
    }
    chips.forEach(function(c){
      c.setAttribute('tabindex', '0'); c.setAttribute('role', 'button');
      c.addEventListener('click', function(){ stop(); show(c); });
      c.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); stop(); show(c); } });
    });
    function reset(){ cur = -1; fig.classList.remove('walk'); chips.forEach(function(c){ c.classList.remove('on', 'seen'); }); flows.concat(tags).forEach(function(f){ f.classList.remove('seen', 'draw'); }); if (cap) { t.textContent = 'Guided walkthrough'; x.textContent = data.length + ' steps. Press Play, or click any system for its detail.'; sn.textContent = ''; dotEls.forEach(function(d){ d.classList.remove('done'); d.removeAttribute('aria-current'); }); } }
    function go(i){
      if (!data.length) return;
      if (i >= data.length) { stop(); reset(); x.textContent = 'Explore: click any system for its detail, or switch view.'; return; }
      var prev = cur; cur = Math.max(0, i); mode('full'); fig.classList.add('walk');
      var seen = {}, before = {};
      data.forEach(function(s, j){ if (j <= cur) s.on.forEach(function(n){ seen[n] = 1; }); if (j < cur) s.on.forEach(function(n){ before[n] = 1; }); });
      var now = {}; data[cur].on.forEach(function(n){ now[n] = 1; });
      chips.forEach(function(c){ var n = c.getAttribute('data-n'); c.classList.toggle('on', !!now[n]); c.classList.toggle('seen', !!seen[n]); });
      flows.concat(tags).forEach(function(f){
        var a = f.getAttribute('data-a'), b = f.getAttribute('data-b'), vis = !!(seen[a] && seen[b]), was = !!(before[a] && before[b]);
        f.classList.toggle('seen', vis);
        f.classList.toggle('draw', vis && !was && cur === prev + 1 && !still());
      });
      dotEls.forEach(function(d, j){ d.classList.toggle('done', j < cur); if (j === cur) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current'); });
      t.textContent = (cur + 1) + '. ' + data[cur].t; x.textContent = data[cur].x; sn.textContent = 'Step ' + (cur + 1) + ' / ' + data.length;
    }
    function stop(){ clearInterval(timer); timer = 0; if (play) play.textContent = 'Play'; }
    function toggle(){
      if (timer) return stop();
      if (cur >= data.length - 1) cur = -1;
      go(cur + 1); play.textContent = 'Pause';
      timer = setInterval(function(){ if (cur >= data.length - 1) return stop(); go(cur + 1); }, 4000);
    }
    if (cap) {
      play.addEventListener('click', toggle);
      pb.addEventListener('click', function(){ stop(); cur = -1; toggle(); });
      cap.querySelector('.next').addEventListener('click', function(){ stop(); go(cur + 1); });
      cap.querySelector('.back').addEventListener('click', function(){ stop(); if (cur > 0) go(cur - 1); else reset(); });
      cap.querySelector('.first').addEventListener('click', function(){ stop(); go(0); });
      fig.addEventListener('keydown', function(e){
        if (e.target.tagName === 'INPUT') return;
        if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); stop(); go(cur + 1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); stop(); if (cur > 0) go(cur - 1); else reset(); }
        else if (e.key === ' ' && !/BUTTON/.test(e.target.tagName)) { e.preventDefault(); e.stopPropagation(); toggle(); }
        else if (e.key === 'Home') { e.preventDefault(); e.stopPropagation(); stop(); go(0); }
      });
    }
    fig.setAttribute('tabindex', '0');
    mode('full'); reset();
  }

  /*
   * The process taxonomy, filtered and searched in place: impact buttons (High, Moderate, Limited) and a search box dim
   * every activity that does not match, and the count says how many do. Activities carry data-i (impact) and data-t.
   */
  function tax(fig){
    var svg = fig.querySelector('svg.vt'); if (!svg || fig.__tax) return; fig.__tax = 1;
    var acts = $$('.vt-act', svg), procs = $$('.vt-proc', svg); if (!acts.length) return;
    var bar = el('div', 'vt-bar', '<span class="vt-lab">Show</span><button type="button" data-i="high" aria-pressed="true">High</button><button type="button" data-i="moderate" aria-pressed="true">Moderate</button><button type="button" data-i="low" aria-pressed="true">Limited</button><input type="search" placeholder="Search activities" aria-label="Search the taxonomy"><span class="vt-n" aria-live="polite"></span>');
    fig.insertBefore(bar, svg);
    var on = { high: 1, moderate: 1, low: 1 }, q = '', n = bar.querySelector('.vt-n'), input = bar.querySelector('input');
    function apply(){
      var hit = 0;
      acts.forEach(function(a){ var ok = on[a.getAttribute('data-i')] && (!q || a.getAttribute('data-t').indexOf(q) >= 0 || (a.closest('.vt-proc') && a.closest('.vt-proc').getAttribute('data-t').indexOf(q) >= 0)); a.classList.toggle('va-dim', !ok); if (ok) hit++; });
      procs.forEach(function(p){ p.classList.toggle('va-dim', !$$('.vt-act', p).some(function(a){ return !a.classList.contains('va-dim'); }) && $$('.vt-act', p).length > 0); });
      n.textContent = hit + ' of ' + acts.length + ' activities';
    }
    $$('button', bar).forEach(function(b){ b.addEventListener('click', function(){ var i = b.getAttribute('data-i'); on[i] = on[i] ? 0 : 1; b.setAttribute('aria-pressed', !!on[i]); apply(); }); });
    input.addEventListener('input', function(){ q = input.value.trim().toLowerCase(); apply(); });
    apply();
  }

  window.voltViz = { chart: chart, flow: flow, arch: arch, tax: tax };
})();
`;

/**
 * Styles for the script above. Colours come from --vv-* tokens, which the console (styles.css) and the HTML template
 * set from their own themes.
 */
export const VIZ_CSS = `
.vv{position:relative}
.vv .vm,.vv .vs,.vv .vl{transition:opacity .2s}
.vv svg.vv-hovering .vm:not(.vv-on){opacity:.55}
.vv svg.vv-focus .vm:not(.vv-on){opacity:.22}
.vv .vm.vv-on path,.vv .vm.vv-on rect:not([fill=transparent]){filter:brightness(1.15)}
.vv .vm.vv-off,.vv .vs.vv-off{opacity:.08!important}
.vv .vl{cursor:pointer}.vv .vl.vv-off{opacity:.4}.vv .vl.vv-off text{text-decoration:line-through}
.vv .vm.vv-drill,.vv .vh.vv-drill{cursor:zoom-in}
.vv .vm.vv-drill path,.vv .vm.vv-drill rect:not([fill=transparent]){stroke:var(--vv-accent);stroke-width:1.5;stroke-dasharray:3 2}
.vv svg:focus-visible{outline:2px solid var(--vv-accent);outline-offset:2px}
.vv-tip{position:fixed;z-index:1000;pointer-events:none;min-inline-size:150px;max-inline-size:260px;padding:8px 10px;background:var(--vv-tip-bg);color:var(--vv-ink);border:1px solid var(--vv-line);border-radius:6px;box-shadow:0 6px 18px rgba(0,0,0,.28);font-size:12.5px;line-height:1.35;font-variant-numeric:tabular-nums}
.vv-tip b{display:block;margin-bottom:4px;font-size:13px}
.vv-tip div{display:flex;justify-content:space-between;gap:14px}
.vv-tip span{color:var(--vv-muted)}
.vv-tip i{display:inline-block;inline-size:9px;block-size:9px;border-radius:2px;margin-right:6px}
.vv-tip em{display:block;margin-top:5px;color:var(--vv-accent);font-style:normal;font-size:12px}
.vv-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;min-block-size:26px;font-size:12.5px;color:var(--vv-muted)}
.vv-crumb{color:var(--vv-ink)}.vv-crumb b{color:var(--vv-accent)}
.vv-hint{flex:1}
.vv-bar button{border:1px solid var(--vv-line);background:transparent;color:var(--vv-ink);padding:3px 10px;border-radius:4px;font:inherit;cursor:pointer}
.vv-bar button:hover{border-color:var(--vv-accent)}
.vv-table{overflow-x:auto}
.vv-table table{border-collapse:collapse;inline-size:100%;font-size:12.5px;font-variant-numeric:tabular-nums}
.vv-table th,.vv-table td{border-bottom:1px solid var(--vv-line);padding:5px 8px;text-align:right}
.vv-table th:first-child{text-align:left}
.vp-step{cursor:pointer;transition:opacity .25s}
.vp-step:hover .vp-card,.vp-step:focus .vp-card{stroke:var(--vv-accent);stroke-width:2}
.vp-link{transition:opacity .25s}
.vv-flow svg{inline-size:100%;block-size:auto;max-block-size:calc(100vh - 140px);min-inline-size:0!important;display:block}
.vp-link.hl path{stroke:var(--vv-accent);stroke-width:2}
.vp-lane{cursor:pointer}.vp-lane.on text{fill:var(--vv-accent)}
.walk .vp-step,.walk .vp-link{opacity:.28}
.walk .vp-step.done{opacity:.7}
.walk .vp-step.on,.walk .vp-link.on{opacity:1}
.vp-step.vp-dim,.walk .vp-step.vp-dim,.vp-link.vp-dim{opacity:.12}
.vp-step.on .vp-card{stroke:var(--vv-accent);stroke-width:2.5}
.vp-link.on path{stroke:var(--vv-accent);stroke-width:2.4;stroke-dasharray:6 5;animation:vvdash 1s linear infinite}
.vp-token{fill:var(--vv-accent);filter:drop-shadow(0 0 6px var(--vv-accent))}
@keyframes vvdash{to{stroke-dashoffset:-22}}
.cap{display:grid;grid-template-columns:1fr auto;gap:8px 16px;align-items:center;padding:10px 12px;font-size:12.5px;background:var(--vv-panel);border-top:1px solid var(--vv-line)}
.cap .t{font-weight:700;color:var(--vv-accent);margin-right:8px}
.cap .x{color:var(--vv-ink)}
.ctl{display:flex;gap:6px;flex-wrap:wrap}
.ctl button{border:1px solid var(--vv-line);background:var(--vv-tip-bg);color:var(--vv-ink);padding:4px 9px;font-size:12px;min-inline-size:34px;border-radius:4px;cursor:pointer}
.ctl button:hover{border-color:var(--vv-muted)}
.ctl .play{background:var(--vv-accent);border-color:var(--vv-accent);color:var(--vv-on-accent);font-weight:700;min-inline-size:78px}
.ctl .pain[aria-pressed=true]{border-color:var(--vv-bad);color:var(--vv-bad)}
.dots{grid-column:1/-1;display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.dots button{inline-size:13px;block-size:13px;padding:0;border-radius:50%;background:var(--vv-line);border:1px solid var(--vv-muted);cursor:pointer}
.dots button.iss{border-color:var(--vv-bad)}
.dots button.done{background:var(--vv-accent);opacity:.55}
.dots button[aria-current=step]{background:var(--vv-accent);opacity:1}
.sn{font-size:12px;color:var(--vv-muted);margin-left:6px}
.detail{display:none;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px 18px;margin:0;padding:14px;background:var(--vv-panel);border-top:1px solid var(--vv-line)}
.detail.show{display:grid}
.detail{font-size:12.5px}.detail h4{grid-column:1/-1;margin:0;font-family:inherit;color:var(--vv-ink);font-weight:600;font-size:14px}
.detail dt{color:var(--vv-muted);font-size:11.5px;text-transform:uppercase;letter-spacing:.08em}
.detail dd{margin:2px 0 0;color:var(--vv-ink)}
.detail .issue dd{color:var(--vv-bad);font-weight:600}
.detail .wide{grid-column:1/-1}
@media (max-width:700px){.cap{grid-template-columns:1fr}}
@media (prefers-reduced-motion:reduce){.vp-link.on path{animation:none}.vv .vm,.vv .vs,.vp-step{transition:none}}
@media print{.vv-bar,.vv-tip,.ctl,.dots{display:none!important}}
.va-x{position:relative}
.va-modes{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}
.va-modes button,.vt-bar button{border:1px solid var(--vv-line);background:var(--vv-tip-bg);color:var(--vv-ink);padding:4px 10px;font-size:12px;border-radius:4px;cursor:pointer}
.va-modes button[aria-pressed=true]{background:var(--vv-accent);border-color:var(--vv-accent);color:var(--vv-on-accent);font-weight:700}
.va-modes .va-play{border-color:var(--vv-accent);color:var(--vv-accent);font-weight:700}
.va-ribbon{display:none;flex-wrap:wrap;gap:4px;margin:0 0 8px;font-size:12px}
.va-ribbon.on{display:flex}
.va-ribbon span{padding:3px 8px;border-radius:3px;background:#b07a0033;color:var(--vv-ink)}
.va-ribbon.r span{background:#9c2f4533}
.va-ribbon i{font-style:normal;color:var(--vv-muted);margin:0 6px 0 0}
.va-legend{display:flex;flex-wrap:wrap;gap:12px;font-size:12px;color:var(--vv-ink);margin:0 0 6px}
.va-legend:empty{display:none}
.va-legend i{display:inline-block;inline-size:11px;block-size:9px;border-radius:2px;margin-right:6px}
.va-legend em{color:var(--vv-muted);font-style:normal}
.va-chip{cursor:pointer;transition:opacity .3s}
.va-chip:hover rect:first-child,.va-chip:focus rect:first-child,.va-chip.va-sel rect:first-child{stroke:var(--vv-accent);stroke-width:2.2}
.va-chip.va-dim,.vt-act.va-dim,.vt-proc.va-dim{opacity:.18}
.walk .va-chip{opacity:.18}.walk .va-chip.seen{opacity:.5}.walk .va-chip.on{opacity:1}
.walk .va-chip.on rect:first-child{stroke:var(--vv-accent);stroke-width:2.6}
.walk .va-flow,.walk .va-tag{opacity:0;transition:opacity .3s}.walk .va-flow.seen,.walk .va-tag.seen{opacity:1}
.va-flow.draw path{stroke-dasharray:1;stroke-dashoffset:1;animation:vadraw .6s ease-out forwards}
@keyframes vadraw{to{stroke-dashoffset:0}}
.va-x ol.va-list{display:none;margin:8px 0 0;padding-inline-start:1.4em;font-size:12.5px;color:var(--vv-ink);columns:2;column-gap:28px}
.va-x ol.va-list li{margin:0 0 4px;break-inside:avoid}
.vt-bar{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:0 0 8px;font-size:12px;color:var(--vv-muted)}
.vt-bar button[aria-pressed=false]{opacity:.45;text-decoration:line-through}
.vt-bar input{background:var(--vv-tip-bg);border:1px solid var(--vv-line);color:var(--vv-ink);border-radius:4px;padding:4px 8px;font:inherit;min-inline-size:180px}
.vt-act,.vt-proc{transition:opacity .2s}
.static .va-x ol.va-list{display:block}
.static .va-modes .va-play,.static .va-x .cap{display:none}
@media print{.va-modes,.vt-bar,.va-x .cap{display:none!important}.va-x ol.va-list{display:block}}
@media (prefers-reduced-motion:reduce){.va-flow.draw path{animation:none;stroke-dasharray:none}.va-chip,.walk .va-flow{transition:none}}
`;

declare global {
  interface Window {
    voltViz?: {
      chart(fig: HTMLElement, spec: unknown, o?: { render?: (spec: unknown) => string }): void;
      flow(fig: HTMLElement, steps: unknown[]): void;
      arch(fig: HTMLElement): void;
      tax(fig: HTMLElement): void;
    };
  }
}

/** Runs the script and adds its styles once in the console, so chat answers get the same behaviour as the HTML page. */
export function installViz(): NonNullable<Window["voltViz"]> | undefined {
  if (typeof window === "undefined") return undefined;
  if (!window.voltViz) {
    new Function(VIZ_SCRIPT)();
    const style = document.createElement("style");
    style.dataset.voltViz = "";
    style.textContent = VIZ_CSS;
    document.head.appendChild(style);
  }
  return window.voltViz;
}
