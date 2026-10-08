/* GraphX Atlas: el mismo sistema visto desde varias preguntas (perspectivas), con las piezas compartidas.
 *
 *   GraphXAtlas.mount(el, atlas, { lang: 'es' | 'en', height: 760, hash: true })
 *
 * `atlas` = { title, summary, owners, entities: { id: { label, kind, owner, path, summary, inner, doc } },
 *             perspectives: [{ id, title, short, icon, question, parent?, kind?: 'sequence', after?: { blast },
 *                              spec | mermaid (+ fx) }] }
 * Cada perspectiva es un spec de GraphX (o un Mermaid): sus piezas que nombran una entidad heredan su nombre,
 * icono, equipo y resumen, y la ficha de la entidad dice en qué otras perspectivas aparece. `inner` en una entidad
 * apunta a la perspectiva que la abre «por dentro»; `doc` = { context, constraints[], risks[],
 * todo[{ text, done }] }. Necesita el motor (GraphX con ELK) ya cargado. Sin dependencias. */
(function (global) {
  'use strict';
  const T = {
    es: {
      perspectives: 'Perspectivas', inner: 'Por dentro', search: '¿Dónde aparece…?', nothing: 'Nada con ese nombre.',
      keys: n => `<kbd>1</kbd>–<kbd>${n}</kbd> perspectiva<br><kbd>/</kbd> buscar · <kbd>⌫</kbd> subir de nivel`, atlas: 'Atlas',
      insideOf: x => `dentro de ${x}`, inN: (a, b) => `en ${a} de ${b} perspectivas`, appearsIn: 'Aparece en', openInner: 'Por dentro ▸',
      blast: '✺ Simular caída', context: 'Contexto', constraints: 'Restricciones', risks: '⚠ Riesgos', todo: 'Pendiente',
      onlyHere: 'solo en esta perspectiva', notAtlas: x => `No es una pieza del atlas: vive solo en «${x}».`,
      persp: 'perspectiva', persInner: ' · por dentro', teams: 'Equipos', risky: '⚠ Con riesgos anotados', pieces: 'Piezas',
      leadMany: (t, n, p) => `${t} piezas, ${n} de ellas del atlas (las que se repiten en otras perspectivas llevan ×N)${p ? `. Es el interior de «${p}»` : ''}.`,
      leadNone: (t, p) => `${t} elementos propios de este detalle${p ? ` de «${p}»` : ''}: no son piezas del atlas, así que no salen en otras perspectivas.`,
      back: x => `↑ Volver a «${x}»`, hint: 'Pulsa una pieza: su ficha dice en qué otras perspectivas aparece, qué la condiciona y qué preocupa de ella.',
      facts: ['perspectivas', 'por dentro', 'piezas', 'equipos'], constLabel: 'Perspectivas en las que aparece', loading: 'Preparando…'
    },
    en: {
      perspectives: 'Perspectives', inner: 'Inside', search: 'Where does … appear?', nothing: 'Nothing by that name.',
      keys: n => `<kbd>1</kbd>–<kbd>${n}</kbd> perspective<br><kbd>/</kbd> search · <kbd>⌫</kbd> go up a level`, atlas: 'Atlas',
      insideOf: x => `inside ${x}`, inN: (a, b) => `in ${a} of ${b} perspectives`, appearsIn: 'Appears in', openInner: 'Look inside ▸',
      blast: '✺ Simulate failure', context: 'Context', constraints: 'Constraints', risks: '⚠ Risks', todo: 'To do',
      onlyHere: 'only in this perspective', notAtlas: x => `Not an atlas node: it only lives in “${x}”.`,
      persp: 'perspective', persInner: ' · inside', teams: 'Teams', risky: '⚠ With noted risks', pieces: 'Nodes',
      leadMany: (t, n, p) => `${t} nodes, ${n} of them from the atlas (those repeated in other perspectives carry ×N)${p ? `. It is the inside of “${p}”` : ''}.`,
      leadNone: (t, p) => `${t} elements of their own${p ? ` inside “${p}”` : ''}: they are not atlas nodes, so they don't show up in other perspectives.`,
      back: x => `↑ Back to “${x}”`, hint: 'Pick a node: its card says which other perspectives it appears in, what constrains it and what worries us about it.',
      facts: ['perspectives', 'inside views', 'nodes', 'teams'], constLabel: 'Perspectives it appears in', loading: 'Preparing…'
    }
  };

  const CSS = `
.gxa { container-type: inline-size; --a-bg: var(--bg, #f3f6f6); --a-s2: var(--surface-2, #e9efef); --a-panel: var(--panel, #fff); --a-ink: var(--ink, #142120);
  --a-muted: var(--muted, #4f605e); --a-line: var(--hairline, #d3dcdb); --a-acc: var(--accent-ink, #0b7480); --a-wash: var(--accent-wash, rgba(11,116,128,.1));
  --a-sig: var(--signal, #b45309); --a-good: #15803d; --a-mono: var(--f-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  --a-disp: var(--f-display, system-ui, sans-serif); color: var(--a-ink); font-family: var(--f-body, system-ui, sans-serif); font-size: 15px; line-height: 1.55; }
.gxa *, .gxa *::before { box-sizing: border-box; }
.gxa p { margin: 0; }
.gxa button { font: inherit; color: inherit; }
.gxa-top { display: flex; flex-wrap: wrap; gap: 10px 32px; align-items: end; justify-content: space-between; margin-bottom: 14px; }
.gxa-top h2 { font: 800 clamp(24px, 3vw, 36px)/1.02 var(--a-disp); letter-spacing: -.03em; margin: 0; }
.gxa-top h2 em { font-style: normal; color: var(--a-acc); }
.gxa-lede { color: var(--a-muted); max-width: 70ch; margin-top: 6px !important; }
.gxa-facts { display: flex; gap: 22px; list-style: none; margin: 0; padding: 0; }
.gxa-facts li { display: flex; flex-direction: column; }
.gxa-facts b { font: 600 22px/1.1 var(--a-mono); letter-spacing: -.02em; }
.gxa-facts span { font-size: 12.5px; color: var(--a-muted); }
.gxa-grid { display: grid; grid-template-columns: 232px minmax(0, 1fr) 300px; gap: 14px; height: var(--gxa-h, 760px); }
.gxa-card { background: var(--a-panel); border: 1px solid var(--a-line); border-radius: 16px; min-height: 0; }
.gxa-rail { display: flex; flex-direction: column; gap: 8px; padding: 12px; overflow: auto; }
.gxa-search { display: flex; align-items: center; gap: 8px; border: 1px solid var(--a-line); border-radius: 10px; padding: 7px 10px; background: var(--a-s2); }
.gxa-search input { border: 0; background: transparent; color: var(--a-ink); font: inherit; width: 100%; outline: none; }
.gxa-results { display: flex; flex-direction: column; gap: 4px; }
.gxa-results:empty { display: none; }
.gxa-res { text-align: left; border: 1px solid var(--a-line); border-radius: 10px; background: var(--a-panel); padding: 7px 9px; cursor: pointer; display: flex; flex-direction: column; gap: 3px; }
.gxa-res:hover { border-color: var(--a-acc); }
.gxa-res b { font-weight: 600; font-size: 13.5px; }
.gxa-res span { font-size: 11.5px; color: var(--a-muted); }
.gxa-h { font: 600 10.5px/1 var(--a-mono); letter-spacing: .14em; text-transform: uppercase; color: var(--a-muted); margin: 8px 4px 2px; }
.gxa-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; position: relative; }
.gxa-ind { position: absolute; left: 0; width: 3px; border-radius: 3px; background: var(--a-acc); transition: top .35s cubic-bezier(.2,.8,.2,1), height .35s cubic-bezier(.2,.8,.2,1), opacity .2s; pointer-events: none; }
.gxa-p { width: 100%; text-align: left; display: grid; grid-template-columns: 26px 1fr auto; gap: 2px 8px; align-items: center; padding: 8px 9px 8px 12px; border: 0; border-radius: 10px; background: transparent; cursor: pointer; }
.gxa-p:hover { background: var(--a-s2); }
.gxa-p[aria-current="true"] { background: var(--a-wash); }
.gxa-p .ic { grid-row: span 2; width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; background: var(--a-s2); color: var(--a-acc); font-size: 14px; }
.gxa-p[aria-current="true"] .ic { background: var(--a-acc); color: var(--a-panel); }
.gxa-p b { font-weight: 600; font-size: 13.5px; line-height: 1.2; }
.gxa-p small { grid-column: 2; color: var(--a-muted); font-size: 11.5px; line-height: 1.3; }
.gxa-p .n { grid-row: 1; grid-column: 3; font: 600 11px var(--a-mono); color: var(--a-muted); }
.gxa-p.lit { box-shadow: inset 0 0 0 1px var(--a-acc); }
.gxa-keys { margin-top: auto; font-size: 11px; color: var(--a-muted); line-height: 1.8; padding: 4px; }
.gxa-keys kbd { font: 600 10.5px var(--a-mono); border: 1px solid var(--a-line); border-bottom-width: 2px; border-radius: 5px; padding: 0 5px; background: var(--a-s2); }
.gxa-main { display: flex; flex-direction: column; overflow: hidden; }
.gxa-head { display: flex; flex-direction: column; gap: 4px; padding: 12px 16px 10px; border-bottom: 1px solid var(--a-line); }
.gxa-crumbs { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; font: 500 12px var(--a-mono); color: var(--a-muted); }
.gxa-crumbs button { border: 0; background: none; padding: 2px 4px; border-radius: 6px; cursor: pointer; color: var(--a-muted); }
.gxa-crumbs button:hover { color: var(--a-acc); background: var(--a-wash); }
.gxa-crumbs [aria-current="true"] { color: var(--a-ink); }
.gxa-q { font: 700 clamp(17px, 1.8vw, 22px)/1.15 var(--a-disp); letter-spacing: -.015em; }
.gxa-stage { position: relative; flex: 1; min-height: 0; }
.gxa-layer { position: absolute; inset: 0; opacity: 0; transform: scale(.985); filter: blur(4px); transition: opacity .42s ease, transform .5s cubic-bezier(.2,.8,.2,1), filter .42s ease; pointer-events: none; }
.gxa-layer.on { opacity: 1; transform: none; filter: none; pointer-events: auto; }
.gxa-layer[hidden] { display: none; }
.gxa-zoom { position: absolute; z-index: 5; border: 2px solid var(--a-acc); border-radius: 14px; background: color-mix(in srgb, var(--a-panel) 75%, transparent); box-shadow: 0 0 0 6px var(--a-wash), 0 0 60px var(--a-wash); pointer-events: none; }
.gxa-ficha { display: flex; flex-direction: column; overflow: auto; }
.gxa-f { padding: 16px; display: flex; flex-direction: column; gap: 14px; animation: gxa-in .35s cubic-bezier(.2,.8,.2,1); }
@keyframes gxa-in { from { opacity: 0; transform: translateY(6px); } }
.gxa-kicker { font: 600 10.5px/1.35 var(--a-mono); letter-spacing: .14em; text-transform: uppercase; color: var(--a-muted); margin-bottom: 4px; }
.gxa-f h3 { font: 700 22px/1.1 var(--a-disp); letter-spacing: -.02em; margin: 0; }
.gxa-path { font: 500 12px var(--a-mono); color: var(--a-muted); }
.gxa-owner { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--a-muted); }
.gxa-owner i { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
.gxa-sec h4 { font: 600 10.5px/1 var(--a-mono); letter-spacing: .14em; text-transform: uppercase; color: var(--a-muted); margin: 0 0 6px; }
.gxa-sec p, .gxa-sec li { font-size: 13.5px; }
.gxa-sec ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 3px; }
.gxa-sec.risk { border-left: 3px solid var(--a-sig); padding-left: 10px; }
.gxa-sec.risk h4 { color: var(--a-sig); }
.gxa-check { list-style: none; padding: 0 !important; }
.gxa-check li::before { content: "○ "; color: var(--a-muted); font-family: var(--a-mono); }
.gxa-check li.done { color: var(--a-muted); text-decoration: line-through; }
.gxa-check li.done::before { content: "● "; color: var(--a-good); }
.gxa-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.gxa-chip { display: inline-flex; gap: 6px; align-items: center; border: 1px solid var(--a-line); border-radius: 999px; padding: 4px 10px 4px 8px; background: var(--a-panel); cursor: pointer; font-size: 12.5px; transition: border-color .15s, transform .15s; }
.gxa-chip:hover { border-color: var(--a-acc); transform: translateY(-1px); }
.gxa-chip[aria-current="true"] { background: var(--a-wash); border-color: var(--a-acc); cursor: default; transform: none; }
.gxa-chip .ic { color: var(--a-acc); }
.gxa-chip .x { font: 600 10.5px var(--a-mono); color: var(--a-muted); }
.gxa-acts { display: flex; flex-wrap: wrap; gap: 8px; }
.gxa-btn { border: 1px solid var(--a-line); border-radius: 10px; padding: 7px 12px; background: var(--a-panel); cursor: pointer; font-weight: 500; font-size: 13px; }
.gxa-btn:hover { border-color: var(--a-acc); color: var(--a-acc); }
.gxa-btn.primary { background: var(--a-acc); color: var(--a-panel); border-color: var(--a-acc); }
.gxa-btn.primary:hover { filter: brightness(1.08); color: var(--a-panel); }
.gxa-const { width: 100%; height: auto; display: block; }
.gxa-const .ln { stroke: var(--a-acc); stroke-width: 1.5; stroke-dasharray: 160; stroke-dashoffset: 160; animation: gxa-draw .7s cubic-bezier(.2,.8,.2,1) forwards; }
.gxa-const .ln.off { stroke: var(--a-line); stroke-dasharray: 3 4; animation: none; stroke-dashoffset: 0; }
@keyframes gxa-draw { to { stroke-dashoffset: 0; } }
.gxa-const .dot { fill: var(--a-panel); stroke: var(--a-line); stroke-width: 1.5; }
.gxa-const .dot.on { stroke: var(--a-acc); fill: var(--a-wash); }
.gxa-const .dot.cur { fill: var(--a-acc); stroke: var(--a-acc); }
.gxa-const .me { fill: var(--a-acc); }
.gxa-const .pulse { fill: none; stroke: var(--a-acc); transform-origin: center; transform-box: fill-box; animation: gxa-pulse 2.2s ease-out infinite; }
@keyframes gxa-pulse { from { transform: scale(1); opacity: .55; } to { transform: scale(2.4); opacity: 0; } }
.gxa-const text { font: 600 9.5px var(--a-mono); fill: var(--a-muted); }
.gxa-const text.on { fill: var(--a-ink); }
.gxa-hint { color: var(--a-muted); font-size: 13px; }
.gxa-ownrow { display: flex; flex-wrap: wrap; gap: 6px 12px; }
@container (max-width: 1320px) { .gxa-grid { grid-template-columns: 208px minmax(0, 1fr) 268px; } .gxa-p small { display: none; } .gxa-p .ic { grid-row: auto; } }
@container (max-width: 1000px) { .gxa-grid { grid-template-columns: 208px minmax(0, 1fr); height: auto; } .gxa-main { height: var(--gxa-h, 760px); } .gxa-ficha { grid-column: 1 / -1; } }
@container (max-width: 680px) { .gxa-grid { grid-template-columns: minmax(0, 1fr); } .gxa-main { height: 560px; } }
@media (prefers-reduced-motion: reduce) { .gxa-layer, .gxa-ind, .gxa-f { transition: none; animation: none; } .gxa-const .ln, .gxa-const .pulse { animation: none; stroke-dashoffset: 0; } }`;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  let cssIn = false;
  const injectCSS = () => { if (cssIn || typeof document === 'undefined') return; cssIn = true; const s = document.createElement('style'); s.setAttribute('data-gxa', ''); s.textContent = CSS; document.head.appendChild(s); };

  function mount(root, A, opts) {
    opts = opts || {};
    const GX = global.GraphX;
    if (!GX || !GX.mount) throw new Error('GraphXAtlas: falta el motor (GraphX)');
    injectCSS();
    const lang = opts.lang === 'en' ? 'en' : 'es', t = T[lang];
    const reduce = global.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const P = A.perspectives, byId = new Map(P.map(p => [p.id, p])), E = A.entities;
    const tops = P.filter(p => !p.parent), inners = P.filter(p => p.parent);

    /* cada perspectiva, un spec de GraphX: las piezas que nombran una entidad heredan lo suyo */
    function compile(p) {
      let spec;
      if (p.mermaid) { spec = GX.fromMermaid(p.mermaid, { lang }).spec; if (p.fx) spec.fx = p.fx; }
      else spec = JSON.parse(JSON.stringify(p.spec));
      spec.title = ''; spec.lang = lang;
      if (spec.minimap == null) spec.minimap = false;
      if (!spec.owners) spec.owners = A.owners;
      (spec.nodes || []).forEach(n => {
        const e = E[n.id]; if (!e) return;
        for (const k of ['label', 'kind', 'owner', 'summary']) if (n[k] == null && e[k] != null) n[k] = e[k];
        if (e.doc && e.doc.risks && e.doc.risks.length && !n.notes) n.notes = e.doc.risks.map(x => ({ tone: 'warn', text: x }));
      });
      return spec;
    }
    const specs = new Map(P.map(p => [p.id, compile(p)]));
    const ids = new Map(P.map(p => [p.id, new Set((specs.get(p.id).nodes || []).map(n => n.id))]));
    const appears = id => P.filter(p => ids.get(p.id).has(id));

    root.classList.add('gxa');
    if (opts.height) root.style.setProperty('--gxa-h', typeof opts.height === 'number' ? opts.height + 'px' : opts.height);
    root.innerHTML = `
      ${opts.header === false ? '' : `<div class="gxa-top"><div><h2>${esc(A.title)} <em>· atlas</em></h2><p class="gxa-lede">${esc(A.summary || '')}</p></div>
        <ul class="gxa-facts">${[tops.length, inners.length, Object.keys(E).length, Object.keys(A.owners || {}).length].map((n, i) => `<li><b>${n}</b><span>${t.facts[i]}</span></li>`).join('')}</ul></div>`}
      <div class="gxa-grid">
        <nav class="gxa-card gxa-rail" aria-label="${t.perspectives}">
          <label class="gxa-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="${esc(t.search)}" autocomplete="off" data-r="q"></label>
          <div class="gxa-results" data-r="results"></div>
          <div class="gxa-h">${t.perspectives}</div><ol class="gxa-list" data-r="top"><span class="gxa-ind" data-r="ind"></span></ol>
          ${inners.length ? `<div class="gxa-h">${t.inner}</div><ol class="gxa-list" data-r="inner"></ol>` : ''}
          <div class="gxa-keys">${t.keys(Math.min(9, P.length))}</div>
        </nav>
        <main class="gxa-card gxa-main"><div class="gxa-head"><div class="gxa-crumbs" data-r="crumbs"></div><div class="gxa-q" data-r="qtext"></div></div><div class="gxa-stage" data-r="stage"></div></main>
        <aside class="gxa-card gxa-ficha" data-r="ficha" aria-live="polite"></aside>
      </div>`;
    const $ = k => root.querySelector(`[data-r="${k}"]`);
    const stage = $('stage'), ficha = $('ficha');
    const item = (p, i) => `<li><button type="button" class="gxa-p" data-p="${esc(p.id)}" title="${esc(p.question)}"><span class="ic">${esc(p.icon || '◇')}</span><b>${esc(p.title)}</b><span class="n">${p.parent ? '↳' : i + 1}</span><small>${esc(p.parent ? t.insideOf(E[p.parent] ? E[p.parent].label : p.parent) : p.question)}</small></button></li>`;
    $('top').insertAdjacentHTML('beforeend', tops.map(item).join(''));
    if (inners.length) $('inner').innerHTML = inners.map(item).join('');
    root.querySelectorAll('.gxa-p').forEach(b => b.addEventListener('click', () => go(b.dataset.p)));

    /* un lienzo por perspectiva, montado la primera vez y conservado con su vista y su selección */
    const layers = new Map();
    let cur = null, lastSel, lastTop = null;
    function mountLayer(pid) {
      if (layers.has(pid)) return layers.get(pid);
      const el = document.createElement('div'); el.className = 'gxa-layer';
      const host = document.createElement('div'); el.appendChild(host); stage.appendChild(el);
      const L = { el, host, g: null, ready: null }; layers.set(pid, L);
      const p = byId.get(pid);
      L.g = GX.mount(host, specs.get(pid), { height: Math.max(320, stage.clientHeight - 60), lang });
      /* la barra del motor y su línea de tiempo se descuentan antes del primer encuadre */
      const gs = host.querySelector('.gx-stage');
      if (gs) { const over = host.offsetHeight - gs.offsetHeight; host.style.setProperty('--gx-h', Math.max(320, stage.clientHeight - over - 2) + 'px'); }
      L.ready = Promise.resolve(L.g.ready).then(() => { if (p.after && p.after.blast && L.g.blast) setTimeout(() => L.g.blast(p.after.blast), reduce ? 0 : 700); });
      return L;
    }
    const topFor = p => (lastTop && ids.get(lastTop).has(p.parent) ? byId.get(lastTop) : appears(p.parent).find(x => !x.parent) || tops[0]);
    async function pick(L, id) { try { if (!(L.g.state.els && L.g.state.els.has(id))) await L.g.reveal(id, true); L.g.select(id); } catch (_) { } }

    async function go(pid, o) {
      o = o || {};
      if (!byId.has(pid)) return;
      const p = byId.get(pid), prev = cur;
      if (prev !== pid) {
        const from = prev && layers.get(prev);
        if (o.zoomFrom && from && !reduce) await zoomIn(from, o.zoomFrom);
        cur = pid; lastSel = undefined;
        if (!p.parent) lastTop = pid;
        const L = mountLayer(pid);
        L.el.hidden = false;
        requestAnimationFrame(() => L.el.classList.add('on'));
        if (from) { from.el.classList.remove('on'); setTimeout(() => { if (cur !== prev) from.el.hidden = true; }, 520); }
        if (o.zoomOut && !reduce) zoomOut(o.zoomOut);
      }
      chrome();
      const L = layers.get(pid);
      await L.ready;
      if (o.node && ids.get(pid).has(o.node) && p.kind !== 'sequence') await pick(L, o.node);
      sync(true);
      if (o.node && p.kind === 'sequence' && E[o.node]) fichaEntity(o.node);
      writeHash();
    }
    function up(to) { const from = byId.get(cur); go(to || (from.parent ? topFor(from).id : tops[0].id), { zoomOut: from.parent, node: from.parent }); }

    function rectOf(L, id) { const el = L.g && L.g.state && L.g.state.els && L.g.state.els.get(id); return el ? el.getBoundingClientRect() : null; }
    function frame(a, b, opacity) {
      const z = document.createElement('div'); z.className = 'gxa-zoom'; stage.appendChild(z);
      return z.animate([a, b], { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' }).finished.then(() => opacity ? z.remove() : z.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 380, delay: 120, fill: 'forwards' }).finished.then(() => z.remove()));
    }
    const full = box => ({ left: '8px', top: '8px', width: (box.width - 16) + 'px', height: (box.height - 16) + 'px' });
    const at = (r, box) => ({ left: (r.left - box.left) + 'px', top: (r.top - box.top) + 'px', width: r.width + 'px', height: r.height + 'px' });
    /* entrar «por dentro»: un marco crece desde la pieza hasta llenar el lienzo; al salir, vuelve a ella */
    function zoomIn(L, id) {
      const box = stage.getBoundingClientRect(), r = rectOf(L, id) || { left: box.left + box.width / 2 - 60, top: box.top + box.height / 2 - 30, width: 120, height: 60 };
      const done = frame(at(r, box), full(box));
      return new Promise(res => setTimeout(res, 520)).then(() => done && null);
    }
    function zoomOut(id) {
      setTimeout(() => {
        const L = layers.get(cur), r = rectOf(L, id); if (!r) return;
        const box = stage.getBoundingClientRect();
        frame(Object.assign(full(box), { opacity: 1 }), Object.assign(at(r, box), { opacity: .2 }), true);
      }, 80);
    }

    function chrome() {
      const p = byId.get(cur), trail = p.parent ? [topFor(p), p] : [p];
      $('crumbs').innerHTML = `<button type="button" data-up="">${t.atlas}</button>` + trail.map((x, i) => `<span>›</span><button type="button" data-up="${esc(x.id)}" ${i === trail.length - 1 ? 'aria-current="true"' : ''}>${esc(x.title)}</button>`).join('');
      $('crumbs').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { const id = b.dataset.up || tops[0].id; if (id !== cur) up(id); }));
      $('qtext').textContent = p.question;
      root.querySelectorAll('.gxa-p').forEach(b => b.setAttribute('aria-current', String(b.dataset.p === cur)));
      const btn = root.querySelector(`[data-r="top"] .gxa-p[data-p="${cur}"]`), ind = $('ind');
      if (btn) { ind.style.opacity = 1; ind.style.top = btn.parentNode.offsetTop + 6 + 'px'; ind.style.height = btn.offsetHeight - 12 + 'px'; } else ind.style.opacity = 0;
    }

    /* la ficha: la perspectiva o la pieza seleccionada (el motor no avisa de la selección: se mira su estado) */
    function sync(force) {
      const L = layers.get(cur);
      const sel = L && L.g && L.g.state ? L.g.state.selected || null : null;
      if (!force && sel === lastSel) return;
      lastSel = sel;
      if (sel && E[sel]) { fichaEntity(sel); writeHash(sel); }
      else if (sel) fichaPlain(sel);
      else fichaPerspective();
    }
    const poll = setInterval(() => { if (root.offsetParent !== null && !document.hidden) sync(false); }, 220);

    function constellation(id) {
      const W = 288, H = 168, cx = W / 2, cy = H / 2, rx = 118, ry = 62, on = new Set(appears(id).map(p => p.id));
      const pts = P.map((p, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / P.length; return { p, x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) }; });
      return `<svg class="gxa-const" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t.constLabel)}">
        ${pts.map((o, i) => `<line class="ln ${on.has(o.p.id) ? '' : 'off'}" x1="${cx}" y1="${cy}" x2="${o.x.toFixed(1)}" y2="${o.y.toFixed(1)}" style="animation-delay:${i * 60}ms"/>`).join('')}
        <circle class="pulse" cx="${cx}" cy="${cy}" r="7"/><circle class="me" cx="${cx}" cy="${cy}" r="6"/>
        ${pts.map(o => `<circle class="dot ${o.p.id === cur ? 'cur' : on.has(o.p.id) ? 'on' : ''}" cx="${o.x.toFixed(1)}" cy="${o.y.toFixed(1)}" r="6"/><text class="${on.has(o.p.id) ? 'on' : ''}" x="${o.x.toFixed(1)}" y="${(o.y + (o.y < cy ? -10 : 17)).toFixed(1)}" text-anchor="middle">${esc(o.p.short || o.p.title)}</text>`).join('')}
      </svg>`;
    }
    const owner = id => { const o = (A.owners || {})[id]; return o ? `<span class="gxa-owner"><i style="background:${esc(o.color)}"></i>${esc(o.label)}${o.contact ? ' · ' + esc(o.contact) : ''}</span>` : ''; };
    const sec = (cls, title, body) => (body ? `<div class="gxa-sec ${cls}"><h4>${title}</h4>${body}</div>` : '');
    const ul = xs => (xs && xs.length ? `<ul>${xs.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '');
    function fichaEntity(id) {
      const e = E[id], d = e.doc || {}, p = byId.get(cur), inner = e.inner && byId.get(e.inner), ap = appears(id);
      ficha.innerHTML = `<div class="gxa-f">
        <div><div class="gxa-kicker">${t.inN(ap.length, P.length)}</div><h3>${esc(e.label)}</h3>${e.path && e.path !== '—' ? `<div class="gxa-path">${esc(e.path)}</div>` : ''}</div>
        ${e.owner ? owner(e.owner) : ''}
        <p>${esc(e.summary || '')}</p>
        ${constellation(id)}
        <div class="gxa-sec"><h4>${t.appearsIn}</h4><div class="gxa-chips">${ap.map(x => `<button type="button" class="gxa-chip" data-go="${esc(x.id)}" ${x.id === cur ? 'aria-current="true"' : ''}><span class="ic">${esc(x.icon || '◇')}</span>${esc(x.title)}</button>`).join('')}</div></div>
        <div class="gxa-acts">${inner ? `<button type="button" class="gxa-btn primary" data-in="${esc(inner.id)}">${esc(inner.icon || '⊡')} ${t.openInner}</button>` : ''}${p.kind !== 'sequence' ? `<button type="button" class="gxa-btn" data-blast="${esc(id)}">${t.blast}</button>` : ''}</div>
        ${sec('', t.context, d.context ? `<p>${esc(d.context)}</p>` : '')}
        ${sec('', t.constraints, ul(d.constraints))}
        ${sec('risk', t.risks, ul(d.risks))}
        ${sec('', t.todo, d.todo && d.todo.length ? `<ul class="gxa-check">${d.todo.map(x => `<li class="${x.done ? 'done' : ''}">${esc(x.text)}</li>`).join('')}</ul>` : '')}
      </div>`;
      wire(id);
    }
    function fichaPlain(id) {
      const n = (specs.get(cur).nodes || []).find(x => x.id === id) || { label: id };
      ficha.innerHTML = `<div class="gxa-f"><div><div class="gxa-kicker">${t.onlyHere}</div><h3>${esc(n.label || id)}</h3></div><p>${esc(n.summary || '')}</p><p class="gxa-hint">${esc(t.notAtlas(byId.get(cur).title))}</p></div>`;
    }
    function fichaPerspective() {
      const p = byId.get(cur), all = specs.get(cur).nodes || [], ns = all.filter(n => E[n.id]);
      const owners = [...new Set(ns.map(n => E[n.id].owner).filter(Boolean))];
      const risky = ns.filter(n => E[n.id].doc && E[n.id].doc.risks && E[n.id].doc.risks.length);
      const parent = p.parent && E[p.parent] ? E[p.parent].label : '';
      ficha.innerHTML = `<div class="gxa-f">
        <div><div class="gxa-kicker">${esc(p.icon || '')} ${t.persp}${p.parent ? t.persInner : ''}</div><h3>${esc(p.title)}</h3></div>
        <p>${esc(ns.length ? t.leadMany(all.length, ns.length, parent) : t.leadNone(all.length, parent))}</p>
        ${p.parent ? `<div class="gxa-acts"><button type="button" class="gxa-btn" data-upbtn>${esc(t.back(topFor(p).title))}</button></div>` : ''}
        ${owners.length ? `<div class="gxa-sec"><h4>${t.teams}</h4><div class="gxa-ownrow">${owners.map(owner).join('')}</div></div>` : ''}
        ${risky.length ? `<div class="gxa-sec risk"><h4>${t.risky}</h4><div class="gxa-chips">${risky.map(n => `<button type="button" class="gxa-chip" data-sel="${esc(n.id)}">${esc(E[n.id].label)}</button>`).join('')}</div></div>` : ''}
        ${ns.length ? `<div class="gxa-sec"><h4>${t.pieces}</h4><div class="gxa-chips">${ns.map(n => `<button type="button" class="gxa-chip" data-sel="${esc(n.id)}">${esc(E[n.id].label)}${appears(n.id).length > 1 ? ` <span class="x">×${appears(n.id).length}</span>` : ''}</button>`).join('')}</div></div><p class="gxa-hint">${t.hint}</p>` : ''}
      </div>`;
      wire(null);
    }
    function wire(id) {
      ficha.querySelectorAll('[data-upbtn]').forEach(b => b.addEventListener('click', () => up()));
      ficha.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { if (b.dataset.go !== cur) go(b.dataset.go, { node: id }); }));
      ficha.querySelectorAll('[data-in]').forEach(b => b.addEventListener('click', () => go(b.dataset.in, { zoomFrom: id })));
      ficha.querySelectorAll('[data-blast]').forEach(b => b.addEventListener('click', () => { const L = layers.get(cur); if (L && L.g && L.g.blast) L.g.blast(b.dataset.blast); }));
      ficha.querySelectorAll('[data-sel]').forEach(b => b.addEventListener('click', () => {
        const L = layers.get(cur); if (!L || !L.g) return;
        if (byId.get(cur).kind === 'sequence') fichaEntity(b.dataset.sel); else pick(L, b.dataset.sel);
      }));
    }

    /* buscar en todo el atlas: qué piezas y en qué perspectivas */
    $('q').addEventListener('input', ev => {
      const q = ev.target.value.trim().toLowerCase();
      root.querySelectorAll('.gxa-p').forEach(b => b.classList.remove('lit'));
      if (!q) { $('results').innerHTML = ''; return; }
      const hits = Object.keys(E).filter(id => { const e = E[id]; return (e.label + ' ' + id + ' ' + (e.path || '') + ' ' + (e.summary || '')).toLowerCase().includes(q); }).slice(0, 6);
      hits.forEach(id => appears(id).forEach(p => { const b = root.querySelector(`.gxa-p[data-p="${p.id}"]`); if (b) b.classList.add('lit'); }));
      $('results').innerHTML = hits.map(id => `<button type="button" class="gxa-res" data-id="${esc(id)}"><b>${esc(E[id].label)}</b><span>${appears(id).map(p => esc((p.icon || '') + ' ' + p.title)).join(' · ')}</span></button>`).join('') || `<span class="gxa-hint">${t.nothing}</span>`;
      $('results').querySelectorAll('[data-id]').forEach(b => b.addEventListener('click', () => {
        const id = b.dataset.id, ap = appears(id), to = ap.find(p => p.id === cur) || ap.find(p => !p.parent) || ap[0];
        if (to) go(to.id, { node: id });
      }));
    });

    /* teclado, solo con el atlas a la vista; y el enlace #p=<perspectiva>&n=<pieza> si se pide */
    const onKey = ev => {
      if (root.offsetParent === null) return;
      const tgt = ev.target;
      if (tgt.closest && tgt.closest('input, textarea, select')) { if (ev.key === 'Escape' && root.contains(tgt)) tgt.blur(); return; }
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const k = ev.key;
      if (/^[1-9]$/.test(k) && P[+k - 1]) { ev.preventDefault(); go(P[+k - 1].id); }
      else if (k === '/') { ev.preventDefault(); $('q').focus(); }
      else if (k === 'Backspace' && byId.get(cur).parent) { ev.preventDefault(); up(); }
    };
    document.addEventListener('keydown', onKey, true);
    function writeHash(n) {
      if (!opts.hash) return;
      const sel = n || (lastSel && E[lastSel] ? lastSel : null), h = `#p=${cur}${sel ? '&n=' + sel : ''}`;
      if (location.hash !== h) try { history.replaceState(null, '', h); } catch (_) { }
    }
    const fromHash = () => { const m = new URLSearchParams(location.hash.slice(1)); return { p: m.get('p'), n: m.get('n') }; };
    const h = opts.hash ? fromHash() : {};
    go(byId.has(h.p) ? h.p : (opts.start && byId.has(opts.start) ? opts.start : tops[0].id), { node: h.n || undefined });
    if (opts.hash) global.addEventListener('hashchange', () => { const x = fromHash(); if (x.p && x.p !== cur) go(x.p, { node: x.n }); });

    return {
      go: (pid, node) => go(pid, { node }), up, get current() { return cur; }, layers,
      destroy() { clearInterval(poll); document.removeEventListener('keydown', onKey, true); root.innerHTML = ''; root.classList.remove('gxa'); }
    };
  }

  global.GraphXAtlas = { mount, injectCSS };
})(typeof window !== 'undefined' ? window : globalThis);
