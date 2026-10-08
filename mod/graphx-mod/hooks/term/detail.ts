/* El panel de detalle en celdas: lo que el motor enseña en su panel lateral al pulsar una pieza.
 *
 * Migas de pan, título con su icono, estado y delta, resumen, los datos de los efectos (calor, serie, progreso,
 * alerta, equipo), métricas, notas, los bloques ricos (text, heading, divider, quote, callout, code, kv, list,
 * checklist, steps, badges, table, stats, spark, chart, bars, progress, gauge, donut, kpi, timeline, heatstrip,
 * image), la vecindad (entradas · pieza · salidas), ficheros y enlaces. Devuelve las líneas ya dibujadas en una
 * rejilla del ancho del panel; el lienzo la desplaza. */
import type { Detail, SNode, Scene } from '../../types'
import { BOLD, DIM, Grid, ITALIC, UNDER } from './grid'
import { fit, strWidth, wrap, type Glyphs } from './glyphs'
import { inkOn, type Painter } from './paint'
import { bars, brailleSpark, donutCells, fmtNum, spark } from './charts'
import type { Look } from './graph'
import { tr } from '../i18n'

type Line = (g: Grid, y: number) => void
const TONES: Record<string, string> = { info: 'accent', warn: 'warn', good: 'add', ok: 'add', crit: 'del', danger: 'del', tip: 'p2', note: 'muted', done: 'add', active: 'accent', todo: 'faint' }
const md = (s: unknown) => String(s ?? '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/(^|\s)\*([^*\s][^*]*)\*/g, '$1$2').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/<[^>]+>/g, '')

export function drawDetail(s: Scene, n: SNode | null, d: Detail | null, w: number, L: Look, opts: { title?: boolean } = {}): Grid {
  const P = L.P, G = L.G
  const lines: Line[] = []
  const ink = P.c(P.tok('ink')), muted = P.c(P.tok('muted')), faint = P.c(P.tok('faint')), accent = P.c(P.tok('accent'))
  const bg = L.canvasBg
  const W = Math.max(10, w - 1)
  const push = (f: Line) => lines.push(f)
  const text = (t: string, fg?: string, a = 0, indent = 0) => { for (const l of wrap(md(t), W - indent, 60)) push((g, y) => { g.text(indent, y, l, fg, bg, a) }) }
  const gap = () => push(() => { })
  const head = (t: string) => { gap(); push((g, y) => { g.text(0, y, fit(t.toUpperCase(), W), muted, bg, BOLD | DIM) }) }

  if (!n && !d) {
    /* sin selección: el diagrama */
    if (opts.title !== false) text(s.title || 'GraphX', ink, BOLD)
    if (s.sm) text(s.sm, muted)
    const nodes = (s.nodes ?? []).filter(x => !x.g)
    gap()
    { const ne = (s.edges ?? []).length, nl = (s.lanes ?? []).length; text(tr(`${nodes.length} piezas visibles · ${ne} aristas${nl ? ` · ${nl} carriles` : ''}`, `${nodes.length} visible nodes · ${ne} edge${ne === 1 ? '' : 's'}${nl ? ` · ${nl} lane${nl === 1 ? '' : 's'}` : ''}`), muted) }
    if (s.diagram) text(tr(`Tipo: ${s.diagram}`, `Type: ${s.diagram}`), faint)
    legend(s, lines, W, L)
    return render(lines, w, L)
  }
  const node = n
  if (d?.path?.length) push((g, y) => { g.text(0, y, fit(d.path!.map(p => p.l).join(' › '), W), faint, bg, DIM) })
  const icon = G.icons[node?.sh ?? d?.sh ?? ''] ?? G.icons[node?.kd ?? d?.kd ?? ''] ?? ''
  const title = `${icon ? icon + ' ' : ''}${d?.l ?? node?.l ?? ''}`
  for (const l of wrap(title, W, 3)) push((g, y) => { g.text(0, y, l, accent, bg, BOLD) })
  const sub = d?.s ?? node?.s
  if (sub) text(sub, muted)
  const chips: { t: string; c: string }[] = []
  if (d?.st || node?.st) chips.push({ t: String(d?.st ?? node?.st), c: P.dual(node?.stc) ?? P.tok('accent') })
  if (node?.dl) chips.push({ t: node.dl === 'added' ? tr('nuevo', 'new') : node.dl === 'removed' ? tr('eliminado', 'removed') : tr('modificado', 'modified'), c: P.tok(node.dl === 'added' ? 'add' : node.dl === 'removed' ? 'del' : 'mod') })
  if (node?.al) chips.push({ t: tr(`alerta ${node.al}`, `alert ${node.al}`), c: P.tok(TONES[node.al] ?? 'warn') })
  if (d?.owner) chips.push({ t: d.owner.l, c: s.owners?.[d.owner.i]?.color ?? P.tok('p2', P.tok('accent')) })
  if (d?.kd || node?.kd) chips.push({ t: String(d?.kd ?? node?.kd), c: P.tok('faint') })
  if (chips.length) push((g, y) => { let x = 0; for (const c of chips) { if (x + strWidth(c.t) + 3 > W) break; x += g.text(x, y, ` ${c.t} `, P.c(inkOn(c.c)), P.c(c.c), BOLD) + 1 } })
  if (d?.edge) {
    text(`${d.from} ${G.head.r} ${d.to}${d.k ? `  (${d.k})` : ''}`, ink)
    if (d.r != null) text(tr(`Caudal: ${fmtNum(d.r)}`, `Flow: ${fmtNum(d.r)}`), muted)
  }
  const sm = d?.sm || node?.sm
  if (sm) { gap(); text(sm, ink) }
  if (d?.html) { gap(); text(d.html, muted) }

  /* los datos de los efectos */
  if (node && (node.hv != null || node.sp || node.pr != null || node.v != null)) {
    head(tr('Datos', 'Data'))
    if (node.hv != null) push((g, y) => { const hc = P.heat(node.hv); const x = g.text(0, y, `${s.heat?.label ?? tr('Calor', 'Heat')}: `, muted, bg); g.text(x, y, ` ${fmtNum(node.hv!)}${s.heat?.unit ? ' ' + s.heat.unit : ''} `, P.c(inkOn(hc)), P.c(hc), BOLD) })
    if (node.sp && node.sp.length > 1) {
      if (G.name === 'unicode' && L.P.depth !== 'mono') { push(() => { }); push(() => { }); const at = lines.length - 2; lines[at] = (g, y) => brailleSpark(g, 0, y, Math.min(W - 10, 36), 2, node.sp!, P.c(P.tok('accent'))); lines[at + 1] = (g, y) => { g.text(Math.min(W - 10, 36) + 1, y - 1, `${fmtNum(node.sp![node.sp!.length - 1]!)}${node.u ? ' ' + node.u : ''}`, ink, bg, BOLD); g.text(Math.min(W - 10, 36) + 1, y, tr(`min ${fmtNum(Math.min(...node.sp!))} · máx ${fmtNum(Math.max(...node.sp!))}`, `min ${fmtNum(Math.min(...node.sp!))} · max ${fmtNum(Math.max(...node.sp!))}`), faint, bg, DIM) } }
      else push((g, y) => { g.text(0, y, spark(node.sp!, Math.min(W - 8, 30), G), P.c(P.tok('accent')), bg); g.text(Math.min(W - 8, 30) + 1, y, fmtNum(node.sp![node.sp!.length - 1]!), ink, bg, BOLD) })
    }
    if (node.pr != null) push((g, y) => { const bw = Math.min(W - 6, 30), f = Math.round(Math.max(0, Math.min(1, node.pr!)) * bw); for (let x = 0; x < bw; x++) g.set(x, y, x < f ? G.bar.full : G.bar.empty, P.c(x < f ? (node.pr! >= 1 ? P.tok('add') : P.tok('accent')) : P.tok('line')), bg); g.text(bw + 1, y, `${Math.round(node.pr! * 100)}%`, ink, bg, BOLD) })
    if (node.v != null && !node.sp) text(`${tr('Valor', 'Value')}: ${fmtNum(node.v, node.dc)}${node.u ? ' ' + node.u : ''}${node.ch != null ? `  ${node.ch >= 0 ? G.up : G.down} ${Math.abs(node.ch)}%` : ''}`, ink, BOLD)
  }
  if (node?.pt?.length) { head(tr('Reparto', 'Breakdown')); blockDonut(lines, { parts: node.pt.map(p => ({ label: p.l, value: p.v, color: P.dual(p.c) })) }, W, L) }
  if (node?.rw?.length && (node.sh === 'table' || node.sh === 'class' || node.sh === 'requirement')) {
    head(node.sh === 'class' ? tr('Miembros', 'Members') : tr('Atributos', 'Attributes'))
    for (const r of node.rw) push((g, y) => { let x = g.text(0, y, fit(`${r.vi ?? ''}${r.n}`, Math.floor(W / 2)), ink, bg, r.k ? BOLD : 0); if (r.t) x += g.text(x + 1, y, fit(r.t, W - x - 6), muted, bg); if (r.k) g.text(W - strWidth(r.k), y, r.k, accent, bg, BOLD) })
  }
  if (d?.metrics?.length) { head(tr('Métricas', 'Metrics')); for (const m of d.metrics) push((g, y) => { const v = String(m.value ?? ''); g.text(0, y, fit(String(m.label), W - strWidth(v) - 2), muted, bg); g.text(W - strWidth(v), y, fit(v, W), ink, bg, BOLD) }) }
  if (d?.notes?.length) { head(tr('Notas', 'Notes')); for (const nt of d.notes) { const c = P.c(P.tok(TONES[nt.tone ?? 'info'] ?? 'accent')); push((g, y) => { g.text(0, y, G.dot, c, bg) }); const at = lines.length - 1; const ls = wrap(md(nt.text), W - 2, 6); lines[at] = (g, y) => { g.text(0, y, G.dot, c, bg); g.text(2, y, ls[0] ?? '', ink, bg) }; for (const l of ls.slice(1)) push((g, y) => { g.text(2, y, l, ink, bg) }) } }
  if (d?.blocks?.length) for (const b of d.blocks) block(lines, b as Record<string, unknown>, W, L, s)
  if (d && !d.edge && ((d.ins?.length ?? 0) + (d.outs?.length ?? 0)) > 0) {
    head(tr('Vecindad', 'Neighbors'))
    push((g, y) => { const ni = d.ins?.length ?? 0, no = d.outs?.length ?? 0; g.text(0, y, `${ni} ${G.head.r} `, muted, bg); const x = g.text(strWidth(`${ni} ${G.head.r} `), y, ` ${fit(d.l ?? '', W - 14)} `, P.c(inkOn(P.tok('accent'))), accent, BOLD); g.text(strWidth(`${ni} ${G.head.r} `) + x, y, ` ${G.head.r} ${no}`, muted, bg) })
    for (const e of (d.ins ?? []).slice(0, 8)) push((g, y) => { g.text(0, y, `${G.head.l} `, muted, bg); g.text(2, y, fit(`${e.l ?? e.i}${e.k ? `  ·${e.k}` : ''}`, W - 2), ink, bg); g.markRect(0, y, W, y, e.i) })
    for (const e of (d.outs ?? []).slice(0, 8)) push((g, y) => { g.text(0, y, `${G.head.r} `, accent, bg); g.text(2, y, fit(`${e.l ?? e.i}${e.k ? `  ·${e.k}` : ''}`, W - 2), ink, bg); g.markRect(0, y, W, y, e.i) })
  }
  if (d?.steps?.length && s.tour) { head(tr('En el recorrido', 'In the tour')); text(d.steps.map(i => `${i + 1}. ${s.tour!.steps[i]?.t ?? ''}`).join('  ·  '), muted) }
  if (d?.files?.length) { head(tr('Ficheros', 'Files')); for (const f of d.files.slice(0, 12)) push((g, y) => { const st = `${f.additions ? '+' + f.additions : ''}${f.deletions ? ' −' + f.deletions : ''}`; g.text(0, y, fit(f.path, W - strWidth(st) - 1), ink, bg); if (f.additions) g.text(W - strWidth(st), y, '+' + f.additions, P.c(P.tok('add')), bg); if (f.deletions) g.text(W - strWidth(` −${f.deletions}`) + 1, y, '−' + f.deletions, P.c(P.tok('del')), bg) }) }
  if (d?.links?.length) { head(tr('Enlaces', 'Links')); for (const l of d.links.slice(0, 10)) push((g, y) => { const dot = l.st ? G.dot + ' ' : ''; g.text(0, y, dot, P.c(/merged|done|cerrad|hecho/i.test(l.st ?? '') ? P.tok('add') : /draft|borrador/i.test(l.st ?? '') ? P.tok('faint') : P.tok('accent')), bg); g.text(strWidth(dot), y, fit(`${l.k ? `[${l.k}] ` : ''}${l.l ?? l.u ?? ''}`, W - strWidth(dot)), accent, bg, UNDER) }) }
  if (d?.tags?.length) { gap(); text(d.tags.map(t => '#' + t).join(' '), faint) }
  if (d?.owner?.c) text(`${tr('Contacto', 'Contact')}: ${d.owner.c}`, muted)
  return render(lines, w, L)
}

function render(lines: Line[], w: number, L: Look) {
  const g = new Grid(Math.max(1, w), Math.max(1, lines.length), L.G)
  if (L.canvasBg) g.fill(0, 0, g.w - 1, g.h - 1, ' ', undefined, L.canvasBg)
  lines.forEach((f, y) => f(g, y))
  g.flushDots()
  return g
}

function legend(s: Scene, lines: Line[], W: number, L: Look) {
  const P = L.P, G = L.G, bg = L.canvasBg
  const muted = P.c(P.tok('muted')), ink = P.c(P.tok('ink'))
  const push = (f: Line) => lines.push(f)
  if (s.heat?.lut && L.fx.heat && (s.nodes ?? []).some(n => n.hv != null || L.data?.[n.i]?.hv != null)) {
    push(() => { })
    push((g, y) => { g.text(0, y, (s.heat!.label ?? tr('Calor', 'Heat')).toUpperCase(), muted, bg, BOLD | DIM) })
    push((g, y) => { const n = Math.min(W - 12, 24); for (let x = 0; x < n; x++) g.set(x, y, G.bar.full, P.c(P.heat((s.heat!.domain?.[0] ?? 0) + ((s.heat!.domain?.[1] ?? 100) - (s.heat!.domain?.[0] ?? 0)) * (x / (n - 1)))), bg); g.text(n + 1, y, `${fmtNum(s.heat!.domain?.[0] ?? 0)}–${fmtNum(s.heat!.domain?.[1] ?? 100)}${s.heat!.unit ? ' ' + s.heat!.unit : ''}`, ink, bg) })
  }
  if (s.statuses && Object.keys(s.statuses).length) {
    push(() => { }); push((g, y) => { g.text(0, y, tr('ESTADOS', 'STATUSES'), muted, bg, BOLD | DIM) })
    for (const [, st] of Object.entries(s.statuses)) push((g, y) => { g.set(0, y, G.dot, P.c(P.dual(st.c) ?? P.tok('accent')), bg); g.text(2, y, fit(st.l, W - 2), ink, bg) })
  }
  if (s.owners && Object.keys(s.owners).length && L.fx.owners) {
    push(() => { }); push((g, y) => { g.text(0, y, tr('EQUIPOS', 'TEAMS'), muted, bg, BOLD | DIM) })
    for (const [id, o] of Object.entries(s.owners)) push((g, y) => { const c = o.color ?? P.tok('accent'); const x = g.text(0, y, ` ${(o.short ?? id.slice(0, 2)).toUpperCase()} `, P.c(inkOn(c)), P.c(c), BOLD); g.text(x + 1, y, fit(o.label ?? id, W - x - 1), ink, bg) })
  }
  const lg = s.legend as { edges?: { label: string; style?: string; color?: string }[]; kinds?: Record<string, string> } | null
  if (lg?.edges?.length) {
    push(() => { }); push((g, y) => { g.text(0, y, tr('CONEXIONES', 'CONNECTIONS'), muted, bg, BOLD | DIM) })
    for (const e of lg.edges) push((g, y) => { const st = e.style ?? 'solid'; const glyph = st === 'dashed' ? '┄┄┄' : st === 'hero' ? '━━━' : st === 'flow' ? '─•─' : '───'; g.text(0, y, G.name === 'ascii' ? '---' : glyph, P.c(e.color ?? (st === 'hero' ? P.tok('accent') : P.tok('neu'))), bg, st === 'muted' ? DIM : 0); g.text(4, y, fit(e.label, W - 4), ink, bg) })
  }
}

/* ---------- los bloques ---------- */
function block(lines: Line[], b: Record<string, unknown>, W: number, L: Look, s: Scene) {
  const P = L.P, G = L.G, bg = L.canvasBg
  const ink = P.c(P.tok('ink')), muted = P.c(P.tok('muted')), faint = P.c(P.tok('faint')), accent = P.c(P.tok('accent'))
  const push = (f: Line) => lines.push(f)
  const text = (t: unknown, fg?: string, a = 0, indent = 0) => { for (const l of wrap(md(t), W - indent, 80)) push((g, y) => { g.text(indent, y, l, fg, bg, a) }) }
  const type = String(b.type ?? 'text')
  push(() => { })
  if (b.title && !['heading', 'divider'].includes(type)) push((g, y) => { g.text(0, y, fit(String(b.title).toUpperCase(), W), muted, bg, BOLD | DIM) })
  switch (type) {
    case 'text': text(b.text, b.style === 'muted' || b.style === 'small' ? muted : ink, b.style === 'lead' ? BOLD : 0); break
    case 'heading': text(b.text ?? b.title, ink, BOLD | UNDER); break
    case 'divider': push((g, y) => { for (let x = 0; x < W; x++) g.set(x, y, G.box.sharp.t, P.c(P.tok('line')), bg) }); break
    case 'quote': { const ls = wrap(md(b.text), W - 2, 20); for (const l of ls) push((g, y) => { g.set(0, y, G.vbar, accent, bg); g.text(2, y, l, ink, bg, ITALIC) }); if (b.by) text(`— ${b.by}`, muted, 0, 2); break }
    case 'callout': {
      const c = P.tok(TONES[String(b.tone ?? 'info')] ?? 'accent')
      const ls = wrap(md(b.text), W - 3, 20)
      const t = b.title ? String(b.title) : null
      if (t && !b.title) push((g, y) => { g.text(2, y, t, P.c(c), bg, BOLD) })
      for (const [i, l] of ls.entries()) push((g, y) => { g.set(0, y, i === 0 ? (G.tones[String(b.tone ?? 'info')] ?? G.info) : G.vbar, P.c(c), bg, BOLD); g.text(2, y, l, ink, P.depth === 'truecolor' ? P.c(P.mix(P.tok('canvas'), c, 0.1)) : bg) })
      break
    }
    case 'code': {
      const src = String(b.code ?? b.text ?? '').split('\n').slice(0, 30)
      for (const l of src) push((g, y) => { g.set(0, y, G.vbar, faint, bg); g.text(2, y, fit(l.replace(/\t/g, '  '), W - 2), P.c(P.tok('mod')), bg) })
      break
    }
    case 'kv': {
      const items = (b.items as unknown[] ?? []).map(it => (Array.isArray(it) ? it : [(it as Record<string, unknown>).label ?? (it as Record<string, unknown>).k, (it as Record<string, unknown>).value ?? (it as Record<string, unknown>).v]))
      for (const [k, v] of items) push((g, y) => { const vs = md(v); g.text(0, y, fit(md(k), Math.floor(W * 0.45)), muted, bg); g.text(Math.max(Math.floor(W * 0.45) + 1, W - strWidth(vs)), y, fit(vs, W - Math.floor(W * 0.45) - 1), ink, bg, BOLD) })
      break
    }
    case 'list': (b.items as unknown[] ?? []).forEach((it, i) => { const ls = wrap(md(typeof it === 'object' ? (it as Record<string, unknown>).text ?? (it as Record<string, unknown>).label : it), W - 3, 6); ls.forEach((l, k) => push((g, y) => { if (!k) g.text(0, y, b.ordered ? `${i + 1}.` : G.bullet, accent, bg); g.text(3, y, l, ink, bg) })) }); break
    case 'checklist': (b.items as Record<string, unknown>[] ?? []).forEach(it => { const done = !!(it.done ?? it.checked); push((g, y) => { g.text(0, y, done ? `[${G.check}]` : '[ ]', P.c(done ? P.tok('add') : P.tok('faint')), bg, BOLD); g.text(4, y, fit(md(it.text ?? it.label), W - 4), done ? muted : ink, bg, done ? DIM : 0) }) }); break
    case 'steps': (b.items as Record<string, unknown>[] ?? []).forEach((it, i) => { const st = String(it.state ?? it.status ?? 'todo'); const c = P.c(P.tok(TONES[st] ?? 'faint')); push((g, y) => { g.text(0, y, st === 'done' ? G.check : st === 'active' ? (L.motion && Math.floor(L.t / 500) % 2 ? G.dot : G.dotHollow) : String(i + 1), c, bg, BOLD); g.text(3, y, fit(md(it.label ?? it.text), W - 3), st === 'todo' ? muted : ink, bg, st === 'active' ? BOLD : 0) }) }); break
    case 'badges': push((g, y) => { let x = 0; for (const it of (b.items as unknown[] ?? [])) { const o = typeof it === 'object' ? it as Record<string, unknown> : { label: it }; const c = P.tok(TONES[String(o.tone ?? 'info')] ?? 'accent'); const t = ` ${md(o.label ?? o.text)} `; if (x + strWidth(t) > W) break; x += g.text(x, y, t, P.c(inkOn(c)), P.c(c), BOLD) + 1 } }); break
    case 'table': {
      const cols = (b.columns as unknown[] ?? []).map(c => md(typeof c === 'object' ? (c as Record<string, unknown>).label ?? (c as Record<string, unknown>).key : c))
      const rows = (b.rows as unknown[][] ?? []).slice(0, 20)
      const n = Math.max(cols.length, ...rows.map(r => r.length))
      if (!n) break
      const cw = Math.max(4, Math.floor((W - (n - 1)) / n))
      const cellOf = (v: unknown) => (v && typeof v === 'object' && 'v' in (v as object) ? v as { v: unknown; tone?: string } : { v })
      if (cols.length) push((g, y) => { cols.forEach((c, i) => g.text(i * (cw + 1), y, fit(c, cw), muted, bg, BOLD | UNDER)) })
      for (const r of rows) push((g, y) => { r.forEach((v, i) => { const c = cellOf(v); const sv = typeof c.v === 'number' ? fmtNum(c.v) : md(c.v); const fg = c.tone ? P.c(P.tok(TONES[c.tone] ?? 'accent')) : ink; const x = i * (cw + 1) + (typeof c.v === 'number' ? Math.max(0, cw - strWidth(fit(sv, cw))) : 0); g.text(x, y, fit(sv, cw), fg, bg) }) })
      break
    }
    case 'stats': {
      const items = (b.items as Record<string, unknown>[] ?? [])
      for (const it of items) push((g, y) => {
        const v = `${typeof it.value === 'number' ? fmtNum(it.value) : md(it.value)}${it.unit ? ' ' + it.unit : ''}`
        let x = g.text(0, y, fit(md(it.label), Math.floor(W * 0.4)), muted, bg)
        x = Math.max(x + 1, Math.floor(W * 0.4) + 1)
        x += g.text(x, y, v, ink, bg, BOLD)
        if (typeof it.change === 'number') { const good = (it.change >= 0) === (it.good !== 'down'); x += g.text(x + 1, y, `${it.change >= 0 ? G.up : G.down}${Math.abs(it.change)}%`, P.c(good ? P.tok('add') : P.tok('del')), bg) + 1 }
        if (Array.isArray(it.spark)) g.text(Math.min(W - 8, x + 2), y, spark(it.spark as number[], Math.max(0, W - x - 3), G), accent, bg)
      })
      break
    }
    case 'spark': { const vals = (b.values ?? b.data ?? b.spark) as number[] ?? []; push((g, y) => { g.text(0, y, spark(vals, Math.min(W - 8, 40), G), accent, bg); g.text(Math.min(W - 8, 40) + 1, y, fmtNum(vals[vals.length - 1] ?? 0), ink, bg, BOLD) }); break }
    case 'chart': {
      const series = (b.series as Record<string, unknown>[] ?? [])
      const labels = (b.labels as unknown[] ?? []).map(md)
      const kind = String(b.kind ?? 'line')
      const pal = [0, 1, 2, 3, 4, 5].map(i => P.tok('p' + i, P.tok('accent')))
      if (kind === 'bar' || kind === 'stack') {
        const vals = labels.map((_, i) => series.reduce((a, se) => a + (Number((se.values as unknown[])?.[i]) || 0), 0))
        const mx = Math.max(1, ...vals)
        labels.forEach((l, i) => push((g, y) => { const lw = Math.min(10, Math.max(...labels.map(strWidth))); g.text(0, y, fit(l, lw), muted, bg); const bw = W - lw - 8; let x = lw + 1; if (kind === 'stack') { for (const [k, se] of series.entries()) { const v = Number((se.values as unknown[])?.[i]) || 0; const n = Math.round((v / mx) * bw); for (let j = 0; j < n; j++) g.set(x + j, y, G.bar.full, P.c(pal[k % pal.length]), bg); x += n } } else { const n = Math.round((vals[i]! / mx) * bw); for (let j = 0; j < n; j++) g.set(x + j, y, G.bar.full, P.c(pal[0]), bg); x += n } g.text(x + 1, y, fmtNum(vals[i]!), ink, bg) }))
      } else {
        const h = 4
        for (let k = 0; k < h; k++) push(() => { })
        const at = lines.length - h
        const old = lines.slice(at)
        lines[at] = (g, y) => { series.forEach((se, k) => brailleSpark(g, 0, y, W - 2, h, (se.values as number[]) ?? [], P.c(pal[k % pal.length]))); old[0]!(g, y) }
        if (series.length > 1 || series[0]?.label) push((g, y) => { let x = 0; series.forEach((se, k) => { x += g.text(x, y, `${G.dot} ${md(se.label)}  `, P.c(pal[k % pal.length]), bg) }) })
        if (labels.length) push((g, y) => { g.text(0, y, fit(labels[0] ?? '', W / 2), faint, bg, DIM); const last = labels[labels.length - 1] ?? ''; g.text(W - strWidth(last), y, last, faint, bg, DIM) })
      }
      break
    }
    case 'bars': { const items = (b.items as Record<string, unknown>[] ?? []).slice(0, 12); const mx = Math.max(1, ...items.map(i => Number(i.value) || 0)); const lw = Math.min(14, Math.max(...items.map(i => strWidth(md(i.label))))); for (const it of items) push((g, y) => { g.text(0, y, fit(md(it.label), lw), muted, bg); const n = Math.round(((Number(it.value) || 0) / mx) * (W - lw - 8)); for (let j = 0; j < n; j++) g.set(lw + 1 + j, y, G.bar.full, P.c(it.color ? String(it.color) : P.tok('accent')), bg); g.text(lw + 2 + n, y, fmtNum(Number(it.value) || 0), ink, bg) }); break }
    case 'progress': {
      const items = (b.items as Record<string, unknown>[] | undefined) ?? [b]
      for (const it of items) push((g, y) => { const v = Number(it.value ?? it.progress ?? 0); const t = v > 1 ? v / 100 : v; const lw = it.label ? Math.min(14, strWidth(md(it.label))) + 1 : 0; if (lw) g.text(0, y, fit(md(it.label), lw - 1), muted, bg); const bw = W - lw - 6; const f = Math.round(Math.max(0, Math.min(1, t)) * bw); for (let j = 0; j < bw; j++) g.set(lw + j, y, j < f ? G.bar.full : G.bar.empty, P.c(j < f ? (t >= 1 ? P.tok('add') : P.tok('accent')) : P.tok('line')), bg); g.text(lw + bw + 1, y, `${Math.round(t * 100)}%`, ink, bg, BOLD) })
      break
    }
    case 'gauge': { const v = Number(b.value ?? 0), mn = Number(b.min ?? 0), mx = Number(b.max ?? 100); const t = Math.max(0, Math.min(1, (v - mn) / ((mx - mn) || 1))); push((g, y) => { const bw = W - 10; const f = Math.round(t * bw); for (let j = 0; j < bw; j++) g.set(j, y, j < f ? G.bar.full : G.bar.empty, P.c(j < f ? P.tok('accent') : P.tok('line')), bg); g.text(bw + 1, y, `${fmtNum(v)}${b.unit ?? ''}`, ink, bg, BOLD) }); break }
    case 'donut': blockDonut(lines, b, W, L); break
    case 'kpi': push((g, y) => { const x = g.text(0, y, `${fmtNum(Number(b.value ?? 0))}${b.unit ? ' ' + b.unit : ''}`, ink, bg, BOLD); if (typeof b.change === 'number') g.text(x + 1, y, `${b.change >= 0 ? G.up : G.down} ${Math.abs(b.change)}%`, P.c((b.change >= 0) === (b.good !== 'down') ? P.tok('add') : P.tok('del')), bg) }); if (Array.isArray(b.spark)) push((g, y) => { g.text(0, y, spark(b.spark as number[], Math.min(W, 30), G), accent, bg) }); break
    case 'timeline': for (const it of (b.items as Record<string, unknown>[] ?? []).slice(0, 14)) push((g, y) => { const c = P.c(P.tok(TONES[String(it.tone ?? 'info')] ?? 'accent')); const t = md(it.time); g.text(0, y, fit(t, 8), muted, bg); g.set(9, y, G.dot, c, bg); g.text(11, y, fit(md(it.label), W - 11), ink, bg) }); break
    case 'heatstrip': {
      const rows = (b.rows as unknown[][] ?? []).slice(0, 10)
      const lab = (b.labels as unknown[] ?? []).map(md)
      const all = rows.flat().map(Number).filter(Number.isFinite)
      const mn = Math.min(...all), mx = Math.max(...all)
      const lw = Math.min(8, Math.max(0, ...lab.map(strWidth)))
      rows.forEach((r, i) => push((g, y) => { if (lw) g.text(0, y, fit(lab[i] ?? '', lw), muted, bg); r.slice(0, W - lw - 1).forEach((v, k) => { const t = (Number(v) - mn) / ((mx - mn) || 1); g.set(lw + 1 + k, y, P.depth === 'mono' ? G.shade[Math.min(3, Math.floor(t * 4))]! : G.bar.full, P.c(P.mix(P.tok('canvas'), P.tok('del'), 0.15 + t * 0.85)), bg) }) }))
      break
    }
    case 'image': text(`${G.icons.ui ?? '▢'} ${tr('imagen', 'image')}${b.caption ? `: ${md(b.caption)}` : ''}${typeof b.src === 'string' && /^https?:/.test(b.src) ? ` (${b.src})` : ''}`, muted, ITALIC); break
    default: if (b.text) text(b.text, ink)
  }
  void s
}

function blockDonut(lines: Line[], b: Record<string, unknown>, W: number, L: Look) {
  const P = L.P, G = L.G, bg = L.canvasBg
  const parts = (b.parts as Record<string, unknown>[] ?? b.items as Record<string, unknown>[] ?? []).map((p, i) => ({ l: String(p.label ?? ''), v: Number(p.value) || 0, c: (p.color as string) ?? P.tok('p' + (i % 8), P.tok('accent')) }))
  const total = parts.reduce((a, p) => a + p.v, 0) || 1
  const r = P.depth === 'mono' || G.name === 'ascii' ? 0 : Math.min(5, Math.max(3, parts.length))
  if (r) {
    for (let k = 0; k < r; k++) lines.push(() => { })
    const at = lines.length - r
    lines[at] = (g, y) => {
      donutCells(g, 0, y, r, parts.map(p => p.v), parts.map(p => P.c(p.c)), fmtNum(total), P.c(P.tok('ink')), bg)
      parts.slice(0, r).forEach((p, i) => { g.set(r * 2 + 2, y + i, G.dot, P.c(p.c), bg); g.text(r * 2 + 4, y + i, fit(`${p.l} ${Math.round((p.v / total) * 100)}%`, W - r * 2 - 4), P.c(P.tok('ink')), bg) })
    }
    for (const p of parts.slice(r)) lines.push((g, y) => { g.set(r * 2 + 2, y, G.dot, P.c(p.c), bg); g.text(r * 2 + 4, y, fit(`${p.l} ${Math.round((p.v / total) * 100)}%`, W - r * 2 - 4), P.c(P.tok('ink')), bg) })
  } else {
    lines.push((g, y) => bars(g, 0, y, W, parts.map(p => ({ v: p.v, c: P.c(p.c) })), G, bg))
    for (const p of parts) lines.push((g, y) => { g.text(0, y, fit(`${G.bullet} ${p.l} ${Math.round((p.v / total) * 100)}%`, W), P.c(P.tok('ink')), bg) })
  }
}
