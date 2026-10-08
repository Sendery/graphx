/* Visor del navegador del mod graphx.
 *
 * Recibe el tablero por SSE (`/events`) y lo pinta con GraphX: el grafo (JSON de GraphX, Mermaid o
 * rutas de ficheros, más los parches que Claude va aplicando), el recorrido guiado (el `tour` del
 * propio motor), la cartelería (carteles anclados a piezas, sueltos o de un paso del recorrido) y un
 * banner. Devuelve al servidor lo que ha pintado (ids, avisos, paso actual) y una captura en SVG y
 * PNG para que Claude vea el resultado. */
(function () {
  'use strict';
  const TOKEN = new URLSearchParams(location.search).get('t') || '';
  const $ = id => document.getElementById(id);
  const stage = $('lv-stage'), host = $('lv-host'), layer = $('lv-layer'), leaders = $('lv-leaders'), boardEl = $('lv-board');
  const SVGNS = 'http://www.w3.org/2000/svg';
  const TONES = ['info', 'tip', 'ok', 'warn', 'danger', 'note'];
  const ICON = { info: 'ℹ', tip: '✦', ok: '✓', warn: '!', danger: '✕', note: '✎' };

  let inst = null;            /* la instancia de GraphX montada */
  let board = null, rev = 0;  /* el último tablero recibido */
  let mountedKey = null;      /* qué estructura está montada: si no cambia, no se vuelve a montar */
  let mounting = null;
  let viewSeq = -1, guideSeq = -1, reportedTour = null;
  let showSigns = true;
  const minimized = new Set(), seen = new Set();
  let bannerClosed = null;
  let snapT = 0;
  let version = null;
  /* el idioma: el del tablero (llega con el estado por SSE); hasta entonces, el del navegador */
  let lang = /^es\b/i.test(navigator.language || '') ? 'es' : 'en';
  let online = false;
  const tr = (es, en) => (lang === 'es' ? es : en);

  /* ---------- utilidades ---------- */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = o => JSON.parse(JSON.stringify(o));
  const md = window.GXBoard.md;
  const plain = s => String(s || '').replace(/\*\*|`|\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  const post = (path, body) => fetch(path + '?t=' + encodeURIComponent(TOKEN), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
  const tone = t => TONES.includes(t) ? t : 'info';

  /* ---------- conexión ---------- */
  function connect() {
    const dot = $('lv-dot');
    const es = new EventSource('/events?t=' + encodeURIComponent(TOKEN));
    /* un servidor nuevo (el mod se ha recargado) no tiene la captura: se le vuelve a mandar (lo pintado
       se reenvía al recibir el estado, ya con su rev); si trae otro visor, la página se recarga */
    es.addEventListener('hello', ev => {
      let v = null; try { v = JSON.parse(ev.data).version; } catch (_) { }
      if (version && v && v !== version) { location.reload(); return; }
      version = version || v;
      scheduleSnap();
    });
    es.addEventListener('state', ev => { online = true; dot.className = 'lv-dot on'; dotTitle(); try { receive(JSON.parse(ev.data)); } catch (err) { showError(err); } });
    es.onopen = () => { online = true; dot.className = 'lv-dot on'; dotTitle(); };
    es.onerror = () => { online = false; dot.className = 'lv-dot'; dotTitle(); };
  }

  const { applyPatch, buildSpec, structKey } = window.GXBoard;

  /* ---------- idioma ---------- */
  function dotTitle() {
    $('lv-dot').title = online ? tr('Conectado', 'Connected')
      : seenState ? tr('Sin conexión: la sesión de Claude Code se ha cerrado o el mod se ha recargado', 'Disconnected: the Claude Code session has ended or the mod has reloaded')
        : tr('Sin conexión', 'Disconnected');
  }
  let seenState = false;
  /* los textos fijos de la página; lo demás se vuelve a pintar con renderChrome y renderSigns */
  function applyLang() {
    document.documentElement.lang = lang;
    dotTitle();
    const sb = $('lv-signs'); sb.textContent = tr('Carteles', 'Signs'); sb.title = tr('Mostrar u ocultar los carteles (S)', 'Show or hide the signs (S)');
    $('lv-theme').title = tr('Tema claro u oscuro (T)', 'Light or dark theme (T)');
    $('lv-empty-h').textContent = tr('Lienzo en vivo', 'Live canvas');
    $('lv-empty-p').textContent = tr('Pide a Claude que dibuje algo: un diagrama de arquitectura, un flujo en Mermaid, el árbol de un repo… Aparecerá aquí al momento, con sus carteles y su recorrido.',
      'Ask Claude to draw something: an architecture diagram, a Mermaid flow, a repo tree… It shows up here right away, with its signs and its tour.');
  }
  function setLang(l) {
    if (l !== 'es' && l !== 'en') return false;
    if (l === lang) return false;
    lang = l; applyLang(); return true;
  }

  /* ---------- montaje ---------- */
  function fitHeight() {
    const el = host.firstElementChild; if (!el) return;
    const bar = el.querySelector('.gx-bar');
    const h = Math.max(240, stage.clientHeight - (bar ? bar.offsetHeight : 48) - 22);
    el.style.setProperty('--gx-h', h + 'px');
  }
  async function mount(b) {
    const { spec, warnings } = buildSpec(b);
    const prev = inst ? { expanded: [...inst.state.expanded], dir: inst.state.dir } : null;
    if (inst) { try { inst.destroy(); } catch (_) { } inst = null; }
    host.innerHTML = '';
    const el = document.createElement('div'); host.appendChild(el);
    $('lv-empty').hidden = !!(spec.nodes && spec.nodes.length);
    inst = GraphX.mount(el, spec, { lang: spec.lang || 'en' });
    fitHeight();
    await inst.ready;
    if (prev) {
      /* lo que la persona tenía abierto sigue abierto si sigue existiendo */
      const M = inst.model.M;
      prev.expanded.filter(id => M.has(id)).forEach(id => inst.state.expanded.add(id));
      await inst.setDirection(b.direction || prev.dir || inst.state.dir);
    } else if (b.direction) await inst.setDirection(b.direction);
    (inst.model.warn || []).forEach(w => warnings.push(w));
    viewSeq = -1; guideSeq = -1; reportedTour = null;
    return { spec, warnings };
  }
  let lastReport = null;
  function report(spec, warnings, err) {
    const M = inst && inst.model && inst.model.M;
    const nodes = M ? [...M.values()].filter(n => !n.isLane).slice(0, 800).map(n => ({ id: n.id, label: n.label, parent: n.parent == null ? undefined : n.parent, kind: n.kind, depth: n.depth })) : [];
    lastReport = {
      type: 'rendered', rev, ok: !err, error: err ? String(err.message || err) : undefined,
      warnings: (warnings || []).slice(0, 60), nodes, nodeCount: M ? [...M.values()].filter(n => !n.isLane).length : 0,
      edgeCount: spec && spec.edges ? spec.edges.length : 0, edges: spec && spec.edges ? spec.edges.slice(0, 400).map(e => ({ id: e.id, from: e.from, to: e.to })) : [],
      lanes: spec && spec.lanes ? spec.lanes.map(l => l.id) : [], steps: spec && spec.tour ? spec.tour.steps.length : 0, title: spec && spec.title
    };
    post('/ui-event', lastReport);
  }

  async function receive(st) {
    rev = st.rev; board = st.board;
    seenState = true;
    setLang((board && board.lang) || st.lang);
    dotTitle();
    if (!board) { if (inst) { inst.destroy(); inst = null; } host.innerHTML = ''; mountedKey = null; $('lv-empty').hidden = false; renderChrome(); renderSigns(); return; }
    const key = structKey(board);
    if (key !== mountedKey) {
      mountedKey = key;
      const job = (mounting = (async () => {
        $('lv-dot').className = 'lv-dot busy';
        try { const r = await mount(board); dataKey = JSON.stringify(board.data || null); if (job !== mounting) return; hideError(); report(r.spec, r.warnings); }
        catch (err) { if (job !== mounting) return; showError(err); report(null, [], err); }
        finally { $('lv-dot').className = 'lv-dot on'; }
      })());
      await job;
      if (job !== mounting) return;
    }
    else if (lastReport) post('/ui-event', Object.assign({}, lastReport, { rev }));
    await applyData();
    await applyGuide();
    await applyView();
    renderChrome(); renderSigns(); scheduleSnap();
  }

  /* ---------- datos en vivo: sin volver a montar, el setData del motor ---------- */
  let dataKey = null;
  async function applyData() {
    if (!inst || !board) return;
    const k = JSON.stringify(board.data || null);
    if (k === dataKey) return;
    dataKey = k;
    try { await inst.setData(board.data || {}); } catch (err) { console.warn('graphx: datos', err); }
  }

  /* ---------- recorrido y vista ---------- */
  async function applyGuide() {
    const g = board && board.guide; if (!inst || !g || g.seq == null || g.seq === guideSeq) return;
    guideSeq = g.seq;
    if (g.at >= 0 && g.at < (g.steps || []).length) { if (inst.state.tour !== g.at) await inst.goStep(g.at); }
    else if (inst.state.tour >= 0) inst.resetView();
    reportedTour = inst.state.tour;
  }
  async function applyView() {
    const v = board && board.view; if (!inst || !v || v.seq == null || v.seq === viewSeq) return;
    viewSeq = v.seq;
    const M = inst.model.M;
    try {
      if (v.reset) { inst.clearFilter(); inst.resetView(); }
      if (v.direction) await inst.setDirection(v.direction);
      if (v.depth != null) await inst.expandTo(v.depth);
      if (v.focus && v.focus.length) await inst.filter(v.focus.filter(id => M.has(id)), { label: v.label || 'Claude', key: 'claude', prune: v.prune === true });
      else if (v.focus) inst.clearFilter();
      if (v.trace && M.has(v.trace.id)) inst.trace(v.trace.id, v.trace.dir === 'down' ? 'down' : 'up');
      if (v.select && M.has(v.select)) await inst.focusNode(v.select);
      if (v.flow !== undefined) inst.showView(v.flow ? 'flow:' + v.flow : 'graph');
      if (v.owners) inst.filterOwners(v.owners);
      if (v.blast && M.has(v.blast)) inst.blast(v.blast);
      if (v.timeline != null && inst.timeline) inst.timeline.seek(v.timeline);
    } catch (err) { console.warn('graphx: vista', err); }
  }
  /* la persona también recorre: los pasos que da en el lienzo vuelven a Claude */
  setInterval(() => {
    if (!inst) return;
    const t = inst.state.tour;
    if (t !== reportedTour) { reportedTour = t; post('/ui-event', { type: 'step', step: t, rev }); renderChrome(); renderSigns(); scheduleSnap(); }
  }, 350);

  /* ---------- barra y banner ---------- */
  function renderChrome() {
    const b = board;
    $('lv-title').textContent = (b && b.title) || (inst && inst.model && inst.model.M.size ? tr('Diagrama', 'Diagram') : 'GraphX');
    document.title = ((b && b.title) ? b.title + ' · ' : '') + 'GraphX';
    const bits = [];
    if (inst) { const k = [...inst.model.M.values()].filter(n => !n.isLane).length; bits.push(tr(`${k} piezas`, `${k} node${k === 1 ? '' : 's'}`)); }
    const steps = (b && b.guide && b.guide.steps) || [];
    if (steps.length) bits.push(inst && inst.state.tour >= 0 ? tr(`paso ${inst.state.tour + 1}/${steps.length}`, `step ${inst.state.tour + 1}/${steps.length}`) : tr(`${steps.length} pasos`, `${steps.length} step${steps.length === 1 ? '' : 's'}`));
    const signs = (b && b.signs) || [];
    if (signs.length) bits.push(tr(`${signs.length} cartel${signs.length === 1 ? '' : 'es'}`, `${signs.length} sign${signs.length === 1 ? '' : 's'}`));
    bits.push(tr('Alt+clic en una pieza: preguntar a Claude', 'Alt+click a node: ask Claude'));
    $('lv-meta').textContent = b ? bits.join(' · ') : tr('esperando a Claude…', 'waiting for Claude…');
    if (b && b.theme && b.theme !== 'auto') document.documentElement.dataset.theme = b.theme;
    const bn = $('lv-banner'), ban = b && b.banner;
    const bkey = ban ? JSON.stringify(ban) : null;
    if (!ban || bannerClosed === bkey) { bn.hidden = true; return; }
    bn.hidden = false; bn.className = 'lv-banner lv-tone-' + tone(ban.tone);
    bn.style.setProperty('--c', `var(--lv-${tone(ban.tone)})`);
    bn.innerHTML = `<span class="lv-pin">${ICON[tone(ban.tone)]}</span><div>${ban.title ? `<b>${esc(ban.title)}</b> ` : ''}${md(ban.text).replace(/^<p>|<\/p>$/g, '')}</div><button type="button" class="lv-btn lv-x" title="${tr('Ocultar', 'Hide')}">✕</button>`;
    bn.querySelector('.lv-x').onclick = () => { bannerClosed = bkey; bn.hidden = true; };
    fitHeight();
  }

  /* ---------- cartelería ---------- */
  const signsNow = () => {
    if (!board || !showSigns) return [];
    const at = inst ? inst.state.tour : -1;
    return (board.signs || []).filter(s => s.step == null || s.step === at);
  };
  function nodeEl(id) {
    if (!inst) return null;
    const sel = `[data-id="${CSS.escape(id)}"]`;
    const svg = host.querySelector('.gx-stage > .gx-svg:not(.gx-seq)');
    return svg ? svg.querySelector(`.gx-node${sel}, .gx-group${sel}`) : null;
  }
  /* la pieza o, si está plegada dentro de otra, el contenedor visible más cercano */
  function anchorOf(id) {
    const M = inst && inst.model.M; if (!M || !M.has(id)) return null;
    let cur = id, hops = 0;
    while (cur != null) { const el = nodeEl(cur); if (el) return { el, id: cur, inside: hops > 0 }; cur = M.get(cur) ? M.get(cur).parent : null; hops++; }
    return null;
  }
  function signCard(s, i) {
    const t = tone(s.tone);
    const card = document.createElement('div');
    card.className = `lv-sign lv-tone-${t}${minimized.has(s.id) ? ' min' : ''}${seen.has(s.id) ? '' : ' new'}`;
    seen.add(s.id);
    card.dataset.sid = s.id;
    const pin = s.pin || String(i + 1);
    const M = inst && inst.model.M;
    const label = s.at && M && M.get(s.at) ? M.get(s.at).label : null;
    card.innerHTML = `<div class="lv-sh" title="${tr('Plegar o desplegar', 'Collapse or expand')}"><span class="lv-pin">${esc(pin)}</span><span class="lv-st">${esc(s.title || (label ? label : ICON[t] + ' ' + t))}</span></div>`
      + `<div class="lv-sb">${md(s.text)}</div>`
      + `<div class="lv-sa">${s.at ? `<button type="button" data-a="go">⌖ ${tr('Ir', 'Go')}</button>` : ''}<button type="button" data-a="ask">↩ Claude</button></div>`;
    card.querySelector('.lv-sh').onclick = () => { minimized.has(s.id) ? minimized.delete(s.id) : minimized.add(s.id); renderSigns(); };
    card.querySelector('[data-a=ask]').onclick = () => post('/ui-event', { type: 'ask', sign: s.id, node: s.at || null, label, text: plain(s.text).slice(0, 400) });
    const go = card.querySelector('[data-a=go]'); if (go) go.onclick = () => inst && inst.focusNode(s.at);
    return card;
  }
  let placed = [];
  function renderSigns() {
    layer.innerHTML = ''; boardEl.innerHTML = ''; placed = [];
    const list = signsNow();
    const free = [];
    list.forEach((s, i) => {
      const card = signCard(s, i);
      if (s.at && inst && inst.model.M.has(s.at)) { layer.appendChild(card); placed.push({ s, card }); }
      else free.push(card);
    });
    free.forEach(c => boardEl.appendChild(c));
    boardEl.hidden = !free.length;
    position();
  }
  /* coloca cada cartel junto a su pieza: prueba posiciones alrededor de ella y se queda con la que
     menos pisa otros carteles, otras piezas y los bordes; después traza la línea que los une */
  const area = (p, q) => Math.max(0, Math.min(p.r, q.r) - Math.max(p.l, q.l)) * Math.max(0, Math.min(p.b, q.b) - Math.max(p.t, q.t));
  function position() {
    while (leaders.firstChild) leaders.firstChild.remove();
    if (!placed.length || !inst) return;
    const R = stage.getBoundingClientRect();
    const W = R.width, H = R.height, GAP = 28, M = 8;
    const rel = r => ({ l: r.left - R.left, t: r.top - R.top, r: r.right - R.left, b: r.bottom - R.top });
    const svg = host.querySelector('.gx-stage > .gx-svg:not(.gx-seq)');
    /* las piezas visibles son obstáculos: solo las hojas, los contenedores se pueden cubrir un poco */
    const nodes = svg ? [...svg.querySelectorAll('.gx-node')].map(el => rel(el.getBoundingClientRect())).filter(r => r.r > 0 && r.l < W && r.b > 0 && r.t < H) : [];
    const boardR = boardEl.hidden ? null : rel(boardEl.getBoundingClientRect());
    const items = [];
    for (const it of placed) {
      const a = anchorOf(it.s.at);
      if (!a) { it.card.style.display = 'none'; continue; }
      it.card.style.display = '';
      const box = rel(a.el.getBoundingClientRect());
      items.push({ it, a, box, cw: it.card.offsetWidth, ch: it.card.offsetHeight, off: box.r < 0 || box.l > W || box.b < 0 || box.t > H });
    }
    items.sort((p, q) => (p.box.t - q.box.t) || (p.box.l - q.box.l));
    const taken = [];
    for (const x of items) {
      const { box, cw, ch } = x, cy = (box.t + box.b) / 2, cx = (box.l + box.r) / 2;
      const want = x.it.s.side && x.it.s.side !== 'auto' ? x.it.s.side : null;
      const cands = [];
      for (const d of [0, 1, -1, 2, -2, 3, 4]) {
        cands.push({ side: 'right', x: box.r + GAP, y: cy - 18 + d * (ch * 0.6 + 10) });
        cands.push({ side: 'left', x: box.l - GAP - cw, y: cy - 18 + d * (ch * 0.6 + 10) });
        cands.push({ side: 'bottom', x: cx - cw / 2 + d * (cw * 0.6 + 10), y: box.b + GAP });
        cands.push({ side: 'top', x: cx - cw / 2 + d * (cw * 0.6 + 10), y: box.t - GAP - ch });
      }
      let best = null;
      for (const c of cands) {
        const r = { l: c.x, t: c.y, r: c.x + cw, b: c.y + ch };
        let cost = Math.hypot(c.x + cw / 2 - cx, c.y + ch / 2 - cy) * 0.02 + (want && c.side !== want ? 400 : 0);
        cost += (Math.max(0, M - r.l) + Math.max(0, r.r - (W - M)) + Math.max(0, M - r.t) + Math.max(0, r.b - (H - M))) * 40;
        for (const q of taken) cost += area(r, q) * 0.5;
        for (const q of nodes) cost += area(r, q) * 0.05;
        if (boardR) cost += area(r, boardR) * 0.3;
        cost += area(r, box) * 1;
        if (!best || cost < best.cost) best = Object.assign({ cost }, c);
      }
      x.side = best.side;
      x.x = Math.min(Math.max(M, best.x), W - cw - M); x.y = Math.min(Math.max(M, best.y), H - ch - M);
      taken.push({ l: x.x - 6, t: x.y - 6, r: x.x + cw + 6, b: x.y + ch + 6 });
    }
    for (const x of items) {
      const cx = x.x, cy = x.y;
      x.it.card.style.left = cx + 'px'; x.it.card.style.top = cy + 'px';
      x.it.card.classList.toggle('far', x.off || x.a.inside);
      x.it.card.title = x.a.inside ? (lb => tr(`Dentro de «${lb}» (plegado)`, `Inside «${lb}» (collapsed)`))((inst.model.M.get(x.a.id) || {}).label || x.a.id) : '';
      /* la línea: del borde de la pieza al borde del cartel */
      const ax = x.side === 'right' ? x.box.r : x.side === 'left' ? x.box.l : Math.min(Math.max(x.box.l + 8, cx + x.cw / 2), x.box.r - 8);
      const ay = x.side === 'bottom' ? x.box.b : x.side === 'top' ? x.box.t : Math.min(Math.max(x.box.t + 8, cy + 18), x.box.b - 8);
      const bx = x.side === 'right' ? cx : x.side === 'left' ? cx + x.cw : Math.min(Math.max(cx + 14, ax), cx + x.cw - 14);
      const by = x.side === 'bottom' ? cy : x.side === 'top' ? cy + x.ch : cy + Math.min(18, x.ch / 2);
      const col = getComputedStyle(x.it.card).borderLeftColor;
      const p = document.createElementNS(SVGNS, 'path');
      const mx = (ax + bx) / 2;
      p.setAttribute('d', x.side === 'left' || x.side === 'right' ? `M${ax},${ay} C${mx},${ay} ${mx},${by} ${bx},${by}` : `M${ax},${ay} C${ax},${(ay + by) / 2} ${bx},${(ay + by) / 2} ${bx},${by}`);
      p.setAttribute('stroke', col); leaders.appendChild(p);
      const c = document.createElementNS(SVGNS, 'circle');
      c.setAttribute('cx', ax); c.setAttribute('cy', ay); c.setAttribute('r', 4.5); c.setAttribute('fill', col); leaders.appendChild(c);
    }
  }
  (function loop() { if (placed.length) position(); requestAnimationFrame(loop); })();
  window.addEventListener('resize', () => { fitHeight(); position(); });

  /* Alt+clic en una pieza: la pregunta vuelve a Claude Code con la pieza ya citada */
  host.addEventListener('pointerdown', ev => {
    if (!ev.altKey || !inst) return;
    const g = ev.target.closest && ev.target.closest('.gx-node[data-id], .gx-group[data-id]'); if (!g) return;
    ev.preventDefault(); ev.stopPropagation();
    const n = inst.model.M.get(g.dataset.id);
    post('/ui-event', { type: 'ask', node: g.dataset.id, label: n ? n.label : g.dataset.id });
    g.classList.add('lv-hot'); setTimeout(() => g.classList.remove('lv-hot'), 900);
  }, true);

  /* ---------- captura: SVG autocontenido (estilos calculados en línea) y PNG ---------- */
  const PROPS = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing', 'text-anchor', 'dominant-baseline', 'visibility', 'paint-order'];
  const OWN = ['opacity'];
  function inline(orig, copy) {
    const os = [orig, ...orig.querySelectorAll('*')], cs = [copy, ...copy.querySelectorAll('*')];
    const memo = new Map(), drop = [];
    os.forEach((o, i) => {
      const c = cs[i], st = getComputedStyle(o);
      if (st.display === 'none') { drop.push(c); return; }
      const vals = {}; PROPS.forEach(p => vals[p] = st.getPropertyValue(p));
      memo.set(o, vals);
      const par = memo.get(o.parentElement);
      const out = [];
      PROPS.forEach(p => { if (!par || par[p] !== vals[p]) out.push(`${p}:${vals[p]}`); });
      OWN.forEach(p => { const v = st.getPropertyValue(p); if (v && v !== '1') out.push(`${p}:${v}`); });
      if (out.length) c.setAttribute('style', out.join(';')); else c.removeAttribute('style');
      ['class', 'tabindex', 'role', 'aria-label', 'aria-expanded', 'data-id', 'data-more'].forEach(a => c.removeAttribute(a));
    });
    drop.forEach(c => c.remove());
  }
  function wrapText(ctx, text, width) {
    const out = [];
    for (const para of String(text).split('\n')) {
      let line = '';
      for (const w of para.split(/\s+/).filter(Boolean)) {
        const t = line ? line + ' ' + w : w;
        if (ctx.measureText(t).width > width && line) { out.push(line); line = w; } else line = t;
      }
      out.push(line);
    }
    return out;
  }
  function snapshot() {
    if (!inst || !inst.state.bbox) return;
    const svg = host.querySelector('.gx-stage > .gx-svg:not(.gx-seq)'); if (!svg) return;
    const b = inst.state.bbox, PAD = 24;
    const copy = svg.cloneNode(true);
    const world = copy.querySelector('.gx-world'); if (world) world.removeAttribute('transform');
    inline(svg, copy);
    const stageBg = getComputedStyle(host.querySelector('.gx-stage') || document.body).backgroundColor;
    const ink = getComputedStyle(document.body).color;
    const panel = getComputedStyle(document.documentElement).getPropertyValue('--lv-panel').trim() || '#fff';
    let x0 = b.x - PAD, y0 = b.y - PAD, x1 = b.x + b.w + PAD, y1 = b.y + b.h + PAD;
    /* la cartelería viaja en la captura: una columna a la derecha del grafo, con su línea a la pieza */
    const signs = signsNow(), M = inst.model.M, rects = inst.state.rects;
    const ctx = document.createElement('canvas').getContext('2d');
    const CW = 240, LH = 17;
    const g = document.createElementNS(SVGNS, 'g');
    const col = x1 + 40;
    let floor = y0, any = false;
    const items = signs.map((s, i) => {
      let id = s.at, anchor = null;
      while (id != null && M.has(id)) { if (rects && rects.get(id)) { anchor = rects.get(id); break; } id = M.get(id).parent; }
      return { s, i, anchor };
    }).sort((p, q) => (p.anchor ? p.anchor.y : -1e9) - (q.anchor ? q.anchor.y : -1e9));
    for (const { s, i, anchor } of items) {
      any = true;
      ctx.font = '600 13px system-ui, sans-serif';
      const title = s.title || (s.at && M.get(s.at) ? M.get(s.at).label : '');
      const tl = title ? wrapText(ctx, title, CW - 46) : [];
      ctx.font = '13px system-ui, sans-serif';
      const bl = wrapText(ctx, plain(s.text), CW - 22);
      const h = 14 + (tl.length + bl.length) * LH + 6;
      const y = Math.max(floor, anchor ? anchor.y + Math.min(anchor.h, 40) / 2 - 16 : floor);
      floor = y + h + 12;
      const c = getComputedStyle(document.documentElement).getPropertyValue('--lv-' + tone(s.tone)).trim();
      const card = document.createElementNS(SVGNS, 'g');
      card.innerHTML = `<rect x="${col}" y="${y}" width="${CW}" height="${h}" rx="8" fill="${panel}" stroke="${c}" stroke-opacity=".55"/><rect x="${col}" y="${y}" width="4" height="${h}" rx="2" fill="${c}"/>`
        + `<circle cx="${col + 20}" cy="${y + 17}" r="9" fill="${c}"/><text x="${col + 20}" y="${y + 21}" text-anchor="middle" font-size="11" font-weight="700" fill="#fff" font-family="system-ui, sans-serif">${esc(s.pin || i + 1)}</text>`
        + tl.map((t, k) => `<text x="${col + 36}" y="${y + 21 + k * LH}" font-size="13" font-weight="600" fill="${ink}" font-family="system-ui, sans-serif">${esc(t)}</text>`).join('')
        + bl.map((t, k) => `<text x="${col + 12}" y="${y + 21 + (tl.length + k) * LH + (tl.length ? 2 : LH)}" font-size="13" fill="${ink}" font-family="system-ui, sans-serif">${esc(t)}</text>`).join('');
      if (anchor) {
        const ax = anchor.x + anchor.w, ay = anchor.y + Math.min(anchor.h, 40) / 2, bx = col, by = y + 17, mx = (ax + bx) / 2;
        card.insertAdjacentHTML('afterbegin', `<path d="M${ax},${ay} C${mx},${ay} ${mx},${by} ${bx},${by}" fill="none" stroke="${c}" stroke-width="1.5" stroke-dasharray="4 3"/><circle cx="${ax}" cy="${ay}" r="4.5" fill="${c}"/>`);
      }
      g.appendChild(card);
    }
    if (any) { x1 = col + CW + PAD; y1 = Math.max(y1, floor + PAD); }
    /* el banner arriba, a todo lo ancho */
    const ban = board && board.banner;
    if (ban) {
      ctx.font = '13px system-ui, sans-serif';
      const lines = wrapText(ctx, (ban.title ? ban.title + ' — ' : '') + plain(ban.text), Math.max(300, x1 - x0 - 40));
      const h = 16 + lines.length * LH;
      y0 -= h + 12;
      const c = getComputedStyle(document.documentElement).getPropertyValue('--lv-' + tone(ban.tone)).trim();
      const bg = document.createElementNS(SVGNS, 'g');
      bg.innerHTML = `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${h}" fill="${c}" fill-opacity=".14" stroke="${c}" stroke-opacity=".5"/>`
        + lines.map((t, k) => `<text x="${x0 + 14}" y="${y0 + 21 + k * LH}" font-size="13" fill="${ink}" font-family="system-ui, sans-serif">${esc(t)}</text>`).join('');
      g.appendChild(bg);
    }
    const W = x1 - x0, H = y1 - y0;
    const bgRect = document.createElementNS(SVGNS, 'rect');
    bgRect.setAttribute('x', x0); bgRect.setAttribute('y', y0); bgRect.setAttribute('width', W); bgRect.setAttribute('height', H); bgRect.setAttribute('fill', stageBg);
    copy.insertBefore(bgRect, copy.firstChild);
    copy.appendChild(g);
    copy.setAttribute('xmlns', SVGNS);
    copy.setAttribute('viewBox', `${x0} ${y0} ${W} ${H}`);
    copy.setAttribute('width', Math.round(W)); copy.setAttribute('height', Math.round(H));
    copy.removeAttribute('class');
    const text = new XMLSerializer().serializeToString(copy);
    const k = Math.min(2, 2400 / Math.max(W, H));
    const img = new Image();
    const at = rev;
    img.onload = () => {
      const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(W * k)); cv.height = Math.max(1, Math.round(H * k));
      const c2 = cv.getContext('2d'); c2.fillStyle = stageBg; c2.fillRect(0, 0, cv.width, cv.height); c2.drawImage(img, 0, 0, cv.width, cv.height);
      let png = null; try { png = cv.toDataURL('image/png'); } catch (_) { }
      post('/snapshot', { rev: at, svg: text, png, w: Math.round(W), h: Math.round(H) });
    };
    img.onerror = () => post('/snapshot', { rev: at, svg: text, png: null, w: Math.round(W), h: Math.round(H) });
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text);
  }
  function scheduleSnap() { clearTimeout(snapT); snapT = setTimeout(() => { try { snapshot(); } catch (err) { console.error('graphx: captura', err); } }, 900); }

  /* ---------- errores y controles ---------- */
  function showError(err) { const e = $('lv-err'); e.hidden = false; e.textContent = tr('GraphX no ha podido pintar el tablero:\n', 'GraphX could not draw the board:\n') + String(err && err.message || err); console.error(err); }
  function hideError() { $('lv-err').hidden = true; }
  const signsBtn = $('lv-signs');
  signsBtn.onclick = () => { showSigns = !showSigns; signsBtn.setAttribute('aria-pressed', String(showSigns)); renderSigns(); };
  $('lv-theme').onclick = () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark'; renderSigns(); scheduleSnap();
  };
  document.addEventListener('keydown', ev => {
    if (ev.target.closest && ev.target.closest('input, textarea')) return;
    if (ev.key === 's' && !ev.metaKey && !ev.ctrlKey) signsBtn.click();
    if (ev.key === 't' && !ev.metaKey && !ev.ctrlKey) $('lv-theme').click();
  });
  applyLang();
  if (!window.GraphX) showError(new Error(tr('No se ha cargado /vendor/graphx.bundle.min.js: ejecuta `node mod/build.mjs` en el repo de GraphX.', 'Could not load /vendor/graphx.bundle.min.js: run `node mod/build.mjs` in the GraphX repo.')));
  else connect();
  window.__lv = { get inst() { return inst; }, get board() { return board; }, snapshot, position };
})();
