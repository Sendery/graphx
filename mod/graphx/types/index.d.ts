/* Contrato del mod graphx: lo que guarda en $.state y los datos que viajan entre el servidor, los hooks y el
 * lienzo del terminal (el módulo Client). Las claves de la escena son cortas porque viaja como props. */

export type GraphxTone = 'info' | 'tip' | 'ok' | 'warn' | 'danger' | 'note'

export type GraphxSource =
  | { kind: 'spec'; spec: Record<string, unknown> }
  | { kind: 'mermaid'; text: string }
  | { kind: 'paths'; entries: unknown[]; options?: Record<string, unknown> }
  | { kind: 'tree-text'; text: string; options?: Record<string, unknown> }

export type GraphxSign = { id: string; at?: string; title?: string; text: string; tone?: GraphxTone; side?: 'auto' | 'top' | 'right' | 'bottom' | 'left'; pin?: string; step?: number }
export type GraphxBanner = { title?: string; text: string; tone?: GraphxTone }
export type GraphxStep = { title: string; body?: string; nodes?: string[]; edges?: string[]; expand?: string[]; depth?: number; select?: string; view?: string }
export type GraphxView = {
  seq: number; present?: boolean; focus?: string[]; prune?: boolean; label?: string; select?: string; trace?: { id: string; dir: 'up' | 'down' }
  depth?: number; direction?: 'right' | 'down'; reset?: boolean; flow?: string | null; owners?: string[]; blast?: string; timeline?: number | string
}
export type GraphxData = { nodes?: Record<string, Record<string, unknown>>; edges?: Record<string, Record<string, unknown>> }
export type GraphxBoard = {
  source: GraphxSource
  patches: Record<string, unknown>[]
  title?: string
  lang?: 'es' | 'en'
  direction?: 'right' | 'down'
  theme?: 'auto' | 'light' | 'dark'
  fx?: string | false | Record<string, unknown> | null
  data?: GraphxData
  signs: GraphxSign[]
  banner: GraphxBanner | null
  guide: { title?: string; steps: GraphxStep[]; at: number; seq: number }
  view: GraphxView
}
export type GraphxServer = { url: string; port: number; token: string; startedAt: number; engine: boolean; rsvg: boolean }
export type GraphxRender = {
  rev: number; ok: boolean; error?: string; warnings: string[]; diagram?: string
  nodes: { id: string; label?: string; parent?: string; kind?: string; depth?: number; shape?: string }[]
  edges: { id: string; from: string; to: string }[]
  lanes: string[]; nodeCount: number; edgeCount: number; steps: number; flows?: string[]; fx?: string[]
}
export type GraphxLive = { viewers: number; step: number; asks: number; lastSeen: number }

/* ---------- la escena ---------- */
export type Dual = string | [string, string]
export type SNode = {
  i: string; l: string; s?: string; x: number; y: number; w: number; h: number; d: number
  g?: 1; ln?: 1; o?: 1; k?: number; p?: string; la?: string; kd?: string; sh?: string; dl?: string
  c?: Dual; f?: Dual; tc?: Dual; st?: string; stc?: Dual; pu?: 1; fr?: string; sm?: string; bl?: number; lk?: number; nt?: string[]; fl?: number
  hv?: number; hr?: 1; sp?: number[]; u?: string; pr?: number; al?: string; ow?: string; v?: number; ch?: number; gd?: string; mn?: number; mx?: number
  th?: number[]; dc?: number; pt?: { l: string; v: number; c?: Dual }[]; sn?: { s?: string; e?: string; m?: boolean; lv?: boolean }; sc?: number; b?: string; av?: string
  rw?: { n: string; t?: string; k?: string; s?: string; vi?: string }[]; hd?: 1
  lt?: 1; se?: 1; dm?: 1; hi?: 1
}
export type SEdge = {
  i: string; a: string; b: string; p: [number, number][]; ids?: string[]; n?: number; k?: string; ds?: 1; dl?: string; an?: 1; he?: 1; mu?: 1; bk?: 1
  r?: number; sp?: string | number; wt?: number; cv?: 1; c?: Dual; hd?: string; tl?: string; hl?: string; tll?: string; l?: string; lx?: number; ly?: number; sm?: string; lt?: 1; dm?: 1
}
export type SLane = { i: string; l: string; s?: string; x: number; y: number; w: number; h: number; dn?: 1; c?: Dual; ow?: string }
export type SDeco = { t: 'r' | 'l' | 't' | 'c'; x?: number; y?: number; w?: number; h?: number; r?: number; p?: [number, number][]; s?: string; a?: string; c?: string; f?: string }
export type SSeq = {
  id: string; t: string; sm?: string
  parts: { i: string; l: string; sh?: string; kd?: string; c?: Dual; box?: string; sm?: string }[]
  rows: { i: string; k: string; a?: string; b?: string; l?: string; t?: string; bl?: string; ov?: string[]; sd?: string; n?: string; hd?: string; tl?: string; ac?: string; de?: string; sm?: string; dt?: string; c?: Dual; ph?: 1 }[]
  boxes: { i: string; l: string; c?: Dual }[]
}
export type SRow = { i: string; l?: string; d: number; rl: number[]; la?: 1; fo?: 1; o?: 1; k?: number; dl?: string; b?: string; c?: string; s?: string; ad?: number; de?: number; fc?: number; cg?: number; sm?: string; mo?: number; pa?: string }
export type STimeline = { l?: string; labels: string[]; frames: { n: Record<string, Record<string, unknown>>; e: Record<string, Record<string, unknown>> }[]; total: number[]; events: { i: number; l: string; tn: string; n: string[] }[]; start: number; step: number }
export type SSign = { i: string; pin: string; tn: string; t?: string; x: string; at: string | null; in: boolean }
export type CellLayout = { density: 'cards' | 'chips' | 'mini'; dir: 'right' | 'down'; w: number; h: number; nodes: Record<string, [number, number, number, number]>; edges: Record<string, { p: [number, number][]; lx?: number; ly?: number }> }
export type Scene = {
  v: 1; seq?: number; rev?: number; mountRev?: number; kind: 'graph' | 'seq' | 'tree' | 'empty' | 'error'; error?: string; fresh?: boolean
  title?: string; sm?: string; diagram?: string; dir?: 'right' | 'down'; step?: { at: number; n: number; t?: string; b?: string }
  signs?: SSign[]; banner?: GraphxBanner | null; warnings?: number; depth?: number; maxDepth?: number; levels?: string[]
  fx?: Record<string, unknown> | null; heat?: { lut: string[]; domain: [number, number] | null; label?: string; unit?: string; rollup?: unknown } | null
  owners?: Record<string, { label?: string; short?: string; color?: string; contact?: string; url?: string }> | null
  statuses?: Record<string, { l: string; c?: Dual; pu?: 1 }> | null; legend?: Record<string, unknown> | null
  theme?: { light: Record<string, string>; dark: Record<string, string> }; skin?: string | null
  flows?: { i: string; t: string }[]; graphTab?: boolean
  tour?: { t: string; steps: { t: string; b?: string; n: string[]; e: string[] }[]; own?: 1 } | null
  timeline?: STimeline | null; model?: { all: [string, string, string][]; par: Record<string, string>; labels: Record<string, string> }
  view?: string; rsvg?: boolean
  nodes?: SNode[]; edges?: SEdge[]; lanes?: SLane[]; deco?: SDeco[]; bbox?: { x: number; y: number; w: number; h: number }; mode?: string
  sq?: SSeq; rows?: SRow[]
  cells?: { right: Record<'cards' | 'chips' | 'mini', CellLayout | null>; down: Record<'cards' | 'chips' | 'mini', CellLayout | null> }
}
export type Detail = {
  i: string; edge?: 1; l?: string; s?: string; kd?: string; sh?: string; sm?: string; html?: string; st?: string; dl?: string
  path?: { i: string; l: string }[]; ins?: { i: string; l?: string; k?: string; e?: string }[]; outs?: { i: string; l?: string; k?: string; e?: string }[]
  metrics?: { label: string; value: unknown }[]; notes?: { tone?: string; text: string }[]; links?: { k?: string; l?: string; u?: string; st?: string; nt?: string }[]
  files?: { path: string; additions?: number; deletions?: number; lines?: number }[]; blocks?: Record<string, unknown>[] | null; tags?: string[]
  owner?: { i: string; l: string; c?: string; u?: string } | null; data?: Record<string, unknown>; steps?: number[]; kids?: number
  from?: string; to?: string; k?: string; dt?: string; tr?: string; r?: number; error?: string
}

/* lo que el terminal sabe hacer, detectado al arrancar y ajustable con /graphx caps */
export type Caps = {
  color: 'truecolor' | '256' | '16' | 'mono'
  glyphs: 'unicode' | 'basic' | 'ascii'
  braille: boolean
  images: 'kitty' | 'none'
  imageSource: 'file' | 'bytes'
  pointer: boolean
  fine: boolean
  motion: 'full' | 'reduced' | 'off'
  fps: number
  theme: 'dark' | 'light'
  term: string
  remote: boolean
  mux: string | null
  why: string[]
}

/* las props del lienzo (el Client) */
export type CanvasProps = {
  scene: Scene | null
  caps: Caps
  detail: Detail | null
  height: number
  /* el ancho del sitio, para el primer fotograma (antes de que el Client se mida) */
  width?: number
  pane: 'dock' | 'inline' | 'desktop' | 'transcript'
  serverUrl?: string
  status?: string
  /* una orden de los botones del panel (sus atajos de teclado): la tecla que el lienzo aplica, una vez por `n` */
  cmd?: { n: number; a: string } | null
  /* una petición de presentar (guide present, /graphx present): se entra una vez por `n`; al montarse, solo si es reciente */
  present?: { n: number; at: number } | null
}

declare module 'claude-code' {
  interface PluginState {
    graphx: {
      board: GraphxBoard | null
      rev: number
      server: GraphxServer | null
      render: GraphxRender | null
      live: GraphxLive
      seq: number
      detail: Detail | null
      caps: Caps | null
      over: Partial<Caps> | null
      view: 'auto' | 'cells' | 'image' | 'svg'
      img: { x: number; y: number; z: number } | null
      cmd: { n: number; a: string } | null
      present: { n: number; at: number } | null
    }
  }
}
