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
  const KEYS = ['particles', 'waves', 'play', 'heat', 'spark', 'progress', 'alerts', 'spotlight', 'entrance', 'grid', 'lod', 'glow', 'gradient', 'autoColor', 'skin', 'sketch', 'hoverFlow',
    'owners', 'blast', 'blocks', 'timeline', 'attach'];
  const OFF = KEYS.reduce((o, k) => (o[k] = false, o), {});
  /* lo que se enciende sin pedirlo: mejoras discretas y lo que piden los datos */
  const DEFAULTS = Object.assign({}, OFF, { particles: 'data', waves: true, heat: true, spark: true, progress: true, alerts: true, grid: true, lod: true, hoverFlow: true,
    owners: true, blast: true, blocks: true, timeline: true, attach: true });
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
    es: { owners: 'Equipos', ownersT: 'Filtrar y marcar por equipo', noOwner: 'Sin equipo', colorOwn: 'Colorear por equipo', clear: 'Limpiar', owner: 'Equipo',
      blast: 'Impacto', blastT: 'Radio de impacto: qué deja de funcionar si esto falla', blastH: 'Radio de impacto', hop: 'salto', hops: 'saltos', affected: 'piezas afectadas',
      teams: 'equipos', unblast: 'Quitar el impacto', origin: 'origen', tlPlay: 'Reproducir la línea de tiempo', tlPause: 'Pausa', total: 'Actividad total', now: 'ahora', play: 'Flujo', playT: 'Recorrer el flujo: una onda sale de los orígenes y sigue las conexiones', stop: 'Detener', heat: 'Calor', progress: 'Progreso', trend: 'Serie', min: 'mín', max: 'máx', last: 'último', flow: 'flujo · partículas según el caudal', alert: { crit: 'Crítico', warn: 'Atención', info: 'Aviso', ok: 'Correcto' } },
    en: { owners: 'Teams', ownersT: 'Filter and mark by team', noOwner: 'No team', colorOwn: 'Color by team', clear: 'Clear', owner: 'Team',
      blast: 'Impact', blastT: 'Blast radius: what stops working if this fails', blastH: 'Blast radius', hop: 'hop', hops: 'hops', affected: 'parts affected',
      teams: 'teams', unblast: 'Clear the impact', origin: 'origin', tlPlay: 'Play the timeline', tlPause: 'Pause', total: 'Total activity', now: 'now', play: 'Flow', playT: 'Play the flow: a wave leaves the sources and follows the connections', stop: 'Stop', heat: 'Heat', progress: 'Progress', trend: 'Series', min: 'min', max: 'max', last: 'last', flow: 'flow · particles by throughput', alert: { crit: 'Critical', warn: 'Warning', info: 'Notice', ok: 'OK' } }
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
/* ---------- equipos ---------- */
.gx-ob circle { fill: var(--gx-oc); stroke: var(--gx-card); stroke-width: 2; }
.gx-ob text { font: 700 7.5px system-ui, sans-serif; fill: #fff; text-anchor: middle; letter-spacing: .02em; pointer-events: none; }
.gx-ownf .gx-node:not(.gx-own-on), .gx-ownf .gx-edge:not(.gx-own-on):not(.gx-own-half), .gx-ownf .gx-elabel:not(.gx-own-on) { opacity: .13; transition: opacity .25s; }
.gx-ownf .gx-edge.gx-own-half { opacity: .45; }
.gx-ownf .gx-group:not(.gx-own-on) > .gx-gbox { opacity: .45; }
.gx-ownf .gx-node.gx-own-on > .gx-card { stroke: var(--gx-oc, var(--gx-accent)); stroke-width: 1.9; }
.gx-ownc .gx-node[data-own] > .gx-card { stroke: color-mix(in srgb, var(--gx-oc) 75%, var(--gx-card-line)); }
.gx-ownc .gx-node[data-own]:not(.gx-shape) > .gx-card { fill: color-mix(in srgb, var(--gx-oc) 8%, var(--gx-card)); }
.gx-ownc .gx-node[data-own].gx-shape > .gx-card:not(.ghost) { fill: color-mix(in srgb, var(--gx-oc) 12%, var(--gx-card)); }
.gx-ownc .gx-node[data-own] > .gx-accent { fill: var(--gx-oc); opacity: 1; }
.gx-own-pop { position: absolute; z-index: 45; display: none; width: 280px; max-height: 380px; overflow: auto; padding: 8px; background: var(--gx-card); border: 1px solid var(--gx-line);
  border-radius: 12px; box-shadow: var(--gx-shadow); font-size: 13px; }
.gx-own-pop.on { display: block; }
.gx-own-h { font-size: 10.5px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--gx-faint); padding: 4px 6px 6px; }
.gx-own-r { display: grid; grid-template-columns: 24px 1fr auto; gap: 9px; align-items: center; width: 100%; padding: 6px; border: 0; border-radius: 8px; background: none; color: var(--gx-ink); font: inherit; text-align: left; cursor: pointer; }
.gx-own-r:hover { background: var(--gx-bg); }
.gx-own-r[aria-pressed="true"] { background: color-mix(in srgb, var(--gx-oc, var(--gx-accent)) 12%, transparent); }
.gx-own-r i, .gx-bk-own i, .gx-bk-chip i { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: var(--gx-oc, var(--gx-neu)); color: #fff; font: 700 9px system-ui, sans-serif; font-style: normal; }
.gx-own-r[aria-pressed="true"] i { box-shadow: 0 0 0 2px var(--gx-card), 0 0 0 4px var(--gx-oc, var(--gx-accent)); }
.gx-own-r b { font: 600 11px var(--gx-mono); color: var(--gx-muted); }
.gx-own-f { display: flex; gap: 6px; padding: 8px 4px 2px; border-top: 1px solid var(--gx-line); margin-top: 6px; }
.gx-own-f .gx-btn { flex: 1; font-size: 12px; }
/* ---------- radio de impacto ---------- */
.gx-blasting .gx-node:not(.gx-bl), .gx-blasting .gx-edge:not(.gx-bl), .gx-blasting .gx-elabel { opacity: .15; transition: opacity .3s; }
.gx-blasting .gx-group:not(.gx-bl) > .gx-gbox { opacity: .4; }
.gx-blasting .gx-node.gx-bl-d0 > .gx-card { stroke: var(--gx-del); stroke-width: 3; fill: color-mix(in srgb, var(--gx-del) 22%, var(--gx-card)); }
.gx-blasting .gx-node.gx-bl-d1 > .gx-card { stroke: var(--gx-del); stroke-width: 2; fill: color-mix(in srgb, var(--gx-del) 12%, var(--gx-card)); }
.gx-blasting .gx-node.gx-bl-d2 > .gx-card { stroke: #ea7a1e; stroke-width: 1.8; fill: color-mix(in srgb, #ea7a1e 11%, var(--gx-card)); }
.gx-blasting .gx-node.gx-bl-d3 > .gx-card { stroke: var(--gx-mod); stroke-width: 1.6; fill: color-mix(in srgb, var(--gx-mod) 10%, var(--gx-card)); }
.gx-blasting .gx-node.gx-bl-d0 { filter: drop-shadow(0 0 14px color-mix(in srgb, var(--gx-del) 55%, transparent)); }
.gx-blasting .gx-edge.gx-bl > .gx-eline { stroke: color-mix(in srgb, var(--gx-del) 80%, var(--gx-neu)); stroke-width: 2.2; opacity: .95; }
.gx-blastl { pointer-events: none; }
.gx-ring { --gx-ring: var(--gx-mod); fill: color-mix(in srgb, var(--gx-ring) 5%, transparent); stroke: var(--gx-ring); stroke-width: 1.6; stroke-dasharray: 7 6;
  transform-box: fill-box; transform-origin: center; animation: gx-ring .75s cubic-bezier(.2, .8, .2, 1) both; animation-delay: calc(var(--k, 0) * 170ms); }
.gx-ring.h1, .gx-ringt.h1 { --gx-ring: var(--gx-del); } .gx-ring.h2, .gx-ringt.h2 { --gx-ring: #ea7a1e; } .gx-ring.h3, .gx-ringt.h3 { --gx-ring: var(--gx-mod); }
@keyframes gx-ring { from { transform: scale(.15); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.gx-ringt { font: 700 11px var(--gx-mono); font-size: max(11px, calc(11px / var(--gx-k, 1))); fill: var(--gx-ring); text-anchor: middle; paint-order: stroke; stroke: var(--gx-canvas); stroke-width: 4px;
  animation: gx-fadein .5s both; animation-delay: calc(var(--k, 0) * 170ms + 250ms); }
.gx-blast-b.on { color: #fff; background: var(--gx-del); border-color: var(--gx-del); }
/* con los efectos, las acciones del panel pueden ser más: pasan a dos líneas antes que esconderse */
.gx-fx .gx-pact { flex-wrap: wrap; overflow: visible; }
.gx-bk-blast h5 { margin: 2px 0 -3px; font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--gx-faint); }
.gx-ring.h2 { fill: color-mix(in srgb, var(--gx-ring) 3.5%, transparent); } .gx-ring.h3 { fill: color-mix(in srgb, var(--gx-ring) 2%, transparent); }
/* ---------- extras de las formas ---------- */
.gx-att-bg { fill: color-mix(in srgb, var(--gx-card) 92%, transparent); stroke: var(--gx-card-line); stroke-width: 1; }
.gx-att .gx-sp-l { stroke-width: 1.6; }
.gx-att-tr { fill: var(--gx-glyph-bg); }
.gx-att-f { fill: var(--gx-accent); } .gx-att-f.done { fill: var(--gx-add); }
.gx-node.has-c .gx-att-f { fill: var(--gx-c); } .gx-node.has-h .gx-att-f { fill: var(--gx-h); }
.gx-att-v { font-size: 10px; }
/* ---------- línea de tiempo ---------- */
.gx-tml { border: 1px solid var(--gx-line); border-radius: 13px; background: var(--gx-bg); padding: 10px 12px 8px; display: flex; flex-direction: column; gap: 6px; }
.gx-tml-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.gx-tml-play { min-width: 38px; }
.gx-tml-sp .gx-btn { padding: 6px 9px; font-variant-numeric: tabular-nums; }
.gx-tml-now { display: inline-flex; align-items: baseline; gap: 8px; }
.gx-tml-now b { font: 700 17px var(--gx-mono); color: var(--gx-ink); font-variant-numeric: tabular-nums; }
.gx-tml-now small { font: 11px var(--gx-mono); color: var(--gx-faint); }
.gx-tml-lab { font-size: 12px; color: var(--gx-muted); margin-left: auto; }
.gx-tml-plot { position: relative; cursor: ew-resize; touch-action: none; user-select: none; -webkit-user-select: none; }
.gx-tml-svg { display: block; width: 100%; overflow: visible; }
.gx-tml-area { fill: color-mix(in srgb, var(--gx-accent) 18%, transparent); }
.gx-tml-line { fill: none; stroke: var(--gx-accent); stroke-width: 1.6; stroke-linejoin: round; }
.gx-tml-grid { stroke: var(--gx-line); stroke-width: 1; }
.gx-tml-ax { font: 10px var(--gx-mono); fill: var(--gx-faint); font-variant-numeric: tabular-nums; }
.gx-tml-k { font-size: 10.5px; font-weight: 600; fill: var(--gx-muted); }
.gx-tml-rl { font-size: 10.5px; font-weight: 500; fill: var(--gx-muted); }
.gx-tml-row { cursor: pointer; }
.gx-tml-row:hover .gx-tml-rl { fill: var(--gx-accent); }
.gx-tml-row rect { transition: fill .3s; }
.gx-tml-ev path { stroke: var(--gx-ev, var(--gx-accent)); stroke-width: 1.2; stroke-dasharray: 3 3; }
.gx-tml-ev circle { fill: var(--gx-ev, var(--gx-accent)); stroke: var(--gx-bg); stroke-width: 2; }
.gx-tml-ev.t-crit { --gx-ev: var(--gx-del); } .gx-tml-ev.t-warn { --gx-ev: var(--gx-warn); } .gx-tml-ev.t-good { --gx-ev: var(--gx-add); }
.gx-tml-head { position: absolute; left: 0; top: 0; width: 0; pointer-events: none; transition: transform .25s cubic-bezier(.2, .8, .2, 1); }
.gx-tml-head::before { content: ""; position: absolute; left: -1px; top: 0; bottom: 0; width: 2px; background: var(--gx-ink); border-radius: 1px; }
.gx-tml-head i { position: absolute; left: -6px; top: -4px; width: 12px; height: 12px; border-radius: 50%; background: var(--gx-ink); box-shadow: 0 0 0 3px var(--gx-bg); }
.gx-tml-toast { position: absolute; left: 50%; top: 14px; z-index: 13; transform: translate(-50%, -8px); opacity: 0; pointer-events: none; transition: opacity .25s, transform .25s;
  padding: 7px 14px; border-radius: 99px; font-size: 13px; background: var(--gx-card); color: var(--gx-ink); border: 1px solid var(--gx-line); box-shadow: var(--gx-shadow); white-space: nowrap; }
.gx-tml-toast b { font-family: var(--gx-mono); margin-right: 6px; color: var(--gx-ev, var(--gx-accent)); }
.gx-tml-toast.t-crit { --gx-ev: var(--gx-del); border-color: var(--gx-del); } .gx-tml-toast.t-warn { --gx-ev: var(--gx-warn); } .gx-tml-toast.t-good { --gx-ev: var(--gx-add); }
.gx-tml-toast.on { opacity: 1; transform: translate(-50%, 0); }
.gx-flowview .gx-tml { display: none; }
/* ---------- bloques ricos del panel ---------- */
.gx-bk { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
.gx-bk h4 { margin: 6px 0 -2px; font-size: 10.5px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--gx-faint); }
.gx-bk h5 { margin: 6px 0 0; font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--gx-faint); }
.gx-bk-text { margin: 0; color: var(--gx-ink); }
.gx-bk-text.s-lead { font-size: 15px; line-height: 1.45; font-weight: 500; }
.gx-bk-text.s-muted { color: var(--gx-muted); } .gx-bk-text.s-small { font-size: 11.5px; color: var(--gx-muted); }
.gx-bk code { font: 11.5px var(--gx-mono); background: var(--gx-bg); padding: 1px 4px; border-radius: 4px; }
.gx-bk a { color: var(--gx-accent); }
.gx-bk-hr { border: 0; border-top: 1px solid var(--gx-line); margin: 2px 0; }
.gx-bk-call { border-radius: 9px; padding: 9px 11px; background: var(--gx-tb-bg, var(--gx-accent-soft)); border: 1px solid color-mix(in srgb, var(--gx-tb, var(--gx-accent)) 30%, transparent); }
.gx-bk-call > b { display: block; color: var(--gx-tb, var(--gx-accent)); font-size: 12.5px; margin-bottom: 2px; }
.gx-bk-call p { margin: 0; font-size: 12.5px; }
.gx-bk .t-warn { --gx-tb: var(--gx-warn); --gx-tb-bg: color-mix(in srgb, var(--gx-warn) 10%, transparent); } .gx-bk .t-good { --gx-tb: var(--gx-add); --gx-tb-bg: var(--gx-add-soft); }
.gx-bk .t-crit { --gx-tb: var(--gx-del); --gx-tb-bg: var(--gx-del-soft); } .gx-bk .t-neutral { --gx-tb: var(--gx-muted); --gx-tb-bg: var(--gx-bg); }
.gx-bk-quote { margin: 0; padding: 4px 0 4px 12px; border-left: 3px solid var(--gx-accent); font-size: 14px; font-style: italic; color: var(--gx-ink); }
.gx-bk-quote p { margin: 0; } .gx-bk-quote cite { display: block; margin-top: 4px; font-size: 11.5px; font-style: normal; color: var(--gx-muted); }
.gx-bk-code { margin: 0; padding: 9px 11px; border-radius: 9px; background: var(--gx-bg); border: 1px solid var(--gx-line); overflow-x: auto; font: 11.5px/1.55 var(--gx-mono); position: relative; }
.gx-bk-code[data-lang]::after { content: attr(data-lang); position: absolute; top: 5px; right: 8px; font-size: 9.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--gx-faint); }
.gx-bk-code code { background: none; padding: 0; font: inherit; }
.gx-bk-code .k { color: var(--gx-p2); font-weight: 600; } .gx-bk-code .s { color: var(--gx-p5); } .gx-bk-code .n { color: var(--gx-p3); } .gx-bk-code .c { color: var(--gx-faint); font-style: italic; }
.gx-bk-kv { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; margin: 0; }
.gx-bk-kv div { padding: 6px 8px; border-radius: 8px; background: var(--gx-bg); min-width: 0; }
.gx-bk-kv dt { font-size: 10.5px; color: var(--gx-faint); } .gx-bk-kv dd { margin: 1px 0 0; font-weight: 600; font-size: 12.5px; overflow-wrap: anywhere; }
.gx-bk-list { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 3px; }
.gx-bk-check .gx-bk-ph { display: flex; align-items: center; gap: 8px; font: 600 11px var(--gx-mono); color: var(--gx-muted); }
.gx-bk-check .gx-bk-ph i { flex: 1; height: 5px; border-radius: 3px; background: linear-gradient(90deg, var(--gx-add) calc(var(--f) * 100%), var(--gx-glyph-bg) 0); }
.gx-bk-check ul { list-style: none; margin: 6px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.gx-bk-check li { display: flex; gap: 8px; align-items: baseline; font-size: 12.5px; }
.gx-bk-check li i { flex: none; width: 13px; height: 13px; border-radius: 4px; border: 1.5px solid var(--gx-faint); transform: translateY(2px); }
.gx-bk-check li.on i { background: var(--gx-add); border-color: var(--gx-add); box-shadow: inset 0 0 0 2px var(--gx-card); }
.gx-bk-check li.on span { color: var(--gx-muted); text-decoration: line-through; }
.gx-bk-tw { overflow-x: auto; border: 1px solid var(--gx-line); border-radius: 9px; }
.gx-bk-table { border-collapse: collapse; width: 100%; font-size: 12px; }
.gx-bk-table th, .gx-bk-table td { padding: 5px 8px; border-bottom: 1px solid var(--gx-line); text-align: left; }
.gx-bk-table th { font-size: 10px; letter-spacing: .06em; text-transform: uppercase; color: var(--gx-faint); background: var(--gx-bg); }
.gx-bk-table tr:last-child td { border-bottom: 0; }
.gx-bk-table .num { text-align: right; font-variant-numeric: tabular-nums; font-family: var(--gx-mono); }
.gx-bk-table td.t-good { color: var(--gx-add); font-weight: 600; } .gx-bk-table td.t-warn { color: var(--gx-warn); font-weight: 600; } .gx-bk-table td.t-crit { color: var(--gx-del); font-weight: 600; }
.gx-bk-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(92px, 1fr)); gap: 6px; }
.gx-bk-stat { display: flex; flex-direction: column; gap: 1px; padding: 7px 9px; border-radius: 9px; background: var(--gx-bg); min-width: 0; }
.gx-bk-stat .l { font-size: 10.5px; color: var(--gx-faint); }
.gx-bk-stat b { font-size: 19px; font-weight: 700; letter-spacing: -.02em; font-variant-numeric: tabular-nums; line-height: 1.15; }
.gx-bk-stat b small { font-size: 11px; font-weight: 500; color: var(--gx-muted); margin-left: 3px; }
.gx-bk-stat .c { font: 600 11px var(--gx-mono); color: var(--gx-muted); } .gx-bk-stat .c.good { color: var(--gx-add); } .gx-bk-stat .c.bad { color: var(--gx-del); }
.gx-bk-spk { display: block; width: 100%; height: 22px; margin-top: 2px; }
.gx-bk-spk .a { fill: var(--bk, var(--gx-accent)); fill-opacity: .14; } .gx-bk-spk .l { fill: none; stroke: var(--bk, var(--gx-accent)); stroke-width: 1.5; vector-effect: non-scaling-stroke; }
.gx-bk-spk circle { fill: var(--bk, var(--gx-accent)); }
.gx-bk-sparkw { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; }
.gx-bk-sparkw .gx-bk-spk { height: 44px; } .gx-bk-sparkw b { font: 700 15px var(--gx-mono); }
.gx-bk-draw { stroke-dasharray: 1; stroke-dashoffset: 1; animation: gx-draw 1s cubic-bezier(.2, .8, .2, 1) .1s forwards; }
.gx-bk-chart { display: block; width: 100%; height: auto; overflow: visible; }
.gx-bk-chart .gr { stroke: var(--gx-line); stroke-width: 1; }
.gx-bk-chart .ax { font: 9.5px var(--gx-mono); fill: var(--gx-faint); }
.gx-bk-chart .ln { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.gx-bk-chart .ar { fill-opacity: .13; }
.gx-bk-chart .pt { opacity: 0; transition: opacity .15s; } .gx-bk-chart:hover .pt { opacity: 1; } .gx-bk-chart .pt:hover { r: 4.5; }
.gx-bk-chart .bar { transform-box: fill-box; transform-origin: bottom; animation: gx-bkbar .6s cubic-bezier(.2, .8, .2, 1) both; }
.gx-bk-chart .bar:hover { filter: brightness(1.15); }
@keyframes gx-bkbar { from { transform: scaleY(0); } }
.gx-bk-leg { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 11px; color: var(--gx-muted); margin-top: 4px; }
.gx-bk-leg i { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 5px; vertical-align: -1px; }
.gx-bk-bars { display: flex; flex-direction: column; gap: 5px; }
.gx-bk-bars .r { display: grid; grid-template-columns: minmax(64px, 34%) 1fr auto; gap: 8px; align-items: center; font-size: 12px; }
.gx-bk-bars .l { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--gx-ink); }
.gx-bk-bars .t { height: 8px; border-radius: 4px; background: var(--gx-glyph-bg); overflow: hidden; }
.gx-bk-bars .t i { display: block; height: 100%; width: calc(var(--f) * 100%); border-radius: 4px; background: var(--gx-tb, var(--gx-accent)); transform-origin: left; animation: gx-grow .7s cubic-bezier(.2, .8, .2, 1) both; }
.gx-bk-bars .t.p.done i { background: var(--gx-add); }
.gx-bk-bars .r.h1 .t i { background: var(--gx-del); } .gx-bk-bars .r.h2 .t i { background: #ea7a1e; } .gx-bk-bars .r.h3 .t i { background: var(--gx-mod); }
.gx-bk-bars .v { font: 600 11px var(--gx-mono); color: var(--gx-muted); font-variant-numeric: tabular-nums; }
.gx-bk-shape { display: block; width: 100%; height: auto; margin: 0 auto; overflow: visible; }
.gx-bk-tl { list-style: none; margin: 0; padding: 0 0 0 14px; border-left: 2px solid var(--gx-line); display: flex; flex-direction: column; gap: 7px; }
.gx-bk-tl li { position: relative; display: flex; flex-direction: column; font-size: 12.5px; }
.gx-bk-tl li::before { content: ""; position: absolute; left: -20px; top: 4px; width: 10px; height: 10px; border-radius: 50%; background: var(--gx-tb, var(--gx-accent)); box-shadow: 0 0 0 3px var(--gx-card); }
.gx-bk-tl time { font: 600 10.5px var(--gx-mono); color: var(--gx-faint); }
.gx-bk-heat .r { display: flex; gap: 8px; align-items: center; }
.gx-bk-heat .l { width: 64px; flex: none; font-size: 11px; color: var(--gx-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gx-bk-heat .cells { flex: 1; display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 2px; }
.gx-bk-heat .cells i { height: 14px; border-radius: 3px; }
.gx-bk-heat .ax .cells { display: flex; justify-content: space-between; font: 9.5px var(--gx-mono); color: var(--gx-faint); }
.gx-bk-heat .ax em { font-style: normal; }
.gx-bk-heat .r + .r { margin-top: 2px; }
.gx-bk-badges, .gx-bk-chips { display: flex; flex-wrap: wrap; gap: 5px; }
.gx-bk-badges span { font-size: 11.5px; font-weight: 600; padding: 2px 9px; border-radius: 99px; background: var(--gx-tb-bg, var(--gx-bg)); color: var(--gx-tb, var(--gx-muted)); border: 1px solid color-mix(in srgb, var(--gx-tb, var(--gx-line)) 30%, transparent); }
.gx-bk-chip { display: inline-flex; align-items: center; gap: 6px; padding: 3px 9px 3px 4px; border-radius: 99px; border: 1px solid var(--gx-line); background: var(--gx-bg); color: var(--gx-ink); font: 500 12px system-ui, sans-serif; cursor: pointer; }
button.gx-bk-chip:hover { border-color: var(--gx-accent); color: var(--gx-accent); }
.gx-bk-chip.st { cursor: default; padding-left: 4px; } .gx-bk-chip i { width: 18px; height: 18px; font-size: 7.5px; } .gx-bk-chip b { font: 600 11px var(--gx-mono); color: var(--gx-muted); }
.gx-bk-more { font: 600 11px var(--gx-mono); color: var(--gx-muted); align-self: center; }
.gx-bk-steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; counter-reset: st; }
.gx-bk-steps li { display: flex; gap: 9px; align-items: center; font-size: 12.5px; counter-increment: st; }
.gx-bk-steps li i { flex: none; width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; border: 1.5px solid var(--gx-line); font: 700 10px var(--gx-mono); font-style: normal; color: var(--gx-muted); }
.gx-bk-steps li i::before { content: counter(st); }
.gx-bk-steps li.s-done i { background: var(--gx-add); border-color: var(--gx-add); color: #fff; } .gx-bk-steps li.s-done i::before { content: "✓"; }
.gx-bk-steps li.s-active i { border-color: var(--gx-accent); color: var(--gx-accent); box-shadow: 0 0 0 3px var(--gx-accent-soft); animation: gx-stp 1.6s ease-in-out infinite; }
.gx-bk-steps li.s-active span { font-weight: 600; } .gx-bk-steps li.s-todo span { color: var(--gx-muted); }
@keyframes gx-stp { 50% { box-shadow: 0 0 0 6px var(--gx-accent-soft); } }
.gx-bk-img { margin: 0; } .gx-bk-img img { width: 100%; border-radius: 9px; border: 1px solid var(--gx-line); display: block; }
.gx-bk-img figcaption { font-size: 11px; color: var(--gx-muted); margin-top: 4px; }
.gx-bk-own { display: flex; align-items: center; gap: 10px; margin-top: 10px; padding: 7px 9px; border-radius: 10px; background: var(--gx-bg); }
.gx-bk-own i { width: 30px; height: 30px; font-size: 10.5px; flex: none; }
.gx-bk-own span { display: flex; flex-direction: column; min-width: 0; flex: 1; } .gx-bk-own small { font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: var(--gx-faint); }
.gx-bk-own b { font-size: 13px; } .gx-bk-own em { font-style: normal; font-size: 11.5px; color: var(--gx-muted); font-family: var(--gx-mono); }
.gx-bk-own a { color: var(--gx-accent); text-decoration: none; font-weight: 700; }
.gx-bk-blast { margin-top: 12px; padding: 10px; border-radius: 11px; border: 1px solid color-mix(in srgb, var(--gx-del) 35%, var(--gx-line)); background: color-mix(in srgb, var(--gx-del) 5%, var(--gx-card)); display: flex; flex-direction: column; gap: 8px; }
.gx-bk-bh { display: flex; justify-content: space-between; align-items: center; gap: 8px; } .gx-bk-bh b { color: var(--gx-del); font-size: 13px; } .gx-bk-bh .gx-btn { font-size: 11.5px; padding: 5px 8px; }
.gx-bk-blast .gx-bk-stat { background: var(--gx-card); }
@media (prefers-reduced-motion: reduce) {
  .gx-ring, .gx-ringt, .gx-bk-draw, .gx-bk-chart .bar, .gx-bk-bars .t i, .gx-bk-steps li.s-active i { animation: none; stroke-dashoffset: 0; }
  .gx-tml-head { transition: none; }
}
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


  /* ---------- bloques ricos (panel de detalle) ---------- */
  /* `blocks` en una pieza: texto con formato, avisos, citas, código, pares clave-valor, listas, checklists,
     tablas, cifras, gráficos, barras, progreso, gauge, donut, una línea de eventos, una tira de actividad,
     insignias, pasos, imágenes. Todo se escapa; los colores y las URLs solo pasan si son válidos. */
  const escH = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const COLOR = /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla|oklch|oklab)\([0-9.,%\s/+-]+(deg|turn|rad)?[0-9.,%\s/+-]*\)|[a-z]{3,20})$/i;
  const safeC = c => (typeof c === 'string' && COLOR.test(c.trim()) ? c.trim() : null);
  const TONES = { info: 1, warn: 1, good: 1, crit: 1, neutral: 1 };
  /* un markdown mínimo: **negrita**, *cursiva*, `código` y [enlaces](https://…) */
  function md(t) {
    return escH(t).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>').replace(/\n/g, '<br>');
  }
  /* resaltado ligero: comentarios, cadenas, números y palabras clave (JS, Python, SQL, shell) */
  const KW = /^(const|let|var|function|return|if|else|elif|for|while|class|def|import|from|export|async|await|new|true|false|null|undefined|None|True|False|select|where|join|group|by|order|insert|update|delete|and|or|not|in|is|as|with|then|end|fi|do|done|echo|try|catch|raise|throw|yield|self|this|limit|values|into|set|create|table)$/i;
  function hilite(code, lang) {
    const hash = /^(py|python|sh|bash|shell|yaml|yml|rb|ruby|toml)$/i.test(lang || '');
    const re = hash ? /(#[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|\b(\d+(?:\.\d+)?)\b|([A-Za-z_][\w$]*)/g : /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|--[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`[^`]*`)|\b(\d+(?:\.\d+)?)\b|([A-Za-z_][\w$]*)/g;
    let out = '', last = 0, m;
    while ((m = re.exec(code))) {
      out += escH(code.slice(last, m.index)); last = re.lastIndex;
      if (m[1]) out += `<span class="c">${escH(m[1])}</span>`;
      else if (m[2]) out += `<span class="s">${escH(m[2])}</span>`;
      else if (m[3]) out += `<span class="n">${escH(m[3])}</span>`;
      else out += KW.test(m[4]) ? `<span class="k">${escH(m[4])}</span>` : escH(m[4]);
    }
    return out + escH(code.slice(last));
  }
  /* un árbol de graphx-shapes como cadena SVG (para el gauge, el donut o el KPI dentro de un bloque) */
  function treeStr(t, icons) {
    if (t.tag === 'glyph') {
      const a = t.attrs, d = (icons && (icons[a.kind] || icons.other)) || '';
      return a.bare ? `<path class="gx-glyph-ic gx-bigic" d="${d}" transform="translate(${a.x},${a.y}) scale(${a.size / 16})"/>`
        : `<g class="gx-glyph" transform="translate(${a.x},${a.y})"><rect width="${a.size}" height="${a.size}" rx="${a.size * .28}" class="gx-glyph-bg"/><path class="gx-glyph-ic" d="${d}" transform="translate(5,5) scale(${(a.size - 10) / 16})"/></g>`;
    }
    const at = Object.keys(t.attrs).filter(k => t.attrs[k] != null).map(k => ` ${k}="${escH(t.attrs[k])}"`).join('');
    return `<${t.tag}${at}>${t.text != null ? escH(t.text) : ''}${t.children.map(c => treeStr(c, icons)).join('')}</${t.tag}>`;
  }
  const blockNums = a => (Array.isArray(a) ? a.map(Number).filter(v => isFinite(v)) : []);
  function sparkSVG(vals, o) {
    o = o || {};
    const W = o.w || 120, H = o.h || 30, v = blockNums(vals); if (v.length < 2) return '';
    const lo = Math.min(...v), hi = Math.max(...v), k = hi - lo || 1, P = v.map((x, i) => [2 + (W - 4) * i / (v.length - 1), H - 3 - (H - 6) * (x - lo) / k]);
    const d = 'M' + P.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L'), L = P[P.length - 1], col = safeC(o.color);
    return `<svg class="gx-bk-spk" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"${col ? ` style="--bk:${col}"` : ''}><path class="a" d="${d}L${W - 2},${H}L2,${H}Z"/><path class="l gx-bk-draw" pathLength="1" d="${d}"/><circle cx="${L[0].toFixed(1)}" cy="${L[1].toFixed(1)}" r="2.4"/></svg>`;
  }
  /* gráfico de líneas, áreas o barras (agrupadas o apiladas) con su rejilla, sus ejes y un tooltip por punto */
  function chartSVG(b, lang) {
    const series = (Array.isArray(b.series) ? b.series : b.values ? [{ label: b.label, values: b.values, color: b.color }] : []).map((x, i) => ({ label: x.label || '', v: blockNums(x.values), c: safeC(x.color) || `var(--gx-p${i % 8})` })).filter(x => x.v.length);
    if (!series.length) return '';
    const kind = b.kind || 'line', n = Math.max(...series.map(x => x.v.length)), W = 320, H = b.height || 150, L = 34, Rr = 8, T = 10, B = 22;
    const stack = kind === 'stack';
    const tot = i => series.reduce((a, x) => a + (x.v[i] || 0), 0);
    let hi = stack ? Math.max(...Array.from({ length: n }, (_, i) => tot(i))) : Math.max(...series.flatMap(x => x.v)), lo = kind === 'line' ? Math.min(0, ...series.flatMap(x => x.v)) : 0;
    if (b.max != null) hi = +b.max; if (!(hi > lo)) hi = lo + 1;
    const X = i => L + (W - L - Rr) * (n === 1 ? .5 : i / (n - 1)), Y = v => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
    const labels = Array.isArray(b.labels) ? b.labels : [];
    const fmtv = v => fmtN(v, lang) + (b.unit ? ' ' + b.unit : '');
    let g = '';
    [0, .5, 1].forEach(f => { const v = lo + (hi - lo) * f, y = Y(v); g += `<path class="gr" d="M${L},${y.toFixed(1)}H${W - Rr}"/><text class="ax" x="${L - 5}" y="${(y + 3.5).toFixed(1)}" text-anchor="end">${escH(fmtN(v, lang))}</text>`; });
    [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i && labels[v] != null).forEach(i => { g += `<text class="ax" x="${X(i).toFixed(1)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}">${escH(labels[i])}</text>`; });
    let body = '';
    if (kind === 'bar' || stack) {
      const bw = (W - L - Rr) / n, inner = bw * .72, each = stack ? inner : inner / series.length;
      for (let i = 0; i < n; i++) {
        let acc = 0;
        series.forEach((x, k) => {
          const v = x.v[i] || 0, x0 = L + bw * i + (bw - inner) / 2 + (stack ? 0 : k * each), y1 = Y(stack ? acc + v : v), y0 = Y(stack ? acc : lo);
          body += `<rect class="bar" x="${x0.toFixed(1)}" y="${y1.toFixed(1)}" width="${Math.max(each - 1.5, 1).toFixed(1)}" height="${Math.max(y0 - y1, 0).toFixed(1)}" rx="2" style="fill:${x.c};animation-delay:${(i * 35).toFixed(0)}ms"><title>${escH((labels[i] != null ? labels[i] + ' · ' : '') + (x.label ? x.label + ': ' : '') + fmtv(v))}</title></rect>`;
          acc += v;
        });
      }
    } else {
      series.forEach(x => {
        const P = x.v.map((v, i) => [X(i), Y(v)]), d = 'M' + P.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L');
        if (kind === 'area') body += `<path class="ar" style="fill:${x.c}" d="${d}L${P[P.length - 1][0].toFixed(1)},${Y(lo).toFixed(1)}L${P[0][0].toFixed(1)},${Y(lo).toFixed(1)}Z"/>`;
        body += `<path class="ln gx-bk-draw" pathLength="1" style="stroke:${x.c}" d="${d}"/>`;
        body += P.map((p, i) => `<circle class="pt" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" style="fill:${x.c}"><title>${escH((labels[i] != null ? labels[i] + ' · ' : '') + (x.label ? x.label + ': ' : '') + fmtv(x.v[i]))}</title></circle>`).join('');
      });
    }
    const leg = series.length > 1 || series[0].label ? `<div class="gx-bk-leg">${series.map(x => `<span><i style="background:${x.c}"></i>${escH(x.label)}</span>`).join('')}</div>` : '';
    return `<svg class="gx-bk-chart k-${kind}" viewBox="0 0 ${W} ${H}">${g}${body}</svg>${leg}`;
  }
  const fmtN = (v, lang) => { const a = Math.abs(v); let s = a >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : a >= 1e4 ? (v / 1e3).toFixed(0) + 'k' : a >= 1e3 ? (v / 1e3).toFixed(1) + 'k' : Number.isInteger(v) ? String(v) : v.toFixed(a >= 10 ? 1 : 2); s = s.replace(/\.0(?=[kM]|$)/, ''); return lang === 'en' ? s : s.replace('.', ','); };
  function renderBlocks(blocks, ctx) {
    ctx = ctx || {};
    const lang = ctx.lang || 'es', SHP = (typeof window !== 'undefined' ? window : globalThis).GraphX.shapes, icons = ctx.icons || ((typeof window !== 'undefined' ? window : globalThis).GraphX.icons) || {};
    const tone = t => (TONES[t] ? t : 'info');
    const one = b => {
      if (!b || typeof b !== 'object') return '';
      const ttl = b.title ? `<h4>${escH(b.title)}</h4>` : '';
      switch (b.type) {
        case 'text': return `${ttl}<p class="gx-bk-text s-${escH(b.style || 'body')}">${md(b.text)}</p>`;
        case 'heading': return `<h4 class="gx-bk-h">${escH(b.text)}</h4>`;
        case 'divider': return '<hr class="gx-bk-hr">';
        case 'callout': return `<div class="gx-bk-call t-${tone(b.tone)}">${b.title ? `<b>${escH(b.title)}</b>` : ''}<p>${md(b.text)}</p></div>`;
        case 'quote': return `<blockquote class="gx-bk-quote"><p>${md(b.text)}</p>${b.by ? `<cite>${escH(b.by)}</cite>` : ''}</blockquote>`;
        case 'code': return `${ttl}<pre class="gx-bk-code"${b.lang ? ` data-lang="${escH(b.lang)}"` : ''}><code>${hilite(String(b.code || ''), b.lang)}</code></pre>`;
        case 'kv': return `${ttl}<dl class="gx-bk-kv">${(b.items || []).map(it => { const [k, v] = Array.isArray(it) ? it : [it.label, it.value]; return `<div><dt>${escH(k)}</dt><dd>${md(v)}</dd></div>`; }).join('')}</dl>`;
        case 'list': { const tg = b.ordered ? 'ol' : 'ul'; return `${ttl}<${tg} class="gx-bk-list">${(b.items || []).map(t => `<li>${md(t)}</li>`).join('')}</${tg}>`; }
        case 'checklist': {
          const it = b.items || [], done = it.filter(x => x && x.done).length;
          return `${ttl}<div class="gx-bk-check"><div class="gx-bk-ph"><span>${done}/${it.length}</span><i style="--f:${it.length ? done / it.length : 0}"></i></div><ul>${it.map(x => `<li class="${x && x.done ? 'on' : ''}"><i></i><span>${md(x && x.text)}</span></li>`).join('')}</ul></div>`;
        }
        case 'table': {
          const cols = b.columns || [], num = cols.map((_, j) => (b.rows || []).every(r => r[j] == null || typeof (r[j] && r[j].v !== undefined ? r[j].v : r[j]) === 'number'));
          const cell = (c, j) => { const v = c && typeof c === 'object' && 'v' in c ? c.v : c, t = c && typeof c === 'object' && TONES[c.tone] ? ` t-${c.tone}` : ''; return `<td class="${num[j] ? 'num' : ''}${t}">${typeof v === 'number' ? escH(fmtN(v, lang)) : md(v)}</td>`; };
          return `${ttl}<div class="gx-bk-tw"><table class="gx-bk-table"><thead><tr>${cols.map((c, j) => `<th class="${num[j] ? 'num' : ''}">${escH(c)}</th>`).join('')}</tr></thead><tbody>${(b.rows || []).map(r => `<tr>${r.map(cell).join('')}</tr>`).join('')}</tbody></table></div>`;
        }
        case 'stat': case 'stats':
          return `${ttl}<div class="gx-bk-stats">${(b.items || [b]).map(x => {
            const ch = typeof x.change === 'number' ? x.change : null, good = ch == null ? '' : (ch > 0) === (x.good !== 'down') ? ' good' : ' bad';
            const pc = ch == null ? '' : (Math.abs(ch) < 10 ? Math.abs(ch).toFixed(1) : Math.abs(ch).toFixed(0)).replace(/\.0$/, '').replace('.', lang === 'en' ? '.' : ',');
            return `<div class="gx-bk-stat"><span class="l">${escH(x.label)}</span><b>${escH(typeof x.value === 'number' ? fmtN(x.value, lang) : x.value)}${x.unit ? `<small>${escH(x.unit)}</small>` : ''}</b>${ch != null ? `<span class="c${good}">${ch > 0 ? '▲' : ch < 0 ? '▼' : ''} ${pc}%</span>` : ''}${x.spark ? sparkSVG(x.spark, { w: 110, h: 22 }) : ''}</div>`;
          }).join('')}</div>`;
        case 'spark': return `${ttl}<div class="gx-bk-sparkw">${sparkSVG(b.values, { w: 260, h: 44, color: b.color })}<b>${escH(fmtN(blockNums(b.values).slice(-1)[0] || 0, lang))}${b.unit ? ' ' + escH(b.unit) : ''}</b></div>`;
        case 'chart': return `${ttl}<div class="gx-bk-chartw">${chartSVG(b, lang)}</div>`;
        case 'bars': {
          const it = (b.items || []).filter(x => x && isFinite(+x.value)), mx = b.max != null ? +b.max : Math.max(1, ...it.map(x => +x.value));
          return `${ttl}<div class="gx-bk-bars">${it.map((x, i) => `<div class="r"><span class="l">${escH(x.label)}</span><span class="t"><i style="--f:${Math.max(0, Math.min(1, +x.value / mx)).toFixed(3)};${safeC(x.color) ? 'background:' + safeC(x.color) : ''};animation-delay:${i * 60}ms"></i></span><span class="v">${escH(fmtN(+x.value, lang))}${b.unit ? ' ' + escH(b.unit) : ''}</span></div>`).join('')}</div>`;
        }
        case 'progress': return `${ttl}<div class="gx-bk-bars">${(b.items || [b]).map((x, i) => { const f = Math.max(0, Math.min(1, +x.value > 1 ? +x.value / 100 : +x.value || 0)); return `<div class="r"><span class="l">${escH(x.label || '')}</span><span class="t p${f >= 1 ? ' done' : ''} t-${tone(x.tone)}"><i style="--f:${f.toFixed(3)};animation-delay:${i * 60}ms"></i></span><span class="v">${Math.round(f * 100)}%</span></div>`; }).join('')}</div>`;
        case 'gauge': case 'donut': case 'kpi': {
          if (!SHP || !SHP.has(b.type)) return '';
          const n = Object.assign({ label: b.label || b.title || '', kind: b.kind || 'other' }, b, { shape: b.type }), lay = SHP.measure(n, { lang }), tr = SHP.render(n, lay.w, lay.h, { lang }, lay);
          return `<svg class="gx-bk-shape" viewBox="-2 -2 ${lay.w + 4} ${lay.h + 4}" style="max-width:${lay.w + 4}px"><g class="gx-node gx-leaf gx-shape fam-chart sh-${b.type}">${tr.children.map(c => treeStr(c, icons)).join('')}</g></svg>`;
        }
        case 'timeline': case 'events':
          return `${ttl}<ol class="gx-bk-tl">${(b.items || []).map(x => `<li class="t-${tone(x.tone || 'neutral')}"><time>${escH(x.time || '')}</time><span>${md(x.label || x.text || '')}</span></li>`).join('')}</ol>`;
        case 'heatstrip': {
          const rows = Array.isArray(b.rows) ? b.rows : [{ label: b.label, values: b.values }], all = rows.flatMap(r => blockNums(r.values)), lo = Math.min(...all), hi = Math.max(...all);
          return `${ttl}<div class="gx-bk-heat">${rows.map(r => `<div class="r">${r.label ? `<span class="l">${escH(r.label)}</span>` : ''}<span class="cells">${blockNums(r.values).map((v, i) => `<i style="background:${scale(b.scheme || 'cool', (v - lo) / ((hi - lo) || 1))}" title="${escH((Array.isArray(b.labels) && b.labels[i] != null ? b.labels[i] + ' · ' : '') + fmtN(v, lang) + (b.unit ? ' ' + b.unit : ''))}"></i>`).join('')}</span></div>`).join('')}${Array.isArray(b.labels) ? `<div class="r ax">${rows.some(r => r.label) ? '<span class="l"></span>' : ''}<span class="cells"><em>${escH(b.labels[0])}</em><em>${escH(b.labels[b.labels.length - 1])}</em></span></div>` : ''}</div>`;
        }
        case 'badges': return `${ttl}<div class="gx-bk-badges">${(b.items || []).map(x => typeof x === 'string' ? `<span>${escH(x)}</span>` : `<span class="t-${tone(x.tone || 'neutral')}">${escH(x.label)}</span>`).join('')}</div>`;
        case 'steps': return `${ttl}<ol class="gx-bk-steps">${(b.items || []).map(x => `<li class="s-${escH(x.state || 'todo')}"><i></i><span>${md(x.label || x.text || '')}</span></li>`).join('')}</ol>`;
        case 'image': { const src = String(b.src || ''); if (!/^(data:image\/(png|jpe?g|gif|webp|svg\+xml);|https:\/\/)/i.test(src)) return ''; return `<figure class="gx-bk-img"><img src="${escH(src)}" alt="${escH(b.alt || '')}" loading="lazy">${b.caption ? `<figcaption>${escH(b.caption)}</figcaption>` : ''}</figure>`; }
        default: return '';
      }
    };
    return `<div class="gx-bk">${(Array.isArray(blocks) ? blocks : []).map(one).join('')}</div>`;
  }

  /* ---------- tablas TSV / CSV (línea de tiempo) ---------- */
  /* separador detectado (tabulador, punto y coma o coma), comillas de CSV, números con coma decimal */
  function parseTable(text) {
    const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n').filter(l => l.trim() && !/^\s*#/.test(l));
    if (!lines.length) return { columns: [], rows: [] };
    const h = lines[0], sep = h.includes('\t') ? '\t' : (h.split(';').length > h.split(',').length ? ';' : ',');
    const split = l => { const out = []; let cur = '', q = false; for (let i = 0; i < l.length; i++) { const c = l[i]; if (q) { if (c === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; } else if (c === '"') q = true; else if (c === sep) { out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out.map(x => x.trim()); };
    const columns = split(h);
    const num = v => { if (v === '') return null; const t = sep === ',' ? v : v.replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'); return /^-?\d*\.?\d+(e[-+]?\d+)?$/i.test(t) ? +t : v; };
    const rows = lines.slice(1).map(l => { const c = split(l), o = {}; columns.forEach((k, i) => { o[k] = num(c[i] == null ? '' : c[i]); }); return o; });
    return { columns, rows };
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
      if (!parts && cl.xh && SHP) attach(g, n, W, H, cl.xh);
      const ow = OWN && ownerOf(n.id);
      if (ow) {
        g.dataset.own = ow.id; g.style.setProperty('--gx-oc', ow.cvar);
        const b = s('g', { class: 'gx-ob', transform: parts ? 'translate(39,40)' : 'translate(-2,-2)' }, g);
        s('circle', { r: 8.5 }, b); const t = s('text', { y: 3 }, b); t.textContent = ow.short;
        s('title', null, b).textContent = ow.label;
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
      const o = OWN && ownerOf(n.id); if (o) out.push(`<span><i style="background:${o.cvar}"></i>${esc(o.label)}</span>`);
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
      applyOwners();
      if (blast) { if (M.has(blast.id) && A.repOf(blast.id) != null) applyBlast(false); else clearBlast(true); }
      if (TL && TL.i < 0) tlSeek(TL.start === 'start' ? 0 : TL.n - 1, { dur: 0, force: true });
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
      if (blast && S.selected !== blast.id) clearBlast(true);
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
        const before = extraOf(n);
        NODE_KEYS.forEach(k => {
          if (d[k] === undefined) return;
          n[k] = d[k];
          if (k === 'label' || k === 'subtitle') { n._card = null; relay = true; }
          if (k === 'color') { n.cvar = A.colorVar(d.color); themed = true; }
        });
        if (extraOf(n) !== before) { n._card = null; relay = true; }
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
      applyOwners(); if (blast) applyBlast(false);
      return Promise.resolve();
    }


    /* ---------- equipos: el dueño de cada pieza, un filtro y una marca ---------- */
    /* `owners: { id: { label, color, short, contact, url } }` en la raíz y `owner` en cada pieza (lo heredan sus
       hijos). En la barra, «Equipos» filtra (lo de otros equipos se apaga; las dependencias entre equipos quedan
       a media luz) y colorea por equipo. En cada tarjeta, las iniciales del equipo sobre el icono. */
    const OWN = (() => {
      if (!cfg.owners) return null;
      const defs = spec.owners && typeof spec.owners === 'object' ? spec.owners : {};
      const ids = new Set(Object.keys(defs));
      for (const n of M.values()) if (typeof n.owner === 'string' && n.owner) ids.add(n.owner);
      if (!ids.size) return null;
      const map = new Map(), STOP = /^(equipo|team|squad|de|del|la|el|los|las|the|of|y|and)$/i;
      [...ids].forEach((k, i) => {
        const d = defs[k] || {}, label = String(d.label || k);
        const words = label.split(/[\s_/-]+/).filter(w => w && !STOP.test(w));
        const short = String(d.short || (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || k).slice(0, 2))).toUpperCase().slice(0, 3);
        map.set(k, { id: k, label, short, cvar: A.colorVar(d.color) || A.colorVar(PAL[i % PAL.length]), contact: d.contact ? String(d.contact) : '', url: /^https?:\/\//i.test(d.url || '') ? d.url : '' });
      });
      A.refreshTheme();
      return map;
    })();
    const ownerOf = id => { let x = M.get(id); while (x) { if (x.owner && OWN && OWN.has(x.owner)) return OWN.get(x.owner); x = x.parent != null ? M.get(x.parent) : null; } return null; };
    const leafIds = () => [...M.values()].filter(n => !n.isLane && !n.children.length).map(n => n.id);
    let ownSel = new Set(), ownColor = false, ownBtn = null, ownPop = null;
    if (OWN) {
      ownBtn = A.btn(A.tools, L.owners, L.ownersT, 'gx-graphonly gx-fx-own');
      A.tools.insertBefore(ownBtn, A.bFit);
      ownPop = h('div', 'gx-own-pop', null, host);
      ownPop.setAttribute('role', 'dialog'); ownPop.setAttribute('aria-label', L.ownersT);
      ownBtn.onclick = ev => { ev.stopPropagation(); const on = !ownPop.classList.contains('on'); ownPop.classList.toggle('on', on); if (on) { renderOwnPop(); placePop(); } };
      ownPop.addEventListener('pointerdown', ev => ev.stopPropagation());
      document.addEventListener('pointerdown', closePop);
      const lg = h('div', 'gx-lg-own', `<h4>${esc(L.owners)}</h4><ul>${[...OWN.values()].map(o => `<li><i class="gx-lg-sw on" style="--gx-pc:${o.cvar}"></i>${esc(o.label)}</li>`).join('')}</ul>`, A.legend); void lg;
    }
    function closePop(ev) { if (ownPop && ownPop.classList.contains('on') && !(ev && ownBtn.contains(ev.target))) ownPop.classList.remove('on'); }
    function placePop() {
      const hb = host.getBoundingClientRect(), bb = ownBtn.getBoundingClientRect();
      ownPop.style.top = (bb.bottom - hb.top + 6) + 'px';
      ownPop.style.left = Math.max(8, Math.min(bb.left - hb.left, hb.width - 290)) + 'px';
    }
    function renderOwnPop() {
      const cnt = new Map(); let none = 0;
      leafIds().forEach(id => { const o = ownerOf(id); if (o) cnt.set(o.id, (cnt.get(o.id) || 0) + 1); else none++; });
      const row = (k, label, n, c, short) => `<button type="button" class="gx-own-r" data-o="${esc(k)}" aria-pressed="${ownSel.has(k)}"><i style="${c ? '--gx-oc:' + c : ''}">${esc(short || '')}</i><span>${esc(label)}</span><b>${n}</b></button>`;
      ownPop.innerHTML = `<div class="gx-own-h">${esc(L.owners)}</div>` + [...OWN.values()].map(o => row(o.id, o.label, cnt.get(o.id) || 0, o.cvar, o.short)).join('')
        + (none ? row('__none__', L.noOwner, none, null, '–') : '')
        + `<div class="gx-own-f"><button type="button" class="gx-btn${ownColor ? ' on' : ''}" data-c="1" aria-pressed="${ownColor}">${esc(L.colorOwn)}</button><button type="button" class="gx-btn" data-x="1">${esc(L.clear)}</button></div>`;
      ownPop.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { const k = b.dataset.o; if (ownSel.has(k)) ownSel.delete(k); else ownSel.add(k); renderOwnPop(); applyOwners(); });
      ownPop.querySelector('[data-c]').onclick = () => { ownColor = !ownColor; renderOwnPop(); applyOwners(); };
      ownPop.querySelector('[data-x]').onclick = () => { ownSel = new Set(); ownColor = false; renderOwnPop(); applyOwners(); };
    }
    function applyOwners() {
      if (!OWN) return;
      const on = ownSel.size > 0;
      world.classList.toggle('gx-ownf', on); world.classList.toggle('gx-ownc', ownColor);
      const match = id => { const o = ownerOf(id); return o ? ownSel.has(o.id) : ownSel.has('__none__'); };
      const keep = new Set();
      for (const [id, el] of S.els) {
        const n = M.get(id);
        const m = on && (n.children.length ? [...A.descendantsOf(id)].filter(x => !M.get(x).children.length).some(match) : match(id));
        el.classList.toggle('gx-own-on', !!m); if (m) keep.add(id);
      }
      for (const x of S.edgeEls) {
        const v = x.g._v, a = keep.has(v.from), b = keep.has(v.to);
        x.g.classList.toggle('gx-own-on', on && a && b); x.g.classList.toggle('gx-own-half', on && a !== b);
        if (x.lab) x.lab.classList.toggle('gx-own-on', on && a && b);
      }
      ownBtn.innerHTML = on ? `${esc(L.owners)} <b>${ownSel.size}</b>` : esc(L.owners);
      ownBtn.classList.toggle('on', on || ownColor);
    }

    /* ---------- radio de impacto: qué deja de funcionar si esto falla ---------- */
    /* En una llamada (call, http, rpc, data…) el fallo sube hacia quien llama; en un evento o una cola baja
       hacia quien consume. `fx.blast.mode`: "auto" (eso), "callers", "downstream" o "both". Anillos por salto,
       piezas teñidas por distancia, pulsos en el sentido del fallo y, en el panel, el recuento y los equipos. */
    const BL = cfg.blast ? Object.assign({ mode: 'auto' }, obj(cfg.blast)) : null;
    const FORWARD = { event: 1, queue: 1, async: 1 };
    let blast = null;
    const gBlast = s('g', { class: 'gx-blastl' });
    if (A.gGroups && A.gGroups.parentNode === world) world.insertBefore(gBlast, A.gGroups); else world.insertBefore(gBlast, world.firstChild);
    function computeBlast(id) {
      const start = [id, ...A.descendantsOf(id)], D = new Map(start.map(x => [x, 0])), used = new Map(), q = start.slice();
      const way = e => (BL.mode === 'callers' ? 'b' : BL.mode === 'downstream' ? 'f' : BL.mode === 'both' ? 'fb' : FORWARD[e.kind] ? 'f' : 'b');
      while (q.length) {
        const x = q.shift(), d = D.get(x);
        for (const e of G.edges) {
          const w = way(e); let y = null;
          if (w.includes('f') && e.from === x) y = e.to; else if (w.includes('b') && e.to === x) y = e.from;
          if (y == null) continue;
          if (!used.has(e.id)) used.set(e.id, e.from === x ? 'f' : 'b');
          if (!D.has(y)) { D.set(y, d + 1); q.push(y); A.descendantsOf(y).forEach(c => { if (!D.has(c)) { D.set(c, d + 1); q.push(c); } }); }
        }
      }
      const vis = new Map();
      D.forEach((d, x) => { const r = A.repOf(x); if (r != null && (!vis.has(r) || vis.get(r) > d)) vis.set(r, d); });
      const byHop = new Map(), teams = new Map();
      D.forEach((d, x) => { const n = M.get(x); if (!d || n.isLane || n.children.length) return; if (!byHop.has(d)) byHop.set(d, []); byHop.get(d).push(x); const o = ownerOf(x); const k = o ? o.id : '__none__'; teams.set(k, (teams.get(k) || 0) + 1); });
      return { id, D, vis, used, byHop, teams, maxD: Math.max(0, ...byHop.keys()), n: [...byHop.values()].reduce((a, l) => a + l.length, 0) };
    }
    function applyBlast(anim) {
      if (!blast) return;
      blast.vis = computeBlast(blast.id).vis;
      world.classList.add('gx-blasting');
      for (const [id, el] of S.els) {
        const d = blast.vis.get(id);
        el.classList.toggle('gx-bl', d != null);
        [0, 1, 2, 3].forEach(k => el.classList.toggle('gx-bl-d' + k, d != null && Math.min(d, 3) === k));
      }
      const hit = new Set();
      for (const x of S.edgeEls) { const on = x.g._v.list.some(e => blast.used.has(e.id)); x.g.classList.toggle('gx-bl', on); if (on) hit.add(x); }
      gBlast.innerHTML = '';
      const o = S.rects.get(A.repOf(blast.id)); if (!o) return;
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
      for (let k = blast.maxD; k >= 1; k--) {
        let R = 0;
        blast.vis.forEach((d, id) => { if (d > 0 && d <= k) { const r = S.rects.get(id); if (r) R = Math.max(R, Math.hypot(r.x + r.w / 2 - cx, r.y + r.h / 2 - cy) + Math.max(r.w, r.h) * .55); } });
        if (!R) continue;
        R += 18;
        const c = s('circle', { class: `gx-ring h${Math.min(k, 3)}`, cx, cy, r: R.toFixed(1) }, gBlast); c.style.setProperty('--k', anim ? k : 0);
        const t = s('text', { class: `gx-ringt h${Math.min(k, 3)}`, x: cx, y: (cy - R - 7).toFixed(1) }, gBlast);
        t.textContent = `${k} ${k === 1 ? L.hop : L.hops} · ${(blast.byHop.get(k) || []).length}`;
        t.style.setProperty('--k', anim ? k : 0);
      }
      if (anim && !reduce) {
        shock(A.repOf(blast.id), 0);
        hit.forEach(x => {
          const v = x.g._v, a = blast.vis.get(v.from), b = blast.vis.get(v.to);
          if (a == null || b == null || a === b) return;
          pulse(x.g, Math.min(a, b) * 220, 260, a > b);
        });
      }
    }
    function clearBlast(keepPanel) {
      if (!blast) return;
      blast = null;
      world.classList.remove('gx-blasting'); gBlast.innerHTML = '';
      for (const el of S.els.values()) ['gx-bl', 'gx-bl-d0', 'gx-bl-d1', 'gx-bl-d2', 'gx-bl-d3'].forEach(c => el.classList.remove(c));
      for (const x of S.edgeEls) x.g.classList.remove('gx-bl');
      if (!keepPanel && S.selected && A.panel.classList.contains('on')) A.renderPanel();
    }
    function toggleBlast(id) {
      if (!BL || !M.has(id)) return;
      if (blast && blast.id === id) { clearBlast(); return; }
      clearBlast(true);
      blast = computeBlast(id);
      applyBlast(true);
      if (S.selected === id) A.renderPanel();
    }
    function blastHTML(n) {
      if (!blast || blast.id !== n.id) return '';
      const chip = id => { const m = M.get(id), o = ownerOf(id); return `<button type="button" class="gx-bk-chip" data-go="${esc(id)}">${o ? `<i style="--gx-oc:${o.cvar}">${esc(o.short)}</i>` : ''}${esc(m.label)}</button>`; };
      const hops = [...blast.byHop.keys()].sort((a, b) => a - b), mx = Math.max(1, ...hops.map(k => blast.byHop.get(k).length));
      const teams = [...blast.teams.entries()].sort((a, b) => b[1] - a[1]);
      return `<div class="gx-bk-blast"><div class="gx-bk-bh"><b>${esc(L.blastH)}</b><button type="button" class="gx-btn" data-act="unblast">${esc(L.unblast)} ✕</button></div>`
        + `<div class="gx-bk-stats"><div class="gx-bk-stat"><span class="l">${esc(L.affected)}</span><b>${blast.n}</b></div><div class="gx-bk-stat"><span class="l">${esc(L.hops)}</span><b>${blast.maxD}</b></div><div class="gx-bk-stat"><span class="l">${esc(L.teams)}</span><b>${teams.filter(t => t[0] !== '__none__').length}</b></div></div>`
        + (hops.length ? `<div class="gx-bk-bars">${hops.map(k => `<div class="r h${Math.min(k, 3)}"><span class="l">${k} ${k === 1 ? esc(L.hop) : esc(L.hops)}</span><span class="t"><i style="--f:${(blast.byHop.get(k).length / mx).toFixed(3)}"></i></span><span class="v">${blast.byHop.get(k).length}</span></div>`).join('')}</div>` : '')
        + hops.map(k => `<h5>${k} ${k === 1 ? esc(L.hop) : esc(L.hops)}</h5><div class="gx-bk-chips">${blast.byHop.get(k).slice(0, 14).map(chip).join('')}${blast.byHop.get(k).length > 14 ? `<span class="gx-bk-more">+${blast.byHop.get(k).length - 14}</span>` : ''}</div>`).join('')
        + (OWN && teams.length ? `<h5>${esc(L.teams)}</h5><div class="gx-bk-chips">${teams.map(([k, c]) => { const o = OWN.get(k); return `<span class="gx-bk-chip st">${o ? `<i style="--gx-oc:${o.cvar}">${esc(o.short)}</i>${esc(o.label)}` : esc(L.noOwner)} <b>${c}</b></span>`; }).join('')}</div>` : '')
        + '</div>';
    }

    /* ---------- panel: equipo, impacto y bloques ricos ---------- */
    function panelActs(n) { return BL && n && !n.isLane ? `<button type="button" class="gx-btn gx-blast-b${blast && blast.id === n.id ? ' on' : ''}" data-act="blast" title="${esc(L.blastT)}">✺ ${esc(L.blast)}</button>` : ''; }
    function panelTop(n) {
      if (!n) return '';
      let out = '';
      const o = OWN && ownerOf(n.id);
      if (o) out += `<div class="gx-bk-own"><i style="--gx-oc:${o.cvar}">${esc(o.short)}</i><span><small>${esc(L.owner)}</small><b>${esc(o.label)}</b>${o.contact ? `<em>${esc(o.contact)}</em>` : ''}</span>${o.url ? `<a href="${esc(o.url)}" target="_blank" rel="noopener">↗</a>` : ''}</div>`;
      out += blastHTML(n);
      if (cfg.blocks && Array.isArray(n.blocks) && n.blocks.length) out += renderBlocks(n.blocks, { lang });
      return out;
    }
    function panelAct(a, id) { if (a === 'blast') toggleBlast(id); else if (a === 'unblast') clearBlast(); }
    function panelMount() { }

    /* ---------- extras de las formas: sparkline y progreso en una franja bajo el contorno ---------- */
    const ATTACH_FAM = { flow: 1, tile: 1, c4: 1, table: 1, note: 1 };
    function shapeExtra(n) {
      if (!cfg.attach || !SHP || !ATTACH_FAM[SHP.families[n.shape]]) return 0;
      const rows = (cfg.spark && sparkOf(n) ? 1 : 0) + (cfg.progress && progOf(n) != null ? 1 : 0);
      /* la baldosa lleva su etiqueta colgando debajo del contorno: la franja va después */
      return rows ? rows * 22 + 4 + (n.shape === 'tile' ? 22 : 0) : 0;
    }
    const extraOf = n => (A.hasShape(n) ? shapeExtra(n) : cardExtra(n));
    function attach(g, n, W, H, xh) {
      let y = H - xh + 4 + (n.shape === 'tile' ? 22 : 0);
      const wide = W >= 96;
      const sp = cfg.spark && sparkOf(n), p = cfg.progress ? progOf(n) : null;
      if (sp) {
        const row = s('g', { class: 'gx-att', transform: `translate(0,${y})` }, g);
        s('rect', { class: 'gx-att-bg', width: W, height: 18, rx: 6 }, row);
        const last = sp[sp.length - 1], txt = fmt(last, { unit: n.unit || '' }), vw = wide ? A.textW(txt, 10, 700, true) + 8 : 0;
        const pts = SHP.sparkPts(sp, 6, W - 6 - vw, 3, 15), d = SHP.sparkD(pts), lp = pts[pts.length - 1];
        s('path', { class: 'gx-sp-a', d: `${d}L${W - 6 - vw},16L6,16Z`, 'data-m': 'fx-asa' }, row);
        s('path', { class: 'gx-sp-l', d, 'data-m': 'fx-asl' }, row);
        s('circle', { class: 'gx-sp-d', cx: lp[0].toFixed(1), cy: lp[1].toFixed(1), r: 2.2, 'data-m': 'fx-asd' }, row);
        if (wide) { const t = s('text', { class: 'gx-sp-v gx-att-v', x: W - 6, y: 12.5, 'data-m': 'fx-asv', 'data-num': last, 'data-unit': n.unit || '', 'data-dec': '' }, row); t.textContent = txt; }
        y += 22;
      }
      if (p != null) {
        const row = s('g', { class: 'gx-att', transform: `translate(0,${y})` }, g), tw = W - 12 - (wide ? 34 : 0);
        s('rect', { class: 'gx-att-bg', width: W, height: 18, rx: 6 }, row);
        s('rect', { class: 'gx-att-tr', x: 6, y: 7, width: tw, height: 4, rx: 2 }, row);
        s('rect', { class: 'gx-att-f' + (p >= 1 ? ' done' : ''), x: 6, y: 7, width: Math.max(tw * p, 2).toFixed(1), height: 4, rx: 2, 'data-m': 'fx-apf' }, row);
        if (wide) { const t = s('text', { class: 'gx-sp-v gx-att-v', x: W - 6, y: 12.5, 'data-m': 'fx-apv', 'data-num': Math.round(p * 100), 'data-unit': '%', 'data-dec': '0' }, row); t.textContent = Math.round(p * 100) + '%'; }
      }
    }

    /* ---------- línea de tiempo: la actividad a lo largo del tiempo, desde una tabla ---------- */
    /* `timeline: { data: "TSV o CSV" | rows: [{…}] | columns + values, events: [{ time, label, tone, nodes }],
       label, window, step, loop, start: "end" | "start", strips: "heat" }`. Formato ancho: una columna de tiempo y
       una por serie, `<id>.<campo>` (heat, rate, value, progress, change, spark, weight, alert); un id sin campo es
       `heat` en una pieza y `rate` en una arista. Formato largo: time · id · field · value. Una columna `event` pone
       un evento en esa fila. Reproducir avanza fila a fila y aplica cada una con setData. */
    const TL = cfg.timeline && spec.timeline ? buildTimeline(spec.timeline) : null;
    function buildTimeline(ts) {
      if (!ts || typeof ts !== 'object') return null;
      let tab = null;
      if (typeof ts.data === 'string') tab = parseTable(ts.data);
      else if (Array.isArray(ts.rows) && ts.rows.length) tab = { columns: [...new Set(ts.rows.flatMap(r => Object.keys(r || {})))], rows: ts.rows };
      else if (Array.isArray(ts.columns) && Array.isArray(ts.values)) tab = { columns: ts.columns, rows: ts.values.map(r => { const o = {}; ts.columns.forEach((c, i) => { o[c] = r[i]; }); return o; }) };
      if (!tab || !tab.rows.length) return null;
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
      const iso = rows.every(r => /T\d{2}:\d{2}/.test(String(r[tcol])));
      const sameDay = iso && new Set(rows.map(r => String(r[tcol]).slice(0, 10))).size === 1;
      const labels = rows.map(r => { const v = String(r[tcol]); if (!iso) return v; const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/.exec(v); return m ? (sameDay ? m[4] : `${m[3]}/${m[2]} ${m[4]}`) : v; });
      const edgeIds = new Set(G.edges.map(e => e.id)), FIELDS = /^(heat|rate|value|progress|change|spark|weight|alert)$/;
      const series = new Map();
      cols.concat(rows.flatMap(r => Object.keys(r))).forEach(k => {
        if (series.has(k) || k === tcol || k === ec || k === idc || k === vc || k === fc) return;
        const dot = k.lastIndexOf('.'); let id = k, field = null;
        if (dot > 0 && FIELDS.test(k.slice(dot + 1))) { id = k.slice(0, dot); field = k.slice(dot + 1); }
        const edge = edgeIds.has(id) && !M.has(id);
        if (!edge && !M.has(id)) return;
        field = field || (edge ? 'rate' : (ts.field || 'heat'));
        let lastV = null;
        const vals = rows.map(r => { const v = r[k]; if (v == null || v === '') return lastV; lastV = field === 'alert' ? (String(v) === '' || v === '-' ? null : v) : (typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))); return lastV; });
        series.set(k, { key: k, id, field, edge, vals });
      });
      const events = [];
      if (ec) rows.forEach((r, i) => { if (r[ec]) events.push({ i, label: String(r[ec]), tone: 'info', nodes: [] }); });
      (Array.isArray(ts.events) ? ts.events : []).forEach(ev => {
        if (!ev) return;
        let i = labels.indexOf(String(ev.time));
        if (i < 0) { const t = tOf(ev.time); if (t != null) { i = rows.findIndex(r => tOf(r[tcol]) >= t); if (i < 0) i = rows.length - 1; } }
        if (i >= 0) events.push({ i, label: String(ev.label || ''), tone: TONES[ev.tone] ? ev.tone : 'info', nodes: (ev.nodes || []).filter(id => M.has(id)) });
      });
      const seen = new Set(), evs = events.filter(ev => { const k = ev.i + '|' + ev.label; if (seen.has(k)) return false; seen.add(k); return true; });
      return { labels, series, events: evs, n: rows.length, window: Math.max(2, ts.window || 12), step: Math.max(120, ts.step || 900), loop: ts.loop !== false, label: ts.label || '', start: ts.start || 'end', strips: ts.strips || 'heat', i: -1, speed: 1, timer: null };
    }
    function patchAt(i) {
      const nodes = {}, edges = {}, W = TL.window;
      const win = s => { const a = []; for (let k = i - W + 1; k <= i; k++) a.push(s.vals[Math.max(0, k)]); return a.map(v => (v == null ? s.vals[i] : v)); };
      TL.series.forEach(sr => {
        const v = sr.vals[i]; if (v == null && sr.field !== 'alert') return;
        if (sr.edge) { (edges[sr.id] = edges[sr.id] || {})[sr.field] = v; return; }
        const o = nodes[sr.id] = nodes[sr.id] || {};
        if (sr.field === 'spark') o.spark = win(sr);
        else o[sr.field] = v;
        if (sr.field === 'value' && M.get(sr.id).shape === 'kpi' && !TL.series.has(sr.id + '.spark')) o.spark = win(sr);
      });
      return { nodes, edges };
    }
    let tlEl = null;
    function tlBuild() {
      if (!TL) return;
      tlEl = h('div', 'gx-tml');
      stage.parentNode.insertBefore(tlEl, stage.nextSibling);
      tlEl.innerHTML = `<div class="gx-tml-bar"><button type="button" class="gx-btn gx-primary gx-tml-play" aria-label="${esc(L.tlPlay)}">▶</button>`
        + `<div class="gx-seg gx-tml-sp" role="group">${[1, 2, 4].map(k => `<button type="button" class="gx-btn gx-seg-b${k === 1 ? ' on' : ''}" data-k="${k}">${k}×</button>`).join('')}</div>`
        + `<span class="gx-tml-now"><b></b><small></small></span>${TL.label ? `<span class="gx-tml-lab">${esc(TL.label)}</span>` : ''}</div><div class="gx-tml-plot"><svg class="gx-tml-svg"></svg><div class="gx-tml-head"><i></i></div></div>`;
      tlEl.querySelector('.gx-tml-play').onclick = () => (TL.timer ? tlPause() : tlPlay());
      tlEl.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { TL.speed = +b.dataset.k; tlEl.querySelectorAll('[data-k]').forEach(x => x.classList.toggle('on', x === b)); if (TL.timer) { tlPause(); tlPlay(); } });
      const plot = tlEl.querySelector('.gx-tml-plot');
      let drag = false;
      const at = ev => { const r = plot.getBoundingClientRect(); return clamp(Math.floor((ev.clientX - r.left - (TL.gut || 0)) / (TL.cw || 1)), 0, TL.n - 1); };
      plot.addEventListener('pointerdown', ev => { if (ev.target.closest('[data-go]')) return; drag = true; try { plot.setPointerCapture(ev.pointerId); } catch (_) { } tlPause(); tlSeek(at(ev), { dur: 160 }); });
      plot.addEventListener('pointermove', ev => { if (drag) tlSeek(at(ev), { dur: 120 }); });
      plot.addEventListener('pointerup', () => { drag = false; });
      plot.addEventListener('click', ev => { const g = ev.target.closest('[data-go]'); if (g) A.select(g.getAttribute('data-go')); });
      if (typeof ResizeObserver === 'function') { TL.ro = new ResizeObserver(() => tlDraw()); TL.ro.observe(plot); }
      tlDraw();
    }
    function tlDraw() {
      if (!tlEl) return;
      const plot = tlEl.querySelector('.gx-tml-plot'), svgT = tlEl.querySelector('.gx-tml-svg');
      const W = Math.max(320, plot.clientWidth || 900), n = TL.n, GUT = W < 560 ? 84 : 128, RT = 10;
      TL.gut = GUT;
      const cw = (W - GUT - RT) / n, X = i => GUT + (i + .5) * cw;
      const rates = [...TL.series.values()].filter(x => x.edge && x.field === 'rate'), tot = rates.length ? rates : [...TL.series.values()].filter(x => !x.edge && (x.field === 'value' || x.field === TL.strips)).slice(0, 1);
      const sum = Array.from({ length: n }, (_, i) => tot.reduce((a, x) => a + (+x.vals[i] || 0), 0)), mx = Math.max(1, ...sum);
      const strips = [...TL.series.values()].filter(x => !x.edge && x.field === TL.strips).sort((a, b) => Math.max(...b.vals.map(v => +v || 0)) - Math.max(...a.vals.map(v => +v || 0))).slice(0, 8);
      const AH = 46, SH = 13, H = AH + 10 + strips.length * (SH + 3) + 16;
      let out = `<path class="gx-tml-grid" d="M${GUT},${AH}H${W - RT}"/>`;
      const P = sum.map((v, i) => [X(i), 4 + (AH - 6) * (1 - v / mx)]), d = 'M' + P.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L');
      out += `<path class="gx-tml-area" d="${d}L${X(n - 1).toFixed(1)},${AH}L${X(0).toFixed(1)},${AH}Z"/><path class="gx-tml-line" d="${d}"/>`;
      out += `<text class="gx-tml-ax" x="${GUT - 8}" y="14" text-anchor="end">${esc(fmt(mx))}</text><text class="gx-tml-k" x="${GUT - 8}" y="${AH - 4}" text-anchor="end">${esc(rates.length ? L.total : (tot[0] ? M.get(tot[0].id).label : ''))}</text>`;
      strips.forEach((sr, k) => {
        const y = AH + 10 + k * (SH + 3), vals = sr.vals.map(v => +v || 0), lo = Math.min(...vals), hi = Math.max(...vals);
        const colr = v => (heat && sr.field === 'heat' ? heat.col(v) : scale('cool', (v - lo) / ((hi - lo) || 1)));
        out += `<g class="gx-tml-row" data-go="${esc(sr.id)}"><text class="gx-tml-rl" x="${GUT - 8}" y="${y + SH - 3}" text-anchor="end">${esc(A.fitText(M.get(sr.id).label, GUT - 14, 10.5, 500))}</text>`
          + vals.map((v, i) => `<rect x="${(GUT + i * cw + .5).toFixed(1)}" y="${y}" width="${Math.max(cw - 1, 1).toFixed(1)}" height="${SH}" rx="2" style="fill:${colr(v)}"><title>${esc(M.get(sr.id).label + ' · ' + TL.labels[i] + ' · ' + fmt(v))}</title></rect>`).join('') + '</g>';
      });
      const ticks = Math.min(n, W < 560 ? 4 : 7);
      for (let k = 0; k < ticks; k++) { const i = Math.round(k * (n - 1) / Math.max(1, ticks - 1)); out += `<text class="gx-tml-ax" x="${X(i).toFixed(1)}" y="${H - 3}" text-anchor="${k === 0 ? 'start' : k === ticks - 1 ? 'end' : 'middle'}">${esc(TL.labels[i])}</text>`; }
      TL.events.forEach(ev => { const x = X(ev.i).toFixed(1); out += `<g class="gx-tml-ev t-${ev.tone}"><path d="M${x},2V${H - 14}"/><circle cx="${x}" cy="5" r="4"/><title>${esc(TL.labels[ev.i] + ' · ' + ev.label)}</title></g>`; });
      svgT.setAttribute('viewBox', `0 0 ${W} ${H}`); svgT.setAttribute('height', H); svgT.innerHTML = out;
      TL.X = X; TL.H = H; TL.cw = cw;
      tlHead();
    }
    function tlHead() {
      if (!tlEl || TL.i < 0) return;
      const hd = tlEl.querySelector('.gx-tml-head'); hd.style.transform = `translateX(${TL.X(TL.i).toFixed(1)}px)`; hd.style.height = (TL.H - 14) + 'px';
      const now = tlEl.querySelector('.gx-tml-now');
      now.querySelector('b').textContent = TL.labels[TL.i];
      now.querySelector('small').textContent = `${TL.i + 1} / ${TL.n}`;
    }
    function tlSeek(i, o) {
      if (!TL) return;
      o = o || {};
      i = clamp(Math.round(i), 0, TL.n - 1);
      const prev = TL.i; if (i === prev && !o.force) return;
      TL.i = i;
      setData(patchAt(i), { duration: o.dur != null ? o.dur : Math.min(TL.step * .8 / TL.speed, 650) });
      tlHead();
      if (prev >= 0 && i > prev) TL.events.filter(ev => ev.i > prev && ev.i <= i).forEach(tlEvent);
    }
    function tlEvent(ev) {
      let t = stage.querySelector('.gx-tml-toast'); if (!t) t = h('div', 'gx-tml-toast', null, stage);
      t.className = 'gx-tml-toast on t-' + ev.tone; t.innerHTML = `<b>${esc(TL.labels[ev.i])}</b> ${esc(ev.label)}`;
      clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), 2800);
      ev.nodes.forEach(id => { const r = A.repOf(id); if (r != null) shock(r, 0); });
    }
    function tlPlay() {
      if (!TL || TL.timer) return;
      if (TL.i >= TL.n - 1) tlSeek(0, { dur: 0 });
      const b = tlEl.querySelector('.gx-tml-play'); b.textContent = '❚❚'; b.setAttribute('aria-label', L.tlPause);
      TL.timer = setInterval(() => { if (TL.i >= TL.n - 1) { if (TL.loop) tlSeek(0, { dur: 300 }); else tlPause(); return; } tlSeek(TL.i + 1); }, TL.step / TL.speed);
    }
    function tlPause() {
      if (!TL || !TL.timer) return;
      clearInterval(TL.timer); TL.timer = null;
      const b = tlEl.querySelector('.gx-tml-play'); b.textContent = '▶'; b.setAttribute('aria-label', L.tlPlay);
    }
    const timeline = TL ? {
      seek: i => tlSeek(typeof i === 'string' ? TL.labels.indexOf(i) : i, { force: true }), play: tlPlay, pause: tlPause,
      get index() { return TL.i; }, get length() { return TL.n; }, get labels() { return TL.labels.slice(); }
    } : null;
    /* la fila de partida se aplica al modelo antes del primer layout: el diagrama nace ya con sus datos */
    if (TL) {
      const i0 = TL.start === 'start' ? 0 : TL.n - 1, p0 = patchAt(i0);
      Object.entries(p0.nodes).forEach(([id, d]) => { const n = M.get(id); Object.keys(d).forEach(k => { n[k] = d[k]; }); n._card = null; });
      Object.entries(p0.edges).forEach(([id, d]) => { const e = G.edges.find(x => x.id === id); if (e) Object.assign(e, d); });
      TL.i = i0; computeHeat(); heatKey(); MR = maxRate();
      tlBuild();
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
      if (TL) { tlPause(); if (TL.ro) TL.ro.disconnect(); }
      document.removeEventListener('pointerdown', closePop);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis);
    }

    const config = Object.assign({}, cfg);
    return { config, cardExtra, shapeExtra, leaf, edge, beforeTween, afterLayout, cam, highlight, trace, select, step, tip, mini, setData, play, stop, destroy,
      panelActs, panelTop, panelAct, panelMount, timeline, blast: toggleBlast, clearBlast, filterOwners: ids => { ownSel = new Set([].concat(ids || [])); applyOwners(); }, colorOwners: on => { ownColor = !!on; applyOwners(); },
      wave: (ids, dir, o) => wave([].concat(ids).map(A.repOf), dir || 'out', o) };
  }

  return { create, resolve, scale, SCHEMES, PRESETS, DEFAULTS, css: CSS, version: '1.9.0', renderBlocks, parseTable, injectCSS: () => injectCSS() };
});
