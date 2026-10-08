/* GraphX sin navegador: el motor de verdad, montado en jsdom, para todo lo que no es el navegador.
 *
 * Monta el tablero con el mismo bundle y el mismo board.js que el visor, y saca de él:
 *   - la ESCENA: lo que el terminal pinta con caracteres. Un grafo (piezas con su caja, su forma y sus
 *     datos de efectos; aristas como polilíneas con su tipo, puntas, caudal y velocidad; carriles;
 *     la capa de decoración de los layouts propios), una secuencia (participantes y filas lógicas) o
 *     un árbol de ficheros (filas en orden). Con la línea de tiempo en fotogramas, los equipos, los
 *     estados, la escala de calor y la paleta de tokens de cada tema y piel.
 *   - el SVG autocontenido de lo pintado, con sus estilos podados y sus animaciones, para el escritorio,
 *     el editor y el móvil (que dibujan SVG) y, rasterizado con rsvg-convert, un PNG para los terminales
 *     con gráficos (kitty, Ghostty) y para que Claude vea el resultado.
 *   - el informe de pintado (ids, avisos), para que las herramientas funcionen sin ningún navegador.
 *
 * Encima del tablero va el estado de la vista del panel (`ui`): lo que la persona abre o pliega, la
 * profundidad, la orientación, la búsqueda, el flujo que mira, el equipo por el que filtra. */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { tokensFor, standaloneSVG, rasterize, hasRsvg } from './svgout.mjs';

const MAX_NODES = 900, MAX_EDGES = 1200, MAX_ROWS = 1500, MAX_DECO = 600, MAX_FRAMES = 240;
const clip = (s, n) => { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const r1 = v => Math.round(v * 10) / 10;
const nums = v => Array.isArray(v) ? v.map(Number).filter(Number.isFinite) : undefined;
const plainMd = s => String(s || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

/* puntos de un path de SVG: M, L, H, V y el final de cada curva; con `bez`, también puntos intermedios de las curvas */
export function points(d, bez = false) {
  const out = []; let x = 0, y = 0, sx = 0, sy = 0;
  const re = /([MLHVCSQTAZmlhvcsqtaz])([^MLHVCSQTAZmlhvcsqtaz]*)/g; let m;
  const push = (px, py) => { x = px; y = py; out.push([r1(x), r1(y)]); };
  while ((m = re.exec(d || ''))) {
    const c = m[1], n = (m[2].match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).map(Number);
    const abs = c === c.toUpperCase();
    if (c === 'M' || c === 'm') { for (let i = 0; i + 1 < n.length; i += 2) push(abs ? n[i] : x + n[i], abs ? n[i + 1] : y + n[i + 1]); sx = x; sy = y; }
    else if (c === 'L' || c === 'l') for (let i = 0; i + 1 < n.length; i += 2) push(abs ? n[i] : x + n[i], abs ? n[i + 1] : y + n[i + 1]);
    else if (c === 'H' || c === 'h') n.forEach(v => push(abs ? v : x + v, y));
    else if (c === 'V' || c === 'v') n.forEach(v => push(x, abs ? v : y + v));
    else if (c === 'C' || c === 'c') for (let i = 0; i + 5 < n.length; i += 6) {
      const x0 = x, y0 = y, c1x = abs ? n[i] : x + n[i], c1y = abs ? n[i + 1] : y + n[i + 1], c2x = abs ? n[i + 2] : x + n[i + 2], c2y = abs ? n[i + 3] : y + n[i + 3], ex = abs ? n[i + 4] : x + n[i + 4], ey = abs ? n[i + 5] : y + n[i + 5];
      if (bez && Math.hypot(ex - x0, ey - y0) > 24) for (const t of [0.25, 0.5, 0.75]) { const u = 1 - t; out.push([r1(u * u * u * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * ex), r1(u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * ey)]); }
      push(ex, ey);
    }
    else if (c === 'S' || c === 's' || c === 'Q' || c === 'q') for (let i = 0; i + 3 < n.length; i += 4) {
      const x0 = x, y0 = y, cx = abs ? n[i] : x + n[i], cy = abs ? n[i + 1] : y + n[i + 1], ex = abs ? n[i + 2] : x + n[i + 2], ey = abs ? n[i + 3] : y + n[i + 3];
      if (bez && (c === 'Q' || c === 'q')) for (const t of [0.25, 0.5, 0.75]) { const u = 1 - t; out.push([r1(u * u * x0 + 2 * u * t * cx + t * t * ex), r1(u * u * y0 + 2 * u * t * cy + t * t * ey)]); }
      push(ex, ey);
    }
    else if (c === 'T' || c === 't') for (let i = 0; i + 1 < n.length; i += 2) push(abs ? n[i] : x + n[i], abs ? n[i + 1] : y + n[i + 1]);
    else if (c === 'A' || c === 'a') for (let i = 0; i + 6 < n.length; i += 7) push(abs ? n[i + 5] : x + n[i + 5], abs ? n[i + 6] : y + n[i + 6]);
    else if (c === 'Z' || c === 'z') push(sx, sy);
  }
  return out;
}

/* el desplazamiento acumulado de un elemento SVG hasta `stop` (solo translate: lo que usa el motor) */
function offsetOf(el, stop) {
  let x = 0, y = 0;
  for (let cur = el; cur && cur !== stop; cur = cur.parentNode) {
    const t = cur.getAttribute && cur.getAttribute('transform');
    const m = t && /translate\(\s*([-\d.e]+)[ ,]+([-\d.e]+)\s*\)/.exec(t);
    if (m) { x += +m[1]; y += +m[2]; }
  }
  return [x, y];
}

export function createEngine(root, { log = () => { } } = {}) {
  const jsdomFile = path.join(root, 'server', 'vendor', 'jsdom.cjs');
  const bundleFile = path.join(root, 'viewer', 'vendor', 'graphx.bundle.min.js');
  const boardFile = path.join(root, 'viewer', 'board.js');
  if (!fs.existsSync(jsdomFile) || !fs.existsSync(bundleFile)) return null;
  const { JSDOM } = createRequire(import.meta.url)(jsdomFile);
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' });
  const w = dom.window;
  w.matchMedia = q => ({ matches: false, media: q, addEventListener() { }, removeEventListener() { } });
  w.HTMLCanvasElement.prototype.getContext = () => null;
  w.console.warn = () => { }; w.console.log = () => { };
  w.eval(fs.readFileSync(bundleFile, 'utf8'));
  w.eval(fs.readFileSync(boardFile, 'utf8'));
  const { GraphX, GXBoard } = w;
  const rsvg = hasRsvg();

  let inst = null, host = null, key = null, spec = null, type = null, warnings = [], error = null;
  let viewSeq = -1, guideSeq = -1, mountRev = 0, dataKey = null, uiKey = null;
  let tokenCache = new Map();
  let timelineCache = null;

  async function mount(board) {
    if (inst) { try { inst.destroy(); } catch (_) { } inst = null; }
    if (host) host.remove();
    host = w.document.createElement('div'); w.document.body.appendChild(host);
    error = null; warnings = []; tokenCache = new Map(); timelineCache = null;
    try {
      const r = GXBoard.buildSpec(board);
      spec = r.spec; warnings = r.warnings; type = r.type;
      inst = GraphX.mount(host, spec, { lang: spec.lang || GXBoard.langOf(board), minimap: false });
      await inst.ready;
      if (board.direction) await inst.setDirection(board.direction);
      (inst.model.warn || []).forEach(x => warnings.push(x));
    } catch (err) { error = String(err && err.message || err); inst = null; }
    viewSeq = -1; guideSeq = -1; dataKey = JSON.stringify(board.data || null); uiKey = null;
  }

  /* recorrido y vista de Claude (lo que dice el tablero) */
  async function applyBoard(board) {
    const g = board.guide;
    /* el recorrido es el de Claude o, si no hay, el propio del diagrama (su `tour`) */
    const n = g ? ((g.steps || []).length || (spec && spec.tour && spec.tour.steps ? spec.tour.steps.length : 0)) : 0;
    if (g && g.seq !== guideSeq) {
      guideSeq = g.seq;
      if (g.at >= 0 && g.at < n) { if (inst.state.tour !== g.at) await inst.goStep(g.at); }
      else if (inst.state.tour >= 0) inst.resetView();
    } else if (g && g.at !== inst.state.tour && g.at >= 0 && g.at < n) await inst.goStep(g.at);
    const v = board.view;
    if (v && v.seq != null && v.seq !== viewSeq) {
      viewSeq = v.seq;
      const M = inst.model.M;
      try {
        if (v.reset) { inst.clearFilter(); inst.resetView(); inst.clearBlast(); inst.filterOwners([]); }
        if (v.flow !== undefined) inst.showView(v.flow ? 'flow:' + v.flow : 'graph');
        if (v.direction) await inst.setDirection(v.direction);
        if (v.depth != null) await inst.expandTo(v.depth);
        if (v.focus && v.focus.length) await inst.filter(v.focus.filter(id => M.has(id)), { label: v.label || 'Claude', key: 'claude', prune: v.prune === true, fit: false });
        else if (v.focus) inst.clearFilter();
        if (v.trace && M.has(v.trace.id)) inst.trace(v.trace.id, v.trace.dir === 'down' ? 'down' : 'up');
        if (v.select && M.has(v.select)) inst.select(v.select);
        if (v.owners) inst.filterOwners(v.owners);
        if (v.blast && M.has(v.blast)) inst.blast(v.blast);
        if (v.timeline != null && inst.timeline) inst.timeline.seek(v.timeline);
      } catch (_) { }
    }
    /* datos en vivo: sin volver a montar */
    const dk = JSON.stringify(board.data || null);
    if (dk !== dataKey) {
      dataKey = dk;
      try { await inst.setData(board.data || {}, { duration: 0 }); } catch (_) { }
    }
  }

  /* lo que la persona hace en el panel: abrir, plegar, profundidad, orientación, búsqueda, flujo, equipos */
  async function applyUi(ui) {
    const S = inst.state, M = inst.model.M;
    let changed = false;
    const k = JSON.stringify([ui.depth, ui.dir, ui.search, ui.view, ui.owners, ui.changes]);
    if (k !== uiKey) {
      const prev = uiKey ? JSON.parse(uiKey) : [];
      uiKey = k;
      if (ui.view !== undefined && ui.view !== prev[3]) { try { inst.showView(ui.view || 'graph'); } catch (_) { } }
      if (ui.depth != null && ui.depth !== prev[0]) { await inst.expandTo(ui.depth); }
      if (ui.dir && ui.dir !== prev[1]) await inst.setDirection(ui.dir);
      if (ui.search !== prev[2]) {
        const q = String(ui.search || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        if (q) {
          const hits = [...M.values()].filter(n => !n.isLane && [n.id, n.label, n.subtitle, n.summary, ...(n.tags || [])].some(t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q))).map(n => n.id);
          try { await inst.filter(hits, { label: '“' + ui.search + '”', key: 'search', fit: false }); } catch (_) { }
        } else if (prev[2]) inst.clearFilter();
      }
      if (JSON.stringify(ui.owners) !== JSON.stringify(prev[4])) inst.filterOwners(ui.owners || []);
    }
    for (const id of ui.open || []) if (M.has(id) && !S.expanded.has(id)) { S.expanded.add(id); changed = true; let p = M.get(id).parent; while (p != null) { S.expanded.add(p); p = M.get(p).parent; } }
    for (const id of ui.close || []) if (S.expanded.has(id)) { S.expanded.delete(id); changed = true; }
    if (changed) await inst.setDirection(S.dir);
  }

  function report(rev) {
    const M = inst && inst.model.M;
    const nodes = M ? [...M.values()].filter(n => !n.isLane) : [];
    return {
      type: 'rendered', source: 'engine', rev, ok: !error, error: error || undefined, warnings: warnings.slice(0, 60), diagram: type,
      nodes: nodes.slice(0, 800).map(n => ({ id: n.id, label: n.label, parent: n.parent == null ? undefined : n.parent, kind: n.kind, depth: n.depth, shape: n.shape })),
      nodeCount: nodes.length, edgeCount: spec && spec.edges ? spec.edges.length : 0,
      edges: spec && spec.edges ? spec.edges.slice(0, 400).map(e => ({ id: e.id, from: e.from, to: e.to })) : [],
      lanes: spec && spec.lanes ? spec.lanes.map(l => l.id) : [], steps: spec && spec.tour ? spec.tour.steps.length : 0, title: spec && spec.title,
      flows: spec && spec.flows ? spec.flows.map(f => f.id) : [], fx: inst && inst.fx ? Object.keys(inst.fx).filter(k => inst.fx[k]) : []
    };
  }

  /* ---------- la escena ---------- */
  const colorOf = c => (c && typeof c === 'object' ? [c.light || c.dark, c.dark || c.light] : typeof c === 'string' ? c : undefined);
  const heatCfg = () => (inst && inst.fx && inst.fx.heat && typeof inst.fx.heat === 'object' ? inst.fx.heat : inst && inst.fx && inst.fx.heat ? {} : null);

  function heatDomain() {
    const cfg = heatCfg(); if (!cfg) return null;
    if (Array.isArray(cfg.domain) && cfg.domain.length === 2) return cfg.domain;
    const vals = [...inst.model.M.values()].map(n => n.heat).filter(v => typeof v === 'number');
    if (!vals.length) return null;
    return [Math.min(0, ...vals), Math.max(...vals)];
  }
  function heatLut() {
    const cfg = heatCfg(); if (!cfg) return null;
    const scheme = cfg.scheme || 'traffic';
    const lut = [];
    for (let i = 0; i <= 10; i++) lut.push(GraphX.fx.scale(scheme, cfg.invert ? 1 - i / 10 : i / 10));
    return { lut, domain: heatDomain(), label: cfg.label, unit: cfg.unit, rollup: cfg.rollup === undefined ? 'max' : cfg.rollup };
  }

  /* los datos de una pieza que dibujan sus efectos y su forma, en claves cortas */
  function nodeData(n) {
    const o = {};
    if (typeof n.heat === 'number') o.hv = n.heat;
    if (Array.isArray(n.spark)) o.sp = nums(n.spark).slice(-48);
    else if (typeof n.spark === 'string') o.sp = n.spark.split(/[\s,;]+/).map(Number).filter(Number.isFinite).slice(-48);
    if (n.unit) o.u = clip(n.unit, 8);
    if (typeof n.progress === 'number') o.pr = n.progress > 1 ? n.progress / 100 : n.progress;
    if (n.alert) o.al = String(n.alert);
    if (n.owner) o.ow = String(n.owner);
    if (typeof n.value === 'number') o.v = n.value;
    if (typeof n.change === 'number') o.ch = n.change;
    if (n.good) o.gd = n.good;
    if (typeof n.min === 'number') o.mn = n.min;
    if (typeof n.max === 'number') o.mx = n.max;
    if (Array.isArray(n.thresholds)) o.th = nums(n.thresholds);
    if (typeof n.decimals === 'number') o.dc = n.decimals;
    if (Array.isArray(n.parts)) o.pt = n.parts.slice(0, 12).map(p => ({ l: clip(p.label, 24), v: +p.value || 0, c: colorOf(p.color) }));
    if (n.span && typeof n.span === 'object') o.sn = { s: n.span.start, e: n.span.end, m: !!n.span.milestone, lv: !!n.span.live };
    if (n.score != null) o.sc = +n.score;
    if (n.badge != null) o.b = clip(n.badge, 12);
    if (n.avatar) o.av = clip(n.avatar, 6);
    if (Array.isArray(n.rows)) o.rw = n.rows.slice(0, 24).map(r => ({ n: clip(r.name, 28), t: r.type ? clip(r.type, 16) : undefined, k: r.keys ? clip(r.keys, 6) : undefined, s: r.section || undefined, vi: r.vis || undefined }));
    if (n.head === true) o.hd = 1;
    return o;
  }

  function graphScene() {
    const S = inst.state, M = inst.model.M;
    const svg = host.querySelector('.gx-stage > .gx-svg:not(.gx-seq)');
    const world = svg && svg.querySelector('.gx-world');
    const dimAll = !!(world && world.classList.contains('gx-dim'));
    const nodes = [];
    for (const el of svg ? svg.querySelectorAll('.gx-node[data-id], .gx-group[data-id]') : []) {
      if (nodes.length >= MAX_NODES) break;
      const id = el.getAttribute('data-id'), r = S.rects.get(id), n = M.get(id);
      if (!r || !n) continue;
      const group = el.classList.contains('gx-group');
      const kids = (n.children || []).length;
      const o = {
        i: id, l: clip(n.label, 80), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h), d: n.depth,
      };
      if (n.subtitle) o.s = clip(n.subtitle, 60);
      if (group) o.g = 1;
      if (n.isLane) o.ln = 1;
      if (group || (kids > 0 && S.expanded.has(id))) o.o = 1;
      if (kids) o.k = kids;
      if (n.parent != null) o.p = n.parent;
      if (n.laneId) o.la = n.laneId;
      if (n.kind) o.kd = n.kind;
      if (n.shape) o.sh = n.shape;
      if (n.delta && n.delta !== 'unchanged') o.dl = n.delta;
      const c = colorOf(n.color); if (c) o.c = c;
      const f = colorOf(n.fill); if (f) o.f = f;
      const tc = colorOf(n.textColor); if (tc) o.tc = tc;
      if (n.status) {
        const st = spec.statuses && spec.statuses[n.status];
        o.st = clip(st && st.label || n.status, 24);
        const sc = st && colorOf(st.color); if (sc) o.stc = sc;
        if (st && st.pulse) o.pu = 1;
      }
      if (n.frame) o.fr = n.frame;
      if (n.summary) o.sm = clip(plainMd(n.summary), 200);
      if (Array.isArray(n.blocks) && n.blocks.length) o.bl = n.blocks.length;
      if (Array.isArray(n.links) && n.links.length) o.lk = n.links.length;
      if (Array.isArray(n.notes) && n.notes.length) o.nt = n.notes.map(x => x && x.tone || 'info').slice(0, 3);
      if (Array.isArray(n.files) && n.files.length) o.fl = n.files.length;
      Object.assign(o, nodeData(n));
      if (el.classList.contains('lit')) o.lt = 1;
      if (el.classList.contains('sel') || S.selected === id) o.se = 1;
      if ((dimAll && !el.classList.contains('lit')) || el.classList.contains('off')) o.dm = 1;
      if (el.classList.contains('hit')) o.hi = 1;
      if (n.isLane) { const ls = (spec.lanes || []).find(l => l.id === id); if (ls && ls.color) o.c = colorOf(ls.color); }
      nodes.push(o);
    }
    /* el calor de un contenedor plegado: lo que lleva dentro (máximo, media o suma) */
    const hl = heatLut();
    if (hl && hl.rollup) for (const o of nodes) {
      if (o.hv != null || !o.k || o.o) continue;
      const vals = []; const walk = id => { const n = M.get(id); if (!n) return; if (typeof n.heat === 'number') vals.push(n.heat); (n.children || []).forEach(c => walk(typeof c === 'string' ? c : c.id)); };
      (M.get(o.i).children || []).forEach(c => walk(typeof c === 'string' ? c : c.id));
      if (vals.length) { o.hv = hl.rollup === 'avg' ? vals.reduce((a, b) => a + b, 0) / vals.length : hl.rollup === 'sum' ? vals.reduce((a, b) => a + b, 0) : Math.max(...vals); o.hr = 1; }
    }
    const edgeById = new Map((inst.model.edges || []).map(e => [e.id, e]));
    const specEdge = new Map((spec.edges || []).map(e => [e.id, e]));
    const edges = [];
    for (const el of svg ? svg.querySelectorAll('.gx-edge[data-id]') : []) {
      if (edges.length >= MAX_EDGES) break;
      const line = el.querySelector('.gx-eline') || el.querySelector('path:last-of-type');
      const id = el.getAttribute('data-id');
      const v = (S.vedges || []).find(x => x.id === id) || {};
      const pts = points(line && line.getAttribute('d'), true);
      if (pts.length < 2) continue;
      const list = (v.list || []).map(e => (typeof e === 'string' ? e : e.id));
      const first = specEdge.get(list[0]) || edgeById.get(list[0]) || {};
      const lab = svg.querySelector(`.gx-elabel[data-id="${String(id).replace(/"/g, '\\"')}"]`);
      const m = lab && /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(lab.getAttribute('transform') || '');
      const rect = lab && lab.querySelector('rect');
      const rate = list.reduce((a, eid) => { const e = edgeById.get(eid) || specEdge.get(eid); return a + (e && typeof e.rate === 'number' ? e.rate : 0); }, 0);
      const o = { i: id, a: v.from, b: v.to, p: pts };
      if (list.length) o.ids = list.slice(0, 30);
      if (list.length > 1) o.n = list.length;
      if (v.kind) o.k = v.kind;
      if (el.classList.contains('dashed') || /^(event|queue|async)$/.test(v.kind || '')) o.ds = 1;
      if (v.delta && v.delta !== 'unchanged') o.dl = v.delta;
      if (v.animated || first.animated) o.an = 1;
      if (v.hero || first.emphasis === 'hero') o.he = 1;
      if (v.muted || first.emphasis === 'muted') o.mu = 1;
      if (v.back) o.bk = 1;
      if (rate) o.r = rate;
      const sp = first.speed; if (sp) o.sp = sp;
      if (typeof first.weight === 'number') o.wt = first.weight;
      if (first.curve) o.cv = 1;
      const c = colorOf(first.color); if (c) o.c = c;
      const head = line && line.getAttribute('marker-end'), tail = line && line.getAttribute('marker-start');
      o.hd = head ? (first.head || 'arrow') : 'none';
      if (tail) o.tl = first.tail || 'arrow';
      if (first.headLabel) o.hl = clip(first.headLabel, 8);
      if (first.tailLabel) o.tll = clip(first.tailLabel, 8);
      if (lab) { o.l = clip(lab.textContent, 48); if (m) { o.lx = Math.round(+m[1] + (rect ? +rect.getAttribute('width') / 2 : 0)); o.ly = Math.round(+m[2] + (rect ? +rect.getAttribute('height') / 2 : 0)); } }
      if (first.summary) o.sm = clip(plainMd(first.summary), 160);
      if (el.classList.contains('lit')) o.lt = 1;
      if (dimAll && !el.classList.contains('lit')) o.dm = 1;
      edges.push(o);
    }
    /* carriles (los marcos de fondo) */
    const lanes = (S.bands || []).map(b => {
      const l = (spec.lanes || []).find(x => x.id === b.id) || {};
      const n = M.get(b.id) || {};
      return { i: b.id, l: clip(l.label || n.label || b.id, 60), s: l.subtitle ? clip(l.subtitle, 60) : undefined, x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h), dn: b.down ? 1 : undefined, c: colorOf(l.color), ow: l.owner };
    });
    /* la capa de decoración de los layouts propios (ejes, marcas, hoy, cintas…) */
    const deco = [];
    const dg = svg && svg.querySelector('.gx-deco');
    if (dg) for (const el of dg.querySelectorAll('rect, line, path, text, polyline, circle')) {
      if (deco.length >= MAX_DECO) break;
      const [ox, oy] = offsetOf(el.parentNode, dg);
      const cls = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0, 3).join(' ') || undefined;
      const tag = el.tagName.toLowerCase();
      const fill = el.getAttribute('fill'); const stroke = el.getAttribute('stroke');
      if (tag === 'rect') deco.push({ t: 'r', x: Math.round(+el.getAttribute('x') + ox), y: Math.round(+el.getAttribute('y') + oy), w: Math.round(+el.getAttribute('width') || 0), h: Math.round(+el.getAttribute('height') || 0), c: cls, f: fill && !/^url|none/.test(fill) ? fill : undefined });
      else if (tag === 'line') deco.push({ t: 'l', p: [[r1(+el.getAttribute('x1') + ox), r1(+el.getAttribute('y1') + oy)], [r1(+el.getAttribute('x2') + ox), r1(+el.getAttribute('y2') + oy)]], c: cls, s: stroke || undefined });
      else if (tag === 'path' || tag === 'polyline') { const pts = tag === 'path' ? points(el.getAttribute('d'), true) : (el.getAttribute('points') || '').trim().split(/[\s,]+/).map(Number).reduce((a, v, i, arr) => (i % 2 ? a : a.concat([[v, arr[i + 1]]])), []); if (pts.length > 1) deco.push({ t: 'l', p: pts.slice(0, 80).map(([x, y]) => [r1(x + ox), r1(y + oy)]), c: cls, s: stroke || undefined, f: fill && !/^url|none/.test(fill) ? fill : undefined }); }
      else if (tag === 'circle') deco.push({ t: 'c', x: Math.round(+el.getAttribute('cx') + ox), y: Math.round(+el.getAttribute('cy') + oy), r: Math.round(+el.getAttribute('r') || 0), c: cls });
      else if (tag === 'text') { const tx = el.textContent.trim(); if (tx) deco.push({ t: 't', x: Math.round(+(el.getAttribute('x') || 0) + ox), y: Math.round(+(el.getAttribute('y') || 0) + oy), s: clip(tx, 40), a: el.getAttribute('text-anchor') || undefined, c: cls }); }
    }
    const bbox = S.bbox ? { x: Math.round(S.bbox.x), y: Math.round(S.bbox.y), w: Math.round(S.bbox.w), h: Math.round(S.bbox.h) } : { x: 0, y: 0, w: 0, h: 0 };
    return { nodes, edges, lanes, deco, bbox, mode: spec.layout && spec.layout.mode || 'graph' };
  }

  /* una secuencia como filas lógicas: el terminal la coloca por su cuenta (columnas por participante) */
  function seqScene(flowId) {
    const flows = spec.flows || [];
    const f = flows.find(x => x.id === flowId) || flows[0];
    if (!f) return null;
    const M = inst.model.M;
    const parts = (f.participants || []).map(id => {
      const n = M.get(id) || (spec.nodes || []).find(x => x.id === id) || { id, label: id };
      const o = { i: id, l: clip(n.label || id, 40) };
      if (n.shape) o.sh = n.shape; if (n.kind) o.kd = n.kind;
      const c = colorOf(n.color); if (c) o.c = c;
      if (n.lane) o.box = n.lane;
      if (n.summary) o.sm = clip(plainMd(n.summary), 160);
      return o;
    });
    const rows = (f.messages || []).slice(0, 400).map(m => {
      const o = { i: m.id, k: m.kind || 'sync' };
      if (m.from != null) o.a = m.from; if (m.to != null) o.b = m.to;
      if (m.label) o.l = clip(plainMd(m.label), 80);
      if (m.title) o.t = clip(m.title, 30);
      if (m.block) o.bl = m.block;
      if (m.over) o.ov = m.over; if (m.side) o.sd = m.side;
      if (m.node) o.n = m.node;
      if (m.head) o.hd = m.head; if (m.tail) o.tl = m.tail;
      if (m.activate) o.ac = m.activate; if (m.deactivate) o.de = m.deactivate;
      if (m.summary) o.sm = clip(plainMd(m.summary), 160);
      if (m.data) o.dt = clip(plainMd(m.data), 80);
      const c = colorOf(m.color); if (c) o.c = c;
      if (m.phase) o.ph = 1;
      return o;
    });
    const boxes = (spec.lanes || []).filter(l => parts.some(p => p.box === l.id)).map(l => ({ i: l.id, l: clip(l.label || l.id, 40), c: colorOf(l.color) }));
    return { id: f.id, t: clip(f.title || f.id, 80), sm: f.summary ? clip(plainMd(f.summary), 200) : undefined, parts, rows, boxes };
  }

  /* las filas de un árbol de ficheros, en el orden en que se ven */
  function treeRows() {
    const S = inst.state, M = inst.model.M, rows = [];
    const walk = (id, depth, last, rails) => {
      if (rows.length >= MAX_ROWS) return;
      const n = M.get(id); if (!n || !S.visible.has(id)) return;
      const kids = (n.children || []).map(c => typeof c === 'string' ? c : c.id);
      const open = kids.length > 0 && S.expanded.has(id);
      const f = n.files && n.files[0];
      const st = n.stat || {};
      const o = { i: id, l: n.label, d: depth, rl: rails };
      if (last) o.la = 1;
      if (kids.length > 0 || n.kind === 'folder') o.fo = 1;
      if (open) o.o = 1;
      if (kids.length) o.k = kids.length;
      if (n.delta && n.delta !== 'unchanged') o.dl = n.delta;
      if (n.badge) o.b = clip(n.badge, 5);
      if (n.extColor) o.c = n.extColor;
      if (n.subtitle) o.s = clip(n.subtitle, 40);
      const add = f ? f.additions : st.additions || st.add, del = f ? f.deletions : st.deletions || st.del;
      if (add) o.ad = add; if (del) o.de = del;
      if (n.tree) { o.fc = n.tree.files; if (n.tree.changed) o.cg = n.tree.changed.length + (n.tree.more || 0); }
      if (n.summary) o.sm = clip(plainMd(n.summary), 200);
      rows.push(o);
      if (!open) return;
      const shown = kids.filter(k => S.visible.has(k));
      shown.forEach((k, i) => walk(k, depth + 1, i === shown.length - 1, rails.concat(last ? 0 : 1)));
      const hidden = kids.length - shown.length;
      if (hidden > 0 && rows.length < MAX_ROWS) rows.push({ i: id + '::more', mo: hidden, pa: id, d: depth + 1, la: 1, rl: rails.concat(last ? 0 : 1) });
    };
    const roots = (inst.model.roots || []).map(r => typeof r === 'string' ? r : r.id);
    roots.forEach((r, i) => walk(r, 0, i === roots.length - 1, []));
    return rows;
  }

  /* la línea de tiempo como fotogramas de datos: el terminal los aplica sin volver a pintar el layout */
  function timelineScene() {
    if (timelineCache) return timelineCache;
    const ts = spec.timeline; const fx = inst.fx;
    if (!ts || !fx || !fx.timeline) return null;
    let tab = null;
    if (typeof ts.data === 'string') tab = GraphX.fx.parseTable(ts.data);
    else if (Array.isArray(ts.rows) && ts.rows.length) tab = { columns: [...new Set(ts.rows.flatMap(r => Object.keys(r || {})))], rows: ts.rows };
    else if (Array.isArray(ts.columns) && Array.isArray(ts.values)) tab = { columns: ts.columns, rows: ts.values.map(r => { const o = {}; ts.columns.forEach((c, i) => { o[c] = r[i]; }); return o; }) };
    if (!tab || !tab.rows.length) return null;
    const M = inst.model.M;
    const cols = tab.columns, lc = cols.map(c => String(c).toLowerCase()), col = re => cols[lc.findIndex(c => re.test(c))];
    const tcol = col(/^(time|t|timestamp|ts|fecha|hora|date)$/) || cols[0], idc = col(/^(id|target|node|edge|pieza|arista)$/), vc = col(/^(value|valor|v)$/), fc = col(/^(field|metric|campo|metrica|métrica)$/), ec = col(/^(event|evento)$/);
    let rows = tab.rows;
    if (idc && vc) {
      const by = new Map();
      rows.forEach(r => { const k = String(r[tcol]); if (!by.has(k)) by.set(k, { [tcol]: r[tcol] }); const o = by.get(k); if (r[idc] != null && r[vc] != null && r[vc] !== '') o[r[idc] + (fc && r[fc] ? '.' + r[fc] : '')] = r[vc]; if (ec && r[ec]) o[ec] = r[ec]; });
      rows = [...by.values()];
    }
    const tOf = v => { if (typeof v === 'number') return v; const sv = String(v); let m; if ((m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(sv))) return (+m[1] * 3600 + +m[2] * 60 + (+m[3] || 0)) * 1000; const t = Date.parse(sv.length === 10 ? sv + 'T00:00:00Z' : sv); return isNaN(t) ? null : t; };
    rows = rows.map((r, i) => ({ r, t: tOf(r[tcol]), i })).sort((a, b) => (a.t == null || b.t == null ? a.i - b.i : a.t - b.t)).map(x => x.r);
    if (rows.length > MAX_FRAMES) rows = rows.filter((_, i) => i % Math.ceil(rows.length / MAX_FRAMES) === 0);
    const labels = rows.map(r => clip(String(r[tcol]).replace(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2}).*$/, '$3/$2 $4'), 14));
    const edgeIds = new Set((inst.model.edges || []).map(e => e.id)), FIELDS = /^(heat|rate|value|progress|change|spark|weight|alert)$/;
    const series = [];
    const seen = new Set();
    cols.concat(rows.flatMap(r => Object.keys(r))).forEach(k => {
      if (seen.has(k) || k === tcol || k === ec || k === idc || k === vc || k === fc) return;
      seen.add(k);
      const dot = k.lastIndexOf('.'); let id = k, field = null;
      if (dot > 0 && FIELDS.test(k.slice(dot + 1))) { id = k.slice(0, dot); field = k.slice(dot + 1); }
      const edge = edgeIds.has(id) && !M.has(id);
      if (!edge && !M.has(id)) return;
      field = field || (edge ? 'rate' : (ts.field || 'heat'));
      let lastV = null;
      const vals = rows.map(r => { const v = r[k]; if (v == null || v === '') return lastV; lastV = field === 'alert' ? (String(v) === '-' ? null : String(v)) : (typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))); return lastV; });
      series.push({ id, field, edge, vals });
    });
    const win = Math.max(2, ts.window || 12);
    const SHORT = { heat: 'hv', rate: 'r', value: 'v', progress: 'pr', change: 'ch', weight: 'wt', alert: 'al' };
    const frames = rows.map((_, i) => {
      const n = {}, e = {};
      for (const s of series) {
        const val = s.vals[i];
        if (val == null) continue;
        const tgt = s.edge ? e : n;
        tgt[s.id] = tgt[s.id] || {};
        if (s.field === 'spark') continue;
        tgt[s.id][SHORT[s.field] || s.field] = s.field === 'progress' && val > 1 ? val / 100 : val;
        if (!s.edge && (s.field === 'heat' || s.field === 'value') && !series.some(x => x.id === s.id && x.field === 'spark')) {
          /* la serie de la pieza: la ventana de sus últimos valores */
          if (s.field === (series.some(x => x.id === s.id && x.field === 'value') ? 'value' : 'heat')) tgt[s.id].sp = s.vals.slice(Math.max(0, i - win + 1), i + 1).filter(x => x != null);
        }
      }
      return { n, e };
    });
    const total = rows.map((_, i) => series.filter(s => s.edge && s.field === 'rate').reduce((a, s) => a + (s.vals[i] || 0), 0));
    const events = [];
    if (ec) rows.forEach((r, i) => { if (r[ec]) events.push({ i, l: clip(String(r[ec]), 60), tn: 'info', n: [] }); });
    (Array.isArray(ts.events) ? ts.events : []).forEach(ev => {
      if (!ev) return;
      let i = labels.indexOf(String(ev.time));
      if (i < 0) { const t = tOf(ev.time); if (t != null) { i = rows.findIndex(r => tOf(r[tcol]) >= t); if (i < 0) i = rows.length - 1; } }
      if (i >= 0) events.push({ i, l: clip(String(ev.label || ''), 60), tn: ev.tone || 'info', n: (ev.nodes || []).filter(id => M.has(id)) });
    });
    const start = ts.start === 'start' ? 0 : rows.length - 1;
    timelineCache = { l: ts.label ? clip(ts.label, 60) : undefined, labels, frames, total, events, start, step: ts.step || 900 };
    return timelineCache;
  }

  /* el resto de datos que el terminal necesita: el grafo completo (para impacto, trazado y flujo) y los textos */
  function modelScene() {
    const M = inst.model.M;
    const all = (inst.model.edges || []).slice(0, 2000).map(e => [e.from, e.to, e.kind || '']);
    const par = {}; for (const n of M.values()) if (n.parent != null) par[n.id] = n.parent;
    const labels = {}; for (const n of M.values()) labels[n.id] = clip(n.label, 60);
    return { all, par, labels };
  }

  function themeScene() {
    const out = {};
    for (const t of ['light', 'dark']) {
      const k = t + ':' + (inst.fx && inst.fx.skin || '');
      if (!tokenCache.has(k)) tokenCache.set(k, tokensFor(w, host, t));
      out[t] = tokenCache.get(k);
    }
    return out;
  }

  /* ---------- el layout en celdas ----------
     El de ELK en píxeles, encajado en un terminal, deja las piezas en fichas truncadas. Este es el mismo grafo
     (lo visible: carriles, contenedores abiertos, piezas y aristas) colocado otra vez por ELK pero en unidades de
     celda: cada pieza tan ancha como su texto, separaciones de una celda, etiquetas de arista sobre la línea.
     Dos densidades: `cards` (tarjetas de 3–6 filas con sus datos) y `chips` (una fila por pieza). */
  let elk = null;
  const cw = s => { let n = 0; for (const ch of String(s || '')) { const c = ch.codePointAt(0); n += (c >= 0x1100 && c <= 0x115f) || (c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xac00 && c <= 0xd7a3) || (c >= 0xf900 && c <= 0xfaff) || (c >= 0xff00 && c <= 0xff60) || (c >= 0x1f300 && c <= 0x1faff) ? 2 : c >= 0x300 && c <= 0x36f ? 0 : 1; } return n; };
  const MARK = /^(start|end|junction|choice|fork|commit|commit-merge|commit-highlight|commit-reverse)$/;
  function leafCells(n, density) {
    const lw = cw(n.l) + 2 + (n.k && !n.o ? String(n.k).length + 3 : 0);
    /* una marca mide dos celdas: la arista entra por su centro, que es donde se pinta el glifo (la etiqueta va a su derecha) */
    if (MARK.test(n.sh || '')) return { w: 2, h: 1 };
    if (density === 'chips') return { w: Math.max(6, Math.min(28, lw + 3 + (n.hv != null ? cw(String(Math.round(n.hv))) + 1 : 0))), h: 1 };
    if (density === 'mini') return { w: Math.max(5, Math.min(14, lw + 1)), h: 1 };
    if (n.sh === 'table' || n.sh === 'class' || n.sh === 'requirement') {
      const rows = (n.rw || []).slice(0, 8);
      return { w: Math.max(14, Math.min(40, Math.max(lw + 4, ...rows.map(r => cw(`${r.vi || ''}${r.n}${r.t ? ': ' + r.t : ''}${r.k ? '  ' + r.k : ''}`) + 4)))), h: Math.min(12, rows.length + 4 + (n.s ? 1 : 0)) };
    }
    if (n.sh === 'donut') return { w: 30, h: Math.max(6, Math.min(8, (n.pt || []).length + 2)) };
    if (n.sh === 'kpi' || n.sh === 'gauge') return { w: Math.max(18, Math.min(30, lw + 4)), h: 4 + (n.sh === 'kpi' && n.sp ? 1 : 0) };
    if (n.sh === 'person' || n.sh === 'c4' || n.sh === 'c4-db' || n.sh === 'c4-queue') return { w: Math.max(18, Math.min(34, lw + 4)), h: 3 + (n.s ? 1 : 0) + (n.sm ? Math.min(3, Math.ceil(cw(n.sm) / 28)) : 0) };
    let h = 3 + (n.s ? 1 : 0) + (n.sp && n.sp.length > 1 ? 1 : 0) + (n.st ? 1 : 0);
    /* sitio para la serie y su última cifra */
    if (n.sp && n.sp.length > 1) return { w: Math.max(24, Math.min(36, lw + 5)), h: Math.min(6, h) };
    if (n.sh === 'score' || n.sh === 'ticket') h = Math.max(h, 4);
    return { w: Math.max(12, Math.min(36, lw + 5 + (n.sh && /decision|hexagon|io|trapezoid|cloud|terminal|rounded/.test(n.sh) ? 2 : 0))), h: Math.min(6, h) };
  }
  async function cellLayout(g, density, dirName) {
    const nodes = g.nodes, ids = new Set(nodes.map(n => n.i));
    if (!nodes.length || nodes.length > 600) return null;
    if (!elk) elk = new (await GraphX.loadELK())();
    const dir = dirName === 'down' ? 'DOWN' : 'RIGHT';
    const byParent = new Map();
    const parentOf = n => (n.p != null && ids.has(n.p) ? n.p : n.la != null && n.la !== n.i && ids.has(n.la) ? n.la : null);
    for (const n of nodes) { const p = parentOf(n); if (!byParent.has(p)) byParent.set(p, []); byParent.get(p).push(n); }
    const chips = density !== 'cards', mini = density === 'mini';
    const byId = new Map(nodes.map(n => [n.i, n]));
    const isAncestor = (a, b) => { let c = byId.get(b); for (let k = 0; c && k < 40; k++) { const p = parentOf(c); if (p === a) return true; c = p != null ? byId.get(p) : null; } return false; };
    const lanes = nodes.filter(n => n.ln);
    const right = dir === 'RIGHT';
    /* las separaciones no se heredan: cada contenedor lleva las suyas (si no, ELK pone las de 20 px) */
    const SPACING = {
      'elk.spacing.nodeNode': right ? (mini ? '0' : '1') : (mini ? '2' : '3'), 'elk.layered.spacing.nodeNodeBetweenLayers': right ? (mini ? '3' : chips ? '5' : '6') : (mini ? '1' : chips ? '2' : '3'),
      'elk.spacing.edgeNode': '1', 'elk.spacing.edgeEdge': '1', 'elk.layered.spacing.edgeNodeBetweenLayers': right ? '2' : '1', 'elk.layered.spacing.edgeEdgeBetweenLayers': '1',
      'elk.spacing.edgeLabel': '0', 'elk.spacing.labelNode': '0', 'elk.spacing.labelLabel': '0', 'elk.spacing.componentComponent': right ? '2' : '3', 'elk.spacing.portPort': '1',
      'elk.edgeLabels.inline': 'true', 'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX'
    };
    const make = n => {
      const kids = byParent.get(n.i) || [];
      if (n.g && kids.length) {
        /* el título entero: « ▾ nombre · N »  */
        const head = cw(n.l) + 10 + String(kids.length).length;
        const pad = n.ln ? (mini ? '[top=1,left=1,bottom=0,right=1]' : chips ? '[top=2,left=1,bottom=1,right=1]' : '[top=3,left=2,bottom=1,right=2]') : (chips ? '[top=1,left=1,bottom=1,right=1]' : '[top=2,left=2,bottom=1,right=2]');
        const el = { id: n.i, children: kids.map(make), layoutOptions: { ...SPACING, 'elk.padding': pad, 'elk.nodeSize.constraints': 'MINIMUM_SIZE', 'elk.nodeSize.minimum': `(${head},${chips ? 3 : 4})` } };
        if (n.ln) el.layoutOptions['elk.partitioning.partition'] = String(lanes.indexOf(n));
        return el;
      }
      const z = leafCells(n, density);
      return { id: n.i, width: z.w, height: z.h };
    };
    const graph = {
      id: ' root',
      layoutOptions: {
        'elk.algorithm': 'layered', 'elk.direction': dir, 'elk.hierarchyHandling': 'INCLUDE_CHILDREN', 'elk.edgeRouting': 'ORTHOGONAL',
        'elk.json.edgeCoords': 'ROOT', 'elk.json.shapeCoords': 'ROOT', ...SPACING, 'elk.padding': '[top=1,left=1,bottom=1,right=1]',
        /* el orden en que se escribió: solo en la raíz (en un contenedor rompe el layout jerárquico) */
        'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
        'elk.partitioning.activate': lanes.length > 1 ? 'true' : 'false', 'elk.layered.cycleBreaking.strategy': 'DEPTH_FIRST'
      },
      children: (byParent.get(null) || []).map(make),
      /* una arista entre una pieza y uno de sus contenedores rompe el layout jerárquico de ELK */
      edges: g.edges.filter(e => ids.has(e.a) && ids.has(e.b) && e.a !== e.b && !isAncestor(e.a, e.b) && !isAncestor(e.b, e.a)).map(e => ({ id: e.i, sources: [e.a], targets: [e.b], labels: e.l && !chips ? [{ text: e.l, width: Math.min(30, cw(e.l)) + 2, height: 1 }] : [] }))
    };
    let res;
    /* ELK corre en el reino de jsdom: su `instanceof Array` solo reconoce las listas de allí */
    try { res = JSON.parse(w.JSON.stringify(await elk.layout(w.JSON.parse(JSON.stringify(graph))))); } catch (err) { log("cells: " + (err && err.message)); return null; }
    const pos = new Map();
    const walk = n => { if (n.id !== ' root') pos.set(n.id, { x: Math.round(n.x), y: Math.round(n.y), w: Math.round(n.width), h: Math.round(n.height) }); (n.children || []).forEach(walk); };
    walk(res);
    const edges = {};
    for (const e of res.edges || []) {
      const secs = e.sections || []; if (!secs.length) continue;
      const pts = [];
      /* las aristas pasan por el centro de la celda (y + 0,5): se trunca, no se redondea, o caerían en la fila de abajo */
      for (const sc of secs) for (const q of [sc.startPoint, ...(sc.bendPoints || []), sc.endPoint]) { const p = [Math.floor(q.x + 0.01), Math.floor(q.y + 0.01)]; const l = pts[pts.length - 1]; if (!l || l[0] !== p[0] || l[1] !== p[1]) pts.push(p); }
      /* que la arista salga y llegue por una fila de dentro de la tarjeta, no por su esquina */
      const snap = (i, j, id) => {
        const r = pos.get(id); if (!r || pts.length < 2) return;
        const p = pts[i], q = pts[j];
        const onSide = p[0] <= r.x || p[0] >= r.x + r.w - 1;
        if (!onSide) return;
        /* dentro de las filas de la pieza; en una tarjeta, por una fila de dentro (no por la esquina) */
        const lo = r.h >= 3 ? r.y + 1 : r.y, hi = r.h >= 3 ? r.y + r.h - 2 : r.y + r.h - 1;
        if (p[1] >= lo && p[1] <= hi) return;
        const ny = r.h >= 3 ? Math.round(r.y + (r.h - 1) / 2) : Math.max(lo, Math.min(hi, p[1]));
        if (q[1] === p[1] && pts.length > 2) q[1] = ny;
        else if (q[1] === p[1]) {
          const other = pos.get(i === 0 ? e.targets[0] : e.sources[0]);
          /* la otra punta también ha de quedar en una fila de dentro de su pieza, no en su borde */
          const olo = other && (other.h >= 3 ? other.y + 1 : other.y), ohi = other && (other.h >= 3 ? other.y + other.h - 2 : other.y + other.h - 1);
          if (other && ny >= olo && ny <= ohi) q[1] = ny;
          else {
            /* recta entre piezas de filas distintas: un codo a dos celdas de la pieza */
            const dx = i === 0 ? 2 : -2, bx = p[0] + dx;
            if (i === 0) pts.splice(1, 0, [bx, ny], [bx, p[1]]);
            else pts.splice(pts.length - 1, 0, [bx, p[1]], [bx, ny]);
          }
        }
        p[1] = ny;
      };
      snap(0, 1, e.sources[0]); snap(pts.length - 1, pts.length - 2, e.targets[0]);
      /* sin puntos repetidos ni intermedios en línea recta (los deja el ajuste) */
      for (let k = pts.length - 2; k >= 1; k--) {
        const a = pts[k - 1], b = pts[k], c = pts[k + 1];
        if ((a[0] === b[0] && a[1] === b[1]) || (b[0] === c[0] && b[1] === c[1]) || (a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1])) pts.splice(k, 1);
      }
      if (pts.length === 2 && pts[0][0] === pts[1][0] && pts[0][1] === pts[1][1]) pts.pop();
      const lab = (e.labels || [])[0];
      edges[e.id] = lab ? { p: pts, lx: Math.floor(lab.x + lab.width / 2), ly: Math.floor(lab.y + lab.height / 2) } : { p: pts };
    }
    return { density, dir: dirName, w: Math.round(res.width), h: Math.round(res.height), nodes: Object.fromEntries([...pos].map(([k, v]) => [k, [v.x, v.y, v.w, v.h]])), edges };
  }

  async function sceneOf(board, rev) {
    const S = inst.state;
    const tr = (es, en) => (GXBoard.langOf(board) === 'es' ? es : en);
    const fx = inst.fx || null;
    const g = board.guide || { steps: [], at: -1 };
    const own = !(g.steps || []).length && spec.tour && spec.tour.steps ? spec.tour.steps : null;
    const step = g.at >= 0 && g.steps[g.at] ? { at: g.at, n: g.steps.length, t: g.steps[g.at].title || tr(`Paso ${g.at + 1}`, `Step ${g.at + 1}`), b: clip(g.steps[g.at].body || '', 600) }
      : own && g.at >= 0 && own[g.at] ? { at: g.at, n: own.length, t: own[g.at].title, b: clip(plainMd(own[g.at].body_html || ''), 600) }
        : { at: -1, n: (g.steps || []).length || (own ? own.length : 0) };
    const visibleOf = id => { const M = inst.model.M; let cur = id; while (cur != null && M.has(cur)) { if (S.rects.has(cur) || S.visible.has(cur)) return cur; cur = M.get(cur).parent; } return null; };
    const signs = (board.signs || []).filter(s => s.step == null || s.step === g.at).map((s, i) => ({ i: s.id, pin: s.pin || String((board.signs || []).indexOf(s) + 1), tn: s.tone || 'info', t: s.title, x: clip(GXBoard.plain(s.text), 200), at: s.at ? visibleOf(s.at) : null, in: s.at ? visibleOf(s.at) !== s.at : false }));
    const view = S.view || 'graph';
    const flat = !!(spec && spec.layout && spec.layout.mode === 'tree');
    const base = {
      v: 1, rev, mountRev, title: board.title || (spec && spec.title) || '', sm: spec && spec.summary ? clip(plainMd(spec.summary), 240) : undefined,
      diagram: type, dir: S.dir, step, signs, banner: board.banner || null, warnings: warnings.length,
      depth: S.depthSet != null ? S.depthSet : undefined, maxDepth: inst.model.maxDepth, levels: (inst.model.levels || []).map(l => (typeof l === 'string' ? l : l && l.label)).slice(0, 8),
      fx: fx ? Object.fromEntries(Object.entries(fx).map(([k, v]) => [k, v && typeof v === 'object' ? (Array.isArray(v) ? v : Object.assign({}, v)) : v])) : null,
      heat: heatLut(), owners: spec.owners || null, statuses: spec.statuses ? Object.fromEntries(Object.entries(spec.statuses).map(([k, v]) => [k, { l: v.label || k, c: colorOf(v.color), pu: v.pulse ? 1 : undefined }])) : null,
      legend: spec.legend || null, theme: themeScene(), skin: fx && fx.skin || null,
      flows: (spec.flows || []).map(f => ({ i: f.id, t: clip(f.title || f.id, 40) })), graphTab: spec.graphTab !== false,
      tour: g.steps && g.steps.length ? { t: g.title || tr('Recorrido', 'Tour'), steps: g.steps.map((s, i) => ({ t: clip(s.title || tr(`Paso ${i + 1}`, `Step ${i + 1}`), 60), n: s.nodes || [], e: s.edges || [] })) } : (spec.tour && spec.tour.steps ? { t: spec.tour.title || tr('Recorrido', 'Tour'), steps: spec.tour.steps.map(s => ({ t: clip(s.title, 60), b: clip(plainMd(s.body_html || ''), 400), n: (s.focus && s.focus.nodes) || [], e: (s.focus && s.focus.edges) || [] })), own: 1 } : null),
      timeline: timelineScene(), model: modelScene(), view, rsvg
    };
    if (flat) return Object.assign(base, { kind: 'tree', rows: treeRows() });
    if (view.startsWith('flow:')) { const sq = seqScene(view.slice(5)); if (sq) return Object.assign(base, { kind: 'seq', sq }); }
    const gs = graphScene();
    if (gs.mode === 'graph') {
      /* las cuatro colocaciones: tarjetas y fichas, en horizontal y en vertical; el terminal elige la que cabe */
      const both = gs.nodes.length <= 220;
      const [rc, rh, rm, dc, dh, dm] = await Promise.all([cellLayout(gs, 'cards', 'right'), cellLayout(gs, 'chips', 'right'), cellLayout(gs, 'mini', 'right'), both ? cellLayout(gs, 'cards', 'down') : null, both ? cellLayout(gs, 'chips', 'down') : null, both ? cellLayout(gs, 'mini', 'down') : null]);
      if (rc || rh || dc || dh) gs.cells = { right: { cards: rc, chips: rh, mini: rm }, down: { cards: dc, chips: dh, mini: dm } };
    }
    return Object.assign(base, { kind: 'graph' }, gs);
  }

  /* el detalle de una pieza: todo lo que el panel lateral enseña (bloques incluidos), bajo demanda */
  function detail(id) {
    if (!inst) return null;
    const M = inst.model.M; const n = M.get(id);
    if (!n) {
      const e = (spec.edges || []).find(x => x.id === id);
      if (!e) return null;
      return { i: id, edge: 1, l: e.label || `${e.from} → ${e.to}`, from: e.from, to: e.to, k: e.kind, sm: plainMd(e.summary || ''), dt: e.data, tr: e.trigger, r: e.rate };
    }
    const ins = [], outs = [];
    for (const e of inst.model.edges || []) { if (e.to === id) ins.push({ i: e.from, l: (M.get(e.from) || {}).label, k: e.kind, e: e.id }); if (e.from === id) outs.push({ i: e.to, l: (M.get(e.to) || {}).label, k: e.kind, e: e.id }); }
    const path = []; let p = n.parent; while (p != null && M.has(p)) { path.unshift({ i: p, l: M.get(p).label }); p = M.get(p).parent; }
    const owner = n.owner && spec.owners && spec.owners[n.owner];
    const st = n.status && spec.statuses && spec.statuses[n.status];
    const steps = (inst.model.nodeSteps && inst.model.nodeSteps.get && inst.model.nodeSteps.get(id)) || [];
    return {
      i: id, l: n.label, s: n.subtitle, kd: n.kind, sh: n.shape, sm: plainMd(n.summary || ''), html: n.details_html ? clip(plainMd(n.details_html), 2000) : undefined,
      st: st ? (st.label || n.status) : n.status, dl: n.delta, path, ins: ins.slice(0, 40), outs: outs.slice(0, 40),
      metrics: n.metrics, notes: n.notes, links: (n.links || []).slice(0, 20).map(l => { try { const r = GraphX.resolveLink(l, spec.links || {}); return { k: l.kind, l: r && r.label || l.label || l.key || l.url, u: r && r.url || l.url, st: l.status, nt: l.note }; } catch (_) { return { k: l.kind, l: l.label || l.url, u: l.url }; } }),
      files: (n.files || []).slice(0, 30), blocks: n.blocks || null, tags: n.tags, rows: n.rows,
      owner: owner ? { i: n.owner, l: owner.label || n.owner, c: owner.contact, u: owner.url } : n.owner ? { i: n.owner, l: n.owner } : null,
      data: nodeData(n), steps: [...steps].slice(0, 12), kids: (n.children || []).length
    };
  }

  return {
    rsvg,
    /* monta (si hace falta), aplica recorrido, vista, datos y la vista del panel, y devuelve la escena */
    async render(board, rev, ui) {
      if (!board) { if (inst) { inst.destroy(); inst = null; } key = null; return { report: null, scene: { v: 1, rev, kind: 'empty' } }; }
      const k = GXBoard.structKey(board);
      let fresh = false;
      if (k !== key) { key = k; fresh = true; mountRev = rev; ui.open.clear(); ui.close.clear(); ui.depth = undefined; ui.search = ''; ui.view = undefined; ui.dir = undefined; ui.owners = undefined; await mount(board); }
      if (!inst) return { report: report(rev), scene: { v: 1, rev, kind: 'error', error } };
      await applyBoard(board);
      await applyUi(ui);
      const scene = await sceneOf(board, rev);
      scene.fresh = fresh;
      return { report: report(rev), scene };
    },
    detail,
    spec: () => spec,
    /* el JSON de un tablero con todo lo acumulado (parches, datos en vivo, efectos), sin montar nada */
    specOf(board) { try { return JSON.parse(w.JSON.stringify(GXBoard.buildSpec(board).spec)); } catch (_) { return null; } },
    /* Mermaid → JSON de GraphX con el conversor del bundle, sin tocar el lienzo */
    convert(text, lang) {
      try {
        const r = GraphX.fromMermaid(String(text || ''), { lang: lang === 'es' ? 'es' : 'en' });
        const s = r.spec;
        const count = {
          nodes: (s.nodes || []).length, edges: (s.edges || []).length, lanes: (s.lanes || []).length, flows: (s.flows || []).length,
          shapes: [...new Set((s.nodes || []).map(n => n.shape).filter(Boolean))], layout: s.layout && s.layout.mode || 'graph',
          rich: (s.nodes || []).filter(n => ['heat', 'spark', 'progress', 'alert', 'owner', 'blocks', 'value', 'parts'].some(k => n[k] != null)).length,
          fx: s.fx === false ? 'off' : s.fx ? Object.keys(s.fx) : []
        };
        return { spec: JSON.parse(JSON.stringify(s)), type: r.type, warnings: r.warnings || [], count };
      } catch (err) { return { error: String(err && err.message || err), line: err && err.line }; }
    },
    /* el SVG de lo que hay pintado (grafo o secuencia), autocontenido: estilos podados y animaciones */
    svg(theme = 'light', opts = {}) {
      if (!inst) return null;
      const seq = (inst.state.view || 'graph').startsWith('flow:');
      const src = host.querySelector(seq ? '.gx-svg.gx-seq' : '.gx-stage > .gx-svg:not(.gx-seq)');
      if (!src) return null;
      return standaloneSVG(w, host, src, { theme, seq, bbox: seq ? null : inst.state.bbox, ...opts });
    },
    async png(theme = 'light', opts = {}) {
      if (!rsvg || !inst) return null;
      const s = this.svg(theme, { flat: true, maxChars: Infinity });
      if (!s) return null;
      return rasterize(s.svg, opts);
    },
    /* un diagrama suelto (un bloque ```mermaid de una respuesta), sin tocar el del lienzo */
    async inline(text, theme = 'light', lang = 'en') {
      const saved = { inst, host, key, spec, type, warnings, error, viewSeq, guideSeq, mountRev, dataKey, uiKey, tokenCache, timelineCache };
      inst = null; host = null;
      try {
        const board = { source: { kind: 'mermaid', text: String(text || '') }, lang: lang === 'es' ? 'es' : 'en', patches: [], signs: [], banner: null, guide: { steps: [], at: -1, seq: 0 }, view: { seq: 0 } };
        await mount(board);
        if (!inst) return { error };
        const sc = await sceneOf(board, 0);
        sc.fresh = false;
        const sv = this.svg(theme, {});
        return { scene: sc, svg: sv ? { svg: sv.svg, fits: sv.fits } : null };
      } finally {
        try { if (inst) inst.destroy(); } catch (_) { }
        if (host) host.remove();
        ({ inst, host, key, spec, type, warnings, error, viewSeq, guideSeq, mountRev, dataKey, uiKey, tokenCache, timelineCache } = saved);
      }
    },
    async act(a) {
      if (!inst) return false;
      if (a.type === 'step') { if (a.at >= 0) await inst.goStep(a.at); else inst.resetView(); return true; }
      return false;
    }
  };
}
