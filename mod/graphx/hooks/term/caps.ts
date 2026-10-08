/* Lo que sabe hacer el terminal donde corre Claude Code, deducido de su entorno y del de la sesión.
 *
 *   color    truecolor · 256 · 16 · mono      COLORTERM, TERM, TERM_PROGRAM, NO_COLOR, FORCE_COLOR, el tema de Claude
 *   glyphs   unicode · basic · ascii           la configuración regional (UTF-8), TERM=linux, TERM=dumb
 *   braille  puntos 2×4 para curvas y series   unicode completo y un terminal que lo dibuja bien
 *   images   kitty · none                       el protocolo gráfico de kitty (kitty, Ghostty, WezTerm); nunca en tmux
 *   pointer  ratón                              el modo de pantalla completa de Claude Code
 *   motion   full · reduced · off              SSH o un multiplexor reducen; CLAUDE_CODE_REDUCED_MOTION o la opción, apagan
 *   theme    dark · light                      el tema de Claude Code; si no, COLORFGBG
 *
 * Cada decisión deja su motivo en `why`, que /graphx caps enseña. La opción del mod y /graphx caps <clave>=<valor>
 * mandan sobre lo detectado. */
import type { Caps } from '../../types'

export type Env = Partial<Record<
  'TERM' | 'COLORTERM' | 'TERM_PROGRAM' | 'TERM_PROGRAM_VERSION' | 'KITTY_WINDOW_ID' | 'GHOSTTY_RESOURCES_DIR' | 'WEZTERM_EXECUTABLE' | 'ITERM_SESSION_ID' |
  'VTE_VERSION' | 'WT_SESSION' | 'TMUX' | 'STY' | 'ZELLIJ' | 'SSH_CONNECTION' | 'SSH_TTY' | 'NO_COLOR' | 'FORCE_COLOR' | 'LANG' | 'LC_ALL' | 'LC_CTYPE' |
  'COLORFGBG' | 'KONSOLE_VERSION' | 'ALACRITTY_SOCKET' | 'TERMINAL_EMULATOR' | 'WARP_IS_LOCAL_SHELL_SESSION' | 'CLAUDE_CODE_REDUCED_MOTION', string>>

const TRUECOLOR_APPS = /^(iterm\.app|wezterm|ghostty|vscode|hyper|tabby|warpterminal|rio|zed|kitty|alacritty|contour|foot|cursor|windsurf)$/i

export function detectCaps(env: Env, o: { fullscreen?: boolean; claudeTheme?: string; surface?: string } = {}): Caps {
  const why: string[] = []
  const term = (env.TERM ?? '').toLowerCase()
  const app = env.TERM_PROGRAM ?? (env.KITTY_WINDOW_ID ? 'kitty' : env.GHOSTTY_RESOURCES_DIR ? 'ghostty' : env.WEZTERM_EXECUTABLE ? 'WezTerm' : env.WT_SESSION ? 'Windows Terminal' : env.KONSOLE_VERSION ? 'Konsole' : env.ALACRITTY_SOCKET ? 'Alacritty' : env.TERMINAL_EMULATOR ? env.TERMINAL_EMULATOR : env.VTE_VERSION ? 'VTE' : '')
  const mux = env.TMUX ? 'tmux' : env.STY ? 'screen' : env.ZELLIJ ? 'zellij' : term.startsWith('screen') || term.startsWith('tmux') ? 'tmux' : null
  const remote = !!(env.SSH_CONNECTION || env.SSH_TTY)
  const ansiTheme = /ansi/i.test(o.claudeTheme ?? '')

  /* color */
  let color: Caps['color']
  if (env.NO_COLOR != null && env.NO_COLOR !== '') { color = 'mono'; why.push('NO_COLOR: sin color') }
  else if (env.FORCE_COLOR != null && /^[0-3]$/.test(env.FORCE_COLOR)) { color = (['mono', '16', '256', 'truecolor'] as const)[+env.FORCE_COLOR]!; why.push(`FORCE_COLOR=${env.FORCE_COLOR}`) }
  else if (term === 'dumb') { color = 'mono'; why.push('TERM=dumb') }
  else if (/truecolor|24bit/i.test(env.COLORTERM ?? '')) { color = 'truecolor'; why.push(`COLORTERM=${env.COLORTERM}`) }
  else if (TRUECOLOR_APPS.test(app) || term.includes('kitty') || term.includes('ghostty') || term.endsWith('-direct') || env.WT_SESSION || (env.VTE_VERSION && +env.VTE_VERSION >= 3600) || env.KONSOLE_VERSION) { color = 'truecolor'; why.push(`${app || term}: color verdadero`) }
  else if (app === 'Apple_Terminal') { color = +(env.TERM_PROGRAM_VERSION ?? '0') >= 460 ? 'truecolor' : '256'; why.push(`Terminal.app ${env.TERM_PROGRAM_VERSION ?? ''}: ${color === '256' ? '256 colores' : 'color verdadero'}`) }
  else if (term.includes('256')) { color = '256'; why.push(`TERM=${term}`) }
  else if (/^(xterm|screen|tmux|vt1|vt2|linux|rxvt|ansi|cygwin)/.test(term)) { color = '16'; why.push(`TERM=${term}: 16 colores`) }
  else { color = term ? '16' : 'truecolor'; why.push(term ? `TERM=${term} desconocido: 16 colores` : 'sin TERM (escritorio o remoto): color verdadero') }
  if (ansiTheme && (color === 'truecolor' || color === '256')) { color = '16'; why.push(`tema de Claude «${o.claudeTheme}»: los 16 colores del terminal`) }

  /* glifos */
  const locale = `${env.LC_ALL ?? ''} ${env.LC_CTYPE ?? ''} ${env.LANG ?? ''}`
  let glyphs: Caps['glyphs'] = 'unicode'
  if (term === 'dumb' || /^vt(52|100|102)/.test(term)) { glyphs = 'ascii'; why.push(`TERM=${term}: solo ASCII`) }
  else if (term === 'linux' || term === 'cons25') { glyphs = 'basic'; why.push('consola de Linux: cajas simples, sin braille') }
  else if (locale.trim() && !/utf-?8/i.test(locale) && !app) { glyphs = 'basic'; why.push(`configuración regional sin UTF-8 (${locale.trim()})`) }
  else why.push('unicode completo')
  const braille = glyphs === 'unicode'

  /* imágenes: el protocolo de kitty, y solo donde llega (tmux no lo deja pasar) */
  let images: Caps['images'] = 'none'
  if (mux) why.push(`${mux}: sin imágenes (no deja pasar el protocolo gráfico)`)
  else if (/kitty/i.test(app) || term.includes('kitty') || /ghostty/i.test(app) || term.includes('ghostty')) { images = 'kitty'; why.push(`${app || term}: imágenes con el protocolo de kitty`) }
  else if (/wezterm/i.test(app)) { images = 'kitty'; why.push('WezTerm: imágenes con el protocolo de kitty') }
  const imageSource: Caps['imageSource'] = remote ? 'bytes' : 'file'
  if (images !== 'none' && remote) why.push('SSH: las imágenes viajan en bytes (el terminal no ve los ficheros de esta máquina)')

  /* ratón */
  const pointer = o.fullscreen === true || o.surface === 'desktop'
  why.push(pointer ? 'ratón: sí (pantalla completa)' : 'ratón: no (fuera de la pantalla completa solo el teclado)')
  const fine = pointer && /kitty|ghostty|iterm|wezterm|foot/i.test(app || term) && !mux

  /* movimiento */
  let motion: Caps['motion'] = 'full', fps = 8
  if (env.CLAUDE_CODE_REDUCED_MOTION && env.CLAUDE_CODE_REDUCED_MOTION !== '0') { motion = 'reduced'; why.push('CLAUDE_CODE_REDUCED_MOTION: movimiento reducido') }
  if (remote) { fps = 4; why.push('SSH: 4 fotogramas por segundo') }
  else if (mux) { fps = 6; why.push(`${mux}: 6 fotogramas por segundo`) }
  if (color === 'mono' || glyphs === 'ascii') { fps = Math.min(fps, 6) }
  if (o.surface === 'desktop') fps = 10

  /* tema */
  let theme: Caps['theme'] = 'dark'
  if (o.claudeTheme && /light/i.test(o.claudeTheme)) { theme = 'light'; why.push(`tema de Claude «${o.claudeTheme}»: claro`) }
  else if (o.claudeTheme && /dark/i.test(o.claudeTheme)) { theme = 'dark'; why.push(`tema de Claude «${o.claudeTheme}»: oscuro`) }
  else if (env.COLORFGBG) { const bg = +(env.COLORFGBG.split(';').pop() ?? '0'); theme = bg === 7 || bg === 15 ? 'light' : 'dark'; why.push(`COLORFGBG=${env.COLORFGBG}: ${theme === 'light' ? 'claro' : 'oscuro'}`) }

  return { color, glyphs, braille, images, imageSource, pointer, fine, motion, fps, theme, term: app || term || (o.surface ?? ''), remote, mux, why }
}

/* lo que la persona fuerza (opción del mod o /graphx caps clave=valor), encima de lo detectado */
export function withOverrides(c: Caps, over: Partial<Caps> | null | undefined): Caps {
  if (!over) return c
  const out = { ...c, why: [...c.why] }
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined || v === null || v === 'auto') continue
    ;(out as Record<string, unknown>)[k] = v
    out.why.push(`${k}=${String(v)} (forzado)`)
  }
  if (out.glyphs !== 'unicode') out.braille = false
  if (out.motion === 'off') out.fps = 2
  return out
}

/* para un ancho y alto, qué nivel de detalle toca: lo que el lienzo enseña en cada tamaño */
export function tierOf(cols: number, rows: number): 'micro' | 'narrow' | 'normal' | 'wide' {
  return cols < 40 || rows < 8 ? 'micro' : cols < 64 || rows < 12 ? 'narrow' : cols >= 132 && rows >= 18 ? 'wide' : 'normal'
}
