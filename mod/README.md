# graphx · el mod de GraphX para Claude Code

GraphX entero dentro de Claude Code: cualquier diagrama que GraphX sabe dibujar (los 19 tipos de Mermaid, el grafo
jerárquico, el árbol de ficheros, 61 formas) con sus efectos y sus datos en vivo, en **cada superficie** y a
**cualquier tamaño**. Claude lo dibuja con herramientas; la persona lo navega con el teclado y el ratón.

```
Claude ──herramientas──▶ hooks (register.tsx, $.state) ──HTTP──▶ server/live.mjs ── engine.mjs: GraphX en jsdom
                                   │                                    │  ├─ la escena (geometría + datos de efectos)
   terminal ◀── Client (canvas.tsx: caracteres, efectos animados) ◀─────┤  ├─ ELK otra vez, en unidades de celda
   escritorio ◀── Svg del motor (animaciones CSS y SMIL) + controles ◀──┤  ├─ SVG autocontenido · PNG (rsvg-convert)
   kitty/Ghostty ◀── Image (PNG) · otros 24 bits ◀── Raster (medios ▀) ◀┤  └─ Mermaid ⇄ GraphX con anotaciones
   navegador ◀── viewer/ (el motor de verdad, interactivo) ◀── SSE ─────┘
```

## Cargarlo

```sh
node tools/build-dist.mjs          # si dist/ no está al día
node mod/build.mjs                 # copia el bundle al visor y empaqueta jsdom para el servidor (ignorados por git)
claude --plugin-dir mod/graphx     # o: node mod/build.mjs --to <carpeta de mods de la sesión> [--watch]
```

Hace falta `node` en el PATH. Con `rsvg-convert` (librsvg) hay además imagen del motor para kitty/Ghostty/WezTerm, la
foto en medios bloques y la captura que ve Claude con `view`.

## Lo que hace Claude

| Herramienta | Para qué |
|---|---|
| `show` | Dibuja: `spec` (JSON de GraphX), `mermaid` (19 tipos, con datos en `@{…}` y `%% @gx`), `paths`, `tree_text` o `file`. `fx` elige los efectos. |
| `patch` | Lo cambia sin rehacerlo: `add`, `update`, `remove`, `set`. |
| `data` | Datos en vivo sin recolocar (el `setData` del motor): calor, series, progreso, alertas, caudal… |
| `signs` | Carteles anclados, sueltos o de un paso, y un banner. |
| `guide` | Recorrido (`steps`, `go`) y vista: `focus`, `select`, `trace`, `depth`, `direction`, `flow`, `blast`, `owners`, `timeline`. |
| `view` | Qué hay pintado, la captura PNG del motor y, con `text: true`, el panel del terminal tal como lo ve la persona. |
| `convert` | Mermaid → GraphX con el inventario de sus anotaciones; GraphX → Mermaid con las suyas. |
| `export` | El diagrama del lienzo como Mermaid con todo lo añadido (parches, datos) en `%% @gx`. |
| `capabilities` | Qué se puede dibujar y cómo se verá en cada superficie, con lo detectado de este terminal. |
| `reference` | La chuleta del formato. |

Los bloques ` ```mermaid ` de las respuestas de Claude se dibujan con GraphX en el propio transcript (opción `inline`).

## Lo que ve la persona

**Terminal.** El lienzo se adapta a lo que hay:

| | |
|---|---|
| Tamaño | micro (< 40 col.) y estrecho (< 64): el **esquema**, en filas, con los datos de cada pieza y sus conexiones; normal: el grafo; ancho (≥ 132 × 18): el grafo y el **panel lateral** con el detalle y sus bloques |
| Zoom semántico | el grafo se coloca otra vez con ELK en unidades de celda: **tarjetas** (1:1, con sus datos), **fichas**, **compacto** y, si nada cabe, la **vista general** encajada; `+` `−` pasan de uno a otro sin perder la pieza en foco |
| Color | truecolor · 256 (paleta xterm exacta) · 16 (por tono, con los colores del tema del terminal) · sin color (negrita, atenuado, inverso) |
| Caracteres | unicode con braille (curvas, series finas) · básico (consola de Linux) · ASCII |
| Imagen | `i`: en kitty, Ghostty y WezTerm, el PNG del motor; en los demás de 24 u 8 bits, la foto del motor en medios bloques |
| Ratón | en pantalla completa: clic, doble clic, arrastrar, pasar por encima (tooltip y aristas que marchan), clic derecho para preguntar |
| Movimiento | partículas por caudal, alertas que laten, ondas, cascada, ▶ flujo, línea de tiempo; menos fotogramas por SSH o en tmux; `x` los reduce o los para |

Lo detecta solo al arrancar (`TERM`, `COLORTERM`, `TERM_PROGRAM`, `NO_COLOR`, `FORCE_COLOR`, la configuración regional,
tmux/screen/zellij, SSH, el tema de Claude Code…) y `/graphx caps` dice qué ha visto y por qué; `/graphx caps
color=256 glyphs=ascii motion=off theme=light` (o las opciones del mod en `/config`) lo fuerzan.

**Teclado.** Un solo mapa, en minúsculas, igual con el foco en el lienzo (un clic) que en el panel (`ctrl+x tab`, o al
abrirlo con `/graphx`, que ya le da el teclado; `Esc` lo devuelve al prompt). Con el panel enfocado aparece una barra
con un botón por atajo, así que sin ratón también se maneja todo:

| | |
|---|---|
| `r` | **presentación**: el recorrido paso a paso con su explicación abajo y la cámara centrada en cada paso; si el diagrama no trae recorrido, uno automático (la visión general y una pieza —o un mensaje— por paso, en el orden en que fluye) |
| `n` `b` (→ ← en la presentación) | paso siguiente · anterior |
| flechas · `h j k l` · `z` `x` (+ −) · `0` | mover · acercar, alejar · encuadrar |
| `s` `a` (tab · mayús+tab) · `o` (⏎) · `d` (espacio) | pieza siguiente, anterior · abrir o plegar · detalle |
| `1–9` · `g` · `v` · `/` | niveles · orientación · vista (grafo, esquema, flujos) · buscar |
| `t` · `c` · `f` · `y` `,` `.` | trazar · ✺ impacto · ▶ flujo o reproducir la secuencia · línea de tiempo |
| `e` · `m` · `u` · `q` · `w` · `i` · `?` | equipos · minimapa · efectos · preguntar a Claude · navegador · imagen · ayuda |

Una tecla sin uso en la vista lo dice en el pie. Claude también puede abrir la presentación (`guide` con `present: true`)
y la persona con `/graphx present`.

**Escritorio, editor y móvil.** El SVG del motor (con sus partículas SMIL y sus latidos CSS, podado para caber en el
límite del elemento) con los controles del recorrido, los niveles, la orientación y los flujos, un selector de piezas y
su detalle en Markdown. En el escritorio, «Celdas» enseña el mismo lienzo que el terminal.

**Navegador.** `/graphx open`: el motor de verdad, interactivo, con los carteles y lo que Claude va cambiando.

## Mermaid de ida y vuelta

- **Recoger**: `convert` (o `show` con `mermaid`) lee los 19 tipos y dice qué anotaciones de GraphX lleva cada pieza,
  arista y la raíz: las claves que Mermaid no conoce en `id@{ heat: 85, spark: "1 2 3", owner: pagos }` y el JSON de
  `%% @gx [id] {…}` (bloques, métricas, enlaces, formas que Mermaid no tiene, `fx`, equipos, línea de tiempo, recorrido…).
- **Expresar**: `export` y `convert` con `spec` escriben Mermaid válido que el conversor vuelve a leer igual: un
  `flowchart` con sus subgraphs, formas, trazos, colores y datos, o un `sequenceDiagram`.

## Cómo está hecho

| Fichero | |
|---|---|
| `graphx/hooks/register.tsx` | herramientas, `/graphx`, el panel por superficie, el render de los bloques Mermaid, la línea de estado |
| `graphx/hooks/canvas.tsx` | el lienzo del terminal (módulo `Client`): tamaños, vistas, teclado, ratón, reloj de las animaciones |
| `graphx/hooks/term/` | `caps` (detección), `paint` (color por profundidad), `glyphs`, `grid` (rejilla de celdas con aristas por bits y braille), `graph` (grafo, formas, efectos), `seq`, `lists` (árbol y esquema), `detail` (panel y bloques), `charts`, `snapshot` |
| `graphx/hooks/catalog.ts` | el mapa de capacidades y la chuleta |
| `graphx/server/engine.mjs` | el motor en jsdom: la escena, los layouts en celdas (ELK), el detalle, la conversión, los diagramas en línea |
| `graphx/server/svgout.mjs` | tokens por tema y piel (cascada CSS), SVG autocontenido, PNG, foto en medios bloques |
| `graphx/server/mermaid-out.mjs` | anotaciones de Mermaid y GraphX → Mermaid |
| `graphx/server/live.mjs` | el servidor HTTP local (token por sesión; se va con su proceso padre) |
| `graphx/viewer/` | el visor del navegador |

## Desarrollo

```sh
npm run mod:test                                            # claude plugin validate + claude plugin test
node mod/tools/term-preview.mjs examples/fx/software.json --cols 140 --rows 40 --keys "+,tab,b" --png /tmp/f.png
node mod/tools/term-preview.mjs examples/mermaid/gantt.mmd --cols 80 --rows 24 --color 16 --glyphs ascii
node mod/tools/gen-fixtures.mjs                             # las escenas de verdad que usan las pruebas
```

`term-preview` monta el lienzo con una superficie simulada y pinta sus fotogramas en ANSI (o en PNG, para revisarlos
como imagen) a cualquier tamaño, color, juego de caracteres y tema, con teclas, clics y tiempo.
