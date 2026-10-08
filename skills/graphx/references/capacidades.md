# Lo que GraphX sabe hacer

Un catálogo para elegir, no una lista que cumplir. Cada fila dice el campo del spec JSON (lo que va en `show.spec`,
`patch` o `%% @gx`) y cómo llegar desde el mod. La chuleta completa del formato está en la herramienta `reference`;
la documentación larga, en `docs/referencia.md` del repositorio.

## Formas de diagrama

| Qué | Campos | Notas |
|---|---|---|
| Grafo jerárquico (ELK) | `nodes`, `edges`, `lanes`, `parent`, `levels: [{depth, label}]`, `initialDepth`, `collapsed` | **Escribe las aristas en el nivel más profundo**: al plegar suben al contenedor visible y se agrupan (`×N`) |
| Carriles | `lanes: [{id, label, subtitle, color, owner}]`, `lane` en la pieza raíz (los hijos lo heredan) | fronteras reales: equipo, sistema, runtime. Con 2+ aparecen marcos de fondo |
| Dirección | `direction: right \| down` | también `show.direction`, `guide.direction` |
| Secuencias | `flows: [{id, title, participants, messages}]`; mensajes `sync async return self`, `phase`, filas `block/else/end`, `note` (`over`, `side`), `activate`, `create`, `destroy` | `guide.flow` abre una; `initialView: "flow:<id>"` arranca en ella; `graphTab: false` solo secuencia |
| Mermaid | 18 tipos: flowchart, sequence, class, state, er, mindmap, gantt, journey, timeline, gitGraph, C4, architecture, block, requirement, sankey, kanban, treemap, pie | cada uno con su forma y su layout; datos: [reglas](mermaid.md) |
| Layouts propios | `layout.mode: gantt git sankey treemap timeline journey grid tree`; `layout.lanes: strict \| flow`, `frames`, `cycles`, `backEdges` | `grid` + `gridCols` para tableros de indicadores |
| Árbol de ficheros | `show.paths` (`"src/a.ts"` o `{path, additions, deletions, status, size, lines}`), `show.tree_text` (salida de `tree`) | `tree_options: {root, compact, focus: "changes", direction}` |

## Piezas

| Qué | Campos |
|---|---|
| Tarjeta | `label` (≤ 24), `summary` (siempre), `subtitle`, `kind` (icono: `service app module function class file route job queue datastore cache external ui config test package user mobile cloud lock key shield card cart search mail bell cpu bug branch chart gauge other`), `tags` (búsqueda) |
| En la tarjeta y el panel | `notes: [{tone: warn\|info\|good, text}]` (un punto), `metrics: [{label, value}]`, `files: [{path, lines, additions, deletions, url}]`, `links: [{kind: jira (key) \| pr (number, repo) \| notion \| artifact \| doc \| url (url, label) \| node (target), status, note}]` (raíz: `links: {repo, jira, related}`), `delta: added\|modified\|removed` |
| 61 formas | `shape`: las de Mermaid (rombo, cilindro, hexágono, nota, nube…) y de GraphX: `table`/`class`/`requirement` (`rows`), `bar` (`span`), `score`, `ticket` (`badge`, `avatar`), `flowbar`, `block` (`value`), `commit` |
| Indicadores como pieza | `shape: kpi` (`value`, `unit`, `decimals`, `change` %, `good: "down"`, `spark`) · `gauge` (`value`, `min`, `max`, `thresholds: [aviso, crítico]`, `good: "high"`) · `donut` (`parts: [{label, value, color}]`) — un carril «panel» con 3–4 indicadores resume el sistema |
| Color | `color`, `fill`, `textColor` (CSS o `{light, dark}`); `fx.autoColor: lanes \| groups \| kinds`; `theme` (tokens) |
| Estados propios | raíz `statuses: {clave: {label, color, pulse, alert}}` + `status` en la pieza; `legend: {kinds, edges: [{label, style, color}]}`; `icons: {kind: path}` |
| Marco | `frame: dashed \| dotted` en un contenedor (fronteras C4, grupos) |

## Aristas

| Qué | Campos |
|---|---|
| Tipo | `kind: call http rpc event queue data dependency render async other` — `event`/`queue`/`async` son discontinuas y deciden el sentido del radio de impacto (el fallo baja hacia quien consume; en las demás sube hacia quien llama) |
| Texto | `label` (corto), `summary`, `data` (qué viaja), `trigger` (qué la dispara) |
| Énfasis y movimiento | `emphasis: hero` (una o dos) · `muted`; `animated` (solo las que cuentan la historia); `rate` (caudal → partículas), `speed`, `weight` (grosor) |
| Extremos | `head`/`tail` (`arrow none triangle diamond odiamond circle cross open lollipop one zero-one one-many zero-many`), `headLabel`/`tailLabel`, `curve: true` |

## El panel de una pieza: `blocks`

`text` (`style: lead|muted|small`) · `heading` · `divider` · `callout` (`tone: info|warn|good|crit`, `title`, `text`)
· `quote` (`by`) · `code` (`lang`) · `kv` · `list` (`ordered`) · `checklist` · `steps` (`done|active|todo`) · `badges`
· `table` (`columns`, `rows`; celda `{v, tone}`) · `stats` (`items: [{label, value, unit, change, good, spark}]`) ·
`spark` · `chart` (`kind: line|area|bar|stack`, `labels`, `series: [{label, values}]`, `unit`) · `bars` · `progress` ·
`gauge` · `donut` · `kpi` · `timeline` (`items: [{time, label, tone}]`) · `heatstrip` (`rows`, `labels`, `scheme`) ·
`image` (`src`). El texto admite **negrita**, *cursiva*, `código` y enlaces.

## Datos y efectos

| Qué | Campos | Desde el mod |
|---|---|---|
| Calor | `heat` en la pieza; `fx.heat: {label, unit, domain, scheme: traffic\|heat\|cool\|viridis\|magma\|[colores], invert, rollup: max\|avg\|sum}` — un contenedor plegado toma el `rollup` de lo que lleva | `data`, `fx` |
| Series, avance, alertas | `spark` + `unit`, `progress`, `alert: crit\|warn\|info\|ok` (o un estado con `pulse`) | `data` |
| Caudal | `rate` en la arista; `fx.particles: data \| true \| all \| {speed, density, max}` | `data` |
| Línea de tiempo | raíz `timeline: {label, data (TSV/CSV ancho: columna de tiempo + `<id>.<campo>` + `event`; o largo: `time,id,field,value`), events: [{time, label, tone, nodes}], window, step, start}` | `show.spec`/`patch.set`; `guide.timeline` salta a un instante; reproducir es la tecla `y` |
| Equipos | raíz `owners: {id: {label, short, color, contact, url}}`; `owner` en pieza o carril (se hereda) | `guide.owners` filtra; colorear es la tecla `e` |
| Radio de impacto | — (sale del grafo y del `kind` de las aristas); `fx.blast.mode: auto\|callers\|downstream\|both` | `guide.blast` |
| Presets | `fx: calm \| vivid \| neon \| blueprint \| glass \| present \| false` | `show.fx`, `/graphx-mod fx` |
| Efectos sueltos | `fx: {particles, heat, spark, progress, alerts, waves, hoverFlow, grid, lod, play, spotlight, entrance: "cascade", glow, gradient, autoColor, skin, sketch}` | `fx` |

## Leer y navegar

| Qué | Cómo |
|---|---|
| Recorrido / presentación | spec `tour.steps: [{title, body_html, focus: {nodes, edges} \| {messages}, view, depth, expand, collapse, select}]`; en el mod, `guide.steps` (`title`, `body`, `nodes`, `edges`, `expand`, `depth`, `select`, `view: "flow:<id>"`, `signs`) y `present: true` |
| Carteles | `signs`: anclados a una pieza, sueltos o de un paso del recorrido; `banner` arriba. Tonos `info tip ok warn danger note` |
| Foco y trazado | `guide.focus` (+ `prune`), `select`, `trace: {id, dir: up\|down}` (de qué depende / qué depende de ella), `depth`, `reset` |
| Filtros con nombre | raíz `filters: [{label, query \| paths \| delta \| kinds \| nodes, prune}]`, `focus` inicial |
| Lo que el motor hace solo | buscar (`/`, incluye `tags`), minimapa, leyenda, selector de niveles, vecindad en el panel, zoom semántico, «solo cambios» si hay `delta`, «▶ Flujo» (`fx.play`) |
| Atlas (varias perspectivas) | un JSON de `entities` + `perspectives`, cada una un spec; `examples/fx/build-atlas.mjs` hace la página y `GraphXAtlas.mount` lo monta: fichas con «aparece en», interiores con zoom, búsqueda y enlaces (ver [patrones](patrones.md#atlas-de-un-sistema)) |
| Preguntar desde el lienzo | la persona pulsa `q` (o clic derecho / Alt+clic en el navegador) y el prompt se rellena con la pieza: contesta y señálala |

## En el terminal

El mod redibuja todo en celdas: tarjetas, fichas, compacto, vista general o esquema según el tamaño; 16/256/truecolor
o sin color; unicode, básico o ASCII; imagen del motor en kitty/Ghostty/WezTerm. `view` con `text: true` enseña lo que
ve la persona: compruébalo cuando el diagrama sea grande o el terminal estrecho.
