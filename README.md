<div align="center">

# GraphX

### Diagrams that move with their data

**One JSON (or one Mermaid block) → one self-contained, navigable, animated page.**
No server, no build step, no framework. It runs as a local file, a claude.ai artifact or a block inside any web page.

![version](https://img.shields.io/badge/version-1.9.0-0b7480)
![mermaid](https://img.shields.io/badge/Mermaid-19%20diagram%20types-ff3670)
![shapes](https://img.shields.io/badge/shapes-61-3cc4cf)
![effects](https://img.shields.io/badge/effects-29%20KB%20gzip-b45309)
![deps](https://img.shields.io/badge/runtime%20deps-ELK%20only-142120)
![claude code](https://img.shields.io/badge/Claude%20Code-mod-d97757)

**English** · [Español](README.es.md)

### [▶ Live demo](docs/demo/index.html) · [Demo en español](docs/demo/es/index.html)

<sub>Download and open the HTML file, or serve <code>docs/</code> with GitHub Pages: the demo lives at <code>/demo/</code>.</sub>

![An online store's checkout, hour by hour: heat, particles and a timeline built from a TSV table](docs/gif/en/software.gif)

</div>

Architecture diagrams go stale because they are pictures. GraphX diagrams are **data**: services, teams, latency,
throughput, incidents and deploys go in the JSON, and the diagram draws them, animates them and lets the reader
explore them.

<table>
<tr>
<td width="33%" valign="top">
<img src="docs/gif/en/diagramas.gif" alt="Mermaid diagrams drawn by GraphX next to Mermaid itself"><br>
<b>🧜 All 19 Mermaid types</b><br>
<sub>converted without Mermaid, with their shapes, notes and boundaries</sub>
</td>
<td width="33%" valign="top">
<img src="docs/gif/en/efectos.gif" alt="The same diagram with and without effects, across four presets"><br>
<b>✨ Effects and skins</b><br>
<sub><code>vivid</code>, <code>neon</code>, <code>blueprint</code>, <code>glass</code>… or <code>fx: false</code></sub>
</td>
<td width="33%" valign="top">
<img src="docs/gif/en/vivo.gif" alt="A payments platform receiving live data and an incident"><br>
<b>🌊 Live data</b><br>
<sub><code>setData()</code>: throughput, heat, KPIs and incidents</sub>
</td>
</tr>
<tr>
<td width="33%" valign="top">
<img src="docs/gif/en/impacto.gif" alt="Blast radius of a failing service"><br>
<b>💥 Blast radius</b><br>
<sub>what breaks, hop by hop, and which teams to call</sub>
</td>
<td width="33%" valign="top">
<img src="docs/gif/en/arbol.gif" alt="A repository as a navigable file tree"><br>
<b>🗂 File trees</b><br>
<sub>a repository with the branch's diff</sub>
</td>
<td width="33%" valign="top">
<img src="mod/docs/gif/presentacion.gif" alt="A guided presentation in Claude Code's terminal"><br>
<b>🤖 In Claude Code</b><br>
<sub>the same diagram in the terminal, step by step</sub>
</td>
</tr>
</table>

```bash
node graphx-build.mjs examples/onboarding-proceso.json --out /tmp/onboarding.html && open /tmp/onboarding.html
```

---

<details>
<summary><h3>🧭 Why GraphX</h3></summary>

| | |
|---|---|
| 🧭 **Navigable** | hierarchical ELK layout, levels that open in place, search, dependency tracing, a guided tour and presentation mode |
| 🌊 **Alive** | particles by throughput, heat maps, sparklines, progress rings, alerts, and `setData()` for live updates |
| ⏱ **Time-aware** | a timeline from any TSV/CSV table: scrub through a day of traffic and watch the incident happen |
| 💥 **Impact-aware** | blast radius: what stops working if this node fails, hop by hop |
| 🧜 **Mermaid-compatible** | all 19 Mermaid diagram types, converted without Mermaid, with optional rich data in `@{…}` and `%% @gx` |
| ⚛️ **React-ready** | every shape as a pure function, with React components that draw exactly what the engine draws |
| 🎛 **Configurable** | every effect switches on or off with `fx`; `fx: false` is the plain diagram, byte for byte |
| 📦 **Portable** | one `<script>`; no browser requirements beyond SVG; works offline with the full bundle |

The [live demo](docs/demo/index.html) puts everything on one page, in nine tabs: **Software**, **Use cases**,
**Diagrams**, **Nodes**, **Shapes**, **File tree**, **Atlas** (one system seen from several perspectives, with shared
nodes), **Live** and a **Guide** to every asset and effect.

<img src="docs/img/demo-portada.webp" alt="The demo's landing page">

</details>

<details>
<summary><h3>🧜 All 19 Mermaid types, side by side with Mermaid</h3></summary>

Paste any Mermaid diagram and GraphX converts it, with the same shapes, notes, boundaries and arrowheads; a `pie`
becomes a live donut. Recolor the theme or each node kind while you watch.

![Mermaid diagrams drawn by GraphX next to Mermaid itself](docs/gif/en/diagramas.gif)

<table>
<tr>
<td width="50%"><img src="docs/img/cat-secuencia.webp" alt="Sequence"><br><sub><b>sequenceDiagram</b> with boxes, notes and blocks</sub></td>
<td width="50%"><img src="docs/img/cat-clases.webp" alt="Class diagram"><br><sub><b>classDiagram</b> with members and UML relations</sub></td>
</tr>
<tr>
<td><img src="docs/img/cat-er.webp" alt="Entity-relationship diagram"><br><sub><b>erDiagram</b> with cardinalities</sub></td>
<td><img src="docs/img/cat-gantt.webp" alt="Gantt"><br><sub><b>gantt</b> with milestones and today's line</sub></td>
</tr>
<tr>
<td><img src="docs/img/cat-git.webp" alt="gitGraph"><br><sub><b>gitGraph</b> with branches, merges and tags</sub></td>
<td><img src="docs/img/cat-sankey.webp" alt="Sankey"><br><sub><b>sankey</b> with proportional flows</sub></td>
</tr>
<tr>
<td><img src="docs/img/cat-treemap.webp" alt="Treemap"><br><sub>nested <b>treemap</b></sub></td>
<td><img src="docs/img/cat-formas-flujo.webp" alt="The shapes of a Mermaid flowchart"><br><sub>the <b>flowchart</b> shapes</sub></td>
</tr>
</table>

Still valid Mermaid: Mermaid ignores the extra keys and the `%% @gx` comments.

```mermaid
flowchart LR
  user([User]) e1@--> search{{Search API}}
  search@{ heat: 85, spark: "40 52 61 58 70", owner: search }
  search --> cache((Redis))
  e1@{ rate: 900, speed: fast }
  %% @gx search { "blocks": [ { "type": "callout", "tone": "warn", "text": "p95 above **80 ms**" } ] }
```

</details>

<details>
<summary><h3>✨ Effects and skins, one switch away</h3></summary>

The same diagram with `fx: false` and with the `vivid`, `neon`, `blueprint` and `glass` presets. Every effect
switches on or off on its own; [docs/efectos.md](docs/efectos.md) sorts them by what they do, with recipes.

![The same Mermaid diagram with and without effects, across four presets](docs/gif/en/efectos.gif)

<table>
<tr>
<td width="33%"><img src="docs/img/fx-piel-neon.webp" alt="neon"><br><sub><b>neon</b></sub></td>
<td width="33%"><img src="docs/img/fx-piel-blueprint.webp" alt="blueprint"><br><sub><b>blueprint</b></sub></td>
<td width="33%"><img src="docs/img/fx-piel-glass.webp" alt="glass"><br><sub><b>glass</b></sub></td>
</tr>
<tr>
<td><img src="docs/img/fx-particulas.webp" alt="Particles by throughput, dark theme"><br><sub>particles by throughput</sub></td>
<td><img src="docs/img/fx-calor-tarjetas.webp" alt="Heat, series, progress, alert and team on the cards"><br><sub>heat, series, progress and alerts</sub></td>
<td><img src="docs/img/fx-trazo-mano.webp" alt="Hand-drawn look with Mermaid's forest theme"><br><sub>hand-drawn look</sub></td>
</tr>
<tr>
<td><img src="docs/img/fx-ondas.webp" alt="Tracing the gateway's dependencies"><br><sub>ripples while tracing dependencies</sub></td>
<td><img src="docs/img/fx-flujo.webp" alt="A flow halfway through"><br><sub>▶ step-by-step flow</sub></td>
<td><img src="docs/img/fx-foco.webp" alt="Focus on Checkout"><br><sub>focus on one node</sub></td>
</tr>
</table>

<img src="docs/img/fx-zoom-semantico.webp" alt="Semantic zoom on a 73-node pull request"><br>
<sub>semantic zoom on a 73-node pull request</sub>

</details>

<details>
<summary><h3>🌊 Live data, time and incidents</h3></summary>

`setData()` every second and a half: particles speed up with throughput, colors follow p95 latency and the KPIs
count up. Trigger an incident and the map traces what depends on the failing service.

![A payments platform receiving live data and an incident](docs/gif/en/vivo.gif)

The timeline comes from any TSV or CSV table: scrub through a day of traffic and watch the incident arrive.

<img src="docs/img/demo-tiempo.webp" alt="The timeline at the 13:00 incident">

```js
const g = GraphX.mount(el, spec, { fx: 'neon', lang: 'en' });
g.setData({ nodes: { api: { heat: 480, alert: 'crit' } }, edges: { e1: { rate: 240 } } });
g.timeline.seek('13:00'); g.blast('api'); g.filterOwners(['data']);
```

</details>

<details>
<summary><h3>💥 Blast radius, teams and panels</h3></summary>

One click in the panel: rings per hop, what breaks, which teams to call. Teams filter the map, and each node's
panel carries rich blocks: metrics, callouts, tables, links and its neighbourhood.

![Blast radius of a failing service](docs/gif/en/impacto.gif)

<table>
<tr>
<td width="50%"><img src="docs/img/demo-impacto.webp" alt="The blast radius of the fraud service"><br><sub>the blast radius of the fraud service</sub></td>
<td width="50%"><img src="docs/img/demo-equipos.webp" alt="Filtering by one team"><br><sub>filtering by one team</sub></td>
</tr>
<tr>
<td><img src="docs/img/demo-bloques.webp" alt="The panel's blocks"><br><sub>the panel's blocks</sub></td>
<td><img src="docs/img/demo-arbol.webp" alt="The repository as a tree"><br><sub>a repository as a tree, with its diff</sub></td>
</tr>
</table>

</details>

<details>
<summary><h3>🧩 61 shapes, in the engine and in React</h3></summary>

Flowchart, C4, ER and UML tables, git commits, gantt bars, kanban tickets, KPI, gauge, donut, files and folders…
plus 12 arrowheads, drawn by `GraphXShape` from the same SVG tree the engine uses.

![The shape catalog in React](docs/gif/en/formas.gif)

<table>
<tr>
<td width="50%"><img src="docs/img/cat-formas-datos.webp" alt="Shapes with series, progress, heat and team"><br><sub>shapes with data</sub></td>
<td width="50%"><img src="docs/img/cat-graficos.webp" alt="KPI, gauge and donut"><br><sub>KPI, gauge and donut</sub></td>
</tr>
</table>

```jsx
const { GraphX, GraphXShape } = GraphXReactFactory(React, () => window.GraphX);
<GraphX mermaid={text} fx="glass" lang="en" />
<GraphXShape node={{ shape: 'gauge', label: 'CPU', value: 72, unit: '%', thresholds: [70, 90] }} />
```

</details>

<details>
<summary><h3>🗂 Ten real use cases</h3></summary>

They all live in [`examples/`](examples) (in English in `examples/en/`); [docs/ejemplos.md](docs/ejemplos.md)
walks through each one.

<table>
<tr>
<td width="50%"><img src="docs/img/ej-software.webp" alt="A store's checkout"><br><sub><b>A store's checkout</b> with its day of traffic</sub></td>
<td width="50%"><img src="docs/img/ej-plataforma-viva.webp" alt="Payments platform"><br><sub><b>A payments platform</b>, live</sub></td>
</tr>
<tr>
<td><img src="docs/img/ej-postmortem.webp" alt="Postmortem at 10:50"><br><sub><b>Postmortem</b> at 10:50</sub></td>
<td><img src="docs/img/ej-pipeline.webp" alt="The nightly load at 03:40"><br><sub><b>Data pipeline</b>: the nightly load</sub></td>
</tr>
<tr>
<td><img src="docs/img/ej-kubernetes.webp" alt="The cluster at pod level"><br><sub><b>Kubernetes</b> at pod level</sub></td>
<td><img src="docs/img/ej-ci-cd.webp" alt="CI/CD"><br><sub><b>CI/CD</b></sub></td>
</tr>
<tr>
<td><img src="docs/img/ej-pr-review.webp" alt="Reviewing a pull request"><br><sub><b>Reviewing a pull request</b></sub></td>
<td><img src="docs/img/ej-radar.webp" alt="PR radar"><br><sub><b>PR radar</b></sub></td>
</tr>
<tr>
<td><img src="docs/img/ej-almacen.webp" alt="Warehouse"><br><sub><b>Warehouse</b></sub></td>
<td><img src="docs/img/ej-onboarding.webp" alt="Onboarding"><br><sub><b>Onboarding</b> a new hire</sub></td>
</tr>
</table>

</details>

<details open>
<summary><h3>📦 Install in Claude Code</h3></summary>

```bash
git clone https://github.com/Sendery/graphx.git && cd graphx
node install.mjs
```

The installer asks with checkboxes (↑ ↓ move · space toggle · `a` all · ⏎ install) what to put into
`~/.claude` (or `$CLAUDE_CONFIG_DIR`):

| | What it installs | Where | Use it with |
|---|---|---|---|
| **Skill** `graphx` | teaches Claude to draw and explain with diagrams: when to use which type, guided tours, signs, live data | `~/.claude/skills/graphx` | `/graphx <what you want drawn>` · `/graphx help` |
| **Mod for the terminal** `graphx-mod` | the plugin: the character canvas in the panel, the browser viewer, the `mcp__graphx-mod__*` tools and Mermaid blocks drawn in the transcript | `~/.claude/skills/graphx-mod` | `/graphx-mod` · `/graphx-mod help` · `/graphx-mod open` |
| **Mod for the desktop app** | the same mod, plus the absolute path to `node` (an app launched from the Dock does not inherit your shell's `PATH`) | `~/.claude/skills/graphx-mod/node-path` | restart Claude Desktop |

The skill and the mod are separate on purpose: `/graphx` is the skill (ask in plain language), `/graphx-mod` is the
mod (the canvas, its commands and keys). Each has its own `help`. The skill works without the mod (it falls back to
plain Mermaid blocks); the mod works without the skill (Claude learns it from the tool descriptions), but together
they are best.

Without questions: `node install.mjs --skill --terminal --desktop` (or `--all`, `--yes` for the preselection),
`--uninstall` to remove, `--dry-run` to preview and `--lang es|en`. It needs `node` ≥ 18; it runs `npm install` and
builds `dist/` if they are missing. Optional: `rsvg-convert` (librsvg) for the engine image in kitty/Ghostty/WezTerm and
for screenshots.

**Language.** Every button, message and help of the mod is in English and Spanish: it follows the mod's `language`
option (`/config`), else Claude Code's `language` setting, else `LANG`, and defaults to English.
`/graphx-mod caps lang=en` switches it for the session.

</details>

<details>
<summary><h3>🤖 In Claude Code, too</h3></summary>

The [`mod/`](mod/README.md) folder is a Claude Code plugin (`graphx-mod`, installed with `node install.mjs`) that draws any GraphX diagram inside the session:
Claude draws with tools, and you navigate with the keyboard and the mouse. In the terminal it redraws the graph
in character cells at any size (cards, chips, compact, overview or an outline), detects color depth, glyph set
and theme, plays the effects, and runs the guided tour step by step with its explanations.

![A guided presentation of a service map inside Claude Code's terminal](mod/docs/gif/presentacion.gif)

<table>
<tr>
<td width="50%"><img src="mod/docs/gif/zoom.gif" alt="Semantic zoom in the terminal"><br><sub>semantic zoom: cards, chips and overview</sub></td>
<td width="50%"><img src="mod/docs/gif/impacto.gif" alt="Blast radius in the terminal"><br><sub>✺ blast radius and tracing</sub></td>
</tr>
</table>

<img src="mod/docs/img/mermaid.png" alt="Twelve Mermaid types in the terminal"><br>
<sub>twelve Mermaid types in the terminal · <a href="mod/README.md">the whole mod →</a></sub>

</details>

<details>
<summary><h3>🚀 Quick start</h3></summary>

```bash
node graphx-build.mjs examples/onboarding-proceso.json --out /tmp/onboarding.html
open /tmp/onboarding.html
```

The builder validates before it writes (duplicate ids, missing endpoints, invalid colors, unsafe links…) and
accepts `.json`, `.mmd` and Markdown with a ` ```mermaid ` block. Use `--strict` to fail on warnings,
`--mode lite` to load ELK from a CDN (≈135 KB gzipped) and `--lang en` for English text.

**The smallest diagram**

```json
{
  "title": "Checkout",
  "nodes": [
    { "id": "web", "label": "Web store", "kind": "ui", "summary": "Where customers place orders." },
    { "id": "api", "label": "Orders API", "kind": "service", "summary": "Creates and prices orders.",
      "heat": 212, "spark": [180, 190, 240, 212] },
    { "id": "db", "label": "PostgreSQL", "kind": "datastore", "summary": "Orders and customers.", "owner": "data" }
  ],
  "edges": [
    { "id": "e1", "from": "web", "to": "api", "kind": "http", "rate": 900 },
    { "id": "e2", "from": "api", "to": "db", "kind": "data" }
  ],
  "fx": "vivid"
}
```

**In a page**

```html
<script src="dist/graphx.bundle.min.js"></script>
<div data-gx data-height="640" data-fx="vivid">
  <script type="application/json" class="gx-spec">{ …the JSON… }</script>
</div>
```

```js
const g = GraphX.mount(el, spec, { fx: 'neon', lang: 'en' });   // or GraphX.mountMermaid(el, text)
```

</details>

<details>
<summary><h3>📦 What's in the box</h3></summary>

| File | What it is | Size (gzip) |
|---|---|---|
| `dist/graphx.bundle.min.js` | everything in one `<script>`, ELK included, works offline | 1.8 MB (564 KB) |
| `dist/graphx.lite.min.js` | the same without ELK, loaded from jsDelivr on first use | 396 KB (135 KB) |
| `dist/graphx-fx.min.js` | the effects module alone (the bundles already include it) | 87 KB (29 KB) |
| `graphx.js` · `graphx.css` | the engine and its token-based theme (light and dark) | |
| `graphx-mermaid.js` | Mermaid → GraphX JSON converter, no Mermaid dependency | |
| `graphx-shapes.js` · `graphx-layouts.js` · `graphx-tree.js` | shapes, built-in layouts (gantt, git, sankey, treemap…) and file trees | |
| `graphx-fx.js` | effects, live data, timeline, blast radius, teams and rich panel blocks | |
| `react/` | React components over the same shapes | |
| `graphx-build.mjs` | validates and emits a self-contained page | |
| `examples/` · `examples/en/` | every example, in Spanish and in English | |
| `mod/` | the Claude Code mod `graphx-mod`: terminal, desktop and browser ([mod/README.md](mod/README.md)) | |
| `skills/graphx/` | the Claude Code skill `graphx` | |
| `install.mjs` | the interactive installer for the skill and the mod | |

</details>

<details>
<summary><h3>📚 Documentation</h3></summary>

The full documentation is written in Spanish:

| | |
|---|---|
| [docs/referencia.md](docs/referencia.md) | the JSON field by field, the API, the tools |
| [docs/catalogo.md](docs/catalogo.md) | every asset by family: cards, shapes, charts, containers, edges, icons, blocks, layouts, color |
| [docs/efectos.md](docs/efectos.md) | the effects, classified by what they do, with recipes |
| [docs/demo.md](docs/demo.md) · [docs/ejemplos.md](docs/ejemplos.md) | the showcase tab by tab, and every example |
| [mod/README.md](mod/README.md) | the Claude Code mod |

</details>

<details>
<summary><h3>🛠 Develop</h3></summary>

```bash
node tools/build-dist.mjs                                   # rebuild dist/
node tools/verify.mjs && node tools/verify-mermaid.mjs      # tests without a browser (jsdom)
node tools/verify-shapes.mjs && node tools/verify-tree.mjs && node tools/verify-fx.mjs
node examples/fx/build.mjs docs/demo/index.html --standalone --lang en   # rebuild the live demo
node tools/capture-gifs.mjs                                 # re-record the GIFs (Playwright + ffmpeg)
node mod/tools/capture-media.mjs                            # re-record the Claude Code mod's captures (ffmpeg)
node tools/release.mjs --tag v1.9.0-rc.1                    # the classified release assets, in release/<tag>/
```

The English page is generated from the same template: `examples/fx/showcase.en.txt` holds the translations and
the build fails if any Spanish is left on the page.

</details>

<sub>Built in September 2026. ELK is EPL-2.0 (https://eclipse.dev/elk).</sub>
