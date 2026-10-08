/* El mapa de capacidades de GraphX y cómo llega cada una a cada superficie, más la chuleta del formato.
 *
 * Lo leen las herramientas `capabilities` (qué diagrama elegir y qué se verá dónde) y `reference` (cómo
 * escribirlo), y el escritorio para saber qué invocar. Las superficies:
 *   browser   el visor del navegador: el motor de verdad, todo
 *   desktop   la app de escritorio, el editor y el móvil: el SVG del motor (con sus animaciones CSS y SMIL)
 *   cells     el terminal, en caracteres: el lienzo del mod, con sus equivalentes de cada efecto
 *   image     el terminal con gráficos (kitty, Ghostty, WezTerm): el PNG del motor
 */
import type { Caps } from '../types'

type Support = { browser: string; desktop: string; cells: string; image: string }
export type Capability = { id: string; family: string; what: string; how: string; support: Support }

const ALL: Support = { browser: 'sí', desktop: 'sí', cells: 'sí', image: 'sí' }
const S = (cells: string, desktop = 'sí', image = 'sí'): Support => ({ browser: 'sí', desktop, cells, image })

export const DIAGRAMS: Capability[] = [
  { id: 'graph', family: 'diagrama', what: 'grafo jerárquico (arquitectura, dependencias, procesos, C4, PRs)', how: 'spec: { nodes, edges, lanes, parent }', support: S('tarjetas, fichas y vista general colocadas por ELK en celdas; carriles, contenedores plegables, niveles') },
  { id: 'flowchart', family: 'mermaid', what: 'diagrama de flujo con formas, subgraphs, estilos', how: 'mermaid: flowchart LR/TD', support: S('cada forma con su contorno de caracteres') },
  { id: 'sequenceDiagram', family: 'mermaid', what: 'secuencia de mensajes con bloques, notas, activaciones', how: 'mermaid: sequenceDiagram · o flows en el JSON', support: S('columnas por participante, marcos alt/loop, notas, numeración y reproducción mensaje a mensaje') },
  { id: 'classDiagram', family: 'mermaid', what: 'clases con atributos y métodos, herencia, composición', how: 'mermaid: classDiagram', support: S('tablas con sus miembros; puntas ◁ ◆ ◇') },
  { id: 'stateDiagram', family: 'mermaid', what: 'máquina de estados, compuestos, choice, fork', how: 'mermaid: stateDiagram-v2', support: S('marcas ● ◉ ◇ y estados compuestos como contenedores; ▶ flujo') },
  { id: 'erDiagram', family: 'mermaid', what: 'entidades con atributos PK/FK y cardinalidades', how: 'mermaid: erDiagram', support: S('tablas; patas de gallo ⋲ y cardinalidades en los extremos') },
  { id: 'mindmap', family: 'mermaid', what: 'mapa mental', how: 'mermaid: mindmap', support: S('ramas curvas en braille (o en escuadra sin braille)') },
  { id: 'gantt', family: 'mermaid', what: 'tareas sobre fechas, hitos, dependencias, hoy', how: 'mermaid: gantt · layout.mode: gantt', support: S('barras de color por estado, la activa rayada en movimiento, eje de fechas y la línea de hoy') },
  { id: 'journey', family: 'mermaid', what: 'experiencia de usuario con puntuación', how: 'mermaid: journey', support: S('caras ☹ ◒ ☺ ☻ y estrellas por tarea') },
  { id: 'timeline', family: 'mermaid', what: 'periodos con eventos', how: 'mermaid: timeline', support: S('eje con periodos y eventos') },
  { id: 'gitGraph', family: 'mermaid', what: 'ramas, commits, merges, tags', how: 'mermaid: gitGraph', support: S('commits ● ◉ ◆ ⊗ por carril, HEAD que late') },
  { id: 'C4', family: 'mermaid', what: 'C4 Context/Container/Component/Dynamic/Deployment', how: 'mermaid: C4Context …', support: S('personas, sistemas, contenedores y fronteras discontinuas') },
  { id: 'architecture', family: 'mermaid', what: 'servicios y grupos de arquitectura', how: 'mermaid: architecture-beta', support: S('baldosas con icono y grupos') },
  { id: 'block', family: 'mermaid', what: 'rejilla de bloques', how: 'mermaid: block-beta', support: S('rejilla con sus columnas') },
  { id: 'requirementDiagram', family: 'mermaid', what: 'requisitos con riesgo y verificación', how: 'mermaid: requirementDiagram', support: S('tablas de requisito') },
  { id: 'sankey', family: 'mermaid', what: 'flujos con su valor', how: 'mermaid: sankey-beta', support: S('barras por nodo y aristas con grosor según el valor') },
  { id: 'kanban', family: 'mermaid', what: 'tablero de columnas y tickets', how: 'mermaid: kanban', support: S('columnas como carriles, tickets con #id y @persona') },
  { id: 'treemap', family: 'mermaid', what: 'jerarquía por tamaño', how: 'mermaid: treemap-beta', support: S('teselas rellenas de color con su valor') },
  { id: 'pie', family: 'mermaid', what: 'reparto (se convierte en un donut)', how: 'mermaid: pie', support: S('donut con medios bloques ▀▄ (barra apilada en 16 colores o ASCII)') },
  { id: 'tree', family: 'árbol', what: 'árbol de ficheros de un repo, con su diff', how: 'paths: ["src/a.ts", {path, additions, deletions, status}] · tree_text', support: S('como `tree`, con insignias de extensión, +/− y carpetas plegables') },
]

export const EFFECTS: Capability[] = [
  { id: 'particles', family: 'datos', what: 'partículas por caudal', how: 'rate en la arista (fx.particles: data | true | all)', support: S('● que viajan por la arista; densidad y velocidad según el caudal, `speed` fast/slow', 'SMIL', 'quieto') },
  { id: 'heat', family: 'datos', what: 'mapa de calor', how: 'heat en la pieza; fx.heat { label, unit, domain, scheme: traffic|heat|cool|viridis|magma }', support: S('borde del color de la escala y la cifra en una pastilla; escala en la leyenda; contenedores plegados con el máximo') },
  { id: 'spark', family: 'datos', what: 'serie', how: 'spark: [números] + unit', support: S('▁▂▃▄▅▆▇█ en la tarjeta; braille en el detalle') },
  { id: 'progress', family: 'datos', what: 'progreso', how: 'progress 0–1', support: S('el borde de abajo se llena ━ y el %') },
  { id: 'alerts', family: 'datos', what: 'alerta que late', how: 'alert: crit | warn | info | ok · statuses con pulse', support: S('el borde parpadea en el color de la gravedad y lleva su marca ⚠ ✕', 'CSS', 'quieto') },
  { id: 'owners', family: 'datos', what: 'equipos', how: 'owners en la raíz + owner en piezas o carriles', support: S('iniciales en la tarjeta; o filtra por equipo, c colorea') },
  { id: 'blocks', family: 'datos', what: 'bloques ricos en el panel (24 tipos)', how: 'blocks: [{ type: text|callout|code|kv|table|stats|chart|bars|progress|gauge|donut|kpi|timeline|heatstrip|steps|checklist|… }]', support: S('en el panel de detalle (espacio): tablas, gráficos braille, barras, checklists…', 'Markdown') },
  { id: 'timeline', family: 'datos', what: 'línea de tiempo desde TSV/CSV', how: 'timeline: { data, events, label, window, start }', support: S('banda con el área del caudal, eventos ▼, cursor; T reproduce, , . pasos, < > velocidad; los eventos hacen latir sus piezas', 'botones', 'por pasos') },
  { id: 'kpi-gauge-donut', family: 'datos', what: 'gráficos como piezas', how: 'shape: kpi | gauge | donut con value, change, thresholds, parts', support: S('cifra con ▲▼, barra con umbrales, donut ▀▄') },
  { id: 'waves', family: 'lector', what: 'ondas al seleccionar y trazar', how: 'fx.waves (sí por defecto)', support: S('las aristas de la pieza marchan al seleccionarla') },
  { id: 'blast', family: 'lector', what: 'radio de impacto', how: '«✺ Impacto» · guide blast', support: S('b: piezas teñidas por salto (rojo, naranja, ámbar) y el fallo viajando hacia quien depende') },
  { id: 'play', family: 'lector', what: '▶ flujo desde los orígenes', how: 'fx.play', support: S('f: la onda alcanza las piezas salto a salto; lo no alcanzado espera apagado') },
  { id: 'hoverFlow', family: 'lector', what: 'marcha al pasar', how: 'fx.hoverFlow', support: S('con el ratón (pantalla completa): las aristas de la pieza marchan; tooltip con su resumen') },
  { id: 'spotlight', family: 'lector', what: 'foco', how: 'fx.spotlight', support: S('apaga lo que no es la selección o el paso del recorrido') },
  { id: 'trace', family: 'lector', what: 'trazar dependencias', how: 'guide trace', support: S('t: de qué depende · qué depende de esto') },
  { id: 'tour', family: 'lector', what: 'recorrido guiado y presentación', how: 'guide steps / go', support: S('n p s y la barra del recorrido con el texto del paso') },
  { id: 'search', family: 'lector', what: 'búsqueda', how: '—', support: S('/ y Intro: filtra el diagrama') },
  { id: 'levels', family: 'lector', what: 'niveles y contenedores plegables', how: 'parent, levels, initialDepth', support: S('1–9 profundidad, Intro abre o pliega') },
  { id: 'lod', family: 'lectura', what: 'zoom semántico', how: 'fx.lod', support: S('+ − pasan de tarjetas a fichas, a compacto y a la vista general; lejos, los contenedores grandes') },
  { id: 'grid', family: 'lectura', what: 'retícula viva', how: 'fx.grid', support: S('· que se mueve con la cámara') },
  { id: 'minimap', family: 'lectura', what: 'minimapa', how: 'minimap', support: S('m: el diagrama en medios bloques con la ventana', 'no', 'no') },
  { id: 'entrance', family: 'estilo', what: 'cascada de entrada', how: 'fx.entrance: cascade', support: S('las piezas entran en orden de lectura') },
  { id: 'glow', family: 'estilo', what: 'brillo', how: 'fx.glow', support: S('bordes gruesos en la selección y lo iluminado') },
  { id: 'gradient', family: 'estilo', what: 'degradado en las aristas', how: 'fx.gradient', support: S('color verdadero: del origen al destino; si no, el del origen') },
  { id: 'autoColor', family: 'estilo', what: 'colores automáticos', how: 'fx.autoColor: auto | lanes | groups | kinds', support: S('la paleta p0–p7 del tema') },
  { id: 'skin', family: 'estilo', what: 'pieles neon · blueprint · glass', how: 'fx: "neon" | "blueprint" | "glass"', support: S('la paleta y el fondo de la piel (con 256 colores o más)') },
  { id: 'sketch', family: 'estilo', what: 'trazo a mano', how: 'look: handDrawn (Mermaid) · fx.sketch', support: S('contornos discontinuos') },
]

export const SURFACES = `Superficies:
- navegador: el motor de verdad, interactivo (abre con /graphx-mod open o view: browser).
- escritorio, editor, móvil: el SVG del motor con sus animaciones (partículas SMIL, latidos CSS) y controles; el detalle en Markdown. También el lienzo de caracteres.
- terminal: el lienzo de caracteres con todos los efectos animados; se adapta a 4 tamaños (micro < 40 col., estrecho < 64, normal, ancho ≥ 132 con panel lateral), a 4 profundidades de color (truecolor, 256, 16, sin color), a 3 juegos de caracteres (unicode con braille, básico, ASCII) y al ratón. En kitty, Ghostty y WezTerm, «i» lo enseña como imagen del motor.`

export function capabilitiesText(caps: Caps | null, extra: { rsvg?: boolean; engine?: boolean; surface?: string } = {}) {
  const line = (c: Capability) => `- ${c.id} — ${c.what}. ${c.how}. Terminal: ${c.support.cells}.${c.support.desktop !== 'sí' ? ` Escritorio: ${c.support.desktop}.` : ''}`
  const out = [
    '# GraphX: qué se puede dibujar y cómo se verá',
    '',
    '## Diagramas (elige el que cuente mejor la idea)',
    ...DIAGRAMS.map(line),
    '',
    '## Efectos y datos (se encienden con el dato; fx los configura)',
    ...EFFECTS.map(line),
    '',
    SURFACES,
  ]
  if (caps) out.push('', `## Este terminal (${caps.term || 'sin nombre'})`, `color ${caps.color} · caracteres ${caps.glyphs}${caps.braille ? ' + braille' : ''} · imágenes ${caps.images} · ratón ${caps.pointer ? 'sí' : 'no'} · movimiento ${caps.motion} · ${caps.fps} fps · tema ${caps.theme}${caps.mux ? ` · ${caps.mux}` : ''}${caps.remote ? ' · SSH' : ''}`, ...caps.why.map(w => `- ${w}`))
  if (extra.engine === false) out.push('', 'AVISO: el motor sin navegador no está disponible (falta `node mod/build.mjs`): el terminal y el escritorio no pueden dibujar.')
  if (extra.rsvg === false) out.push('', 'Sin rsvg-convert: no hay imagen para kitty/Ghostty ni captura para `view`; el terminal usa caracteres.')
  return out.join('\n')
}

export const REFERENCE = `# GraphX · referencia rápida

## Fuentes para show (una sola)
- spec: JSON de GraphX (abajo).
- mermaid: texto Mermaid de cualquiera de los 18 tipos (flowchart, sequenceDiagram, classDiagram, stateDiagram, erDiagram, mindmap, gantt, journey, timeline, gitGraph, C4*, architecture-beta, block-beta, requirementDiagram, sankey-beta, kanban, treemap-beta, pie). Los ids son los de Mermaid.
- paths: rutas de ficheros ["src/a.ts", {"path":"src/b.ts","additions":3,"deletions":1,"status":"M"}] → árbol plegable. tree_options: { root, compact, focus: "changes" }.
- tree_text: la salida del comando \`tree\`.
- file: una ruta a .json, .mmd o .md (el primer bloque \`\`\`mermaid).

## Mermaid con datos de GraphX (sigue siendo Mermaid válido)
- Claves que Mermaid no conoce en \`id@{ … }\` (SOLO en flowchart/graph y block; valores planos): heat, spark: "1 2 3", unit, progress, alert, owner, value, change, good, min, max, thresholds, decimals, summary, subtitle, status, color, kind, tags, delta. Si la misma línea lleva shape, el kind lo pone la forma.
- En una arista con id (\`a e1@--> b\`, y su \`@{}\` después): \`e1@{ rate: 900, speed: fast, emphasis: hero, animate: true, summary, data, trigger, weight, head, tail }\`. El tipo sale de la flecha: --> llamada, -.-> evento/asíncrona (discontinua; el impacto baja), ==> principal. \`kind\` en @{} se ignora.
- JSON en comentarios, UNA línea cada uno (vale en los 18 tipos): \`%% @gx { "fx": "vivid", "owners": {…}, "timeline": {…}, "statuses": {…}, "tour": {…}, "filters": […], "legend": {…} }\` (raíz; levels, layout, theme, icons, links, collapsed, direction y lanes se ignoran ahí) y \`%% @gx id { "blocks": […], "metrics": […], "links": […], "shape": "kpi", "parts": […] }\` (pieza, carril o arista). Fuera de flowchart/block, los datos de una pieza van siempre aquí.
- convert recoge todo eso (y dice qué anotaciones lleva: lo que no sale, no se aplicó); export lo escribe desde cualquier diagrama, pero la ida y vuelta pierde carriles, niveles, tema y el tipo de las aristas.

## JSON de GraphX
{ "title", "summary", "lang": "es", "direction": "right" | "down", "initialDepth": 1, "fx": "vivid",
  "lanes": [{ "id", "label", "subtitle", "color", "owner" }],
  "levels": [{ "depth": 0, "label": "Área" }],
  "nodes": [{ "id", "label", "summary", "kind", "parent", "lane", "subtitle", "shape", "color", "delta", "status", "notes", "metrics", "tags", "links",
              "heat", "spark", "unit", "progress", "alert", "owner", "value", "change", "good", "min", "max", "thresholds", "parts", "blocks" }],
  "edges": [{ "id", "from", "to", "label", "kind", "summary", "data", "trigger", "animated", "emphasis", "head", "tail", "headLabel", "tailLabel", "rate", "speed", "weight", "curve" }],
  "flows": [{ "id", "title", "participants": ["a","b"], "messages": [{ "from", "to", "label", "kind": "sync|async|return|self" }, { "kind": "block", "block": "loop|alt|opt|par", "label" }, { "kind": "else" }, { "kind": "end" }, { "kind": "note", "over": ["a"], "label" }] }],
  "owners": { "pagos": { "label", "short", "color", "contact" } },
  "statuses": { "ok": { "label", "color", "pulse" } },
  "timeline": { "label", "data": "time\\tapi.heat\\te1\\n09:00\\t120\\t300…", "events": [{ "time", "label", "tone", "nodes" }] },
  "layout": { "mode": "gantt|git|sankey|treemap|timeline|journey|grid|tree" } }

- Jerarquía con "parent": el contenedor se pliega; escribe las aristas en el nivel más profundo.
- "lane": carril raíz (una frontera: equipo, sistema, runtime). "summary" siempre: es lo que se lee al pasar y en el panel.
- kind de pieza (icono): service app module function method class file route job queue datastore cache external ui config test package user mobile cloud lock key shield card cart search mail bell cpu bug branch chart gauge other.
- kind de arista: call http rpc event queue data dependency render async other (event/queue/async discontinuas; el impacto baja por ellas y sube por las llamadas).
- emphasis: "hero" (1–2) · "muted". animated: la que cuenta la historia. rate: caudal (partículas).
- shape: rect rounded terminal subroutine datastore cylinder-h circle dcircle hexagon decision io io-l trapezoid trapezoid-t flag document cloud bang triangle triangle-down hourglass delay card text arrow-right/left/up/down note start end junction choice fork commit commit-merge commit-highlight commit-reverse table class requirement tile actor person c4 c4-db c4-queue bar score ticket flowbar block kpi gauge donut file folder.
- fx: false · "calm" · "vivid" · "neon" · "blueprint" · "glass" · "present" · { particles, heat: {label, unit, domain, scheme}, spark, progress, alerts, waves, play, spotlight, entrance: "cascade", glow, gradient, autoColor, owners, blast, timeline, sketch }.
- blocks (panel): text heading divider quote callout code kv list checklist steps badges table stats spark chart bars progress gauge donut kpi timeline heatstrip image.

## En el terminal
Las piezas son cajas de caracteres: etiquetas cortas (≤ 24) y un subtitle breve se leen mejor. Cada pieza ocupa lo que su texto; un grafo ancho se ve como fichas o en vista general y se navega con el teclado. Las formas especiales llevan su contorno aproximado y un icono.

## Cartelería (signs)
- { "at": "<id>", "title", "text", "tone": "info|tip|ok|warn|danger|note", "step": N } · banner: { "title", "text", "tone" }.

## Recorrido y vista (guide)
- steps: [{ "title", "body", "nodes", "edges", "expand", "depth", "select", "view": "flow:<id>" }] · go: 1..N | next | prev | stop.
- focus [ids] (+ prune), select, trace { id, dir: up|down }, depth, direction, reset, flow: <id de flujo> | null, blast: <id>, owners: [ids], timeline: índice o etiqueta.

## Datos en vivo (data)
{ "nodes": { "api": { "heat": 480, "alert": "crit", "spark": [...] } }, "edges": { "e1": { "rate": 240 } } } se acumulan sobre el diagrama sin recolocarlo.

## Cambios al vuelo (patch)
{ "add": { "nodes", "edges", "lanes", "flows" }, "update": [{ "id", …campos }], "remove": [ids], "set": { "title", "direction", "initialDepth", "layout", "fx", "owners", "timeline"… } }
`
