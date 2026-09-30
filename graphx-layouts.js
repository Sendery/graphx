/* GraphX · layouts propios por tipo de diagrama.
 *
 * ELK coloca bien un grafo de piezas y flechas. Otros diagramas de Mermaid no son eso: un gantt es
 * una fila por tarea sobre un eje de fechas, un gitGraph un carril por rama en orden cronológico,
 * un sankey columnas con cintas proporcionales… Cada función de aquí recibe las piezas visibles y
 * devuelve dónde va cada una, por dónde van las aristas y una capa de fondo (ejes, marcas, curvas).
 * El motor la usa en vez de ELK cuando el diagrama lo pide con `layout.mode`, y todo lo demás
 * (tooltip, panel, selección, plegar y desplegar, animación) funciona igual.
 *
 *   GraphX.layouts[mode](ctx) → { rects: Map<id,{x,y,w,h}>, paths: Map<edgeId,{pts|d,label,width}>, bbox, deco }
 *   ctx: { M, roots, vis, exp, vedges, size(id), textW, spec, now, cvar(id), lang }
 *
 * Son funciones puras (no tocan el DOM) y `deco` es el mismo árbol SVG descriptivo que usan las
 * formas: `{ tag, attrs, children, text }`.                                                        */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GraphX = Object.assign(root.GraphX || {}, { layouts: api });
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const DAY = 864e5, HEAD = 44;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const r1 = v => Math.round(v * 10) / 10;
  const E = (tag, attrs, children, text) => ({ tag, attrs: attrs || {}, children: children || [], text: text == null ? undefined : String(text) });
  const toMs = v => {
    if (v == null) return null;
    if (typeof v === 'number') return v;
    const s = String(v), t = Date.parse(s.length === 10 ? s + 'T00:00:00Z' : s.replace(' ', 'T') + (/Z|[+-]\d\d:?\d\d$/.test(s) ? '' : 'Z'));
    return isNaN(t) ? null : t;
  };
  function helpers(ctx) {
    const { M, vis, exp } = ctx;
    const kids = id => M.get(id).children.filter(c => vis.has(c));
    const open = id => exp.has(id) && kids(id).length > 0;
    return { kids, open };
  }
  function bboxOf(rects, extra) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const r of rects.values()) { x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h); }
    (extra || []).forEach(b => { x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); });
    if (x0 === Infinity) return { x: 0, y: 0, w: 400, h: 200 };
    return { x: x0 - 24, y: y0 - 24, w: x1 - x0 + 48, h: y1 - y0 + 48 };
  }
  const midLabel = (v, a, b, textW) => {
    if (!v.label) return null;
    const w = Math.ceil(textW(v.label, 11, 500)) + 16;
    return { x: (a.x + b.x) / 2 - w / 2, y: (a.y + b.y) / 2 - 10, w, h: 20 };
  };
  const center = r => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
  const L10N = {
    es: { months: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'], today: 'hoy' },
    en: { months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], today: 'today' }
  };

  /* ---------- gantt: una fila por tarea sobre un eje de fechas común ---------- */
  function gantt(ctx) {
    const { M, roots, vis, vedges, textW, spec } = ctx, { kids, open } = helpers(ctx), L = L10N[ctx.lang] || L10N.es;
    let lo = Infinity, hi = -Infinity;
    for (const n of M.values()) if (n.span) [n.span.start, n.span.end].forEach(v => { const t = toMs(v); if (t != null) { lo = Math.min(lo, t); hi = Math.max(hi, t); } });
    if (!(lo < Infinity)) { lo = Date.UTC(2020, 0, 1); hi = lo + 30 * DAY; }
    if (hi <= lo) hi = lo + DAY;
    const days = (hi - lo) / DAY, chartW = clamp(days * 34, 640, 1600), k = chartW / (hi - lo);
    const X0 = 24, TOP = 46, ROW = 36, BAR = 24;
    const xOf = t => X0 + (t - lo) * k;
    const rects = new Map();
    let y = TOP + 6;
    const placeTask = id => {
      const n = M.get(id), s = n.span ? toMs(n.span.start) : null, e = n.span ? toMs(n.span.end != null ? n.span.end : n.span.start) : null;
      if (s == null) { const z = ctx.size(id); rects.set(id, { x: X0, y: y + (ROW - Math.min(z.h, BAR)) / 2, w: z.w, h: Math.min(z.h, BAR) }); }
      else if ((n.span.milestone) || e == null || e - s < 1) rects.set(id, { x: xOf(s) - 12, y: y + (ROW - 24) / 2, w: 24, h: 24 });
      else rects.set(id, { x: xOf(s), y: y + (ROW - BAR) / 2, w: Math.max((e - s) * k, 8), h: BAR });
      y += ROW;
    };
    const W = X0 + chartW + 24;
    for (const r of roots.filter(v => vis.has(v))) {
      if (open(r)) {
        const y0 = y; y += HEAD - 4;
        kids(r).forEach(placeTask);
        y += 10;
        rects.set(r, { x: 6, y: y0, w: W - 6, h: y - y0 });
        y += 12;
      } else placeTask(r);
    }
    const bottom = y;
    /* eje: marcas de fecha, fines de semana, hoy */
    const deco = [], step = [1, 2, 7, 14, 30, 61, 91, 182, 365].find(d => d * DAY * k >= 62) || 365;
    const first = new Date(lo); first.setUTCHours(0, 0, 0, 0);
    let t = first.getTime();
    if (step === 7 || step === 14) while (new Date(t).getUTCDay() !== 1) t += DAY;
    if (spec.layout && spec.layout.weekends) {
      for (let d = first.getTime(); d < hi; d += DAY) { const dow = new Date(d).getUTCDay(); if (dow === 0 || dow === 6) deco.push(E('rect', { class: 'gx-lg-wknd', x: r1(xOf(Math.max(d, lo))), y: TOP - 8, width: r1(Math.max(0, Math.min(d + DAY, hi) - Math.max(d, lo)) * k), height: bottom - TOP + 8 })); }
    }
    /* por meses, cada marca cae el día 1 (un mes no son 30 días) */
    const nextT = t0 => { if (step < 30) return t0 + step * DAY; const d = new Date(t0), m = { 30: 1, 61: 2, 91: 3, 182: 6, 365: 12 }[step] || 1; return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + m, 1); };
    if (step >= 30) { const d = new Date(lo); t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); }
    for (; t <= hi; t = nextT(t)) {
      if (t < lo) continue;
      const x = r1(xOf(t)), d = new Date(t);
      deco.push(E('path', { class: 'gx-lg-grid', d: `M${x},${TOP - 8}V${bottom}` }));
      deco.push(E('text', { class: 'gx-lg-tick', x, y: TOP - 16, 'text-anchor': 'middle' }, null, step >= 30 ? `${L.months[d.getUTCMonth()]} ${d.getUTCFullYear()}` : `${d.getUTCDate()} ${L.months[d.getUTCMonth()]}`));
    }
    deco.push(E('path', { class: 'gx-lg-axis', d: `M${X0},${TOP - 8}H${X0 + chartW}` }));
    if (ctx.now >= lo && ctx.now <= hi) {
      const x = r1(xOf(ctx.now));
      deco.push(E('path', { class: 'gx-lg-today', d: `M${x},${TOP - 10}V${bottom}` }), E('text', { class: 'gx-lg-todayt', x, y: TOP - 30, 'text-anchor': 'middle' }, null, L.today));
    }
    /* dependencias: del final de una barra al principio de la siguiente, en escuadra */
    const paths = new Map();
    for (const v of vedges) {
      const a = rects.get(v.from), b = rects.get(v.to); if (!a || !b) continue;
      if (v.list.every(e => e.emphasis === 'muted')) continue;
      const ay = a.y + a.h / 2, by = b.y + b.h / 2, ax = a.x + a.w, bx = b.x;
      const pts = bx >= ax + 18 ? [{ x: ax, y: ay }, { x: ax + 9, y: ay }, { x: ax + 9, y: by }, { x: bx, y: by }]
        : [{ x: ax, y: ay }, { x: ax + 9, y: ay }, { x: ax + 9, y: b.y - 5 }, { x: bx - 9, y: b.y - 5 }, { x: bx - 9, y: by }, { x: bx, y: by }];
      paths.set(v.id, { pts, label: null });
    }
    return { rects, paths, bbox: bboxOf(rects, [{ x: 0, y: TOP - 40, w: W, h: 10 }]), deco };
  }

  /* ---------- gitGraph: un carril por rama, los commits en orden cronológico ---------- */
  function git(ctx) {
    const { M, roots, vis, vedges } = ctx, { open } = helpers(ctx);
    const lanes = roots.filter(r => vis.has(r) && M.get(r).isLane);
    const LABEL = 150, COL = 88, ROW = 84;
    const rects = new Map(), laneY = new Map(lanes.map((l, i) => [l, 12 + i * ROW]));
    const commits = [...M.values()].filter(n => !n.isLane && vis.has(n.id)).sort((a, b) => a.order - b.order);
    const W = LABEL + 30 + Math.max(commits.length, 1) * COL;
    commits.forEach((n, i) => {
      const z = ctx.size(n.id), cy = (laneY.get(n.laneId) != null ? laneY.get(n.laneId) : 12) + ROW / 2 - 4, cx = LABEL + 30 + i * COL + COL / 2;
      rects.set(n.id, { x: cx - z.w / 2, y: cy - z.h / 2, w: z.w, h: z.h });
    });
    lanes.forEach(l => {
      if (open(l)) rects.set(l, { x: 6, y: laneY.get(l), w: W, h: ROW - 8 });
      else { const z = ctx.size(l); rects.set(l, { x: 6, y: laneY.get(l) + (ROW - 8 - z.h) / 2, w: z.w, h: z.h }); }
    });
    /* misma rama: recta de punto a punto; de una rama a otra (al abrirla o al fusionar), una curva */
    const paths = new Map();
    for (const v of vedges) {
      const a = rects.get(v.from), b = rects.get(v.to); if (!a || !b) continue;
      /* una rama plegada es una tarjeta al margen: su historia no se dibuja como línea */
      if (M.get(v.from).isLane || M.get(v.to).isLane) continue;
      const ca = center(a), cb = center(b);
      if (Math.abs(ca.y - cb.y) < 1) { paths.set(v.id, { pts: [ca, cb], label: null }); continue; }
      const sx = ca.x + 11, ex = cb.x - 11, dx = Math.max((ex - sx) * .55, 20);
      paths.set(v.id, { d: `M${r1(sx)},${r1(ca.y)} C${r1(sx + dx)},${r1(ca.y)} ${r1(ex - dx)},${r1(cb.y)} ${r1(ex)},${r1(cb.y)}`, label: null });
    }
    return { rects, paths, bbox: bboxOf(rects), deco: [] };
  }

  /* ---------- sankey: columnas por profundidad, barras y cintas proporcionales ---------- */
  function sankey(ctx) {
    const { M, vis, vedges } = ctx;
    const nodes = [...M.values()].filter(n => vis.has(n.id) && !(ctx.exp.has(n.id) && n.children.some(c => vis.has(c))) && !n.isLane).sort((a, b) => a.order - b.order);
    const wOf = v => v.list.reduce((s, e) => s + (typeof e.weight === 'number' ? e.weight : 1), 0);
    const ins = new Map(), outs = new Map();
    nodes.forEach(n => { ins.set(n.id, []); outs.set(n.id, []); });
    const links = vedges.filter(v => ins.has(v.to) && outs.has(v.from) && v.from !== v.to);
    links.forEach(v => { outs.get(v.from).push(v); ins.get(v.to).push(v); });
    /* columna = camino más largo desde un origen; las aristas que cierran un ciclo (retornos de un
       recorrido en profundidad) no cuentan, y las columnas que quedan vacías se compactan */
    const back = new Set(), state = new Map();
    const dfs = id => { state.set(id, 1); outs.get(id).forEach(v => { const s = state.get(v.to); if (s === 1) back.add(v.id); else if (!s) dfs(v.to); }); state.set(id, 2); };
    nodes.forEach(n => { if (!state.get(n.id)) dfs(n.id); });
    const fwd = links.filter(v => !back.has(v.id));
    const depth = new Map(nodes.map(n => [n.id, 0]));
    for (let it = 0; it < nodes.length; it++) { let ch = false; fwd.forEach(v => { if (depth.get(v.to) < depth.get(v.from) + 1) { depth.set(v.to, depth.get(v.from) + 1); ch = true; } }); if (!ch) break; }
    const used = [...new Set(depth.values())].sort((a, b) => a - b), dense = new Map(used.map((d, i) => [d, i]));
    depth.forEach((d, id) => depth.set(id, dense.get(d)));
    const ncol = used.length || 1;
    const value = id => Math.max(ins.get(id).reduce((s, v) => s + wOf(v), 0), outs.get(id).reduce((s, v) => s + wOf(v), 0), 1);
    const cols = Array.from({ length: ncol }, () => []);
    nodes.forEach(n => cols[depth.get(n.id)].push(n.id));
    const H = 520, GAP = 20, W = Math.max(720, ncol * 250);
    const scale = Math.min(...cols.map(c => (H - (c.length - 1) * GAP) / (c.reduce((s, id) => s + value(id), 0) || 1)));
    const colX = i => 40 + (ncol > 1 ? i * (W - 80) / (ncol - 1) : (W - 80) / 2);
    const rects = new Map(), yMid = new Map();
    cols.forEach((c, i) => {
      /* orden en la columna: por la altura media de lo que le llega (menos cruces) */
      if (i > 0) c.sort((a, b) => { const m = id => { const src = ins.get(id).map(v => yMid.get(v.from)).filter(x => x != null); return src.length ? src.reduce((s, x) => s + x, 0) / src.length : 0; }; return m(a) - m(b); });
      const total = c.reduce((s, id) => s + value(id) * scale, 0) + (c.length - 1) * GAP;
      let y = 20 + (H - total) / 2;
      c.forEach(id => { const h = Math.max(value(id) * scale, 4); rects.set(id, { x: colX(i) - 8, y, w: 16, h }); yMid.set(id, y + h / 2); M.get(id).labelSide = i === ncol - 1 && ncol > 1 ? 'left' : 'right'; y += h + GAP; });
    });
    /* cintas: apiladas a lo largo de cada barra, en el orden vertical de su otro extremo */
    const paths = new Map(), offOut = new Map(), offIn = new Map();
    const byY = (a, b, key) => rects.get(a[key]).y - rects.get(b[key]).y;
    nodes.forEach(n => { outs.get(n.id).sort((a, b) => byY(a, b, 'to')); ins.get(n.id).sort((a, b) => byY(a, b, 'from')); });
    nodes.forEach(n => {
      let o = 0; outs.get(n.id).forEach(v => { offOut.set(v.id, o); o += wOf(v) * scale; });
      let q = 0; ins.get(n.id).forEach(v => { offIn.set(v.id, q); q += wOf(v) * scale; });
    });
    links.forEach(v => {
      const a = rects.get(v.from), b = rects.get(v.to), t = Math.max(wOf(v) * scale, 1.5);
      const sx = a.x + a.w, sy = a.y + offOut.get(v.id) + t / 2, tx = b.x, ty = b.y + offIn.get(v.id) + t / 2, dx = (tx - sx) / 2;
      paths.set(v.id, { d: `M${r1(sx)},${r1(sy)} C${r1(sx + dx)},${r1(sy)} ${r1(tx - dx)},${r1(ty)} ${r1(tx)},${r1(ty)}`, width: r1(t), label: null });
    });
    const labelRoom = [{ x: 0, y: 0, w: W + 150, h: H + 40 }];
    return { rects, paths, bbox: bboxOf(rects, labelRoom), deco: [] };
  }

  /* ---------- treemap: teselado «squarified» por valor ---------- */
  function squarify(items, box) {
    const out = [], total = items.reduce((s, x) => s + x.v, 0) || 1, area = box.w * box.h;
    const list = items.map(x => ({ id: x.id, a: x.v / total * area })).filter(x => x.a > 0).sort((a, b) => b.a - a.a);
    let r = Object.assign({}, box);
    const worst = (row, side) => { const s = row.reduce((t, x) => t + x.a, 0), mx = Math.max(...row.map(x => x.a)), mn = Math.min(...row.map(x => x.a)); return Math.max(side * side * mx / (s * s), (s * s) / (side * side * mn)); };
    let row = [];
    const flush = () => {
      if (!row.length) return;
      const s = row.reduce((t, x) => t + x.a, 0), horiz = r.w >= r.h;
      if (horiz) { const w = s / r.h; let y = r.y; row.forEach(x => { const h = x.a / w; out.push({ id: x.id, x: r.x, y, w, h }); y += h; }); r = { x: r.x + w, y: r.y, w: r.w - w, h: r.h }; }
      else { const h = s / r.w; let x0 = r.x; row.forEach(x => { const w = x.a / h; out.push({ id: x.id, x: x0, y: r.y, w, h }); x0 += w; }); r = { x: r.x, y: r.y + h, w: r.w, h: r.h - h }; }
      row = [];
    };
    for (const it of list) {
      const side = Math.min(r.w, r.h);
      if (!row.length || worst(row.concat(it), side) <= worst(row, side)) row.push(it); else { flush(); row.push(it); }
    }
    flush();
    return out;
  }
  function treemap(ctx) {
    const { M, roots, vis } = ctx, { kids, open } = helpers(ctx);
    const val = id => { const n = M.get(id); return n.children.length ? n.children.reduce((s, c) => s + val(c), 0) : (typeof n.value === 'number' ? Math.max(n.value, 0) : 0); };
    const rects = new Map(), GAP = 4;
    const place = (id, box) => {
      rects.set(id, box);
      if (!open(id)) return;
      const inner = { x: box.x + 8, y: box.y + HEAD, w: Math.max(box.w - 16, 10), h: Math.max(box.h - HEAD - 8, 10) };
      squarify(kids(id).map(c => ({ id: c, v: val(c) || 1 })), inner).forEach(c => place(c.id, { x: c.x + GAP / 2, y: c.y + GAP / 2, w: Math.max(c.w - GAP, 8), h: Math.max(c.h - GAP, 8) }));
    };
    const top = roots.filter(r => vis.has(r)), total = top.reduce((s, r) => s + val(r), 0) || 1;
    const W = 1100, H = clamp(Math.sqrt(total) * 18, 460, 760);
    if (top.length === 1) place(top[0], { x: 0, y: 0, w: W, h: H });
    else squarify(top.map(r => ({ id: r, v: val(r) || 1 })), { x: 0, y: 0, w: W, h: H }).forEach(c => place(c.id, { x: c.x + GAP / 2, y: c.y + GAP / 2, w: Math.max(c.w - GAP, 1), h: Math.max(c.h - GAP, 1) }));
    return { rects, paths: new Map(), bbox: bboxOf(rects), deco: [] };
  }

  /* ---------- timeline: periodos sobre un eje, sus eventos debajo ---------- */
  function timeline(ctx) {
    const { M, roots, vis } = ctx, { kids, open } = helpers(ctx);
    const rects = new Map(), deco = [], GAP = 18, EV_GAP = 10;
    const tops = roots.filter(r => vis.has(r));
    /* una sección (`section` en Mermaid) agrupa periodos; el conversor la marca con `section: true` */
    const hasSections = tops.some(r => M.get(r).section);
    const AXIS = hasSections ? 16 + HEAD + 18 : 30, PTOP = AXIS + 22;
    let x = 10, bottom = PTOP;
    const dots = [];
    const period = id => {
      const n = M.get(id);
      if (open(id)) {
        const ev = kids(id), w = Math.max(190, ...ev.map(c => ctx.size(c).w + 28), ctx.textW(n.label, 12.5, 700) + 90);
        let y = PTOP + HEAD;
        ev.forEach(c => { const z = ctx.size(c); rects.set(c, { x: x + 14, y, w: w - 28, h: z.h }); y += z.h + EV_GAP; });
        rects.set(id, { x, y: PTOP, w, h: y - PTOP + 4 });
        bottom = Math.max(bottom, y + 4); dots.push({ x: x + w / 2, id }); x += w + GAP;
      } else { const z = ctx.size(id); rects.set(id, { x, y: PTOP, w: z.w, h: z.h }); bottom = Math.max(bottom, PTOP + z.h); dots.push({ x: x + z.w / 2, id }); x += z.w + GAP; }
    };
    tops.forEach(r => {
      if (M.get(r).section && open(r)) {
        const x0 = x; x += 12;
        kids(r).forEach(period);
        x += 12 - GAP;
        rects.set(r, { x: x0, y: 16, w: x - x0, h: 0 });
        x += GAP + 8;
      } else period(r);
    });
    for (const [id, r] of rects) if (r.h === 0) r.h = bottom - r.y + 14;
    const x1 = x - GAP;
    deco.push(E('path', { class: 'gx-lg-tl', d: `M4,${AXIS}H${x1 + 14}` }), E('path', { class: 'gx-lg-tlhead', d: `M${x1 + 8},${AXIS - 6}L${x1 + 18},${AXIS}L${x1 + 8},${AXIS + 6}` }));
    dots.forEach(d => deco.push(E('path', { class: 'gx-lg-tlstem', d: `M${r1(d.x)},${AXIS}V${PTOP}` }), E('circle', { class: 'gx-lg-tldot', cx: r1(d.x), cy: AXIS, r: 6, style: ctx.cvar(d.id) ? `fill:${ctx.cvar(d.id)}` : undefined })));
    return { rects, paths: new Map(), bbox: bboxOf(rects, [{ x: 0, y: AXIS - 10, w: x1 + 24, h: 20 }]), deco };
  }

  /* ---------- journey: las tareas en fila y, debajo, la curva de emoción ---------- */
  function journey(ctx) {
    const { M, roots, vis } = ctx, { kids, open } = helpers(ctx);
    const rects = new Map(), deco = [], GAP = 16;
    let x = 10, rowH = 0;
    const tasks = [];
    const task = (id, y) => { const z = ctx.size(id); rects.set(id, { x, y, w: z.w, h: z.h }); tasks.push(id); rowH = Math.max(rowH, z.h); x += z.w + GAP; };
    roots.filter(r => vis.has(r)).forEach(r => {
      if (open(r)) { const x0 = x; x += 12; kids(r).forEach(c => task(c, 16 + HEAD)); x += 12 - GAP; rects.set(r, { x: x0, y: 16, w: x - x0, h: 0 }); x += GAP + 6; }
      else task(r, 16 + HEAD);
    });
    const secBottom = 16 + HEAD + rowH + 14;
    for (const r of rects.values()) if (r.h === 0) r.h = secBottom - r.y;
    /* cinco niveles: arriba, muy buena; abajo, muy mala */
    const top = secBottom + 30, LV = 30, pts = [];
    for (let s = 5; s >= 1; s--) deco.push(E('path', { class: 'gx-lg-lv', d: `M4,${top + (5 - s) * LV}H${x}` }));
    tasks.filter(id => typeof M.get(id).score === 'number').forEach(id => { const n = M.get(id), r = rects.get(id), sc = clamp(Math.round(n.score), 1, 5); pts.push({ x: r.x + r.w / 2, y: top + (5 - sc) * LV, sc, id }); });
    if (pts.length > 1) {
      let d = `M${r1(pts[0].x)},${pts[0].y}`;
      for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], mx = (a.x + b.x) / 2; d += ` C${r1(mx)},${a.y} ${r1(mx)},${b.y} ${r1(b.x)},${b.y}`; }
      deco.push(E('path', { class: 'gx-lg-jcurve', d }));
    }
    pts.forEach(p => {
      const col = ctx.cvar(p.id), mouth = p.sc >= 4 ? `M-5,3Q0,8 5,3` : p.sc === 3 ? 'M-5,4H5' : `M-5,6Q0,1 5,6`;
      deco.push(E('path', { class: 'gx-lg-jstem', d: `M${r1(p.x)},${secBottom - 14}V${p.y - 12}` }));
      deco.push(E('g', { class: 'gx-lg-face', transform: `translate(${r1(p.x)},${p.y})` }, [
        E('circle', { r: 12, class: 'gx-lg-facebg', style: col ? `fill:${col}` : undefined }),
        E('circle', { cx: -4, cy: -3, r: 1.6, class: 'gx-lg-eye' }), E('circle', { cx: 4, cy: -3, r: 1.6, class: 'gx-lg-eye' }), E('path', { d: mouth, class: 'gx-lg-mouth' })]));
    });
    return { rects, paths: new Map(), bbox: bboxOf(rects, [{ x: 0, y: top - 16, w: x, h: 4 * LV + 32 }]), deco };
  }

  /* ---------- rejilla de block-beta: columnas, anchos y huecos ---------- */
  function grid(ctx) {
    const { M, roots, vis, vedges, textW } = ctx, { kids, open } = helpers(ctx);
    const rects = new Map(), GAP = 14, PAD = 14;
    const ROUND = { circle: 1, dcircle: 1, start: 1, end: 1, junction: 1, choice: 1 };
    /* tamaño de un contenedor abierto: celdas de ancho uniforme; alto, el mayor de cada fila */
    const sizeOf = id => (open(id) ? layoutBox(id).size : ctx.size(id));
    const cache = new Map(), cells = new Map();
    /* la celda de cada pieza: la que trae (`grid`) o, si no trae, la siguiente libre */
    const place0 = (items, own) => {
      const int = (v, d) => (Number.isFinite(+v) && +v >= 0 ? Math.floor(+v) : d);
      const given = items.filter(c => M.get(c).grid);
      const cols = Math.max(1, own || 0, ...given.map(c => int(M.get(c).grid.c, 0) + Math.max(1, int(M.get(c).grid.span, 1))), own ? 0 : items.length);
      let r = 0, cc = 0;
      given.forEach(c => { const g = M.get(c).grid; const cell = { r: int(g.r, 0), c: int(g.c, 0), span: Math.max(1, int(g.span, 1)) }; cells.set(c, cell); if (cell.r > r || (cell.r === r && cell.c + cell.span > cc)) { r = cell.r; cc = cell.c + cell.span; } });
      items.filter(c => !M.get(c).grid).forEach(c => { if (cc >= cols) { r++; cc = 0; } cells.set(c, { r, c: cc, span: 1 }); cc++; });
      return cols;
    };
    const cellOf = c => cells.get(c) || { r: 0, c: 0, span: 1 };
    function layoutBox(id, list) {
      if (cache.has(id)) return cache.get(id);
      const own = id != null ? M.get(id).gridCols : (ctx.spec.layout && ctx.spec.layout.columns);
      const items = list || kids(id), cols = place0(items, own);
      const colW = Math.max(60, ...items.map(c => { const g = cellOf(c); return (sizeOf(c).w - (g.span - 1) * GAP) / g.span; }));
      const rowsN = Math.max(1, ...items.map(c => cellOf(c).r + 1));
      const rowH = Array.from({ length: rowsN }, (_, r) => Math.max(40, ...items.filter(c => cellOf(c).r === r).map(c => sizeOf(c).h)));
      const head = id != null ? HEAD : 0;
      const size = { w: PAD * 2 + cols * colW + (cols - 1) * GAP, h: head + PAD + rowH.reduce((s, h) => s + h, 0) + (rowsN - 1) * GAP + PAD - (id != null ? 6 : 0) };
      const out = { size, items, colW, rowH, head };
      cache.set(id, out);
      return out;
    }
    function place(id, x, y, list) {
      const b = layoutBox(id, list);
      if (id != null) rects.set(id, { x, y, w: b.size.w, h: b.size.h });
      const rowY = []; let acc = y + b.head + PAD - (id != null ? 6 : 0);
      b.rowH.forEach((h, i) => { rowY[i] = acc; acc += h + GAP; });
      b.items.forEach(c => {
        const g = cellOf(c), span = g.span;
        const cx = x + PAD + g.c * (b.colW + GAP), cw = span * b.colW + (span - 1) * GAP, ch = b.rowH[g.r];
        if (open(c)) { const s = layoutBox(c).size; place(c, cx + (cw - s.w) / 2, rowY[g.r] + (ch - s.h) / 2); return; }
        const z = ctx.size(c), n = M.get(c);
        if (ROUND[n.shape]) rects.set(c, { x: cx + (cw - z.w) / 2, y: rowY[g.r] + (ch - z.h) / 2, w: z.w, h: z.h });
        else rects.set(c, { x: cx, y: rowY[g.r] + (ch - z.h) / 2, w: cw, h: z.h });
      });
    }
    place(null, 0, 0, roots.filter(r => vis.has(r)));
    /* recta de centro a centro; si atraviesa otra pieza, en L por el lado libre */
    const leaves = [...rects.entries()].filter(([id]) => !open(id));
    const inside = (id, anc) => { let p = M.get(id).parent; while (p != null) { if (p === anc) return true; p = M.get(p).parent; } return false; };
    const crosses = (p, q, skip) => leaves.some(([id, r]) => {
      if ([...skip].some(s => inside(id, s))) return false;
      if (skip.has(id)) return false;
      const x0 = r.x - 4, y0 = r.y - 4, x1 = r.x + r.w + 4, y1 = r.y + r.h + 4;
      for (let t = 0; t <= 1; t += 1 / 24) { const x = p.x + (q.x - p.x) * t, y = p.y + (q.y - p.y) * t; if (x > x0 && x < x1 && y > y0 && y < y1) return true; }
      return false;
    });
    const paths = new Map();
    for (const v of vedges) {
      const a = rects.get(v.from), b = rects.get(v.to); if (!a || !b) continue;
      const pa = center(a), pb = center(b), skip = new Set([v.from, v.to]);
      /* y en U por debajo (o por encima) de lo que haya entre los dos, si las anteriores chocan */
      const lo = Math.min(pa.x, pb.x) - 4, hi = Math.max(pa.x, pb.x) + 4;
      const between = leaves.filter(([, r]) => r.x < hi && r.x + r.w > lo).map(([, r]) => r);
      const yb = Math.max(a.y + a.h, b.y + b.h, ...between.map(r => r.y + r.h)) + 16, yt = Math.min(a.y, b.y, ...between.map(r => r.y)) - 16;
      const routes = [[pa, pb], [pa, { x: pb.x, y: pa.y }, pb], [pa, { x: pa.x, y: pb.y }, pb],
        [pa, { x: pa.x, y: yb }, { x: pb.x, y: yb }, pb], [pa, { x: pa.x, y: yt }, { x: pb.x, y: yt }, pb]];
      const ok = routes.find(rt => rt.every((p, i) => i === 0 || !crosses(rt[i - 1], p, skip))) || routes[0];
      let li = 0, best = -1;
      ok.forEach((p, i) => { if (i) { const d = Math.hypot(p.x - ok[i - 1].x, p.y - ok[i - 1].y); if (d > best) { best = d; li = i; } } });
      paths.set(v.id, { pts: ok, label: midLabel(v, ok[li - 1], ok[li], textW) });
    }
    return { rects, paths, bbox: bboxOf(rects), deco: [] };
  }

  const modes = { gantt, git, sankey, treemap, timeline, journey, grid };
  return Object.assign({ names: Object.keys(modes), squarify, has: m => Object.prototype.hasOwnProperty.call(modes, m) }, modes);
});
