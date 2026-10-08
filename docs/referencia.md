# GraphX · referencia

> La referencia completa del JSON, la API y las herramientas. La presentación del proyecto está en el
> [README](../README.es.md) ([English](../README.md)).

**Un diagrama = un JSON.** GraphX lo convierte en una página interactiva y autocontenida (sin
servidor, sin CDN): layout automático jerárquico con [ELK](https://eclipse.dev/elk/), niveles de
profundidad que se abren en su sitio, conexiones que suben al contenedor visible cuando se pliega,
tooltips, panel de detalle, búsqueda, trazado de dependencias, secuencias animadas y un recorrido
guiado con modo presentación. Funciona igual como artifact de claude.ai, fichero local o bloque
dentro de otra página.

Versión **1.9.0** · nació para revisar PRs, pero el motor no sabe
nada de PRs: todo lo que es de código es opcional. Desde la 1.6 también lee **Mermaid** (§7),
desde la 1.7 dibuja sus formas y tiene componentes de **React** (§7.1), y desde la 1.8 tiene un
módulo de **efectos** con datos en vivo: partículas por caudal, mapa de calor, gráficos como piezas,
ondas, pieles y más, todo configurable con `fx` (§8). La 1.9 añade línea de tiempo desde TSV/CSV, radio
de impacto, equipos, bloques ricos en el panel y formas de Mermaid con los mismos datos (§8.1–8.5).

```
graphx.js           el motor (≈1 500 líneas, sin dependencias salvo ELK)
graphx.css          estilos; todo sale de tokens CSS, tema claro y oscuro
vendor/elk.bundled.js  el layout (ELK 0.12, ≈1,6 MB, se incrusta en la página)
graphx-build.mjs    valida el JSON (o un .mmd/.md de Mermaid), lo enriquece (opcional, con git) y emite la página
graphx-mermaid.js   conversor de Mermaid → JSON de GraphX, sin depender de Mermaid (§7)
graphx-shapes.js    las formas (rombos, tablas, barras de gantt, KPI, gauge, donut…) como funciones puras (§7.1)
graphx-fx.js        los efectos y los datos en vivo (§8): opcional, sin él todo funciona igual
react/              componentes de React sobre las mismas formas (§7.1)
dist/               versión compacta — ver §1.1 (se regenera con tools/build-dist.mjs)
docs/               catálogo de assets, efectos clasificados, la página de demostración y los ejemplos, con capturas
examples/           pr-review-stack-202.json (73 piezas, 4 niveles)
                    onboarding-proceso.json  (un proceso de RR. HH., vertical y con colores)
                    warehouses-pr-radar.json (seguimiento de PRs entre repos; se genera desde datos)
                    mermaid/*.mmd            (un ejemplo por cada tipo de Mermaid admitido; shapes.mmd, todas las formas)
                    gallery/                 (la galería: Mermaid frente a GraphX y el catálogo de formas en React)
                    fx/                      (los efectos: software, postmortem, pipeline de datos, Kubernetes, CI/CD en
                                              Mermaid, almacén, galería y la página de demostración; ver docs/ejemplos.md)
tools/              verify.mjs (jsdom) · verify-mermaid.mjs · verify-shapes.mjs · verify-tree.mjs · verify-fx.mjs · snap-depth.mjs + snapshot-svg.mjs (rasterizar para mirar)
                    timeline.mjs (una tabla TSV/CSV → línea de tiempo) · capture-docs.mjs (capturas de docs/)
                    build-dist.mjs (compacta) · release.mjs (los distribuibles de una versión)
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
| `dist/graphx.bundle.min.js` | 1,7 MB (545 KB) | **un solo `<script>`**: ELK + motor + estilos (se inyectan solos) + monta todos los `[data-gx]` al cargar. Funciona sin red. |
| `dist/graphx.lite.min.js` | 335 KB (115 KB) | lo mismo **sin ELK**: lo carga de jsDelivr la primera vez (admitido por la CSP de los artifacts de claude.ai). Cambia el origen con `GraphX.elkURL = '…'` antes de cargar. |
| `dist/graphx.min.js` + `dist/graphx.min.css` | 109 KB + 56 KB | por separado, si la página ya trae ELK o gestiona sus estilos |
| `dist/graphx-fx.min.js` | 37 KB (14 KB) | los efectos sueltos (los bundles ya los llevan); trae sus estilos y los inyecta |

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

o, desde JS: `const g = GraphX.mount(elemento, spec, { height: 640, lang: 'es', minimap: false, fx: 'vivid' })`
(`minimap: false` o `data-minimap="false"` abre con el minimapa oculto; `fx` o `data-fx` configura los
efectos, §8; los dos mandan sobre el JSON). La instancia expone `ready`, `expandTo(n)`, `reveal(id)`,
`select(id)`, `goStep(i)`, `showView('flow:<id>')`, `setPresent(bool)`, `setExplore(bool)`,
`setDirection('right'|'down')`, `setMinimap(bool)`, `setData(cambios)`, `playFlow()`, `stopFlow()`, `timeline`,
`blast(id)`, `clearBlast()`, `filterOwners(ids)`, `colorOwners(bool)` y `destroy()`.

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
| | `layout` | `{ "lanes": "strict" \| "flow", "frames": true \| false, "cycles": "dfs" \| "order", "backEdges": "route" }` — orden de carriles fijo o libre; marcos de fondo; cómo se rompen los ciclos (`dfs` u `order`: el motor recorre en profundidad desde lo escrito primero y solo vuelven atrás las aristas de retorno, como en dagre/Mermaid); `route`: ELK traza también las aristas que vuelven atrás (esquivan piezas) en vez de arcos |
| | `collapsed` | ids que arrancan plegados aunque su nivel diga lo contrario |
| | `minimap` | `false` — abre con el minimapa oculto (el botón «Minimapa» o la tecla `m` lo muestran) |
| | `fx` | efectos: un preset (`"vivid"`, `"neon"`…), un objeto o `false` — ver §8 |
| | `statuses` | estados propios `{ "<clave>": { "label", "color" } }` — ver §4.1 |
| | `legend` | `{ "edges": [{ "label", "style", "color" }], "kinds": { "<kind>": "etiqueta" }, "delta": false }` — ver §4.1 |
| | `icons` | iconos propios `{ "<kind>": "<path 16×16>" }` o `{ "path", "fill": true }` — ver §4.1 |
| | `theme` | colores del tema — ver §4 |
| | `links` | `repo`, `sha`, `pr`, `jira` (base), `related[]` — ver §5 |
| carril | `id` `label` `subtitle` `color` `links` | |
| pieza | `id` `label` `summary` | `summary` es lo que se lee al pasar y en el panel: escríbelo siempre |
| | `kind` | `service app module function method class file route job queue datastore cache external ui config test package other`, y desde la 1.9 `user mobile cloud lock key shield card cart search mail bell cpu bug branch chart gauge` (solo cambia el icono) |
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
| | `heat` · `spark` · `unit` · `progress` · `alert` | datos que dibujan los efectos (§8): un valor para el mapa de calor, una serie, su unidad, el avance (0–1) y una alerta (`crit` `warn` `info` `ok`) |
| | `change` · `good` · `min` · `max` · `thresholds` · `decimals` · `parts` | los de las formas de gráfico `kpi`, `gauge` y `donut` (§7.1) |
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
| | `rate` · `speed` | el caudal (partículas más densas y rápidas, §8) y la velocidad de la animación: `fast`, `slow` o un factor |
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
  la explican como números (título en el tooltip), y la vecindad como un mini-grafo (entradas · pieza ·
  salidas, cada una navegable) con la lista completa plegada en una línea.
  La rueda sobre el panel desplaza el panel, no el lienzo.
- **Tarjetas** de 140–212 px: un título largo parte en dos líneas antes que ensanchar la caja, y
  llevan el icono de cada tipo de enlace que hay en su detalle (GitHub, Jira, Notion, Claude…).
- **Búsqueda** (tecla `/`), sin tildes; **trazado** de «de qué depende» / «qué depende de esto».
- **Marcos** por carril con cabecera que queda fija al borde al acercarse; **↦/↧** cambia la orientación.
- **Minimapa** (con su botón o la tecla `m` se pliega a una pestaña en el borde, que se despliega al pasar
  por encima y se fija con la chincheta; `minimap: false` lo abre plegado),
  **leyenda**, «Solo cambios», zoom con rueda (o ⌘/Ctrl + rueda) y arrastre.
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
ficticio (Warehouses, en `acme/platform` y `acme/ui-kit`). No está escrito a mano: sale de una
lista de PRs con un generador, y ese es el patrón que merece la pena copiar cuando el diagrama
describe un estado que cambia cada día.

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
| `pie` | una pieza `donut` con sus partes (desde la quinta, en «Otros») y el ranking completo en el panel |

**Tema, look y efectos.** El tema de la cabecera (`%%{init: { "theme": "forest" }}%%` o el frontmatter
`config: theme / themeVariables`) se traduce a tokens de GraphX en claro y en oscuro (`forest`, `neutral`,
`dark`; con `base`, sus variables: `primaryColor`, `lineColor`…). `look: handDrawn` dibuja con trazo a mano y
`e1@{ animation: fast }` anima la arista a esa velocidad. Los `flowchart` y `stateDiagram` convertidos traen
«▶ Flujo»; `fromMermaid(texto, { fx: false })` quita todos los efectos y `{ fx: 'vivid' }` pone un preset.

Lo que no tiene equivalente (posiciones de `block-beta`, flechas de `architecture` por lado,
`activate`, `autonumber`…) se ignora; una línea que no se entiende se salta con un aviso con su
número de línea, nunca en silencio. Un `pie` se convierte en una pieza `donut` con el ranking completo en
su panel; el resto de gráficos de datos (`xychart`, `quadrantChart`, `radar`, `packet`) no son grafos: se
rechazan con un error que lo explica. Los ciclos se rompen
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
| gráficos | `kpi` (cifra, variación y serie), `gauge` (indicador sobre un rango), `donut` (reparto) | `value`, `unit`, `decimals`, `change` (%) + `good: "down"`, `spark`; `min`, `max`, `thresholds: [aviso, crítico]` + `good: "high"`; `parts: [{ label, value, color }]` |

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

### 7.2 · Layouts propios por tipo

Un gantt no es un grafo de flechas: es una fila por tarea sobre un eje de fechas. Con `layout.mode`,
el motor coloca las piezas con un layout propio (`graphx-layouts.js`, funciones puras) en vez de con
ELK, y dibuja detrás una capa con ejes y marcas; tooltip, panel, selección, plegar y animación siguen
igual. El conversor de Mermaid lo pone solo:

| `layout.mode` | Qué hace | Lo usa |
|---|---|---|
| `gantt` | una fila por tarea sobre un eje de fechas común (marcas, fines de semana con `layout.weekends`, hoy); secciones como bandas que al plegarse son una barra resumen; dependencias en escuadra | gantt |
| `git` | un carril por rama y una columna por commit, en orden cronológico; ramas y merges en curva, sin flechas | gitGraph |
| `sankey` | columnas por profundidad, barras con altura según el valor y cintas apiladas del color de su origen | sankey-beta |
| `treemap` | teselado *squarified*: el área de cada hoja es proporcional a su `value` | treemap-beta |
| `timeline` | periodos sobre un eje con sus eventos debajo; `section: true` marca las secciones | timeline |
| `journey` | las tareas en fila y, debajo, la curva de emoción con una cara según su `score` | journey |
| `grid` | la rejilla de block-beta: `grid: { r, c, span }` en cada pieza, `gridCols` en un contenedor y `layout.columns` en la raíz; aristas rectas o en L/U si chocan | block-beta |

`node tools/verify-shapes.mjs` comprueba las formas, los layouts, su uso en el motor y que React dibuja lo mismo.

### 7.3 · Árboles de ficheros

Un repo, una búsqueda o un diff dibujados como el comando `tree`, pero con tarjetas que se navegan
como carpetas. `graphx-tree.js` construye el JSON y el layout `tree` lo coloca:

```js
GraphX.tree.fromPaths(['src/app.ts', 'src/ui/Boton.tsx', 'README.md'], { root: 'mi-app' });
GraphX.tree.fromTreeText(salidaDeTree);                       // también `tree -h`
GraphX.tree.fromGit({ files, numstat, nameStatus });          // ls-files + git diff
```

```bash
node tools/tree-spec.mjs <dir> --base origin/main --html arbol.html   # el árbol de un repo con su diff
```

- **Dos tarjetas por carpeta.** Plegada, *agrupa*: pila detrás, cuántos ficheros y subcarpetas, + y −
  de lo que lleva dentro y una barra con el reparto por extensión. Abierta, es una cabecera fina
  (`openShape: "folder-open"`) de la que cuelgan sus hijos. El fichero lleva su extensión en color,
  tamaño y líneas, + y −, y la letra de git (A, M, D, R).
- **Detalle que se abre y se cierra.** Clic en un fichero, o ⌄ en una carpeta: la tarjeta se
  despliega como una persiana con la ruta, las métricas, el reparto por extensión, los ficheros
  cambiados y el resumen. Doble clic o Intro abren el panel lateral.
- **Filtro por rutas.** `filter(ids | fn)` (o `focus` en el JSON, o buscar, o «Solo cambios») deja
  abiertas solo las ramas que llevan a lo referenciado; el resto de cada carpeta se recoge en
  «··· N más», que al pulsarlo lo enseña. Una carpeta plegada cuenta las coincidencias que lleva
  dentro. `filters` añade botones con nombre: `{ label, query | paths | delta | kinds | nodes }`.
- **Líneas vivas.** Las del árbol se redibujan en cada fotograma: crecen con los hijos que nacen
  (que entran en cascada), cada tramo de tronco toma el color del cambio más fuerte que queda por
  debajo y, al pasar por una tarjeta, se ilumina su camino desde la raíz.
- **Teclado.** ↑ ↓ mueven el cursor, → abre (o entra), ← pliega (o sube), espacio abre el detalle.
- **Dos orientaciones.** ↧ sangrado como `tree`; ↦ en columnas, cada carpeta centrada en sus hijos.
- **Árboles grandes.** Con `layout.density: "auto"` (lo pone el constructor), por encima de 140 ficheros
  a la vista cada fichero pasa a una línea; `"compact"` lo fuerza. Buscar pide dos letras y mira la
  ruta solo si la consulta lleva `/`.

`node tools/verify-tree.mjs` comprueba el constructor, las interacciones y que React dibuja lo mismo.

## 8 · Efectos y datos en vivo (graphx-fx.js)

Un módulo opcional: si está cargado (los dos bundles de `dist/` lo llevan), el motor lo engancha; si no,
nada cambia. Sin requisitos especiales de navegador (SVG, CSS y SMIL) y 37 KB minificado (14 KB con gzip).
Todo se configura con `fx`, en la raíz del JSON o en las opciones de montaje (`mount(el, spec, { fx })`,
`data-fx` en la página), que mandan sobre el JSON:

```json
"fx": false                                   // nada: el diagrama exactamente como antes
"fx": "vivid"                                 // un preset
"fx": { "preset": "neon", "glow": false, "heat": { "label": "Latencia p95", "unit": "ms", "domain": [0, 600] } }
```

| Clave | Por defecto | Qué hace |
|---|---|---|
| `particles` | `"data"` | partículas que viajan por la arista; su densidad y su velocidad crecen con `rate`. `"data"`: solo las aristas con `rate`; `true`: también las `animated` y las `hero`; `"all"`: todas. `{ speed, density, max }` las ajusta |
| `heat` | si hay datos | colorea cada pieza por `heat` (o por una métrica: `{ metric }`) y le pone su cifra; `{ label, unit, domain, scheme, invert, rollup, key }`. Escalas: `traffic` (verde → rojo), `heat`, `cool`, `viridis`, `magma` o una lista de colores. Un contenedor plegado toma el máximo de lo que lleva dentro; la escala sale en el lienzo, en la leyenda y en el minimapa |
| `spark` | si hay datos | la serie de `spark` como sparkline en la tarjeta, con su último valor y `unit` |
| `progress` | si hay datos | un anillo alrededor del icono (`progress` de 0 a 1, o de 0 a 100) |
| `alerts` | si hay datos | un halo que late: `alert: "crit" \| "warn" \| "info" \| "ok"`, o un estado de `statuses` con `pulse: true` |
| `waves` | sí | ondas que recorren el grafo salto a salto al seleccionar (un salto), al trazar dependencias (todos, a favor o a contracorriente) y en cada paso del recorrido |
| `hoverFlow` | sí | al pasar por una pieza, sus conexiones iluminadas marchan en su sentido |
| `grid` | sí | la retícula del fondo se mueve y se escala con la cámara |
| `lod` | sí | zoom semántico: por debajo de `{ k: 0.4 }`, los nombres de los contenedores abiertos crecen y las etiquetas de arista se ocultan |
| `play` | no | el botón «▶ Flujo»: una onda sale de los orígenes y recorre el grafo; lo no alcanzado espera apagado. `{ hop, loop, from }` |
| `spotlight` | no | un foco sobre la pieza seleccionada o sobre lo que enseña cada paso del recorrido |
| `entrance` | no | `"cascade"`: al abrir, las piezas entran en orden de lectura y las aristas detrás |
| `glow` | no | brillo en las aristas principales e iluminadas y en la pieza seleccionada |
| `gradient` | no | cada arista, un degradado del color de su origen al de su destino |
| `autoColor` | no | colores de la paleta donde no los hay: `"lanes"`, `"groups"`, `"kinds"` o `"auto"` (no en un diff) |
| `skin` | — | una piel completa: `neon`, `blueprint` (oscuras, con su propio fondo) o `glass` (clara y oscura) |
| `owners` | si hay datos | equipos: iniciales en la tarjeta, botón «Equipos» para filtrar y colorear (§8.3) |
| `blast` | sí | «✺ Impacto» en el panel: el radio de impacto de la pieza (§8.2) |
| `blocks` | si hay datos | bloques ricos en el panel (§8.4) |
| `timeline` | si hay datos | la línea de tiempo bajo el lienzo (§8.1) |
| `attach` | sí | la serie y el progreso en las formas de Mermaid, en una franja con su sitio (§8.5) |
| `sketch` | no | trazo a mano (lo enciende `look: handDrawn` de Mermaid) |

Presets: `vivid` (partículas, cascada, foco, brillo, degradado, colores automáticos y «▶ Flujo»), `neon`,
`blueprint` y `glass` (lo mismo con su piel), `present` (foco, cascada, partículas y brillo), `calm` (lo de
por defecto) y `off`. Todo respeta `prefers-reduced-motion` y las partículas se paran fuera de pantalla.

**Datos en vivo.** `g.setData({ nodes: { id: { heat, spark, progress, alert, value, change, parts, … } },
edges: { id: { rate, weight, speed } } })` cambia los datos sin recolocar: cada pieza se rehace en su
sitio y se anima de un dibujo al siguiente (las cifras cuentan, las series y los arcos se deslizan, el
color de calor transita). Si el cambio mueve el layout (una etiqueta, una serie nueva), recoloca.
`g.playFlow({ from, hop, loop })` y `g.stopFlow()` controlan «▶ Flujo» desde fuera.

```bash
node examples/fx/build.mjs /tmp/fx.html --standalone   # la demostración, en pestañas: software, galería, en vivo, Mermaid, referencia
node tools/verify-fx.mjs                               # comprueba configuración, efectos, datos en vivo, tiempo, impacto, equipos y Mermaid
```

> **Documentación visual**: [docs/catalogo.md](catalogo.md) (qué se puede dibujar) y
> [docs/efectos.md](efectos.md) (los efectos por función, con capturas y recetas).

### 8.1 · Línea de tiempo desde una tabla

`timeline` en la raíz pone bajo el lienzo una banda con la actividad a lo largo del tiempo: la suma de los
caudales como área, una tira de calor por pieza, los eventos marcados y un cursor que se arrastra. Reproducir
avanza fila a fila (1×, 2×, 4×) y aplica cada fila con `setData`: el diagrama entero se mueve con el día.

```json
"timeline": {
  "label": "Martes 6 de octubre",
  "data": "time\tpagos.heat\tantifraude.heat\te-co-pay\tk-pedidos.value\tevent\n09:00\t180\t140\t120\t610\tDespliegue 4.2\n…",
  "events": [{ "time": "13:00", "label": "Antifraude supera los 700 ms", "tone": "crit", "nodes": ["antifraude"] }],
  "window": 12, "step": 900, "start": "end"
}
```

- **Formato ancho** (una fila por instante): una columna de tiempo y una por serie, `<id>.<campo>`. Campos:
  `heat`, `rate`, `value`, `progress`, `change`, `spark`, `weight`, `alert`. Un id sin campo es `heat` en una
  pieza y `rate` en una arista. Una columna `event` pone un evento en esa fila.
- **Formato largo**: columnas `time · id · field · value`, una fila por dato (lo que devuelve una consulta).
- `data` puede ser TSV o CSV (el separador se detecta; coma decimal admitida) o `rows: [{…}]` o `columns` + `values`.
  `GraphX.fx.parseTable(texto)` lee la tabla por su cuenta. `spark` toma la ventana de las últimas `window` filas.
- `node tools/timeline.mjs <spec.json> <datos.tsv|.csv> [--events eventos.tsv]` la lleva a un diagrama y avisa
  de las series que no apuntan a ninguna pieza (ver `examples/fx/pipeline-datos.json`).
- La fila de partida (`start: "end" | "start"`) se aplica antes del primer layout: el diagrama nace con sus datos.
- Desde JS: `g.timeline.seek(i | "13:00")`, `play()`, `pause()`, `index`, `length`, `labels`.
  `examples/fx/software/gen.mjs` genera la tabla de un día como saldría de una consulta.

### 8.2 · Radio de impacto

«✺ Impacto» en el panel (o `g.blast(id)`) dibuja qué deja de funcionar si esa pieza falla: anillos por salto
con su recuento, las piezas teñidas por distancia (rojo, naranja, ámbar), pulsos en el sentido del fallo y, en
el panel, cuántas piezas, cuántos saltos y qué equipos toca. En una llamada (`call`, `http`, `rpc`, `data`…) el
fallo sube hacia quien llama; en un `event`, `queue` o `async` baja hacia quien consume. `fx.blast.mode`:
`auto` (eso), `callers`, `downstream` o `both`. Seleccionar otra pieza lo quita; `g.clearBlast()` también.

### 8.3 · Equipos

`owners: { "pagos": { "label": "Equipo Pagos", "short": "PG", "color": "#8250df", "contact": "#pagos", "url": "https://…" } }`
en la raíz y `owner` en una pieza o un carril (lo heredan sus hijos). Cada tarjeta lleva las iniciales del
equipo sobre el icono; el panel, el equipo con su contacto; el tooltip, su nombre. «Equipos» en la barra filtra
por uno o varios (lo de otros equipos se apaga y las dependencias entre equipos quedan a media luz), incluye
«Sin equipo» para encontrar lo huérfano y colorea por equipo. Desde JS: `g.filterOwners(['pagos'])`, `g.colorOwners(true)`.

### 8.4 · Bloques ricos en el panel

`blocks: [ … ]` en una pieza añade al panel, debajo del resumen:

| `type` | Qué dibuja |
|---|---|
| `text` (`style`: `lead`, `muted`, `small`) · `heading` · `divider` | párrafos con **negrita**, *cursiva*, `código` y [enlaces](https://…) |
| `callout` (`tone`: `info`, `warn`, `good`, `crit`) · `quote` (`by`) | avisos y citas |
| `code` (`lang`) | código con resaltado ligero (JS, TS, SQL, Python, shell…) |
| `kv` · `list` (`ordered`) · `checklist` · `steps` (`done`, `active`, `todo`) · `badges` | pares, listas, tareas con su avance, pasos de un proceso, insignias |
| `table` (`columns`, `rows`; celdas `{ v, tone }`) | tabla con números alineados y estados en color |
| `stats` (`items`: `label`, `value`, `unit`, `change`, `good`, `spark`) · `spark` | cifras con su variación y su serie |
| `chart` (`kind`: `line`, `area`, `bar`, `stack`; `series`, `labels`, `unit`) | gráfico con rejilla, ejes, leyenda y tooltip por punto; se dibuja al abrir |
| `bars` · `progress` | un ranking y el avance por partes |
| `gauge` · `donut` · `kpi` | las formas de gráfico (§7.1), dentro del panel |
| `timeline` (`items`: `time`, `label`, `tone`) · `heatstrip` (`rows`, `labels`, `scheme`) | una línea de eventos y una tira de actividad |
| `image` (`src`: `data:image/…` o `https://`) | una imagen con pie |

Todo el texto se escapa y los colores y las URLs solo pasan si son válidos. Fuera de un diagrama:
`GraphX.fx.renderBlocks(blocks, { lang })` devuelve el HTML (dentro de un elemento con la clase `gx` para los tokens).

### 8.5 · Formas de Mermaid igual de ricas

Las formas (rombos, cilindros, hexágonos, círculos, baldosas, C4, tablas, notas) aceptan los mismos datos que
una tarjeta: `heat` (tiñe y pone la cifra), `owner` (sus iniciales), `alert` (el halo) y, en una franja debajo
con su sitio en el layout, `spark` y `progress`. Desde Mermaid, sin dejar de ser Mermaid válido:

```
api@{ shape: hex, label: "API", heat: 85, spark: "40 52 61 58", owner: busqueda, progress: 0.5 }
e1@{ rate: 900, speed: fast }
%% @gx { "owners": { "busqueda": { "label": "Equipo Búsqueda" } }, "fx": { "particles": true } }
%% @gx api { "blocks": [ { "type": "callout", "tone": "warn", "text": "Reindexado en curso" } ] }
```

Las claves de `@{…}` que Mermaid no conoce pasan a la pieza o a la arista; un comentario `%% @gx [id] {json}`
lleva JSON a la raíz (`fx`, `owners`, `timeline`, `statuses`, `tour`…) o a una pieza (`blocks`, `metrics`,
`links`…). Ver `examples/fx/arquitectura.mmd`.

## 9 · Verificar sin navegador

Chrome headless se cuelga con estas páginas. Para comprobarlas:

```bash
npm i                                       # instala jsdom (solo para verificar)
node tools/verify.mjs examples/pr-review-stack-202.html      # 67 comprobaciones
node tools/verify-fx.mjs                                     # los efectos (§8)
node tools/snap-depth.mjs <página.html> 1 /tmp/d.svg [down]  # vuelca el SVG de un nivel
node tools/snapshot-svg.mjs /tmp/d.svg /tmp/d.png light|dark # lo rasteriza con rsvg-convert
```

`verify.mjs` está cableado al ejemplo de la PR (ids y conteos): cópialo y adapta ids y cifras para
otro diagrama. El raster usa Helvetica y un estimador de ancho de texto; en el navegador se mide
con canvas, así que la tipografía real queda algo más compacta.

## 10 · Límites conocidos

- La página pesa ≈1,7 MB por ELK. Sin red funciona igual: todo va dentro.
- Por encima de ~300 piezas visibles a la vez el relayout deja de ser instantáneo; plega por nivel.
- Las aristas que cruzan muchos contenedores pueden dar rodeos: son decisiones de ELK.
- No hay edición visual: el JSON es la fuente de verdad.

## Procedencia

Construido en septiembre de 2026. Licencia de ELK: EPL-2.0 (https://eclipse.dev/elk).
