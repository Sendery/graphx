/* Gráficos pequeños en celdas: series (sparkline), barras apiladas, el donut con medios bloques y el formato
 * de las cifras, que comparten las piezas, el panel de detalle y la línea de tiempo. */
import type { Grid } from './grid'
import type { Glyphs } from './glyphs'
import { tr } from '../i18n'

export function fmtNum(v: number, decimals?: number): string {
  if (!Number.isFinite(v)) return '—'
  const a = Math.abs(v)
  if (decimals != null) return decimalMark(v.toFixed(decimals))
  if (a >= 1e9) return decimalMark((v / 1e9).toFixed(a >= 1e10 ? 0 : 1).replace(/\.0$/, '')) + ' G'
  if (a >= 1e6) return decimalMark((v / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '')) + ' M'
  if (a >= 1e4) return decimalMark((v / 1e3).toFixed(a >= 1e5 ? 0 : 1).replace(/\.0$/, '')) + ' k'
  if (a >= 100 || Number.isInteger(v)) return String(Math.round(v))
  return decimalMark(v.toFixed(1))
}

/* la coma decimal en español, el punto en inglés */
export function decimalMark(s: string): string {
  return tr(s.replace('.', ','), s)
}

/* una serie en `w` celdas con bloques de ocho alturas (o lo que tenga el juego de glifos) */
export function spark(vals: number[], w: number, G: Glyphs): string {
  const xs = vals.filter(Number.isFinite)
  if (!xs.length || w <= 0) return ''
  const pick = xs.length > w ? Array.from({ length: w }, (_, i) => xs[Math.floor((i * xs.length) / w)]!) : xs
  const mn = Math.min(...pick), mx = Math.max(...pick)
  const lv = G.spark.length
  return pick.map(v => G.spark[mx === mn ? Math.floor(lv / 2) : Math.min(lv - 1, Math.floor(((v - mn) / (mx - mn)) * (lv - 1) + 0.5))]).join('')
}
/* una serie en braille: dos valores por celda, cuatro alturas por fila, `rows` filas */
export function brailleSpark(g: Grid, x: number, y: number, w: number, rows: number, vals: number[], fg?: string) {
  const xs = vals.filter(Number.isFinite)
  if (!xs.length) return
  const n = w * 2
  const pick = Array.from({ length: n }, (_, i) => xs[Math.floor((i * xs.length) / n)]!)
  const mn = Math.min(...pick), mx = Math.max(...pick)
  const H = rows * 4
  let prev: number | null = null
  pick.forEach((v, i) => {
    const h = mx === mn ? H / 2 : ((v - mn) / (mx - mn)) * (H - 1)
    const py = y * 4 + (H - 1 - h)
    if (prev != null) g.dline(x * 2 + i - 1, prev, x * 2 + i, py, fg)
    else g.dot(x * 2 + i, py, fg)
    prev = py
  })
}

/* una barra apilada (un reparto) en `w` celdas, con medios bloques para afinar las fronteras */
export function bars(g: Grid, x: number, y: number, w: number, parts: { v: number; c?: string }[], G: Glyphs, bg?: string) {
  const total = parts.reduce((a, p) => a + Math.max(0, p.v), 0) || 1
  let acc = 0
  for (const p of parts) {
    const a = Math.round((acc / total) * w), b = Math.round(((acc + Math.max(0, p.v)) / total) * w)
    for (let i = a; i < b; i++) g.set(x + i, y, G.bar.full, p.c, bg)
    acc += Math.max(0, p.v)
  }
}

/* el donut: un anillo de `r` filas de alto pintado con medios bloques (dos «píxeles» por celda), el total en medio */
export function donutCells(g: Grid, x: number, y: number, r: number, vals: number[], colors: (string | undefined)[], center: string, ink?: string, bg?: string) {
  const W = r * 2, H = r * 2              /* píxeles: r*2 de ancho (una celda = 1 px de ancho y 2 de alto, aprox. cuadrado) */
  const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2, ri = R * 0.55
  const total = vals.reduce((a, v) => a + Math.max(0, v), 0) || 1
  const ends: number[] = []; let acc = 0
  for (const v of vals) { acc += Math.max(0, v); ends.push(acc / total) }
  const px = (px0: number, py0: number) => {
    const dx = px0 + 0.5 - cx, dy = (py0 + 0.5 - cy)
    const d = Math.hypot(dx, dy)
    if (d > R || d < ri) return undefined
    let t = Math.atan2(dx, -dy) / (2 * Math.PI); if (t < 0) t += 1
    const k = ends.findIndex(e => t <= e)
    return colors[k < 0 ? colors.length - 1 : k]
  }
  for (let row = 0; row < r; row++) for (let col = 0; col < W; col++) {
    const top = px(col, row * 2), bot = px(col, row * 2 + 1)
    if (!top && !bot) continue
    if (top && bot) g.set(x + col, y + row, '▀', top, bot)
    else if (top) g.set(x + col, y + row, '▀', top, bg)
    else g.set(x + col, y + row, '▄', bot, bg)
  }
  const mid = y + Math.floor(r / 2)
  const t = center.slice(0, Math.max(0, Math.floor(ri * 2) - 1))
  if (t) g.text(x + Math.round(cx - t.length / 2), mid, t, ink, bg, 1)
}
