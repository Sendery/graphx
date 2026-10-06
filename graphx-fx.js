/* GraphX · efectos.
 *
 * Un módulo opcional que el motor engancha si está cargado: partículas que fluyen por las aristas,
 * ondas que recorren el grafo (al trazar, al seleccionar, «▶ Flujo»), mapa de calor por valor,
 * micro-gráficos en las tarjetas (sparkline, anillo de progreso), alertas que laten, foco sobre la
 * selección, entrada en cascada, retícula que sigue a la cámara, zoom semántico, colores automáticos,
 * aristas en degradado, pieles completas (neon, blueprint, glass), trazo a mano y datos en vivo
 * (`setData`) que se animan de un valor al siguiente.
 *
 * Todo es configurable con `fx` en el JSON o en las opciones de montaje (que mandan):
 *   fx: false | "off"            nada: el diagrama es exactamente el de siempre
 *   fx: "vivid" | "neon" | …     un preset
 *   fx: { preset, particles, waves, play, heat, spark, progress, alerts, spotlight, entrance,
 *         grid, lod, glow, gradient, autoColor, skin, sketch, hoverFlow }
 * Sin `fx`, solo se encienden las mejoras discretas y lo que piden los datos (una arista con `rate`,
 * una pieza con `heat`, `spark`, `progress` o `alert`). Respeta `prefers-reduced-motion`.
 *
 * Sin dependencias y sin requisitos especiales de navegador: SVG, CSS y SMIL (animateMotion).   */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GraphX = Object.assign(root.GraphX || {}, { fx: api });
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  /* ---------- configuración ---------- */
  const KEYS = ['particles', 'waves', 'play', 'heat', 'spark', 'progress', 'alerts', 'spotlight', 'entrance', 'grid', 'lod', 'glow', 'gradient', 'autoColor', 'skin', 'sketch', 'hoverFlow'];
  const OFF = KEYS.reduce((o, k) => (o[k] = false, o), {});
  /* lo que se enciende sin pedirlo: mejoras discretas y lo que piden los datos */
  const DEFAULTS = Object.assign({}, OFF, { particles: 'data', waves: true, heat: true, spark: true, progress: true, alerts: true, grid: true, lod: true, hoverFlow: true });
  const VIVID = { particles: true, play: true, spotlight: true, entrance: 'cascade', glow: true, gradient: true, autoColor: 'auto' };
  const PRESETS = {
    calm: {}, off: OFF, none: OFF,
    vivid: VIVID,
    neon: Object.assign({}, VIVID, { skin: 'neon' }),
    blueprint: Object.assign({}, VIVID, { skin: 'blueprint', gradient: false }),
    glass: Object.assign({}, VIVID, { skin: 'glass' }),
    present: { spotlight: true, entrance: 'cascade', particles: true, glow: true }
  };
  const SKINS = ['neon', 'blueprint', 'glass'];
  /* capas: el JSON y luego las opciones de montaje; `false` u "off" en cualquiera lo apaga todo */
  function resolve(specFx, optFx) {
    let c = Object.assign({}, DEFAULTS);
    for (const L of [specFx, optFx]) {
      if (L == null || L === true) continue;
      if (L === false || L === 'false' || L === 'off' || L === 'none') { c = Object.assign({}, OFF); continue; }
      if (typeof L === 'string') { c = Object.assign(c, PRESETS[L] || {}); continue; }
      if (typeof L === 'object') {
        if (L.preset && PRESETS[L.preset]) c = Object.assign(c, PRESETS[L.preset]);
        KEYS.forEach(k => { if (L[k] !== undefined) c[k] = L[k]; });
      }
    }
    return KEYS.some(k => c[k]) ? c : null;
  }
  const obj = v => (v && typeof v === 'object' ? v : {});

  /* ---------- escalas de color (mapa de calor) ---------- */
  const SCHEMES = {
    traffic: ['#1a9850', '#91cf60', '#f2c94c', '#f2994a', '#d7301f'],
    heat: ['#fde68a', '#fbbf24', '#f97316', '#dc2626', '#7f1d1d'],
    cool: ['#c6dbef', '#6baed6', '#3182bd', '#1f5fa8', '#08306b'],
    viridis: ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'],
    magma: ['#2d1160', '#721f81', '#b73779', '#f1605d', '#feaf77']
  };
  const hex2 = h => { const x = h.length === 4 ? h.replace(/[0-9a-f]/gi, '$&$&').slice(1) : h.slice(1); return [0, 2, 4].map(i => parseInt(x.slice(i, i + 2), 16)); };
  const toHex = rgb => '#' + rgb.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  function scale(name, t) {
    const st = Array.isArray(name) ? name : (SCHEMES[name] || SCHEMES.traffic);
    t = Math.max(0, Math.min(1, isFinite(t) ? t : 0));
    const f = t * (st.length - 1), i = Math.min(Math.floor(f), st.length - 2), u = f - i, a = hex2(st[i]), b = hex2(st[i + 1]);
    return toHex(a.map((v, k) => v + (b[k] - v) * u));
  }
  /* texto oscuro sobre un color claro, blanco sobre uno oscuro */
  const inkOn = h => { const [r, g, b] = hex2(h).map(v => v / 255); return .2126 * r + .7152 * g + .0722 * b > .55 ? '#1f2328' : '#fff'; };
  /* paleta categórica para los colores automáticos (claro / oscuro), la misma que --gx-p0…7 */
  const PAL = [['#0969da', '#4493f8'], ['#0f7b6c', '#2fbfa8'], ['#8250df', '#a371f7'], ['#bc4c00', '#f0883e'], ['#bf3989', '#f778ba'], ['#1a7f37', '#3fb950'], ['#9a6700', '#d29922'], ['#cf222e', '#f85149']].map(([light, dark]) => ({ light, dark }));

  const STR = {
    es: { play: 'Flujo', playT: 'Recorrer el flujo: una onda sale de los orígenes y sigue las conexiones', stop: 'Detener', heat: 'Calor', progress: 'Progreso', trend: 'Serie', min: 'mín', max: 'máx', last: 'último', flow: 'flujo · partículas según el caudal', alert: { crit: 'Crítico', warn: 'Atención', info: 'Aviso', ok: 'Correcto' } },
    en: { play: 'Flow', playT: 'Play the flow: a wave leaves the sources and follows the connections', stop: 'Stop', heat: 'Heat', progress: 'Progress', trend: 'Series', min: 'min', max: 'max', last: 'last', flow: 'flow · particles by throughput', alert: { crit: 'Critical', warn: 'Warning', info: 'Notice', ok: 'OK' } }
  };

  /* ---------- utilidades ---------- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const raf = f => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(f) : setTimeout(() => f(Date.now()), 16));
  const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const NUM = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;
  /* interpola dos cadenas con la misma estructura y distintos números (un path, un rotate) */
  function lerpStr(a, b, t) {
    const na = a.match(NUM), nb = b.match(NUM);
    if (!na || !nb || na.length !== nb.length) return b;
    const sa = a.split(NUM), sb = b.split(NUM);
    if (sa.join('\u0000') !== sb.join('\u0000')) return b;
    let out = sb[0];
    for (let k = 0; k < nb.length; k++) out += String(Math.round((+na[k] + (+nb[k] - +na[k]) * t) * 100) / 100) + sb[k + 1];
    return out;
  }
  const nums = a => (Array.isArray(a) ? a.filter(v => typeof v === 'number' && isFinite(v)) : []);
  /* largo de un trazado: el del navegador o, sin él (jsdom), el de la polilínea */
  function pathLen(el, pts, d) {
    try { const L = el && el.getTotalLength && el.getTotalLength(); if (L > 0) return L; } catch (_) { }
    let P = pts;
    if (!P || P.length < 2) { const m = String(d || '').match(NUM) || []; P = []; for (let i = 0; i + 1 < m.length; i += 2) P.push({ x: +m[i], y: +m[i + 1] }); }
    let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y);
    return L || 100;
  }
  function endsOf(g) {
    const P = g._pts;
    if (P && P.length > 1) return [P[0], P[P.length - 1]];
    const m = String(g._d || '').match(NUM) || [];
    return m.length >= 4 ? [{ x: +m[0], y: +m[1] }, { x: +m[m.length - 2], y: +m[m.length - 1] }] : null;
  }

  /* ---------- estilos (se inyectan una vez por documento) ---------- */
  const CSS = `
.gx-fx .gx-eflow { animation-duration: var(--gx-fs, 1.1s); }
.gx-has-pt > .gx-eflow { display: none; }
.gx-pts { pointer-events: none; }
.gx-pt-core { fill: color-mix(in srgb, #fff 62%, var(--gx-ptc, var(--gx-accent))); }
.gx-fxhalo { fill: none; stroke: var(--gx-ptc, var(--gx-accent)); stroke-width: 8; stroke-linecap: round; opacity: 0; pointer-events: none; transition: opacity .25s; }
.gx-fx-glow .gx-edge.hero > .gx-fxhalo { opacity: .2; }
.gx-fx-glow .gx-dim .gx-edge.lit > .gx-fxhalo { opacity: .14; stroke: var(--gx-accent); }
.gx-fx-glow .gx-node.sel { filter: drop-shadow(0 0 16px color-mix(in srgb, var(--gx-accent) 50%, transparent)); }
.gx-fx-glow .gx-node.lit { filter: drop-shadow(0 0 10px color-mix(in srgb, var(--gx-accent) 38%, transparent)); }
.gx-grad > .gx-eline { stroke: var(--gx-eg); }
/* hover: las conexiones iluminadas marchan en su sentido */
.gx-fx-hover .gx-dim .gx-edge.lit:not(.weighted) > .gx-eline { stroke-dasharray: 9 5; animation: gx-march .8s linear infinite; }
.gx-fx-hover .gx-dim .gx-edge.lit.dashed:not(.weighted) > .gx-eline { stroke-dasharray: 6 5; }
@keyframes gx-march { to { stroke-dashoffset: -14; } }
/* ondas */
.gx-wpulse { fill: none; stroke: var(--gx-ptc, var(--gx-accent)); stroke-linecap: round; stroke-dasharray: .14 1.3; stroke-dashoffset: .16;
  animation: gx-wp var(--gx-wdur, .6s) cubic-bezier(.45, 0, .25, 1) both; pointer-events: none; }
.gx-wpulse.w { stroke-width: 9; opacity: .25; } .gx-wpulse.c { stroke-width: 3.2; }
.gx-wpulse.rev { animation-name: gx-wpr; }
@keyframes gx-wp { from { stroke-dashoffset: .16; } to { stroke-dashoffset: -1.04; } }
@keyframes gx-wpr { from { stroke-dashoffset: -1.04; } to { stroke-dashoffset: .16; } }
.gx-node.gx-wv { animation: gx-wvn var(--gx-wdur, .9s) ease-out; animation-delay: var(--gx-wdl, 0ms); }
.gx-node.gx-wv > .gx-card { animation: gx-wvc var(--gx-wdur, .9s) ease-out; animation-delay: var(--gx-wdl, 0ms); }
@keyframes gx-wvn { 35% { filter: drop-shadow(0 0 12px color-mix(in srgb, var(--gx-accent) 75%, transparent)) drop-shadow(0 0 2px var(--gx-accent)); } }
@keyframes gx-wvc { 35% { stroke: var(--gx-accent); stroke-width: 2.6; } }
.gx-shock { fill: none; stroke: var(--gx-accent); stroke-width: 2.5; transform-box: fill-box; transform-origin: center; opacity: 0; pointer-events: none;
  animation: gx-shock .9s cubic-bezier(.2, .8, .2, 1); }
@keyframes gx-shock { 0% { opacity: .75; transform: scale(.7); } 100% { opacity: 0; transform: scale(1.9); } }
/* «▶ Flujo»: lo que la onda aún no ha alcanzado espera apagado */
.gx-playing .gx-node, .gx-playing .gx-edge, .gx-playing .gx-elabel { transition: opacity .35s; }
.gx-playing .gx-node:not(.gx-on), .gx-playing .gx-edge:not(.gx-on), .gx-playing .gx-elabel:not(.gx-on) { opacity: .16; }
.gx-playing .gx-group:not(.gx-on) > .gx-gbox { opacity: .5; }
.gx-fx-play.on { color: #fff; background: var(--gx-accent); border-color: var(--gx-accent); }
/* mapa de calor */
.gx-node.has-h > .gx-card { fill: color-mix(in srgb, var(--gx-h) 15%, var(--gx-card)); stroke: color-mix(in srgb, var(--gx-h) 70%, var(--gx-card-line)); transition: fill .6s, stroke .6s; }
.gx-node.has-h > .gx-accent { fill: var(--gx-h); opacity: 1; transition: fill .6s; }
.gx-node.has-h .gx-glyph-ic { stroke: color-mix(in srgb, var(--gx-h) 75%, var(--gx-ink)); }
.gx-node.gx-shape.has-h > .gx-card { stroke-width: 1.6; }
.gx-hb rect { fill: var(--gx-h); transition: fill .6s; }
.gx-hb text { font: 700 10px var(--gx-mono); text-anchor: middle; font-variant-numeric: tabular-nums; }
.gx-mini-n.gx-mh:not(.grp) { opacity: .9; }
.gx-heatkey { position: absolute; right: 12px; bottom: 12px; z-index: 10; display: flex; flex-direction: column; gap: 4px; padding: 8px 10px; min-width: 150px;
  font-size: 11px; color: var(--gx-muted); background: color-mix(in srgb, var(--gx-card) 90%, transparent); border: 1px solid var(--gx-line); border-radius: 9px;
  box-shadow: var(--gx-shadow); pointer-events: none; }
.gx-heatkey b { color: var(--gx-ink); font-weight: 650; }
.gx-heatbar { height: 8px; border-radius: 4px; }
.gx-heatkey span { display: flex; justify-content: space-between; font: 10.5px var(--gx-mono); font-variant-numeric: tabular-nums; }
.gx-flowview .gx-heatkey, .gx-present .gx-heatkey { display: none; }
.gx-tip-fx i { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 4px; vertical-align: -1px; }
/* sparkline y anillo de progreso en la tarjeta */
.gx-spark .gx-sp-l { stroke-width: 1.7; }
.gx-node.has-h .gx-sp-l { stroke: var(--gx-h); } .gx-node.has-h .gx-sp-a, .gx-node.has-h .gx-sp-d { fill: var(--gx-h); }
.gx-sp-v { font: 700 10.5px var(--gx-mono); fill: var(--gx-ink); text-anchor: end; font-variant-numeric: tabular-nums; }
.gx-fxin { stroke-dasharray: 1; stroke-dashoffset: 1; animation: gx-draw .9s cubic-bezier(.2, .8, .2, 1) .15s forwards; }
.gx-pr-t { fill: none; stroke: var(--gx-glyph-bg); stroke-width: 2.6; }
.gx-pr-a { fill: none; stroke: var(--gx-accent); stroke-width: 2.6; stroke-linecap: round; transition: stroke-dashoffset .8s cubic-bezier(.2, .8, .2, 1); }
.gx-node.has-c .gx-pr-a { stroke: var(--gx-c); } .gx-node.has-h .gx-pr-a { stroke: var(--gx-h); } .gx-pr-a.done { stroke: var(--gx-add); }
/* alertas que laten */
.gx-alert { fill: none; stroke: var(--gx-al, var(--gx-warn)); stroke-width: 2.2; transform-box: fill-box; transform-origin: center; opacity: 0; pointer-events: none;
  animation: gx-al 2s cubic-bezier(.2, .8, .2, 1) infinite; }
.gx-alert.b { animation-delay: 1s; }
.gx-alert.a-crit { --gx-al: var(--gx-del); } .gx-alert.a-info { --gx-al: var(--gx-accent); } .gx-alert.a-ok { --gx-al: var(--gx-add); }
@keyframes gx-al { 0% { opacity: .85; transform: scale(1); } 100% { opacity: 0; transform: scale(1.16, 1.32); } }
/* foco sobre la selección */
.gx-spot { position: absolute; inset: 0; z-index: 8; pointer-events: none; opacity: 0; transition: opacity .4s;
  --gx-spotc: color-mix(in srgb, var(--gx-canvas) 68%, transparent);
  background: radial-gradient(var(--gx-srw, 200px) var(--gx-srh, 120px) at var(--gx-sx, 50%) var(--gx-sy, 50%), transparent 0%, transparent 62%, var(--gx-spotc) 100%); }
.gx-spot.on { opacity: 1; }
.gx-flowview .gx-spot { display: none; }
/* zoom semántico: lejos, los nombres de los grupos se leen y lo pequeño se calla */
.gx-lodt { font-weight: 750; fill: var(--gx-ink); text-anchor: middle; dominant-baseline: middle; letter-spacing: -.01em; opacity: 0; transition: opacity .3s;
  paint-order: stroke; stroke: var(--gx-canvas); stroke-linejoin: round; pointer-events: none; }
.gx-far .gx-lodt { opacity: .92; }
.gx-far .gx-elabel, .gx-far .gx-eend { opacity: 0; transition: opacity .25s; }
.gx-far.gx-lodg .gx-world:not(.gx-dim) .gx-group > .gx-ghead { opacity: .25; }
/* retícula que sigue a la cámara */
.gx.gx-fx-grid > .gx-stage { background-size: var(--gx-gs, 22px) var(--gx-gs, 22px); background-position: var(--gx-gx, 0) var(--gx-gy, 0); }
/* ---------- pieles ---------- */
/* neon y blueprint son oscuras siempre: el diagrama entero (barra, recorrido) va sobre su fondo, no sobre el de la página */
.gx.gx-skin-neon, .gx.gx-skin-blueprint { background: var(--gx-bg); padding: 12px; border-radius: 16px; color-scheme: dark; }
.gx.gx-skin-neon.gx-present, .gx.gx-skin-blueprint.gx-present, .gx.gx-skin-neon.gx-expanded, .gx.gx-skin-blueprint.gx-expanded { border-radius: 0; }
:root .gx.gx-skin-neon, :root[data-theme] .gx.gx-skin-neon {
  --gx-bg: #0a0f1c; --gx-canvas: #060912; --gx-ink: #e6f1ff; --gx-muted: #93a6c4; --gx-faint: #5d6e8a; --gx-line: #1d2a44;
  --gx-card: #0d1528; --gx-card-line: #263a62; --gx-glyph-bg: #14213d; --gx-lane: rgba(20, 32, 60, .35); --gx-lane-line: #1a2846;
  --gx-group: rgba(12, 19, 36, .62); --gx-group-line: #2a4170; --gx-accent: #22d3ee; --gx-accent-soft: rgba(34, 211, 238, .14);
  --gx-add: #34f5a1; --gx-add-soft: rgba(52, 245, 161, .14); --gx-mod: #fbbf24; --gx-mod-soft: rgba(251, 191, 36, .16);
  --gx-del: #fb4d7a; --gx-del-soft: rgba(251, 77, 122, .15); --gx-neu: #4f6a9c; --gx-warn: #fb923c;
  --gx-shadow: 0 0 0 1px rgba(34, 211, 238, .05), 0 10px 30px rgba(0, 0, 0, .55);
  --gx-band-a: #070c18; --gx-band-b: #091022; --gx-band-head: #0b1324; --gx-frame: #1d2a44; --gx-band-div: #121c33; --gx-note: #1a1a0f; --gx-note-line: #6b5f1d;
  --gx-p0: #38bdf8; --gx-p1: #2dd4bf; --gx-p2: #c084fc; --gx-p3: #fb923c; --gx-p4: #f472b6; --gx-p5: #4ade80; --gx-p6: #facc15; --gx-p7: #fb7185;
}
.gx.gx-skin-neon > .gx-stage { background-color: #060912;
  background-image: radial-gradient(circle, rgba(120, 160, 230, .22) 1px, transparent 1.3px), radial-gradient(900px 520px at 12% -12%, rgba(34, 211, 238, .16), transparent 62%), radial-gradient(820px 520px at 108% 112%, rgba(217, 70, 239, .16), transparent 62%);
  background-size: var(--gx-gs, 22px) var(--gx-gs, 22px), 100% 100%, 100% 100%; background-position: var(--gx-gx, 0) var(--gx-gy, 0), 0 0, 0 0; }
.gx-skin-neon .gx-leaf:not(.gx-shape) > .gx-card, .gx-skin-neon .gx-shape > .gx-card:not(.ghost) { stroke: color-mix(in srgb, var(--gx-c, var(--gx-accent)) 55%, transparent); }
.gx-skin-neon .gx-leaf { filter: drop-shadow(0 0 7px color-mix(in srgb, var(--gx-c, var(--gx-accent)) 22%, transparent)); }
.gx-skin-neon .gx-node.has-h { filter: drop-shadow(0 0 9px color-mix(in srgb, var(--gx-h) 40%, transparent)); }
.gx-skin-neon .gx-eline { stroke: color-mix(in srgb, var(--gx-accent) 30%, var(--gx-neu)); }
.gx-skin-neon .gx-edge > .gx-fxhalo { opacity: .1; }
.gx-skin-neon .gx-t, .gx-skin-neon .gx-gt { fill: #f1f7ff; }
:root .gx.gx-skin-blueprint, :root[data-theme] .gx.gx-skin-blueprint {
  --gx-bg: #0c2850; --gx-canvas: #0f3466; --gx-ink: #eef5ff; --gx-muted: #b4cbec; --gx-faint: #86a5d0; --gx-line: rgba(238, 245, 255, .22);
  --gx-card: #11396f; --gx-card-line: rgba(238, 245, 255, .8); --gx-glyph-bg: rgba(238, 245, 255, .1); --gx-lane: rgba(255, 255, 255, .03);
  --gx-lane-line: rgba(238, 245, 255, .2); --gx-group: rgba(255, 255, 255, .03); --gx-group-line: rgba(238, 245, 255, .5);
  --gx-accent: #ffd166; --gx-accent-soft: rgba(255, 209, 102, .16); --gx-add: #7ee2a8; --gx-add-soft: rgba(126, 226, 168, .16);
  --gx-mod: #ffd166; --gx-mod-soft: rgba(255, 209, 102, .16); --gx-del: #ff8fa3; --gx-del-soft: rgba(255, 143, 163, .16); --gx-neu: rgba(238, 245, 255, .7); --gx-warn: #ffb070;
  --gx-shadow: 0 8px 24px rgba(3, 14, 33, .45); --gx-band-a: #0f3466; --gx-band-b: #11396f; --gx-band-head: #0d2f5d; --gx-frame: rgba(238, 245, 255, .4); --gx-band-div: rgba(238, 245, 255, .14);
  --gx-note: #173f73; --gx-note-line: #ffd166;
  --gx-p0: #7fdbff; --gx-p1: #7ee2a8; --gx-p2: #c3a6ff; --gx-p3: #ffb070; --gx-p4: #ff9ecf; --gx-p5: #b6f09c; --gx-p6: #ffd166; --gx-p7: #ff8fa3;
}
.gx.gx-skin-blueprint > .gx-stage { background-color: #0f3466;
  background-image: linear-gradient(rgba(238, 245, 255, .07) 1px, transparent 1px), linear-gradient(90deg, rgba(238, 245, 255, .07) 1px, transparent 1px),
    linear-gradient(rgba(238, 245, 255, .13) 1px, transparent 1px), linear-gradient(90deg, rgba(238, 245, 255, .13) 1px, transparent 1px);
  background-size: var(--gx-gs, 22px) var(--gx-gs, 22px), var(--gx-gs, 22px) var(--gx-gs, 22px), calc(var(--gx-gs, 22px) * 5) calc(var(--gx-gs, 22px) * 5), calc(var(--gx-gs, 22px) * 5) calc(var(--gx-gs, 22px) * 5);
  background-position: var(--gx-gx, 0) var(--gx-gy, 0); }
.gx-skin-blueprint .gx-gbox { stroke-dasharray: 7 5; }
.gx-skin-blueprint .gx-card { stroke-width: 1.3; }
.gx-skin-blueprint .gx-leaf.has-c:not(.gx-shape) > .gx-card { stroke: color-mix(in srgb, var(--gx-c) 70%, #fff); }
:root .gx.gx-skin-glass, :root[data-theme] .gx.gx-skin-glass {
  --gx-bg: rgba(255, 255, 255, .55); --gx-canvas: #eef1fb; --gx-ink: #1b2033; --gx-muted: #4d5672; --gx-faint: #7c84a0; --gx-line: rgba(27, 32, 51, .12);
  --gx-card: rgba(255, 255, 255, .66); --gx-card-line: rgba(255, 255, 255, .95); --gx-glyph-bg: rgba(255, 255, 255, .8); --gx-lane: rgba(255, 255, 255, .25);
  --gx-lane-line: rgba(255, 255, 255, .7); --gx-group: rgba(255, 255, 255, .3); --gx-group-line: rgba(255, 255, 255, .85);
  --gx-accent: #6d4aff; --gx-accent-soft: rgba(109, 74, 255, .14); --gx-add: #0b9b6a; --gx-mod: #b26b00; --gx-del: #e5484d; --gx-neu: #8a93b0;
  --gx-shadow: 0 8px 28px rgba(40, 50, 90, .14); --gx-band-a: rgba(255, 255, 255, .2); --gx-band-b: rgba(255, 255, 255, .32); --gx-band-head: rgba(255, 255, 255, .55); --gx-frame: rgba(255, 255, 255, .8); --gx-band-div: rgba(255, 255, 255, .6);
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .gx.gx-skin-glass {
  --gx-bg: rgba(30, 36, 64, .5); --gx-canvas: #0c0f1d; --gx-ink: #eef0ff; --gx-muted: #a6acc9; --gx-faint: #6f7697; --gx-line: rgba(255, 255, 255, .1);
  --gx-card: rgba(32, 38, 68, .58); --gx-card-line: rgba(255, 255, 255, .16); --gx-glyph-bg: rgba(255, 255, 255, .08); --gx-lane: rgba(255, 255, 255, .03);
  --gx-lane-line: rgba(255, 255, 255, .08); --gx-group: rgba(255, 255, 255, .04); --gx-group-line: rgba(255, 255, 255, .14);
  --gx-accent: #a78bfa; --gx-accent-soft: rgba(167, 139, 250, .16); --gx-add: #4ade80; --gx-mod: #fbbf24; --gx-del: #fb7185; --gx-neu: #6b7299;
  --gx-shadow: 0 10px 30px rgba(0, 0, 0, .45); --gx-band-a: rgba(255, 255, 255, .02); --gx-band-b: rgba(255, 255, 255, .04); --gx-band-head: rgba(20, 24, 44, .7); --gx-frame: rgba(255, 255, 255, .14); --gx-band-div: rgba(255, 255, 255, .07); } }
:root[data-theme="dark"] .gx.gx-skin-glass {
  --gx-bg: rgba(30, 36, 64, .5); --gx-canvas: #0c0f1d; --gx-ink: #eef0ff; --gx-muted: #a6acc9; --gx-faint: #6f7697; --gx-line: rgba(255, 255, 255, .1);
  --gx-card: rgba(32, 38, 68, .58); --gx-card-line: rgba(255, 255, 255, .16); --gx-glyph-bg: rgba(255, 255, 255, .08); --gx-lane: rgba(255, 255, 255, .03);
  --gx-lane-line: rgba(255, 255, 255, .08); --gx-group: rgba(255, 255, 255, .04); --gx-group-line: rgba(255, 255, 255, .14);
  --gx-accent: #a78bfa; --gx-accent-soft: rgba(167, 139, 250, .16); --gx-add: #4ade80; --gx-mod: #fbbf24; --gx-del: #fb7185; --gx-neu: #6b7299;
  --gx-shadow: 0 10px 30px rgba(0, 0, 0, .45); --gx-band-a: rgba(255, 255, 255, .02); --gx-band-b: rgba(255, 255, 255, .04); --gx-band-head: rgba(20, 24, 44, .7); --gx-frame: rgba(255, 255, 255, .14); --gx-band-div: rgba(255, 255, 255, .07); }
.gx.gx-skin-glass > .gx-stage { background-color: var(--gx-canvas);
  background-image: radial-gradient(circle, color-mix(in srgb, var(--gx-faint) 30%, transparent) 1px, transparent 1.3px),
    radial-gradient(620px 420px at 8% 8%, color-mix(in srgb, #ff7cb4 34%, transparent), transparent 70%),
    radial-gradient(720px 480px at 92% 18%, color-mix(in srgb, #62a0ff 34%, transparent), transparent 70%),
    radial-gradient(820px 520px at 50% 115%, color-mix(in srgb, #40debe 30%, transparent), transparent 70%);
  background-size: var(--gx-gs, 22px) var(--gx-gs, 22px), 100% 100%, 100% 100%, 100% 100%; background-position: var(--gx-gx, 0) var(--gx-gy, 0), 0 0, 0 0, 0 0; }
.gx-skin-glass .gx-leaf { filter: drop-shadow(0 6px 14px rgba(40, 50, 90, .13)); }
.gx-skin-glass .gx-gbox { stroke-width: 1.4; }
@media (prefers-reduced-motion: reduce) {
  .gx-alert, .gx-shock, .gx-wpulse, .gx-node.gx-wv, .gx-node.gx-wv > .gx-card, .gx-fx-hover .gx-dim .gx-edge.lit > .gx-eline { animation: none; }
  .gx-alert { opacity: .6; }
  .gx-fxin { animation: none; stroke-dashoffset: 0; }
}
`;
  let cssDone = false;
  function injectCSS() {
    if (cssDone || typeof document === 'undefined') return;
    if (!document.querySelector('style[data-gx-fx]')) {
      const st = document.createElement('style'); st.setAttribute('data-gx-fx', '1.8'); st.textContent = CSS;
      (document.head || document.documentElement).appendChild(st);
    }
    cssDone = true;
  }

  /* ---------- una instancia ---------- */
  function create(A) {
    const cfg = resolve(A.spec.fx, A.opts.fx);
    if (!cfg) return null;
    injectCSS();
    const { host, stage, svg, defs, world, S, M, G, s, h, esc, spec, I } = A;
    const reduce = A.reduce, L = STR[A.lang] || STR.es, lang = A.lang;
    const SHP = (typeof window !== 'undefined' ? window : globalThis).GraphX.shapes;
    const fmt = (v, o) => (SHP && SHP.fmt ? SHP.fmt(v, Object.assign({ lang }, o)) : String(Math.round(v * 100) / 100));
    const timers = new Set();
    const later = (f, ms) => { const t = setTimeout(() => { timers.delete(t); f(); }, ms); timers.add(t); return t; };
    const PT = cfg.particles ? Object.assign({ mode: cfg.particles === true ? 'flow' : cfg.particles, speed: 1, density: 1, max: 260 }, obj(cfg.particles)) : null;
    if (PT && typeof PT.mode !== 'string') PT.mode = 'flow';
    const PLAY = cfg.play ? Object.assign({ hop: 620, loop: false }, obj(cfg.play)) : null;
    const HC = cfg.heat ? Object.assign({ scheme: 'traffic', rollup: 'max', key: true }, obj(cfg.heat)) : null;
    /* por debajo de este zoom una tarjeta ya no se lee (13 px × 0,4 ≈ 5 px): ahí entran los nombres grandes */
    const LOD = cfg.lod ? Object.assign({ k: .4 }, obj(cfg.lod)) : null;
    const skin = SKINS.includes(cfg.skin) ? cfg.skin : null;
    host.classList.add('gx-fx');
    [['glow', cfg.glow], ['grid', cfg.grid], ['hover', cfg.hoverFlow && !reduce], ['sketch', cfg.sketch]].forEach(([k, on]) => { if (on) host.classList.add('gx-fx-' + k); });
    if (skin) host.classList.add('gx-skin-' + skin);
    const gFx = s('g', { class: 'gx-fxl' }, world), gLod = s('g', { class: 'gx-lod' }, world);

    /* --- colores automáticos: por carril, por grupo o por tipo, solo donde no hay color --- */
    if (cfg.autoColor) {
      const real = (spec.nodes || []).some(n => n.delta && n.delta !== 'unchanged');
      let mode = cfg.autoColor;
      const lanes = G.roots.filter(id => M.get(id).isLane), groups = G.roots.filter(id => M.get(id).children.length);
      if (mode === 'auto' || mode === true) mode = real ? null : lanes.length > 1 ? 'lanes' : groups.length > 1 ? 'groups' : 'kinds';
      const give = (id, c) => { const w = x => { const n = M.get(x); if (!n.cvar) n.cvar = c; n.children.forEach(w); }; w(id); };
      if (mode === 'lanes' || mode === 'groups') (mode === 'lanes' ? lanes : groups).forEach((id, i) => { if (!M.get(id).cvar) give(id, A.colorVar(PAL[i % PAL.length])); else give(id, M.get(id).cvar); });
      else if (mode === 'kinds') {
        const cnt = new Map();
        for (const n of M.values()) if (!n.isLane && !n.children.length) cnt.set(n.kind, (cnt.get(n.kind) || 0) + 1);
        const skip = new Set(['other', 'step', 'group', 'lane']);
        [...cnt.keys()].filter(k => !skip.has(k)).sort((a, b) => cnt.get(b) - cnt.get(a)).forEach((k, i) => {
          const c = A.colorVar(PAL[i % PAL.length]);
          for (const n of M.values()) if (n.kind === k && !n.cvar && !n.children.length) n.cvar = c;
        });
      }
      A.refreshTheme();
    }

    /* --- sketch: un filtro que hace temblar el trazo, como a mano (look: handDrawn de Mermaid) --- */
    if (cfg.sketch) {
      const f = s('filter', { id: `${I}-sk`, x: '-5%', y: '-5%', width: '110%', height: '110%' }, defs);
      s('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.035', numOctaves: '2', seed: '7', result: 'n' }, f);
      s('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: '3.2', xChannelSelector: 'R', yChannelSelector: 'G' }, f);
      const st = h('style', null, null, host);
      st.textContent = `#${host.id}.gx-fx-sketch .gx-card,#${host.id}.gx-fx-sketch .gx-gbox,#${host.id}.gx-fx-sketch .gx-stack{filter:url(#${I}-sk)}`;
    }

    /* ---------- mapa de calor ---------- */
    const rawHeat = n => {
      if (typeof n.heat === 'number' && isFinite(n.heat)) return n.heat;
      if (HC && HC.metric && Array.isArray(n.metrics)) {
        const m = n.metrics.find(x => x && (x.key === HC.metric || x.label === HC.metric));
        if (m) { const v = typeof m.value === 'number' ? m.value : parseFloat(String(m.value).replace(',', '.')); if (isFinite(v)) return v; }
      }
      return null;
    };
    let heat = null;
    /* dominio y valores (con lo que sube de los hijos a un contenedor que no trae el suyo) */
    function computeHeat() {
      if (!HC) { heat = null; return; }
      const own = new Map();
      for (const n of M.values()) { const v = rawHeat(n); if (v != null) own.set(n.id, v); }
      if (!own.size) { heat = null; return; }
      const vals = [...own.values()];
      let lo = Array.isArray(HC.domain) ? +HC.domain[0] : Math.min(...vals), hi = Array.isArray(HC.domain) ? +HC.domain[1] : Math.max(...vals);
      if (!(hi > lo)) { lo -= 1; hi += 1; }
      const val = new Map(own);
      if (HC.rollup) {
        const up = id => {
          const n = M.get(id); const kids = n.children.map(up).filter(v => v != null);
          if (!val.has(id) && kids.length && !n.isLane) val.set(id, HC.rollup === 'avg' ? kids.reduce((a, b) => a + b, 0) / kids.length : HC.rollup === 'sum' ? kids.reduce((a, b) => a + b, 0) : Math.max(...kids));
          return val.has(id) ? val.get(id) : null;
        };
        G.roots.forEach(up);
      }
      const tOf = v => { const t = clamp((v - lo) / (hi - lo), 0, 1); return HC.invert ? 1 - t : t; };
      heat = { lo, hi, val, own, tOf, col: v => scale(HC.scheme, tOf(v)) };
    }
    computeHeat();
    const heatOf = n => (heat && heat.val.has(n.id) ? heat.val.get(n.id) : null);
    const heatTxt = v => fmt(v, { unit: HC.unit || '' });
    function heatKey() {
      let k = stage.querySelector('.gx-heatkey');
      if (!heat || !HC.key) { if (k) k.remove(); return; }
      if (!k) k = h('div', 'gx-heatkey', null, stage);
      const st = (Array.isArray(HC.scheme) ? HC.scheme : SCHEMES[HC.scheme] || SCHEMES.traffic);
      const grad = `linear-gradient(90deg, ${(HC.invert ? st.slice().reverse() : st).join(', ')})`;
      k.innerHTML = `<b>${esc(HC.label || HC.metric || L.heat)}</b><div class="gx-heatbar" style="background:${grad}"></div><span><i>${esc(heatTxt(heat.lo))}</i><i>${esc(heatTxt((heat.lo + heat.hi) / 2))}</i><i>${esc(heatTxt(heat.hi))}</i></span>`;
      /* y en la leyenda */
      let lg = A.legend.querySelector('.gx-lg-heat');
      if (!lg) lg = h('div', 'gx-lg-heat', null, A.legend);
      lg.innerHTML = `<h4>${esc(HC.label || HC.metric || L.heat)}</h4><div class="gx-heatbar" style="background:${grad}"></div><ul style="display:flex;justify-content:space-between;font:10.5px var(--gx-mono)"><li>${esc(heatTxt(heat.lo))}</li><li>${esc(heatTxt(heat.hi))}</li></ul>`;
    }
    heatKey();

    /* ---------- micro-gráficos y alertas en cada pieza ---------- */
    const progOf = n => { if (typeof n.progress !== 'number' || !isFinite(n.progress)) return null; return clamp(n.progress > 1 ? n.progress / 100 : n.progress, 0, 1); };
    const sparkOf = n => { const a = nums(n.spark); return a.length > 1 ? a : null; };
    const alertOf = n => {
      let a = n.alert;
      if (!a && n.status && spec.statuses && spec.statuses[n.status] && spec.statuses[n.status].pulse) a = spec.statuses[n.status].alert || 'warn';
      if (!a) return null;
      return ['crit', 'warn', 'info', 'ok'].includes(a) ? a : 'warn';
    };
    function cardExtra(n) { return cfg.spark && SHP && sparkOf(n) ? 22 : 0; }
    /* al rehacer una pieza por datos nuevos no se repite su animación de entrada: se anima el cambio */
    let quiet = false;
    function leaf(g, n, parts, cl) {
      const W = cl.w, H = cl.h;
      const hv = heatOf(n);
      if (hv != null) {
        const c = heat.col(hv);
        g.classList.add('has-h'); g.style.setProperty('--gx-h', c);
        /* la cifra, en una pastilla sobre el borde de arriba: no compite con el título ni con las marcas de la tarjeta */
        const txt = heatTxt(hv), bw = A.textW(txt, 10, 700, true) + 12;
        const b = s('g', { class: 'gx-hb', transform: `translate(${W - bw - 10},-7)`, 'data-m': 'fx-hbg' }, g);
        s('rect', { width: bw, height: 15, rx: 7.5, 'data-m': 'fx-hbr' }, b);
        const t = s('text', { x: bw / 2, y: 11, 'data-m': 'fx-hbt', 'data-num': hv, 'data-unit': HC.unit || '', 'data-dec': '' }, b); t.textContent = txt; t.style.fill = inkOn(c);
      }
      if (parts && cfg.progress) {
        const p = progOf(n);
        if (p != null) {
          const ring = 'M31,12.5a18.5,18.5 0 1 1 0,37a18.5,18.5 0 1 1 0,-37';
          const gr = s('g', { class: 'gx-pr' }, g);
          g.insertBefore(gr, g.querySelector('.gx-glyph'));
          s('path', { class: 'gx-pr-t', d: ring }, gr);
          const a = s('path', { class: 'gx-pr-a' + (p >= 1 ? ' done' : ''), d: ring, pathLength: 1, 'data-m': 'fx-pr', style: `stroke-dasharray:1 1;stroke-dashoffset:${(1 - p).toFixed(3)}` }, gr);
          void a;
        }
      }
      if (parts && cfg.spark && SHP) {
        const sp = sparkOf(n);
        if (sp) {
          const base = cl.base || 64, y0 = base - 16, y1 = base - 3, last = sp[sp.length - 1];
          const txt = fmt(last, { unit: n.unit || '' }), vw = A.textW(txt, 10.5, 700, true) + 8, x0 = 55, x1 = W - 12 - vw;
          const pts = SHP.sparkPts(sp, x0, x1, y0, y1), d = SHP.sparkD(pts), lp = pts[pts.length - 1];
          const gs = s('g', { class: 'gx-spark' }, g);
          s('path', { class: 'gx-sp-a', d: `${d}L${x1},${y1 + 1}L${x0},${y1 + 1}Z`, 'data-m': 'fx-sa' }, gs);
          const ln = s('path', { class: 'gx-sp-l', d, 'data-m': 'fx-sl' }, gs);
          if (!reduce && !quiet) { ln.setAttribute('pathLength', '1'); ln.classList.add('gx-fxin'); setTimeout(() => { ln.classList.remove('gx-fxin'); ln.removeAttribute('pathLength'); }, 1200); }
          s('circle', { class: 'gx-sp-d', cx: lp[0].toFixed(1), cy: lp[1].toFixed(1), r: 2.6, 'data-m': 'fx-sd' }, gs);
          const t = s('text', { class: 'gx-sp-v', x: W - 12, y: y1 - 1, 'data-m': 'fx-sv', 'data-num': last, 'data-unit': n.unit || '', 'data-dec': '' }, gs); t.textContent = txt;
        }
      }
      if (cfg.alerts) {
        const a = alertOf(n);
        if (a) [0, 1].forEach(k => g.insertBefore(s('rect', { class: `gx-alert a-${a}${k ? ' b' : ''}`, x: -2, y: -2, width: W + 4, height: H + 4, rx: 12 }), g.firstChild));
      }
    }
    function tip(n) {
      const out = [], hv = heatOf(n);
      if (hv != null) out.push(`<span><i style="background:${heat.col(hv)}"></i>${esc(HC.label || HC.metric || L.heat)}: <b>${esc(heatTxt(hv))}</b></span>`);
      const p = progOf(n); if (p != null) out.push(`<span>${esc(L.progress)}: <b>${Math.round(p * 100)}%</b></span>`);
      const sp = sparkOf(n); if (sp) out.push(`<span>${esc(L.trend)}: ${esc(L.min)} ${esc(fmt(Math.min(...sp)))} · ${esc(L.max)} ${esc(fmt(Math.max(...sp)))} · ${esc(L.last)} <b>${esc(fmt(sp[sp.length - 1], { unit: n.unit || '' }))}</b></span>`);
      const a = alertOf(n); if (a) out.push(`<span><b>⚠ ${esc(L.alert[a])}</b></span>`);
      return out.length ? `<div class="gx-tip-f gx-tip-fx">${out.join('')}</div>` : '';
    }
    function mini(mr, n) {
      const hv = heatOf(n);
      if (hv != null && !A.isGroup(n.id)) { mr.style.fill = heat.col(hv); mr.classList.add('gx-mh'); }
    }

    /* ---------- aristas: partículas, degradado, halo ---------- */
    const maxRate = () => Math.max(0, ...G.edges.map(e => (typeof e.rate === 'number' ? e.rate : 0)));
    let MR = maxRate();
    const SPEED = { fast: 1.9, slow: .5 };
    function flowOf(v) {
      if (!PT || reduce) return null;
      const rate = v.list.reduce((a, e) => a + (typeof e.rate === 'number' ? e.rate : 0), 0);
      if (!(PT.mode === 'all' || rate > 0 || (PT.mode === 'flow' && (v.animated || v.hero)))) return null;
      const sp = (v.list.find(e => e.speed != null) || {}).speed;
      return { t: rate > 0 && MR ? clamp(rate / MR, .08, 1) : v.hero ? .7 : .45, k: typeof sp === 'number' ? sp : SPEED[sp] || 1, prio: (v.hero ? 3 : 0) + (v.animated ? 2 : 0) + (rate > 0 ? 1 + rate / (MR || 1) : 0) };
    }
    const colorOf = v => v.cvar || (v.delta === 'added' ? 'var(--gx-add)' : v.delta === 'modified' ? 'var(--gx-mod)' : v.delta === 'removed' ? 'var(--gx-del)' : (M.get(v.from) || {}).cvar || 'var(--gx-accent)');
    const ptGrad = new Map();
    function gradFor(col) {
      if (ptGrad.has(col)) return ptGrad.get(col);
      const id = `${I}-ptg${ptGrad.size}`, lg = s('linearGradient', { id, x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
      [[0, 0], [.6, .55], [1, 1]].forEach(([o, a]) => { const st = s('stop', { offset: o }, lg); st.style.stopColor = col; st.style.stopOpacity = a; });
      ptGrad.set(col, id); return id;
    }
    let cands = [], budget = 0, gid = 0;
    function addParticles(g, fl) {
      const old = g.querySelector('.gx-pts'); if (old) old.remove();
      if (!fl) { g.classList.remove('gx-has-pt'); return 0; }
      const len = pathLen(g._line, g._pts, g._d);
      const n = clamp(Math.round(len * (.5 + fl.t * 1.7) * PT.density / 120), 1, 14);
      if (n > budget) return 0;
      const speed = (70 + 120 * fl.t) * PT.speed * fl.k, dur = Math.max(len / speed, .5);
      const wpx = g._line.style.strokeWidth ? parseFloat(g._line.style.strokeWidth) : 0;
      const r = Math.max(2.5 + 2 * fl.t, wpx ? wpx * .34 : 0), col = colorOf(g._v), gr = gradFor(col);
      const grp = s('g', { class: 'gx-pts' }, g); grp.style.setProperty('--gx-ptc', col);
      for (let i = 0; i < n; i++) {
        const p = s('g', { class: 'gx-pt' }, grp);
        s('path', { d: `M${(-r * 5.2).toFixed(1)},0L0,${(-r).toFixed(2)}A${r.toFixed(2)},${r.toFixed(2)} 0 1 1 0,${r.toFixed(2)}Z`, fill: `url(#${gr})` }, p);
        s('circle', { r: (r * .5).toFixed(2), class: 'gx-pt-core' }, p);
        s('animateMotion', { dur: dur.toFixed(2) + 's', repeatCount: 'indefinite', begin: (-(i / n) * dur).toFixed(2) + 's', rotate: 'auto', path: g._d }, p);
      }
      g.classList.add('gx-has-pt');
      budget -= n; return n;
    }
    function edge(g, v) {
      g.style.setProperty('--gx-ptc', colorOf(v));
      const sp = (v.list.find(e => e.speed != null) || {}).speed;
      if (sp != null) g.style.setProperty('--gx-fs', (1.1 / (typeof sp === 'number' ? sp : SPEED[sp] || 1)).toFixed(2) + 's');
      if (cfg.glow) g.insertBefore(s('path', { class: 'gx-fxhalo', d: g._d }), g._line);
      if (cfg.gradient && !v.cvar) {
        const a = (M.get(v.from) || {}).cvar, b = (M.get(v.to) || {}).cvar, E = endsOf(g);
        if (a && b && a !== b && E) {
          const id = `${I}-eg${++gid}`, lg = s('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1: E[0].x, y1: E[0].y, x2: E[1].x, y2: E[1].y }, g);
          [[0, a], [1, b]].forEach(([o, c]) => { const st = s('stop', { offset: o }, lg); st.style.stopColor = c; });
          g.classList.add('gx-grad'); g._line.style.setProperty('--gx-eg', `url(#${id})`);
          g.style.setProperty('--gx-ptc', a);
        }
      }
      if (entry && entry.edge) {
        const dl = entry.edge(v);
        if (dl) { g._inDelay = dl; g.style.animationDelay = dl + 'ms'; g._line.style.animationDelay = dl + 'ms'; }
      }
      const fl = flowOf(v); if (fl) cands.push({ g, fl });
    }

    /* ---------- entrada en cascada ---------- */
    let entry = null;
    function beforeTween(items, first, dur) {
      stop(); cands = []; budget = PT ? PT.max : 0;
      entry = null;
      if (!first || !cfg.entrance || reduce || !items.length) return dur;
      const down = S.dir === 'down', pos = it => (down ? it.to.y + it.to.h / 2 : it.to.x + it.to.w / 2);
      const P = items.map(pos), lo = Math.min(...P), hi = Math.max(...P), span = hi - lo || 1;
      const frac = new Map();
      items.forEach((it, i) => { const f = (P[i] - lo) / span; frac.set(it.n.id, f); it.delay = (it.kind === 'group' ? .5 : .62) * f; });
      const D = dur * 2.6;
      entry = { edge: v => Math.round(120 + 760 * (frac.has(v.from) ? frac.get(v.from) : 0)) };
      return D;
    }

    /* ---------- tras cada layout ---------- */
    function afterLayout() {
      /* partículas: primero las aristas que cuentan la historia, hasta el presupuesto */
      cands.sort((a, b) => b.fl.prio - a.fl.prio).forEach(c => addParticles(c.g, c.fl));
      cands = []; entry = null;
      drawLod();
      cam(S.cam);
      spot();
    }

    /* ---------- zoom semántico ---------- */
    function drawLod() {
      gLod.innerHTML = '';
      if (!LOD) return;
      let any = false;
      for (const [id, r] of S.rects) {
        const n = M.get(id);
        if (!A.isGroup(id) || (n.isLane && A.framed()) || r.w < 120) continue;
        const per = A.textW(n.label, 100, 750) / 100 || 1, maxPx = Math.min(r.w * .82 / per, r.h * .34, 160);
        const t = s('text', { class: 'gx-lodt', x: r.x + r.w / 2, y: r.y + r.h / 2 }, gLod);
        t.textContent = n.label;
        t.style.fontSize = `min(calc(18px / var(--gx-k, 1)), ${maxPx.toFixed(1)}px)`;
        t.style.strokeWidth = `calc(6px / var(--gx-k, 1))`;
        any = true;
      }
      host.classList.toggle('gx-lodg', any);
    }

    /* ---------- cámara: retícula, zoom semántico y foco ---------- */
    function cam(c) {
      if (!c) return;
      if (cfg.grid) {
        let gs = 22 * c.k; while (gs < 11) gs *= 2; while (gs > 44) gs /= 2;
        stage.style.setProperty('--gx-gs', gs.toFixed(2) + 'px');
        stage.style.setProperty('--gx-gx', c.x.toFixed(1) + 'px'); stage.style.setProperty('--gx-gy', c.y.toFixed(1) + 'px');
      }
      if (LOD) { world.style.setProperty('--gx-k', c.k.toFixed(3)); host.classList.toggle('gx-far', c.k < LOD.k); }
      if (spotOn) placeSpot();
    }

    /* ---------- foco sobre la selección o el paso ---------- */
    const spotEl = cfg.spotlight ? h('div', 'gx-spot', null, stage) : null;
    let spotRect = null, spotOn = false, stepNodes = null;
    function spot() {
      if (!spotEl) return;
      let r = null;
      const sel = S.selected && S.selected !== '__files__' && M.has(S.selected) ? A.repOf(S.selected) : null;
      if (sel && S.rects.has(sel)) r = S.rects.get(sel);
      else if (stepNodes && stepNodes.size) {
        const R = [...stepNodes].map(id => S.rects.get(id)).filter(Boolean);
        if (R.length) { const x0 = Math.min(...R.map(q => q.x)), y0 = Math.min(...R.map(q => q.y)); r = { x: x0, y: y0, w: Math.max(...R.map(q => q.x + q.w)) - x0, h: Math.max(...R.map(q => q.y + q.h)) - y0 }; }
      }
      spotRect = r; spotOn = !!r && S.view === 'graph';
      spotEl.classList.toggle('on', spotOn);
      if (spotOn) placeSpot();
    }
    function placeSpot() {
      const r = spotRect, c = S.cam; if (!r) return;
      spotEl.style.setProperty('--gx-sx', ((r.x + r.w / 2) * c.k + c.x).toFixed(1) + 'px');
      spotEl.style.setProperty('--gx-sy', ((r.y + r.h / 2) * c.k + c.y).toFixed(1) + 'px');
      spotEl.style.setProperty('--gx-srw', (r.w * c.k * .95 + 120).toFixed(1) + 'px');
      spotEl.style.setProperty('--gx-srh', (r.h * c.k * .95 + 110).toFixed(1) + 'px');
    }
    function highlight(set, kind) {
      if (kind === 'hover') return;
      stepNodes = kind === 'step' && set ? set.nodes : null;
      spot();
    }

    /* ---------- ondas ---------- */
    /* distancias en saltos sobre lo visible, siguiendo las aristas (`out`) o contra ellas (`in`) */
    function hops(starts, dir, o) {
      o = o || {};
      const adj = new Map();
      for (const v of S.vedges) {
        if (o.noBack && v.back) continue;
        if (o.only && !o.only.has(v.id)) continue;
        const [a, b] = dir === 'in' ? [v.to, v.from] : [v.from, v.to];
        if (!adj.has(a)) adj.set(a, []); adj.get(a).push(b);
      }
      const D = new Map(), q = [];
      starts.forEach(id => { if (id != null && !D.has(id)) { D.set(id, 0); q.push(id); } });
      while (q.length) { const x = q.shift(); (adj.get(x) || []).forEach(y => { if (!D.has(y)) { D.set(y, D.get(x) + 1); q.push(y); } }); }
      return D;
    }
    const restart = (el, cls) => { el.classList.remove(cls); void el.getBoundingClientRect(); el.classList.add(cls); };
    function pulse(g, delay, dur, rev) {
      const out = [];
      ['w', 'c'].forEach(k => {
        const p = s('path', { class: `gx-wpulse ${k}${rev ? ' rev' : ''}`, d: g._d, pathLength: 1 }, g);
        p.style.animationDelay = delay + 'ms'; p.style.setProperty('--gx-wdur', dur + 'ms'); out.push(p);
      });
      later(() => out.forEach(p => p.remove()), delay + dur + 80);
    }
    function shock(id, delay) {
      const r = S.rects.get(id); if (!r) return;
      const c = s('rect', { class: 'gx-shock', x: r.x - 4, y: r.y - 4, width: r.w + 8, height: r.h + 8, rx: 14 }, gFx);
      c.style.animationDelay = (delay || 0) + 'ms';
      later(() => c.remove(), (delay || 0) + 1000);
    }
    function wave(starts, dir, o) {
      if (reduce) return 0;
      o = Object.assign({ hop: 170, max: Infinity, dur: 0 }, o);
      const D = hops(starts, dir, o), dur = o.dur || Math.round(o.hop * 1.1);
      let maxD = 0;
      D.forEach((d, id) => {
        if (d > o.max) return; maxD = Math.max(maxD, d);
        const el = S.els.get(id); if (!el) return;
        const at = d ? (d - 1) * o.hop + dur * .85 : 0;
        el.style.setProperty('--gx-wdl', Math.round(at) + 'ms'); el.style.setProperty('--gx-wdur', '900ms');
        restart(el, 'gx-wv');
        later(() => el.classList.remove('gx-wv'), at + 950);
      });
      for (const x of S.edgeEls) {
        const v = x.g._v, a = dir === 'in' ? v.to : v.from, b = dir === 'in' ? v.from : v.to, da = D.get(a), db = D.get(b);
        if (o.only && !o.only.has(v.id)) continue;
        if (da != null && db === da + 1 && da < o.max) pulse(x.g, da * o.hop, dur, dir === 'in');
      }
      starts.forEach(id => shock(id, 0));
      return maxD;
    }
    function trace(id, dir) { if (cfg.waves) wave([A.repOf(id)], dir === 'down' ? 'in' : 'out', { hop: 190 }); }
    function select(id) {
      if (!cfg.waves || !M.has(id) || playing) return;
      const r = A.repOf(id); if (!S.els.has(r)) return;
      wave([r], 'out', { hop: 160, max: 1 }); wave([r], 'in', { hop: 160, max: 1 });
    }
    function step(st) {
      if (!cfg.waves || !st || !st.focus) return;
      const f = st.focus, only = new Set();
      (f.edges || []).forEach(eid => { const e = G.edges.find(x => x.id === eid); const v = e && S.vedges.find(x => x.list.includes(e)); if (v) only.add(v.id); });
      const starts = (f.nodes || []).map(A.repOf).filter(id => id != null && S.els.has(id));
      if (only.size) {
        const tos = new Set([...only].map(id => S.vedges.find(v => v.id === id)).filter(Boolean).map(v => v.to));
        wave([...only].map(id => S.vedges.find(v => v.id === id)).filter(Boolean).map(v => v.from).filter(x => !tos.has(x)), 'out', { hop: 260, only });
      } else if (starts.length) starts.forEach(id => shock(id, 0));
    }

    /* ---------- «▶ Flujo»: una onda que sale de los orígenes y recorre el grafo ---------- */
    let playing = null, playBtn = null;
    if (PLAY && G.edges.length && A.spec.graphTab !== false) {
      playBtn = A.btn(A.tools, '▶ ' + L.play, L.playT, 'gx-graphonly gx-fx-play');
      A.tools.insertBefore(playBtn, A.bFit);
      playBtn.onclick = () => (playing ? stop() : play());
    }
    function syncPlayBtn() { if (playBtn) { playBtn.classList.toggle('on', !!playing); playBtn.innerHTML = playing ? '■ ' + esc(L.stop) : '▶ ' + esc(L.play); } }
    function play(o) {
      stop();
      if (reduce || !S.vedges.length) return Promise.resolve();
      o = Object.assign({}, PLAY || { hop: 620 }, o);
      const vis = [...S.els.keys()].filter(id => !A.isGroup(id));
      const indeg = new Map(); S.vedges.forEach(v => { if (!v.back) indeg.set(v.to, (indeg.get(v.to) || 0) + 1); });
      let src = o.from ? [].concat(o.from).map(A.repOf).filter(Boolean) : vis.filter(id => !indeg.get(id) && S.vedges.some(v => v.from === id));
      if (!src.length) src = vis.slice(0, 1);
      const D = hops(src, 'out', { noBack: true }), hop = o.hop, dur = Math.round(hop * .95);
      const arrive = d => (d ? (d - 1) * hop + dur * .85 : 0);
      const token = playing = { src };
      A.world.classList.add('gx-playing'); syncPlayBtn();
      const on = el => el && el.classList.add('gx-on');
      let maxD = 0;
      D.forEach((d, id) => {
        maxD = Math.max(maxD, d);
        later(() => { if (playing !== token) return; const el = S.els.get(id); on(el); if (el) { el.style.setProperty('--gx-wdl', '0ms'); el.style.setProperty('--gx-wdur', '900ms'); restart(el, 'gx-wv'); later(() => el.classList.remove('gx-wv'), 1000); }
          A.ancestors(id).forEach(a => on(S.els.get(a))); }, arrive(d));
      });
      for (const x of S.edgeEls) {
        const v = x.g._v, da = D.get(v.from), db = D.get(v.to);
        if (da == null || db == null) continue;
        const lab = A.gLabels.querySelector(`.gx-elabel[data-id="${v.id.replace(/["\\]/g, '\\$&')}"]`);
        const t0 = da * hop;
        later(() => { if (playing !== token) return; on(x.g); on(lab); if (db === da + 1) pulse(x.g, 0, dur, false); }, db === da + 1 ? t0 : arrive(Math.max(da, db)));
      }
      src.forEach(id => shock(id, 0));
      return new Promise(res => {
        later(() => {
          if (playing !== token) return res();
          if (o.loop) { later(() => { if (playing === token) play(o).then(res); else res(); }, 900); return; }
          later(() => { if (playing === token) stop(); res(); }, 1400);
        }, (maxD + 1) * hop + dur);
      });
    }
    function stop() {
      if (!playing) return;
      playing = null;
      world.classList.remove('gx-playing');
      world.querySelectorAll('.gx-on').forEach(el => el.classList.remove('gx-on'));
      syncPlayBtn();
    }

    /* ---------- datos en vivo ---------- */
    const NODE_KEYS = ['heat', 'spark', 'progress', 'alert', 'value', 'change', 'min', 'max', 'parts', 'metrics', 'summary', 'status', 'unit', 'subtitle', 'label', 'color', 'thresholds'];
    const EDGE_KEYS = ['rate', 'weight', 'animated', 'speed', 'emphasis', 'label', 'summary'];
    function morph(old, el, ms) {
      const hOld = old.style.getPropertyValue('--gx-h'), hNew = el.style.getPropertyValue('--gx-h');
      const attrs = [], numsT = [], styles = [];
      if (hOld && hNew && hOld !== hNew) { el.style.setProperty('--gx-h', hOld); styles.push(() => el.style.setProperty('--gx-h', hNew)); }
      const om = new Map(); old.querySelectorAll('[data-m]').forEach(x => om.set(x.getAttribute('data-m'), x));
      el.querySelectorAll('[data-m]').forEach(x => {
        const o = om.get(x.getAttribute('data-m')); if (!o) return;
        ['d', 'transform', 'cx', 'cy', 'x', 'width'].forEach(a => {
          const va = o.getAttribute(a), vb = x.getAttribute(a);
          if (va != null && vb != null && va !== vb) { attrs.push({ x, a, va, vb }); x.setAttribute(a, va); }
        });
        if (x.hasAttribute('data-num') && o.hasAttribute('data-num')) {
          const va = parseFloat(o.getAttribute('data-num')), vb = parseFloat(x.getAttribute('data-num'));
          if (isFinite(va) && isFinite(vb) && va !== vb) { const dec = x.getAttribute('data-dec'); numsT.push({ x, va, vb, unit: x.getAttribute('data-unit') || '', dec: dec === '' || dec == null ? undefined : +dec }); x.textContent = fmt(va, { unit: x.getAttribute('data-unit') || '' }); }
        }
        const so = o.getAttribute('style'), sn = x.getAttribute('style');
        if (so != null && sn != null && so !== sn && /dash/.test(sn)) { x.setAttribute('style', so); styles.push(() => x.setAttribute('style', sn)); }
      });
      if (styles.length) { void el.getBoundingClientRect(); raf(() => raf(() => styles.forEach(f => f()))); }
      if (!attrs.length && !numsT.length) return;
      const t0 = now();
      const tick = () => {
        const t = clamp((now() - t0) / ms, 0, 1), e = easeOut(t);
        attrs.forEach(q => q.x.setAttribute(q.a, t < 1 ? lerpStr(q.va, q.vb, e) : q.vb));
        numsT.forEach(q => { q.x.textContent = fmt(t < 1 ? q.va + (q.vb - q.va) * e : q.vb, { unit: q.unit, dec: q.dec }); });
        if (t < 1 && el.isConnected) raf(tick);
      };
      raf(tick);
    }
    function setData(patch, o) {
      o = o || {};
      if (S.busy) return new Promise(res => setTimeout(() => res(setData(patch, o)), 90));
      const ms = o.duration != null ? o.duration : reduce ? 0 : 700;
      let relay = false, themed = false;
      const touched = new Set();
      Object.entries((patch && patch.nodes) || {}).forEach(([id, d]) => {
        const n = M.get(id); if (!n || !d) return;
        const before = cardExtra(n);
        NODE_KEYS.forEach(k => {
          if (d[k] === undefined) return;
          n[k] = d[k];
          if (k === 'label' || k === 'subtitle') { n._card = null; relay = true; }
          if (k === 'color') { n.cvar = A.colorVar(d.color); themed = true; }
        });
        if (cardExtra(n) !== before) { n._card = null; relay = true; }
        touched.add(id); A.ancestors(id).forEach(a => touched.add(a));
      });
      if (themed) A.refreshTheme();
      const eTouched = new Set();
      Object.entries((patch && patch.edges) || {}).forEach(([id, d]) => {
        const e = G.edges.find(x => x.id === id); if (!e || !d) return;
        EDGE_KEYS.forEach(k => { if (d[k] !== undefined) e[k] = d[k]; });
        if (d.label !== undefined) relay = true;
        eTouched.add(e);
      });
      const prevHeat = heat;
      computeHeat();
      if (heat && (!prevHeat || prevHeat.lo !== heat.lo || prevHeat.hi !== heat.hi)) for (const n of M.values()) if (heat.val.has(n.id)) touched.add(n.id);
      if (heat) for (const n of M.values()) if (heat.val.has(n.id) && (!prevHeat || prevHeat.val.get(n.id) !== heat.val.get(n.id))) touched.add(n.id);
      heatKey();
      if (relay) { touched.forEach(id => { const n = M.get(id); if (n) n._stale = true; }); return A.relayout({}); }
      touched.forEach(id => {
        if (!S.els.has(id) || A.isGroup(id)) return;
        quiet = true; const r = A.rerender(id); quiet = false;
        if (!r) return;
        if (ms) morph(r.old, r.el, ms);
      });
      if (eTouched.size) {
        MR = maxRate();
        const mw = Math.max(0, ...G.edges.map(e => (typeof e.weight === 'number' ? e.weight : 0)));
        budget = PT ? PT.max - [...world.querySelectorAll('.gx-pt')].length : 0;
        for (const x of S.edgeEls) {
          const v = x.g._v, hit = v.list.some(e => eTouched.has(e));
          if (!hit && !(PT && v.list.some(e => typeof e.rate === 'number'))) continue;
          if (hit && mw && x.g.classList.contains('weighted')) { const ws = v.list.reduce((a, e) => a + (typeof e.weight === 'number' ? e.weight : 0), 0); x.g._line.style.strokeWidth = (1.6 + 13 * Math.min(ws / mw, 1)).toFixed(1) + 'px'; }
          v.animated = v.list.some(e => e.animated);
          budget += x.g.querySelectorAll('.gx-pt').length;
          addParticles(x.g, flowOf(v));
        }
      }
      A.drawMini();
      return Promise.resolve();
    }

    /* ---------- pausa fuera de pantalla ---------- */
    let io = null;
    const pauseSet = on => { try { if (on) svg.pauseAnimations && svg.pauseAnimations(); else svg.unpauseAnimations && svg.unpauseAnimations(); } catch (_) { } };
    if (PT && typeof IntersectionObserver === 'function') {
      io = new IntersectionObserver(es => es.forEach(e => pauseSet(!e.isIntersecting)));
      io.observe(host);
    }
    const onVis = () => pauseSet(typeof document !== 'undefined' && document.hidden);
    if (PT && typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis);

    function destroy() {
      stop();
      timers.forEach(t => clearTimeout(t)); timers.clear();
      if (io) io.disconnect();
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis);
    }

    const config = Object.assign({}, cfg);
    return { config, cardExtra, leaf, edge, beforeTween, afterLayout, cam, highlight, trace, select, step, tip, mini, setData, play, stop, destroy, wave: (ids, dir, o) => wave([].concat(ids).map(A.repOf), dir || 'out', o) };
  }

  return { create, resolve, scale, SCHEMES, PRESETS, DEFAULTS, css: CSS, version: '1.8.0' };
});
