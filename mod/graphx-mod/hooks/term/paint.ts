/* Color para el terminal: la paleta de GraphX (los tokens de su tema y su piel, resueltos por el servidor)
 * llevada a lo que el terminal puede pintar.
 *
 *   truecolor  el color tal cual (#rrggbb)
 *   256        el más cercano de la paleta xterm-256 (cubo 6×6×6 y grises), en #rrggbb exacto: el terminal lo
 *              traduce sin pérdida
 *   16         el más cercano de los 16 colores ANSI, por nombre (los del tema del terminal)
 *   mono       sin color: la jerarquía va en negrita, atenuado, subrayado e inverso */
import type { Caps, Dual } from '../../types'

export type Rgb = [number, number, number]
export type Depth = Caps['color']

export function rgb(hex: string | undefined | null): Rgb | null {
  if (!hex) return null
  let h = hex.trim()
  if (!h.startsWith('#')) return null
  h = h.slice(1)
  if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map(c => c + c).join('')
  if (h.length !== 6 && h.length !== 8) return null
  const n = parseInt(h.slice(0, 6), 16)
  if (!Number.isFinite(n)) return null
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const hx = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')
export const hex = (c: Rgb) => `#${hx(c[0])}${hx(c[1])}${hx(c[2])}`
export function mix(a: string | undefined, b: string | undefined, t: number): string | undefined {
  const x = rgb(a), y = rgb(b)
  if (!x) return b
  if (!y) return a
  return hex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t])
}
export const luma = (c: string | undefined) => { const v = rgb(c); return v ? (0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]) / 255 : 0.5 }
/* un color que se lea sobre ese fondo */
export const inkOn = (bg: string | undefined) => (luma(bg) > 0.55 ? '#0d1117' : '#f6f8fa')

/* ---------- xterm-256 ---------- */
const CUBE = [0, 95, 135, 175, 215, 255]
const near6 = (v: number) => { let best = 0; for (let i = 1; i < 6; i++) if (Math.abs(CUBE[i]! - v) < Math.abs(CUBE[best]! - v)) best = i; return best }
function to256(c: Rgb): string {
  const cube: Rgb = [CUBE[near6(c[0])]!, CUBE[near6(c[1])]!, CUBE[near6(c[2])]!]
  const avg = (c[0] + c[1] + c[2]) / 3
  const gi = Math.max(0, Math.min(23, Math.round((avg - 8) / 10)))
  const gray: Rgb = [8 + gi * 10, 8 + gi * 10, 8 + gi * 10]
  const d = (x: Rgb) => (x[0] - c[0]) ** 2 + (x[1] - c[1]) ** 2 + (x[2] - c[2]) ** 2
  return hex(d(gray) < d(cube) ? gray : cube)
}

/* ---------- 16 ANSI ---------- */
const ANSI: [string, Rgb][] = [
  ['black', [0, 0, 0]], ['red', [205, 49, 49]], ['green', [13, 188, 121]], ['yellow', [229, 229, 16]], ['blue', [36, 114, 200]],
  ['magenta', [188, 63, 188]], ['cyan', [17, 168, 205]], ['white', [229, 229, 229]], ['gray', [102, 102, 102]], ['redBright', [241, 76, 76]],
  ['greenBright', [35, 209, 139]], ['yellowBright', [245, 245, 67]], ['blueBright', [59, 142, 234]], ['magentaBright', [214, 112, 214]],
  ['cyanBright', [41, 184, 219]], ['whiteBright', [255, 255, 255]],
]
function hueOf(c: Rgb) {
  const [r, g, b] = c.map(v => v / 255) as Rgb
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn
  if (d < 0.08) return { h: -1, s: 0, v: mx }
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  h *= 60; if (h < 0) h += 360
  return { h, s: d / (mx || 1), v: mx }
}
/* por tono, no por distancia: un azul apagado sigue siendo azul y no gris */
function to16(c: Rgb, theme: 'dark' | 'light'): string {
  const { h, s, v } = hueOf(c)
  if (h < 0 || s < 0.18) {
    if (v > 0.82) return theme === 'dark' ? 'whiteBright' : 'gray'
    if (v > 0.55) return theme === 'dark' ? 'white' : 'gray'
    if (v > 0.28) return 'gray'
    return theme === 'dark' ? 'gray' : 'black'
  }
  const bright = v > 0.75 && theme === 'dark'
  const name = h < 20 || h >= 330 ? 'red' : h < 50 ? 'yellow' : h < 70 ? 'yellow' : h < 165 ? 'green' : h < 200 ? 'cyan' : h < 255 ? 'blue' : 'magenta'
  /* el naranja no existe en 16 colores: amarillo en oscuro, rojo claro en claro */
  if (h >= 20 && h < 45) return theme === 'dark' ? 'yellow' : 'redBright'
  return bright ? `${name}Bright` : name
}
export const ANSI_RGB: Record<string, Rgb> = Object.fromEntries(ANSI)

export type Painter = {
  depth: Depth
  theme: 'dark' | 'light'
  /* el color a pintar (undefined: el del terminal) */
  c: (hex: string | undefined | null) => string | undefined
  /* un color dual { claro, oscuro } elegido por el tema */
  dual: (c: Dual | undefined | null) => string | undefined
  tok: (name: string, fallback?: string) => string
  mix: (a: string | undefined, b: string | undefined, t: number) => string | undefined
  heat: (v: number | undefined) => string | undefined
}

export function painter(depth: Depth, theme: 'dark' | 'light', tokens: Record<string, string> | undefined, heat?: { lut: string[]; domain: [number, number] | null } | null): Painter {
  const cache = new Map<string, string | undefined>()
  const T = tokens ?? {}
  const DEF: Record<string, string> = theme === 'dark'
    ? { canvas: '#0d1117', ink: '#e6edf3', muted: '#9198a1', faint: '#6e7681', line: '#30363d', card: '#161b22', 'card-line': '#3d444d', accent: '#4493f8', add: '#3fb950', mod: '#d29922', del: '#f85149', warn: '#db6d28', neu: '#6e7681', lane: '#161a21', 'lane-line': '#262c34', group: '#13181f', 'group-line': '#3d444d' }
    : { canvas: '#ffffff', ink: '#1f2328', muted: '#59636e', faint: '#818b98', line: '#d1d9e0', card: '#ffffff', 'card-line': '#d1d9e0', accent: '#0969da', add: '#1a7f37', mod: '#9a6700', del: '#cf222e', warn: '#bc4c00', neu: '#818b98', lane: '#f6f8fa', 'lane-line': '#e6eaef', group: '#f6f8fa', 'group-line': '#d1d9e0' }
  const c = (h: string | undefined | null): string | undefined => {
    if (!h || depth === 'mono') return undefined
    const k = h
    if (cache.has(k)) return cache.get(k)
    const v = rgb(h)
    const out = !v ? (/^[a-z]+$/i.test(h) ? h : undefined) : depth === 'truecolor' ? hex(v) : depth === '256' ? to256(v) : to16(v, theme)
    cache.set(k, out)
    return out
  }
  const tok = (name: string, fallback?: string) => T[name] ?? DEF[name] ?? fallback ?? DEF.ink!
  const lut = heat?.lut ?? null
  const dom = heat?.domain ?? null
  return {
    depth, theme, c, tok, mix,
    dual: d => (d == null ? undefined : typeof d === 'string' ? d : theme === 'dark' ? d[1] : d[0]),
    heat: v => {
      if (v == null || !lut || !lut.length) return undefined
      const [a, b] = dom ?? [0, 100]
      const t = Math.max(0, Math.min(1, (v - a) / ((b - a) || 1)))
      const x = t * (lut.length - 1), i = Math.floor(x), f = x - i
      return f && i + 1 < lut.length ? mix(lut[i], lut[i + 1], f) : lut[i]
    },
  }
}
