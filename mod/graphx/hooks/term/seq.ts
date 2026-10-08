/* Un diagrama de secuencia en celdas, colocado aquí y no por el motor: una columna por participante, una
 * fila lógica por mensaje. Cabeceras con su forma, cajas (`box`) que agrupan participantes, líneas de vida con
 * sus barras de activación, mensajes síncronos, asíncronos, de vuelta y a sí mismo con su número y su punta,
 * notas, marcos (loop, alt/else, opt, par, critical, break) y fases. La reproducción enseña los mensajes uno a
 * uno con una partícula que viaja por el que llega. */
import type { SSeq } from '../../types'
import { BOLD, DIM, Grid, ITALIC, UNDER } from './grid'
import { fit, strWidth, wrap } from './glyphs'
import { inkOn } from './paint'
import type { Box, Look } from './graph'

export type SeqLayout = { cols: Map<string, number>; width: number; rows: { id: string; y: number; h: number }[]; height: number; head: number }
const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'

export function layoutSeq(sq: SSeq, cols: number): SeqLayout {
  const parts = sq.parts
  const minW = parts.map(p => Math.max(10, strWidth(p.l) + 4))
  /* el espacio entre columnas: lo que pidan las etiquetas de los mensajes entre vecinos */
  const idx = new Map(parts.map((p, i) => [p.i, i]))
  const gap = parts.map(() => 6)
  for (const r of sq.rows) {
    if (r.a == null || r.b == null || !r.l) continue
    const a = idx.get(r.a), b = idx.get(r.b)
    if (a == null || b == null) continue
    const need = strWidth(r.l) + 6
    if (a === b) { if (a < gap.length - 1) gap[a] = Math.max(gap[a]!, Math.min(40, need)) }
    else { const lo = Math.min(a, b), hi = Math.max(a, b), span = hi - lo; for (let k = lo; k < hi; k++) gap[k] = Math.max(gap[k]!, Math.min(48, Math.ceil(need / span) - Math.floor((minW[k]! + minW[k + 1]!) / 2) + 6)) }
  }
  const pos = new Map<string, number>()
  let x = 1
  parts.forEach((p, i) => { const half = Math.floor(minW[i]! / 2); x += i === 0 ? half : gap[i - 1]! + half; pos.set(p.i, x); x += minW[i]! - half })
  let width = x + 2
  /* si sobra sitio, se reparte */
  if (width < cols && parts.length > 1) {
    const extra = Math.floor((cols - width) / parts.length)
    parts.forEach((p, i) => pos.set(p.i, pos.get(p.i)! + Math.floor(extra * (i + 0.5))))
    width = cols
  }
  const rows: SeqLayout['rows'] = []
  const head = 4
  let y = head + 1
  for (const r of sq.rows) {
    let h = 2
    if (r.k === 'self') h = 3
    else if (r.k === 'note') h = Math.min(6, wrap(r.l ?? '', 30).length) + 2
    else if (r.k === 'block' || r.k === 'else') h = 2
    else if (r.k === 'end') h = 1
    else if (r.ph) h = 2
    else if (r.k === 'create' || r.k === 'destroy' || r.k === 'activate' || r.k === 'deactivate') h = 0
    rows.push({ id: r.i, y, h })
    y += h
  }
  return { cols: pos, width, rows, height: y + 2, head }
}

export function drawSeq(sq: SSeq, lay: SeqLayout, cols: number, rows: number, ox: number, oy: number, L: Look, playAt: number | null): { grid: Grid; boxes: Map<string, Box>; order: string[] } {
  const P = L.P, G = L.G
  const g = new Grid(cols, rows, G)
  const bg = L.canvasBg
  if (bg) g.fill(0, 0, cols - 1, rows - 1, ' ', undefined, bg)
  const boxes = new Map<string, Box>()
  const X = (id: string | undefined) => (id != null && lay.cols.has(id) ? lay.cols.get(id)! - ox : null)
  /* con cajas, todo baja una fila: la de arriba es para sus títulos */
  const boxRow = sq.boxes.length ? 1 : 0
  const Y = (y: number) => y - oy + boxRow
  const ink = P.c(P.tok('ink')), muted = P.c(P.tok('muted')), faint = P.c(P.tok('faint')), accent = P.c(P.tok('accent'))
  const lineC = P.c(P.tok('neu', P.tok('line')))
  const visible = (k: number) => playAt == null || k <= playAt

  /* cajas de participantes */
  for (const bx of sq.boxes) {
    const xs = sq.parts.filter(p => p.box === bx.i).map(p => X(p.i)!).filter(v => v != null)
    if (!xs.length) continue
    const x0 = Math.min(...xs) - Math.floor(Math.max(10, ...sq.parts.filter(p => p.box === bx.i).map(p => strWidth(p.l) + 4)) / 2) - 1
    const x1 = Math.max(...xs) + Math.floor(Math.max(10, ...sq.parts.filter(p => p.box === bx.i).map(p => strWidth(p.l) + 4)) / 2) + 1
    const c = P.c(P.dual(bx.c)) ?? faint
    const y0 = Y(0) - 1, y1 = Y(lay.height - 1)
    for (let y = y0 + 1; y < y1; y++) { g.set(x0, y, G.box.dashed.l, c, bg, DIM); g.set(x1, y, G.box.dashed.r, c, bg, DIM) }
    for (let x = x0 + 1; x < x1; x++) { g.set(x, y0, G.box.dashed.t, c, bg, DIM); g.set(x, y1, G.box.dashed.b, c, bg, DIM) }
    g.set(x0, y0, G.box.round.tl, c, bg, DIM); g.set(x1, y0, G.box.round.tr, c, bg, DIM); g.set(x0, y1, G.box.round.bl, c, bg, DIM); g.set(x1, y1, G.box.round.br, c, bg, DIM)
    g.text(x0 + 2, y0, ` ${fit(bx.l.toUpperCase(), x1 - x0 - 4)} `, c, bg, BOLD)
  }

  /* líneas de vida, con la activación como barra gruesa */
  const active = new Map<string, number>()
  const actRows = new Map<string, [number, number][]>()
  sq.rows.forEach((r, k) => {
    const ry = lay.rows[k]!
    if (r.ac) { active.set(r.ac, ry.y + 1); }
    if (r.de && active.has(r.de)) { const s = active.get(r.de)!; (actRows.get(r.de) ?? actRows.set(r.de, []).get(r.de)!).push([s, ry.y + 1]); active.delete(r.de) }
  })
  for (const [id, s] of active) (actRows.get(id) ?? actRows.set(id, []).get(id)!).push([s, lay.height - 2])
  for (const p of sq.parts) {
    const x = X(p.i)!
    for (let y = Y(lay.head); y < Y(lay.height - 1); y++) g.set(x, y, G.name === 'ascii' ? ':' : '┆', lineC, bg, DIM)
    for (const [a, b] of actRows.get(p.i) ?? []) for (let y = Y(a); y <= Y(b); y++) g.set(x, y, G.vbar, P.c(P.dual(p.c) ?? P.tok('accent')), bg, BOLD)
  }

  /* cabeceras */
  for (const p of sq.parts) {
    const x = X(p.i)!
    const w = Math.max(10, strWidth(p.l) + 4), x0 = x - Math.floor(w / 2), x1 = x0 + w - 1
    const sel = L.sel === p.i
    const c = sel ? accent : (P.c(P.dual(p.c)) ?? P.c(P.tok('card-line')))
    const box = sel ? G.box.heavy : p.sh === 'actor' ? G.box.round : p.sh === 'datastore' ? G.box.round : G.box.sharp
    const y0 = Y(0), y1 = Y(2)
    for (let xx = x0 + 1; xx < x1; xx++) { g.set(xx, y0, box.t, c, bg); g.set(xx, y1, box.b, c, bg) }
    g.set(x0, y0, box.tl, c, bg); g.set(x1, y0, box.tr, c, bg); g.set(x0, y1, box.bl, c, bg); g.set(x1, y1, box.br, c, bg)
    g.set(x0, y0 + 1, box.l, c, bg); g.set(x1, y0 + 1, box.r, c, bg)
    const icon = p.sh === 'actor' ? G.icons.actor : p.sh === 'datastore' ? G.icons.datastore : ''
    const lab = `${icon ? icon + ' ' : ''}${p.l}`
    g.text(x - Math.floor(strWidth(fit(lab, w - 2)) / 2), y0 + 1, fit(lab, w - 2), sel ? accent : ink, bg, BOLD)
    g.set(x, y1, G.name === 'ascii' ? '+' : '┬', c, bg)
    g.markRect(x0, y0, x1, y1, p.i)
    boxes.set(p.i, { x0, y0, x1, y1 })
  }

  /* marcos de bloque: se abren en `block`, se parten en `else` y se cierran en `end` */
  const stack: { k: number; y: number; title: string; label?: string; elses: { y: number; label?: string }[]; xs: number[] }[] = []
  const frames: { y0: number; y1: number; x0: number; x1: number; title: string; label?: string; elses: { y: number; label?: string }[] }[] = []
  sq.rows.forEach((r, k) => {
    const ry = lay.rows[k]!
    if (r.k === 'block') stack.push({ k, y: ry.y, title: (r.t ?? r.bl ?? 'bloque').toUpperCase(), label: r.l, elses: [], xs: [] })
    else if (r.k === 'else' && stack.length) stack[stack.length - 1]!.elses.push({ y: ry.y, label: `${r.t ? r.t.toUpperCase() + ' ' : ''}${r.l ? `[${r.l}]` : ''}` })
    else if (r.k === 'end' && stack.length) {
      const f = stack.pop()!
      const xs = f.xs.length ? f.xs : [...lay.cols.values()]
      frames.push({ y0: f.y, y1: ry.y, x0: Math.min(...xs) - 4, x1: Math.max(...xs) + 4, title: f.title, label: f.label, elses: f.elses })
      if (stack.length) stack[stack.length - 1]!.xs.push(...xs)
    } else if (r.a != null) for (const f of stack) { const a = lay.cols.get(r.a), b = lay.cols.get(r.b ?? r.a); if (a != null) f.xs.push(a); if (b != null) f.xs.push(b); if (r.k === 'self' && a != null) f.xs.push(a + 8) }
    else if (r.k === 'note') for (const f of stack) for (const o of r.ov ?? []) { const a = lay.cols.get(o); if (a != null) f.xs.push(a) }
  })
  for (const f of frames.reverse()) {
    const x0 = f.x0 - ox, x1 = f.x1 - ox, y0 = Y(f.y0), y1 = Y(f.y1)
    const c = P.c(P.tok('muted'))
    for (let x = x0 + 1; x < x1; x++) { g.set(x, y0, G.box.sharp.t, c, bg, DIM); g.set(x, y1, G.box.sharp.b, c, bg, DIM) }
    for (let y = y0 + 1; y < y1; y++) { g.set(x0, y, G.box.sharp.l, c, bg, DIM); g.set(x1, y, G.box.sharp.r, c, bg, DIM) }
    g.set(x0, y0, G.box.sharp.tl, c, bg, DIM); g.set(x1, y0, G.box.sharp.tr, c, bg, DIM); g.set(x0, y1, G.box.sharp.bl, c, bg, DIM); g.set(x1, y1, G.box.sharp.br, c, bg, DIM)
    const used = g.text(x0 + 1, y0, ` ${f.title} `, P.c(inkOn(P.tok('muted'))), P.c(P.tok('muted')), BOLD)
    if (f.label) g.text(x0 + 2 + used, y0, fit(`[${f.label}]`, x1 - x0 - used - 3), muted, bg, ITALIC)
    for (const e of f.elses) { const y = Y(e.y); for (let x = x0 + 1; x < x1; x++) g.set(x, y, G.box.dashed.t, c, bg, DIM); if (e.label) g.text(x0 + 2, y, ` ${fit(e.label, x1 - x0 - 4)} `, muted, bg, ITALIC) }
  }

  /* mensajes y notas */
  let num = 0
  const order: string[] = []
  sq.rows.forEach((r, k) => {
    const ry = lay.rows[k]!
    if (r.k === 'note') {
      if (!visible(k)) return
      const xs = (r.ov ?? []).map(id => X(id)).filter((v): v is number => v != null)
      if (!xs.length) return
      const lines = wrap(r.l ?? '', 30, 4)
      const w = Math.max(...lines.map(strWidth)) + 4
      const x0 = r.sd === 'right' ? Math.max(...xs) + 2 : r.sd === 'left' ? Math.min(...xs) - w - 1 : Math.round((Math.min(...xs) + Math.max(...xs)) / 2 - w / 2)
      const y0 = Y(ry.y)
      const nb = P.c(P.tok('note', P.mix(P.tok('canvas'), P.tok('mod'), 0.15)))
      const nl = P.c(P.tok('note-line', P.tok('mod')))
      g.fill(x0, y0, x0 + w - 1, y0 + lines.length + 1, ' ', undefined, P.depth === 'mono' ? undefined : nb, 0, true)
      for (let x = x0; x < x0 + w; x++) { g.set(x, y0, G.box.sharp.t, nl, nb); g.set(x, y0 + lines.length + 1, G.box.sharp.b, nl, nb) }
      g.set(x0 + w - 1, y0, '◹', nl, nb)
      lines.forEach((l, i) => g.text(x0 + 2, y0 + 1 + i, l, P.c(P.tok('ink')), nb, ITALIC))
      g.markRect(x0, y0, x0 + w - 1, y0 + lines.length + 1, r.i)
      order.push(r.i)
      return
    }
    if (r.ph && !r.a) {
      const y = Y(ry.y)
      for (let x = 0; x < cols; x++) g.set(x, y, '─', faint, bg, DIM)
      g.text(2, y, ` ${fit((r.l ?? '').toUpperCase(), cols - 6)} `, P.c(P.tok('accent')), bg, BOLD)
      return
    }
    if (r.a == null || r.b == null) return
    num++
    if (!visible(k)) return
    const xa = X(r.a), xb = X(r.b)
    if (xa == null || xb == null) return
    const sel = L.sel === r.i
    const arriving = playAt === k
    const c = sel || arriving ? accent : (P.c(P.dual(r.c)) ?? P.c(P.tok('ink')))
    const dashed = r.k === 'return'
    const y = Y(ry.y) + 1
    const n = num <= 20 && G.name === 'unicode' ? CIRCLED[num - 1]! : `(${num})`
    order.push(r.i)
    if (r.k === 'self' || xa === xb) {
      const w = Math.min(10, Math.max(6, Math.floor(strWidth(r.l ?? '') / 2)))
      g.text(xa + 2, y - 1, fit(r.l ?? '', 34), sel ? accent : muted, bg, sel ? BOLD : 0)
      for (let x = xa + 1; x < xa + w; x++) { g.set(x, y, '─', c, bg); g.set(x, y + 1, '─', c, bg) }
      g.set(xa + w, y, G.box.round.tr, c, bg); g.set(xa + w, y + 1, G.box.round.br, c, bg)
      g.set(xa + 1, y + 1, G.head.l, c, bg, BOLD)
      g.text(xa - strWidth(n) - 1, y, n, P.c(P.tok('accent')), bg, BOLD)
      g.markRect(xa, y - 1, xa + w, y + 1, r.i)
      return
    }
    const dir = Math.sign(xb - xa)
    const from = xa + dir, to = xb - dir
    for (let x = from; x !== to + dir; x += dir) g.set(x, y, dashed ? (G.name === 'ascii' ? '-' : '╌') : r.k === 'async' ? '─' : '─', c, bg, sel ? BOLD : 0)
    const head = r.hd === 'cross' ? G.cross : r.hd === 'open' || r.k === 'async' ? (dir > 0 ? G.headOpen.r : G.headOpen.l) : (dir > 0 ? G.head.r : G.head.l)
    g.set(to, y, head, c, bg, BOLD)
    if (r.tl) g.set(from, y, dir > 0 ? G.head.l : G.head.r, c, bg, BOLD)
    const lab = fit(r.l ?? '', Math.abs(xb - xa) - 3)
    const lx = Math.round((xa + xb) / 2 - strWidth(lab) / 2)
    g.text(lx, y - 1, lab, sel ? accent : P.c(P.tok('ink')), bg, sel ? BOLD | UNDER : 0)
    g.text(Math.min(xa, xb) + (dir > 0 ? -strWidth(n) - 1 : 1 + Math.abs(xb - xa) + 1), y, n, P.c(P.tok('accent')), bg, BOLD)
    g.markRect(Math.min(xa, xb), y - 1, Math.max(xa, xb), y, r.i)
    boxes.set(r.i, { x0: Math.min(xa, xb), y0: y - 1, x1: Math.max(xa, xb), y1: y })
    /* reproducción: la partícula que viaja por el mensaje que llega */
    if (arriving && L.motion) {
      const len = Math.abs(to - from) + 1
      const t = ((L.t % 900) / 900)
      const px = from + dir * Math.floor(t * len)
      g.set(px, y, G.particle[0]!, P.c(P.tok('accent')), bg, BOLD)
    }
  })
  return { grid: g, boxes, order }
}
