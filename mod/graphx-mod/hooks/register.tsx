/* graphx-mod: GraphX entero dentro de Claude Code, en cada superficie y a cada tamaño.
 *
 * Claude dibuja con herramientas (mcp__graphx-mod__show, patch, data, signs, guide, view, convert, export,
 * capabilities, reference); el tablero vive en $.state y un servidor local (server/live.mjs, Node) monta el
 * motor de verdad sin navegador y saca de él lo que cada superficie sabe pintar:
 *
 *   terminal     el lienzo de caracteres (hooks/canvas.tsx, un Client): todos los diagramas y efectos, a cualquier
 *                tamaño, color y juego de caracteres que tenga el terminal (detectado al arrancar, hooks/term/caps.ts);
 *                en kitty, Ghostty y WezTerm, también como imagen del motor
 *   escritorio   el SVG del motor con sus animaciones, controles y el detalle en Markdown; o el mismo lienzo
 *   navegador    el visor con el motor interactivo (/graphx-mod open)
 *
 * Los bloques ```mermaid de las respuestas de Claude se dibujan con GraphX en el propio transcript. */
import { atom, read, update } from 'claude-code'
import type { Elements, EngineInterface, Register } from 'claude-code'

import type {
  CanvasProps, Caps, Detail, GraphxBanner, GraphxBoard, GraphxLive, GraphxRender, GraphxServer, GraphxSign, GraphxSource, GraphxStep, GraphxTone, GraphxView, Scene,
} from '../types'
import { detectCaps, withOverrides, type Env } from './term/caps'
import { REFERENCE, capabilitiesText } from './catalog'
import { textFrame } from './term/snapshot'
import { getLang, pickLang, setLang, tr } from './i18n'

type D = EngineInterface
type Json = Record<string, unknown>

const PLUGIN = 'graphx-mod'
const PANE = 'graphx'
const boardA = atom({ plugin: 'graphx-mod', key: 'board' } as const, null)
const revA = atom({ plugin: 'graphx-mod', key: 'rev' } as const, 0)
const serverA = atom({ plugin: 'graphx-mod', key: 'server' } as const, null)
const renderA = atom({ plugin: 'graphx-mod', key: 'render' } as const, null)
const liveA = atom({ plugin: 'graphx-mod', key: 'live' } as const, { viewers: 0, step: -1, asks: 0, lastSeen: 0 })
const seqA = atom({ plugin: 'graphx-mod', key: 'seq' } as const, 0)
const detailA = atom({ plugin: 'graphx-mod', key: 'detail' } as const, null)
const capsA = atom({ plugin: 'graphx-mod', key: 'caps' } as const, null)
const overA = atom({ plugin: 'graphx-mod', key: 'over' } as const, null)
const viewA = atom({ plugin: 'graphx-mod', key: 'view' } as const, 'auto')
const cmdA = atom({ plugin: 'graphx-mod', key: 'cmd' } as const, null)
const presentA = atom({ plugin: 'graphx-mod', key: 'present' } as const, null as { n: number; at: number } | null)

/* la barra de atajos del panel: cada botón es una tecla del lienzo (la misma, tenga el foco el lienzo o el panel) */
const KEYS = (): { k: string; l: string; when?: 'tour' | 'sel' }[] => [
  { k: 'r', l: tr('presentar', 'present') }, { k: 'b', l: '◀' }, { k: 'n', l: '▶' },
  { k: 'a', l: tr('◂pieza', '◂node') }, { k: 's', l: tr('pieza▸', 'node▸') }, { k: 'o', l: tr('abrir', 'open') }, { k: 'd', l: tr('detalle', 'detail') },
  { k: 'z', l: '+' }, { k: 'x', l: '−' }, { k: '0', l: tr('todo', 'fit') }, { k: 'h', l: '←' }, { k: 'j', l: '↓' }, { k: 'k', l: '↑' }, { k: 'l', l: '→' },
  { k: 'v', l: tr('vista', 'view') }, { k: 'g', l: '↦↧' }, { k: 't', l: tr('trazar', 'trace') }, { k: 'c', l: tr('impacto', 'blast') }, { k: 'f', l: tr('flujo', 'flow') }, { k: 'y', l: tr('tiempo', 'time') },
  { k: 'e', l: tr('equipos', 'teams') }, { k: 'm', l: tr('mapa', 'map') }, { k: 'u', l: tr('efectos', 'effects') }, { k: 'q', l: tr('preguntar', 'ask') }, { k: 'i', l: tr('imagen', 'image') }, { k: 'w', l: 'web' },
]

const TONES: readonly GraphxTone[] = ['info', 'tip', 'ok', 'warn', 'danger', 'note']
const PROPS_MAX = 96000

/* ---------- utilidades ---------- */
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined)
const strs = (v: unknown): string[] | undefined => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined)
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const toneOf = (v: unknown): GraphxTone => (TONES.includes(v as GraphxTone) ? (v as GraphxTone) : 'info')
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
/* en el idioma de la interfaz salvo que Claude pida otro: el motor y el visor lo siguen */
const emptyBoard = (source: GraphxSource): GraphxBoard => ({ source, patches: [], lang: getLang(), signs: [], banner: null, guide: { steps: [], at: -1, seq: 0 }, view: { seq: 0 } })

/* lo que vive en el módulo (se pierde con cada recarga y se recupera del servidor) */
let child: { return?: (value?: unknown) => unknown } | null = null
let starting: Promise<GraphxServer> | null = null
let pollStop: { cancel: () => void } | null = null
let pumping = false
let opened = false
let scene: Scene | null = null
let sceneSeq = -1
const svgCache = new Map<string, { svg: string; fits: boolean; w: number; h: number } | null>()
const pngCache = new Map<string, { file: string | null; b64?: string; w: number; h: number } | null>()
const rasterCache = new Map<string, { cells: string; cols: number; rows: number } | null>()
type ViewMode = 'auto' | 'browser' | 'panel' | 'both'
let where: ViewMode = 'auto'
let inlineOn = true
let optCaps: Partial<Caps> = {}
let optLang: string | undefined

/* ---------- servidor ---------- */
const base = (s: GraphxServer) => `http://127.0.0.1:${s.port}`
async function call($: D, s: GraphxServer, path: string, body?: unknown) {
  return $.http.fetch(base(s) + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'x-graphx-token': s.token, 'x-graphx-lang': getLang(), 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}
async function healthy($: D, s: GraphxServer) { try { return (await $.http.fetch(base(s) + '/health')).ok } catch { return false } }
/* la versión del código del servidor en disco (la misma cuenta que hace live.mjs al arrancar) */
async function codeVersion($: D) {
  const files = ['server/live.mjs', 'server/engine.mjs', 'server/svgout.mjs', 'server/mermaid-out.mjs', 'viewer/board.js']
  const ms = await Promise.all(files.map(f => $.fs.stat(`${$.plugin.root}/${f}`).then(x => Math.round(x.mtimeMs)).catch(() => 0)))
  return ms.join('-')
}
/* vivo y con el código de ahora: tras una recarga del mod con el servidor cambiado, hay que reiniciarlo */
async function current($: D, s: GraphxServer) {
  try {
    const r = await $.http.fetch(base(s) + '/health')
    if (!r.ok) return false
    const code = (JSON.parse(r.text) as { code?: string }).code
    if (code !== (await codeVersion($))) { try { await call($, s, '/quit', {}) } catch { /* ya se iba */ } return false }
    return true
  } catch { return false }
}

/* la app de escritorio, abierta desde el Dock, no hereda el PATH de la shell: el instalador deja aquí la ruta de node */
async function nodeBin($: D): Promise<string> {
  try { const p = (await $.fs.read(`${$.plugin.root}/node-path`)).trim(); if (p) return p } catch { /* sin fijar: el del PATH */ }
  return 'node'
}
async function spawnServer($: D, token: string, port: number): Promise<GraphxServer> {
  const stream = $.process.spawn({ argv: [await nodeBin($), `${$.plugin.root}/server/live.mjs`, '--token', token, '--port', String(port)] })
  child = stream as unknown as { return?: (value?: unknown) => unknown }
  return new Promise((resolve, reject) => {
    let buf = '', done = false, err = '', realPort = port
    void (async () => {
      try {
        for await (const chunk of stream) {
          if (chunk.stream === 'stdout' && !done) {
            buf += chunk.text
            /* solo líneas completas: la de listo puede llegar partida en varios trozos */
            const line = buf.split('\n').slice(0, -1).find(l => l.startsWith('{'))
            if (line) {
              let r: { url: string; port: number; engine?: boolean; rsvg?: boolean }
              try { r = JSON.parse(line) as typeof r } catch { continue }
              done = true
              realPort = r.port
              resolve({ url: r.url, port: r.port, token, startedAt: await $.clock.now(), engine: !!r.engine, rsvg: !!r.rsvg })
            }
          } else if (chunk.stream === 'stderr') { err += chunk.text; $.ui.log(`graphx: ${chunk.text.trim()}`, { to: 'debug' }) }
        }
      } catch (e) { if (!done) reject(e instanceof Error ? e : new Error(String(e))) }
      if (!done) reject(new Error(err.trim() || tr('el servidor terminó sin arrancar (¿está node en el PATH?)', 'the server exited before starting (is node on the PATH?)')))
      if (child === (stream as unknown)) child = null
      await update($, serverA, s => (s && s.port === realPort ? null : s))
    })()
  })
}
async function ensureServer($: D): Promise<GraphxServer> {
  const prev = await read($, serverA)
  /* tras una recarga del mod no hay `child`, pero el servidor de antes puede seguir vivo: se reutiliza */
  if (prev && (child ? await healthy($, prev) : await current($, prev))) { if (!pollStop) pollStop = $.clock.every(1200, () => { void pump($) }); return prev }
  if (starting) return starting
  starting = (async () => {
    const token = prev?.token ?? crypto.randomUUID().replace(/-/g, '')
    let s: GraphxServer
    try { s = await spawnServer($, token, prev?.port ?? 0) } catch { s = await spawnServer($, token, 0) }
    await update($, serverA, () => s)
    pollStop?.cancel()
    pollStop = $.clock.every(1200, () => { void pump($) })
    return s
  })()
  try { return await starting } finally { starting = null }
}
async function stopServer($: D) {
  pollStop?.cancel(); pollStop = null
  const s = await read($, serverA)
  if (child) { try { await child.return?.() } catch { /* ya se había ido */ } }
  else if (s) { try { await call($, s, '/quit', {}) } catch { /* ya se había ido */ } }
  child = null
  await update($, serverA, () => null)
  await update($, liveA, l => ({ ...l, viewers: 0 }))
  $.ui.status(undefined)
}
async function openBrowser($: D, url: string) {
  for (const argv of [['open', url], ['xdg-open', url], ['cmd', '/c', 'start', '', url]]) {
    try { const r = await $.process.run(argv, { timeoutMs: 8000 }); if (r.exitCode === 0) { opened = true; return true } } catch { /* el siguiente */ }
  }
  return false
}

/* ---------- la escena (lo que pinta el terminal) ---------- */
async function fetchScene($: D, s: GraphxServer, body?: Json) {
  try {
    const r = await call($, s, body ? '/ui' : '/scene', body)
    if (!r.ok) return
    scene = JSON.parse(r.text) as Scene
    sceneSeq = scene.seq ?? sceneSeq + 1
    svgCache.clear(); pngCache.clear(); rasterCache.clear()
    await update($, seqA, n => n + 1)
  } catch { /* el servidor se ha ido */ }
}
async function ensureScene($: D) {
  const s = await read($, serverA)
  if (!scene && s) await fetchScene($, s)
  return scene
}
/* lo mismo pero sin escribir estado: lo que puede hacer un render */
async function loadScene($: D) {
  const s = await read($, serverA)
  if (scene || !s) return scene
  try { const r = await call($, s, '/scene'); if (r.ok) { scene = JSON.parse(r.text) as Scene; sceneSeq = scene.seq ?? sceneSeq } } catch { /* sin servidor */ }
  return scene
}

/* ---------- lo que vuelve del servidor y del navegador ---------- */
type Inbox = { events: Json[]; viewers: number; seq?: number; engineError?: string | null }
async function pump($: D) {
  if (pumping) return
  const s = await read($, serverA)
  if (!s) return
  pumping = true
  try {
    const r = await call($, s, '/inbox')
    if (!r.ok) return
    const inbox = JSON.parse(r.text) as Inbox
    for (const ev of inbox.events) {
      if (ev.type === 'rendered') {
        const render: GraphxRender = {
          rev: num(ev.rev) ?? 0, ok: ev.ok === true, error: str(ev.error), warnings: strs(ev.warnings) ?? [], diagram: str(ev.diagram),
          nodes: Array.isArray(ev.nodes) ? (ev.nodes as GraphxRender['nodes']) : [], edges: Array.isArray(ev.edges) ? (ev.edges as GraphxRender['edges']) : [],
          lanes: strs(ev.lanes) ?? [], nodeCount: num(ev.nodeCount) ?? 0, edgeCount: num(ev.edgeCount) ?? 0, steps: num(ev.steps) ?? 0, flows: strs(ev.flows), fx: strs(ev.fx),
        }
        await update($, renderA, () => render)
        if (!render.ok) $.ui.toast(`GraphX: ${clip(render.error ?? tr('no se ha podido pintar', 'could not draw it'), 90)}`)
      } else if (ev.type === 'step') {
        const at = num(ev.step) ?? -1
        await update($, boardA, b => (b ? { ...b, guide: { ...b.guide, at } } : b))
        await update($, liveA, l => ({ ...l, step: at }))
        await syncStatus($)
      } else if (ev.type === 'ask') {
        await ask($, str(ev.node) ?? '', str(ev.label) ?? str(ev.node) ?? tr('el diagrama', 'the diagram'), str(ev.text))
      }
    }
    if (inbox.seq !== undefined && inbox.seq !== sceneSeq) await fetchScene($, s)
    const live = await read($, liveA)
    if (live.viewers !== inbox.viewers) await update($, liveA, l => ({ ...l, viewers: inbox.viewers, lastSeen: inbox.viewers ? Date.now() : l.lastSeen }))
  } catch { /* el servidor se ha ido: la próxima herramienta lo arranca otra vez */ } finally { pumping = false }
}
async function ask($: D, id: string, label: string, quote?: string) {
  const idPart = id && id !== label ? ` (\`${id}\`)` : ''
  const text = tr(`Sobre «${label}»${idPart} en el diagrama de GraphX${quote ? ` — cartel: “${clip(quote, 200)}”` : ''}: `, `About “${label}”${idPart} in the GraphX diagram${quote ? ` — sign: “${clip(quote, 200)}”` : ''}: `)
  await $.prompt.fill({ text, mode: 'append' })
  await update($, liveA, l => ({ ...l, asks: l.asks + 1 }))
  $.ui.toast(tr(`GraphX: pregunta sobre «${clip(label, 40)}» en el prompt`, `GraphX: question about “${clip(label, 40)}” in the prompt`))
}

/* ---------- publicar ---------- */
async function syncStatus($: D) {
  const b = await read($, boardA)
  if (!b) { $.ui.status(undefined); return }
  const n = b.guide.steps.length
  const bits = [`◆ GraphX · ${clip(b.title ?? scene?.title ?? tr('lienzo', 'canvas'), 32)}`]
  if (n) bits.push(b.guide.at >= 0 ? tr(`paso ${b.guide.at + 1}/${n}`, `step ${b.guide.at + 1}/${n}`) : tr(`${n} pasos`, `${n} steps`))
  if (b.signs.length) bits.push(tr(`${b.signs.length} cartel${b.signs.length === 1 ? '' : 'es'}`, `${b.signs.length} sign${b.signs.length === 1 ? '' : 's'}`))
  $.ui.status(bits.join(' · '))
}
async function publish($: D, change: (b: GraphxBoard | null) => GraphxBoard | null) {
  const board = await update($, boardA, change)
  /* el último diagrama, también fuera de la sesión: /graphx-mod last lo recupera en otra */
  if (board) { try { await $.store.set('last-board', { board, at: Date.now() }) } catch { /* sin almacén */ } }
  const rev = await update($, revA, r => r + 1)
  const s = await ensureServer($)
  let viewers = 0
  try {
    const r = await call($, s, '/state', { rev, board, lang: getLang() })
    viewers = (JSON.parse(r.text) as { viewers?: number }).viewers ?? 0
  } catch { /* lo reintenta la siguiente publicación */ }
  await fetchScene($, s)
  await pump($)
  await syncStatus($)
  return { board, rev, server: s, viewers }
}
/* el informe de pintado llega en cuanto el motor ha montado (el servidor espera a pintar antes de contestar) */
async function settle($: D, rev: number) {
  const until = (await $.clock.now()) + 4000
  while ((await $.clock.now()) < until) {
    await pump($)
    const r = await read($, renderA)
    if (r && r.rev >= rev) return r
    await $.clock.sleep(200)
  }
  return null
}
async function presentAt($: D, viewers: number, url: string, w: ViewMode = where) {
  /* dónde se ve: el panel del terminal o el escritorio siempre; el navegador si se pide (o si no hay motor) */
  const where = w
  const s = await read($, serverA)
  const wantBrowser = where === 'browser' || where === 'both' || (s && !s.engine)
  if (where !== 'browser') await $.ui.open({ id: PANE, title: 'GraphX' })
  if (wantBrowser && viewers === 0 && !opened) await openBrowser($, url)
}

/* ---------- la respuesta que lee Claude ---------- */
function idsLine(r: GraphxRender, max = 140) {
  const parts = r.nodes.slice(0, max).map(n => (n.label && n.label !== n.id ? `${n.id} «${clip(n.label, 30)}»` : n.id))
  return parts.join(', ') + (r.nodes.length > max ? `, … (+${r.nodes.length - max})` : '')
}
async function summary($: D, rev: number, r: GraphxRender | null, opts: { ids?: boolean; extra?: string[] } = {}) {
  const b = await read($, boardA)
  const s = await read($, serverA)
  const live = await read($, liveA)
  const out: string[] = []
  out.push(`GraphX · rev ${rev}${s ? ` · navegador: ${s.url}` : ''}${live.viewers ? ` (${live.viewers} abierto${live.viewers === 1 ? '' : 's'})` : ''}`)
  if (!r) out.push('El motor aún no ha confirmado el pintado; consulta con view en un momento.')
  else if (r.rev < rev) out.push(`El motor va por la rev ${r.rev}; la ${rev} aún no está pintada.`)
  else if (!r.ok) out.push(`ERROR al pintar: ${r.error ?? 'desconocido'}. Corrige y vuelve a llamar.`)
  else out.push(`Pintado${r.diagram ? ` (${r.diagram.replace('mermaid:', 'Mermaid ')})` : ''}: ${r.nodeCount} piezas, ${r.edgeCount} aristas${r.lanes.length ? `, ${r.lanes.length} carriles` : ''}${r.flows?.length ? `, flujos: ${r.flows.join(', ')}` : ''}${r.steps ? `, ${r.steps} pasos` : ''}${b?.signs.length ? `, ${b.signs.length} carteles` : ''}${r.fx?.length ? ` · efectos: ${r.fx.join(' ')}` : ''}.`)
  if (r && r.warnings.length) out.push('Avisos:\n- ' + r.warnings.slice(0, 20).join('\n- '))
  if (b && r) {
    const known = new Set(r.nodes.map(n => n.id))
    const bad = b.signs.filter(x => x.at && !known.has(x.at)).map(x => `${x.id}→${x.at}`)
    if (bad.length) out.push(`Carteles anclados a piezas que no existen (se muestran sueltos): ${bad.join(', ')}`)
  }
  for (const e of opts.extra ?? []) out.push(e)
  if (opts.ids && r && r.ok) out.push(`Ids (para anclar carteles, pasos, datos y parches): ${idsLine(r)}`)
  return out.join('\n')
}

/* ---------- entradas de las herramientas ---------- */
function signFrom(v: unknown, fallbackId: string, steps: number): GraphxSign | null {
  if (!isObj(v)) return null
  const text = str(v.text) ?? '', title = str(v.title)
  if (!text && !title) return null
  const sign: GraphxSign = { id: str(v.id) ?? fallbackId, text, tone: toneOf(v.tone) }
  if (title) sign.title = title
  if (str(v.at)) sign.at = str(v.at)
  const side = str(v.side)
  if (side === 'top' || side === 'right' || side === 'bottom' || side === 'left' || side === 'auto') sign.side = side
  if (str(v.pin)) sign.pin = clip(str(v.pin) ?? '', 4)
  const step = num(v.step)
  if (step !== undefined && step >= 1 && step <= Math.max(steps, 1)) sign.step = step - 1
  return sign
}
const nextSignId = (signs: GraphxSign[]) => { let n = signs.length + 1; while (signs.some(s => s.id === `c${n}`)) n++; return `c${n}` }
function stepFrom(v: unknown, i: number): GraphxStep | null {
  if (!isObj(v)) return null
  const st: GraphxStep = { title: str(v.title) ?? `Paso ${i + 1}` }
  if (str(v.body)) st.body = str(v.body)
  if (strs(v.nodes)) st.nodes = strs(v.nodes)
  if (strs(v.edges)) st.edges = strs(v.edges)
  if (strs(v.expand)) st.expand = strs(v.expand)
  if (num(v.depth) !== undefined) st.depth = num(v.depth)
  if (str(v.select)) st.select = str(v.select)
  if (str(v.view)) st.view = str(v.view)
  return st
}
function bannerFrom(v: unknown): GraphxBanner | null | undefined {
  if (v === null) return null
  if (!isObj(v) || !str(v.text)) return undefined
  const b: GraphxBanner = { text: str(v.text) ?? '', tone: toneOf(v.tone) }
  if (str(v.title)) b.title = str(v.title)
  return b
}
const fxOf = (v: unknown): GraphxBoard['fx'] | undefined => (v === false || v === 'off' ? false : typeof v === 'string' ? v : isObj(v) ? v : undefined)

const SIGN_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Id estable del cartel (para cambiarlo o quitarlo después). Si falta, se genera.' },
    at: { type: 'string', description: 'Id de la pieza a la que se ancla. Sin él, el cartel va suelto.' },
    title: { type: 'string' }, text: { type: 'string', description: 'Texto corto: **negrita**, *cursiva*, `código`, listas con "- " y enlaces.' },
    tone: { type: 'string', enum: TONES }, side: { type: 'string', enum: ['auto', 'top', 'right', 'bottom', 'left'] },
    pin: { type: 'string' }, step: { type: 'number', description: 'Paso del recorrido (base 1) en que se ve.' },
  },
  required: ['text'],
}
const STEP_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' }, body: { type: 'string', description: 'Qué pasa, qué viaja y qué lo dispara.' },
    nodes: { type: 'array', items: { type: 'string' } }, edges: { type: 'array', items: { type: 'string' } }, expand: { type: 'array', items: { type: 'string' } },
    depth: { type: 'number' }, select: { type: 'string' }, view: { type: 'string', description: '"flow:<id>" para un paso en una secuencia.' },
    signs: { type: 'array', items: SIGN_SCHEMA },
  },
  required: ['title'],
}
const FX_SCHEMA = { description: 'Efectos: false, un preset ("calm", "vivid", "neon", "blueprint", "glass", "present") o un objeto { particles, heat: {label, unit, domain, scheme}, spark, progress, alerts, waves, play, spotlight, entrance, glow, gradient, autoColor, owners, blast, timeline, sketch }.' }

const TOOLS = [
  {
    name: 'show',
    description: 'Dibuja un diagrama con GraphX y lo enseña donde esté la persona: en el panel del terminal (con caracteres, a cualquier tamaño y con los efectos animados), en la app de escritorio (SVG del motor) o en el navegador. '
      + 'Pasa UNA fuente: `spec` (JSON de GraphX), `mermaid` (cualquiera de los 18 tipos, con datos de GraphX en @{…} y %% @gx), `paths` (rutas → árbol de ficheros con su diff), `tree_text` (salida de `tree`) o `file` (.json, .mmd o .md). '
      + 'Sustituye el diagrama anterior (carteles y recorrido se borran salvo keep_signs/keep_guide). Devuelve lo pintado, los avisos y los ids. '
      + 'Llama a `capabilities` para elegir el tipo de diagrama y a `reference` para el formato. Úsalo cuando un dibujo explique mejor que el texto: arquitectura, flujos, dependencias, secuencias, planes, estados de un sistema, el árbol de un repo.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' }, spec: { type: 'object', description: 'JSON de GraphX.' }, mermaid: { type: 'string' },
        paths: { type: 'array', items: {}, description: 'Rutas: "src/a.ts" o {path, additions, deletions, status ("A"|"M"|"D"|"R"), size, lines}.' },
        tree_text: { type: 'string' }, file: { type: 'string', description: 'Ruta a un .json, .mmd o .md con el diagrama.' },
        tree_options: { type: 'object', description: 'Para paths/tree_text: {root, compact, focus: "changes"|null, direction}.' },
        lang: { type: 'string', enum: ['es', 'en'] }, direction: { type: 'string', enum: ['right', 'down'] },
        fx: FX_SCHEMA, keep_signs: { type: 'boolean' }, keep_guide: { type: 'boolean' },
        where: { type: 'string', enum: ['auto', 'panel', 'browser', 'both'], description: 'Dónde abrirlo; auto: el panel (y el navegador si la persona lo pidió en la opción del mod).' },
      },
    },
  },
  {
    name: 'patch',
    description: 'Cambia el diagrama sin rehacerlo: add (piezas, aristas, carriles, flujos), update ([{id, …campos}]), remove ([ids]) o set (campos de la raíz: title, direction, initialDepth, layout, fx, owners, timeline…). Para construirlo al vuelo mientras explicas.',
    inputSchema: {
      type: 'object',
      properties: {
        add: { type: 'object', properties: { nodes: { type: 'array', items: { type: 'object' } }, edges: { type: 'array', items: { type: 'object' } }, lanes: { type: 'array', items: { type: 'object' } }, flows: { type: 'array', items: { type: 'object' } } } },
        update: { type: 'array', items: { type: 'object' } }, remove: { type: 'array', items: { type: 'string' } }, set: { type: 'object' },
      },
    },
  },
  {
    name: 'data',
    description: 'Datos en vivo sin recolocar el diagrama (el setData del motor): { nodes: { id: { heat, spark, progress, alert, value, change, parts, status… } }, edges: { id: { rate, weight, speed } } }. Se acumulan; replace: true empieza de cero. '
      + 'Los efectos lo dibujan: calor, series, anillos de progreso, alertas que laten, partículas por caudal, KPI/gauge/donut. Úsalo para monitorizar, comparar o contar cómo cambia algo.',
    inputSchema: { type: 'object', properties: { nodes: { type: 'object' }, edges: { type: 'object' }, replace: { type: 'boolean' }, fx: FX_SCHEMA } },
  },
  {
    name: 'signs',
    description: 'Cartelería: put (carteles anclados a piezas, sueltos o de un paso), remove, clear y banner ({title,text,tone} o null). Tonos: info tip ok warn danger note. Pocos y cortos: riesgos, decisiones, hallazgos, preguntas.',
    inputSchema: { type: 'object', properties: { put: { type: 'array', items: SIGN_SCHEMA }, remove: { type: 'array', items: { type: 'string' } }, clear: { type: 'boolean' }, banner: { type: ['object', 'null'] } } },
  },
  {
    name: 'guide',
    description: 'Guía la mirada. steps define el recorrido (append añade) y go lo mueve (1..N, "next", "prev", "stop"). Vista: focus [ids] (+prune), select, trace {id, dir: up|down}, depth, direction, reset, '
      + 'flow (abre la secuencia de un flujo; null vuelve al grafo), blast (radio de impacto de una pieza), owners ([ids] de equipos), timeline (índice o etiqueta de la línea de tiempo). '
      + 'present: true abre la presentación (para explicar algo paso a paso: define antes los steps con un body claro de 1–3 frases cada uno).',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' }, steps: { type: 'array', items: STEP_SCHEMA }, append: { type: 'array', items: STEP_SCHEMA }, go: { type: ['number', 'string'] },
        focus: { type: 'array', items: { type: 'string' } }, prune: { type: 'boolean' }, label: { type: 'string' }, select: { type: 'string' },
        trace: { type: 'object', properties: { id: { type: 'string' }, dir: { type: 'string', enum: ['up', 'down'] } }, required: ['id'] },
        depth: { type: 'number' }, direction: { type: 'string', enum: ['right', 'down'] }, reset: { type: 'boolean' },
        flow: { type: ['string', 'null'] }, blast: { type: 'string' }, owners: { type: 'array', items: { type: 'string' } }, timeline: { type: ['number', 'string'] },
        present: { type: 'boolean', description: 'Abre el panel en modo presentación: el recorrido paso a paso con su explicación, la cámara siguiendo cada paso (sin steps, uno automático por las piezas).' },
      },
    },
  },
  {
    name: 'view',
    description: 'Mira el diagrama: qué hay pintado (ids, avisos, carteles, paso del recorrido, efectos), una captura PNG del motor (image, por defecto sí) y, con text: true, el panel del terminal tal como lo ve la persona en caracteres (cols × rows), para comprobar cómo se lee.',
    inputSchema: { type: 'object', properties: { image: { type: 'boolean' }, text: { type: 'boolean' }, cols: { type: 'number' }, rows: { type: 'number' }, theme: { type: 'string', enum: ['light', 'dark'] } } },
  },
  {
    name: 'convert',
    description: 'Conversión con Mermaid sin tocar el lienzo. Con `mermaid`: el JSON de GraphX que sale, su tipo, los avisos (línea a línea) y las anotaciones de GraphX que lleva (claves de @{…} y comentarios %% @gx, por pieza, arista y raíz). '
      + 'Con `spec` (JSON de GraphX): ese diagrama expresado como Mermaid válido con sus datos en @{…} y %% @gx (flow: <id> para una secuencia).',
    inputSchema: { type: 'object', properties: { mermaid: { type: 'string' }, spec: { type: 'object' }, flow: { type: 'string' }, lang: { type: 'string', enum: ['es', 'en'] } } },
  },
  {
    name: 'export',
    description: 'El diagrama del lienzo como Mermaid con todas sus anotaciones de GraphX (los datos en vivo y los parches incluidos), para pegarlo en un README, una PR o un .mmd. flow: <id> exporta una secuencia; regen: true lo reescribe aunque viniera de Mermaid.',
    inputSchema: { type: 'object', properties: { flow: { type: 'string' }, regen: { type: 'boolean' } } },
  },
  {
    name: 'capabilities',
    description: 'El mapa de lo que GraphX sabe dibujar (18 tipos de Mermaid, grafo, árbol, 61 formas, efectos y datos) y cómo se verá en cada superficie: navegador, escritorio, terminal en caracteres y terminal con imágenes; con lo detectado de este terminal. Para elegir el diagrama adecuado.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'reference',
    description: 'La chuleta del formato: JSON de GraphX, Mermaid con datos (@{…} y %% @gx), efectos, cartelería, recorrido, datos en vivo y parches. Léela antes del primer show.',
    inputSchema: { type: 'object', properties: {} },
  },
] as const

/* ---------- capacidades ---------- */
const ENV_NAMES = ['TERM', 'COLORTERM', 'TERM_PROGRAM', 'TERM_PROGRAM_VERSION', 'KITTY_WINDOW_ID', 'GHOSTTY_RESOURCES_DIR', 'WEZTERM_EXECUTABLE', 'ITERM_SESSION_ID', 'VTE_VERSION', 'WT_SESSION', 'TMUX', 'STY', 'ZELLIJ', 'SSH_CONNECTION', 'SSH_TTY', 'NO_COLOR', 'FORCE_COLOR', 'LANG', 'LC_ALL', 'LC_CTYPE', 'LC_MESSAGES', 'COLORFGBG', 'KONSOLE_VERSION', 'ALACRITTY_SOCKET', 'TERMINAL_EMULATOR', 'WARP_IS_LOCAL_SHELL_SESSION', 'CLAUDE_CODE_REDUCED_MOTION'] as const
async function readEnv($: D): Promise<Env> {
  /* los nombres van uno a uno y escritos: el motor solo deja leer los que el módulo nombra */
  const v = await Promise.all([
    $.env.get('TERM'), $.env.get('COLORTERM'), $.env.get('TERM_PROGRAM'), $.env.get('TERM_PROGRAM_VERSION'), $.env.get('KITTY_WINDOW_ID'), $.env.get('GHOSTTY_RESOURCES_DIR'),
    $.env.get('WEZTERM_EXECUTABLE'), $.env.get('ITERM_SESSION_ID'), $.env.get('VTE_VERSION'), $.env.get('WT_SESSION'), $.env.get('TMUX'), $.env.get('STY'), $.env.get('ZELLIJ'),
    $.env.get('SSH_CONNECTION'), $.env.get('SSH_TTY'), $.env.get('NO_COLOR'), $.env.get('FORCE_COLOR'), $.env.get('LANG'), $.env.get('LC_ALL'), $.env.get('LC_CTYPE'), $.env.get('LC_MESSAGES'),
    $.env.get('COLORFGBG'), $.env.get('KONSOLE_VERSION'), $.env.get('ALACRITTY_SOCKET'), $.env.get('TERMINAL_EMULATOR'), $.env.get('WARP_IS_LOCAL_SHELL_SESSION'), $.env.get('CLAUDE_CODE_REDUCED_MOTION'),
  ])
  const env: Env = {}
  ENV_NAMES.forEach((k, i) => { if (v[i] != null) env[k] = v[i] })
  return env
}
async function claudeConfig($: D, key: string) {
  try { const row = (await $.config.list()).find(r => r.key === key); return typeof row?.value === 'string' ? row.value : undefined } catch { return undefined }
}
const claudeTheme = ($: D) => claudeConfig($, 'theme')
/* el idioma: la opción del mod, el de Claude Code, la configuración regional; inglés si nada lo dice */
async function langFor($: D, env: Env) { return pickLang({ option: optLang, claude: await claudeConfig($, 'language'), env }) }
let detected: Caps | null = null
async function detect($: D, fullscreen?: boolean) {
  const env = await readEnv($)
  detected = detectCaps(env, { fullscreen, claudeTheme: await claudeTheme($), surface: 'terminal', lang: await langFor($, env) })
  setLang(detected.lang)
  await update($, capsA, () => detected)
  return detected
}
/* sin escribir estado (se llama desde los render): lo detectado al arrancar o, si aún no, se deduce aquí */
async function capsFor($: D, surface: string, fullscreen?: boolean): Promise<Caps> {
  let c = (await read($, capsA)) ?? detected
  if (!c) { const env = await readEnv($); c = detectCaps(env, { fullscreen, claudeTheme: await claudeTheme($), surface, lang: await langFor($, env) }); detected = c }
  let out = c
  if (fullscreen !== undefined && out.pointer !== (fullscreen || surface === 'desktop')) out = { ...out, pointer: fullscreen || surface === 'desktop' }
  if (surface !== 'terminal') out = { ...out, color: 'truecolor', glyphs: 'unicode', braille: true, images: 'none', fps: 15 }
  const caps = withOverrides(out, { ...optCaps, ...((await read($, overA)) ?? {}) })
  setLang(caps.lang)
  return caps
}

/* las props del lienzo, dentro del tamaño que admite un Client */
function fitProps(p: CanvasProps): CanvasProps {
  let s = p.scene
  if (!s) return p
  const size = (x: unknown) => JSON.stringify(x).length
  if (size(p) <= PROPS_MAX) return p
  const steps: ((x: Scene) => Scene)[] = [
    x => (x.cells ? (x.dir === 'down' ? { ...x, cells: { right: { cards: null, chips: null, mini: null }, down: x.cells.down } } : { ...x, cells: { right: x.cells.right, down: { cards: null, chips: null, mini: null } } }) : x),
    x => (x.cells ? { ...x, cells: { right: { ...x.cells.right, mini: null }, down: x.cells.down } } : x),
    x => ({ ...x, model: x.model ? { all: [], par: x.model.par, labels: {} } : undefined }),
    x => (x.timeline ? { ...x, timeline: { ...x.timeline, frames: x.timeline.frames.filter((_, i) => i % 2 === 0), labels: x.timeline.labels.filter((_, i) => i % 2 === 0), total: x.timeline.total.filter((_, i) => i % 2 === 0) } } : x),
    x => ({ ...x, deco: (x.deco ?? []).slice(0, 120) }),
    x => ({ ...x, nodes: (x.nodes ?? []).map(n => ({ ...n, sm: undefined })) }),
    x => (x.cells ? { ...x, cells: { right: { ...x.cells.right, chips: null }, down: x.cells.down } } : x),
    x => ({ ...x, cells: undefined }),
    x => (x.rows && x.rows.length > 500 ? { ...x, rows: x.rows.slice(0, 500).map(r => ({ ...r, sm: undefined })) } : x),
    x => (x.sq && x.sq.rows.length > 160 ? { ...x, sq: { ...x.sq, rows: x.sq.rows.slice(0, 160).map(r => ({ ...r, sm: undefined, dt: undefined })) } } : x),
    x => (x.rows && x.rows.length > 200 ? { ...x, rows: x.rows.slice(0, 200) } : x),
    x => ({ ...x, edges: (x.edges ?? []).map(e => ({ ...e, p: e.p.filter((_, i, a) => i === 0 || i === a.length - 1 || i % 2 === 0) })) }),
    /* lo último: menos piezas (las primeras en orden de lectura) y solo sus aristas */
    x => { const keep = (x.nodes ?? []).slice().sort((a, b) => a.y - b.y || a.x - b.x).slice(0, 300); const ids = new Set(keep.map(n => n.i)); return { ...x, nodes: keep.map(n => ({ ...n, rw: undefined, pt: undefined })), edges: (x.edges ?? []).filter(e => ids.has(e.a) && ids.has(e.b)), deco: [], timeline: null, model: undefined } },
  ]
  for (const f of steps) { s = f(s); if (size({ ...p, scene: s }) <= PROPS_MAX) break }
  return { ...p, scene: s, detail: size({ ...p, scene: s }) > PROPS_MAX ? null : p.detail }
}

/* ---------- el registro ---------- */
export const register: Register = (on, options) => {
  const v = options.view
  where = v === 'browser' || v === 'both' || v === 'panel' ? v : 'auto'
  inlineOn = options.inline !== 'off'
  optCaps = {}
  if (options.color === 'truecolor' || options.color === '256' || options.color === '16' || options.color === 'mono') optCaps.color = options.color
  if (options.glyphs === 'unicode' || options.glyphs === 'basic' || options.glyphs === 'ascii') optCaps.glyphs = options.glyphs
  if (options.motion === 'full' || options.motion === 'reduced' || options.motion === 'off') optCaps.motion = options.motion
  if (options.theme === 'dark' || options.theme === 'light') optCaps.theme = options.theme
  optLang = typeof options.language === 'string' ? options.language : undefined

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    for (const t of TOOLS) await $.tool.register({ name: t.name, description: t.description, inputSchema: t.inputSchema as unknown as Record<string, unknown> })
    await detect($)
    await $.command.register({ name: 'graphx-mod', description: tr('GraphX (mod): panel del diagrama, navegador, imagen, capacidades del terminal, efectos, demos, exportar a Mermaid · help', 'GraphX (mod): diagram panel, browser, image, terminal capabilities, effects, demos, Mermaid export · help'), argumentHint: '[panel|present|open|image|cells|caps|fx|demo|last|export|clear|stop|help]' })
    /* una recarga del mod: el tablero sigue en $.state, así que el servidor vuelve en el mismo puerto */
    if (await read($, boardA)) {
      try {
        const s = await ensureServer($)
        await call($, s, '/state', { rev: await read($, revA), board: await read($, boardA) })
        await fetchScene($, s)
        await syncStatus($)
      } catch (err) { $.ui.log(`graphx-mod: no se ha podido recuperar el lienzo: ${String(err)}`, { to: 'debug' }) }
    }
    return started
  })
  on('session.end', async ($, e, next) => { await stopServer($); return next(e) })

  /* que Claude sepa lo que tiene: sus bloques ```mermaid se ven como GraphX y las herramientas dibujan en el panel */
  on('prompt.compose', async ($, e, next) => {
    void $
    const r = await next(e)
    const text = [
      '# Diagramas con GraphX',
      'En esta sesión hay un lienzo de GraphX (herramientas mcp__graphx-mod__*). Cuando un dibujo explique mejor que el texto (arquitectura, flujos, dependencias, secuencias, estados, planes, el árbol de un repo, datos que cambian), dibújalo con mcp__graphx-mod__show y guíalo con guide, signs y data: se ve en el panel del terminal (con caracteres y efectos, a cualquier tamaño), en la app de escritorio y en el navegador.',
      inlineOn ? 'Los bloques ```mermaid de tus respuestas también se dibujan con GraphX (los 18 tipos de Mermaid; datos extra con claves en id@{…} y comentarios %% @gx). Para algo que vas a cambiar o recorrer, mejor el lienzo.' : '',
      'Primera vez: mcp__graphx-mod__capabilities para elegir el tipo y mcp__graphx-mod__reference para el formato. Comprueba lo dibujado con mcp__graphx-mod__view.',
    ].filter(Boolean).join('\n')
    return { ...r, sections: [...r.sections, { id: 'graphx', text, scope: 'session' as const }] }
  })

  /* ---- show ---- */
  on('tool.call', { tool: 'mcp__graphx-mod__show' }, async ($, e) => {
    let source: GraphxSource | null = null
    const n = [e.spec, e.mermaid, e.paths, e.tree_text, e.file].filter(x => x !== undefined).length
    if (n !== 1) return { result: 'Pasa exactamente una fuente: spec, mermaid, paths, tree_text o file.' }
    const treeOpts = isObj(e.tree_options) ? e.tree_options : undefined
    if (isObj(e.spec)) source = { kind: 'spec', spec: e.spec }
    else if (typeof e.mermaid === 'string') source = { kind: 'mermaid', text: e.mermaid }
    else if (Array.isArray(e.paths)) source = { kind: 'paths', entries: e.paths, options: treeOpts }
    else if (typeof e.tree_text === 'string') source = { kind: 'tree-text', text: e.tree_text, options: treeOpts }
    else if (typeof e.file === 'string') {
      let text: string
      try { text = await $.fs.read(e.file) } catch (err) { return { result: `No se ha podido leer ${e.file}: ${String(err)}` } }
      if (/\.json$/i.test(e.file)) { try { source = { kind: 'spec', spec: JSON.parse(text) as Record<string, unknown> } } catch (err) { return { result: `${e.file} no es JSON válido: ${String(err)}` } } }
      else { const m = /```mermaid\s*\n([\s\S]*?)```/.exec(text); source = { kind: 'mermaid', text: m ? m[1]! : text } }
    }
    if (!source) return { result: 'La fuente no tiene el tipo esperado (spec es un objeto; mermaid, tree_text y file, texto; paths, una lista).' }
    const whereNow: ViewMode = e.where === 'panel' || e.where === 'browser' || e.where === 'both' ? e.where : where
    await update($, detailA, () => null)
    const { rev, server, viewers } = await publish($, prev => {
      const b = emptyBoard(source!)
      const title = str(e.title) ?? (isObj(e.spec) ? str(e.spec.title) : undefined)
      if (title) b.title = title
      if (e.lang === 'es' || e.lang === 'en') b.lang = e.lang
      if (e.direction === 'right' || e.direction === 'down') b.direction = e.direction
      const fx = fxOf(e.fx); if (fx !== undefined) b.fx = fx
      if (prev && e.keep_signs === true) { b.signs = prev.signs; b.banner = prev.banner }
      if (prev && e.keep_guide === true) b.guide = { ...prev.guide, seq: prev.guide.seq + 1 }
      if (prev) b.view = { seq: prev.view.seq + 1 }
      return b
    })
    const r = await settle($, rev)
    await presentAt($, viewers, server.url, whereNow)
    const extra: string[] = []
    if (!server.engine) extra.push('El motor sin navegador no está disponible: solo se ve en el navegador.')
    return { result: await summary($, rev, r, { ids: true, extra }) }
  })

  /* ---- patch ---- */
  on('tool.call', { tool: 'mcp__graphx-mod__patch' }, async ($, e) => {
    if (!(await read($, boardA))) return { result: 'No hay ningún diagrama: empieza con show.' }
    const p: Json = {}
    if (isObj(e.add)) p.add = e.add
    if (Array.isArray(e.update)) p.update = e.update
    if (strs(e.remove)?.length) p.remove = strs(e.remove)
    if (isObj(e.set)) p.set = e.set
    if (!Object.keys(p).length) return { result: 'El parche está vacío: usa add, update, remove o set.' }
    const { rev } = await publish($, b => (b ? { ...b, patches: [...b.patches, p] } : b))
    const r = await settle($, rev)
    return { result: await summary($, rev, r, { ids: !!(isObj(e.add) && Array.isArray(e.add.nodes)) }) }
  })

  /* ---- data ---- */
  on('tool.call', { tool: 'mcp__graphx-mod__data' }, async ($, e) => {
    if (!(await read($, boardA))) return { result: 'No hay ningún diagrama: empieza con show.' }
    const { rev } = await publish($, b => {
      if (!b) return b
      const prev = e.replace === true ? {} : b.data ?? {}
      const merge = (a: Record<string, Record<string, unknown>> | undefined, x: unknown) => {
        const out = { ...(a ?? {}) }
        if (isObj(x)) for (const [id, val] of Object.entries(x)) if (isObj(val)) out[id] = { ...(out[id] ?? {}), ...val }
        return out
      }
      const fx = fxOf(e.fx)
      return { ...b, data: { nodes: merge(prev.nodes, e.nodes), edges: merge(prev.edges, e.edges) }, ...(fx !== undefined ? { fx } : {}) }
    })
    const r = await settle($, rev)
    const b = await read($, boardA)
    const nn = Object.keys(b?.data?.nodes ?? {}).length, ne = Object.keys(b?.data?.edges ?? {}).length
    return { result: await summary($, rev, r, { extra: [`Datos en vivo: ${nn} pieza${nn === 1 ? '' : 's'}, ${ne} arista${ne === 1 ? '' : 's'}.`] }) }
  })

  /* ---- signs ---- */
  on('tool.call', { tool: 'mcp__graphx-mod__signs' }, async ($, e) => {
    if (!(await read($, boardA))) return { result: 'No hay ningún diagrama: empieza con show.' }
    const skipped: string[] = []
    const { rev } = await publish($, b => {
      if (!b) return b
      let signs = e.clear === true ? [] : [...b.signs]
      const gone = new Set(strs(e.remove) ?? [])
      if (gone.size) signs = signs.filter(s => !gone.has(s.id))
      for (const raw of Array.isArray(e.put) ? e.put : []) {
        const s = signFrom(raw, nextSignId(signs), b.guide.steps.length)
        if (!s) { skipped.push(JSON.stringify(raw).slice(0, 60)); continue }
        const i = signs.findIndex(x => x.id === s.id)
        if (i >= 0) signs[i] = s; else signs.push(s)
      }
      const banner = bannerFrom(e.banner)
      return { ...b, signs, banner: banner === undefined ? b.banner : banner }
    })
    const r = await settle($, rev)
    const b = await read($, boardA)
    const list = (b?.signs ?? []).map(s => `${s.id}${s.at ? `@${s.at}` : ''}${s.step !== undefined ? ` (paso ${s.step + 1})` : ''}`).join(', ')
    return { result: await summary($, rev, r, { extra: [`Carteles: ${list || 'ninguno'}`, ...(skipped.length ? [`Ignorados (sin texto): ${skipped.join(' · ')}`] : [])] }) }
  })

  /* ---- guide ---- */
  on('tool.call', { tool: 'mcp__graphx-mod__guide' }, async ($, e) => {
    if (!(await read($, boardA))) return { result: 'No hay ningún diagrama: empieza con show.' }
    const { rev } = await publish($, b => {
      if (!b) return b
      let steps = b.guide.steps
      let signs = b.signs
      const stepSigns: GraphxSign[] = []
      const take = (list: unknown[], offset: number) => list.map((raw, i) => {
        const st = stepFrom(raw, offset + i)
        if (st && isObj(raw) && Array.isArray(raw.signs)) for (const sv of raw.signs) { const s = signFrom(sv, `p${offset + i + 1}-${stepSigns.length + 1}`, Infinity); if (s) stepSigns.push({ ...s, step: offset + i }) }
        return st
      }).filter((x): x is GraphxStep => x !== null)
      if (Array.isArray(e.steps)) { steps = take(e.steps, 0); signs = signs.filter(s => s.step === undefined) }
      if (Array.isArray(e.append)) steps = [...steps, ...take(e.append, steps.length)]
      signs = [...signs.filter(s => !stepSigns.some(x => x.id === s.id)), ...stepSigns]
      let at = b.guide.at
      /* sin recorrido de Claude, el propio del diagrama */
      const n = steps.length || scene?.tour?.steps.length || 0
      if (Array.isArray(e.steps)) at = -1
      if (typeof e.go === 'number') at = Math.min(Math.max(1, Math.round(e.go)), Math.max(n, 1)) - 1
      else if (e.go === 'next') at = Math.min(at + 1, n - 1)
      else if (e.go === 'prev') at = Math.max(at - 1, 0)
      else if (e.go === 'stop') at = -1
      if (!n) at = -1
      /* presentar es empezar: si el recorrido estaba parado, al paso 1 */
      if (e.present === true && at < 0 && n) at = 0
      const guide = { title: str(e.title) ?? b.guide.title, steps, at, seq: b.guide.seq + 1 }
      const v: GraphxView = { seq: b.view.seq }
      let viewed = false
      if (strs(e.focus)) { v.focus = strs(e.focus); viewed = true; if (e.prune === true) v.prune = true; if (str(e.label)) v.label = str(e.label) }
      if (str(e.select)) { v.select = str(e.select); viewed = true }
      if (isObj(e.trace) && str(e.trace.id)) { v.trace = { id: str(e.trace.id) ?? '', dir: e.trace.dir === 'down' ? 'down' : 'up' }; viewed = true }
      if (num(e.depth) !== undefined) { v.depth = num(e.depth); viewed = true }
      if (e.direction === 'right' || e.direction === 'down') { v.direction = e.direction; viewed = true }
      if (e.reset === true) { v.reset = true; viewed = true }
      if (e.flow !== undefined && (typeof e.flow === 'string' || e.flow === null)) { v.flow = e.flow; viewed = true }
      if (str(e.blast)) { v.blast = str(e.blast); viewed = true }
      if (strs(e.owners)) { v.owners = strs(e.owners); viewed = true }
      if (typeof e.timeline === 'number' || typeof e.timeline === 'string') { v.timeline = e.timeline; viewed = true }
      if (viewed) v.seq = b.view.seq + 1
      return { ...b, guide, signs, view: viewed ? v : b.view }
    })
    if (e.present === true) { await update($, presentA, p => ({ n: (p?.n ?? 0) + 1, at: Date.now() })); await $.ui.open({ id: PANE, title: 'GraphX' }) }
    const r = await settle($, rev)
    const b = await read($, boardA)
    const g = b?.guide
    const pos = g && g.steps.length ? (g.at >= 0 ? `Recorrido en el paso ${g.at + 1} de ${g.steps.length}: «${g.steps[g.at]?.title ?? ''}».` : `Recorrido de ${g.steps.length} pasos, parado (go: 1 para empezar).`) : 'Sin recorrido.'
    return { result: await summary($, rev, r, { extra: [pos] }) }
  })

  /* ---- view ---- */
  on('tool.call', { tool: 'mcp__graphx-mod__view' }, async ($, e) => {
    const s = await read($, serverA)
    if (s) await pump($)
    const b = await read($, boardA)
    if (!b) return { result: 'El lienzo está vacío: empieza con show.' }
    const rev = await read($, revA)
    const r = await read($, renderA)
    const live = await read($, liveA)
    const extra: string[] = []
    if (b.banner) extra.push(`Banner (${b.banner.tone ?? 'info'}): ${b.banner.title ? b.banner.title + ' — ' : ''}${clip(b.banner.text, 160)}`)
    if (b.signs.length) extra.push('Carteles:\n' + b.signs.map(x => `- ${x.id} [${x.tone ?? 'info'}]${x.at ? ` @${x.at}` : ' (suelto)'}${x.step !== undefined ? ` paso ${x.step + 1}` : ''}: ${x.title ? x.title + ' — ' : ''}${clip(x.text, 120)}`).join('\n'))
    if (b.guide.steps.length) extra.push(`Recorrido «${b.guide.title ?? 'Recorrido'}»: ${b.guide.steps.map((st, i) => `${i === b.guide.at ? '▶' : ''}${i + 1}. ${st.title}`).join(' · ')}${b.guide.at >= 0 ? '' : ' (parado)'}`)
    if (b.patches.length) extra.push(`${b.patches.length} parche${b.patches.length === 1 ? '' : 's'} sobre la fuente (${b.source.kind}).`)
    if (b.data && (Object.keys(b.data.nodes ?? {}).length || Object.keys(b.data.edges ?? {}).length)) extra.push(`Datos en vivo en ${Object.keys(b.data.nodes ?? {}).length} piezas y ${Object.keys(b.data.edges ?? {}).length} aristas.`)
    if (live.asks) extra.push(`La persona ha hecho ${live.asks} pregunta${live.asks === 1 ? '' : 's'} desde el diagrama.`)
    const content: unknown[] = []
    let text = await summary($, rev, r, { ids: true, extra })
    if (e.text === true) {
      const sc = await ensureScene($)
      const caps = await capsFor($, 'terminal')
      if (sc) text += `\n\nEl panel del terminal (${num(e.cols) ?? 120}×${num(e.rows) ?? 36}, ${caps.color}, ${caps.glyphs}):\n\`\`\`\n${textFrame(sc, caps, num(e.cols) ?? 120, num(e.rows) ?? 36)}\n\`\`\``
    }
    content.push({ type: 'text', text })
    if (e.image !== false && s) {
      try {
        const theme = e.theme === 'dark' ? 'dark' : 'light'
        const png = await call($, s, `/png.b64?theme=${theme}&width=1400`)
        if (png.ok) {
          const j = JSON.parse(png.text) as { b64: string; w: number; h: number }
          content.push({ type: 'text', text: `Captura del motor (${j.w}×${j.h}, tema ${theme}):` })
          content.push({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: j.b64 } })
        }
      } catch { /* sin captura */ }
    }
    return { result: content.length === 1 ? text : content }
  })

  /* ---- convert / export ---- */
  on('tool.call', { tool: 'mcp__graphx-mod__convert' }, async ($, e) => {
    const s = await ensureServer($)
    if (typeof e.mermaid === 'string') {
      const r = await call($, s, '/convert', { mermaid: e.mermaid, lang: e.lang })
      const j = JSON.parse(r.text) as { spec?: unknown; type?: string; warnings?: string[]; error?: string; line?: number; count?: Record<string, unknown>; annotations?: { nodes: Record<string, string[]>; edges: Record<string, string[]>; root: string[]; comments: number; inline: number } }
      if (j.error) return { result: `No se puede convertir${j.line ? ` (línea ${j.line})` : ''}: ${j.error}` }
      const a = j.annotations
      const ann = a ? [
        `Anotaciones de GraphX: ${a.inline} en @{…}, ${a.comments} comentarios %% @gx.`,
        ...(a.root.length ? [`- raíz: ${a.root.join(', ')}`] : []),
        ...Object.entries(a.nodes).map(([k, v]) => `- pieza ${k}: ${v.join(', ')}`),
        ...Object.entries(a.edges).map(([k, v]) => `- arista ${k}: ${v.join(', ')}`),
      ].join('\n') : ''
      const json = JSON.stringify(j.spec)
      return { result: `Mermaid ${j.type} → GraphX: ${JSON.stringify(j.count)}\n${j.warnings?.length ? 'Avisos:\n- ' + j.warnings.join('\n- ') + '\n' : 'Sin avisos.\n'}${ann}\n\nJSON:\n${json.length > 60000 ? json.slice(0, 60000) + '…(cortado)' : json}` }
    }
    if (isObj(e.spec)) {
      const r = await call($, s, '/convert', { spec: e.spec, flow: e.flow })
      const j = JSON.parse(r.text) as { text?: string; type?: string; lossy?: string[]; error?: string }
      if (!r.ok || j.error || !j.text) return { result: `No se ha podido expresar como Mermaid: ${j.error ?? 'error desconocido'}` }
      return { result: `\`\`\`mermaid\n${j.text}\`\`\`${j.lossy?.length ? `\nNota: ${j.lossy.join('; ')}` : ''}` }
    }
    return { result: 'Pasa mermaid (para convertirlo a GraphX y ver sus anotaciones) o spec (para expresarlo como Mermaid).' }
  })
  on('tool.call', { tool: 'mcp__graphx-mod__export' }, async ($, e) => {
    if (!(await read($, boardA))) return { result: 'No hay ningún diagrama: empieza con show.' }
    const s = await ensureServer($)
    const r = await call($, s, `/export?${new URLSearchParams({ ...(typeof e.flow === 'string' ? { flow: e.flow } : {}), ...(e.regen === true ? { regen: '1' } : {}) }).toString()}`)
    const j = JSON.parse(r.text) as { text?: string; type?: string; lossy?: string[]; error?: string }
    if (j.error) return { result: j.error }
    return { result: `Mermaid (${j.type}):\n\`\`\`mermaid\n${j.text}\`\`\`${j.lossy?.length ? `\nNota: ${j.lossy.join('; ')}` : ''}` }
  })
  on('tool.call', { tool: 'mcp__graphx-mod__capabilities' }, async $ => {
    const caps = await capsFor($, 'terminal')
    const s = await read($, serverA)
    return { result: capabilitiesText(caps, { rsvg: s?.rsvg, engine: s?.engine }) }
  })
  on('tool.call', { tool: 'mcp__graphx-mod__reference' }, () => ({ result: REFERENCE }))

  /* ---- /graphx-mod ---- */
  on('command.run', { command: 'graphx-mod' }, async ($, e) => {
    const [sub = '', ...rest] = e.args.trim().split(/\s+/)
    const arg = sub.toLowerCase()
    if (arg === 'help' || arg === '?' || arg === 'ayuda') return { text: help() }
    if (arg === 'stop') { await stopServer($); return { text: tr('GraphX: servidor parado. El tablero sigue guardado; la próxima herramienta lo vuelve a abrir.', 'GraphX: server stopped. The board is still saved; the next tool call opens it again.') } }
    if (arg === 'last' || arg === 'restore') {
      const last = (await $.store.get('last-board').catch(() => null)) as { board?: GraphxBoard; at?: number } | null
      if (!last?.board) return { text: tr('GraphX: no hay ningún diagrama guardado de otra sesión.', 'GraphX: no diagram saved from another session.') }
      await update($, detailA, () => null)
      await publish($, prev => ({ ...last.board!, view: { seq: (prev?.view.seq ?? 0) + 1 }, guide: { ...last.board!.guide, seq: (prev?.guide.seq ?? 0) + 1 } }))
      await $.ui.open({ id: PANE, title: 'GraphX', focus: true })
      const when = last.at ? new Date(last.at).toLocaleString(tr('es-ES', 'en-GB'), { dateStyle: 'short', timeStyle: 'short' }) : ''
      return { text: tr(`GraphX: recuperado «${last.board.title ?? 'el último diagrama'}»${when ? ` (${when})` : ''}.`, `GraphX: restored “${last.board.title ?? 'the last diagram'}”${when ? ` (${when})` : ''}.`) }
    }
    if (arg === 'clear') {
      await update($, boardA, () => null); await update($, renderA, () => null); await update($, detailA, () => null); scene = null
      if (await read($, serverA)) await publish($, () => null)
      $.ui.status(undefined)
      return { text: tr('GraphX: lienzo vacío.', 'GraphX: canvas cleared.') }
    }
    if (arg === 'caps') {
      if (rest[0] === 'reset') { await update($, overA, () => null); await detect($, e.presentation?.isFullscreen) }
      else if (rest.length) {
        const over: Partial<Caps> = { ...((await read($, overA)) ?? {}) }
        for (const kv of rest) {
          const [k, val] = kv.split('=')
          if (k === 'color' && /^(truecolor|256|16|mono|auto)$/.test(val ?? '')) over.color = val === 'auto' ? undefined : val as Caps['color']
          else if (k === 'glyphs' && /^(unicode|basic|ascii|auto)$/.test(val ?? '')) over.glyphs = val === 'auto' ? undefined : val as Caps['glyphs']
          else if (k === 'motion' && /^(full|reduced|off|auto)$/.test(val ?? '')) over.motion = val === 'auto' ? undefined : val as Caps['motion']
          else if (k === 'theme' && /^(dark|light|auto)$/.test(val ?? '')) over.theme = val === 'auto' ? undefined : val as Caps['theme']
          else if (k === 'lang' && /^(es|en|auto)$/.test(val ?? '')) over.lang = val === 'auto' ? undefined : val as Caps['lang']
          else if (k === 'images' && /^(kitty|none|auto)$/.test(val ?? '')) over.images = val === 'auto' ? undefined : val as Caps['images']
          else if (k === 'fps' && Number(val) > 0) over.fps = Math.min(30, Number(val))
          else return { text: tr(`GraphX: no entiendo «${kv}». Claves: color=truecolor|256|16|mono, glyphs=unicode|basic|ascii, motion=full|reduced|off, theme=dark|light, lang=es|en, images=kitty|none, fps=N (auto quita lo forzado).`, `GraphX: I don't understand “${kv}”. Keys: color=truecolor|256|16|mono, glyphs=unicode|basic|ascii, motion=full|reduced|off, theme=dark|light, lang=es|en, images=kitty|none, fps=N (auto drops the override).`) }
        }
        await update($, overA, () => over)
        await update($, seqA, n => n + 1)
      }
      const c = await capsFor($, 'terminal', e.presentation?.isFullscreen)
      const why = c.why.map(w => `  · ${w}`).join('\n')
      return { text: tr(
        `GraphX · este terminal (${c.term || 'sin nombre'}): color ${c.color} · caracteres ${c.glyphs}${c.braille ? ' + braille' : ''} · imágenes ${c.images} · ratón ${c.pointer ? 'sí' : 'no'} · movimiento ${c.motion} · ${c.fps} fps · tema ${c.theme} · idioma ${c.lang}\n${why}\nCámbialo con /graphx-mod caps color=256 glyphs=ascii motion=off theme=light lang=en … (o reset).`,
        `GraphX · this terminal (${c.term || 'unnamed'}): color ${c.color} · glyphs ${c.glyphs}${c.braille ? ' + braille' : ''} · images ${c.images} · mouse ${c.pointer ? 'yes' : 'no'} · motion ${c.motion} · ${c.fps} fps · theme ${c.theme} · language ${c.lang}\n${why}\nChange it with /graphx-mod caps color=256 glyphs=ascii motion=off theme=light lang=es … (or reset).`) }
    }
    if (arg === 'fx') {
      if (!(await read($, boardA))) return { text: tr('GraphX: no hay ningún diagrama.', 'GraphX: there is no diagram.') }
      const preset = rest[0] ?? 'vivid'
      await publish($, b => (b ? { ...b, fx: preset === 'off' || preset === 'false' ? false : preset } : b))
      return { text: tr(`GraphX: efectos «${preset}».`, `GraphX: effects “${preset}”.`) }
    }
    if (arg === 'demo') {
      const name = (rest[0] ?? '').toLowerCase()
      const list = await demos($)
      if (!name || !list.includes(name)) return { text: tr(`GraphX · demos: ${list.join(', ')}\nUso: /graphx-mod demo <nombre>`, `GraphX · demos: ${list.join(', ')}\nUsage: /graphx-mod demo <name>`) }
      const file = `${$.plugin.root}/assets/demos/${name}${list.includes(name) ? '' : ''}`
      const ext = (await $.fs.list(`${$.plugin.root}/assets/demos`)).find(f => f.name.startsWith(name + '.'))?.name ?? `${name}.mmd`
      const text = await $.fs.read(`${$.plugin.root}/assets/demos/${ext}`)
      void file
      const source: GraphxSource = ext.endsWith('.json') ? { kind: 'spec', spec: JSON.parse(text) as Record<string, unknown> } : { kind: 'mermaid', text }
      await update($, detailA, () => null)
      await publish($, prev => ({ ...emptyBoard(source), view: { seq: (prev?.view.seq ?? 0) + 1 } }))
      await $.ui.open({ id: PANE, title: 'GraphX', focus: true })
      return { text: tr(`GraphX: demo «${name}» en el panel. r la presenta paso a paso; Esc vuelve al prompt.`, `GraphX: demo “${name}” in the panel. r presents it step by step; Esc returns to the prompt.`) }
    }
    if (arg === 'export') {
      if (!(await read($, boardA))) return { text: tr('GraphX: no hay ningún diagrama.', 'GraphX: there is no diagram.') }
      const s = await ensureServer($)
      const r = await call($, s, '/export')
      const j = JSON.parse(r.text) as { text?: string; error?: string }
      return { text: j.error ? `GraphX: ${j.error}` : `\`\`\`mermaid\n${j.text}\`\`\`` }
    }
    const s = await ensureServer($)
    if (arg === 'open' || arg === 'browser') { const ok = await openBrowser($, s.url); return { text: ok ? tr(`GraphX: abierto ${s.url}`, `GraphX: opened ${s.url}`) : tr(`GraphX: abre ${s.url} en el navegador`, `GraphX: open ${s.url} in your browser`) } }
    if (arg === 'image' || arg === 'cells' || arg === 'svg' || arg === 'auto') await update($, viewA, () => (arg === 'image' || arg === 'cells' || arg === 'svg' ? arg : 'auto'))
    if (arg === 'imgtest') { await $.ui.open({ id: 'graphx-imgtest', title: tr('Prueba de imagen', 'Image test') }); return { text: tr('GraphX: panel de prueba de imagen abierto.', 'GraphX: image test panel opened.') } }
    await fetchScene($, s)
    /* lo abre la persona: con el teclado (la barra de atajos), Esc lo devuelve al prompt */
    await $.ui.open({ id: PANE, title: 'GraphX', focus: true })
    if (arg === 'present' || arg === 'presentar') await update($, presentA, p => ({ n: (p?.n ?? 0) + 1, at: Date.now() }))
    return { text: tr(`GraphX en el panel${arg === 'image' ? ' (imagen)' : arg === 'cells' ? ' (caracteres)' : ''} · navegador: ${s.url}`, `GraphX in the panel${arg === 'image' ? ' (image)' : arg === 'cells' ? ' (characters)' : ''} · browser: ${s.url}`) }
  })

  /* ---- lo que la persona hace en el lienzo ---- */
  on('ui.message', { element: 'canvas' }, async ($, e) => {
    const d = isObj(e.data) ? e.data : {}
    const s = await read($, serverA)
    if (!s) return {}
    if (d.type === 'ui') {
      const body: Json = {}
      for (const k of ['open', 'close', 'depth', 'dir', 'search', 'view', 'owners', 'reset']) if (d[k] !== undefined) body[k] = d[k]
      await fetchScene($, s, body)
    } else if (d.type === 'detail' && str(d.id)) {
      try { const r = await call($, s, `/detail?id=${encodeURIComponent(str(d.id) ?? '')}`); if (r.ok) { const det = JSON.parse(r.text) as Detail; await update($, detailA, () => (det.error ? null : det)) } } catch { /* sin detalle */ }
    } else if (d.type === 'ask') await ask($, str(d.id) ?? '', str(d.label) ?? str(d.id) ?? '')
    else if (d.type === 'open') { const ok = await openBrowser($, s.url); if (!ok) $.ui.toast(tr(`GraphX: abre ${s.url}`, `GraphX: open ${s.url}`)) }
    else if (d.type === 'pixels') {
      const caps = await capsFor($, 'terminal')
      if (!s.rsvg) $.ui.toast(tr('GraphX: sin rsvg-convert no hay imagen del motor', 'GraphX: the engine image needs rsvg-convert'))
      else if (caps.images === 'none' && (caps.color === '16' || caps.color === 'mono')) $.ui.toast(tr('GraphX: la foto del motor necesita 256 colores o más (o un terminal con imágenes: kitty, Ghostty, WezTerm)', 'GraphX: the engine photo needs 256 colors or more (or a terminal with images: kitty, Ghostty, WezTerm)'))
      else await update($, viewA, v => (v === 'image' ? 'cells' : 'image'))
    } else if (d.type === 'step') {
      const at = num(d.at) ?? -1
      /* el recorrido de Claude o el propio del diagrama */
      const n = (await read($, boardA))?.guide.steps.length || scene?.tour?.steps.length || 0
      await publish($, b => (b ? { ...b, guide: { ...b.guide, at: n ? Math.min(at, n - 1) : -1, seq: b.guide.seq + 1 } } : b))
    } else if (d.type === 'reveal' && str(d.id)) {
      await publish($, b => (b ? { ...b, view: { seq: b.view.seq + 1, select: str(d.id) } } : b))
    }
    return {}
  })

  /* ---- el panel ---- */
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Link } = $.ui.resolve(e)
    await read($, seqA)
    const b = await read($, boardA)
    const srv = await read($, serverA)
    const r = await read($, renderA)
    const detail = await read($, detailA)
    const pref = await read($, viewA)
    const sc = scene ?? (b ? await loadScene($) : null)
    const cols = Math.max(20, e.props.bodyColumns)
    const rows = Math.max(8, e.props.scroll.bodyRows)
    const caps = await capsFor($, e.surface, e.viewport?.isFullscreen)
    if (!b || !sc) {
      return (
        <Box flexDirection="column" gap={1}>
          <Text bold>GraphX</Text>
          <Text dimColor>{tr('Pide a Claude un diagrama (arquitectura, un flujo en Mermaid, el árbol de un repo…), prueba una demo (/graphx-mod demo) o recupera el último de otra sesión (/graphx-mod last).', 'Ask Claude for a diagram (architecture, a Mermaid flow, a repo tree…), try a demo (/graphx-mod demo) or bring back the last one from another session (/graphx-mod last).')}</Text>
          {srv && <Link href={srv.url} label={tr('Abrir en el navegador', 'Open in the browser')} />}
        </Box>
      )
    }
    /* «Celdas» solo donde hay Client (terminal y escritorio): el editor y el móvil siempre ven el SVG */
    let svgView = e.surface === 'vscode' || e.surface === 'mobile' || (e.surface === 'desktop' && pref !== 'cells')
    /* el SVG que no cabe (más de 131 072 caracteres): en el escritorio, el lienzo de caracteres */
    if (svgView && e.surface === 'desktop') { const k0 = `${sceneSeq}:${caps.theme}`; const c0 = svgCache.get(k0); if (c0 && !c0.fits) svgView = false }
    if (svgView) {
      /* escritorio, editor y móvil: el SVG del motor, con sus animaciones, y controles */
      const theme = caps.theme
      const key = `${sceneSeq}:${theme}`
      if (!svgCache.has(key) && srv) {
        try { const res = await call($, srv, `/svg?theme=${theme}`); svgCache.set(key, res.ok ? (JSON.parse(res.text) as { svg: string; fits: boolean; w: number; h: number }) : null) } catch { svgCache.set(key, null) }
      }
      const svg = svgCache.get(key)
      const { Svg, Markdown } = $.ui.resolve(e) as unknown as Elements['desktop']
      const go = async (to: number | 'stop') => { await publish($, x => { if (!x) return x; const n = x.guide.steps.length || sc.tour?.steps.length || 0; const at = to === 'stop' ? -1 : Math.min(Math.max(0, to), n - 1); return { ...x, guide: { ...x.guide, at, seq: x.guide.seq + 1 } } }) }
      const steps = b.guide.steps.length ? b.guide.steps : sc.tour?.steps ?? []
      const at = sc.step?.at ?? -1
      const sel = detail
      return (
        <Box flexDirection="column" gap={1}>
          <Text wrap="truncate-end"><Text bold>{sc.title || 'GraphX'}</Text><Text dimColor>{`  ${sc.diagram?.replace('mermaid:', '') ?? ''} · ${r?.nodeCount ?? (sc.nodes ?? []).length} ${tr('piezas', 'nodes')}`}</Text></Text>
          {sc.banner ? <Text color={sc.banner.tone === 'danger' ? 'red' : sc.banner.tone === 'warn' ? 'yellow' : 'cyan'}>{`${sc.banner.title ? sc.banner.title + ': ' : ''}${sc.banner.text}`}</Text> : null}
          {svg && svg.fits ? <Svg source={svg.svg} alt={`${tr('Diagrama', 'Diagram')} ${sc.title ?? ''}`} isInteractive /> : <Text dimColor>{svg ? tr('El diagrama es demasiado grande para dibujarlo aquí como SVG: se ve como caracteres (Celdas) o en el navegador.', 'The diagram is too big to draw here as SVG: view it as characters (Cells) or in the browser.') : tr('Preparando el dibujo…', 'Preparing the drawing…')}</Text>}
          <Box flexDirection="row" gap={1}>
            {steps.length > 0 && <Button key="prev" label="◀" onPress={() => go(Math.max(0, at - 1))} />}
            {steps.length > 0 && <Button key="next" label={at < 0 ? tr('▶ Recorrido', '▶ Tour') : '▶'} variant="primary" onPress={() => go(at + 1)} />}
            {at >= 0 && <Button key="stop" label="■" onPress={() => go('stop')} />}
            <Button key="less" label={tr('Nivel −', 'Level −')} onPress={async () => { if (srv) await fetchScene($, srv, { depth: Math.max(0, (sc.depth ?? 1) - 1) }) }} />
            <Button key="more" label={tr('Nivel +', 'Level +')} onPress={async () => { if (srv) await fetchScene($, srv, { depth: (sc.depth ?? 1) + 1 }) }} />
            <Button key="dir" label={sc.dir === 'down' ? '↦' : '↧'} onPress={async () => { if (srv) await fetchScene($, srv, { dir: sc.dir === 'down' ? 'right' : 'down' }) }} />
            {(sc.flows ?? []).map(f => <Button key={`flow-${f.i}`} label={`⇄ ${clip(f.t, 18)}`} onPress={async () => { if (srv) await fetchScene($, srv, { view: sc.view === 'flow:' + f.i ? 'graph' : 'flow:' + f.i }) }} />)}
            <Button key="cells" label={tr('Celdas', 'Cells')} onPress={() => update($, viewA, () => 'cells')} />
            {srv && <Button key="web" label={tr('Navegador', 'Browser')} onPress={() => openBrowser($, srv.url)} />}
          </Box>
          {sel || sc.timeline ? (
            <Box flexDirection="row" gap={1}>
              {sel && !sel.edge ? <Button key="blast" label={tr('✺ Impacto', '✺ Blast radius')} onPress={() => publish($, x => (x ? { ...x, view: { seq: x.view.seq + 1, blast: sel.i, select: sel.i } } : x))} /> : null}
              {sel && !sel.edge ? <Button key="up" label={tr('⟵ Depende de', '⟵ Depends on')} onPress={() => publish($, x => (x ? { ...x, view: { seq: x.view.seq + 1, trace: { id: sel.i, dir: 'up' } } } : x))} /> : null}
              {sel && !sel.edge ? <Button key="down" label={tr('Dependientes ⟶', 'Dependents ⟶')} onPress={() => publish($, x => (x ? { ...x, view: { seq: x.view.seq + 1, trace: { id: sel.i, dir: 'down' } } } : x))} /> : null}
              {sel ? <Button key="clear" label={tr('Limpiar', 'Clear')} onPress={() => publish($, x => (x ? { ...x, view: { seq: x.view.seq + 1, reset: true } } : x))} /> : null}
              {sc.timeline ? (() => {
                const { Select } = $.ui.resolve(e) as unknown as Elements['desktop']
                return <Select key="time" label={sc.timeline.l ?? tr('Línea de tiempo', 'Timeline')} options={sc.timeline.labels.map((l, i) => ({ value: String(i), label: `${l}${sc.timeline!.events.find(ev => ev.i === i) ? ' · ' + sc.timeline!.events.find(ev => ev.i === i)!.l : ''}` }))} onSelect={(v: string) => publish($, x => (x ? { ...x, view: { seq: x.view.seq + 1, timeline: Number(v) } } : x))} />
              })() : null}
            </Box>
          ) : null}
          {at >= 0 && steps[at] ? <Markdown text={`**${at + 1}/${steps.length} · ${(steps[at] as { title?: string; t?: string }).title ?? (steps[at] as { t?: string }).t ?? ''}**\n\n${(steps[at] as { body?: string }).body ?? sc.step?.b ?? ''}`} /> : null}
          {e.surface !== 'mobile' && (sc.nodes ?? []).length > 0 ? (() => {
            const { Select } = $.ui.resolve(e) as unknown as Elements['desktop']
            const opts = (sc.nodes ?? []).filter(n => !n.ln).slice(0, 200).map(n => ({ value: n.i, label: `${n.g ? '▾ ' : ''}${n.l}` }))
            return <Select key="node" label={tr('Pieza', 'Node')} options={opts} value={sel?.i} onSelect={async (id: string) => { if (!srv) return; try { const r2 = await call($, srv, `/detail?id=${encodeURIComponent(id)}`); if (r2.ok) await update($, detailA, () => JSON.parse(r2.text) as Detail) } catch { /* sin detalle */ } }} />
          })() : null}
          {sel ? <Markdown text={detailMarkdown(sel)} /> : null}
        </Box>
      )
    }
    if (e.surface === 'terminal' && pref === 'image' && caps.images === 'none' && srv?.rsvg && (caps.color === 'truecolor' || caps.color === '256')) {
      /* sin protocolo de imágenes: la foto del motor en medios bloques (dos píxeles por celda) */
      const { Raster } = $.ui.resolve(e)
      const key = `${sceneSeq}:${caps.theme}:${cols}x${rows - 2}`
      if (!rasterCache.has(key)) {
        try { const res = await call($, srv, `/raster?theme=${caps.theme}&cols=${cols}&rows=${rows - 2}`); rasterCache.set(key, res.ok ? (JSON.parse(res.text) as { cells: string; cols: number; rows: number }) : null) } catch { rasterCache.set(key, null) }
      }
      const ras = rasterCache.get(key)
      return (
        <Box flexDirection="column">
          <Text wrap="truncate-end"><Text bold>{sc.title || 'GraphX'}</Text><Text dimColor>{tr('  foto del motor (medios bloques)', '  engine photo (half blocks)')}</Text></Text>
          {ras ? <Raster key="photo" columns={ras.cols} rows={ras.rows} cells={ras.cells} /> : <Text dimColor>{tr('No se ha podido sacar la foto.', 'Could not take the photo.')}</Text>}
          <Box flexDirection="row" gap={1}>
            <Button key="cells" label={tr('Caracteres', 'Characters')} hotkey="c" onPress={() => update($, viewA, () => 'cells')} />
            <Button key="web" label={tr('Navegador', 'Browser')} hotkey="w" onPress={() => openBrowser($, srv.url)} />
          </Box>
        </Box>
      )
    }
    if (e.surface === 'terminal' && pref === 'image' && caps.images !== 'none' && srv?.rsvg) {
      /* el terminal con gráficos: el PNG del motor */
      const { Image } = $.ui.resolve(e)
      const width = Math.min(2400, cols * 10)
      const key = `${sceneSeq}:${caps.theme}:${width}`
      if (!pngCache.has(key)) {
        try { const res = await call($, srv, caps.imageSource === 'bytes' ? `/png.b64?theme=${caps.theme}&width=${width}` : `/png?theme=${caps.theme}&width=${width}`); pngCache.set(key, res.ok ? (JSON.parse(res.text) as { file: string | null; b64?: string; w: number; h: number }) : null) } catch { pngCache.set(key, null) }
      }
      const png = pngCache.get(key)
      const tall = png ? Math.max(4, Math.min(rows - 3, Math.round((cols * png.h) / png.w / 2))) : 4
      return (
        <Box flexDirection="column">
          <Text wrap="truncate-end"><Text bold>{sc.title || 'GraphX'}</Text><Text dimColor>{tr('  imagen del motor', '  engine image')}</Text></Text>
          {png ? <Image key="png" source={caps.imageSource === 'file' && png.file ? { file: png.file, format: 'png' } : { png: png.b64 ?? '' }} columns={cols} rows={tall} alt={tr(`Diagrama ${sc.title ?? ''} (sin imagen en este terminal)`, `Diagram ${sc.title ?? ''} (no images in this terminal)`)} /> : <Text dimColor>{tr('No se ha podido generar la imagen.', 'Could not generate the image.')}</Text>}
          <Box flexDirection="row" gap={1}>
            <Button key="cells" label={tr('Caracteres', 'Characters')} hotkey="c" onPress={() => update($, viewA, () => 'cells')} />
            <Button key="web" label={tr('Navegador', 'Browser')} hotkey="w" onPress={() => openBrowser($, srv.url)} />
          </Box>
        </Box>
      )
    }
    if (e.surface === 'terminal' || e.surface === 'desktop') {
      const { Client } = $.ui.resolve(e)
      /* con el panel enfocado (ctrl+x tab, un clic, /graphx-mod), la barra de atajos: sin ratón también se maneja todo */
      const bar = e.props.isFocused && e.surface === 'terminal'
      const keys = KEYS()
      const barRows = bar ? Math.max(1, Math.ceil(keys.reduce((a, k) => a + k.l.length + 4, 0) / Math.max(20, cols))) : 0
      const cmd = await read($, cmdA)
      const presentN = await read($, presentA)
      const canvasRows = Math.max(6, rows - barRows)
      const props = fitProps({ scene: sc, caps, detail, height: canvasRows, width: cols, pane: e.surface === 'desktop' ? 'desktop' : e.props.placement, serverUrl: srv?.url, cmd, present: presentN })
      const press = (k: string) => update($, cmdA, c => ({ n: (c?.n ?? 0) + 1, a: k }))
      return (
        <Box flexDirection="column">
          <Client key="canvas" module="./canvas.tsx" props={props} height={canvasRows} width="100%" />
          {bar ? (
            <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
              {keys.map(k => <Button key={`k-${k.k}`} label={k.l} hotkey={k.k} plain dimColor={k.k !== 'r' && k.k !== 'n' && k.k !== 'b'} onPress={() => press(k.k)} />)}
            </Box>
          ) : null}
        </Box>
      )
    }
    return <Text>{`${sc.title || 'GraphX'}${srv ? ` · ${srv.url}` : ''}`}</Text>
  })

  /* ---- las llamadas a las herramientas en el transcript: una fila corta en vez del JSON de la entrada ---- */
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (!String(e.props.tool).startsWith('mcp__graphx-mod__')) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const verb = String(e.props.tool).slice('mcp__graphx-mod__'.length)
    const inp = isObj(e.props.input) ? e.props.input : {}
    const what = (() => {
      if (verb === 'show') {
        if (typeof inp.mermaid === 'string') { const kind = /^\s*(?:%%.*\n|---[\s\S]*?---\s*\n)*\s*([\w-]+)/.exec(inp.mermaid)?.[1] ?? 'mermaid'; return tr(`dibuja un ${kind} de Mermaid (${inp.mermaid.split('\n').length} líneas)`, `draws a Mermaid ${kind} (${inp.mermaid.split('\n').length} lines)`) }
        if (isObj(inp.spec)) { const t = str(inp.title) ?? str(inp.spec.title), nn = Array.isArray(inp.spec.nodes) ? inp.spec.nodes.length : 0; return tr(`dibuja «${t ?? 'diagrama'}» (${nn} piezas)`, `draws “${t ?? 'diagram'}” (${nn} nodes)`) }
        if (Array.isArray(inp.paths)) return tr(`dibuja el árbol de ${inp.paths.length} ficheros`, `draws a tree of ${inp.paths.length} files`)
        if (typeof inp.file === 'string') return tr(`dibuja ${inp.file}`, `draws ${inp.file}`)
        return tr('dibuja un árbol', 'draws a tree')
      }
      if (verb === 'patch') return tr(`cambia el diagrama${isObj(inp.add) ? ' (añade)' : ''}${Array.isArray(inp.remove) ? ' (quita)' : ''}${Array.isArray(inp.update) ? ' (actualiza)' : ''}`, `changes the diagram${isObj(inp.add) ? ' (adds)' : ''}${Array.isArray(inp.remove) ? ' (removes)' : ''}${Array.isArray(inp.update) ? ' (updates)' : ''}`)
      if (verb === 'data') { const ne = Object.keys(isObj(inp.nodes) ? inp.nodes : {}).length + Object.keys(isObj(inp.edges) ? inp.edges : {}).length; return tr(`datos en vivo en ${ne} elementos`, `live data on ${ne} items`) }
      if (verb === 'signs') { const np = Array.isArray(inp.put) ? inp.put.length : 0; return tr(`${np} cartel(es)${inp.banner ? ' y banner' : ''}`, `${np} sign(s)${inp.banner ? ' and banner' : ''}`) }
      if (verb === 'guide') return Array.isArray(inp.steps) ? tr(`recorrido de ${inp.steps.length} pasos`, `${inp.steps.length}-step tour`) : inp.go !== undefined ? tr(`recorrido: ${String(inp.go)}`, `tour: ${String(inp.go)}`) : str(inp.blast) ? tr(`impacto de ${str(inp.blast)}`, `blast radius of ${str(inp.blast)}`) : tr('mueve la vista', 'moves the view')
      if (verb === 'view') return inp.text === true ? tr('mira el diagrama (y el panel del terminal)', 'looks at the diagram (and the terminal panel)') : tr('mira el diagrama', 'looks at the diagram')
      if (verb === 'convert') return typeof inp.mermaid === 'string' ? tr('convierte Mermaid → GraphX', 'converts Mermaid → GraphX') : tr('expresa GraphX → Mermaid', 'writes GraphX → Mermaid')
      if (verb === 'export') return tr('exporta a Mermaid', 'exports to Mermaid')
      return verb === 'capabilities' ? tr('capacidades', 'capabilities') : tr('referencia del formato', 'format reference')
    })()
    const out = typeof e.props.output === 'string' ? e.props.output : Array.isArray(e.props.output) ? e.props.output.map(o => (isObj(o) && typeof o.text === 'string' ? o.text : '')).join('\n') : isObj(e.props.output) && typeof e.props.output.result === 'string' ? e.props.output.result : ''
    const line = out.split('\n').find(l => /^(Pintado|ERROR|Recorrido|Carteles|Datos en vivo|Mermaid|No hay|Pasa)/.test(l)) ?? ''
    return (
      <Box flexDirection="column">
        <Text wrap="truncate-end"><Text color={e.props.isErrored ? 'red' : 'cyan'} bold>{'◆ GraphX'}</Text><Text>{` · ${what}`}</Text>{e.props.isRunning ? <Text dimColor>{' …'}</Text> : null}</Text>
        {line ? <Text dimColor wrap="truncate-end">{`  ⎿ ${clip(line, 160)}`}</Text> : null}
      </Box>
    )
  })

  /* ---- prueba de imagen: ¿el terminal entiende el protocolo gráfico de kitty? ---- */
  on('ui.render', { component: 'Pane', requestId: 'graphx-imgtest' }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    if (e.surface !== 'terminal') return <Text>{tr('Esta prueba es para el terminal.', 'This test is for the terminal.')}</Text>
    const { Image } = $.ui.resolve(e)
    const file = `${$.plugin.root}/assets/imgtest.png`
    let png = ''
    try { png = (await $.fs.read(file, { as: 'bytes' })).base64 ?? '' } catch { /* solo la prueba por ruta */ }
    const caps = await capsFor($, 'terminal')
    const w = Math.max(10, Math.min(48, e.props.bodyColumns - 4))
    return (
      <Box flexDirection="column" gap={1}>
        <Text>{`${caps.term || 'terminal'} · ${tr('imágenes', 'images')}: ${caps.images}`}</Text>
        {png ? <Image key="bytes" source={{ png }} columns={w} rows={Math.round(w / 4)} alt={tr('✗ no se ve la imagen (bytes)', '✗ the image does not show (bytes)')} /> : null}
        <Image key="file" source={{ file, format: 'png' }} columns={w} rows={Math.round(w / 4)} alt={tr('✗ no se ve la imagen (fichero)', '✗ the image does not show (file)')} />
      </Box>
    )
  })

  /* ---- los bloques ```mermaid de las respuestas, dibujados con GraphX ---- */
  /* la respuesta llega antes de pintarse: es el momento de arrancar el motor y preparar sus bloques ```mermaid */
  on('session.append', { door: 'response' }, async ($, e, next) => {
    const r = await next(e)
    if (!inlineOn) return r
    const content = (e.message as { content?: unknown }).content
    const textOf = Array.isArray(content) ? content.map(c => (isObj(c) && c.type === 'text' && typeof c.text === 'string' ? c.text : '')).join('\n') : typeof content === 'string' ? content : ''
    if (!/```mermaid\s*\n/.test(textOf)) return r
    const blocks = splitMermaid(textOf).filter(p => p.mermaid).map(p => p.text)
    $.clock.after(1, () => {
      void (async () => {
        const srv = await ensureServer($).catch(() => null)
        if (!srv?.engine) return
        const caps = await capsFor($, 'terminal')
        for (const b of blocks) await inlineRender($, srv, b, caps.theme)
        $.ui.invalidate('ui.render')
      })()
    })
    return r
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (!inlineOn || !/```mermaid\s*\n/.test(e.props.text)) return next(e)
    const parts = splitMermaid(e.props.text)
    if (!parts.some(p => p.mermaid)) return next(e)
    const srv = await read($, serverA)
    if (!srv || !srv.engine) return next(e)
    const { Box, Markdown, Text } = $.ui.resolve(e)
    const caps = await capsFor($, e.surface, e.viewport?.isFullscreen)
    const cols = Math.max(30, (e.viewport?.columns ?? 100) - 4)
    const out = []
    let k = 0
    for (const p of parts) {
      if (!p.mermaid) { if (p.text.trim()) out.push(<Markdown key={`md${k++}`} text={p.text} />); continue }
      const one = await inlineRender($, srv, p.text, caps.theme)
      if (!one || one.error) { out.push(<Markdown key={`mm${k++}`} text={'```mermaid\n' + p.text + '```'} />); if (one?.error) out.push(<Text key={`er${k++}`} dimColor>{`GraphX: ${one.error}`}</Text>); continue }
      if (e.surface === 'terminal' || e.surface === 'desktop') {
        if (e.surface === 'desktop' && one.svg?.fits) { const { Svg } = $.ui.resolve(e); out.push(<Svg key={`sv${k++}`} source={one.svg.svg} alt={`${tr('Diagrama', 'Diagram')} ${one.scene.title ?? ''}`} isInteractive />) }
        else {
          const { Client } = $.ui.resolve(e)
          const tall = Math.max(10, Math.min(28, inlineHeight(one.scene, cols)))
          out.push(<Client key={`gx${k++}`} module="./canvas.tsx" props={fitProps({ scene: one.scene, caps, detail: null, height: tall, width: cols, pane: 'transcript' })} height={tall} width="100%" />)
        }
      } else if (one.svg?.fits) { const { Svg } = $.ui.resolve(e); out.push(<Svg key={`sv${k++}`} source={one.svg.svg} alt={`${tr('Diagrama', 'Diagram')} ${one.scene.title ?? ''}`} />) }
      else out.push(<Markdown key={`mm${k++}`} text={'```mermaid\n' + p.text + '```'} />)
    }
    return <Box flexDirection="column">{out}</Box>
  })
}

/* ---------- los bloques mermaid en línea ---------- */
function splitMermaid(text: string) {
  const out: { text: string; mermaid: boolean }[] = []
  const re = /```mermaid\s*\n([\s\S]*?)```/g
  let last = 0, m: RegExpExecArray | null
  while ((m = re.exec(text))) { out.push({ text: text.slice(last, m.index), mermaid: false }); out.push({ text: m[1]!, mermaid: true }); last = m.index + m[0].length }
  out.push({ text: text.slice(last), mermaid: false })
  return out
}
const inlineCache = new Map<string, { scene: Scene; svg: { svg: string; fits: boolean } | null; error?: string } | null>()
async function inlineRender($: D, srv: GraphxServer, text: string, theme: string) {
  const key = `${theme}:${getLang()}:${text}`
  if (inlineCache.has(key)) return inlineCache.get(key)!
  try {
    const r = await call($, srv, '/inline', { mermaid: text, theme, lang: getLang() })
    const j = JSON.parse(r.text) as { scene?: Scene; svg?: { svg: string; fits: boolean }; error?: string }
    const v = j.scene ? { scene: j.scene, svg: j.svg ?? null } : { scene: { v: 1, kind: 'error' } as Scene, svg: null, error: j.error ?? tr('no se ha podido dibujar', 'could not draw it') }
    inlineCache.set(key, v)
    if (inlineCache.size > 40) inlineCache.delete(inlineCache.keys().next().value!)
    return v
  } catch { return null }
}
function inlineHeight(s: Scene, cols: number) {
  if (s.kind === 'seq' && s.sq) return Math.min(28, s.sq.rows.length * 2 + 6)
  const lays = s.cells ? [s.cells.right.cards, s.cells.down.cards, s.cells.right.chips, s.cells.down.chips, s.cells.right.mini, s.cells.down.mini] : []
  const fit = lays.find(l => l && l.w <= cols)
  return (fit ? fit.h : 18) + 3
}

function detailMarkdown(d: Detail) {
  const out: string[] = [`### ${d.l ?? d.i}`]
  if (d.path?.length) out.push(`_${d.path.map(p => p.l).join(' › ')}_`)
  if (d.s) out.push(d.s)
  if (d.sm) out.push(d.sm)
  if (d.metrics?.length) out.push(d.metrics.map(m => `- **${m.label}**: ${String(m.value)}`).join('\n'))
  if (d.notes?.length) out.push(d.notes.map(n => `> ${n.tone ? `**${n.tone}** · ` : ''}${n.text}`).join('\n'))
  if (d.ins?.length || d.outs?.length) out.push(`**${tr('Entradas', 'Inputs')}**: ${(d.ins ?? []).map(x => x.l ?? x.i).join(', ') || '—'}  \n**${tr('Salidas', 'Outputs')}**: ${(d.outs ?? []).map(x => x.l ?? x.i).join(', ') || '—'}`)
  if (d.links?.length) out.push(d.links.map(l => (l.u ? `- [${l.l ?? l.u}](${l.u})` : `- ${l.l}`)).join('\n'))
  return out.join('\n\n')
}

async function demos($: D) {
  try { return (await $.fs.list(`${$.plugin.root}/assets/demos`)).map(f => f.name.replace(/\.(mmd|json)$/, '')).sort() } catch { return [] }
}

/* la ayuda del mod (/graphx-mod help); la de la skill está en skills/graphx/SKILL.md (/graphx help) */
const help = () => tr(`GraphX · el mod (graphx-mod): el lienzo, el navegador y las herramientas mcp__graphx-mod__*
  /graphx-mod              el panel con el diagrama (caracteres en el terminal, SVG en el escritorio)
  /graphx-mod open         el navegador, con el motor interactivo
  /graphx-mod present      el diagrama presentado paso a paso (r dentro del panel)
  /graphx-mod image        en kitty, Ghostty o WezTerm: la imagen del motor · /graphx-mod cells vuelve a caracteres
  /graphx-mod caps         lo que se ha detectado del terminal; /graphx-mod caps color=256 glyphs=ascii motion=off theme=light lang=en … lo fuerza (reset)
  /graphx-mod fx <preset>  efectos: calm, vivid, neon, blueprint, glass, present, off
  /graphx-mod demo [tipo]  una demo de cada tipo de diagrama
  /graphx-mod last         el último diagrama, aunque sea de otra sesión
  /graphx-mod export       el diagrama como Mermaid con sus anotaciones
  /graphx-mod clear · stop el lienzo vacío · el servidor parado
  /graphx-mod help         esta ayuda
En el panel: ? enseña todas las teclas; ctrl+x tab le da el teclado (con su barra de atajos) y Esc lo devuelve al prompt.
Para pedir diagramas en lenguaje natural está la skill: /graphx (y /graphx help).`,
`GraphX · the mod (graphx-mod): the canvas, the browser and the mcp__graphx-mod__* tools
  /graphx-mod              the panel with the diagram (characters in the terminal, SVG in the desktop app)
  /graphx-mod open         the browser, with the interactive engine
  /graphx-mod present      the diagram presented step by step (r inside the panel)
  /graphx-mod image        in kitty, Ghostty or WezTerm: the engine image · /graphx-mod cells goes back to characters
  /graphx-mod caps         what was detected about the terminal; /graphx-mod caps color=256 glyphs=ascii motion=off theme=light lang=es … forces it (reset)
  /graphx-mod fx <preset>  effects: calm, vivid, neon, blueprint, glass, present, off
  /graphx-mod demo [type]  a demo of each diagram type
  /graphx-mod last         the last diagram, even from another session
  /graphx-mod export       the diagram as Mermaid with its annotations
  /graphx-mod clear · stop clear the canvas · stop the server
  /graphx-mod help         this help
In the panel: ? shows every key; ctrl+x tab gives it the keyboard (with its shortcut bar) and Esc hands it back to the prompt.
To ask for diagrams in plain language there is the skill: /graphx (and /graphx help).`)
