# GraphX · motor de diagramas navegables

**Un diagrama = un JSON.** GraphX lo convierte en una página interactiva y autocontenida (sin
servidor, sin CDN): layout automático jerárquico con [ELK](https://eclipse.dev/elk/), niveles de
profundidad que se abren en su sitio, conexiones que suben al contenedor visible cuando se pliega,
tooltips, panel de detalle, búsqueda, trazado de dependencias, secuencias animadas y un recorrido
guiado con modo presentación. Funciona igual como artifact de claude.ai, fichero local o bloque
dentro de otra página.

Versión **1.7.0** · nació para revisar PRs (skill `pr-review-artifact-v5`), pero el motor no sabe
nada de PRs: todo lo que es de código es opcional. Desde la 1.6 también lee **Mermaid** (§7), y
desde la 1.7 dibuja sus formas y tiene componentes de **React** (§7.1).

```
graphx.js           el motor (≈1 500 líneas, sin dependencias salvo ELK)
graphx.css          estilos; todo sale de tokens CSS, tema claro y oscuro
vendor/elk.bundled.js  el layout (ELK 0.12, ≈1,6 MB, se incrusta en la página)
graphx-build.mjs    valida el JSON (o un .mmd/.md de Mermaid), lo enriquece (opcional, con git) y emite la página
graphx-mermaid.js   conversor de Mermaid → JSON de GraphX, sin depender de Mermaid (§7)
graphx-shapes.js    las formas (rombos, tablas, barras de gantt…) como funciones puras (§7.1)
react/              componentes de React sobre las mismas formas (§7.1)
dist/               versión compacta — ver §1.1 (se regenera con tools/build-dist.mjs)
examples/           pr-review-stack-202.json (73 piezas, 4 niveles)
                    onboarding-proceso.json  (un proceso de RR. HH., vertical y con colores)
                    warehouses-pr-radar.json (seguimiento de PRs entre repos; se genera desde datos)
                    mermaid/*.mmd            (un ejemplo por cada tipo de Mermaid admitido; shapes.mmd, todas las formas)
                    gallery/                 (la galería: Mermaid frente a GraphX y el catálogo de formas en React)
tools/              verify.mjs (jsdom) · verify-mermaid.mjs · verify-shapes.mjs · snap-depth.mjs + snapshot-svg.mjs (rasterizar para mirar)
                    build-dist.mjs (compacta) · sync.sh (copia el motor a la skill y a desarrollo)
```

---

## 1 · Empezar en un minuto

```bash
cd <carpeta de graphx>        # en la skill: assets/graphx
node graphx-build.mjs examples/onboarding-proceso.json --out /tmp/onboarding.html
open /tmp/onboarding.html
```

El ensamblador valida antes de emitir: ids duplicados, padres o extremos inexistentes, ciclos,
pasos que apuntan a piezas que no existen, colores no válidos, enlaces que no son `http(s)`… Un
error aborta; un aviso (piezas sin `summary`, pasos sin foco, demasiadas aristas animadas) no.

| Opción | Qué hace |
|---|---|
| `--out x.html` | página autocontenida (por defecto, junto al JSON) |
| `--title "…"` | `<title>` de la página (si no, el `title` del JSON) |
| `--height 720` | alto del lienzo en px |
| `--check` | solo valida |
| `--strict` | los avisos también fallan |
| `--fragment` | solo el bloque `[data-gx]`, para incrustarlo en una página que ya carga el motor |
| `--json-out f` | guarda el JSON enriquecido (con Mermaid, el JSON convertido) |
| `--block N` | con un `.md`, qué bloque ` ```mermaid ` convertir (el primero por defecto) |
| `--lang es \| en` | con Mermaid, idioma de los textos que genera el conversor |
| `--mode full \| lite \| dev` | `full` (defecto): bundle minificado con ELK dentro, sin red · `lite`: ELK desde jsDelivr (≈160 KB la página) · `dev`: fuentes sin minificar |
| `--git <repo> --base <ref> [--head <ref>]` | rellena `additions`/`deletions` de cada fichero con `git diff --numstat` y, con `links.repo` + `links.pr`, el enlace a su diff |

Para publicarlo en claude.ai: la tool `Artifact` con el `.html` generado (mismo fichero = misma URL).

### 1.1 · Versión compacta para artifacts y otras webs

`node tools/build-dist.mjs` genera:

| Fichero | Peso (gzip) | Uso |
|---|---|---|
| `dist/graphx.bundle.min.js` | 1,5 MB (464 KB) | **un solo `<script>`**: ELK + motor + estilos (se inyectan solos) + monta todos los `[data-gx]` al cargar. Funciona sin red. |
| `dist/graphx.lite.min.js` | 109 KB (35 KB) | lo mismo **sin ELK**: lo carga de jsDelivr la primera vez (admitido por la CSP de los artifacts de claude.ai). Cambia el origen con `GraphX.elkURL = '…'` antes de cargar. |
| `dist/graphx.min.js` + `dist/graphx.min.css` | 76 KB + 33 KB | por separado, si la página ya trae ELK o gestiona sus estilos |

ELK es el 95 % del peso y ya viene compilado, así que minificarlo apenas ahorra: la compactación de
verdad es el bundle `lite`. Con cualquiera de los dos bundles, una página solo necesita:

```html
<script src="graphx.lite.min.js"></script>   <!-- o incrustado en <script>…</script> -->
<div data-gx data-height="640"><script type="application/json" class="gx-spec">{ …el JSON… }</script></div>
```

Si cambias el motor: `node tools/build-dist.mjs` regenera `dist/` (necesita `npx`, descarga esbuild la
primera vez). Los ensambladores usan `dist/` solo si es más reciente que las fuentes.

**Incrustarlo en otra página** que ya incluya `vendor/elk.bundled.js`, `graphx.js` y `graphx.css`:

```html
<div data-gx data-height="640"><script type="application/json" class="gx-spec">{ …el JSON… }</script></div>
<script>GraphX.mountAll(document)</script>
```

o, desde JS: `const g = GraphX.mount(elemento, spec, { height: 640, lang: 'es' })`. La instancia
expone `ready`, `expandTo(n)`, `reveal(id)`, `select(id)`, `goStep(i)`, `showView('flow:<id>')`,
`setPresent(bool)`, `setExplore(bool)`, `setDirection('right'|'down')` y `destroy()`.

---

## 2 · El JSON, de menos a más

**Mínimo** — piezas y conexiones. Todo lo demás es opcional:

```json
{
  "title": "Mi sistema",
  "nodes": [
    { "id": "web", "label": "Web", "kind": "ui", "summary": "La aplicación que usa el cliente." },
    { "id": "api", "label": "API", "kind": "service", "summary": "Recibe las peticiones de la web." },
    { "id": "db",  "label": "Base de datos", "kind": "datastore", "summary": "Guarda los pedidos." }
  ],
  "edges": [
    { "id": "e1", "from": "web", "to": "api", "kind": "http", "label": "POST /pedidos" },
    { "id": "e2", "from": "api", "to": "db", "kind": "data", "label": "INSERT" }
  ]
}
```

**Carriles** (`lanes`): fronteras reales — un equipo, un sistema, un runtime. Una pieza raíz dice
`"lane": "<id>"` y sus hijos lo heredan. Con dos o más carriles aparecen los **marcos de fondo**.

**Jerarquía** (`parent`): define los niveles. Nombra cada nivel en `levels` para el selector:

```json
"levels": [ { "depth": 0, "label": "Área" }, { "depth": 1, "label": "Etapa" }, { "depth": 2, "label": "Tarea" } ],
"nodes": [
  { "id": "alta", "lane": "rrhh", "label": "Alta administrativa", "kind": "service", "summary": "…" },
  { "id": "ficha", "parent": "alta", "label": "Crear la ficha", "kind": "function", "summary": "…" }
]
```

> **La regla que da el poder al motor: escribe las conexiones en el nivel más profundo.** Al
> plegar, cada una sube al contenedor visible más cercano y las que coinciden se agrupan (`×N`),
> con la lista en el tooltip. Un solo juego de aristas sirve para todos los niveles.

### Referencia de campos

| Dónde | Campo | Valores / notas |
|---|---|---|
| raíz | `lang` | `es` · `en` |
| | `direction` | `right` (columnas, cabecera arriba) · `down` (franjas, cabecera lateral) |
| | `initialDepth` | nivel al abrir; por defecto 1 |
| | `initialView` | `"flow:<id>"` — abre en ese flujo en vez de en el grafo |
| | `graphTab` | `false` — solo secuencia: sin vista de grafo; las piezas son solo participantes y pulsarlas ilumina sus mensajes |
| | `layout` | `{ "lanes": "strict" \| "flow", "frames": true \| false, "cycles": "dfs" \| "order", "backEdges": "route" }` — orden de carriles fijo o libre; marcos de fondo; cómo se rompen los ciclos (`dfs`: como Mermaid); `route`: ELK traza también las aristas que vuelven atrás (esquivan piezas) en vez de arcos |
| | `collapsed` | ids que arrancan plegados aunque su nivel diga lo contrario |
| | `statuses` | estados propios `{ "<clave>": { "label", "color" } }` — ver §4.1 |
| | `legend` | `{ "edges": [{ "label", "style", "color" }], "kinds": { "<kind>": "etiqueta" }, "delta": false }` — ver §4.1 |
| | `icons` | iconos propios `{ "<kind>": "<path 16×16>" }` o `{ "path", "fill": true }` — ver §4.1 |
| | `theme` | colores del tema — ver §4 |
| | `links` | `repo`, `sha`, `pr`, `jira` (base), `related[]` — ver §5 |
| carril | `id` `label` `subtitle` `color` `links` | |
| pieza | `id` `label` `summary` | `summary` es lo que se lee al pasar y en el panel: escríbelo siempre |
| | `kind` | `service app module function method class file route job queue datastore cache external ui config test package other` (solo cambia el icono) |
| | `delta` | `added modified removed unchanged` — si no es un diff, déjalo sin poner |
| | `parent` · `lane` · `subtitle` · `tags` | `tags` entran en la búsqueda |
| | `status` | una clave de `statuses`: etiqueta en el tooltip y el panel, color de la pieza si no trae `color` |
| | `details_html` | HTML extra en el panel |
| | `notes` | `[{ "tone": "warn" \| "info" \| "good", "text": "…" }]` — un punto en la tarjeta |
| | `metrics` | `[{ "label": "TTL", "value": "900 s" }]` — cifras en el panel |
| | `files` | `[{ "path", "lines", "additions", "deletions", "url", "diff_url" }]` |
| | `color` · `links` | §4 · §5 |
| | `shape` | una forma de §7.1 en vez de la tarjeta (`decision`, `table`, `bar`…) |
| | `rows` · `span` · `score` · `value` · `badge` · `avatar` · `head` | los datos que usa su forma (§7.1) |
| | `frame` | en un contenedor: `dashed` · `dotted` — marco discontinuo (fronteras de C4, grupos de arquitectura) |
| | `fill` · `textColor` | relleno y color de texto propios (como `color`, un color o `{ light, dark }`); el de un `classDef` de Mermaid |
| arista | `id` `from` `to` | |
| | `kind` | `call http rpc event queue data dependency render async other` (`event`/`queue`/`async` van discontinuas) |
| | `label` `summary` `data` `trigger` | qué viaja y qué lo dispara aparecen en el tooltip y el panel |
| | `animated` | flecha que fluye — solo las que cuentan la historia |
| | `emphasis` | `hero` (una o dos, como mucho) · `normal` · `muted` |
| | `delta` `color` `links` | |
| | `head` · `tail` | la punta de cada extremo: `arrow` (defecto en `head`), `none`, `triangle`, `diamond`, `odiamond`, `circle`, `cross`, `open`, `lollipop`, `one`, `zero-one`, `one-many`, `zero-many` |
| | `headLabel` · `tailLabel` | texto junto a cada extremo (cardinalidades: `1`, `0..*`) |
| | `weight` | un número: el grosor de la arista crece con él (sankey) |
| | `curve` | `true`: una curva suave en vez de la ruta ortogonal (las ramas de un mindmap) |
| flujo | `id` `title` `summary` `participants[]` `messages[]` | una secuencia, en su propia pestaña con «Reproducir» |
| mensaje | `id` `from` `to` `label` `kind` | `sync async return self` (`self` exige `from === to`) · `phase`: una banda con `label` que agrupa lo que sigue, sin `from`/`to` ni número |
| | `head` · `tail` · `activate` · `deactivate` | punta (`line` sin punta, `open`, `cross`), doble sentido, y el participante que se activa o se desactiva |
| fila de secuencia | `kind`: `block` `else` `end` | un marco (`block`: `block` = `loop`/`alt`/`par`…, `title`, `label`) partido por `else` y cerrado por `end` |
| | `kind`: `note` | `over: [ids]`, `side`: `over` · `left` · `right`, `label` — una nota como caja |
| | `kind`: `activate` · `deactivate` | `node` — abre o cierra una barra de activación |
| | `kind`: `create` · `destroy` | `node` — la cabecera nace en esa fila; la línea de vida acaba, con un aspa, en el siguiente mensaje |
| | `summary` `data` | salen en el tooltip del mensaje |
| | `note` `repeat` `animated` `color` | |
| recorrido | `tour.title` `tour.steps[]` | |
| paso | `title` `body_html` | di **qué pasa, qué viaja y qué lo dispara** |
| | `focus` | `{ "nodes": [], "edges": [] }` o `{ "messages": [] }` con `view` de flujo |
| | `view` `depth` `expand` `collapse` `select` | todo opcional: el motor abre solo lo necesario para ver el foco |

---

## 3 · Lo que hace el motor por ti

- **Layout** jerárquico con ELK: carriles en orden, contenedores anidados, aristas ortogonales;
  las que van hacia atrás salen como arcos para no abrir canales vacíos.
- **Niveles**: selector de profundidad, ⊕/⊖, `+N` en la tarjeta o `−` en la cabecera para abrir o plegar en su sitio.
- **Doble clic** en una pieza: la selecciona, abre su panel y la centra y acerca en el hueco que deja el panel.
- **Tooltip** al pasar (resumen, estado, entradas y salidas) con la vecindad iluminada.
- **Panel** al pulsar: migas de pan, acciones en una línea (◎ Centrar · ⟵ Depende de · Dependientes ⟶),
  enlaces como chips con el estado en color, ficheros, notas, métricas, los pasos del recorrido que
  la explican como números (título en el tooltip), y entradas/salidas plegadas por defecto.
  La rueda sobre el panel desplaza el panel, no el lienzo.
- **Tarjetas** de 140–212 px: un título largo parte en dos líneas antes que ensanchar la caja, y
  llevan el icono de cada tipo de enlace que hay en su detalle (GitHub, Jira, Notion, Claude…).
- **Búsqueda** (tecla `/`), sin tildes; **trazado** de «de qué depende» / «qué depende de esto».
- **Marcos** por carril con cabecera que queda fija al borde al acercarse; **↦/↧** cambia la orientación.
- **Minimapa**, **leyenda**, «Solo cambios», zoom con rueda (o ⌘/Ctrl + rueda) y arrastre.
- **Secuencias** por flujo con reproducción animada.
- **Presentación**: pantalla completa, `← → espacio`, `Esc`. El recorrido también funciona en línea.
  **■ Detener** (o `Esc`) sale del recorrido y devuelve el diagrama al estado con el que se abrió.
- **Móvil**: en la página un dedo desplaza la página y dos mueven el diagrama; **⤢ Explorar** lo
  pone a pantalla completa. Botones de 40–46 px.
- **Tema claro/oscuro** en los tres estados (marcado claro, marcado oscuro, sin marcar); hereda
  los tokens de la página anfitriona si los define (`--ink`, `--muted`, `--hairline`, `--accent-ink`…).

---

## 4 · Colores (todo opcional)

**Tema global** — sobreescribe tokens por modo:

```json
"theme": {
  "light": { "accent": "#0b6e8c", "add": "#1a7f37" },
  "dark":  { "accent": "#4fb3d1" }
}
```

o `"theme": { "accent": "#0b6e8c" }` para los dos modos a la vez. Tokens:
`bg canvas ink muted faint line card card-line glyph-bg lane lane-line group group-line accent
accent-soft add add-soft mod mod-soft del del-soft neu warn band-a band-b band-head frame band-div`.

**Por elemento** — `"color"` en un carril (tiñe su banda, pone una franja de acento y colorea su
número), una pieza (barra lateral, icono y borde), una arista o un mensaje (línea y punta de flecha):

```json
{ "id": "it", "label": "IT", "color": "#bc4c00" }
{ "id": "it", "label": "IT", "color": { "light": "#bc4c00", "dark": "#f0883e" } }
```

`"layout": { "inheritLaneColor": true }` hace que cada pieza tome el color de su carril.
Solo se aceptan valores de color CSS (hex, `rgb()`, `hsl()`, `oklch()`, nombre): el valor va
dentro de una hoja de estilos, así que cualquier otra cosa se rechaza al validar y se ignora al pintar.

### 4.1 · Estados, leyenda e iconos propios (1.4)

Cuando el diagrama no es un diff, «nuevo / modificado / eliminado» no significa nada. Tres campos
de la raíz lo sustituyen:

```json
"statuses": {
  "merged":  { "label": "Mergeada",             "color": { "light": "#1f7a45", "dark": "#5fd08e" } },
  "pending": { "label": "Pendiente de aprobar", "color": "#b07004" }
},
"legend": {
  "edges": [
    { "label": "stack: parte de la rama de otra PR", "style": "solid" },
    { "label": "funcional: necesita lo que trae otra", "style": "dashed" },
    { "label": "aún bloquea", "style": "flow" },
    { "label": "ya no bloquea", "style": "muted" },
    { "label": "la dependencia que más frena", "style": "hero" }
  ],
  "kinds": { "module": "bloque funcional", "package": "PR de la librería" }
},
"icons": { "service": "M4 2.5h8A1.5 1.5 0 0 1 13.5 4v8…" }
```

- Una pieza con `"status": "merged"` toma la etiqueta en su píldora y el color del estado si no trae `color`.
- Con `statuses`, la leyenda muestra los estados en lugar de los deltas; sin `statuses` ni ningún
  `delta` en el JSON, la leyenda no enseña deltas y el panel deja de decir «sin cambios».
- `legend.edges` reemplaza las filas de conexiones (`style`: `solid dashed flow muted hero`, `color` opcional);
  `legend.kinds` pone nombre legible a cada tipo de icono.
- `icons` añade tipos nuevos (o redefine uno existente) con un path de 16×16 en trazo; `{ "path", "fill": true }`
  para uno relleno. Solo se admiten comandos de path y números: el validador rechaza cualquier otra cosa.
- `package` y `module` ya no comparten dibujo: `module` es un cubo y `package` una caja abierta.

---

## 5 · Enlaces (todo opcional)

En piezas, carriles, aristas, o para el diagrama entero en `links.related`:

```json
"links": [
  { "kind": "jira", "key": "PRJ-123", "note": "El ticket de origen" },
  { "kind": "pr", "number": 109905, "repo": "org/otro-repo", "status": "draft" },
  { "kind": "notion", "url": "https://www.notion.so/…", "label": "Especificación" },
  { "kind": "artifact", "url": "https://claude.ai/…", "label": "La revisión" },
  { "kind": "doc", "url": "https://…" },
  { "kind": "url", "url": "https://…", "label": "Dashboard" },
  { "kind": "node", "target": "otra-pieza", "note": "Por qué están relacionadas" }
]
```

`status` (`open`, `merged`, `draft`, `closed`, `done`, `in progress`… en inglés o español) pinta
un punto de color en el chip. `jira` con solo `key` usa `links.jira` como base (por defecto `https://example.atlassian.net/browse/`);
`pr` con solo `number` usa `links.repo`. `node` relaciona dos piezas del propio diagrama y navega.
Solo `http(s)`. Todos los enlaces del diagrama se listan juntos en el botón **Ficheros**.

**Ficheros y diff** (para código): con `links.repo`, `links.sha` y `links.pr`, cada fichero cambiado
enlaza a su diff dentro de la PR (`…/pull/N/files#diff-<sha256(ruta)>`). Lo calcula `--git`; si no,
el propio navegador. En la tarjeta, `± N` abre el diff (un fichero) o la lista (varios).

---

## 6 · Más allá de las PRs

Todo lo específico de código —`delta`, `files`, `links.pr`, `--git`— es opcional. Sin ellos, GraphX
es un mapa jerárquico navegable con narrativa. Formas de aprovecharlo:

| Uso | Carriles | Niveles | Flujos | Recorrido |
|---|---|---|---|---|
| **Arquitectura de un sistema** (C4) | sistemas o runtimes | sistema → contenedor → componente | una petición de punta a punta | la visita guiada para quien llega |
| **Procesos de negocio** (ver `examples/onboarding-proceso.json`) | departamentos | área → etapa → tarea | un día concreto del proceso | «cómo funciona» para el equipo |
| **Onboarding técnico** de un módulo | capas del módulo | módulo → clase → método | los flujos que más se tocan | el orden en que conviene leer el código |
| **Postmortems** | sistemas afectados | servicio → pieza | la cronología del incidente, mensaje a mensaje | causa → efecto → arreglo; `notes` con los hallazgos |
| **Especificaciones y RFC** | partes del cambio propuesto | propuesta → pieza | el flujo nuevo | la propuesta paso a paso; `delta: added` para lo nuevo |
| **Seguimiento de PRs de un proyecto** (ver `examples/warehouses-pr-radar.json` y §6.1) | temas del proyecto | bloque funcional → PR | la cadena de merges que desbloquea algo | «qué pide atención hoy» |
| **Dependencias entre equipos o proyectos** | equipos | equipo → iniciativa → entregable | — | el camino crítico; «de qué depende» hace el resto |
| **Mapas de datos** | orígenes y destinos | dominio → tabla → campo | un pipeline ETL | de dónde sale cada cifra |
| **Organigramas** o estructuras | direcciones | dirección → equipo → rol | — | — |
| **Material formativo** | módulos del curso | módulo → lección → concepto | una práctica guiada | la clase entera en modo presentación |

Consejos generales:

- **Un carril = una frontera** que el lector reconoce, no una carpeta.
- **Pocos niveles, bien nombrados** (3–4). El selector de nivel es la forma más rápida de entender algo.
- **`summary` en todo**: es lo que convierte un dibujo en una explicación.
- **El recorrido cuenta la historia**; el grafo permite perderse con criterio. Usa los dos.
- Sin `delta`, no pongas `"Solo cambios"` en tu explicación: todas las piezas cuentan como «sin cambios».
- Para diagramas grandes, `initialDepth: 1` y deja que el lector baje.

### 6.1 · Ejemplo: radar de PRs generado desde datos

`examples/warehouses-pr-radar.json` es el mapa de las PRs abiertas y mergeadas de un proyecto
(Warehouses, en `acme/platform` y `acme/ui-kit`) tal como se publicó en un artifact el
23-sep-2026. No está escrito a mano: sale de una lista de PRs con un generador, y ese es el patrón
que merece la pena copiar cuando el diagrama describe un estado que cambia cada día.

```
examples/warehouses-pr-radar/data.js       los datos: bloques, PRs, catálogo de tickets, épicas, artefactos
examples/warehouses-pr-radar/gen-graph.mjs data.js → ../warehouses-pr-radar.json
```

```bash
node examples/warehouses-pr-radar/gen-graph.mjs
node graphx-build.mjs examples/warehouses-pr-radar.json --strict
```

Qué decisiones toma y por qué:

- **Solo las PRs son piezas.** Los tickets de Jira y los artefactos no se dibujan: van como `links`
  en el panel de cada PR, con `status` (el punto de color del chip) y una `note` con título,
  estado y asignado. Las épicas y el material de contexto van en `links.related` (botón **Ficheros**).
  Dibujarlos como piezas duplica el diagrama y llena el lienzo de aristas «implementa».
- **El estado de la PR es su `color`** (mergeada, pendiente, draft, cambios pedidos), en claro y oscuro.
- **Dos niveles**: bloque funcional → PR, dentro de tres carriles temáticos. Los bloques que solo
  tienen historia (mergeadas) arrancan en `collapsed`.
- **Las aristas son dependencias entre PRs**: `dependency` si una PR parte de la rama de otra (stack),
  `async` (discontinua) si solo necesita lo que trae. `animated` solo cuando la de origen sigue
  abierta, es decir, cuando todavía bloquea; `muted` cuando ya está mergeada.
- **Los desajustes van como `notes`** (`warn`) en la PR afectada: un ticket en *Blocked* con la PR
  aprobada, o en *In Code Review* con la PR mergeada.
- **Dos PRs que compiten** por lo mismo se enlazan con `{ "kind": "node", "target": … }` en vez
  de con una arista, porque no dependen una de otra.
- **`flows`** cuentan cadenas de merge (el camino a una funcionalidad) y el **`tour`** es la
  lista de lo que pide atención, con `focus` sobre las PRs y `select` sobre la que manda.

Para rehacerlo con datos nuevos basta con actualizar `data.js` (estados de `gh pr view` y de Jira)
y regenerar.

---

## 7 · Desde Mermaid

Cualquier diagrama de Mermaid que sea un grafo de piezas y conexiones se convierte al JSON de
GraphX y gana lo que da el motor: niveles plegables, panel, búsqueda, trazado, tema claro/oscuro.
El conversor (`graphx-mermaid.js`) no depende de Mermaid: lleva un analizador propio por tipo y
funciona igual en Node, en el navegador y en un artifact sin red.

```bash
node graphx-build.mjs examples/mermaid/flowchart.mmd --out /tmp/flujo.html
node graphx-build.mjs docs/arquitectura.md --block 2 --json-out /tmp/arq.json   # segundo bloque ```mermaid de un .md
```

En una página que ya carga GraphX (los dos bundles de `dist/` llevan el conversor dentro):

```html
<div data-gx><script type="text/plain" class="gx-mermaid">
flowchart LR
  A[Pedido] --> B{¿Stock?} -->|sí| C[(Almacén)]
</script></div>
<script>GraphX.mountAll(document)</script>
```

o desde JS: `GraphX.fromMermaid(texto, { lang, nest }) → { spec, type, warnings }`,
`GraphX.mountMermaid(host, texto, opts)` y `GraphX.replaceMermaid(document)`, que sustituye los
`pre.mermaid`, `div.mermaid` y `code.language-mermaid` de una página (el markdown renderizado) por
diagramas de GraphX; el bloque que no se puede convertir se queda como estaba.

| Mermaid | En GraphX |
|---|---|
| `flowchart` / `graph` | cada forma es un icono (rombo = decisión, cilindro = base de datos, `@{ shape }`…); `subgraph` = contenedor plegable; `-.->` discontinua, `==>` énfasis (`hero`), `-->|texto|`, `A & B`; `classDef`/`style`/`linkStyle` = colores; `click` con URL = enlace; `e1@{ animate: true }` = arista animada |
| `sequenceDiagram` | un flujo (vista de secuencia, sin pestaña de grafo); `-->>` retorno, `-)` asíncrono, automensajes; `loop`/`alt`/`else`/`opt`/`par`/`critical`/`break` = fases; `Note` = nota del mensaje; `box` = carril; `link`/`links` = enlaces |
| `classDiagram` | clases con atributos y métodos en el panel, `<<anotación>>`, genéricos; `namespace` = contenedor; herencia, composición, agregación, dependencia… con su frase y su leyenda |
| `stateDiagram` | `[*]` = inicio / fin (uno por ámbito); estados compuestos = contenedores; `<<choice>>`, `<<fork>>`; notas |
| `erDiagram` | entidades con sus atributos (PK/FK) en el panel y en la búsqueda; la cardinalidad, en palabras en el tooltip |
| `mindmap` | un árbol; con `{ nest: true }`, ramas como contenedores plegables |
| `gantt` | secciones = contenedores; `after` = dependencias; fechas calculadas (AAAA-MM-DD); `done`/`active`/`crit` = estados; hitos |
| `journey` · `timeline` | secciones → tareas o periodos → eventos, encadenados; la puntuación es el estado |
| `gitGraph` | una rama por carril, commits en orden, `merge`, `cherry-pick`, `tag` |
| C4 (`C4Context` … `C4Deployment`) | Person/System/Container/Component (`_Ext`, `Db`, `Queue`); boundaries y nodos de despliegue = contenedores; `Rel*` = aristas; `C4Dynamic` añade el flujo numerado |
| `architecture-beta` · `block-beta` | grupos y servicios, `junction`, `{group}`; bloques anidados |
| `requirementDiagram` · `sankey-beta` · `kanban` · `treemap-beta` | requisitos con riesgo como estado; flujos con su valor; columnas como carriles (`ticketBaseUrl`); jerarquía con totales |

Lo que no tiene equivalente (posiciones de `block-beta`, flechas de `architecture` por lado,
`activate`, `autonumber`…) se ignora; una línea que no se entiende se salta con un aviso con su
número de línea, nunca en silencio. Los gráficos de datos (`pie`, `xychart`, `quadrantChart`,
`radar`, `packet`) no son grafos: se rechazan con un error que lo explica. Los ciclos se rompen
como en Mermaid (`layout.cycles: "dfs"`), así que un diagrama se lee en el orden en que se escribió.

`node tools/verify-mermaid.mjs [--mount]` comprueba la conversión de cada ejemplo de `examples/mermaid/`.

### 7.1 · Formas y componentes de React

Una pieza con `shape` se dibuja con esa forma en vez de con la tarjeta. Las formas viven en
`graphx-shapes.js`: cada una es una función pura que, dado el nodo y su tamaño, devuelve un árbol
SVG (`{ tag, attrs, children, text }`). El motor lo convierte en nodos SVG y `react/` en elementos
de React, así que se escriben una vez y se ven igual en los dos sitios. El contorno de todas lleva
la clase `gx-card`: hover, iluminado, selección, color de pieza y deltas funcionan como en una tarjeta.

| Familia | Formas | Datos |
|---|---|---|
| flujo (texto dentro) | `rect rounded terminal subroutine datastore cylinder-h circle dcircle hexagon decision io io-l trapezoid trapezoid-t flag document cloud bang triangle triangle-down hourglass delay card text arrow-right arrow-left arrow-up arrow-down` | `label`, `subtitle` |
| marcas | `start end junction choice fork commit commit-merge commit-highlight commit-reverse` | `badge` (tag de un commit), `head: true` (late) |
| notas | `note` | `label` (hasta 6 líneas) |
| tablas | `table` (entidad de ER), `class` (UML), `requirement` | `rows: [{ name, type, keys, vis, section, static, abstract }]`, `subtitle` («estereotipo») |
| iconos | `tile` (servicio de arquitectura), `actor` | el icono sale de `kind` |
| C4 | `person c4 c4-db c4-queue` | `subtitle` ([tipo]), `summary` (descripción dentro), `color` (relleno) |
| tarjetas con datos | `bar` (gantt), `score` (journey), `ticket` (kanban), `flowbar` (sankey), `block` (treemap) | `span: { start, end, milestone, live }`, `score` 1–5, `badge` + `avatar`, `value` |

Las aristas acaban en el contorno de la forma (el vértice del rombo, el borde del círculo, el punto
del commit), no en su caja. Las barras de gantt comparten una pista de fechas (el rango del diagrama entero), con la tarea en
curso rayada en movimiento y el día de hoy marcado; el HEAD de cada rama de git late; las filas de
una tabla se iluminan al pasar. Todo respeta `prefers-reduced-motion`.

En React (`react/index.mjs` con un bundler, o `react/graphx-react.js` tras cargar React con un `<script>`):

```js
import { GraphX, GraphXShape, GraphXScope, Shapes } from 'graphx/react';
<GraphX mermaid={texto} height={640} onError={e => …} />          // monta el motor
<GraphXScope>                                                      // tokens de color, claro y oscuro
  <Shapes.Decision node={{ label: '¿Stock?' }} state="lit" color="#cf222e" />
  <GraphXShape node={{ label: 'CLIENTE', shape: 'table', rows: [{ name: 'id', keys: 'PK' }] }} />
</GraphXScope>
```

`GraphX` necesita además `graphx.js` (y `graphx-mermaid.js` para `mermaid`); las formas sueltas, solo
`graphx-shapes.js`. Los tipos están en `react/index.d.ts`. La galería (`node examples/gallery/build.mjs
<salida.html>`) enseña cada tipo de Mermaid lado a lado con GraphX y el catálogo de formas en React.

`node tools/verify-shapes.mjs` comprueba las formas, su uso en el motor y que React dibuja lo mismo.

## 8 · Verificar sin navegador

Chrome headless se cuelga con estas páginas. Para comprobarlas:

```bash
npm i                                       # instala jsdom (solo para verificar)
node tools/verify.mjs examples/pr-review-stack-202.html      # 67 comprobaciones
node tools/snap-depth.mjs <página.html> 1 /tmp/d.svg [down]  # vuelca el SVG de un nivel
node tools/snapshot-svg.mjs /tmp/d.svg /tmp/d.png light|dark # lo rasteriza con rsvg-convert
```

`verify.mjs` está cableado al ejemplo de la PR (ids y conteos): cópialo y adapta ids y cifras para
otro diagrama. El raster usa Helvetica y un estimador de ancho de texto; en el navegador se mide
con canvas, así que la tipografía real queda algo más compacta.

## 9 · Límites conocidos

- La página pesa ≈1,7 MB por ELK. Sin red funciona igual: todo va dentro.
- Por encima de ~300 piezas visibles a la vez el relayout deja de ser instantáneo; plega por nivel.
- Las aristas que cruzan muchos contenedores pueden dar rodeos: son decisiones de ELK.
- No hay edición visual: el JSON es la fuente de verdad.

## Procedencia

Construido en septiembre de 2026 junto a la skill `pr-review-artifact-v5`, que lo lleva dentro en
`assets/graphx/`. Licencia de ELK: EPL-2.0 (https://eclipse.dev/elk).
