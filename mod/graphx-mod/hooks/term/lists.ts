/* Las vistas en filas: el árbol de ficheros (como `tree`, con insignias de extensión, cambios y carteles) y el
 * esquema, la forma de leer cualquier grafo cuando no hay anchura para dibujarlo: la jerarquía de carriles,
 * contenedores y piezas, cada fila con sus datos (calor, serie, progreso, alerta, estado, equipo) y, bajo la
 * fila del cursor, sus conexiones de entrada y de salida. */
import type { SNode, SRow, SSign, Scene } from '../../types'
import { BOLD, DIM, Grid, INV, ITALIC, UNDER } from './grid'
import { fit, strWidth } from './glyphs'
import { inkOn } from './paint'
import { fmtNum, spark } from './charts'
import { blastColor, edgeRate, nodeColor, type Look } from './graph'
import { tr } from '../i18n'

const TONE: Record<string, string> = { info: 'accent', tip: 'p2', ok: 'add', warn: 'warn', danger: 'del', note: 'muted', crit: 'del', good: 'add' }

/* ---------- árbol de ficheros ---------- */
export function drawTree(rows: SRow[], cols: number, h: number, top: number, cur: number, L: Look, signs: SSign[] | undefined, enterT: number | null): Grid {
  const P = L.P, G = L.G
  const g = new Grid(cols, h, G)
  const bg = L.canvasBg
  if (bg) g.fill(0, 0, cols - 1, h - 1, ' ', undefined, bg)
  const muted = P.c(P.tok('muted')), accent = P.c(P.tok('accent'))
  /* el camino del cursor: sus antepasados se iluminan, como al pasar por una tarjeta en el motor */
  const onPath = new Set<number>()
  const c = rows[cur]
  if (c) { let d = c.d; for (let i = cur - 1; i >= 0 && d > 0; i--) if (rows[i]!.d < d) { onPath.add(i); d = rows[i]!.d } }
  for (let y = 0; y < h; y++) {
    const i = top + y
    const r = rows[i]
    if (!r) break
    if (enterT != null && L.motion && L.t - enterT < i * 18) continue
    const on = i === cur
    let x = 0
    x += g.text(x, y, on ? `${G.sel} ` : '  ', accent, bg, BOLD)
    const rails = r.rl.slice(1).map(v => (v ? (G.name === 'ascii' ? '| ' : '│ ') : '  ')).join('')
    const conn = r.d === 0 ? '' : r.la ? (G.name === 'ascii' ? '`-' : '╰─') : (G.name === 'ascii' ? '|-' : '├─')
    x += g.text(x, y, rails + conn, onPath.has(i) || on ? accent : muted, bg, onPath.has(i) || on ? 0 : DIM)
    g.markRect(0, y, cols - 1, y, r.i)
    if (r.mo) { g.text(x, y, tr(` ${G.ellipsis} ${r.mo} más`, ` ${G.ellipsis} ${r.mo} more`), muted, bg, DIM); continue }
    if (r.fo) x += g.text(x, y, (r.o ? G.caretD : G.caretR) + ' ', accent, bg)
    else {
      const bc = r.c ?? P.tok('faint')
      x += g.text(x, y, ' ', undefined, bg)
      x += g.text(x, y, ` ${fit(r.b ?? '·', 4)} `, P.c(inkOn(bc)), P.c(bc), BOLD)
      x += g.text(x, y, ' ', undefined, bg)
    }
    const dc = r.dl === 'added' ? P.tok('add') : r.dl === 'modified' ? P.tok('mod') : r.dl === 'removed' ? P.tok('del') : undefined
    x += g.text(x, y, fit(r.l ?? r.i, Math.max(4, cols - x - 2)), on ? accent : r.fo ? P.c(P.tok('ink')) : P.c(dc) ?? P.c(P.tok('ink')), bg, (r.fo || on ? BOLD : 0) | (P.depth === 'mono' && on ? INV : 0) | (r.dl === 'removed' ? DIM : 0))
    const meta: { t: string; fg?: string; a?: number }[] = []
    if (r.fo) {
      if (r.fc != null) meta.push({ t: tr(`  ${r.fc} fich.`, `  ${r.fc} file${r.fc === 1 ? '' : 's'}`), fg: muted, a: DIM })
      if (r.cg) meta.push({ t: tr(` · ${r.cg} cambio${r.cg === 1 ? '' : 's'}`, ` · ${r.cg} change${r.cg === 1 ? '' : 's'}`), fg: P.c(P.tok('mod')) })
      if (!r.o && r.k) meta.push({ t: `  +${r.k}`, fg: accent })
    } else {
      if (r.s) meta.push({ t: `  ${r.s}`, fg: muted, a: DIM })
      if (r.ad) meta.push({ t: `  +${fmtNum(r.ad)}`, fg: P.c(P.tok('add')) })
      if (r.de) meta.push({ t: ` −${fmtNum(r.de)}`, fg: P.c(P.tok('del')) })
    }
    for (const s of (signs ?? []).filter(s2 => s2.at === r.i)) meta.push({ t: `  ◀ ${s.pin} ${G.tones[s.tn] ?? ''} ${s.t ? s.t + ': ' : ''}${s.x}`, fg: P.c(P.tok(TONE[s.tn] ?? 'accent')) })
    for (const m of meta) { const room = cols - x; if (room <= 1) break; x += g.text(x, y, fit(m.t, room), m.fg, bg, m.a ?? 0) }
  }
  return g
}

/* ---------- esquema ---------- */
export type OutRow = { id: string; depth: number; node?: SNode; lane?: string; label: string; open?: boolean; kids?: number; link?: { dir: 'in' | 'out'; other: string; kind?: string; label?: string } }
export function outlineRows(s: Scene, cur: string | null): OutRow[] {
  const nodes = s.nodes ?? []
  const byParent = new Map<string, SNode[]>()
  const ids = new Set(nodes.map(n => n.i))
  for (const n of nodes) {
    if (n.ln) continue
    const p = n.p != null && ids.has(n.p) && !nodes.find(x => x.i === n.p)?.ln ? n.p : n.la ? '§' + n.la : '§'
    if (!byParent.has(p)) byParent.set(p, [])
    byParent.get(p)!.push(n)
  }
  /* en el orden en que se lee: un grafo de izquierda a derecha, por columnas; lo demás, por filas */
  const across = s.dir !== 'down'
  const geo = (a: SNode, b: SNode) => across ? a.x - b.x || a.y - b.y : a.y - b.y || a.x - b.x
  const side = (a: SNode, b: SNode) => across ? a.y - b.y || a.x - b.x : a.x - b.x || a.y - b.y
  const flows = s.mode === 'graph' || s.mode === 'sankey'
  const byId = new Map(nodes.map(n => [n.i, n]))
  for (const [key, l] of byParent) {
    if (!flows) { l.sort((a, b) => a.y - b.y || a.x - b.x); continue }
    /* un grafo, siguiendo sus flechas (de lo que no tiene entradas, y los hermanos en el orden del dibujo): un árbol o un mindmap se leen de la raíz a las hojas */
    const mine = new Set(l.map(n => n.i))
    const lift = (id: string) => { let c = byId.get(id); for (let k = 0; c && k < 40; k++) { if (mine.has(c.i)) return c.i; c = c.p ? byId.get(c.p) : undefined } return null }
    const next = new Map<string, Set<string>>(), indeg = new Map<string, number>()
    for (const e of s.edges ?? []) {
      const a = lift(e.a), b = lift(e.b)
      if (!a || !b || a === b || next.get(a)?.has(b)) continue
      if (!next.has(a)) next.set(a, new Set())
      next.get(a)!.add(b); indeg.set(b, (indeg.get(b) ?? 0) + 1)
    }
    const seen = new Set<string>(), order: SNode[] = []
    const visit = (n: SNode) => { if (seen.has(n.i)) return; seen.add(n.i); order.push(n); [...(next.get(n.i) ?? [])].map(i => byId.get(i)!).sort(side).forEach(visit) }
    const sorted = [...l].sort(geo)
    sorted.filter(n => !indeg.get(n.i)).forEach(visit)
    sorted.forEach(visit)
    byParent.set(key, order)
  }
  const out: OutRow[] = []
  const walk = (key: string, depth: number) => {
    for (const n of byParent.get(key) ?? []) {
      const open = !!n.o
      out.push({ id: n.i, depth, node: n, label: n.l, open, kids: n.k })
      if (n.i === cur) {
        for (const e of s.edges ?? []) {
          if (e.a === n.i) out.push({ id: `${n.i}→${e.i}`, depth: depth + 1, label: '', link: { dir: 'out', other: e.b, kind: e.k, label: e.l } })
          else if (e.b === n.i) out.push({ id: `${n.i}←${e.i}`, depth: depth + 1, label: '', link: { dir: 'in', other: e.a, kind: e.k, label: e.l } })
        }
      }
      if (open && byParent.has(n.i)) walk(n.i, depth + 1)
    }
  }
  /* las calles: las de la escena y, si no vienen (las ramas de un gitGraph), las piezas que son calle */
  const lanes: { i: string; l: string }[] = [...(s.lanes ?? [])]
  for (const n of nodes) if (n.ln && !lanes.some(l => l.i === n.i)) lanes.push({ i: n.i, l: n.l })
  for (const ln of lanes) { if (!byParent.has('§' + ln.i)) continue; out.push({ id: '§' + ln.i, depth: 0, lane: ln.i, label: ln.l }); walk('§' + ln.i, 1) }
  walk('§', 0)
  return out
}
export function drawOutline(s: Scene, rows: OutRow[], cols: number, h: number, top: number, cur: number, L: Look): Grid {
  const P = L.P, G = L.G
  const g = new Grid(cols, h, G)
  const bg = L.canvasBg
  if (bg) g.fill(0, 0, cols - 1, h - 1, ' ', undefined, bg)
  const muted = P.c(P.tok('muted')), accent = P.c(P.tok('accent')), ink = P.c(P.tok('ink'))
  const labels = s.model?.labels ?? {}
  for (let y = 0; y < h; y++) {
    const i = top + y
    const r = rows[i]
    if (!r) break
    const on = i === cur
    let x = g.text(0, y, on ? `${G.sel} ` : '  ', accent, bg, BOLD)
    x += g.text(x, y, '  '.repeat(r.depth), undefined, bg)
    g.markRect(0, y, cols - 1, y, r.link ? (r.link.other) : r.id)
    if (r.lane) {
      const ln = (s.lanes ?? []).find(l => l.i === r.lane) ?? (s.nodes ?? []).find(n => n.i === r.lane)
      x += g.text(x, y, fit(r.label.toUpperCase(), cols - x - 1), P.c(P.dual(ln?.c)) ?? muted, bg, BOLD)
      continue
    }
    if (r.link) {
      const arrow = r.link.dir === 'out' ? `${G.head.r} ` : `${G.head.l} `
      x += g.text(x, y, arrow, P.c(P.tok(r.link.dir === 'out' ? 'accent' : 'muted')), bg)
      x += g.text(x, y, fit(labels[r.link.other] ?? r.link.other, cols - x - 14), ink, bg, UNDER)
      if (r.link.label) x += g.text(x, y, fit(`  ${r.link.label}`, cols - x - 1), muted, bg, ITALIC | DIM)
      else if (r.link.kind) x += g.text(x, y, `  ${r.link.kind}`, muted, bg, DIM)
      continue
    }
    const n0 = r.node!
    const n = L.data?.[n0.i] ? ({ ...n0, ...L.data[n0.i] } as SNode) : n0
    const col = L.blast?.has(n.i) ? blastColor(P, L.blast.get(n.i)!) : (L.fx.heat && n.hv != null ? P.heat(n.hv) : nodeColor(n, L))
    const dim = (L.lit && L.lit.size && !L.lit.has(n.i)) || (L.blast && !L.blast.has(n.i)) || !!n.dm
    const icon = G.icons[n.sh ?? ''] ?? G.icons[n.kd ?? ''] ?? G.bullet
    x += g.text(x, y, n.k ? (n.o ? G.caretD : G.caretR) + ' ' : '  ', accent, bg)
    x += g.text(x, y, icon + ' ', P.c(col) ?? muted, bg)
    const pulsing = L.fx.alerts && (n.al === 'crit' || n.al === 'warn') && L.motion && Math.floor(L.t / 520) % 2 === 0
    x += g.text(x, y, fit(n.l, Math.max(6, Math.floor(cols * 0.45) - x)), on ? accent : pulsing ? P.c(P.tok(TONE[n.al!] ?? 'warn')) : ink, bg, BOLD | (dim ? DIM : 0) | (on && P.depth === 'mono' ? INV : 0))
    if (n.k && !n.o) x += g.text(x, y, ` +${n.k}`, accent, bg)
    /* datos, de derecha a izquierda según quepan */
    const bits: { t: string; fg?: string; bg?: string; a?: number }[] = []
    if (L.fx.alerts && n.al) bits.push({ t: ` ${G.tones[n.al] ?? G.warn}`, fg: P.c(P.tok(TONE[n.al] ?? 'warn')), a: BOLD })
    if (n.st) bits.push({ t: ` ${n.st}`, fg: P.c(P.dual(n.stc)) ?? muted })
    if (L.fx.heat && n.hv != null) { const hc = P.heat(n.hv); bits.push({ t: ` ${fmtNum(n.hv)} `, fg: P.c(inkOn(hc)), bg: P.c(hc), a: BOLD }) }
    if (L.fx.spark && n.sp && n.sp.length > 1) bits.push({ t: ' ' + spark(n.sp, 8, G), fg: P.c(col ?? P.tok('accent')) })
    if (n.v != null && (n.sh === 'kpi' || n.sh === 'gauge')) bits.push({ t: ` ${fmtNum(n.v, n.dc)}${n.u ?? ''}`, fg: ink, a: BOLD })
    if (L.fx.progress && n.pr != null) bits.push({ t: ` ${Math.round(n.pr * 100)}%`, fg: P.c(n.pr >= 1 ? P.tok('add') : P.tok('accent')) })
    if (L.fx.owners && n.ow) { const o = s.owners?.[n.ow]; const oc = o?.color ?? P.tok('p2', P.tok('accent')); bits.push({ t: ` ${(o?.short ?? n.ow.slice(0, 2)).toUpperCase()} `, fg: P.c(inkOn(oc)), bg: P.c(oc), a: BOLD }) }
    if (n.dl) bits.push({ t: ` ${n.dl === 'added' ? '+' : n.dl === 'removed' ? '−' : '~'}`, fg: P.c(P.tok(n.dl === 'added' ? 'add' : n.dl === 'removed' ? 'del' : 'mod')), a: BOLD })
    const room = cols - x - 1
    let tail = 0; const keep: typeof bits = []
    for (const b of bits) { const w = strWidth(b.t); if (tail + w > room) break; keep.push(b); tail += w }
    let bx = cols - tail
    for (const b of keep) bx += g.text(bx, y, b.t, b.fg, b.bg ?? bg, b.a ?? 0)
    void edgeRate
  }
  return g
}
