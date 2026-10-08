/* La rejilla de celdas sobre la que se dibuja todo lo del terminal.
 *
 * Cada celda: un carácter, color de tinta y de fondo, y atributos (negrita, atenuado, cursiva, subrayado,
 * inverso). Las aristas se trazan como bits de dirección por celda que al final se resuelven en el carácter
 * que toca (esquinas y cruces incluidos), con su estilo (fino, grueso, discontinuo, doble). Encima hay una
 * capa braille opcional (2×4 puntos por celda) para curvas, anillos y series finas.
 *
 * Al final la rejilla sale como filas de tramos { texto, estilo } que el lienzo convierte en <Text>. */
import { cw, type Glyphs } from './glyphs'

export const BOLD = 1, DIM = 2, ITALIC = 4, UNDER = 8, INV = 16
export const U = 1, D = 2, L = 4, R = 8
export type LineStyle = 'thin' | 'heavy' | 'dashed' | 'double'
export type Span = { t: string; fg?: string; bg?: string; a: number }

const STYLE_RANK: Record<LineStyle, number> = { thin: 0, dashed: 1, double: 2, heavy: 3 }

export class Grid {
  w: number
  h: number
  ch: string[]
  fg: (string | undefined)[]
  bg: (string | undefined)[]
  at: Uint8Array
  /* aristas: bits, estilo, color y prioridad (la arista más importante gana el color de la celda) */
  bits: Uint8Array
  lst: Uint8Array
  lfg: (string | undefined)[]
  lpri: Int16Array
  lat: Uint8Array
  /* capa braille: 8 bits por celda y su color */
  dots: Uint8Array
  dfg: (string | undefined)[]
  /* qué hay en cada celda, para el ratón: un id de pieza o de arista */
  hit: (string | undefined)[]
  /* celdas protegidas: lo que ya es pieza no lo pisan las aristas */
  solid: Uint8Array

  constructor(w: number, h: number, public G: Glyphs) {
    this.w = Math.max(1, w); this.h = Math.max(1, h)
    const n = this.w * this.h
    this.ch = new Array(n).fill(' ')
    this.fg = new Array(n).fill(undefined)
    this.bg = new Array(n).fill(undefined)
    this.at = new Uint8Array(n)
    this.bits = new Uint8Array(n)
    this.lst = new Uint8Array(n)
    this.lfg = new Array(n).fill(undefined)
    this.lpri = new Int16Array(n).fill(-1)
    this.lat = new Uint8Array(n)
    this.dots = new Uint8Array(n)
    this.dfg = new Array(n).fill(undefined)
    this.hit = new Array(n).fill(undefined)
    this.solid = new Uint8Array(n)
  }
  in(x: number, y: number) { return x >= 0 && y >= 0 && x < this.w && y < this.h }
  idx(x: number, y: number) { return y * this.w + x }

  set(x: number, y: number, c: string, fg?: string, bg?: string, a = 0) {
    x = Math.round(x); y = Math.round(y)
    if (!this.in(x, y)) return
    const i = this.idx(x, y)
    this.ch[i] = c; this.fg[i] = fg; if (bg !== undefined) this.bg[i] = bg; this.at[i] = a
    this.bits[i] = 0
  }
  /* solo cambia el estilo (un resaltado sobre lo que ya hay) */
  tint(x: number, y: number, fg?: string, bg?: string, a?: number) {
    if (!this.in(x, y)) return
    const i = this.idx(x, y)
    if (fg !== undefined) this.fg[i] = fg
    if (bg !== undefined) this.bg[i] = bg
    if (a !== undefined) this.at[i] = a
  }
  fill(x0: number, y0: number, x1: number, y1: number, c: string, fg?: string, bg?: string, a = 0, solid = false) {
    for (let y = Math.max(0, y0); y <= Math.min(this.h - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(this.w - 1, x1); x++) {
      const i = this.idx(x, y)
      this.ch[i] = c; this.fg[i] = fg; this.bg[i] = bg; this.at[i] = a; this.bits[i] = 0; this.dots[i] = 0
      if (solid) this.solid[i] = 1
    }
  }
  /* escribe un texto (con su ancho de verdad: CJK y emoji ocupan dos celdas); devuelve las celdas usadas */
  text(x: number, y: number, s: string, fg?: string, bg?: string, a = 0, max = Infinity) {
    x = Math.round(x); y = Math.round(y)
    if (y < 0 || y >= this.h) return 0
    let used = 0
    for (const chr of s) {
      const c = cw(chr.codePointAt(0) ?? 0)
      if (c === 0) { if (used > 0 && this.in(x + used - 1, y)) this.ch[this.idx(x + used - 1, y)] += chr; continue }
      if (used + c > max) break
      if (this.in(x + used, y)) {
        const i = this.idx(x + used, y)
        this.ch[i] = chr; this.fg[i] = fg; if (bg !== undefined) this.bg[i] = bg; this.at[i] = a; this.bits[i] = 0; this.dots[i] = 0
        if (c === 2 && this.in(x + used + 1, y)) { const j = i + 1; this.ch[j] = ''; this.bg[j] = bg ?? this.bg[j]; this.bits[j] = 0 }
      }
      used += c
    }
    return used
  }
  mark(x: number, y: number, id: string) { if (this.in(x, y)) this.hit[this.idx(x, y)] = id }
  markRect(x0: number, y0: number, x1: number, y1: number, id: string) {
    for (let y = Math.max(0, y0); y <= Math.min(this.h - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(this.w - 1, x1); x++) this.hit[this.idx(x, y)] = id
  }
  protect(x0: number, y0: number, x1: number, y1: number) {
    for (let y = Math.max(0, y0); y <= Math.min(this.h - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(this.w - 1, x1); x++) this.solid[this.idx(x, y)] = 1
  }

  /* ---- aristas ---- */
  bit(x: number, y: number, b: number, style: LineStyle, fg: string | undefined, pri: number, a = 0) {
    if (!this.in(x, y)) return
    const i = this.idx(x, y)
    if (this.solid[i]) return
    this.bits[i] = this.bits[i]! | b
    if (pri >= this.lpri[i]!) { this.lpri[i] = pri; this.lfg[i] = fg; this.lat[i] = a }
    const code = STYLE_RANK[style] + 1
    if (code > this.lst[i]!) this.lst[i] = code
  }
  /* un tramo horizontal o vertical entre dos celdas (con L si no están alineadas) */
  seg(x0: number, y0: number, x1: number, y1: number, style: LineStyle, fg: string | undefined, pri: number, a = 0, vfirst = false) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1)
    if (y0 === y1) {
      const s = Math.sign(x1 - x0); if (!s) return
      for (let x = x0; x !== x1 + s; x += s) { if (x !== x0) this.bit(x, y0, s > 0 ? L : R, style, fg, pri, a); if (x !== x1) this.bit(x, y0, s > 0 ? R : L, style, fg, pri, a) }
    } else if (x0 === x1) {
      const s = Math.sign(y1 - y0); if (!s) return
      for (let y = y0; y !== y1 + s; y += s) { if (y !== y0) this.bit(x0, y, s > 0 ? U : D, style, fg, pri, a); if (y !== y1) this.bit(x0, y, s > 0 ? D : U, style, fg, pri, a) }
    } else if (vfirst) { this.seg(x0, y0, x0, y1, style, fg, pri, a); this.seg(x0, y1, x1, y1, style, fg, pri, a) }
    else { this.seg(x0, y0, x1, y0, style, fg, pri, a); this.seg(x1, y0, x1, y1, style, fg, pri, a) }
  }
  flushLines() {
    const names: LineStyle[] = ['thin', 'thin', 'dashed', 'double', 'heavy']
    for (let i = 0; i < this.bits.length; i++) {
      const b = this.bits[i]!
      if (!b) continue
      const st = names[this.lst[i]!] ?? 'thin'
      const map = this.G.line[st]
      this.ch[i] = map[b] ?? this.G.line.thin[b] ?? '·'
      this.fg[i] = this.lfg[i]; this.at[i] = this.lat[i]!
      this.bits[i] = 0
    }
  }

  /* ---- braille: (px, py) en subceldas de 2×4 ---- */
  dot(px: number, py: number, fg?: string) {
    const x = Math.floor(px / 2), y = Math.floor(py / 4)
    if (!this.in(x, y)) return
    const i = this.idx(x, y)
    if (this.solid[i]) return
    const sx = Math.floor(px) - x * 2, sy = Math.floor(py) - y * 4
    const BIT = [[0x01, 0x08], [0x02, 0x10], [0x04, 0x20], [0x40, 0x80]]
    this.dots[i] = this.dots[i]! | BIT[sy]![sx]!
    if (fg) this.dfg[i] = fg
  }
  flushDots() {
    for (let i = 0; i < this.dots.length; i++) {
      const d = this.dots[i]!
      if (!d) continue
      if (this.ch[i] === ' ' || this.ch[i] === '') { this.ch[i] = String.fromCharCode(0x2800 + d); this.fg[i] = this.dfg[i]; this.at[i] = 0 }
      this.dots[i] = 0
    }
  }
  /* una línea fina entre dos puntos en subceldas (braille) */
  dline(x0: number, y0: number, x1: number, y1: number, fg?: string) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))))
    for (let k = 0; k <= n; k++) this.dot(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, fg)
  }

  /* ---- salida ---- */
  row(y: number, budget?: { n: number }): Span[] {
    const out: Span[] = []
    for (let x = 0; x < this.w; x++) {
      const i = this.idx(x, y)
      const c = this.ch[i]!
      if (c === '') continue
      const fg = this.fg[i], bg = this.bg[i], a = this.at[i]!
      const last = out[out.length - 1]
      /* un espacio sin fondo no necesita tinta: se une a lo que haya */
      if (last && last.bg === bg && (last.fg === fg || (c === ' ' && !(a & (UNDER | INV)))) && (last.a === a || (c === ' ' && !(a & (UNDER | INV)) && !(last.a & (UNDER | INV))))) last.t += c
      else if (last && c === ' ' && !bg && !last.bg && !(last.a & (UNDER | INV))) last.t += c
      else out.push({ t: c, fg: c === ' ' && !(a & (UNDER | INV)) ? undefined : fg, bg, a: c === ' ' && !(a & (UNDER | INV)) ? 0 : a })
    }
    /* sin espacios de cola: no pintan nada */
    const tail = out[out.length - 1]
    if (tail && !tail.bg) { tail.t = tail.t.replace(/ +$/, ''); if (!tail.t) out.pop() }
    if (budget) budget.n += out.length
    return out
  }
  /* la rejilla como texto plano (para las pruebas y para que Claude vea lo que ve la persona) */
  plain(): string {
    const lines: string[] = []
    for (let y = 0; y < this.h; y++) { let s = ''; for (let x = 0; x < this.w; x++) s += this.ch[this.idx(x, y)]; lines.push(s.replace(/\s+$/, '')) }
    return lines.join('\n')
  }
}
