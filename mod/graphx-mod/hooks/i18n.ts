/* El idioma de la interfaz del mod: español o inglés.
 *
 *   tr('Siguiente', 'Next')     el texto en el idioma de ahora; las dos versiones van juntas en el sitio donde se usan
 *
 * Lo decide pickLang: la opción `language` del mod, si no el idioma de Claude Code (`language` en su configuración),
 * si no la configuración regional (LC_ALL, LC_MESSAGES, LANG) y, si nada lo dice, inglés. Cada módulo lo fija con
 * setLang (los hooks al detectar, el lienzo con caps.lang en cada fotograma). */
export type Lang = 'es' | 'en'

let cur: Lang = 'en'
export function setLang(l: Lang | undefined | null) { if (l === 'es' || l === 'en') cur = l }
export function getLang(): Lang { return cur }
export function tr(es: string, en: string): string { return cur === 'es' ? es : en }

/* «Spanish», «español», «es», «es_ES.UTF-8» → es; «English», «en_US» → en; lo demás, nada */
export function langOf(v: unknown): Lang | null {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : ''
  if (!s || s === 'auto') return null
  if (/^(es|spa)([_.@-]|$)|spanish|español|espanol|castellano/.test(s)) return 'es'
  if (/^en([_.@-]|$)|english|inglés|ingles/.test(s)) return 'en'
  return null
}

export function pickLang(o: { option?: unknown; claude?: unknown; env?: Partial<Record<'LC_ALL' | 'LC_MESSAGES' | 'LANG', string>> }): { lang: Lang; why: string } {
  const opt = langOf(o.option)
  if (opt) return { lang: opt, why: `language=${opt} (opción del mod / mod option)` }
  const cc = langOf(o.claude)
  if (cc) return { lang: cc, why: `Claude Code language «${String(o.claude)}»` }
  for (const k of ['LC_ALL', 'LC_MESSAGES', 'LANG'] as const) {
    const l = langOf(o.env?.[k])
    if (l) return { lang: l, why: `${k}=${o.env?.[k]}` }
  }
  return { lang: 'en', why: 'English by default' }
}
