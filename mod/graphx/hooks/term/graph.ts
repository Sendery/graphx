/* El grafo de GraphX dibujado en celdas: la misma geometría que el motor (ELK y los layouts propios), vista
 * por una cámara (px por columna y por fila), con lo que el motor pinta en SVG traducido a caracteres:
 *
 *   carriles      marcos de fondo con su cabecera, fija al borde de arriba al desplazarse
 *   decoración    los ejes, marcas y fechas de los layouts propios (gantt, timeline, journey, git, sankey…)
 *   contenedores  marco con su título y su recuento; discontinuo o punteado si lo pide `frame`
 *   aristas       ortogonales con esquinas y cruces resueltos; finas, gruesas (hero), discontinuas (event,
 *                 queue, async), apagadas (muted); puntas de los dos extremos, etiquetas y cardinalidades;
 *                 curvas en braille (mindmap); grosor por `weight` (sankey)
 *   piezas        tarjeta, ficha de una línea o punto según el tamaño; cada familia de forma con su contorno
 *                 (rombo, hexágono, cilindro, estadio, documento, nube, tabla, clase, C4, barra de gantt,
 *                 commit, KPI, gauge, donut…) y los datos de los efectos: calor, serie, progreso, alerta,
 *                 equipo, estado, delta, notas, enlaces
 *   efectos       partículas por caudal, marcha de las aristas, halos que laten, ondas, impacto, flujo, foco,
 *                 cascada de entrada, brillo, degradado, retícula y zoom semántico (el `Look`)
 *
 * Todo depende de `Look`: lo que está seleccionado, iluminado o apagado y el reloj de las animaciones. */
import type { SDeco, SEdge, SLane, SNode, Scene } from '../../types'
import { BOLD, DIM, Grid, INV, ITALIC, UNDER, type LineStyle } from './grid'
import { fit, strWidth, type Glyphs } from './glyphs'
import { inkOn, type Painter } from './paint'
import { bars, donutCells, fmtNum, spark } from './charts'

export type Cam = { cw: number; ch: number; ox: number; oy: number }
export type Look = {
  P: Painter
  G: Glyphs
  t: number
  motion: boolean
  sel?: string | null
  hover?: string | null
  /* piezas y aristas iluminadas (recorrido, trazado, onda) y si el resto se apaga */
  lit?: Set<string> | null
  litE?: Set<string> | null
  spot?: boolean
  /* radio de impacto: pieza → salto */
  blast?: Map<string, number> | null
  /* ▶ flujo: pieza → instante (ms) en que la alcanza la onda */
  flow?: Map<string, number> | null
  flowT?: number
  /* aristas que «marchan» (las de la pieza bajo el ratón) */
  march?: Set<string> | null
  /* cascada de entrada: pieza → instante en que aparece */
  enter?: Map<string, number> | null
  /* datos del fotograma de la línea de tiempo, encima de los de la escena */
  data?: Record<string, Record<string, unknown>> | null
  edata?: Record<string, number> | null
  fx: FxFlags
  owners?: Scene['owners']
  ownerColor?: boolean
  ownerOn?: Set<string> | null
  canvasBg?: string
  /* pulsos de eventos de la línea de tiempo: pieza → instante */
  pulse?: Map<string, number> | null
}
export type FxFlags = {
  particles: false | 'data' | true | 'all'
  heat: boolean; spark: boolean; progress: boolean; alerts: boolean; glow: boolean; gradient: boolean; grid: boolean; lod: boolean
  spotlight: boolean; hoverFlow: boolean; sketch: boolean; autoColor: false | string; waves: boolean; entrance: boolean; owners: boolean
}
export type Box = { x0: number; y0: number; x1: number; y1: number }
export type Drawn = { grid: Grid; boxes: Map<string, Box>; order: string[]; labels: Map<string, Box> }

const TONE: Record<string, string> = { crit: 'del', danger: 'del', warn: 'warn', info: 'accent', ok: 'add', good: 'add', tip: 'p2', note: 'muted' }
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/* ---------- cámara ---------- */
export const ASPECT = 2.05
export function chFor(nodes: SNode[], cw: number) {
  const leaves = nodes.filter(n => !n.g)
  const minH = leaves.length ? Math.min(...leaves.map(n => n.h)) : 64
  return Math.min(cw * ASPECT, Math.max(minH / 3, cw * 0.9))
}
export function fitCam(s: Scene, cols: number, rows: number): Cam {
  const b = s.bbox ?? { x: 0, y: 0, w: 1, h: 1 }
  const nodes = s.nodes ?? []
  let cw = Math.max(3, b.w / Math.max(8, cols - 2))
  let ch = chFor(nodes, cw)
  if (b.h / ch > rows - 1) { ch = b.h / Math.max(3, rows - 1); cw = Math.max(cw, ch / ASPECT) }
  const ox = b.x / cw - Math.max(0, (cols - b.w / cw) / 2)
  const oy = b.y / ch - Math.max(0, (rows - b.h / ch) / 2)
  return { cw, ch, ox, oy }
}
export function boxOf(n: { x: number; y: number; w: number; h: number }, v: Cam): Box {
  const x0 = Math.round(n.x / v.cw - v.ox), y0 = Math.round(n.y / v.ch - v.oy)
  let x1 = Math.round((n.x + n.w) / v.cw - v.ox) - 1, y1 = Math.round((n.y + n.h) / v.ch - v.oy) - 1
  if (x1 < x0) x1 = x0
  if (y1 < y0) y1 = y0
  return { x0, y0, x1, y1 }
}
/* un punto cae en la celda que lo contiene (las cajas redondean sus bordes: el centro de una pieza queda dentro) */
const cell = (p: [number, number], v: Cam): [number, number] => [Math.floor(p[0] / v.cw - v.ox + 1e-6), Math.floor(p[1] / v.ch - v.oy + 1e-6)]

/* ---------- colores de una pieza ---------- */
function ownerColor(L: Look, id?: string) {
  if (!id || !L.owners) return undefined
  const o = L.owners[id]
  return o?.color ?? undefined
}
export function nodeColor(n: SNode, L: Look, auto?: Map<string, string>): string | undefined {
  const P = L.P
  if (L.ownerColor && n.ow) return ownerColor(L, n.ow) ?? P.tok('accent')
  if (n.dl === 'added') return P.tok('add')
  if (n.dl === 'modified') return P.tok('mod')
  if (n.dl === 'removed') return P.tok('del')
  return P.dual(n.c) ?? P.dual(n.stc) ?? auto?.get(n.i)
}
function dataOf(n: SNode, L: Look): SNode {
  const d = L.data?.[n.i]
  return d ? ({ ...n, ...d } as SNode) : n
}

/* ---------- contornos por familia de forma ---------- */
type Outline = { tl: string; t: string; tr: string; l: string; r: string; bl: string; b: string; br: string; lm?: string; rm?: string; fillBg?: boolean }
function outlineFor(sh: string | undefined, kd: string | undefined, G: Glyphs, heavy: boolean, sketch: boolean): Outline {
  const base = heavy ? G.box.heavy : sketch ? G.box.dashed : G.box.round
  const sharp = heavy ? G.box.heavy : G.box.sharp
  if (G.name === 'ascii') {
    const a = { ...base }
    if (sh === 'decision' || sh === 'hexagon' || sh === 'choice') return { ...a, tl: '/', tr: '\\', bl: '\\', br: '/', lm: '<', rm: '>' }
    if (sh === 'io') return { ...a, tl: '/', tr: '/', bl: '/', br: '/', l: '/', r: '/' }
    if (sh === 'io-l') return { ...a, tl: '\\', tr: '\\', bl: '\\', br: '\\', l: '\\', r: '\\' }
    if (sh === 'terminal' || sh === 'rounded' || sh === 'circle' || sh === 'dcircle' || sh === 'cloud') return { ...a, l: '(', r: ')', tl: '(', tr: ')', bl: '(', br: ')' }
    return a
  }
  switch (sh) {
    case 'rect': case 'c4': case 'c4-db': case 'c4-queue': case 'card': case 'table': case 'class': case 'requirement': case 'ticket': return { ...sharp }
    case 'terminal': case 'rounded': return { ...base, l: '(', r: ')', tl: '╭', tr: '╮' }
    case 'subroutine': return { ...sharp, l: '║', r: '║', tl: '╓', tr: '╖', bl: '╙', br: '╜' }
    case 'datastore': case 'c4-db': return { ...base, t: '─', b: '─', tl: '╭', tr: '╮', bl: '╰', br: '╯' }
    case 'cylinder-h': return { ...base, l: '(', r: '◗' }
    case 'circle': case 'dcircle': case 'start': case 'end': return { ...base, l: '(', r: ')', tl: '╭', tr: '╮', bl: '╰', br: '╯' }
    case 'hexagon': return { ...base, tl: '╱', tr: '╲', bl: '╲', br: '╱', lm: '❮', rm: '❯' }
    case 'decision': case 'choice': return { ...base, tl: '╱', tr: '╲', bl: '╲', br: '╱', lm: '◀', rm: '▶', t: '─', b: '─' }
    case 'io': return { ...sharp, tl: '╱', tr: '╱', bl: '╱', br: '╱', l: '╱', r: '╱' }
    case 'io-l': return { ...sharp, tl: '╲', tr: '╲', bl: '╲', br: '╲', l: '╲', r: '╲' }
    case 'trapezoid': return { ...sharp, tl: '╱', tr: '╲' }
    case 'trapezoid-t': return { ...sharp, bl: '╲', br: '╱' }
    case 'document': return { ...sharp, b: '~', bl: '╰', br: '╯' }
    case 'cloud': return { ...base, t: '⁀', b: '‿', l: '(', r: ')' }
    case 'flag': case 'arrow-right': return { ...sharp, r: '▷', tr: '┐', br: '┘', rm: '▶' }
    case 'arrow-left': return { ...sharp, l: '◁', lm: '◀' }
    case 'arrow-up': return { ...sharp, t: '△' }
    case 'arrow-down': return { ...sharp, b: '▽' }
    case 'bang': return { ...sharp, t: '⁂', b: '⁂', l: '✶', r: '✶', tl: '✸', tr: '✸', bl: '✸', br: '✸' }
    case 'triangle': return { ...sharp, tl: '╱', tr: '╲', t: '─' }
    case 'triangle-down': return { ...sharp, bl: '╲', br: '╱' }
    case 'hourglass': return { ...sharp, l: '⧗', r: '⧗' }
    case 'delay': return { ...sharp, r: ')', tr: '╮', br: '╯' }
    case 'note': return { ...sharp, tr: '◹' }
    case 'text': return { tl: ' ', t: ' ', tr: ' ', l: ' ', r: ' ', bl: ' ', b: ' ', br: ' ' }
    case 'person': case 'actor': return { ...base }
    case 'tile': return { ...base }
    default: return kd === 'note' ? { ...sharp, tr: '◹' } : { ...base }
  }
}
/* las formas que son una marca (un punto, un commit) y no una caja */
const MARKS: Record<string, [string, string]> = {
  start: ['●', 'o'], end: ['◉', '@'], junction: ['•', '*'], choice: ['◇', '<>'], fork: ['━', '='], commit: ['●', 'o'], 'commit-merge': ['◉', '@'],
  'commit-highlight': ['◆', '#'], 'commit-reverse': ['⊗', 'x'], circle: ['○', 'o'], dcircle: ['◎', '@'],
}

/* ---------- el dibujo ---------- */
export function drawGraph(s: Scene, cols: number, rows: number, v: Cam, L: Look): Drawn {
  const G = L.G, P = L.P
  const g = new Grid(cols, rows, G)
  const nodes = s.nodes ?? [], edges = s.edges ?? [], lanes = s.lanes ?? []
  const boxes = new Map<string, Box>(), labels = new Map<string, Box>()
  const zoomedOut = L.fx.lod && v.cw > 15
  const muted = P.c(P.tok('muted')), faint = P.c(P.tok('faint')), accent = P.c(P.tok('accent'))
  const ink = P.c(P.tok('ink'))
  const lineC = P.c(P.tok('neu', P.tok('line')))
  const now = L.t
  const blink = (period: number) => Math.floor(now / period) % 2 === 0
  const autoColors = autoPalette(s, L)
  const visibleAt = (id: string) => { const t0 = L.enter?.get(id); return t0 == null || now >= t0 }
  const isDim = (n: { i: string; dm?: 1; ow?: string; la?: string }) => {
    if (L.blast && !L.blast.has(n.i)) return true
    if (L.flow && L.flowT != null) { const at = L.flow.get(n.i); if (at == null || at > L.flowT) return true }
    if (L.ownerOn && L.ownerOn.size) { const ow = n.ow ?? ownerOfLane(s, n.la); if (!ow || !L.ownerOn.has(ow)) return !(L.ownerOn.has('∅') && !ow) }
    if (L.lit && L.lit.size) return !L.lit.has(n.i)
    return !!n.dm
  }

  if (L.canvasBg) g.fill(0, 0, cols - 1, rows - 1, ' ', undefined, L.canvasBg)

  /* retícula viva: un punto cada pocas celdas, anclado al mundo */
  if (L.fx.grid && P.depth !== 'mono' && !zoomedOut) {
    const gc = P.c(P.mix(P.tok('canvas'), P.tok('faint'), 0.3))
    const sx = v.cw === 1 ? 8 : Math.max(4, Math.round(48 / v.cw)), sy = v.cw === 1 ? 4 : Math.max(2, Math.round(48 / v.ch))
    const offx = ((-Math.round(v.ox)) % sx + sx) % sx, offy = ((-Math.round(v.oy)) % sy + sy) % sy
    for (let y = offy; y < rows; y += sy) for (let x = offx; x < cols; x += sx) g.set(x, y, '·', gc, L.canvasBg)
  }

  /* carriles */
  const laneBox = new Map<string, Box>()
  lanes.forEach((ln, i) => {
    const b = boxOf(ln, v)
    laneBox.set(ln.i, b)
    const col = P.c(P.dual(ln.c)) ?? faint
    if (P.depth !== 'mono' && P.depth !== '16' && L.canvasBg === undefined && i % 2 === 1) {
      /* bandas alternas apenas teñidas, como en el motor */
    }
    const sepC = P.c(P.tok('lane-line', P.tok('line')))
    if (ln.dn) { if (i > 0) for (let x = Math.max(0, b.x0); x <= Math.min(cols - 1, b.x1); x++) g.set(x, b.y0, G.box.dashed.t, sepC) }
    else if (i > 0) for (let y = Math.max(0, b.y0); y <= Math.min(rows - 1, b.y1); y++) g.set(b.x0, y, G.box.dashed.l, sepC)
    const head = `${String(i + 1).padStart(2, '0')} ${ln.l.toUpperCase()}`
    if (ln.dn) {
      const y = clamp(b.y0 + 1, 0, rows - 1)
      if (b.y1 >= 0 && b.y0 < rows) { g.text(Math.max(0, b.x0 + 1), y, fit(head, Math.max(4, 22)), col, L.canvasBg, BOLD) }
    } else {
      /* la cabecera queda fija arriba aunque el carril empiece más arriba */
      const y = clamp(b.y0, 0, rows - 1)
      const room = Math.min(b.x1, cols - 1) - Math.max(b.x0, 0) - 2
      if (room > 3 && b.x1 >= 0 && b.x0 < cols) {
        const x = Math.max(b.x0 + 2, 1)
        g.text(x, y, fit(head, room), col, L.canvasBg, BOLD)
        /* el subtítulo, solo si su fila está libre de piezas (en fichas el carril no le deja sitio) */
        const subFree = !nodes.some(n => !n.ln && !n.g && n.la === ln.i && boxOf(n, v).y0 <= y + 1 && boxOf(n, v).y1 >= y + 1)
        if (ln.s && y + 1 < rows && room > 8 && subFree) g.text(x, y + 1, fit(ln.s, room), faint, L.canvasBg)
      }
    }
  })

  /* decoración de los layouts propios */
  /* los textos de «hoy» primero: un rótulo del eje que choque con otro ya puesto se omite */
  const isToday = (d: SDeco) => d.t === 't' && /today|hoy|now/.test(d.c ?? '')
  const decoText = new Uint8Array(cols * rows)
  for (const d of [...(s.deco ?? [])].sort((a, b) => +isToday(b) - +isToday(a))) drawDeco(g, d, v, L, decoText)

  /* contenedores abiertos (de fuera adentro) */
  const groups = nodes.filter(n => n.g && !n.ln).sort((a, b) => a.d - b.d)
  for (const n0 of groups) {
    if (!visibleAt(n0.i)) continue
    const n = dataOf(n0, L)
    const b = boxOf(n, v); boxes.set(n.i, b)
    const sel = L.sel === n.i
    const dim = isDim(n)
    let col = P.c(nodeColor(n, L, autoColors)) ?? P.c(P.tok('group-line'))
    if (L.blast?.has(n.i)) col = P.c(blastColor(P, L.blast.get(n.i)!))
    if (L.fx.heat && n.hv != null) col = P.c(P.heat(n.hv)) ?? col
    if (sel || (L.lit?.has(n.i))) col = accent
    const style = sel ? G.box.heavy : n.fr === 'dashed' ? G.box.dashed : n.fr === 'dotted' ? G.box.dotted : G.box.group
    const a = dim ? DIM : 0
    if (b.y1 - b.y0 >= 1 && b.x1 - b.x0 >= 3) {
      for (let x = b.x0 + 1; x < b.x1; x++) { g.set(x, b.y0, style.t, col, L.canvasBg, a); g.set(x, b.y1, style.b, col, L.canvasBg, a) }
      for (let y = b.y0 + 1; y < b.y1; y++) { g.set(b.x0, y, style.l, col, L.canvasBg, a); g.set(b.x1, y, style.r, col, L.canvasBg, a) }
      g.set(b.x0, b.y0, style.tl, col, L.canvasBg, a); g.set(b.x1, b.y0, style.tr, col, L.canvasBg, a); g.set(b.x0, b.y1, style.bl, col, L.canvasBg, a); g.set(b.x1, b.y1, style.br, col, L.canvasBg, a)
      const title = ` ${G.caretD} ${n.l}${n.k ? ` · ${n.k}` : ''} `
      const tx = b.x0 + 2
      const used = g.text(tx, b.y0, fit(title, Math.max(0, b.x1 - b.x0 - 4)), sel ? accent : col, L.canvasBg, BOLD | a)
      g.markRect(tx, b.y0, tx + used - 1, b.y0, n.i)
      /* una arista que cruza el borde no se come el título */
      if (used > 0) g.protect(tx, b.y0, tx + used - 1, b.y0)
      if (zoomedOut && b.y1 - b.y0 > 3 && b.x1 - b.x0 > 8) {
        /* zoom semántico: el nombre del contenedor, grande en medio */
        const big = n.l.toUpperCase()
        g.text(Math.round((b.x0 + b.x1 - Math.min(strWidth(big), b.x1 - b.x0 - 2)) / 2), Math.round((b.y0 + b.y1) / 2), fit(big, b.x1 - b.x0 - 2), col, L.canvasBg, BOLD | a)
      }
      if (n.hv != null && L.fx.heat) heatBadge(g, n, b, L, true)
      if (n.ow && L.fx.owners) ownerBadge(g, n.ow, b, L)
      if (n.al && L.fx.alerts) alertMark(g, n, b, L)
    }
  }

  /* sankey: cada arista es una cinta del grosor de su valor, del color de su origen */
  const ribbons = s.mode === 'sankey'
  if (ribbons) {
    const byId = new Map(nodes.map(n => [n.i, n]))
    for (const e of edges) {
      const src = byId.get(e.a), wt = e.wt ?? 0
      if (!src || !wt || e.p.length < 2) continue
      const pxPerUnit = src.h / Math.max(1e-9, src.v ?? wt)
      const th = Math.max(1, Math.round((wt * pxPerUnit) / v.ch))
      const c0 = P.dual(e.c) ?? P.dual(src.c) ?? P.tok('accent')
      const band = P.depth === 'mono' || P.depth === '16' ? undefined : P.c(P.mix(P.tok('canvas'), c0, L.sel && (e.a === L.sel || e.b === L.sel) ? 0.75 : 0.42))
      const pts = e.p.map(p => [p[0] / v.cw - v.ox, p[1] / v.ch - v.oy] as [number, number])
      const xa = Math.ceil(pts[0]![0]), xb = Math.floor(pts[pts.length - 1]![0])
      for (let x = xa; x <= xb; x++) {
        let k = 1; while (k < pts.length - 1 && pts[k]![0] < x) k++
        const [x0, y0] = pts[k - 1]!, [x1, y1] = pts[k]!
        const yc = x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
        for (let y = Math.round(yc - th / 2); y < Math.round(yc - th / 2) + th; y++) {
          if (!g.in(x, y)) continue
          if (band) g.set(x, y, ' ', undefined, band); else g.set(x, y, G.shade[0]!, P.c(c0))
          g.mark(x, y, e.i)
        }
      }
    }
  }

  /* aristas */
  const heads: { x: number; y: number; c: string; fg?: string; a: number }[] = []
  const maxRate = Math.max(1, ...edges.map(e => edgeRate(e, L)))
  const paths = new Map<string, [number, number][]>()
  for (const e0 of edges) {
    const e = e0
    if (ribbons && e.wt) continue
    if (!visibleAt(e.a) || !visibleAt(e.b)) continue
    const lit = L.litE?.has(e.i) || (L.sel != null && (e.a === L.sel || e.b === L.sel)) || !!e.lt
    const dim = (L.lit && L.lit.size && !lit) || (L.blast && !(L.blast.has(e.a) && L.blast.has(e.b))) || (L.flow && L.flowT != null && !((L.flow.get(e.a) ?? Infinity) <= L.flowT && (L.flow.get(e.b) ?? Infinity) <= L.flowT)) || !!e.dm
    const style: LineStyle = e.he || (lit && L.fx.glow) ? 'heavy' : e.ds ? 'dashed' : (e.wt ?? 0) > 0 && maxWeight(edges) > 0 && (e.wt ?? 0) / maxWeight(edges) > 0.5 ? 'heavy' : 'thin'
    let col = P.c(P.dual(e.c)) ?? (e.dl === 'added' ? P.c(P.tok('add')) : e.dl === 'removed' ? P.c(P.tok('del')) : e.dl === 'modified' ? P.c(P.tok('mod')) : lineC)
    if (lit) col = accent
    if (L.blast && L.blast.has(e.a) && L.blast.has(e.b)) col = P.c(blastColor(P, Math.max(L.blast.get(e.a)!, L.blast.get(e.b)!)))
    const a = dim ? DIM : e.mu ? DIM : 0
    const pri = lit ? 3 : e.he ? 2 : dim ? 0 : 1
    const pts = e.p.map(p => cell(p, v)).filter((p, i, arr) => i === 0 || p[0] !== arr[i - 1]![0] || p[1] !== arr[i - 1]![1])
    if (pts.length < 2) continue
    const path: [number, number][] = []
    const curvy = !!e.cv || pts.some((p, i) => i > 0 && p[0] !== pts[i - 1]![0] && p[1] !== pts[i - 1]![1] && Math.abs(p[0] - pts[i - 1]![0]) > 1 && Math.abs(p[1] - pts[i - 1]![1]) > 1)
    if (curvy && L.G.name === 'unicode' && e.cv) {
      for (let i = 1; i < e.p.length; i++) {
        const [ax, ay] = e.p[i - 1]!, [bx, by] = e.p[i]!
        g.dline((ax / v.cw - v.ox) * 2 + 1, (ay / v.ch - v.oy) * 4 + 2, (bx / v.cw - v.ox) * 2 + 1, (by / v.ch - v.oy) * 4 + 2, col)
      }
      for (const p of pts) path.push(p)
    } else {
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1]!, [x1, y1] = pts[i]!
        /* en diagonal: primero en el sentido del tramo siguiente, para que la esquina caiga donde toca */
        const nxt = pts[i + 1]
        const vfirst = nxt ? nxt[0] === x1 && nxt[1] !== y1 ? false : nxt[1] === y1 : Math.abs(y1 - y0) > Math.abs(x1 - x0)
        g.seg(x0, y0, x1, y1, style, col, pri, a, vfirst)
        walk(path, x0, y0, x1, y1, vfirst)
      }
    }
    paths.set(e.i, path)
    for (const [x, y] of path) g.mark(x, y, e.i)
    /* puntas: en la celda de antes del borde */
    const end = (p: [number, number], q: [number, number], kind: string | undefined) => {
      if (!kind || kind === 'none') return
      const dy = Math.sign(p[1] - q[1]), dx = dy ? 0 : Math.sign(p[0] - q[0])
      const glyph = kind === 'arrow' || kind === 'triangle' || kind === 'open'
        ? (kind === 'open' || kind === 'triangle' ? G.headOpen : G.head)[dy > 0 ? 'd' : dy < 0 ? 'u' : dx > 0 ? 'r' : 'l']
        : (G.ends[kind] ?? G.head.r)
      heads.push({ x: p[0] - dx, y: p[1] - dy, c: [...glyph][0]!, fg: col, a })
    }
    if (path.length >= 2) {
      end(path[path.length - 1]!, path[Math.max(0, path.length - 2)]!, e.hd)
      if (e.tl) end(path[0]!, path[1]!, e.tl)
    }
  }
  g.flushLines()
  g.flushDots()
  /* degradado: cada arista va del color de su origen al de su destino (con color verdadero o 256) */
  if (L.fx.gradient && (P.depth === 'truecolor' || P.depth === '256')) {
    const byId = new Map(nodes.map(n => [n.i, n]))
    for (const e of edges) {
      const path = paths.get(e.i)
      if (!path || path.length < 2 || L.litE?.has(e.i) || L.blast) continue
      const a = byId.get(e.a), b = byId.get(e.b)
      const ca = (a && (nodeColor(a, L, autoColors) ?? (L.fx.heat && a.hv != null ? P.heat(a.hv) : undefined))) ?? P.tok('accent')
      const cb = (b && (nodeColor(b, L, autoColors) ?? (L.fx.heat && b.hv != null ? P.heat(b.hv) : undefined))) ?? P.tok('accent')
      path.forEach(([x, y], k) => { if (g.in(x, y) && !g.solid[g.idx(x, y)] && g.ch[g.idx(x, y)] !== ' ') g.tint(x, y, P.c(P.mix(ca, cb, k / Math.max(1, path.length - 1)))) })
    }
  }
  for (const h of heads) g.set(h.x, h.y, h.c, h.fg, L.canvasBg, h.a)

  /* partículas y marcha: encima de las líneas, debajo de las etiquetas y las piezas */
  if (L.motion) drawMotion(g, edges, paths, L, maxRate)

  /* piezas */
  const leaves = nodes.filter(n => !n.g)
  leaves.forEach((n0, idx) => {
    if (!visibleAt(n0.i)) return
    const n = dataOf(n0, L)
    const b = boxOf(n, v)
    boxes.set(n.i, b)
    if (b.x1 < 0 || b.y1 < 0 || b.x0 >= cols || b.y0 >= rows) return
    drawNode(g, n, b, L, s, autoColors, isDim(n), zoomedOut, idx)
  })
  drawMarkLabels(g)


  /* etiquetas de las aristas (después de las piezas: nunca las pisan): en celdas, sobre su tramo horizontal más largo (──etiqueta──▶); si no, donde dijo ELK */
  if (!zoomedOut) for (const e of edges) {
    if (!e.l) continue
    if (!visibleAt(e.a) || !visibleAt(e.b)) continue
    const lit = L.litE?.has(e.i) || (L.sel != null && (e.a === L.sel || e.b === L.sel))
    const t = ` ${fit(e.l, 28)}${e.n && e.n > 1 ? ` ×${e.n}` : ''} `
    let cx: number, cy: number
    const path = paths.get(e.i)
    let best: [number, number, number] | null = null
    if (path && v.cw === 1) {
      let run = 0
      for (let i = 1; i <= path.length; i++) {
        const same = i < path.length && path[i]![1] === path[i - 1]![1]
        if (same) run++
        else { if (run > 0 && (!best || run > best[2])) best = [i - 1 - run, path[i - 1]![1], run]; run = 0 }
      }
    }
    /* sin tramo horizontal donde quepa: junto al tramo vertical más largo, a su derecha */
    let vbest: [number, number, number] | null = null
    if (path && v.cw === 1 && !(best && best[2] >= strWidth(t) + 2)) {
      let run = 0
      for (let i = 1; i <= path.length; i++) {
        const same = i < path.length && path[i]![0] === path[i - 1]![0]
        if (same) run++
        else { if (run > 0 && (!vbest || run > vbest[2])) vbest = [i - 1 - run, path[i - 1]![0], run]; run = 0 }
      }
    }
    let side = false
    if (best && best[2] >= strWidth(t) + 2) { const a = path![best[0]]!, b = path![best[0] + best[2]]!; cx = Math.round((a[0] + b[0]) / 2); cy = best[1] }
    else if (vbest && vbest[2] >= 2) { const a = path![vbest[0]]!, b = path![vbest[0] + vbest[2]]!; cx = vbest[1] + 1 + Math.floor(strWidth(t) / 2); cy = Math.round((a[1] + b[1]) / 2); side = true }
    else if (e.lx != null && e.ly != null) [cx, cy] = cell([e.lx, e.ly], v)
    else continue
    /* al lado de un tramo vertical: sin relleno y solo sobre celdas libres (a la derecha, a la izquierda o una fila más abajo) */
    let txt = t, x = cx - Math.floor(strWidth(t) / 2)
    if (side && vbest) {
      txt = t.trim()
      const w = strWidth(txt), free = (x0: number, y: number) => { if (y < 0 || y >= rows) return false; for (let k = x0 - 1; k <= x0 + w; k++) { if (!g.in(k, y)) return false; if (g.ch[g.idx(k, y)] !== ' ' && g.ch[g.idx(k, y)] !== '·') return false } return true }
      const right = vbest[1] + 2, left = vbest[1] - 1 - w
      const spot = [[right, cy], [left, cy], [right, cy + 1], [left, cy + 1], [right, cy - 1]].find(([xx, yy]) => free(xx!, yy!))
      if (!spot) continue
      x = spot[0]!; cy = spot[1]!
    }
    if (cy < 0 || cy >= rows) continue
    /* sobre una pieza, no: si alguna celda es de pieza, la etiqueta se queda fuera */
    let clear = true
    for (let k = 0; k < strWidth(txt); k++) if (g.in(x + k, cy) && g.solid[g.idx(x + k, cy)]) { clear = false; break }
    if (!clear) continue
    g.text(x, cy, txt, lit ? accent : muted, L.canvasBg, lit ? BOLD : DIM)
    labels.set(e.i, { x0: x, y0: cy, x1: x + strWidth(txt) - 1, y1: cy })
    g.markRect(x, cy, x + strWidth(txt) - 1, cy, e.i)
  }

  const order = [...boxes.entries()].sort((a, b) => a[1].y0 - b[1].y0 || a[1].x0 - b[1].x0).map(([id]) => id)
  return { grid: g, boxes, order, labels }
}

const maxW = new WeakMap<SEdge[], number>()
function maxWeight(edges: SEdge[]) { let m = maxW.get(edges); if (m == null) { m = Math.max(0, ...edges.map(e => e.wt ?? 0)); maxW.set(edges, m) } return m }
export function edgeRate(e: SEdge, L: Look) {
  if (L.edata && e.ids) { let s = 0, any = false; for (const id of e.ids) { const r = L.edata[id]; if (typeof r === 'number') { s += r; any = true } } if (any) return s }
  return e.r ?? 0
}
function ownerOfLane(s: Scene, la?: string) { return la ? (s.lanes ?? []).find(l => l.i === la)?.ow : undefined }
export function blastColor(P: Painter, hop: number) { return hop <= 0 ? P.tok('del') : hop === 1 ? P.tok('del') : hop === 2 ? P.tok('warn') : P.tok('mod') }

/* las celdas que recorre una arista, en orden (para las partículas) */
function walk(out: [number, number][], x0: number, y0: number, x1: number, y1: number, vfirst: boolean) {
  const push = (x: number, y: number) => { const l = out[out.length - 1]; if (!l || l[0] !== x || l[1] !== y) out.push([x, y]) }
  const line = (ax: number, ay: number, bx: number, by: number) => {
    const sx = Math.sign(bx - ax), sy = Math.sign(by - ay)
    let x = ax, y = ay
    push(x, y)
    while (x !== bx) { x += sx; push(x, y) }
    while (y !== by) { y += sy; push(x, y) }
  }
  if (x0 === x1 || y0 === y1) line(x0, y0, x1, y1)
  else if (vfirst) { line(x0, y0, x0, y1); line(x0, y1, x1, y1) }
  else { line(x0, y0, x1, y0); line(x1, y0, x1, y1) }
}

/* paleta automática (fx.autoColor) para lo que no trae color */
function autoPalette(s: Scene, L: Look) {
  const m = new Map<string, string>()
  const mode = L.fx.autoColor
  if (!mode) return m
  const pal = [0, 1, 2, 3, 4, 5, 6, 7].map(i => L.P.tok('p' + i, L.P.tok('accent')))
  const nodes = s.nodes ?? []
  if (mode === 'lanes' || mode === 'auto') {
    const lanes = (s.lanes ?? []).map(l => l.i)
    if (lanes.length > 1) { for (const n of nodes) if (n.la) m.set(n.i, pal[lanes.indexOf(n.la) % pal.length]!); return m }
  }
  if (mode === 'groups' || mode === 'auto') {
    const tops = nodes.filter(n => n.k && n.d === Math.min(...nodes.filter(x => x.k).map(x => x.d))).map(n => n.i)
    if (tops.length > 1) {
      const par = s.model?.par ?? {}
      const top = (id: string): string | undefined => { let c: string | undefined = id; while (c && !tops.includes(c)) c = par[c]; return c }
      for (const n of nodes) { const t = top(n.i); if (t) m.set(n.i, pal[tops.indexOf(t) % pal.length]!) }
      return m
    }
  }
  const kinds = [...new Set(nodes.map(n => n.kd).filter(Boolean))] as string[]
  for (const n of nodes) if (n.kd) m.set(n.i, pal[kinds.indexOf(n.kd) % pal.length]!)
  return m
}

/* los nombres de las marcas, junto a su glifo y sin pisar nada: derecha, izquierda, debajo, encima */
type MarkLabel = { id: string; cx: number; cy: number; t: string; fg?: string; bg?: string; a: number }
const markLabels = new WeakMap<Grid, MarkLabel[]>()
function drawMarkLabels(g: Grid) {
  const list = markLabels.get(g)
  if (!list) return
  markLabels.delete(g)
  const free = (x0: number, y: number, w: number, id: string) => {
    for (let x = x0; x < x0 + w; x++) {
      if (!g.in(x, y)) return false
      const i = g.idx(x, y), c = g.ch[i]
      if ((c !== ' ' && c !== '·') || g.bits[i] || g.solid[i] || (g.hit[i] && g.hit[i] !== id)) return false
    }
    return true
  }
  for (const m of list) {
    const w = strWidth(m.t)
    const at = [[m.cx + 2, m.cy], [m.cx - 1 - w, m.cy], ...[1, -1].flatMap(dy => [[m.cx - Math.floor(w / 2), m.cy + dy], [m.cx, m.cy + dy], [m.cx - w + 1, m.cy + dy]])].find(([x, y]) => free(x!, y!, w, m.id))
    /* sin hueco: a la derecha, como antes, si al menos no pisa otra pieza */
    const [x, y] = at ?? [m.cx + 2, m.cy]
    if (!at && !free(x!, y!, Math.min(w, 1), m.id)) continue
    g.text(x!, y!, m.t, m.fg, m.bg, m.a)
    g.markRect(x!, y!, x! + w - 1, y!, m.id)
  }
}

/* ---------- una pieza ---------- */
function drawNode(g: Grid, n: SNode, b0: Box, L: Look, s: Scene, auto: Map<string, string>, dim: boolean, zoomedOut: boolean, idx: number) {
  const G = L.G, P = L.P
  let b = b0
  const sel = L.sel === n.i, hov = L.hover === n.i
  const lit = !!(L.lit?.has(n.i)) || !!n.lt
  const a0 = dim ? DIM : 0
  const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1
  const bg = L.canvasBg
  let col = nodeColor(n, L, auto)
  if (L.fx.heat && n.hv != null) col = P.heat(n.hv) ?? col
  if (L.blast?.has(n.i)) col = blastColor(P, L.blast.get(n.i)!)
  const pulse = L.pulse?.get(n.i)
  const pulsing = !!((L.fx.alerts && (n.al === 'crit' || n.al === 'warn' || n.pu)) || (pulse != null && L.t - pulse < 2400))
  const alertCol = n.al ? P.tok(TONE[n.al] ?? 'warn') : pulse != null ? P.tok('warn') : undefined
  let border = P.c(col) ?? P.c(P.tok('card-line'))
  if (pulsing && alertCol && (!L.motion || Math.floor(L.t / 520) % 2 === 0)) border = P.c(alertCol)
  if (sel || lit) border = P.c(P.tok('accent'))
  const heavy = sel || (L.fx.glow && (lit || hov)) || (L.blast?.get(n.i) === 0)
  const icon = G.icons[n.sh ?? ''] ?? G.icons[n.kd ?? ''] ?? ''
  const labelC = P.c(P.dual(n.tc)) ?? (sel ? P.c(P.tok('accent')) : P.c(P.tok('ink')))
  const fillC = P.dual(n.f)
  const cardBg = fillC ? P.c(fillC) : bg
  const cardInk = fillC ? P.c(inkOn(fillC)) : labelC

  /* una marca (inicio, fin, commit…): un glifo y su etiqueta al lado */
  const mark = MARKS[n.sh ?? '']
  if (mark && (bw <= 6 || bh <= 2 || /^commit|^(start|end|junction|choice|fork)$/.test(n.sh ?? ''))) {
    const cx = Math.round((b.x0 + b.x1) / 2), cy = Math.round((b.y0 + b.y1) / 2)
    let glyph = G.name === 'ascii' ? mark[1] : mark[0]
    if (n.hd && L.motion && Math.floor(L.t / 600) % 2 === 0) glyph = G.dotHollow
    if (n.sh === 'fork') { for (let x = b.x0; x <= b.x1; x++) g.set(x, cy, G.bar.heavy, border, bg, a0 | BOLD) }
    else g.text(cx - Math.floor(strWidth(glyph) / 2), cy, glyph, border ?? P.c(P.tok('ink')), bg, a0 | BOLD)
    g.markRect(b.x0, b.y0, b.x1, b.y1, n.i)
    /* su nombre, cuando ya estén todas las piezas: en el primer hueco libre a su alrededor */
    if (n.l && n.l.trim() && !/^(start|end|junction|fork)$/.test(n.sh ?? '')) {
      const later = markLabels.get(g) ?? []
      later.push({ id: n.i, cx, cy, t: fit(n.l + (n.b ? ` [${n.b}]` : ''), 18), fg: sel ? P.c(P.tok('accent')) : P.c(P.tok('muted')), bg, a: a0 | (sel ? BOLD : 0) })
      markLabels.set(g, later)
    }
    return
  }
  /* gráficos, barras y bloques: se dibujan rellenos (aunque sean estrechos: la barra de un sankey mide 1–2 columnas) */
  if (n.sh === 'gbar' || n.sh === 'bar' || n.sh === 'sbar' || n.sh === 'flowbar' || n.sh === 'block') { drawFilled(g, n, b, L, col, sel, dim); return }
  /* muy pequeña: un punto o una ficha de una línea */
  if (bw < 4 || zoomedOut && bh < 2) {
    g.set(b.x0, b.y0, G.dot, border, bg, a0)
    g.mark(b.x0, b.y0, n.i)
    return
  }
  if (bh < 3 || bw < 7) {
    const y = Math.round((b.y0 + b.y1) / 2)
    const chipBg = P.depth === 'mono' ? undefined : P.c(P.mix(P.tok('canvas'), col ?? P.tok('card-line'), sel ? 0.35 : 0.18))
    g.fill(b.x0, y, b.x1, y, ' ', undefined, chipBg, 0, true)
    g.set(b.x0, y, G.name === 'ascii' ? '[' : '▌', border, chipBg, a0)
    const txt = `${icon ? icon + ' ' : ''}${n.l}`
    /* si el nombre no cabe, la ficha crece hacia la derecha mientras haya celdas libres */
    let x1 = b.x1
    const need = b.x0 + 1 + strWidth(txt)
    while (x1 < need && x1 + 1 < g.w && g.ch[g.idx(x1 + 1, y)] === ' ' && !g.solid[g.idx(x1 + 1, y)] && !g.hit[g.idx(x1 + 1, y)]) x1++
    if (x1 > b.x1) { g.fill(b.x1 + 1, y, x1, y, ' ', undefined, chipBg, 0, true); g.markRect(b.x1 + 1, y, x1, y, n.i); b = { ...b, x1 } }
    g.text(b.x0 + 1, y, fit(txt, b.x1 - b.x0 - 1), cardInk, chipBg, a0 | (sel ? BOLD | UNDER : hov ? UNDER : 0) | (P.depth === 'mono' && sel ? INV : 0))
    if (bw > 2) g.set(b.x1, y, G.name === 'ascii' ? ']' : n.k && !n.o ? '+' : ' ', border, chipBg, a0)
    if (L.fx.heat && n.hv != null) { const hv = fmtNum(n.hv); if (b.x1 - b.x0 + 1 >= strWidth(txt) + strWidth(hv) + 3) g.text(b.x1 - strWidth(hv), y, hv, P.c(inkOn(P.heat(n.hv))), P.c(P.heat(n.hv)), BOLD); else g.set(b.x0, y, G.name === 'ascii' ? '[' : '▌', P.c(P.heat(n.hv)), chipBg, a0) }
    if (pulsing && alertCol) g.set(b.x0, y, G.tones[n.al === 'crit' ? 'crit' : 'warn'] ?? '!', P.c(alertCol), chipBg, BOLD)
    g.markRect(b.x0, b.y0, b.x1, b.y1, n.i)
    g.protect(b.x0, y, b.x1, y)
    return
  }


  /* una tarjeta: contorno, contenido y lo que lleva en los bordes */
  const o = outlineFor(n.sh, n.kd, G, heavy, L.fx.sketch)
  const a = a0 | (heavy ? BOLD : 0)
  g.fill(b.x0, b.y0, b.x1, b.y1, ' ', undefined, cardBg, 0, true)
  for (let x = b.x0 + 1; x < b.x1; x++) { g.set(x, b.y0, o.t, border, bg, a); g.set(x, b.y1, o.b, border, bg, a) }
  for (let y = b.y0 + 1; y < b.y1; y++) { g.set(b.x0, y, o.l, border, cardBg ?? bg, a); g.set(b.x1, y, o.r, border, cardBg ?? bg, a) }
  g.set(b.x0, b.y0, o.tl, border, bg, a); g.set(b.x1, b.y0, o.tr, border, bg, a); g.set(b.x0, b.y1, o.bl, border, bg, a); g.set(b.x1, b.y1, o.br, border, bg, a)
  if (o.lm || o.rm) { const my = Math.round((b.y0 + b.y1) / 2); if (o.lm) g.set(b.x0, my, o.lm, border, bg, a); if (o.rm) g.set(b.x1, my, o.rm, border, bg, a) }
  /* barra de acento a la izquierda, como la tarjeta del motor */
  if (!n.sh && col && bh >= 3 && G.name !== 'ascii') for (let y = b.y0 + 1; y < b.y1; y++) g.set(b.x0 + 1, y, '▎', P.c(col), cardBg, a0)
  g.markRect(b.x0, b.y0, b.x1, b.y1, n.i)

  const ix = b.x0 + (!n.sh && col && G.name !== 'ascii' ? 3 : 2), iw = b.x1 - ix - 1
  const lines: { t: string; fg?: string; bg?: string; a?: number; spark?: number[]; bar?: number; extra?: string }[] = []
  const title = `${n.k && !n.o ? G.caretR + ' ' : ''}${icon ? icon + ' ' : ''}${n.l}`
  lines.push({ t: title, fg: cardInk, a: BOLD | (hov ? UNDER : 0) | (P.depth === 'mono' && sel ? INV : 0) })

  /* contenido por forma */
  if (n.sh === 'table' || n.sh === 'class' || n.sh === 'requirement') {
    if (n.s) lines.push({ t: `«${n.s}»`, fg: P.c(P.tok('muted')), a: ITALIC })
    lines.push({ t: '─'.repeat(Math.max(1, iw)), fg: border })
    for (const r of n.rw ?? []) lines.push({ t: `${r.vi ?? ''}${r.n}${r.t ? `: ${r.t}` : ''}${r.k ? `  ${r.k}` : ''}`, fg: r.k ? P.c(P.tok('accent')) : P.c(P.tok('ink')) })
  } else if (n.sh === 'kpi') {
    const val = `${fmtNum(n.v ?? 0, n.dc)}${n.u ? ' ' + n.u : ''}`
    const ch = n.ch != null ? `${n.ch >= 0 ? G.up : G.down} ${Math.abs(n.ch).toFixed(1).replace('.', ',')}%` : ''
    const good = n.ch == null ? undefined : (n.ch >= 0) === (n.gd !== 'down')
    lines.push({ t: val, fg: P.c(P.tok('ink')), a: BOLD, extra: ch ? ` ${ch}` : undefined, bg: undefined })
    if (ch) lines[lines.length - 1]!.extra = ch
    if (n.sp?.length) lines.push({ t: '', spark: n.sp })
    ;(lines[1] as { good?: boolean }).good = good
  } else if (n.sh === 'gauge') {
    const mn = n.mn ?? 0, mx = n.mx ?? 100, v = n.v ?? 0
    const t = clamp((v - mn) / ((mx - mn) || 1), 0, 1)
    lines.push({ t: `${fmtNum(v, n.dc)}${n.u ?? ''}`, fg: P.c(gaugeColor(n, P)), a: BOLD })
    lines.push({ t: '', bar: t })
  } else if (n.sh === 'donut') {
    /* el anillo con medios bloques si hay sitio; si no, una barra apilada */
    const parts = n.pt ?? []
    const total = parts.reduce((s2, p) => s2 + p.v, 0)
    const pal = parts.map((p, i) => P.dual(p.c) ?? P.tok('p' + (i % 8), P.tok('accent')))
    const ring = Math.min(bh - 2, Math.floor((iw) / 2.2))
    if (ring >= 4 && P.depth !== 'mono' && G.name !== 'ascii') {
      donutCells(g, ix, b.y0 + 1, ring, parts.map(p => p.v), pal.map(c => P.c(c)), String(fmtNum(total)), P.c(P.tok('ink')), cardBg)
      let ly = b.y0 + 1
      const lx = ix + ring * 2 + 2
      parts.slice(0, bh - 2).forEach((p, i) => { if (lx < b.x1 - 4) { g.set(lx, ly, G.dot, P.c(pal[i]), cardBg); g.text(lx + 2, ly, fit(`${p.l} ${Math.round((p.v / (total || 1)) * 100)}%`, b.x1 - lx - 3), P.c(P.tok('ink')), cardBg, a0) } ly++ })
      return finishBadges(g, n, b, L, sel, pulsing, alertCol)
    }
    lines.push({ t: '', bar: -1 })
    ;(lines[1] as { stack?: { v: number; c?: string }[] }).stack = parts.map((p, i) => ({ v: p.v, c: P.c(pal[i]) }))
    for (const p of parts.slice(0, 3)) lines.push({ t: `${p.l} ${Math.round((p.v / (total || 1)) * 100)}%`, fg: P.c(P.tok('muted')) })
  } else if (n.sh === 'score') {
    const f = G.faces[clamp(Math.round(n.sc ?? 3) - 1, 0, 4)]!
    lines.push({ t: `${f}  ${'★'.repeat(clamp(Math.round(n.sc ?? 0), 0, 5))}`, fg: P.c(scoreColor(n.sc ?? 3, P)) })
  } else if (n.sh === 'ticket') {
    if (n.s) lines.push({ t: n.s, fg: P.c(P.tok('muted')) })
    if (n.b || n.av) lines.push({ t: `${n.b ? `#${n.b}` : ''}${n.av ? `  @${n.av}` : ''}`, fg: P.c(P.tok('accent')) })
  } else if (n.sh === 'person' || n.sh === 'c4' || n.sh === 'c4-db' || n.sh === 'c4-queue') {
    if (n.s) lines.push({ t: n.s, fg: P.c(P.tok('muted')), a: ITALIC })
    if (n.sm) for (const l of wrapLines(n.sm, iw, 3)) lines.push({ t: l, fg: P.c(P.tok('muted')) })
  } else {
    if (n.s) lines.push({ t: n.s, fg: P.c(P.tok('muted')), a: DIM })
    if (L.fx.spark && n.sp && n.sp.length > 1) lines.push({ t: '', spark: n.sp })
    if (n.st) lines.push({ t: `${G.dot} ${n.st}`, fg: P.c(P.dual(n.stc)) ?? P.c(P.tok('muted')) })
    if (n.sm && bh >= 7) for (const l of wrapLines(n.sm, iw, bh - 3 - lines.length)) lines.push({ t: l, fg: P.c(P.tok('faint')), a: DIM })
  }

  const room = bh - 2
  const top = b.y0 + 1 + Math.max(0, Math.floor((room - Math.min(room, lines.length)) / 2))
  lines.slice(0, room).forEach((ln, i) => {
    const y = top + i
    if (ln.spark) {
      const last = ln.spark[ln.spark.length - 1] ?? 0
      const tail = ` ${fmtNum(last)}${n.u ? ' ' + n.u : ''}`
      const sw = clamp(iw - strWidth(tail), 3, 24)
      const good = (ln as { good?: boolean }).good
      const sc = good === undefined ? P.c(col ?? P.tok('accent')) : P.c(good ? P.tok('add') : P.tok('del'))
      g.text(ix, y, spark(ln.spark, sw, G), sc, cardBg, a0)
      g.text(ix + sw, y, fit(tail, iw - sw), P.c(P.tok('ink')), cardBg, a0 | BOLD)
      return
    }
    if (ln.bar != null) {
      const stack = (ln as { stack?: { v: number; c?: string }[] }).stack
      if (stack) { bars(g, ix, y, iw, stack, G, cardBg); return }
      const t = ln.bar
      const th = n.th ?? []
      const fillC = P.c(gaugeColor(n, P))
      const w = Math.round(t * iw)
      for (let x = 0; x < iw; x++) g.set(ix + x, y, x < w ? G.bar.full : G.bar.empty, x < w ? fillC : P.c(P.tok('line')), cardBg, a0)
      for (const tv of th) { const tx = Math.round(clamp(((tv - (n.mn ?? 0)) / (((n.mx ?? 100) - (n.mn ?? 0)) || 1)), 0, 1) * (iw - 1)); g.set(ix + tx, y, '┃', P.c(P.tok('ink')), cardBg, DIM) }
      return
    }
    const used = g.text(ix, y, fit(ln.t, iw), ln.fg, ln.bg ?? cardBg, (ln.a ?? 0) | a0)
    if (ln.extra && used + 1 < iw) {
      const good = (lines[1] as { good?: boolean } | undefined)?.good
      g.text(ix + used + 1, y, fit(ln.extra, iw - used - 1), P.c(good === false ? P.tok('del') : P.tok('add')), cardBg, BOLD | a0)
    }
  })
  finishBadges(g, n, b, L, sel, pulsing, alertCol)
}

function finishBadges(g: Grid, n: SNode, b: Box, L: Look, sel: boolean, pulsing: boolean, alertCol?: string) {
  const G = L.G, P = L.P
  const bg = L.canvasBg
  /* +N hijos plegados */
  if (n.k && !n.o && b.x1 - b.x0 > 6) g.text(b.x1 - 1 - String(n.k).length - 1, b.y0, `+${n.k}`, P.c(P.tok('accent')), bg, BOLD)
  /* delta */
  if (n.dl && b.x1 - b.x0 > 8) { const t = n.dl === 'added' ? '+' : n.dl === 'removed' ? '−' : '~'; g.text(b.x0 + 1, b.y0, ` ${t} `, P.c(inkOn(P.tok(n.dl === 'added' ? 'add' : n.dl === 'removed' ? 'del' : 'mod'))), P.c(P.tok(n.dl === 'added' ? 'add' : n.dl === 'removed' ? 'del' : 'mod')), BOLD) }
  /* calor */
  if (L.fx.heat && n.hv != null) heatBadge(g, n, b, L, false)
  /* progreso: el borde de abajo se llena */
  if (L.fx.progress && n.pr != null && b.x1 - b.x0 > 4) {
    const w = b.x1 - b.x0 - 1, f = Math.round(clamp(n.pr, 0, 1) * w)
    const pc = P.c(n.pr >= 1 ? P.tok('add') : P.tok('accent'))
    for (let x = 0; x < f; x++) g.set(b.x0 + 1 + x, b.y1, G.bar.heavy, pc, bg, BOLD)
    const pct = ` ${Math.round(clamp(n.pr, 0, 1) * 100)}% `
    if (w > pct.length + 4) g.text(b.x1 - pct.length, b.y1, pct, pc, bg, BOLD)
  }
  /* equipo */
  if (L.fx.owners && n.ow) ownerBadge(g, n.ow, b, L)
  /* notas, enlaces y ficheros */
  if (n.nt?.length && b.x1 - b.x0 > 10) g.set(b.x1 - 1, b.y1, G.dot, P.c(P.tok(TONE[n.nt[0] ?? 'info'] ?? 'accent')), bg)
  if ((n.fl || n.lk) && b.x1 - b.x0 > 14) { const t = n.fl ? `±${n.fl}` : `⧉${n.lk}`; g.text(b.x1 - 2 - strWidth(t), b.y1, G.name === 'ascii' ? t.replace('⧉', '#') : t, P.c(P.tok('faint')), bg) }
  /* alerta: su marca en la esquina */
  if (L.fx.alerts && n.al) alertMark(g, n, b, L)
  else if (pulsing && alertCol) g.set(b.x0, b.y0, G.tones.warn ?? '!', P.c(alertCol), bg, BOLD)
  if (sel && P.depth === 'mono') g.set(b.x0, b.y0, G.sel, undefined, undefined, BOLD | INV)
}

function heatBadge(g: Grid, n: SNode, b: Box, L: Look, group: boolean) {
  const P = L.P
  const hc = P.heat(n.hv)
  const t = ` ${fmtNum(n.hv!)}${!group && b.x1 - b.x0 > 16 && L.fx.heat ? '' : ''} `
  const x = b.x1 - 1 - strWidth(t) - (n.k && !n.o ? String(n.k).length + 2 : 0)
  if (x <= b.x0 + 2) return
  g.text(x, b.y0, t, P.c(inkOn(hc)), P.c(hc), BOLD)
}
function ownerBadge(g: Grid, ow: string, b: Box, L: Look) {
  const P = L.P
  const o = L.owners?.[ow]
  const short = (o?.short ?? ow.slice(0, 2)).toUpperCase().slice(0, 3)
  const oc = o?.color ?? P.tok('p2', P.tok('accent'))
  if (b.x1 - b.x0 < short.length + 4) return
  g.text(b.x0 + 2, b.y1, ` ${short} `, P.c(inkOn(oc)), P.c(oc), BOLD)
}
function alertMark(g: Grid, n: SNode, b: Box, L: Look) {
  const P = L.P, G = L.G
  const c = P.tok(TONE[n.al!] ?? 'warn')
  const on = !L.motion || Math.floor(L.t / 520) % 2 === 0 || n.al === 'ok' || n.al === 'info'
  g.set(b.x0, b.y0, G.tones[n.al!] ?? G.warn, P.c(c), L.canvasBg, on ? BOLD : DIM)
}
function gaugeColor(n: SNode, P: Painter) {
  const v = n.v ?? 0, th = n.th ?? []
  const high = n.gd === 'high'
  if (th.length >= 2) { const [w, c] = th as [number, number]; const bad = high ? v <= c : v >= c, warn = high ? v <= w : v >= w; return bad ? P.tok('del') : warn ? P.tok('warn') : P.tok('add') }
  return P.tok('accent')
}
function scoreColor(sc: number, P: Painter) { return sc >= 4 ? P.tok('add') : sc >= 3 ? P.tok('mod') : P.tok('del') }
function wrapLines(s: string, w: number, max: number) {
  if (max <= 0 || w <= 4) return []
  const out: string[] = []; let line = ''
  for (const word of s.split(/\s+/)) { if (!line) line = word; else if (strWidth(line) + 1 + strWidth(word) <= w) line += ' ' + word; else { out.push(line); line = word; if (out.length >= max) break } }
  if (line && out.length < max) out.push(line)
  return out.map(l => fit(l, w))
}

/* barras de gantt y sankey, teselas de treemap: rellenas de su color */
function drawFilled(g: Grid, n: SNode, b: Box, L: Look, col: string | undefined, sel: boolean, dim: boolean) {
  const P = L.P, G = L.G
  const base = col ?? (n.st === 'done' ? P.tok('faint') : n.st === 'crit' ? P.tok('del') : n.st === 'active' ? P.tok('accent') : P.tok('accent'))
  const fillC = P.c(sel ? P.tok('accent') : base)
  const ink = P.c(inkOn(sel ? P.tok('accent') : base))
  const live = !!n.sn?.lv || n.st === 'active'
  const mono = P.depth === 'mono'
  const y0 = b.y0, y1 = b.y1
  const milestone = !!n.sn?.m
  if (milestone) {
    const cy = Math.round((y0 + y1) / 2)
    g.set(b.x0, cy, G.diamond, fillC, L.canvasBg, BOLD)
    g.text(b.x0 + 2, cy, fit(n.l, 24), P.c(P.tok('ink')), L.canvasBg, sel ? BOLD : 0)
    g.markRect(b.x0, cy, b.x0 + 1, cy, n.i)
    return
  }
  for (let y = y0; y <= y1; y++) for (let x = b.x0; x <= b.x1; x++) {
    let ch = ' '
    if (mono) ch = G.shade[1]!
    if (live && L.motion && G.name !== 'ascii') ch = (x + y + Math.floor(L.t / 180)) % 4 === 0 ? '▚' : ' '
    g.set(x, y, ch, live ? P.c(P.mix(base, P.tok('canvas'), 0.4)) : undefined, mono ? undefined : fillC, dim ? DIM : 0)
  }
  g.protect(b.x0, y0, b.x1, y1)
  g.markRect(b.x0, y0, b.x1, y1, n.i)
  const w = b.x1 - b.x0 + 1
  const cy = Math.round((y0 + y1) / 2)
  const label = n.sh === 'block' || n.sh === 'sbar' || n.sh === 'flowbar' ? `${n.l}${n.v != null ? ` ${fmtNum(n.v)}` : ''}` : n.l
  /* como Mermaid: el nombre dentro de la barra si cabe; si no, a su derecha */
  if (strWidth(label) + 2 <= w || (w >= 12 && n.sh !== 'gbar' && n.sh !== 'bar')) g.text(b.x0 + 1, cy, fit(label, w - 2), mono ? undefined : ink, mono ? undefined : fillC, BOLD | (dim ? DIM : 0) | (sel && mono ? INV : 0))
  else { const out = g.text(b.x1 + 2, cy, fit(label, 30), P.c(sel ? P.tok('accent') : P.tok('ink')), L.canvasBg, (dim ? DIM : 0) | (sel ? BOLD : 0)); g.markRect(b.x1 + 2, cy, b.x1 + 1 + out, cy, n.i) }
  if (n.sh === 'block' && n.v != null && y1 - y0 >= 2 && w > 6) g.text(b.x0 + 1, cy + 1, fit(fmtNum(n.v), w - 2), ink, fillC, DIM)
}

/* la capa de los layouts propios: ejes, marcas, fechas, bandas */
function drawDeco(g: Grid, d: SDeco, v: Cam, L: Look, taken: Uint8Array) {
  const P = L.P, G = L.G
  const cls = d.c ?? ''
  const today = /today|hoy|now/.test(cls)
  const c = P.c(today ? P.tok('del') : /tick|grid|axis|rule|week/.test(cls) ? P.tok('line') : P.tok('faint'))
  if (d.t === 't' && d.s) {
    const [x, y] = cell([d.x ?? 0, d.y ?? 0], v)
    const w = strWidth(d.s)
    const x0 = d.a === 'middle' ? x - Math.floor(w / 2) : d.a === 'end' ? x - w : x
    if (y < 0 || y >= g.h) return
    for (let k = x0 - 1; k <= x0 + w; k++) if (k >= 0 && k < g.w && taken[g.idx(k, y)]) return
    for (let k = x0; k < x0 + w; k++) if (k >= 0 && k < g.w) taken[g.idx(k, y)] = 1
    g.text(x0, y, d.s, P.c(today ? P.tok('del') : P.tok('muted')), L.canvasBg, today ? BOLD : DIM)
    /* las líneas del eje y la de hoy pasan por debajo del rótulo */
    g.protect(x0, y, x0 + w - 1, y)
  } else if (d.t === 'l' && d.p && d.p.length > 1) {
    const pts = d.p.map(p => cell(p, v))
    const vert = pts.every(p => p[0] === pts[0]![0]), hor = pts.every(p => p[1] === pts[0]![1])
    if (vert || hor) for (let i = 1; i < pts.length; i++) g.seg(pts[i - 1]![0], pts[i - 1]![1], pts[i]![0], pts[i]![1], today ? 'heavy' : /week|grid|tick/.test(cls) ? 'dashed' : 'thin', c, -1, today ? BOLD : DIM)
    else if (G.name === 'unicode') for (let i = 1; i < d.p.length; i++) { const [ax, ay] = d.p[i - 1]!, [bx, by] = d.p[i]!; g.dline((ax / v.cw - v.ox) * 2, (ay / v.ch - v.oy) * 4, (bx / v.cw - v.ox) * 2, (by / v.ch - v.oy) * 4, P.c(d.s && d.s.startsWith('#') ? d.s : P.tok('faint'))) }
  } else if (d.t === 'r' && d.w && d.h) {
    const b = boxOf({ x: d.x ?? 0, y: d.y ?? 0, w: d.w, h: d.h }, v)
    if (d.f && d.f.startsWith('#') && P.depth !== 'mono' && P.depth !== '16') {
      const tint = P.c(P.mix(P.tok('canvas'), d.f, 0.18))
      for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) if (g.in(x, y) && g.ch[g.idx(x, y)] === ' ') g.tint(x, y, undefined, tint)
    } else if (/band|section|week/.test(cls) && P.depth !== 'mono') {
      /* bandas de sección: solo el borde de arriba */
      for (let x = b.x0; x <= b.x1; x++) if (g.in(x, b.y0) && g.ch[g.idx(x, b.y0)] === ' ') g.set(x, b.y0, '┄', c, L.canvasBg, DIM)
    }
  } else if (d.t === 'c' && d.r != null) {
    const [x, y] = cell([d.x ?? 0, d.y ?? 0], v)
    g.set(x, y, G.dotHollow, c, L.canvasBg)
  }
}

/* ---------- movimiento: partículas por caudal y aristas que marchan ---------- */
function drawMotion(g: Grid, edges: SEdge[], paths: Map<string, [number, number][]>, L: Look, maxRate: number) {
  const P = L.P, G = L.G
  const mode = L.fx.particles
  for (const e of edges) {
    const path = paths.get(e.i)
    if (!path || path.length < 3) continue
    const rate = edgeRate(e, L)
    const want = mode === 'all' || (mode === true && (rate > 0 || e.an || e.he)) || (mode === 'data' && rate > 0)
    const marching = L.march?.has(e.i) || (!want && e.an)
    if (!want && !marching) continue
    if (L.blast && !(L.blast.has(e.a) && L.blast.has(e.b))) continue
    if (L.flow && L.flowT != null && !((L.flow.get(e.a) ?? Infinity) <= L.flowT)) continue
    const lit = L.sel != null && (e.a === L.sel || e.b === L.sel)
    const base = P.dual(e.c) ?? (L.blast ? P.tok('del') : P.tok('accent'))
    const len = path.length
    if (want) {
      const rel = rate > 0 ? clamp(Math.sqrt(rate / maxRate), 0.15, 1) : 0.45
      const gap = Math.round(22 - rel * 13)
      const sp = typeof e.sp === 'number' ? e.sp : e.sp === 'fast' ? 1.8 : e.sp === 'slow' ? 0.5 : 1
      const speed = (5 + rel * 13) * sp
      /* en el impacto, el fallo viaja al revés: de lo que falla a quien depende de ello */
      const reverse = !!L.blast && (L.blast.get(e.a) ?? 0) > (L.blast.get(e.b) ?? 0)
      const head = (L.t / 1000) * speed
      for (let k = 0; k < len; k += gap) {
        const pos = Math.floor((head + k) % len)
        const idx = reverse ? len - 1 - pos : pos
        const [x, y] = path[idx]!
        if (!g.in(x, y) || g.solid[g.idx(x, y)]) continue
        g.set(x, y, e.ds ? G.dotHollow : G.particle[0]!, P.c(lit ? P.tok('accent') : P.mix(base, '#ffffff', P.theme === 'dark' ? 0.25 : 0)), L.canvasBg, BOLD)
        const tIdx = reverse ? idx + 1 : idx - 1
        const tr = path[tIdx]
        if (tr && g.in(tr[0], tr[1]) && !g.solid[g.idx(tr[0], tr[1])] && G.particle[1]) g.set(tr[0], tr[1], G.particle[1], P.c(base), L.canvasBg, DIM)
      }
    } else if (marching) {
      const phase = Math.floor(L.t / 110)
      for (let k = 0; k < len; k++) {
        if ((k - phase) % 4 !== 0 && (k - phase) % 4 !== -0) continue
        const [x, y] = path[k]!
        if (!g.in(x, y) || g.solid[g.idx(x, y)]) continue
        g.tint(x, y, P.c(P.mix(base, '#ffffff', 0.35)), undefined, BOLD)
      }
    }
  }
}

export { BOLD, DIM, INV, ITALIC, UNDER }
export type { SLane }
