import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { SCENES, DETAIL } from './fixtures'
import { detectCaps, withOverrides } from '../hooks/term/caps'
import { outlineRows } from '../hooks/term/lists'
// @ts-expect-error: módulo del servidor en JS, sin tipos
import { annotations, toMermaid } from '../server/mermaid-out.mjs'

/* Un servidor de mentira debajo del mod: arrancarlo es un proceso que escribe su línea de listo y sigue vivo;
   «pinta» cada tablero que recibe (con escenas sacadas del motor de verdad, tests/fixtures.ts) y lo cuenta en /inbox. */
type Posted = { rev: number; board: Record<string, any> | null }
function fakeServer(on: On, env: Record<string, string> = { TERM_PROGRAM: 'iTerm.app', COLORTERM: 'truecolor', LANG: 'es_ES.UTF-8' }) {
  const posted: Posted[] = []
  const uiCalls: Record<string, unknown>[] = []
  const spawned: string[][] = []
  const opened: string[] = []
  const filled: string[] = []
  const paths: string[] = []
  let pending: Record<string, unknown>[] = []
  let seq = 0
  mock.env(on, env)
  mock.clock(on, { now: 1_000 })
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('tool.register', (_$, e) => ({ value: { tool: `mcp__graphx__${e.name}` } }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('prompt.fill', (_$, e) => { filled.push(e.text); return { isFilled: true } })
  on('ui.toast', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
  on('config.list', () => ({ value: [] }))
  on('process.spawn', async function* (_$, e) {
    spawned.push([...e.argv])
    yield { stream: 'stdout' as const, text: '{"ready":true,"port":4567,"url":"http://localhost:4567/?t=x","engine":true,"rsvg":true}\n' }
    await new Promise(() => {})
    return { value: { code: 0, signal: null } }
  })
  on('process.run', (_$, e) => { opened.push(e.argv.join(' ')); return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } } })
  const sceneFor = (b: Record<string, any> | null) => {
    const src = b?.source
    const sc = !src ? { v: 1, kind: 'empty' } : src.kind === 'paths' ? SCENES.tree : /sequenceDiagram/.test(src.text ?? '') ? { ...SCENES.seq, tour: null, step: { at: -1, n: 0 } } : /gantt/.test(src.text ?? '') ? SCENES.gantt : SCENES.graph
    /* el paso del recorrido, como lo pondría el motor */
    const at = b?.guide?.at ?? -1
    const tour = (sc as { tour?: { steps: { t: string; b?: string }[] } | null }).tour
    const step = tour && at >= 0 && tour.steps[at] ? { at, n: tour.steps.length, t: tour.steps[at]!.t, b: tour.steps[at]!.b } : (sc as { step?: unknown }).step
    return { ...sc, step, seq }
  }
  on('http.fetch', (_$, e) => {
    const u = new URL(e.url)
    const path = u.pathname
    paths.push(path)
    const res = (status: number, text: string) => ({ value: { status, ok: status < 300, headers: {}, text } })
    const json = (v: unknown) => res(200, JSON.stringify(v))
    const last = () => posted[posted.length - 1]?.board ?? null
    if (path === '/health') return json({ ok: true })
    if (path === '/state') {
      const body = JSON.parse(String(e.init?.body)) as Posted
      posted.push(body); seq++
      const nodes = (SCENES.graph.nodes ?? []).map(n => ({ id: n.i, label: n.l }))
      pending.push({ type: 'rendered', rev: body.rev, ok: true, warnings: [], diagram: 'graphx', nodes, edges: [], lanes: [], nodeCount: nodes.length, edgeCount: 15, steps: body.board?.guide?.steps?.length ?? 0, flows: ['f1'], fx: ['heat', 'particles'] })
      return json({ ok: true, rev: body.rev, viewers: 0, seq })
    }
    if (path === '/scene') return json(sceneFor(last()))
    if (path === '/ui') { uiCalls.push(JSON.parse(String(e.init?.body))); seq++; return json(sceneFor(last())) }
    if (path === '/inbox') { const events = pending; pending = []; return json({ events, viewers: 0, seq }) }
    if (path === '/detail') return json(DETAIL)
    if (path === '/svg') return json({ svg: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>', fits: true, w: 10, h: 10 })
    if (path === '/png' || path === '/png.b64') return json({ file: '/tmp/x.png', b64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', w: 1400, h: 500 })
    if (path === '/raster') { const cols = Number(u.searchParams.get('cols')), rows = 6; return json({ cells: btoa(String.fromCharCode(...new Uint8Array(new Uint32Array(cols * rows * 3).fill(0x2580).buffer))), cols, rows }) }
    if (path === '/inline') return json({ scene: SCENES.graph, svg: { svg: '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>', fits: true } })
    if (path === '/convert') {
      const body = JSON.parse(String(e.init?.body)) as Record<string, unknown>
      if (body.mermaid) return json({ spec: { nodes: [{ id: 'a' }] }, type: 'flowchart', warnings: [], count: { nodes: 1 }, annotations: { nodes: { a: ['heat'] }, edges: {}, root: ['fx'], comments: 1, inline: 1 } })
      return json({ text: 'flowchart LR\n  a --> b\n', type: 'flowchart', lossy: [] })
    }
    if (path === '/export') return json({ text: 'flowchart LR\n  web --> api\n%% @gx { "fx": "vivid" }\n', type: 'flowchart' })
    return res(404, '{}')
  })
  return { posted, uiCalls, spawned, opened, filled, paths, last: () => posted[posted.length - 1] }
}

const start = async ($: Engine) => { await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true }) }
const text = (r: unknown) => { const res = (r as { result?: unknown }).result; return typeof res === 'string' ? res : JSON.stringify(res) }
const PANE = (bodyColumns: number, bodyRows: number, isFocused = true) => ({ plugin: 'graphx', component: 'Pane' as const, requestId: 'graphx', props: { title: 'GraphX', isFocused, bodyColumns, placement: 'dock' as const, scroll: { offset: 0, bodyRows }, view: {} } })

describe('capacidades del terminal', () => {
  test('se deducen del entorno, con su motivo', async () => {
    expect(detectCaps({ NO_COLOR: '1', TERM: 'xterm-256color' }).color).toBe('mono')
    expect(detectCaps({ COLORTERM: 'truecolor', TERM: 'xterm-256color' }).color).toBe('truecolor')
    expect(detectCaps({ TERM: 'xterm-256color' }).color).toBe('256')
    expect(detectCaps({ TERM: 'xterm' }).color).toBe('16')
    expect(detectCaps({ TERM: 'linux' }).glyphs).toBe('basic')
    expect(detectCaps({ TERM: 'dumb' })).toMatchObject({ color: 'mono', glyphs: 'ascii', braille: false })
    expect(detectCaps({ TERM_PROGRAM: 'ghostty', TERM: 'xterm-ghostty' }).images).toBe('kitty')
    expect(detectCaps({ TERM_PROGRAM: 'ghostty', TMUX: '/tmp/t', TERM: 'tmux-256color' })).toMatchObject({ images: 'none', mux: 'tmux' })
    expect(detectCaps({ KITTY_WINDOW_ID: '1', SSH_CONNECTION: 'a b c d', TERM: 'xterm-kitty' })).toMatchObject({ images: 'kitty', imageSource: 'bytes', fps: 4, remote: true })
    expect(detectCaps({ TERM: 'xterm-256color', COLORTERM: 'truecolor' }, { claudeTheme: 'dark-ansi' }).color).toBe('16')
    expect(detectCaps({ COLORFGBG: '0;15' }).theme).toBe('light')
    expect(detectCaps({}, { claudeTheme: 'light-daltonized' }).theme).toBe('light')
    expect(detectCaps({}, { fullscreen: true }).pointer).toBe(true)
    expect(detectCaps({ TERM: 'xterm' }).why.length).toBeGreaterThan(2)
    expect(withOverrides(detectCaps({ COLORTERM: 'truecolor' }), { glyphs: 'ascii', motion: 'off' })).toMatchObject({ glyphs: 'ascii', braille: false, motion: 'off' })
  })
})

describe('Mermaid de ida y vuelta', () => {
  test('recoge las anotaciones de GraphX por pieza, arista y raíz', async () => {
    const a = annotations('flowchart LR\n  web e1@--> api\n  api@{ shape: hex, heat: 85, owner: pagos }\n  e1@{ rate: 900 }\n  %% @gx { "fx": "vivid", "owners": {} }\n  %% @gx api { "blocks": [] }')
    expect(a.nodes.api).toEqual(['heat', 'owner', 'blocks'])
    expect(a.edges.e1).toEqual(['rate'])
    expect(a.root).toEqual(['fx', 'owners'])
    expect(a.comments).toBe(2)
  })
  test('expresa un JSON de GraphX como Mermaid con sus datos', async () => {
    const r = toMermaid({ title: 'Pagos', lanes: [{ id: 'b', label: 'Borde' }], nodes: [{ id: 'api-gw', label: 'API', lane: 'b', heat: 120, spark: [1, 2, 3], blocks: [{ type: 'text', text: 'x' }] }, { id: 'k', label: 'KPI', shape: 'kpi', value: 3 }], edges: [{ id: 'e1', from: 'api-gw', to: 'k', rate: 300, kind: 'event' }], fx: 'neon' })
    expect(r.type).toBe('flowchart')
    expect(r.text).toContain('api_gw@{ label: "API", heat: 120, spark: "1 2 3" }')
    expect(r.text).toContain('subgraph lane_b ["Borde"]')
    expect(r.text).toContain('api_gw e1@-.-> k')
    expect(r.text).toContain('e1@{ rate: 300, kind: "event" }')
    expect(r.text).toContain('%% @gx k {"shape":"kpi"')
    expect(r.text).toContain('%% @gx {"fx":"neon"}')
    const sq = toMermaid({ graphTab: false, nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B', shape: 'datastore' }], flows: [{ id: 'f', participants: ['a', 'b'], messages: [{ from: 'a', to: 'b', label: 'hola', kind: 'sync' }, { from: 'b', to: 'a', label: 'ok', kind: 'return' }] }] })
    expect(sq.type).toBe('sequenceDiagram')
    expect(sq.text).toContain('a->>b: hola')
    expect(sq.text).toContain('b-->>a: ok')
  })
})

describe('el esquema', () => {
  test('sigue las flechas y saca las calles de sus piezas cuando la escena no las lista', async () => {
    const n = (i: string, x: number, y: number, extra: Record<string, unknown> = {}) => ({ i, l: i, x, y, w: 10, h: 10, d: 0, ...extra })
    const scene = {
      mode: 'graph', dir: 'right',
      nodes: [n('hoja', 0, 0), n('raiz', 50, 50), n('rama', 20, 90)],
      edges: [{ i: 'e1', a: 'raiz', b: 'rama', p: [] }, { i: 'e2', a: 'rama', b: 'hoja', p: [] }]
    } as any
    expect(outlineRows(scene, null).map(r => r.id)).toEqual(['raiz', 'rama', 'hoja'])
    const git = {
      mode: 'git', dir: 'right', lanes: [],
      nodes: [n('branch:main', 0, 0, { g: 1, ln: 1, o: 1, k: 2 }), n('c2', 40, 0, { p: 'branch:main', la: 'branch:main' }), n('c1', 10, 0, { p: 'branch:main', la: 'branch:main' })],
      edges: []
    } as any
    const rows = outlineRows(git, null)
    expect(rows.map(r => r.id)).toEqual(['§branch:main', 'c1', 'c2'])
    expect(rows[0]!.lane).toBe('branch:main')
  })
})

describe('herramientas', () => {
  test('reference y capabilities explican el formato y el terminal', async ($, on) => {
    fakeServer(on, { TERM_PROGRAM: 'ghostty', TERM: 'xterm-ghostty', LANG: 'es_ES.UTF-8' })
    await start($)
    expect(text(await $.tool.call({ tool: 'mcp__graphx__reference' } as never))).toContain('%% @gx')
    const caps = text(await $.tool.call({ tool: 'mcp__graphx__capabilities' } as never))
    expect(caps).toContain('sequenceDiagram')
    expect(caps).toContain('imágenes kitty')
    expect(caps).toContain('blast')
  })

  test('show publica el tablero, arranca el servidor una vez y devuelve lo pintado', async ($, on) => {
    const srv = fakeServer(on)
    await start($)
    const r = await $.tool.call({ tool: 'mcp__graphx__show', mermaid: 'flowchart LR\n web --> api', title: 'Tienda', fx: 'neon' } as never)
    expect(srv.spawned.length).toBe(1)
    expect(srv.spawned[0]?.[1]).toMatch(/server\/live\.mjs$/)
    expect(srv.last()?.board).toMatchObject({ source: { kind: 'mermaid', text: 'flowchart LR\n web --> api' }, title: 'Tienda', fx: 'neon' })
    expect(text(r)).toContain('Pintado')
    expect(text(r)).toContain('efectos: heat particles')
    expect(text(r)).toContain('gateway «API Gateway»')
    await $.tool.call({ tool: 'mcp__graphx__patch', add: { nodes: [{ id: 'cache', label: 'Caché' }] } } as never)
    expect(srv.spawned.length).toBe(1)
    expect(srv.last()?.board?.patches).toEqual([{ add: { nodes: [{ id: 'cache', label: 'Caché' }] } }])
    expect(text(await $.tool.call({ tool: 'mcp__graphx__show', mermaid: 'graph TD; a-->b', spec: { nodes: [] } } as never))).toContain('exactamente una fuente')
  })

  test('data acumula los datos en vivo y replace empieza de cero', async ($, on) => {
    const srv = fakeServer(on)
    await start($)
    await $.tool.call({ tool: 'mcp__graphx__show', spec: { nodes: [{ id: 'api', label: 'API' }] } } as never)
    await $.tool.call({ tool: 'mcp__graphx__data', nodes: { api: { heat: 300 } }, edges: { e1: { rate: 90 } } } as never)
    await $.tool.call({ tool: 'mcp__graphx__data', nodes: { api: { alert: 'crit' } } } as never)
    expect(srv.last()?.board?.data).toEqual({ nodes: { api: { heat: 300, alert: 'crit' } }, edges: { e1: { rate: 90 } } })
    const r = await $.tool.call({ tool: 'mcp__graphx__data', replace: true, nodes: { db: { progress: 0.5 } } } as never)
    expect(srv.last()?.board?.data).toEqual({ nodes: { db: { progress: 0.5 } }, edges: {} })
    expect(text(r)).toContain('Datos en vivo: 1 pieza')
  })

  test('guide mueve el recorrido y la vista: flujos, impacto, equipos y línea de tiempo', async ($, on) => {
    const srv = fakeServer(on)
    await start($)
    await $.tool.call({ tool: 'mcp__graphx__show', spec: { nodes: [{ id: 'web' }, { id: 'api' }] } } as never)
    await $.tool.call({ tool: 'mcp__graphx__guide', steps: [{ title: 'Entra', nodes: ['web'] }, { title: 'Sale', nodes: ['api'], signs: [{ at: 'api', text: 'Aquí falla' }] }], go: 2 } as never)
    expect(srv.last()?.board?.guide).toMatchObject({ at: 1 })
    expect((srv.last()?.board?.signs as { step?: number }[])[0]?.step).toBe(1)
    await $.tool.call({ tool: 'mcp__graphx__guide', flow: 'f1', blast: 'api', owners: ['pagos'], timeline: '13:00' } as never)
    expect(srv.last()?.board?.view).toMatchObject({ flow: 'f1', blast: 'api', owners: ['pagos'], timeline: '13:00' })
  })

  test('signs añade, sustituye y quita carteles', async ($, on) => {
    const srv = fakeServer(on)
    await start($)
    await $.tool.call({ tool: 'mcp__graphx__show', spec: { nodes: [{ id: 'web' }] } } as never)
    const r = await $.tool.call({ tool: 'mcp__graphx__signs', put: [{ at: 'nope', text: 'Ancla rota' }, { text: 'Suelto', tone: 'bogus' }], banner: { text: 'Hola' } } as never)
    expect((srv.last()?.board?.signs as { id: string; tone: string }[]).map(s => s.id)).toEqual(['c1', 'c2'])
    expect(text(r)).toContain('c1→nope')
  })

  test('convert recoge las anotaciones de Mermaid y export escribe Mermaid', async ($, on) => {
    fakeServer(on)
    await start($)
    const c = text(await $.tool.call({ tool: 'mcp__graphx__convert', mermaid: 'flowchart LR\n a@{ heat: 3 }\n%% @gx { "fx": "vivid" }' } as never))
    expect(c).toContain('1 en @{…}, 1 comentarios %% @gx')
    expect(c).toContain('pieza a: heat')
    expect(text(await $.tool.call({ tool: 'mcp__graphx__convert', spec: { nodes: [{ id: 'a' }] } } as never))).toContain('```mermaid')
    await $.tool.call({ tool: 'mcp__graphx__show', spec: { nodes: [{ id: 'web' }] } } as never)
    expect(text(await $.tool.call({ tool: 'mcp__graphx__export' } as never))).toContain('%% @gx')
  })

  test('view enseña la captura del motor y el panel del terminal en texto', async ($, on) => {
    fakeServer(on)
    await start($)
    await $.tool.call({ tool: 'mcp__graphx__show', spec: { nodes: [{ id: 'web' }] } } as never)
    const r = await $.tool.call({ tool: 'mcp__graphx__view', text: true, cols: 110, rows: 30 } as never)
    expect(Array.isArray((r as { result?: unknown }).result)).toBe(true)
    expect(text(r)).toContain('"type":"image"')
    expect(text(r)).toContain('Checkout')
  })
})

describe('el panel', () => {
  test('en el terminal es el lienzo y en el escritorio el SVG del motor', async ($, on) => {
    fakeServer(on)
    await start($)
    await $.tool.call({ tool: 'mcp__graphx__show', spec: { nodes: [{ id: 'web' }] } } as never)
    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ ...PANE(120, 36), surface })
      await ui.advance(2000)
      if (surface === 'terminal') expect(await ui.find({ type: 'Text', text: /Checkout de la tienda/, in: 'canvas' })).toBeDefined()
      else { expect(await ui.find({ type: 'Svg' })).toBeDefined(); await ui.press({ key: 'cells' }) }
      await ui.unmount()
    }
    const ui = await $.ui.mount({ ...PANE(80, 30), surface: 'mobile' })
    expect(await ui.find({ type: 'Svg' })).toBeDefined()
    await ui.unmount()
  })

  test('a cada tamaño su vista: esquema en lo estrecho, panel lateral en lo ancho', async ($, on) => {
    fakeServer(on)
    await start($)
    await $.tool.call({ tool: 'mcp__graphx__show', spec: { nodes: [{ id: 'web' }] } } as never)
    for (const [w, h] of [[30, 10], [56, 20], [100, 30], [170, 44]] as const) {
      const ui = await $.ui.mount({ ...PANE(w, h), surface: 'terminal' })
      await ui.advance(2000)
      const drawn = JSON.stringify(await ui.drawn({ in: 'canvas' }))
      expect(drawn.length).toBeLessThan(100000)
      if (w <= 56) { expect(drawn).toContain('CLIENTES'); expect(drawn).not.toContain('┆') }
      if (w >= 170) expect(drawn).toContain('LATENCIA P95')
      await ui.unmount()
    }
  })

  test('con 16 colores, sin color y en ASCII sigue dibujando', async ($, on) => {
    fakeServer(on, { TERM: 'xterm' })
    await start($)
    await $.tool.call({ tool: 'mcp__graphx__show', spec: { nodes: [{ id: 'web' }] } } as never)
    for (const caps of ['color=16', 'color=mono glyphs=ascii', 'glyphs=basic theme=light']) {
      await $.command.run({ command: 'graphx', args: `caps ${caps}`, presentation: { isFullscreen: true, columns: 120 } } as never)
      const ui = await $.ui.mount({ ...PANE(120, 36), surface: 'terminal' })
      await ui.advance(2000)
      expect(await ui.find({ type: 'Text', text: /Checkout/, in: 'canvas' })).toBeDefined()
      if (caps.includes('ascii')) expect(JSON.stringify(await ui.drawn({ in: 'canvas' }))).not.toMatch(/[╭╮╰╯▶●]/)
      await ui.unmount()
    }
  })

  test('el lienzo responde al teclado: pieza, detalle, impacto, búsqueda, vista y ayuda', async ($, on) => {
    const srv = fakeServer(on)
    await start($)
    await $.tool.call({ tool: 'mcp__graphx__show', spec: { nodes: [{ id: 'web' }] } } as never)
    const ui = await $.ui.mount({ ...PANE(170, 44), surface: 'terminal' })
    await ui.advance(2000)
    await ui.key({ key: 'tab', in: 'canvas' })
    expect(srv.paths).toContain('/detail')
    await ui.key({ key: 'c', in: 'canvas' })
    expect(JSON.stringify(await ui.drawn({ in: 'canvas' }))).toContain('afectadas')
    await ui.key({ key: '/', in: 'canvas' })
    for (const ch of 'pago') await ui.key({ key: ch, in: 'canvas' })
    await ui.key({ key: 'return', in: 'canvas' })
    expect(srv.uiCalls).toContainEqual({ search: 'pago' })
    await ui.key({ key: '2', in: 'canvas' })
    expect(srv.uiCalls).toContainEqual({ depth: 1 })
    await ui.key({ key: 'y', in: 'canvas' })
    await ui.advance(2000)
    await ui.key({ key: '?', in: 'canvas' })
    expect(await ui.find({ type: 'Text', text: /Teclas del lienzo/, in: 'canvas' })).toBeDefined()
    await ui.key({ key: '?', in: 'canvas' })
    await ui.key({ key: 'q', in: 'canvas' })
    expect(srv.filled.join(' ')).toContain('en el diagrama de GraphX')
    await ui.unmount()
  })

  test('presentación: el recorrido paso a paso, automático si el diagrama no trae uno', async ($, on) => {
    fakeServer(on)
    await start($)
    await $.tool.call({ tool: 'mcp__graphx__show', mermaid: 'sequenceDiagram\n a->>b: hola' } as never)
    const ui = await $.ui.mount({ ...PANE(110, 32), surface: 'terminal' })
    await ui.advance(1500)
    await ui.key({ key: 'r', in: 'canvas' })
    await ui.key({ key: 'n', in: 'canvas' })
    await ui.key({ key: 'right', in: 'canvas' })
    const drawn = JSON.stringify(await ui.drawn({ in: 'canvas' }))
    expect(drawn).toContain('3/')
    expect(drawn).toContain('r sale')
    expect(drawn).toContain('GET /login')
    await ui.key({ key: 'R', in: 'canvas' })
    expect(JSON.stringify(await ui.drawn({ in: 'canvas' }))).not.toContain('r sale')
    await ui.unmount()
  })

  test('/graphx present sobre un panel ya abierto y usado entra en la presentación a la primera', async ($, on) => {
    fakeServer(on)
    await start($)
    await $.tool.call({ tool: 'mcp__graphx__show', spec: { nodes: [{ id: 'web' }] } } as never)
    const ui = await $.ui.mount({ ...PANE(110, 32), surface: 'terminal' })
    await ui.advance(1500)
    await ui.key({ key: 's', in: 'canvas' })
    expect(JSON.stringify(await ui.drawn({ in: 'canvas' }))).not.toContain('r sale')
    await $.command.run({ command: 'graphx', args: 'present', presentation: { isFullscreen: true, columns: 120 } } as never)
    await ui.advance(300)
    expect(JSON.stringify(await ui.drawn({ in: 'canvas' }))).toContain('r sale')
    await ui.unmount()
  })

  test('en el árbol, q pregunta por la fila y d no se come las flechas', async ($, on) => {
    const srv = fakeServer(on)
    await start($)
    await $.tool.call({ tool: 'mcp__graphx__show', paths: ['src/app.ts', 'src/lib/a.ts', 'README.md'] } as never)
    const ui = await $.ui.mount({ ...PANE(110, 32), surface: 'terminal' })
    await ui.advance(1500)
    const cursorRow = async () => JSON.stringify(await ui.drawn({ in: 'canvas' })).split('❯')[1]?.slice(0, 80) ?? ''
    const first = await cursorRow()
    await ui.key({ key: 'd', in: 'canvas' })
    await ui.key({ key: 'j', in: 'canvas' })
    expect(await cursorRow()).not.toBe(first)
    await ui.key({ key: 'q', in: 'canvas' })
    expect(srv.filled.length).toBe(1)
    await ui.unmount()
  })

  test('con el panel enfocado, la barra de atajos maneja el lienzo sin ratón', async ($, on) => {
    fakeServer(on)
    await start($)
    await $.tool.call({ tool: 'mcp__graphx__show', spec: { nodes: [{ id: 'web' }] } } as never)
    let ui = await $.ui.mount({ ...PANE(120, 36, false), surface: 'terminal' })
    expect(await ui.find({ type: 'Button', key: 'k-r' })).toBeUndefined()
    await ui.unmount()
    ui = await $.ui.mount({ ...PANE(120, 36, true), surface: 'terminal' })
    await ui.advance(1500)
    expect(await ui.findAll({ type: 'Button' })).toHaveLength(26)
    await ui.press({ key: 'k-r' })
    expect(JSON.stringify(await ui.drawn({ in: 'canvas' }))).toContain('r sale')
    await ui.press({ key: 'k-n' })
    expect(JSON.stringify(await ui.drawn({ in: 'canvas' }))).toMatch(/2\/\d+/)
    await ui.unmount()
  })

  test('en el esquema el cursor recorre piezas, conexiones y carriles', async ($, on) => {
    fakeServer(on)
    await start($)
    await $.tool.call({ tool: 'mcp__graphx__show', spec: { nodes: [{ id: 'web' }] } } as never)
    const ui = await $.ui.mount({ ...PANE(56, 30), surface: 'terminal' })
    await ui.advance(2000)
    const cursorRow = async () => JSON.stringify(await ui.drawn({ in: 'canvas' })).split('❯')[1]?.slice(0, 120) ?? ''
    const seen = new Set<string>()
    for (let i = 0; i < 6; i++) { await ui.key({ key: 'down', in: 'canvas' }); seen.add(await cursorRow()) }
    expect(seen.size).toBeGreaterThan(4)
    await ui.unmount()
  })

  test('las secuencias, los gantt y los árboles se dibujan y se navegan', async ($, on) => {
    fakeServer(on)
    await start($)
    for (const [src, re] of [[{ mermaid: 'sequenceDiagram\n a->>b: hola' }, /Proveedor de identidad/], [{ mermaid: 'gantt\n title x' }, /Prototipo/], [{ paths: ['src/app.ts', 'README.md'] }, /repo/]] as const) {
      await $.tool.call({ tool: 'mcp__graphx__show', ...src } as never)
      const ui = await $.ui.mount({ ...PANE(110, 32), surface: 'terminal' })
      await ui.advance(2000)
      expect(await ui.find({ type: 'Text', text: re, in: 'canvas' })).toBeDefined()
      await ui.key({ key: 'down', in: 'canvas' })
      await ui.key({ key: 'f', in: 'canvas' })
      await ui.advance(1200)
      await ui.unmount()
    }
  })

  test('los bloques mermaid de las respuestas se dibujan con GraphX', async ($, on) => {
    fakeServer(on)
    on('session.append', (_$, e) => ({ message: e.message, uuid: 'u1' }))
    on('ui.invalidate', () => ({ value: undefined }))
    await start($)
    await $.tool.call({ tool: 'mcp__graphx__show', spec: { nodes: [{ id: 'web' }] } } as never)
    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ plugin: 'graphx', surface, component: 'AssistantMessage', requestId: 'm1', props: { text: 'Así queda:\n\n```mermaid\nflowchart LR\n a --> b\n```\n\nY ya.', isFirstOfReply: true } })
      if (surface === 'terminal') expect(await ui.find({ type: 'Client' })).toBeDefined()
      else expect(await ui.find({ type: 'Svg' })).toBeDefined()
      expect(await ui.find({ type: 'Markdown' })).toBeDefined()
      await ui.unmount()
    }
  })

  test('como imagen: kitty donde lo hay, la foto en medios bloques donde no', async ($, on) => {
    fakeServer(on, { TERM_PROGRAM: 'ghostty', TERM: 'xterm-ghostty' })
    await start($)
    await $.tool.call({ tool: 'mcp__graphx__show', spec: { nodes: [{ id: 'web' }] } } as never)
    await $.command.run({ command: 'graphx', args: 'image', presentation: { isFullscreen: true, columns: 120 } } as never)
    let ui = await $.ui.mount({ ...PANE(100, 30), surface: 'terminal' })
    expect(await ui.find({ type: 'Image' })).toBeDefined()
    await ui.unmount()
    await $.command.run({ command: 'graphx', args: 'caps images=none', presentation: { isFullscreen: true, columns: 120 } } as never)
    ui = await $.ui.mount({ ...PANE(100, 30), surface: 'terminal' })
    expect(await ui.find({ type: 'Raster' })).toBeDefined()
    await ui.press({ key: 'cells' })
    expect(await ui.find({ type: 'Client' })).toBeDefined()
    await ui.unmount()
  })

  test('las llamadas a las herramientas se ven como una fila corta', async ($, on) => {
    fakeServer(on)
    await start($)
    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ plugin: 'graphx', surface, component: 'ToolUse', requestId: 't1', props: { tool_use_id: 't1', tool: 'mcp__graphx__show', input: { mermaid: 'flowchart LR\n a --> b' }, isRunning: false, isErrored: false, isInterrupted: false, output: 'GraphX · rev 1\nPintado: 2 piezas' } as never })
      expect(await ui.find({ type: 'Text', text: /dibuja un flowchart de Mermaid/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /Pintado: 2 piezas/ })).toBeDefined()
      await ui.unmount()
    }
  })

  test('/graphx caps enseña lo detectado y lo deja forzar', async ($, on) => {
    fakeServer(on, { TERM: 'xterm-256color', TMUX: '/tmp/x' })
    await start($)
    const r = await $.command.run({ command: 'graphx', args: 'caps', presentation: { isFullscreen: true, columns: 120 } } as never)
    expect(JSON.stringify(r)).toContain('color 256')
    expect(JSON.stringify(r)).toContain('tmux')
    const r2 = await $.command.run({ command: 'graphx', args: 'caps color=mono motion=off', presentation: { isFullscreen: true, columns: 120 } } as never)
    expect(JSON.stringify(r2)).toContain('color mono')
    expect(JSON.stringify(await $.command.run({ command: 'graphx', args: 'caps color=rojo', presentation: { isFullscreen: true, columns: 120 } } as never))).toContain('no entiendo')
  })
})
