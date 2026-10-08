<div align="center">

# GraphX

### Diagramas que se mueven con sus datos

**Un JSON (o un bloque de Mermaid) → una página navegable, animada y autocontenida.**
Sin servidor, sin paso de compilación, sin framework. Funciona como fichero local, como artifact de claude.ai o como bloque dentro de cualquier web.

![versión](https://img.shields.io/badge/versión-1.9.0-0b7480)
![mermaid](https://img.shields.io/badge/Mermaid-19%20tipos-ff3670)
![formas](https://img.shields.io/badge/formas-61-3cc4cf)
![efectos](https://img.shields.io/badge/efectos-29%20KB%20gzip-b45309)
![dependencias](https://img.shields.io/badge/dependencias-solo%20ELK-142120)

[English](README.md) · **Español**

### [▶ Demo en vivo](docs/demo/es/index.html) · [Live demo in English](docs/demo/index.html)

<sub>Descarga y abre el HTML, o publica <code>docs/</code> con GitHub Pages: la demo queda en <code>/demo/es/</code>.</sub>

![El checkout de una tienda, hora a hora: calor, partículas y una línea de tiempo desde una tabla TSV](docs/gif/es/software.gif)

</div>

---

## Por qué GraphX

Los diagramas de arquitectura envejecen porque son dibujos. Los de GraphX son **datos**: servicios, equipos,
latencias, caudales, incidentes y despliegues van en el JSON, y el diagrama los dibuja, los anima y deja que quien
lo lee los explore.

| | |
|---|---|
| 🧭 **Navegable** | layout jerárquico con ELK, niveles que se abren en su sitio, búsqueda, trazado de dependencias, recorrido guiado y modo presentación |
| 🌊 **Vivo** | partículas por caudal, mapas de calor, sparklines, anillos de progreso, alertas y `setData()` para datos en vivo |
| ⏱ **Con tiempo** | una línea de tiempo desde cualquier tabla TSV/CSV: recorre un día de tráfico y mira cómo ocurre el incidente |
| 💥 **Con impacto** | radio de impacto: qué deja de funcionar si esta pieza falla, salto a salto |
| 🧜 **Compatible con Mermaid** | los 19 tipos de diagrama de Mermaid, convertidos sin Mermaid, con datos ricos opcionales en `@{…}` y `%% @gx` |
| ⚛️ **Listo para React** | cada forma es una función pura, con componentes de React que dibujan exactamente lo mismo que el motor |
| 🎛 **Configurable** | cada efecto se enciende o se apaga con `fx`; `fx: false` es el diagrama de siempre, tal cual |
| 📦 **Portable** | un solo `<script>`; no pide al navegador más que SVG; funciona sin red con el bundle completo |

## El showcase

La [demo en vivo](docs/demo/es/index.html) lo reúne todo en una página con ocho pestañas: **Software** (un mapa de
servicios con su día de tráfico), **Casos de uso** (diez ejemplos reales), **Diagramas** (Mermaid frente a GraphX),
**Piezas**, **Formas**, **Árbol**, **En vivo** y una **Guía** de cada asset y cada efecto.

### Los 19 tipos de Mermaid, al lado de Mermaid

Pega cualquier diagrama de Mermaid y GraphX lo convierte, con sus formas, notas, fronteras y puntas de flecha; un
`pie` se convierte en un donut vivo. Cambia los colores del tema o de cada tipo de pieza mientras miras.

![Diagramas de Mermaid dibujados por GraphX junto a Mermaid](docs/gif/es/diagramas.gif)

### Efectos y pieles, a un clic

El mismo diagrama con `fx: false` y con los presets `vivid`, `neon`, `blueprint` y `glass`.

![El mismo diagrama de Mermaid con y sin efectos, en cuatro presets](docs/gif/es/efectos.gif)

### Datos en vivo e incidentes

`setData()` cada segundo y medio: las partículas aceleran con el caudal, los colores siguen la latencia p95 y los
KPI cuentan hasta su valor. Provoca un incidente y el mapa traza lo que depende del servicio que falla.

![Una plataforma de pagos recibiendo datos en vivo y un incidente](docs/gif/es/vivo.gif)

<table>
<tr>
<td width="50%">

**Radio de impacto.** Un clic en el panel: anillos por salto, qué se rompe y a qué equipos llamar.

![Radio de impacto de un servicio que falla](docs/gif/es/impacto.gif)

</td>
<td width="50%">

**Árboles de ficheros.** Un repositorio con el diff de la rama, filtrado mientras escribes.

![Un repositorio como árbol de ficheros navegable](docs/gif/es/arbol.gif)

</td>
</tr>
</table>

### Cada forma, en el motor y en React

61 formas (flowchart, C4, tablas de ER y UML, commits de git, barras de gantt, tickets de kanban, KPI, gauge,
donut, ficheros y carpetas…) y 12 puntas de arista, dibujadas por `GraphXShape` desde el mismo árbol SVG que usa
el motor.

![El catálogo de formas en React](docs/gif/es/formas.gif)

### También en Claude Code

La carpeta [`mod/`](mod/README.md) es un plugin de Claude Code que dibuja cualquier diagrama de GraphX dentro de
la sesión: Claude dibuja con herramientas y tú lo navegas con el teclado y el ratón. En el terminal vuelve a
colocar el grafo en celdas a cualquier tamaño (tarjetas, fichas, compacto, vista general o esquema), detecta la
profundidad de color, los caracteres y el tema, anima los efectos y presenta el recorrido paso a paso con sus
explicaciones.

![Una presentación guiada de un mapa de servicios en el terminal de Claude Code](mod/docs/gif/presentacion.gif)

## Empezar en un minuto

```bash
node graphx-build.mjs examples/onboarding-proceso.json --out /tmp/onboarding.html
open /tmp/onboarding.html
```

El ensamblador valida antes de escribir (ids duplicados, extremos que no existen, colores no válidos, enlaces
inseguros…) y acepta `.json`, `.mmd` y Markdown con un bloque ` ```mermaid `. Con `--strict` los avisos también
fallan, `--mode lite` carga ELK de un CDN (≈135 KB con gzip) y `--lang en` genera los textos en inglés.

### El diagrama más pequeño

```json
{
  "title": "Checkout",
  "nodes": [
    { "id": "web", "label": "Tienda web", "kind": "ui", "summary": "Donde los clientes hacen sus pedidos." },
    { "id": "api", "label": "API de pedidos", "kind": "service", "summary": "Crea y valora los pedidos.",
      "heat": 212, "spark": [180, 190, 240, 212] },
    { "id": "db", "label": "PostgreSQL", "kind": "datastore", "summary": "Pedidos y clientes.", "owner": "datos" }
  ],
  "edges": [
    { "id": "e1", "from": "web", "to": "api", "kind": "http", "rate": 900 },
    { "id": "e2", "from": "api", "to": "db", "kind": "data" }
  ],
  "fx": "vivid"
}
```

### Desde Mermaid, con datos

Sigue siendo Mermaid válido: Mermaid ignora las claves de más y los comentarios `%% @gx`.

```mermaid
flowchart LR
  usuario([Usuario]) e1@--> buscador{{API de búsqueda}}
  buscador@{ heat: 85, spark: "40 52 61 58 70", owner: busqueda }
  buscador --> cache((Redis))
  e1@{ rate: 900, speed: fast }
  %% @gx buscador { "blocks": [ { "type": "callout", "tone": "warn", "text": "p95 por encima de **80 ms**" } ] }
```

### En una página

```html
<script src="dist/graphx.bundle.min.js"></script>
<div data-gx data-height="640" data-fx="vivid">
  <script type="application/json" class="gx-spec">{ …el JSON… }</script>
</div>
```

```js
const g = GraphX.mount(el, spec, { fx: 'neon', lang: 'es' });   // o GraphX.mountMermaid(el, texto)
g.setData({ nodes: { api: { heat: 480, alert: 'crit' } }, edges: { e1: { rate: 240 } } });
g.timeline.seek('13:00'); g.blast('api'); g.filterOwners(['datos']);
```

### En React

```jsx
const { GraphX, GraphXShape } = GraphXReactFactory(React, () => window.GraphX);
<GraphX mermaid={texto} fx="glass" lang="es" />
<GraphXShape node={{ shape: 'gauge', label: 'CPU', value: 72, unit: '%', thresholds: [70, 90] }} />
```

## Qué trae

| Fichero | Qué es | Peso (gzip) |
|---|---|---|
| `dist/graphx.bundle.min.js` | todo en un `<script>`, ELK incluido, funciona sin red | 1,8 MB (564 KB) |
| `dist/graphx.lite.min.js` | lo mismo sin ELK, que se carga de jsDelivr la primera vez | 396 KB (135 KB) |
| `dist/graphx-fx.min.js` | el módulo de efectos suelto (los bundles ya lo llevan) | 87 KB (29 KB) |
| `graphx.js` · `graphx.css` | el motor y su tema por tokens (claro y oscuro) | |
| `graphx-mermaid.js` | conversor de Mermaid → JSON de GraphX, sin depender de Mermaid | |
| `graphx-shapes.js` · `graphx-layouts.js` · `graphx-tree.js` | formas, layouts propios (gantt, git, sankey, treemap…) y árboles de ficheros | |
| `graphx-fx.js` | efectos, datos en vivo, línea de tiempo, impacto, equipos y bloques ricos del panel | |
| `react/` | componentes de React sobre las mismas formas | |
| `graphx-build.mjs` | valida y genera una página autocontenida | |
| `examples/` · `examples/en/` | todos los ejemplos, en castellano y en inglés | |
| `mod/` | el plugin de Claude Code: terminal, escritorio y navegador ([mod/README.md](mod/README.md)) | |

## Documentación

| | |
|---|---|
| [docs/referencia.md](docs/referencia.md) | el JSON campo a campo, la API y las herramientas |
| [docs/catalogo.md](docs/catalogo.md) | cada asset por familia: tarjetas, formas, gráficos, contenedores, aristas, iconos, bloques, layouts y color |
| [docs/efectos.md](docs/efectos.md) | los efectos, clasificados por lo que hacen, con recetas |
| [docs/demo.md](docs/demo.md) · [docs/ejemplos.md](docs/ejemplos.md) | el showcase pestaña a pestaña y cada ejemplo |

## Desarrollo

```bash
node tools/build-dist.mjs                                   # regenera dist/
node tools/verify.mjs && node tools/verify-mermaid.mjs      # pruebas sin navegador (jsdom)
node tools/verify-shapes.mjs && node tools/verify-tree.mjs && node tools/verify-fx.mjs
node examples/fx/build.mjs docs/demo/es/index.html --standalone --lang es   # regenera la demo
node tools/capture-gifs.mjs                                 # vuelve a grabar los GIF (Playwright + ffmpeg)
node mod/tools/capture-media.mjs                            # vuelve a grabar las capturas del mod de Claude Code (ffmpeg)
```

La página en inglés sale de la misma plantilla: `examples/fx/showcase.en.txt` guarda las traducciones y el build
falla si queda castellano en la página.

<sub>Construido en septiembre de 2026 junto a la skill `pr-review-artifact-v5`. ELK es EPL-2.0 (https://eclipse.dev/elk).</sub>
