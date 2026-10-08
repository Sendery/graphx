/* Los caracteres con los que se dibuja, según lo que sepa pintar el terminal.
 *
 *   unicode  dibujo de cajas completo (redondeado, grueso, doble, discontinuo), bloques, braille, flechas
 *   basic    lo que lleva una consola de Linux o una fuente pobre: cajas simples, bloques llenos, sin braille
 *   ascii    solo ASCII: + - | > v < ^ # . o
 *
 * Todos son de una celda de ancho: nada de emoji, que cada terminal pinta a su manera. */
import type { Caps } from '../../types'

export type Box = { tl: string; t: string; tr: string; l: string; r: string; bl: string; b: string; br: string }
export type Glyphs = {
  name: Caps['glyphs']
  box: Record<'round' | 'sharp' | 'heavy' | 'double' | 'dashed' | 'dotted' | 'group', Box>
  /* tramos de arista resueltos por sus bits (arriba 1, abajo 2, izquierda 4, derecha 8) */
  line: Record<'thin' | 'heavy' | 'dashed' | 'double', Record<number, string>>
  head: { r: string; d: string; l: string; u: string }
  headOpen: { r: string; d: string; l: string; u: string }
  ends: Record<string, string>
  spark: string[]
  bar: { full: string; parts: string[]; empty: string; heavy: string; light: string }
  shade: string[]
  half: { top: string; bottom: string; full: string }
  dot: string
  dotHollow: string
  particle: string[]
  bullet: string
  ellipsis: string
  diamond: string
  diamondHollow: string
  check: string
  cross: string
  warn: string
  info: string
  tip: string
  note: string
  up: string
  down: string
  play: string
  pause: string
  stop: string
  prev: string
  next: string
  caretR: string
  caretD: string
  sel: string
  vbar: string
  cursor: string
  wave: string
  faces: string[]
  icons: Record<string, string>
  tones: Record<string, string>
}

const B = (s: string): Box => { const c = [...s]; return { tl: c[0]!, t: c[1]!, tr: c[2]!, l: c[3]!, r: c[4]!, bl: c[5]!, b: c[6]!, br: c[7]! } }
const lineMap = (v: string, h: string, corners: string, tees: string, cross: string): Record<number, string> => {
  const [dr, dl, ur, ul] = [...corners] as string[]
  const [tr, tl, td, tu] = [...tees] as string[]
  return { 1: v, 2: v, 3: v, 4: h, 8: h, 12: h, 10: dr!, 6: dl!, 9: ur!, 5: ul!, 11: tr!, 7: tl!, 14: td!, 13: tu!, 15: cross }
}

const ICONS_U: Record<string, string> = {
  service: '⚙', app: '▣', module: '◫', function: 'ƒ', method: 'ƒ', class: '◇', file: '▤', folder: '▰', route: '↦', job: '⟳', queue: '≡',
  datastore: '⛁', cache: '↯', external: '⇱', ui: '▢', config: '⚑', test: '✓', package: '▧', decision: '◆', step: '▹', other: '•',
  user: '☺', actor: '☺', person: '☺', mobile: '▯', cloud: '◠', lock: '⊠', key: '⚷', shield: '⛉', card: '▭', cart: '⊻', search: '⌕', mail: '✉',
  bell: '◬', cpu: '▦', bug: '✱', branch: '⑂', chart: '▥', gauge: '◔', group: '▾', lane: '▤', note: '✎', participant: '▢', table: '▦',
  entity: '▦', requirement: '⊡', commit: '●', task: '▹', milestone: '◆', event: '◇', state: '○', start: '●', end: '◉', choice: '◇', fork: '━',
  junction: '•', container: '▣', component: '◫', system: '▣', boundary: '⬚', node: '▣', deployment: '▣', db: '⛁',
}
const ICONS_A: Record<string, string> = {
  service: '*', app: '#', module: '%', function: 'f', method: 'f', class: '<>', file: '=', folder: '/', route: '>', job: '@', queue: '=',
  datastore: 'D', cache: '!', external: '^', ui: '[]', config: '%', test: 'v', package: '#', decision: '<>', step: '>', other: '.',
  user: '@', actor: '@', person: '@', group: 'v', lane: '=', note: '~', commit: 'o', start: 'o', end: '@', choice: '<>',
}

export function glyphs(kind: Caps['glyphs']): Glyphs {
  if (kind === 'ascii') {
    const sq = B('+-+||+-+')
    const thin = lineMap('|', '-', '++++', '++++', '+')
    return {
      name: 'ascii',
      box: { round: B('.-.||\'-\''), sharp: sq, heavy: B('#=#HH#=#'), double: B('#=#HH#=#'), dashed: B('+-+::+-+'), dotted: B('.....:.:'), group: B('+-+||+-+') },
      line: { thin, heavy: lineMap('H', '=', '####', '####', '#'), dashed: lineMap(':', '-', '++++', '++++', '+'), double: lineMap('H', '=', '####', '####', '#') },
      head: { r: '>', d: 'v', l: '<', u: '^' }, headOpen: { r: '>', d: 'v', l: '<', u: '^' },
      ends: { arrow: '>', triangle: '>', open: '>', diamond: '<>', odiamond: '<>', circle: 'o', cross: 'x', lollipop: 'o', one: '|', 'zero-one': 'o', 'one-many': '<', 'zero-many': '<' },
      spark: ['_', '_', '.', '-', '-', '=', '^', '^'], bar: { full: '#', parts: ['#'], empty: '.', heavy: '=', light: '-' }, shade: ['.', ':', '+', '#'],
      half: { top: '"', bottom: '_', full: '#' }, dot: 'o', dotHollow: 'o', particle: ['*', 'o', '.'], bullet: '*', ellipsis: '~', diamond: '<>', diamondHollow: '<>',
      check: 'v', cross: 'x', warn: '!', info: 'i', tip: '*', note: '~', up: '^', down: 'v', play: '>', pause: '=', stop: '#', prev: '<', next: '>',
      caretR: '>', caretD: 'v', sel: '>', vbar: '|', cursor: '|', wave: '~', faces: [':(', ':(', ':|', ':)', ':D'], icons: ICONS_A,
      tones: { info: 'i', tip: '*', ok: 'v', warn: '!', danger: 'x', note: '~', crit: 'x', good: 'v' },
    }
  }
  const basic = kind === 'basic'
  const thin = lineMap('│', '─', basic ? '┌┐└┘' : '╭╮╰╯', '├┤┬┴', '┼')
  return {
    name: kind,
    box: {
      round: basic ? B('┌─┐││└─┘') : B('╭─╮││╰─╯'), sharp: B('┌─┐││└─┘'), heavy: basic ? B('╔═╗║║╚═╝') : B('┏━┓┃┃┗━┛'), double: B('╔═╗║║╚═╝'),
      dashed: basic ? B('┌─┐││└─┘') : B('╭┄╮┆┆╰┄╯'), dotted: basic ? B('┌─┐││└─┘') : B('╭┈╮┊┊╰┈╯'), group: basic ? B('┌─┐││└─┘') : B('╭─╮││╰─╯'),
    },
    line: {
      thin,
      heavy: basic ? lineMap('║', '═', '╔╗╚╝', '╠╣╦╩', '╬') : lineMap('┃', '━', '┏┓┗┛', '┣┫┳┻', '╋'),
      dashed: basic ? thin : Object.assign({}, thin, { 1: '┆', 2: '┆', 3: '┆', 4: '┄', 8: '┄', 12: '┄' }),
      double: lineMap('║', '═', '╔╗╚╝', '╠╣╦╩', '╬'),
    },
    head: basic ? { r: '►', d: '▼', l: '◄', u: '▲' } : { r: '▶', d: '▼', l: '◀', u: '▲' },
    headOpen: basic ? { r: '>', d: 'v', l: '<', u: '^' } : { r: '▷', d: '▽', l: '◁', u: '△' },
    ends: basic
      ? { arrow: '►', triangle: '►', open: '>', diamond: '♦', odiamond: '◊', circle: 'o', cross: 'x', lollipop: 'o', one: '│', 'zero-one': 'o', 'one-many': '<', 'zero-many': '<' }
      : { arrow: '▶', triangle: '▷', open: '›', diamond: '◆', odiamond: '◇', circle: '●', cross: '✕', lollipop: '○', one: '┤', 'zero-one': '○', 'one-many': '⋲', 'zero-many': '⋲' },
    spark: basic ? ['_', '▄', '▄', '▄', '█', '█', '█', '█'] : ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'],
    bar: basic ? { full: '█', parts: ['▌', '█'], empty: '░', heavy: '═', light: '─' } : { full: '█', parts: ['▏', '▎', '▍', '▌', '▋', '▊', '▉', '█'], empty: '░', heavy: '━', light: '─' },
    shade: ['░', '▒', '▓', '█'],
    half: { top: '▀', bottom: '▄', full: '█' },
    dot: '●', dotHollow: '○', particle: basic ? ['•', '∙', '·'] : ['●', '•', '∙'], bullet: '•', ellipsis: '…', diamond: '◆', diamondHollow: '◇',
    check: '✓', cross: '✕', warn: basic ? '!' : '⚠', info: basic ? 'i' : 'ℹ', tip: basic ? '*' : '✦', note: basic ? '~' : '✎', up: '▲', down: '▼',
    play: '▶', pause: basic ? '‖' : '⏸', stop: '■', prev: '◀', next: '▶', caretR: basic ? '►' : '▸', caretD: basic ? '▼' : '▾', sel: '❯', vbar: '┃', cursor: '┃', wave: '∿',
    faces: basic ? [':(', ':(', ':|', ':)', ':D'] : ['☹', '☹', '◒', '☺', '☻'],
    icons: basic ? Object.fromEntries(Object.entries(ICONS_U).map(([k, v]) => [k, /[⚙⛁⚡⇱⚑⚷⛉⌕✉◬⑂◔⊻✱☺◠✎⬚]/.test(v) ? (ICONS_A[k] ?? '•') : v])) : ICONS_U,
    tones: basic ? { info: 'i', tip: '*', ok: '√', warn: '!', danger: 'x', note: '~', crit: 'x', good: '√' } : { info: 'ℹ', tip: '✦', ok: '✓', warn: '⚠', danger: '✕', note: '✎', crit: '✕', good: '✓' },
  }
}

/* el ancho de un carácter en celdas: 0 (marcas combinantes), 1 o 2 (CJK, emoji) */
export function cw(cp: number): number {
  if (cp === 0 || (cp >= 0x300 && cp <= 0x36f) || (cp >= 0x200b && cp <= 0x200f) || cp === 0xfe0f || cp === 0xfe0e) return 0
  if ((cp >= 0x1100 && cp <= 0x115f) || (cp >= 0x2e80 && cp <= 0xa4cf && cp !== 0x303f) || (cp >= 0xac00 && cp <= 0xd7a3) || (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe4f) || (cp >= 0xff00 && cp <= 0xff60) || (cp >= 0xffe0 && cp <= 0xffe6) || (cp >= 0x1f300 && cp <= 0x1faff) || (cp >= 0x20000 && cp <= 0x3fffd)) return 2
  return 1
}
export function strWidth(s: string): number { let n = 0; for (const ch of s) n += cw(ch.codePointAt(0) ?? 0); return n }
/* corta un texto a `n` celdas, con puntos suspensivos si no cabe */
export function fit(s: string, n: number, ell = '…'): string {
  if (n <= 0) return ''
  if (strWidth(s) <= n) return s
  let out = '', w = 0
  for (const ch of s) { const c = cw(ch.codePointAt(0) ?? 0); if (w + c > n - 1) break; out += ch; w += c }
  return out + ell
}
/* parte un texto en líneas de `n` celdas como mucho, por palabras */
export function wrap(s: string, n: number, max = 99): string[] {
  const out: string[] = []
  for (const para of String(s).split('\n')) {
    let line = ''
    for (const word of para.split(/\s+/).filter(Boolean)) {
      if (!line) line = word
      else if (strWidth(line) + 1 + strWidth(word) <= n) line += ' ' + word
      else { out.push(line); line = word }
      while (strWidth(line) > n) { out.push(fit(line, n, '')); line = [...line].slice([...fit(line, n, '')].length).join('') }
      if (out.length >= max) break
    }
    if (line) out.push(line)
    if (out.length >= max) break
  }
  if (out.length > max) out.length = max
  return out
}
