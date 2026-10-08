/* El lienzo de GraphX en el terminal: un módulo `Client` que dibuja la escena con caracteres y la navega con
 * teclado y ratón, con los efectos animados en su propio reloj.
 *
 * Se adapta a lo que tiene: el tamaño (micro, estrecho, normal, ancho con panel lateral), el color (truecolor,
 * 256, 16, sin color), los glifos (unicode, básico, ASCII), el ratón (pantalla completa o no) y el movimiento.
 *
 * Vistas: grafo (cámara sobre la geometría de ELK), esquema (en filas, para lo estrecho), secuencia, árbol de
 * ficheros. Teclas: ? las enseña todas. */
import type { ClientKeyEvent, ClientModule, ClientPointerEvent, JsonValue, RenderElement } from 'claude-code'

import type { CanvasProps, CellLayout, Detail, SNode, Scene } from '../types'
import { BOLD, DIM, Grid, INV, ITALIC, UNDER, type Span } from './term/grid'
import { fit, glyphs, strWidth, type Glyphs } from './term/glyphs'
import { inkOn, painter, type Painter } from './term/paint'
import { boxOf, chFor, drawGraph, fitCam, type Cam, type FxFlags, type Look } from './term/graph'
import { drawSeq, layoutSeq } from './term/seq'
import { drawOutline, drawTree, outlineRows } from './term/lists'
import { drawDetail } from './term/detail'
import { fmtNum } from './term/charts'

type Mode = 'graph' | 'outline' | 'seq' | 'tree'
/* el nivel de zoom del grafo: tarjetas y fichas en celdas (legibles, 1:1) o la vista general (la geometría del motor, encajada) */
type Level = { k: 'cards' | 'chips' | 'mini' | 'fit'; dir: 'right' | 'down' }
type Local = {
  key: string
  mode: Mode | null
  cam: Cam | null
  lv: Level | null
  sel: string | null
  hover: string | null
  cur: number
  curId: string | null
  top: number
  sx: number
  sy: number
  trace: { id: string; dir: 'up' | 'down' } | null
  blast: string | null
  flowT0: number | null
  tl: { i: number; on: boolean; speed: number; last: number; ev: { l: string; t: number; tn: string } | null } | null
  search: { on: boolean; q: string } | null
  help: boolean
  mini: boolean
  side: boolean
  detailTop: number
  det: boolean
  present: boolean
  /* el paso del recorrido automático (el que se hace con las piezas cuando el diagrama no trae uno) */
  lt: number
  motion: 'full' | 'reduced' | 'off' | null
  ownerOn: string[] | null
  ownerColor: boolean
  enterT0: number | null
  play: { k: number; t0: number } | null
  wave: { id: string; t0: number } | null
  pulse: Record<string, number>
  drag: { x: number; y: number; ox: number; oy: number; moved: boolean } | null
  click: { id: string; t: number } | null
  t: number
  msg: { t: string; at: number } | null
}

/* lo que el reloj necesita saber de la última vez que se pintó: si algo se mueve y la línea de tiempo */
const tick = new WeakMap<object, { anim: boolean; st?: Local; tl: { n: number; events: { i: number; l: string; tn: string; n: string[] }[] } | null }>()
const started = new WeakSet<object>()
/* la última tecla o clic: el reloj cede el paso a la entrada (un fotograma animado no retrasa una tecla) */
const lastInput = new WeakMap<object, number>()
/* la cámara sigue al paso del recorrido hasta que la persona la mueve */
const followOf = new WeakMap<object, boolean>()
const lastStepAt = new WeakMap<object, number>()
/* la última orden que llegó de los botones del panel (props.cmd) */
const lastCmd = new WeakMap<object, number>()
const lastPresent = new WeakMap<object, number>()
type TourStep = { t: string; b?: string; n: string[]; e: string[]; sel?: string }

/* un recorrido hecho con lo que hay: la visión general y una pieza por paso, en el orden en que fluye el diagrama */
function autoTour(s: Scene): TourStep[] {
  if (s.kind === 'seq' && s.sq) {
    const parts = new Map(s.sq.parts.map(p => [p.i, p.l]))
    const out: TourStep[] = [{ t: s.sq.t || s.title || 'La secuencia', b: s.sq.sm ?? `${s.sq.parts.length} participantes: ${s.sq.parts.map(p => p.l).join(', ')}.`, n: [], e: [] }]
    let k = 0
    for (const r of s.sq.rows) {
      if (r.a == null || r.b == null) continue
      k++
      out.push({ t: `${k}. ${r.l ?? ''}`, b: [`${parts.get(r.a) ?? r.a} → ${parts.get(r.b) ?? r.b}${r.k === 'return' ? ' (respuesta)' : r.k === 'async' ? ' (asíncrono)' : r.k === 'self' ? ' (a sí mismo)' : ''}`, r.sm, r.dt ? `Viaja: ${r.dt}` : ''].filter(Boolean).join('. '), n: [r.a, r.b], e: [], sel: r.i })
    }
    return out.slice(0, 80)
  }
  if (s.kind === 'tree' && s.rows) {
    const out: TourStep[] = [{ t: s.title || 'El árbol', b: s.sm ?? `${s.rows.length} filas a la vista.`, n: [], e: [] }]
    for (const r of s.rows.filter(r => r.dl || r.d <= 1).slice(0, 40)) out.push({ t: r.l ?? r.i, b: [r.sm, r.dl ? `Cambio: ${r.dl}` : '', r.ad || r.de ? `+${r.ad ?? 0} −${r.de ?? 0}` : ''].filter(Boolean).join('. '), n: [r.i], e: [], sel: r.i })
    return out
  }
  const nodes = (s.nodes ?? []).filter(n => !n.ln && !(n.g && n.o))
  const fm = flowMap(s)
  const labels = new Map((s.nodes ?? []).map(n => [n.i, n.l]))
  nodes.sort((a, b) => (fm.get(a.i) ?? 1e9) - (fm.get(b.i) ?? 1e9) || a.y - b.y || a.x - b.x)
  const out: TourStep[] = [{ t: s.title || 'El diagrama', b: s.sm ?? `${nodes.length} piezas y ${(s.edges ?? []).length} conexiones${(s.lanes ?? []).length ? ` en ${(s.lanes ?? []).length} carriles` : ''}. Recórrelas paso a paso.`, n: [], e: [] }]
  for (const n of nodes.slice(0, 60)) {
    const ins = (s.edges ?? []).filter(e => e.b === n.i), outs = (s.edges ?? []).filter(e => e.a === n.i)
    const data: string[] = []
    if (n.st) data.push(`Estado: ${n.st}`)
    if (n.hv != null) data.push(`${s.heat?.label ?? 'Calor'}: ${fmtNum(n.hv)}${s.heat?.unit ? ' ' + s.heat.unit : ''}`)
    if (n.al) data.push(`Alerta: ${n.al}`)
    if (n.pr != null) data.push(`Progreso: ${Math.round(n.pr * 100)} %`)
    if (n.v != null && (n.sh === 'kpi' || n.sh === 'gauge')) data.push(`Valor: ${fmtNum(n.v, n.dc)}${n.u ? ' ' + n.u : ''}`)
    if (n.ow) data.push(`Equipo: ${s.owners?.[n.ow]?.label ?? n.ow}`)
    const rel = [ins.length ? `Recibe de ${[...new Set(ins.map(e => labels.get(e.a) ?? e.a))].slice(0, 4).join(', ')}` : '', outs.length ? `envía a ${[...new Set(outs.map(e => labels.get(e.b) ?? e.b))].slice(0, 4).join(', ')}` : ''].filter(Boolean).join(' y ')
    out.push({ t: n.l, b: [n.sm ?? n.s, data.join(' · '), rel ? rel + '.' : ''].filter(Boolean).join('\n'), n: [n.i], e: [...ins, ...outs].map(e => e.i), sel: n.i })
  }
  return out
}

/* el estado nuevo de una escena nueva, hasta que se guarde: cada pintado no debe rehacerlo (la cascada volvería a empezar) */
const freshOf = new WeakMap<object, Local>()
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
/* el reloj de cada lienzo: avanza con sus fotogramas (surface.every), así las animaciones no dependen del reloj del sistema */
const clocks = new WeakMap<object, number>()

function fresh(s: Scene | null, t0: number): Local {
  return {
    key: s ? `${s.mountRev ?? 0}:${s.kind}:${s.view ?? ''}` : 'empty', mode: null, cam: null, lv: null, sel: null, hover: null, cur: 0, curId: null, top: 0, sx: 0, sy: 0,
    trace: null, blast: null, flowT0: null, tl: null, search: null, help: false, mini: true, side: true, detailTop: 0, det: false, present: false, lt: -1, motion: null,
    ownerOn: null, ownerColor: false, enterT0: s?.fresh ? t0 : null, play: null, wave: null, pulse: {}, drag: null, click: null, t: t0, msg: null,
  }
}

function fxFlags(s: Scene, motion: boolean): FxFlags {
  const f = (s.fx ?? {}) as Record<string, unknown>
  const on = s.fx != null
  return {
    particles: motion && on ? ((f.particles as FxFlags['particles']) ?? 'data') : false,
    heat: on && f.heat !== false, spark: on && f.spark !== false, progress: on && f.progress !== false, alerts: on && f.alerts !== false,
    glow: on && !!f.glow, gradient: on && !!f.gradient, grid: on && f.grid !== false, lod: on && f.lod !== false, spotlight: on && !!f.spotlight,
    hoverFlow: on && f.hoverFlow !== false, sketch: on && !!f.sketch, autoColor: on ? ((f.autoColor as FxFlags['autoColor']) ?? false) : false,
    waves: on && f.waves !== false, entrance: on && f.entrance === 'cascade' && motion, owners: on && f.owners !== false,
  }
}

/* hacia dónde se propaga un fallo: en una llamada, hacia quien llama; en un evento, hacia quien consume */
function blastMap(s: Scene, from: string): Map<string, number> {
  const edges = s.edges ?? []
  const m = new Map<string, number>([[from, 0]])
  let frontier = [from]
  for (let hop = 1; frontier.length && hop < 12; hop++) {
    const next: string[] = []
    for (const e of edges) {
      const down = /^(event|queue|async)$/.test(e.k ?? '')
      const [src, dst] = down ? [e.a, e.b] : [e.b, e.a]
      if (frontier.includes(src) && !m.has(dst)) { m.set(dst, hop); next.push(dst) }
    }
    frontier = next
  }
  return m
}
function traceSet(s: Scene, id: string, dir: 'up' | 'down') {
  const nodes = new Set([id]), edges = new Set<string>()
  let frontier = [id]
  while (frontier.length) {
    const next: string[] = []
    for (const e of s.edges ?? []) {
      const [a, b] = dir === 'down' ? [e.b, e.a] : [e.a, e.b]
      if (frontier.includes(a)) { edges.add(e.i); if (!nodes.has(b)) { nodes.add(b); next.push(b) } }
    }
    frontier = next
  }
  return { nodes, edges }
}
/* ▶ flujo: la onda sale de los orígenes y alcanza cada pieza en su salto */
function flowMap(s: Scene, hop = 420): Map<string, number> {
  const edges = s.edges ?? []
  const ids = (s.nodes ?? []).filter(n => !n.g).map(n => n.i)
  const indeg = new Map(ids.map(i => [i, 0]))
  for (const e of edges) if (indeg.has(e.b) && e.a !== e.b) indeg.set(e.b, (indeg.get(e.b) ?? 0) + 1)
  let frontier = ids.filter(i => !indeg.get(i))
  if (!frontier.length && ids.length) frontier = [ids[0]!]
  const m = new Map<string, number>(frontier.map(i => [i, 0]))
  let k = 1
  while (frontier.length) {
    const next: string[] = []
    for (const e of edges) if (frontier.includes(e.a) && !m.has(e.b)) { m.set(e.b, k * hop); next.push(e.b) }
    frontier = next; k++
  }
  for (const g of (s.nodes ?? []).filter(n => n.g)) { const kids = (s.nodes ?? []).filter(n => n.p === g.i).map(n => m.get(n.i)).filter((v): v is number => v != null); if (kids.length) m.set(g.i, Math.min(...kids)) }
  return m
}

/* la rejilla a elementos <Text>, dentro del límite de un Client (100 000 caracteres serializados): si no cabe, se
   simplifica por pasos (colores cuantizados y sin atributos finos; al final, filas sin estilo) */
const TREE_MAX = 90000
function spanCost(sp: Span) { return 34 + sp.t.length * 1.1 + (sp.fg ? 18 : 0) + (sp.bg ? 28 : 0) + (sp.a ? 16 : 0) }
function quantize(c: string | undefined) {
  if (!c || c[0] !== '#' || c.length !== 7) return c
  const q = (h: string) => Math.round(parseInt(h, 16) / 51) * 51
  return '#' + [c.slice(1, 3), c.slice(3, 5), c.slice(5, 7)].map(h => q(h).toString(16).padStart(2, '0')).join('')
}
function toEls(T: (p: Record<string, unknown>) => RenderElement, g: Grid, y0: number, y1: number, keyp: string, budget: { n: number }): RenderElement[] {
  const rows: Span[][] = []
  for (let y = y0; y < y1; y++) rows.push(g.row(y, budget))
  let cost = rows.reduce((a, r) => a + 40 + r.reduce((b, sp) => b + spanCost(sp), 0), 0)
  let level = 0
  if (cost > TREE_MAX) {
    /* paso 1: colores en una paleta corta y fuera atenuado, cursiva y subrayado (los tramos vecinos se funden) */
    level = 1
    for (const r of rows) {
      for (const sp of r) { sp.fg = quantize(sp.fg); sp.bg = quantize(sp.bg); sp.a &= BOLD | INV }
      for (let i = r.length - 1; i > 0; i--) { const a = r[i - 1]!, b = r[i]!; if (a.fg === b.fg && a.bg === b.bg && a.a === b.a) { a.t += b.t; r.splice(i, 1) } }
    }
    cost = rows.reduce((a, r) => a + 40 + r.reduce((b, sp) => b + spanCost(sp), 0), 0)
  }
  if (cost > TREE_MAX) {
    /* paso 2: las filas más caras, en texto plano, hasta caber */
    level = 2
    const order = rows.map((r, i) => ({ i, c: r.reduce((b, sp) => b + spanCost(sp), 0) })).sort((a, b) => b.c - a.c)
    for (const o of order) { if (cost <= TREE_MAX) break; const r = rows[o.i]!; const plain = r.map(sp => sp.t).join(''); cost -= o.c - (34 + plain.length); rows[o.i] = [{ t: plain, a: 0 }] }
  }
  budget.n = level
  return rows.map((spans, k) => T({ key: `${keyp}${y0 + k}`, wrap: 'truncate-end', children: spans.length ? spans.map(sp => T({ color: sp.fg, backgroundColor: sp.bg, bold: !!(sp.a & BOLD) || undefined, dimColor: !!(sp.a & DIM) || undefined, italic: !!(sp.a & ITALIC) || undefined, underline: !!(sp.a & UNDER) || undefined, inverse: !!(sp.a & INV) || undefined, children: sp.t })) : ' ' }))
}
function blit(dst: Grid, src: Grid, dx: number, dy: number, sy0 = 0, rows = src.h) {
  for (let y = 0; y < rows; y++) {
    const ty = dy + y, fy = sy0 + y
    if (ty < 0 || ty >= dst.h || fy < 0 || fy >= src.h) continue
    for (let x = 0; x < src.w; x++) {
      const tx = dx + x
      if (tx < 0 || tx >= dst.w) continue
      const i = dst.idx(tx, ty), j = src.idx(x, fy)
      dst.ch[i] = src.ch[j]!; dst.fg[i] = src.fg[j]; dst.bg[i] = src.bg[j]; dst.at[i] = src.at[j]!; dst.hit[i] = src.hit[j]
    }
  }
}

/* la escena con la geometría de un layout en celdas */
function inCells(s: Scene, lay: CellLayout): Scene {
  const nodes = (s.nodes ?? []).flatMap(n => { const r = lay.nodes[n.i]; return r ? [{ ...n, x: r[0], y: r[1], w: r[2], h: r[3] }] : [] })
  const edges = (s.edges ?? []).flatMap(e => { const r = lay.edges[e.i]; return r ? [{ ...e, p: r.p, lx: r.lx, ly: r.ly }] : [] })
  const lanes = (s.lanes ?? []).flatMap(l => { const r = lay.nodes[l.i]; return r ? [{ ...l, x: r[0], y: r[1], w: r[2], h: r[3], dn: lay.dir === 'down' ? 1 as const : undefined }] : [] })
  return { ...s, nodes, edges, lanes, deco: [], bbox: { x: 0, y: 0, w: lay.w, h: lay.h } }
}
function layoutOf(s: Scene, lv: Level): CellLayout | null { return lv.k === 'fit' ? null : s.cells?.[lv.dir]?.[lv.k] ?? null }
/* la mejor colocación: la más detallada que quepa entera; si ninguna cabe, la vista general */
function autoLevel(s: Scene, w: number, h: number): Level {
  const pref = s.dir === 'down' ? 'down' : 'right', other = pref === 'down' ? 'right' : 'down'
  /* el margen de una celda del layout no cuenta */
  const over = (l: CellLayout) => Math.max(1, (l.w - 2) / w) * Math.max(1, (l.h - 2) / h)
  let best: { lv: Level; o: number } | null = null
  for (const k of ['cards', 'chips', 'mini'] as const) for (const dir of [pref, other] as const) {
    const lay = s.cells?.[dir]?.[k]
    if (!lay) continue
    const o = over(lay)
    if (o <= 1) return { k, dir }
    if (!best || o < best.o - 0.05) best = { lv: { k, dir }, o }
  }
  /* si nada cabe: lo más compacto con un poco de desplazamiento antes que la vista general, que trunca los nombres */
  if (best && best.o <= 1.6) return best.lv
  return { k: 'fit', dir: pref }
}

/* presentando: la colocación más legible en la que caben enteras las piezas del paso (tarjetas, fichas o compacto) */
function stepLevel(s: Scene, ids: string[], w: number, h: number): Level | null {
  const pref = s.dir === 'down' ? 'down' : 'right'
  for (const k of ['cards', 'chips', 'mini'] as const) {
    const lay = s.cells?.[pref]?.[k]
    if (!lay) continue
    const rs = ids.flatMap(i => lay.nodes[i] ? [lay.nodes[i]!] : [])
    if (!rs.length) continue
    const x0 = Math.min(...rs.map(r => r[0])), x1 = Math.max(...rs.map(r => r[0] + r[2])), y0 = Math.min(...rs.map(r => r[1])), y1 = Math.max(...rs.map(r => r[1] + r[3]))
    if (x1 - x0 + 2 <= w && y1 - y0 + 1 <= h) return { k, dir: pref }
  }
  return null
}

/* el minimapa: el diagrama entero en medios bloques y el rectángulo de lo que se ve */
function minimap(g: Grid, s: Scene, cam: Cam, x0: number, y0: number, w: number, h: number, L: Look, viewW: number, viewH: number) {
  const P = L.P, b = s.bbox ?? { x: 0, y: 0, w: 1, h: 1 }
  const bg = P.c(P.mix(P.tok('canvas'), P.tok('ink'), 0.06)) ?? undefined
  const px = new Array<string | undefined>(w * h * 2).fill(undefined)
  const sx = w / (b.w || 1), sy = (h * 2) / (b.h || 1)
  for (const n of s.nodes ?? []) {
    if (n.g) continue
    const c = (L.fx.heat && n.hv != null ? P.heat(n.hv) : P.dual(n.c)) ?? P.tok('muted')
    const ax = Math.floor((n.x - b.x) * sx), ay = Math.floor((n.y - b.y) * sy)
    const bx = Math.max(ax, Math.floor((n.x + n.w - b.x) * sx) - 1), by = Math.max(ay, Math.floor((n.y + n.h - b.y) * sy) - 1)
    for (let yy = ay; yy <= by; yy++) for (let xx = ax; xx <= bx; xx++) if (xx >= 0 && yy >= 0 && xx < w && yy < h * 2) px[yy * w + xx] = n.i === L.sel ? P.tok('accent') : c
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const t = px[y * 2 * w + x], u = px[(y * 2 + 1) * w + x]
    if (L.G.name === 'ascii') g.set(x0 + x, y0 + y, t || u ? '#' : '.', P.c(t ?? u) ?? undefined, bg)
    else g.set(x0 + x, y0 + y, t || u ? (t ? '▀' : '▄') : ' ', P.c(t ?? u), t && u ? P.c(u) : bg)
  }
  /* la ventana */
  const vx0 = Math.round((cam.ox * cam.cw - b.x) * sx), vy0 = Math.round(((cam.oy * cam.ch - b.y) * sy) / 2)
  const vx1 = Math.round(((cam.ox + viewW) * cam.cw - b.x) * sx), vy1 = Math.round((((cam.oy + viewH) * cam.ch - b.y) * sy) / 2)
  const ac = P.c(P.tok('accent'))
  for (let x = clamp(vx0, 0, w - 1); x <= clamp(vx1, 0, w - 1); x++) { g.tint(x0 + x, y0 + clamp(vy0, 0, h - 1), ac, undefined, BOLD | UNDER); g.tint(x0 + x, y0 + clamp(vy1, 0, h - 1), ac, undefined, BOLD | UNDER) }
  const lb = L.G.name === 'unicode' ? '▏' : '|', rb = L.G.name === 'unicode' ? '▕' : '|'
  for (let y = clamp(vy0, 0, h - 1); y <= clamp(vy1, 0, h - 1); y++) { g.set(x0 + clamp(vx0, 0, w - 1), y0 + y, lb, ac, bg); g.set(x0 + clamp(vx1, 0, w - 1), y0 + y, rb, ac, bg) }
}

/* la ayuda: todas las teclas */
const HELP: [string, string][] = [
  ['r', 'presentación: el recorrido paso a paso, con su explicación (sin recorrido, uno automático)'],
  ['n · b  (→ ← en la presentación)', 'paso siguiente · anterior'],
  ['flechas · h j k l · arrastrar', 'mover'], ['z · x  (+ −) · 0', 'acercar · alejar · encuadrar'],
  ['s · a  (tab · mayús+tab)', 'pieza siguiente · anterior'], ['o  (⏎) · doble clic', 'abrir o plegar el contenedor'],
  ['d  (espacio)', 'detalle de la pieza'], ['1–9 · g', 'niveles · orientación ↦ ↧'], ['v · /', 'vista (grafo, esquema, flujos) · buscar'],
  ['t · c · f', 'trazar · ✺ impacto · ▶ flujo (o reproducir la secuencia)'], ['y · , .', 'línea de tiempo: reproducir · paso atrás, adelante'],
  ['e · m · u', 'equipos · minimapa · efectos'], ['q · clic derecho', 'preguntar a Claude por la pieza'], ['w · i', 'navegador · imagen del motor'],
  ['ctrl+x tab · Esc', 'el panel toma el teclado (barra de atajos) · lo devuelve'], ['?', 'esta ayuda'],
]

const Canvas: ClientModule<JsonValue, Local> = (raw, surface) => {
  const props = raw as unknown as CanvasProps
  const { Box, Text } = surface.elements
  const T = (p: Record<string, unknown>) => (Text as unknown as (p: Record<string, unknown>) => RenderElement)(p)
  const s = props.scene
  const caps = props.caps
  const cols = Math.max(20, surface.columns || props.width || 80)
  const height = Math.max(4, Math.floor(props.height) || 24)
  const key = s ? `${s.mountRev ?? 0}:${s.kind}:${s.view ?? ''}` : 'empty'
  const now = () => clocks.get(surface) ?? 0
  const st0 = surface.state
  const cached = freshOf.get(surface)
  const st: Local = st0 && st0.key === key ? st0 : cached && cached.key === key ? cached : { ...fresh(s, now()), ...(st0 ? { mini: st0.mini, side: st0.side, motion: st0.motion, ownerColor: st0.ownerColor, mode: st0.mode === 'seq' || st0.mode === 'tree' ? null : st0.mode } : {}) }
  if (st !== st0) freshOf.set(surface, st)
  const save = (patch: Partial<Local>) => { if ('cam' in patch || 'lv' in patch || 'sy' in patch || 'sx' in patch || 'cur' in patch) followOf.set(surface, false); surface.setState({ ...st, ...patch, t: now() }) }
  const motionMode = st.motion ?? caps.motion
  const motion = motionMode === 'full'
  if (!started.has(surface)) {
    started.add(surface)
    /* el reloj: solo despierta al lienzo si algo se mueve; la línea de tiempo avanza aquí, no al pintar */
    const step = Math.round(1000 / Math.max(2, caps.fps))
    surface.every(step, () => {
      clocks.set(surface, (clocks.get(surface) ?? 0) + step)
      if (Date.now() - (lastInput.get(surface) ?? 0) < 300) return
      const info = tick.get(surface)
      /* si la escena ha cambiado, el estado bueno es el del último pintado, no el guardado */
      const cur = info?.st && (!surface.state || surface.state.key !== info.st.key) ? info.st : surface.state
      if (!cur || !info?.anim) return
      const tn = clocks.get(surface) ?? 0
      let tl = cur.tl, pulse = cur.pulse
      if (tl && tl.on && info.tl && tn - tl.last >= 700 / tl.speed) {
        const i = tl.i + 1 >= info.tl.n ? 0 : tl.i + 1
        const ev = info.tl.events.find(e => e.i === i)
        if (ev) { pulse = { ...pulse }; for (const n of ev.n) pulse[n] = tn }
        tl = { ...tl, i, last: tn, ev: ev ? { l: ev.l, t: tn, tn: ev.tn } : tl.ev }
      }
      surface.setState({ ...cur, t: tn, tl, pulse })
    })
  }
  const G: Glyphs = glyphs(caps.glyphs)
  const empty = (msg: string, sub?: string) => (
    <Box flexDirection="column" height={height}>
      <Text bold>{msg}</Text>
      {sub ? <Text dimColor>{sub}</Text> : null}
    </Box>
  )
  if (!s || s.kind === 'empty') { tick.set(surface, { anim: false, tl: null }); return empty('El lienzo está vacío.', 'Pide a Claude un diagrama: arquitectura, un flujo en Mermaid, el árbol de un repo…') }
  if (s.kind === 'error') { tick.set(surface, { anim: false, tl: null }); return empty(`GraphX: ${s.error ?? 'no se ha podido pintar'}`) }

  const theme = caps.theme
  const P: Painter = painter(caps.color, theme, s.theme?.[theme], s.heat ?? null)
  const fx = fxFlags(s, motion)
  if (motionMode === 'off') { fx.particles = false; fx.entrance = false }
  const canvasBg = s.skin && (caps.color === 'truecolor' || caps.color === '256') ? P.c(P.tok('canvas')) : undefined
  const t = Math.max(st.t, now())

  /* ---- la vista y el tamaño ---- */
  const tier = cols < 40 || height < 8 ? 'micro' : cols < 64 || height < 12 ? 'narrow' : cols >= 132 && height >= 18 ? 'wide' : 'normal'
  const auto: Mode = s.kind === 'tree' ? 'tree' : s.kind === 'seq' ? 'seq' : tier === 'micro' || tier === 'narrow' ? 'outline' : 'graph'
  const mode: Mode = s.kind === 'tree' ? 'tree' : s.kind === 'seq' ? 'seq' : st.mode === 'graph' || st.mode === 'outline' ? st.mode : auto
  const side = tier === 'wide' && st.side && mode !== 'tree' && !st.present
  const sideW = side ? clamp(Math.round(cols * 0.3), 34, 56) : 0
  const mainW = cols - (side ? sideW + 1 : 0)

  /* ---- la línea de tiempo: su fotograma pinta encima de los datos de la escena ---- */
  const TL = s.timeline ?? null
  const tl = TL ? (st.tl ?? { i: TL.start, on: false, speed: 1, last: t, ev: null }) : null
  const pulse = st.pulse
  const tlNow = tl
  const frame = TL && tlNow ? TL.frames[tlNow.i] : null
  const data = frame ? (Object.fromEntries(Object.entries(frame.n).map(([id, v]) => [id, Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x]))])) as Record<string, Record<string, unknown>>) : null
  const edata = frame ? Object.fromEntries(Object.entries(frame.e).map(([id, v]) => [id, Number((v as Record<string, unknown>).r ?? 0)])) : null

  /* ---- lo iluminado: recorrido, trazado, onda, foco ---- */
  let lit: Set<string> | null = null, litE: Set<string> | null = null
  /* ---- el recorrido: el de Claude o el del diagrama; si no hay, uno automático para presentar ---- */
  const serverTour = !!(s.tour && s.tour.steps.length)
  const tourSteps: TourStep[] | null = serverTour ? s.tour!.steps.map(x => ({ t: x.t, b: x.b, n: x.n, e: x.e })) : (st.present || st.lt >= 0) ? autoTour(s) : null
  const stepIdx = serverTour ? (s.step?.at ?? -1) : st.lt
  const curStep = tourSteps && stepIdx >= 0 ? tourSteps[stepIdx] ?? null : null
  if (serverTour && lastStepAt.get(surface) !== stepIdx) { lastStepAt.set(surface, stepIdx); if (stepIdx >= 0) followOf.set(surface, true) }
  if (curStep && (curStep.n.length || curStep.e.length)) {
    lit = new Set(curStep.n); litE = new Set(curStep.e)
    for (const e of s.edges ?? []) if (curStep.n.includes(e.a) && curStep.n.includes(e.b)) litE.add(e.i)
  }
  if (st.trace) { const tr = traceSet(s, st.trace.id, st.trace.dir); lit = tr.nodes; litE = tr.edges }
  if (fx.spotlight && st.sel && !lit) { lit = new Set([st.sel]); litE = new Set(); for (const e of s.edges ?? []) if (e.a === st.sel || e.b === st.sel) { lit.add(e.a); lit.add(e.b); litE.add(e.i) } }
  const wave = st.wave && fx.waves && motion && t - st.wave.t0 < 1400 ? st.wave : null
  if (wave && !lit) { lit = null }
  const march = new Set<string>()
  const focusEdges = st.hover ?? (wave ? wave.id : null)
  if (fx.hoverFlow && focusEdges) for (const e of s.edges ?? []) if (e.a === focusEdges || e.b === focusEdges) march.add(e.i)
  const blast = st.blast ? blastMap(s, st.blast) : null
  const flow = st.flowT0 != null ? flowMap(s) : null
  const flowT = st.flowT0 != null ? t - st.flowT0 : undefined
  const flowDone = flow && flowT != null && flowT > Math.max(0, ...flow.values()) + 1600
  const enter = fx.entrance && st.enterT0 != null && mode === 'graph' ? new Map((s.nodes ?? []).slice().sort((a, b) => (a.g ? -1 : 0) - (b.g ? -1 : 0) || a.y - b.y || a.x - b.x).map((n, i) => [n.i, st.enterT0! + i * 45])) : null
  const enterDone = !enter || t - (st.enterT0 ?? 0) > (s.nodes ?? []).length * 45 + 200
  const pulseMap = Object.keys(pulse).length ? new Map(Object.entries(pulse).filter(([, v]) => t - v < 2600)) : null

  const L: Look = {
    P, G, t, motion: motionMode !== 'off', sel: st.present && curStep?.sel ? curStep.sel : st.sel, hover: st.hover, lit, litE, spot: fx.spotlight, blast, flow, flowT: flowDone ? undefined : flowT,
    march, enter: enterDone ? null : enter, data, edata, fx, owners: s.owners, ownerColor: st.ownerColor, ownerOn: st.ownerOn ? new Set(st.ownerOn) : null, canvasBg, pulse: pulseMap,
  }

  /* ---- las filas fijas ---- */
  /* presentación: sin cabecera ni ayudas; el paso del recorrido, grande, abajo */
  const P_ = st.present
  const headRows = P_ ? 0 : 1
  const bannerRows = s.banner && !P_ ? 1 : 0
  const tlRows = TL ? (P_ ? 1 : height >= 20 ? 3 : height >= 12 ? 2 : 1) : 0
  const tourRows = !tourSteps || !tourSteps.length ? 0 : P_ ? clamp(Math.round(height * 0.3), 4, 9) : stepIdx >= 0 && height >= 22 ? 3 : 1
  const footRows = P_ ? 0 : height >= 16 ? 2 : 1
  const bodyRows = Math.max(3, height - headRows - bannerRows - tlRows - tourRows - footRows)
  const frameG = new Grid(cols, height, G)
  if (canvasBg) frameG.fill(0, 0, cols - 1, height - 1, ' ', undefined, canvasBg)
  const muted = P.c(P.tok('muted')), accent = P.c(P.tok('accent')), ink = P.c(P.tok('ink')), faint = P.c(P.tok('faint'))

  /* cabecera */
  if (!P_) {
    let x = frameG.text(0, 0, fit(s.title || 'GraphX', Math.max(10, Math.floor(cols * 0.45))), ink, canvasBg, BOLD)
    const bits: string[] = []
    if (s.diagram) bits.push(s.diagram.replace(/^mermaid:/, ''))
    if (mode === 'graph' && s.maxDepth) bits.push(`nivel ${(s.depth ?? 1)}/${s.maxDepth}`)
    if (mode === 'graph') { const lvl = st.lv ?? autoLevel(s, mainW, bodyRows); bits.push(lvl.k === 'cards' ? 'tarjetas' : lvl.k === 'chips' ? 'fichas' : lvl.k === 'mini' ? 'compacto' : 'vista general') }
    if (mode !== 'graph') bits.push(mode === 'outline' ? 'esquema' : mode === 'seq' ? 'secuencia' : 'árbol')
    if (s.dir && mode === 'graph') bits.push(s.dir === 'down' ? '↧' : '↦')
    if (st.search?.q) bits.push(`“${st.search.q}”`)
    if (blast) bits.push(`✺ ${blast.size - 1} afectadas`)
    if (st.trace) bits.push(st.trace.dir === 'up' ? 'de qué depende' : 'qué depende')
    if (st.ownerOn?.length) bits.push(`equipos: ${st.ownerOn.join(',')}`)
    x += frameG.text(x, 0, fit(`  ${bits.join(' · ')}`, cols - x - 12), muted, canvasBg)
    const capsTag = `${caps.color === 'truecolor' ? '24b' : caps.color}${motionMode === 'full' ? '' : motionMode === 'reduced' ? ' ◌' : ' ■'} ?`
    frameG.text(cols - strWidth(capsTag), 0, capsTag, faint, canvasBg, DIM)
  }
  let y = headRows
  if (s.banner && !P_) {
    const tc = P.tok(s.banner.tone === 'danger' ? 'del' : s.banner.tone === 'warn' ? 'warn' : s.banner.tone === 'ok' ? 'add' : 'accent')
    const txt = ` ${G.tones[s.banner.tone ?? 'info'] ?? G.info} ${s.banner.title ? s.banner.title + ': ' : ''}${s.banner.text.replace(/\*\*|`/g, '')}`
    frameG.fill(0, y, cols - 1, y, ' ', undefined, P.depth === 'mono' ? undefined : P.c(P.mix(P.tok('canvas'), tc, 0.18)))
    frameG.text(0, y, fit(txt, cols), P.c(tc), P.depth === 'mono' ? undefined : P.c(P.mix(P.tok('canvas'), tc, 0.18)), BOLD | (P.depth === 'mono' ? INV : 0))
    y++
  }
  const bodyY = y

  /* ---- el cuerpo ---- */
  let current: SNode | null = null
  let order: string[] = []
  let seqDone = false
  /* el manejador de teclas de la vista activa: devuelve false si la tecla no es suya */
  let modeKey: ((k: ClientKeyEvent) => boolean | void) | null = null
  let seqFollow: (id: string) => number | null = () => null
  /* el desplazamiento que se ve en una secuencia (el del paso que se sigue, o el guardado): las teclas y el arrastre parten de él */
  let seqSy = st.sy
  let boxes = new Map<string, { x0: number; y0: number; x1: number; y1: number }>()
  let cam: Cam | null = null
  const nodesById = new Map((s.nodes ?? []).map(n => [n.i, n]))
  let gs: Scene = s
  let level: Level | null = null
  if (mode === 'graph') {
    /* presentando, lo legible en que quepa el paso */
    level = st.lv ?? (st.present && curStep?.n.length ? stepLevel(s, curStep.n, mainW, bodyRows) ?? autoLevel(s, mainW, bodyRows) : autoLevel(s, mainW, bodyRows))
    const lay = layoutOf(s, level)
    if (lay) {
      gs = inCells(s, lay)
      /* 1:1, centrado si cabe; si no, desde la primera pieza en orden de lectura */
      cam = st.cam && st.cam.cw === 1 ? st.cam : { cw: 1, ch: 1, ox: lay.w <= mainW ? -Math.floor((mainW - lay.w) / 2) : 1, oy: lay.h <= bodyRows ? -Math.floor((bodyRows - lay.h) / 2) : 1 }
    } else cam = st.cam && st.cam.cw !== 1 ? st.cam : fitCam(s, mainW, bodyRows)
    /* la cámara sigue al paso del recorrido: centra sus piezas */
    if (followOf.get(surface) && curStep && curStep.n.length && cam) {
      const ns = (gs.nodes ?? []).filter(n => curStep.n.includes(n.i))
      if (ns.length) {
        const x0 = Math.min(...ns.map(n => n.x)), x1 = Math.max(...ns.map(n => n.x + n.w)), y0 = Math.min(...ns.map(n => n.y)), y1 = Math.max(...ns.map(n => n.y + n.h))
        cam = { ...cam, ox: (x0 + x1) / 2 / cam.cw - mainW / 2, oy: (y0 + y1) / 2 / cam.ch - bodyRows / 2 }
      }
    }
    const d = drawGraph(gs, mainW, bodyRows, cam, L)
    blit(frameG, d.grid, 0, bodyY)
    boxes = d.boxes
    /* el orden de tab: el de lectura de todas las piezas, se vean ya o no (la cascada de entrada aún no ha acabado) */
    order = (gs.nodes ?? []).filter(n => !n.ln && !(n.g && n.o)).slice().sort((a, b) => a.y - b.y || a.x - b.x).map(n => n.i)
    /* minimapa: cuando el diagrama no cabe */
    const b = gs.bbox ?? { x: 0, y: 0, w: 0, h: 0 }
    const overflow = b.w / cam.cw > mainW + 2 || b.h / cam.ch > bodyRows + 1
    if (st.mini && overflow && mainW >= 50 && bodyRows >= 10) {
      /* a escala (una celda del minimapa por celda del diagrama en cada eje) y sin pasar de un cuarto del alto: si
         el diagrama es más alto que ancho, el minimapa se estrecha en vez de crecer */
      const mh = clamp(Math.round(clamp(Math.round(mainW * 0.18), 14, 30) * (b.h / (b.w || 1))), 3, Math.max(3, Math.round(bodyRows * 0.25)))
      const mw = clamp(Math.round(mh * ((b.w || 1) / (b.h || 1))), 8, 30)
      minimap(frameG, gs, cam, mainW - mw - 1, bodyY + bodyRows - mh - 1, mw, mh, L, mainW, bodyRows)
    }
    /* el tooltip de la pieza bajo el ratón */
    const hv = st.hover ? nodesById.get(st.hover) : null
    const hb = hv ? boxes.get(hv.i) : null
    if (hv && hb && hv.sm && st.hover !== st.sel) {
      const tw = Math.min(44, mainW - 4)
      const words = hv.sm.split(/\s+/); const tlines: string[] = []; let cur = ''
      for (const w of words) { if (!cur) cur = w; else if (strWidth(cur) + 1 + strWidth(w) <= tw - 4) cur += ' ' + w; else { tlines.push(cur); cur = w; if (tlines.length >= 3) break } }
      if (cur && tlines.length < 4) tlines.push(cur)
      const th = tlines.length + 2
      const tx = clamp(hb.x0, 0, mainW - tw), ty = hb.y1 + 1 + th < bodyRows ? hb.y1 + 1 : Math.max(0, hb.y0 - th)
      const tbg = P.depth === 'mono' ? undefined : P.c(P.mix(P.tok('canvas'), P.tok('ink'), 0.1))
      frameG.fill(tx, bodyY + ty, tx + tw - 1, bodyY + ty + th - 1, ' ', undefined, tbg)
      frameG.text(tx + 1, bodyY + ty, fit(hv.l, tw - 2), accent, tbg, BOLD)
      tlines.forEach((l, i) => frameG.text(tx + 1, bodyY + ty + 1 + i, fit(l, tw - 2), ink, tbg))
    }
  } else if (mode === 'outline') {
    const rows = outlineRows(s, st.sel)
    /* el cursor va por id de fila: las filas de conexiones y las cabeceras de carril también se pisan */
    let ci = st.curId ? rows.findIndex(r => r.id === st.curId) : -1
    if (ci < 0 && st.sel) ci = rows.findIndex(r => r.id === st.sel)
    const cur = clamp(ci >= 0 ? ci : st.cur, 0, Math.max(0, rows.length - 1))
    const top = clamp(cur < st.top ? cur : cur >= st.top + bodyRows ? cur - bodyRows + 1 : st.top, 0, Math.max(0, rows.length - bodyRows))
    blit(frameG, drawOutline(s, rows, mainW, bodyRows, top, cur, L), 0, bodyY)
    order = rows.filter(r => r.node).map(r => r.id)
    const r = rows[cur]
    if (r?.node) current = r.node
    outlineKeys(rows, cur, top)
  } else if (mode === 'seq' && s.sq) {
    const lay = layoutSeq(s.sq, mainW)
    const sqRows = s.sq.rows
    seqFollow = id => { const k = sqRows.findIndex(r => r.i === id); const ry = lay.rows[k]; return ry ? Math.max(0, ry.y - Math.floor(bodyRows / 2)) : null }
    const sFollow = followOf.get(surface) && curStep?.sel ? seqFollow(curStep.sel) : null
    const playAt = st.play ? Math.min(s.sq.rows.length - 1, Math.floor((t - st.play.t0) / 900)) : null
    seqSy = sFollow ?? st.sy
    const d = drawSeq(s.sq, lay, mainW, bodyRows, st.sx, seqSy, L, playAt)
    blit(frameG, d.grid, 0, bodyY)
    boxes = d.boxes
    /* el orden de tab: el de lectura de todas las piezas, se vean ya o no (la cascada de entrada aún no ha acabado) */
    order = d.order
    const playDone = !!st.play && playAt != null && t - st.play.t0 > s.sq.rows.length * 900 + 1500
    if (playDone) seqDone = true
  } else if (mode === 'tree' && s.rows) {
    const rows = s.rows
    /* la presentación lleva el cursor al paso */
    const fIdx = followOf.get(surface) && curStep?.sel ? rows.findIndex(r => r.i === curStep.sel) : -1
    const cur = clamp(fIdx >= 0 ? fIdx : st.cur, 0, Math.max(0, rows.length - 1))
    const top = clamp(cur < st.top ? cur : cur >= st.top + bodyRows ? cur - bodyRows + 1 : st.top, 0, Math.max(0, rows.length - bodyRows))
    blit(frameG, drawTree(rows, mainW, bodyRows, top, cur, L, s.signs, st.enterT0), 0, bodyY)
    treeKeys(rows, cur, top)
  }
  if (!current && st.sel) current = nodesById.get(st.sel) ?? null

  /* ---- el detalle encima del lienzo, cuando no hay sitio para el panel lateral ---- */
  if (!side && st.det && mode !== 'tree') {
    const det: Detail | null = props.detail && st.sel && props.detail.i === st.sel ? props.detail : null
    const dg = drawDetail(s, current, det, mainW - 2, L)
    const top = clamp(st.detailTop, 0, Math.max(0, dg.h - bodyRows))
    frameG.fill(0, bodyY, cols - 1, bodyY + bodyRows - 1, ' ', undefined, canvasBg)
    blit(frameG, dg, 1, bodyY, top, bodyRows)
    if (dg.h > bodyRows) frameG.text(cols - 2, bodyY + bodyRows - 1, top + bodyRows < dg.h ? G.down : ' ', faint, canvasBg)
  }

  /* ---- el panel lateral ---- */
  if (side) {
    const det: Detail | null = props.detail && st.sel && props.detail.i === st.sel ? props.detail : null
    const sg = drawDetail(s, current, det, sideW - 1, L)
    const top = clamp(st.detailTop, 0, Math.max(0, sg.h - bodyRows))
    for (let yy = 0; yy < bodyRows; yy++) frameG.set(mainW, bodyY + yy, G.box.sharp.l, P.c(P.tok('line')), canvasBg, DIM)
    blit(frameG, sg, mainW + 2, bodyY, top, bodyRows)
    if (sg.h > bodyRows) frameG.text(cols - 3, bodyY + bodyRows - 1, top + bodyRows < sg.h ? G.down : ' ', faint, canvasBg)
  }
  y = bodyY + bodyRows

  /* ---- la línea de tiempo ---- */
  if (TL && tlNow) {
    const n = TL.labels.length
    const w = cols - 18
    const mx = Math.max(1, ...TL.total)
    const xOf = (i: number) => 9 + Math.round((i / Math.max(1, n - 1)) * (w - 1))
    const playTxt = `${tlNow.on ? G.pause : G.play} ${tlNow.speed}×`
    frameG.text(0, y, fit(playTxt, 8), accent, canvasBg, BOLD)
    for (let x = 0; x < w; x++) {
      const i = Math.round((x / Math.max(1, w - 1)) * (n - 1))
      const v = TL.total[i] ?? 0
      const lv = Math.round((v / mx) * (G.spark.length - 1))
      const ev = TL.events.find(e => Math.abs(xOf(e.i) - (9 + x)) === 0)
      frameG.set(9 + x, y, ev ? (G.name === 'ascii' ? '!' : '▼') : G.spark[lv]!, ev ? P.c(P.tok(ev.tn === 'crit' ? 'del' : ev.tn === 'warn' ? 'warn' : 'accent')) : P.c(i <= tlNow.i ? P.tok('accent') : P.tok('faint')), canvasBg, ev ? BOLD : i <= tlNow.i ? 0 : DIM)
    }
    frameG.set(xOf(tlNow.i), y, G.cursor, P.c(P.tok('ink')), canvasBg, BOLD)
    frameG.text(9 + w + 1, y, fit(TL.labels[tlNow.i] ?? '', 8), ink, canvasBg, BOLD)
    if (tlRows >= 2) {
      const ev = tlNow.ev && t - tlNow.ev.t < 4000 ? tlNow.ev : null
      const txt = ev ? `${G.tones[ev.tn] ?? G.info} ${ev.l}` : `${TL.l ?? 'Línea de tiempo'} · ${TL.labels[0]} → ${TL.labels[n - 1]}`
      frameG.text(9, y + 1, fit(txt, w), ev ? P.c(P.tok(ev.tn === 'crit' ? 'del' : 'warn')) : muted, canvasBg, ev ? BOLD : DIM)
    }
    if (tlRows >= 3) {
      /* las marcas de los eventos con su hora */
      for (const e of TL.events.slice(0, 8)) { const x = xOf(e.i); frameG.text(Math.min(cols - 6, x), y + 2, fit(TL.labels[e.i] ?? '', 6), faint, canvasBg, DIM) }
    }
    y += tlRows
  }

  /* ---- el recorrido (y la presentación, más grande) ---- */
  if (tourRows && tourSteps) {
    const n = tourSteps.length, at = stepIdx
    const cs = at >= 0 ? tourSteps[at] : null
    const tbg = P_ && P.depth !== 'mono' ? P.c(P.mix(P.tok('canvas'), P.tok('accent'), 0.07)) : canvasBg
    if (P_) frameG.fill(0, y, cols - 1, y + tourRows - 1, ' ', undefined, tbg)
    let x = frameG.text(0, y, `${G.prev} `, accent, tbg, BOLD)
    x += frameG.text(x, y, at >= 0 ? `${at + 1}/${n} ` : `${serverTour ? s.tour!.t : 'Recorrido automático'} · ${n} pasos `, ink, tbg, BOLD)
    x += frameG.text(x, y, `${G.next} `, accent, tbg, BOLD)
    /* las pistas, si caben junto al título del paso (primero la larga, luego la corta; en lo estrecho, ninguna) */
    const hints = P_ ? ['n ▶ · b ◀ · r sale', 'n b r'] : at >= 0 ? ['n ▶ · b ◀ · r presentar', 'n b r'] : ['r presentar · n empezar', 'r n']
    const hint = hints.find(t => cols - x - strWidth(t) - 1 >= (cs ? Math.min(12, strWidth(cs.t)) : 0)) ?? ''
    if (cs) x += frameG.text(x, y, fit(cs.t, cols - x - (hint ? strWidth(hint) + 1 : 0)), accent, tbg, BOLD | (P_ ? UNDER : 0))
    if (hint) frameG.text(cols - strWidth(hint), y, hint, faint, tbg, DIM)
    if (tourRows >= 2) {
      const body = (cs?.b ?? (serverTour ? s.step?.b : '') ?? '')
      const lines: string[] = []
      for (const para of body.split('\n')) {
        let cur = ''
        for (const w of para.replace(/\s+/g, ' ').trim().split(' ')) { if (!w) continue; if (!cur) cur = w; else if (strWidth(cur) + 1 + strWidth(w) <= cols - 4) cur += ' ' + w; else { lines.push(cur); cur = w } }
        if (cur) lines.push(cur)
      }
      const room = tourRows - (P_ ? 2 : 1)
      lines.slice(0, room).forEach((l, i) => frameG.text(2, y + 1 + i, fit(l, cols - 4), P_ ? ink : muted, tbg))
      if (lines.length > room) frameG.text(cols - 3, y + room, G.ellipsis, faint, tbg)
      if (P_) {
        /* el avance: un punto por paso (o una barra si son muchos) */
        const py = y + tourRows - 1
        if (n <= Math.floor((cols - 4) / 2)) for (let k = 0; k < n; k++) frameG.set(2 + k * 2, py, k === at ? G.dot : k < at ? G.bullet : G.dotHollow, k <= at ? accent : faint, tbg)
        else { const w = cols - 4, f = Math.round(((at + 1) / n) * w); for (let k = 0; k < w; k++) frameG.set(2 + k, py, k < f ? G.bar.full : G.bar.empty, k < f ? accent : faint, tbg) }
      }
    }
    y += tourRows
  }

  /* ---- el pie: la pieza, el mensaje o la búsqueda, y las teclas ---- */
  if (footRows) {
    const fy = height - footRows
    if (st.search?.on) {
      frameG.text(0, fy, `/ ${st.search.q}${motion && Math.floor(t / 500) % 2 ? '▏' : ' '}`, accent, canvasBg, BOLD)
      frameG.text(cols - 26, fy, '⏎ buscar · vacío limpia', faint, canvasBg, DIM)
    } else if (st.msg && t - st.msg.at < 3500) frameG.text(0, fy, fit(st.msg.t, cols), accent, canvasBg, BOLD)
    else if (current) {
      const cc = P.c(P.dual(current.c)) ?? accent
      let x = frameG.text(0, fy, fit(current.l, Math.floor(cols * 0.4)), cc, canvasBg, BOLD)
      const bits: string[] = []
      if (current.hv != null) bits.push(`${s.heat?.label ?? 'calor'} ${fmtNum((data?.[current.i]?.hv as number) ?? current.hv)}${s.heat?.unit ? ' ' + s.heat.unit : ''}`)
      if (current.st) bits.push(current.st)
      if (current.ow) bits.push(s.owners?.[current.ow]?.label ?? current.ow)
      const outs = (s.edges ?? []).filter(e => e.a === current!.i).length, ins = (s.edges ?? []).filter(e => e.b === current!.i).length
      bits.push(`${ins}${G.head.r}·${G.head.r}${outs}`)
      x += frameG.text(x, fy, fit(`  ${bits.join(' · ')}`, cols - x), muted, canvasBg)
      if (current.sm && !side && x < cols - 10) frameG.text(x, fy, fit(`  — ${current.sm}`, cols - x), faint, canvasBg, DIM)
    } else if (s.sm) frameG.text(0, fy, fit(s.sm, cols), muted, canvasBg)
    if (footRows >= 2 || !current) {
      const hy = height - 1
      const hints = mode === 'tree' ? 's a mover · o abrir · q preguntar · r presentar · ? ayuda'
        : mode === 'outline' ? 's a mover · o abrir · d detalle · v vista · r presentar · ? ayuda'
          : mode === 'seq' ? 'r presentar · s a mensaje · f reproducir · flechas desplazar · v vista · ? ayuda'
            : `r presentar · s a pieza · z x zoom · hjkl mover · o abrir · d detalle${s.edges?.length ? ' · t trazar · c impacto' : ''}${TL ? ' · y tiempo' : ''} · ? ayuda`
      if (footRows >= 2) frameG.text(0, hy, fit(hints, cols), faint, canvasBg, DIM)
    }
  }

  /* ---- la ayuda, encima de todo ---- */
  if (st.help) {
    const w = Math.min(cols - 2, 70), h = Math.min(height - 1, HELP.length + 3)
    const x0 = Math.max(0, Math.floor((cols - w) / 2)), y0 = Math.max(0, Math.floor((height - h) / 2))
    const hb = P.depth === 'mono' ? undefined : P.c(P.mix(P.tok('canvas'), P.tok('ink'), 0.08))
    frameG.fill(x0, y0, x0 + w - 1, y0 + h - 1, ' ', undefined, hb)
    frameG.text(x0 + 2, y0, 'Teclas del lienzo', accent, hb, BOLD)
    const capsLine = `${caps.term || 'terminal'} · ${caps.color} · ${caps.glyphs}${caps.braille ? ' + braille' : ''} · imágenes ${caps.images} · ratón ${caps.pointer ? 'sí' : 'no'} · ${caps.fps} fps`
    frameG.text(x0 + 2, y0 + h - 1, fit(capsLine, w - 4), faint, hb, DIM)
    HELP.slice(0, h - 3).forEach(([k, v], i) => { frameG.text(x0 + 2, y0 + 2 + i, fit(k, 24), accent, hb, BOLD); frameG.text(x0 + 27, y0 + 2 + i, fit(v, w - 29), ink, hb) })
  }

  /* ---- ¿hay algo que se mueva? ---- */
  const tlPlaying = !!(TL && tlNow && tlNow.on)
  const moving = motionMode !== 'off' && (
    tlPlaying || st.flowT0 != null && !flowDone || (!!st.play && !seqDone) || !!wave || !enterDone || (!!pulseMap && pulseMap.size > 0) ||
    (mode === 'graph' && (fx.particles !== false && (s.edges ?? []).some(e => (e.r ?? 0) > 0 || (fx.particles !== 'data' && (e.an || e.he))) || march.size > 0 || (s.edges ?? []).some(e => e.an) || (fx.alerts && (s.nodes ?? []).some(n => n.al === 'crit' || n.al === 'warn' || n.pu)) || (s.nodes ?? []).some(n => n.hd || n.sn?.lv || n.st === 'active'))) ||
    !!blast || (st.search?.on ?? false) || (st.msg != null && t - st.msg.at < 3500))
  tick.set(surface, { anim: moving && (motionMode === 'full' || tlPlaying || (!!st.play && !seqDone) || st.flowT0 != null), st, tl: TL ? { n: TL.labels.length, events: TL.events } : null })

  /* ---- teclado y ratón ---- */
  function act(type: string, extra: Record<string, unknown> = {}) { surface.post({ type, ...extra } as never) }
  function selectNode(id: string | null, extra: Partial<Local> = {}) {
    if (id && id !== st.sel) wantDetail(id)
    save({ sel: id, curId: null, wave: id && fx.waves ? { id, t0: now() } : null, ...extra })
  }
  function reveal(id: string): Partial<Local> {
    if (!cam) return {}
    const b = boxes.get(id)
    if (!b) return {}
    let { ox, oy } = cam
    if (b.x0 < 0 || b.x1 >= mainW) ox += Math.round((b.x0 + b.x1) / 2 - mainW / 2)
    if (b.y0 < 0 || b.y1 >= bodyRows) oy += Math.round((b.y0 + b.y1) / 2 - bodyRows / 2)
    return { cam: { ...cam, ox, oy } }
  }
  /* acercar y alejar: tarjetas ⇄ fichas ⇄ vista general ⇄ más lejos, sin perder de vista la pieza en foco */
  function zoom(f: number) {
    if (!cam || !level) return
    const ladder: Level['k'][] = ['cards', 'chips', 'mini', 'fit']
    const has = (k: Level['k']) => k === 'fit' || !!s!.cells?.[level!.dir]?.[k]
    const focus = st.sel ?? st.hover
    const geomOf = (lv: Level) => { const lay = layoutOf(s!, lv); return { lay, bb: lay ? { x: 0, y: 0, w: lay.w, h: lay.h } : s!.bbox ?? { x: 0, y: 0, w: 1, h: 1 } } }
    /* la pieza en foco se queda donde estaba; sin foco, el centro de la vista va al mismo sitio relativo */
    const center = (lv: Level, nc: Cam): Cam => {
      const to = geomOf(lv), from = geomOf(level!)
      const n = focus ? (s!.nodes ?? []).find(x => x.i === focus) : null
      const r = n ? (to.lay ? to.lay.nodes[n.i] : [n.x, n.y, n.w, n.h]) : null
      if (r) return { ...nc, ox: (r[0]! + r[2]! / 2) / nc.cw - mainW / 2, oy: (r[1]! + r[3]! / 2) / nc.ch - bodyRows / 2 }
      const fx = ((cam!.ox + mainW / 2) * cam!.cw - from.bb.x) / (from.bb.w || 1), fy = ((cam!.oy + bodyRows / 2) * cam!.ch - from.bb.y) / (from.bb.h || 1)
      const fit = to.bb.w / nc.cw <= mainW && to.bb.h / nc.ch <= bodyRows
      if (fit && to.lay) return { ...nc, ox: -Math.floor((mainW - to.bb.w) / 2), oy: -Math.floor((bodyRows - to.bb.h) / 2) }
      return { ...nc, ox: (to.bb.x + fx * to.bb.w) / nc.cw - mainW / 2, oy: (to.bb.y + fy * to.bb.h) / nc.ch - bodyRows / 2 }
    }
    if (level.k === 'fit' && (f > 1 || cam.cw * f >= fitCam(s!, mainW, bodyRows).cw * 0.95)) {
      /* más lejos que la vista general: la cámara de siempre (acercando, primero vuelve a la vista general) */
      if (f < 1) { const fc = fitCam(s!, mainW, bodyRows); save({ cam: fc, lv: level }); return }
      if (f > 1) { const cw = clamp(cam.cw * f, 2.5, 80), ch = chFor(s!.nodes ?? [], cw); save({ cam: { cw, ch, ox: (cam.ox + mainW / 2) * cam.cw / cw - mainW / 2, oy: (cam.oy + bodyRows / 2) * cam.ch / ch - bodyRows / 2 }, lv: level }); return }
    }
    let i = ladder.indexOf(level.k)
    do i += f < 1 ? -1 : 1; while (i >= 0 && i < ladder.length && !has(ladder[i]!))
    if (i < 0 || i >= ladder.length) return
    const lv: Level = { k: ladder[i]!, dir: level.dir }
    const nc: Cam = lv.k === 'fit' ? fitCam(s!, mainW, bodyRows) : { cw: 1, ch: 1, ox: 0, oy: 0 }
    save({ lv, cam: center(lv, nc), msg: { t: lv.k === 'cards' ? 'Tarjetas (1:1)' : lv.k === 'chips' ? 'Fichas (1:1)' : lv.k === 'mini' ? 'Fichas compactas' : 'Vista general', at: now() } })
  }
  function msg(t: string) { save({ msg: { t, at: now() } }) }
  /* el detalle completo (bloques, vecindad) solo se pide cuando se ve: panel lateral o detalle abierto */
  function wantDetail(id: string, force = false) { if (side || st.det || force) act('detail', { id }) }
  function stepTo(at: number) {
    if (!tourSteps || !tourSteps.length) { msg('Este diagrama no tiene recorrido: r empieza uno automático'); return }
    const i = clamp(at, 0, tourSteps.length - 1)
    followOf.set(surface, true)
    if (serverTour) act('step', { at: i })
    else save({ lt: i, sel: tourSteps[i]?.sel ?? st.sel })
  }
  function common(k: ClientKeyEvent): boolean {
    const c = k.key
    if (c === '?') { save({ help: !st.help }); return true }
    if (st.help) { save({ help: false }); return true }
    /* presentación: el recorrido paso a paso, con su explicación */
    if (c === 'r') {
      if (st.present) { save({ present: false, msg: { t: 'Fin de la presentación', at: now() } }); return true }
      followOf.set(surface, true)
      save({ present: true, det: false, lt: serverTour ? st.lt : Math.max(0, st.lt), msg: null })
      if (serverTour && (s!.step?.at ?? -1) < 0) act('step', { at: 0 })
      return true
    }
    const at = serverTour ? (s!.step?.at ?? -1) : st.lt
    if (st.present && tourSteps) {
      if (c === 'n' || c === 'right' || c === ' ' || c === 'return' || c === 'l' || c === 'j' || c === 'down') { if (at >= tourSteps.length - 1) msg('Último paso · r sale de la presentación'); else stepTo(at + 1); return true }
      if (c === 'b' || c === 'p' || c === 'left' || c === 'h' || c === 'k' || c === 'up') { stepTo(Math.max(0, at - 1)); return true }
      if (c === 'home') { stepTo(0); return true }
    }
    if (c === 'n') { stepTo(at + 1); return true }
    if (c === 'b' || c === 'p') { stepTo(Math.max(0, at - 1)); return true }
    if (c === '/') { save({ search: { on: true, q: st.search?.q ?? '' } }); return true }
    if (c === 'v' && mode === 'tree') { msg('El árbol no tiene otras vistas'); return true }
    if (c === 'v') {
      const views: string[] = []
      if (s!.graphTab !== false) views.push('graph', 'outline')
      for (const f of s!.flows ?? []) views.push('flow:' + f.i)
      const curV = mode === 'seq' ? (s!.view ?? '') : mode
      const nxt = views[(views.indexOf(curV) + 1) % Math.max(1, views.length)] ?? 'graph'
      if (nxt.startsWith('flow:')) act('ui', { view: nxt })
      else if (mode === 'seq') { act('ui', { view: 'graph' }); save({ mode: nxt as Mode }) }
      else save({ mode: nxt as Mode })
      msg(`Vista: ${nxt === 'graph' ? 'grafo' : nxt === 'outline' ? 'esquema' : 'secuencia'}`)
      return true
    }
    if (c === 'u') { const m = motionMode === 'full' ? 'reduced' : motionMode === 'reduced' ? 'off' : 'full'; save({ motion: m, msg: { t: `Efectos: ${m === 'full' ? 'todos' : m === 'reduced' ? 'reducidos (sin partículas)' : 'quietos'}`, at: now() } }); return true }
    if (c === 'm') { save({ mini: !st.mini, msg: { t: st.mini ? 'Sin minimapa' : 'Minimapa', at: now() } }); return true }
    if (c === 'w' && mode !== 'tree') { act('open'); msg('Abriendo el navegador…'); return true }
    if (c === 'i') { act('pixels'); return true }
    if (c === 'y') { if (TL && tl) { save({ tl: { ...tl, on: !tl.on, last: now() }, msg: { t: tl.on ? 'Línea de tiempo en pausa' : 'Reproduciendo la línea de tiempo', at: now() } }) } else msg('Este diagrama no tiene línea de tiempo'); return true }
    if ((c === ',' || c === '.') && TL && tl) { const i = clamp(tl.i + (c === '.' ? 1 : -1), 0, TL.labels.length - 1); save({ tl: { ...tl, i, on: false } }); return true }
    if ((c === '<' || c === '>') && TL && tl) { save({ tl: { ...tl, speed: c === '>' ? Math.min(8, tl.speed * 2) : Math.max(0.5, tl.speed / 2) } }); return true }
    if (c === 'e') {
      if (!s!.owners) { msg('Este diagrama no tiene equipos'); return true }
      /* equipos: colorear → cada equipo → todos */
      const ids = Object.keys(s!.owners)
      if (!st.ownerColor && !st.ownerOn) { save({ ownerColor: true, msg: { t: 'Color por equipo', at: now() } }); return true }
      const curO = st.ownerOn?.[0]
      const nx = curO == null ? ids[0] : ids[ids.indexOf(curO) + 1]
      save({ ownerOn: nx ? [nx] : null, ownerColor: !!nx, msg: { t: nx ? `Equipo: ${s!.owners[nx]?.label ?? nx}` : 'Todos los equipos', at: now() } })
      return true
    }
    if (c === 'q' && mode !== 'tree') { if (st.sel) { const n = nodesById.get(st.sel); act('ask', { id: st.sel, label: n?.l ?? st.sel }) } else msg('Elige antes una pieza (s / a)'); return true }
    if (c === 'g' && mode !== 'seq' && mode !== 'tree') {
      const cur = st.lv ?? autoLevel(s!, mainW, bodyRows)
      const dir = cur.dir === 'down' ? 'right' : 'down'
      act('ui', { dir })
      save({ lv: { k: cur.k, dir }, cam: null, msg: { t: dir === 'down' ? 'Orientación ↧' : 'Orientación ↦', at: now() } })
      return true
    }
    if (/^[1-9]$/.test(c) && mode !== 'seq' && mode !== 'tree') { act('ui', { depth: Number(c) - 1 }); save({ cam: null, lv: null, msg: { t: `Nivel ${c}`, at: now() } }); return true }
    if (c === '0') { save({ cam: null, lv: null, sx: 0, sy: 0 }); return true }
    if (c === 'f') {
      if (mode === 'seq') { save({ play: st.play ? null : { k: 0, t0: now() }, msg: { t: st.play ? 'Reproducción parada' : 'Reproduciendo la secuencia', at: now() } }); return true }
      save({ flowT0: st.flowT0 != null ? null : now(), msg: { t: st.flowT0 != null ? 'Flujo parado' : '▶ Flujo desde los orígenes', at: now() } }); return true
    }
    if (c === 'c') { if (!st.sel) { msg('Elige antes una pieza (s / a) para ver su impacto'); return true } save({ blast: st.blast === st.sel ? null : st.sel, msg: { t: st.blast === st.sel ? 'Sin impacto' : `✺ Impacto de ${nodesById.get(st.sel)?.l ?? st.sel}`, at: now() } }); return true }
    if (c === 't') { if (!st.sel) { msg('Elige antes una pieza (s / a) para trazar'); return true } const dir = !st.trace || st.trace.id !== st.sel ? 'up' : st.trace.dir === 'up' ? 'down' : null; save({ trace: dir ? { id: st.sel, dir } : null, msg: { t: dir === 'up' ? 'De qué depende' : dir === 'down' ? 'Qué depende de esto' : 'Sin trazado', at: now() } }); return true }
    if ((c === 'd' || c === ' ') && mode !== 'tree') {
      if (tier === 'wide') save({ side: !st.side })
      else { if (!st.det && st.sel) wantDetail(st.sel, true); save({ det: !st.det, detailTop: 0 }) }
      return true
    }
    if (st.det && !side && mode !== 'tree' && (c === 'down' || c === 'j' || c === 'up' || c === 'k')) { save({ detailTop: Math.max(0, st.detailTop + (c === 'down' || c === 'j' ? 2 : -2)) }); return true }
    if (c === 'pagedown' && (side || st.det)) { save({ detailTop: st.detailTop + Math.max(4, bodyRows - 4) }); return true }
    if (c === 'pageup' && (side || st.det)) { save({ detailTop: Math.max(0, st.detailTop - Math.max(4, bodyRows - 4)) }); return true }
    return false
  }
  /* las teclas, a un solo mapa: minúsculas (como los atajos del panel) y los alias de siempre */
  function keyOf(k: ClientKeyEvent): ClientKeyEvent {
    let c = k.key
    if (c.length === 1 && c >= 'A' && c <= 'Z') c = c.toLowerCase()
    if (c === 'tab') c = k.shift ? 'a' : 's'
    else if (c === '+' || c === '=') c = 'z'
    else if (c === '-' || c === '_') c = 'x'
    return { ...k, key: c }
  }
  function dispatch(k0: ClientKeyEvent) {
    lastInput.set(surface, Date.now())
    if (st.search?.on) {
      const c = k0.key
      if (c === 'return') { act('ui', { search: st.search.q }); save({ search: st.search.q ? { on: false, q: st.search.q } : null }) }
      else if (c === 'backspace' || c === 'delete') save({ search: { on: true, q: st.search.q.slice(0, -1) } })
      else if (c.length === 1 && !k0.ctrl && !k0.meta) save({ search: { on: true, q: st.search.q + c } })
      return
    }
    const k = keyOf(k0)
    if (common(k)) return
    if (modeKey && modeKey(k) !== false) return
    if (k.key.length === 1) msg(`«${k.key}» no hace nada aquí · ? enseña las teclas`)
  }
  function outlineKeys(rows: ReturnType<typeof outlineRows>, cur: number, top: number) {
    const move = (to: number) => { const c = clamp(to, 0, Math.max(0, rows.length - 1)); const r = rows[c]; const id = r?.node ? r.id : null; if (id && id !== st.sel) wantDetail(id); save({ cur: c, curId: r?.id ?? null, top, sel: id ?? st.sel }) }
    modeKey = k => {
      const r = rows[cur]
      if (k.key === 'down' || k.key === 'j' || k.key === 's') move(cur + 1)
      else if (k.key === 'up' || k.key === 'k' || k.key === 'a') move(cur - 1)
      else if (k.key === 'pagedown') move(cur + bodyRows - 1)
      else if (k.key === 'pageup') move(cur - bodyRows + 1)
      else if (k.key === 'home') move(0)
      else if (k.key === 'end') move(rows.length - 1)
      else if (!r) return
      else if (r.link && (k.key === 'return' || k.key === 'right' || k.key === 'o')) { wantDetail(r.link.other); save({ sel: r.link.other, curId: r.link.other }) }
      else if ((k.key === 'right' || k.key === 'l' || k.key === 'return' || k.key === 'o') && r.node?.k && !r.node.o) act('ui', { open: r.id })
      else if ((k.key === 'left' || k.key === 'h' || k.key === 'o') && r.node?.k && r.node.o) act('ui', { close: r.id })
      else if (k.key === 'left' || k.key === 'h') { for (let i = cur - 1; i >= 0; i--) if (rows[i]!.depth < r.depth) { move(i); break } }
    }
    surface.onPointer(p => {
      if (p.type !== 'up' || p.y < bodyY || p.y >= bodyY + bodyRows) { if (p.type === 'up') clickChrome(p); return }
      const i = top + p.y - bodyY, r = rows[i]
      if (!r) return
      const dbl = st.click && st.click.id === r.id && Date.now() - st.click.t < 450
      if (dbl && r.node?.k) act('ui', r.node.o ? { close: r.id } : { open: r.id })
      if (r.node && r.id !== st.sel) wantDetail(r.id)
      save({ cur: i, curId: r.id, sel: r.node ? r.id : st.sel, click: { id: r.id, t: Date.now() } })
    })
  }
  function treeKeys(rows: NonNullable<Scene['rows']>, cur: number, top: number) {
    const move = (to: number) => { const c = clamp(to, 0, Math.max(0, rows.length - 1)); save({ cur: c, top }) }
    modeKey = k => {
      const r = rows[cur]
      if (k.key === 'down' || k.key === 'j' || k.key === 's') move(cur + 1)
      else if (k.key === 'up' || k.key === 'k' || k.key === 'a') move(cur - 1)
      else if (k.key === 'pagedown') move(cur + bodyRows - 1)
      else if (k.key === 'pageup') move(cur - bodyRows + 1)
      else if (k.key === 'home') move(0)
      else if (k.key === 'end') move(rows.length - 1)
      else if (!r) return
      else if (r.mo && (k.key === 'return' || k.key === 'right')) act('ui', { search: '' })
      else if (k.key === 'right' || k.key === 'l' || k.key === 'return' || k.key === 'o') { if (r.fo && !r.o) act('ui', { open: r.i }); else if (r.fo && k.key !== 'right' && k.key !== 'l') act('ui', { close: r.i }); else if (r.fo) move(cur + 1) }
      else if (k.key === 'left' || k.key === 'h') { if (r.fo && r.o) act('ui', { close: r.i }); else for (let i = cur - 1; i >= 0; i--) if (rows[i]!.d < r.d) { move(i); break } }
      else if (k.key === 'q' && !r.mo) act('ask', { id: r.i, label: r.l ?? r.i })
      else if (k.key === 'w' && !r.mo) act('reveal', { id: r.i })
      else return false
      return true
    }
    surface.onPointer(p => {
      if (p.type !== 'up' || p.y < bodyY || p.y >= bodyY + bodyRows) { if (p.type === 'up') clickChrome(p); return }
      const i = top + p.y - bodyY, r = rows[i]
      if (!r) return
      const dbl = st.click && st.click.id === r.i && Date.now() - st.click.t < 450
      if ((dbl || i === cur) && r.fo) act('ui', r.o ? { close: r.i } : { open: r.i })
      save({ cur: i, click: { id: r.i, t: Date.now() } })
    })
  }
  function clickChrome(p: ClientPointerEvent) {
    /* la línea de tiempo: clic para saltar */
    if (TL && tl && p.y >= bodyY + bodyRows && p.y < bodyY + bodyRows + tlRows) {
      const w = cols - 18
      if (p.x < 9) { save({ tl: { ...tl, on: !tl.on, last: now() } }); return }
      const i = clamp(Math.round(((p.x - 9) / Math.max(1, w - 1)) * (TL.labels.length - 1)), 0, TL.labels.length - 1)
      save({ tl: { ...tl, i, on: false } })
      return
    }
    if (tourSteps && p.y >= bodyY + bodyRows + tlRows && p.y < bodyY + bodyRows + tlRows + tourRows) stepTo(p.x <= 1 ? Math.max(0, stepIdx - 1) : stepIdx + 1)
  }
  if (mode === 'graph' || mode === 'seq') {
    const hitAt = (x: number, y: number) => (y >= bodyY && y < bodyY + bodyRows && x >= 0 && x < cols ? frameG.hit[frameG.idx(x, y)] : undefined)
    modeKey = k => {
      const c = k.key
      if (mode === 'seq') {
        const dy = Math.max(2, Math.round(bodyRows / 4)), dx = Math.max(4, Math.round(mainW / 6))
        if (c === 'down' || c === 'j') save({ sy: seqSy + dy })
        else if (c === 'up' || c === 'k') save({ sy: Math.max(0, seqSy - dy) })
        else if (c === 'right' || c === 'l') save({ sx: st.sx + dx })
        else if (c === 'left' || c === 'h') save({ sx: Math.max(0, st.sx - dx) })
        else if (c === 'home' || c === '0') save({ sx: 0, sy: 0 })
        else if ((c === 's' || c === 'a') && order.length) { const i = st.sel ? order.indexOf(st.sel) : -1; const id = order[(i + (c === 'a' ? -1 : 1) + order.length) % order.length]!; save({ sel: id, sy: seqFollow(id) ?? seqSy }) }
        else return false
        return true
      }
      if (!cam) return false
      const dx = Math.max(4, Math.round(mainW / 8)), dy = Math.max(2, Math.round(bodyRows / 6))
      if (c === 'left' || c === 'h') save({ cam: { ...cam, ox: cam.ox - dx } })
      else if (c === 'right' || c === 'l') save({ cam: { ...cam, ox: cam.ox + dx } })
      else if (c === 'up' || c === 'k') save({ cam: { ...cam, oy: cam.oy - dy } })
      else if (c === 'down' || c === 'j') save({ cam: { ...cam, oy: cam.oy + dy } })
      else if (c === 'z') zoom(0.8)
      else if (c === 'x') zoom(1.25)
      else if ((c === 's' || c === 'a') && order.length) {
        const leaves = order.filter(id => !nodesById.get(id)?.g || !nodesById.get(id)?.o)
        const i = st.sel ? leaves.indexOf(st.sel) : -1
        const id = leaves[(i + (c === 'a' ? -1 : 1) + leaves.length) % leaves.length]!
        selectNode(id, reveal(id))
      } else if ((c === 'return' || c === 'o') && st.sel) { const n = nodesById.get(st.sel); if (n?.k || n?.g) act('ui', n.o ? { close: n.i } : { open: n.i }); else msg('Esta pieza no tiene nada dentro') }
      else if (c === 'o') msg('Elige antes una pieza (s / a)')
      else return false
      return true
    }
    surface.onPointer(p => {
      if (p.type !== 'move' || p.button) lastInput.set(surface, Date.now())
      if (p.type === 'move' && !p.button) {
        const id = hitAt(p.x, p.y)
        const hv = id && nodesById.has(id) ? id : null
        if (hv !== st.hover) save({ hover: hv })
        return
      }
      if (p.type === 'leave') { if (st.hover) save({ hover: null }); return }
      if (p.type === 'down') { save({ drag: { x: p.x, y: p.y, ox: mode === 'seq' ? st.sx : cam?.ox ?? 0, oy: mode === 'seq' ? seqSy : cam?.oy ?? 0, moved: false } }); return }
      if (p.type === 'move' && st.drag && p.button) {
        const ddx = p.x - st.drag.x, ddy = p.y - st.drag.y
        if (!ddx && !ddy) return
        if (mode === 'seq') save({ sx: Math.max(0, st.drag.ox - ddx), sy: Math.max(0, st.drag.oy - ddy), drag: { ...st.drag, moved: true } })
        else if (cam) save({ cam: { ...cam, ox: st.drag.ox - ddx, oy: st.drag.oy - ddy }, drag: { ...st.drag, moved: true } })
        return
      }
      if (p.type === 'up') {
        if (st.drag?.moved) { save({ drag: null }); return }
        if (p.y < bodyY || p.y >= bodyY + bodyRows) { save({ drag: null }); clickChrome(p); return }
        /* clic derecho (o alt+clic): preguntar a Claude por lo que hay debajo, como Alt+clic en el navegador */
        if (p.button === 'right' || p.alt) { const id = hitAt(p.x, p.y); if (id) act('ask', { id, label: nodesById.get(id)?.l ?? id }); save({ drag: null }); return }
        if (side && p.x > mainW) {
          const id = hitAt(p.x, p.y)
          if (id && nodesById.has(id)) selectNode(id, { drag: null, ...reveal(id) })
          else save({ drag: null })
          return
        }
        const id = hitAt(p.x, p.y)
        if (!id) { save({ sel: null, drag: null, trace: null }); return }
        const n = nodesById.get(id)
        const dbl = st.click && st.click.id === id && Date.now() - st.click.t < 450
        if (dbl && n && (n.k || n.g)) act('ui', n.o ? { close: id } : { open: id })
        if (n || mode === 'seq') selectNode(id, { drag: null, click: { id, t: Date.now() } })
        else save({ drag: null })
      }
    })
  }

  /* ---- Claude pide presentar (guide present, /graphx present): se entra una vez por cada petición nueva; al montarse,
     solo si la petición acaba de llegar (si no, volver de la imagen al lienzo la repetiría) ---- */
  {
    const pr = props.present, prevP = lastPresent.get(surface)
    lastPresent.set(surface, pr?.n ?? 0)
    const fresh = pr && pr.n > 0 && (prevP !== undefined ? prevP !== pr.n : st0 === undefined && Date.now() - pr.at < 15_000)
    if (fresh && !st.present) { followOf.set(surface, true); save({ present: true, det: false, lt: Math.max(0, st.lt) }) }
  }

  /* ---- el teclado: uno solo para todas las vistas; y las órdenes de los botones del panel ---- */
  surface.onKey(dispatch)
  {
    /* al montarse, la orden vigente ya está hecha; cada `n` nuevo después, se aplica una vez */
    const n = props.cmd?.n ?? 0, prev = lastCmd.get(surface)
    if (prev === undefined) lastCmd.set(surface, n)
    else if (prev !== n && props.cmd) { lastCmd.set(surface, n); dispatch({ key: props.cmd.a }) }
  }

  /* ---- a elementos (o la rejilla tal cual, para la instantánea de texto) ---- */
  if ((surface as unknown as { grid?: boolean }).grid) return frameG as unknown as RenderElement
  const budget = { n: 0 }
  const els = toEls(T, frameG, 0, height, 'r', budget)
  return <Box flexDirection="column" height={height}>{els}</Box>
}

export default Canvas
