---
name: graphx
description: Dibuja, explica y anima diagramas con GraphX en Claude Code (panel del terminal, app de escritorio, navegador) / Draws, explains and animates GraphX diagrams in Claude Code. Úsala cuando un dibujo explique mejor que el texto — arquitectura, flujos, dependencias, secuencias, estados, planes, el árbol de un repo, datos que cambian, un incidente, una PR — o cuando la persona pida un diagrama, un Mermaid «más rico» o ver algo «en el lienzo» / "on the canvas". `/graphx help` enseña su ayuda.
argument-hint: "[help | lo que quieres dibujar · what to draw]"
---

# Diagramas con GraphX

Esta es la **skill** `graphx`: enseña a Claude a dibujar y a explicar con diagramas de GraphX. El lienzo lo pone el
**mod** `graphx-mod` (un plugin aparte): sus herramientas `mcp__graphx-mod__*` dibujan con el motor y lo enseñan en el
panel del terminal (caracteres, color, braille y efectos, a cualquier tamaño), en la app de escritorio (SVG) y en el
navegador (`/graphx-mod open`).

Responde en el idioma de la persona y pasa `lang: "es"` o `lang: "en"` a `show`: lo que genera el motor lo sigue.

## Argumentos

- **`help`**, `ayuda` o `?` → no dibujes: responde solo con la ayuda de abajo, en su idioma.
- **Cualquier otro texto** → es lo que quiere dibujar o entender.
- **Nada** → ofrece en pocas líneas qué podrías dibujar de lo que tiene delante (y qué lo haría más útil: datos,
  equipos, un recorrido) y pregunta.
- **Un subcomando del mod** (`open`, `present`, `last`, `demo`, `caps`, `fx`, `export`, `clear`, `stop`, `image`,
  `cells`) → es `/graphx-mod <subcomando>`; dilo y, si se puede con las herramientas, hazlo (`open` → la URL que da
  `view` con `image: false`; `present` → `guide` con `present: true`; `export` → `export`).
- **Una pregunta desde el lienzo**: el prompt empieza por «Sobre «X» (`id`) en el diagrama de GraphX…» o «About “X”
  (`id`) in the GraphX diagram…». Responde y señala en el lienzo: `guide` con `select`/`focus` en ese id, y `signs` si
  hay algo que dejar escrito.

### La ayuda (`/graphx help`)

```
GraphX · la skill (graphx): pídele a Claude diagramas en lenguaje normal
  /graphx <lo que quieres>   «la arquitectura de este repo», «explícame el login paso a paso»,
                              «el árbol del último commit», «el incidente de ayer, hora a hora»
  /graphx help               esta ayuda
Qué sabe hacer: grafos con carriles y niveles plegables, 18 tipos de Mermaid, árboles de ficheros y diffs,
recorridos guiados y presentación, carteles, datos en vivo (calor, series, alertas, caudal, indicadores),
línea de tiempo, radio de impacto, equipos y efectos para presentar. Y Mermaid enriquecido que sigue siendo Mermaid.
El lienzo es del mod graphx-mod: /graphx-mod abre el panel, /graphx-mod open el navegador,
/graphx-mod help sus comandos y teclas.
```

```
GraphX · the skill (graphx): ask Claude for diagrams in plain language
  /graphx <what you want>    "this repo's architecture", "walk me through the login step by step",
                              "the tree of the last commit", "yesterday's incident, hour by hour"
  /graphx help               this help
What it can do: graphs with lanes and collapsible levels, 18 Mermaid types, file trees and diffs,
guided tours and presentations, signs, live data (heat, series, alerts, flow rate, indicators),
a timeline, blast radius, teams and presentation effects. And enriched Mermaid that is still Mermaid.
The canvas belongs to the graphx-mod mod: /graphx-mod opens the panel, /graphx-mod open the browser,
/graphx-mod help lists its commands and keys.
```

Si no hay herramientas `mcp__graphx-mod__*`, añade una línea: el mod no está instalado; se instala con
`node install.mjs` desde el repositorio de GraphX (casilla «mod»).

## Cómo trabajar

1. **Entiende la pregunta antes que el dibujo.** ¿Qué tiene que poder contestar quien lo mire? (cómo está hecho, en
   qué orden pasa, qué falla, quién es dueño, qué cambió). Eso elige el tipo y lo que merece enriquecerse; lo demás
   sobra. Si la persona ya pidió una forma concreta, esa manda.
2. **Elige la forma.** Grafo de GraphX para arquitectura y dependencias (carriles, niveles plegables, datos);
   `sequenceDiagram` o `flows` para «quién llama a quién y en qué orden»; `stateDiagram` para ciclos de vida; `gantt`
   para planes; `paths` para un repo o un diff; el resto de Mermaid para lo suyo. `capabilities` lo resume con lo que
   sabe pintar este terminal. Para ideas: [patrones](references/patrones.md) (recetas, no obligatorias).
3. **Dibuja** con `show` (`spec`, `mermaid`, `paths`, `tree_text` o `file`). Etiquetas de ≤ 24 caracteres y un
   `summary` en cada pieza: en el terminal cada caja mide lo que su texto. Si parte de un Mermaid de la persona,
   **respeta su Mermaid** y enriquécelo según [las reglas de Mermaid](references/mermaid.md).
4. **Constrúyelo al hablar** con `patch` (`add`, `update`, `remove`, `set`) en vez de rehacerlo con `show`: la vista,
   los carteles y el recorrido se conservan.
5. **Guía**: `guide` con un recorrido de 3–6 pasos (cada `body`: qué pasa, qué viaja, qué lo dispara), `focus`,
   `trace`, `blast`, `flow`, `owners`, `timeline`; `present: true` para presentarlo. `signs`: pocos carteles (riesgos,
   decisiones, preguntas).
6. **Datos**: `data` cambia calor, series, progreso, alertas, valores y caudal en vivo sin recolocar. Qué hay y en qué
   formato: [capacidades](references/capacidades.md).
7. **Comprueba** con `view` (`text: true`: el panel del terminal tal como lo ve la persona; la imagen: el motor).
8. **Cierra** con una línea: `/graphx-mod` reabre el panel (le da el teclado; `Esc` lo devuelve) y
   `/graphx-mod open` lo abre en el navegador. Si dejaste algo que la persona hace mejor con el teclado (reproducir la
   línea de tiempo `y`, «▶ Flujo» `f`, equipos `e`), díselo.

**Enriquecer sin forzar.** Los datos, los efectos y los patrones son un menú: úsalos cuando contesten la pregunta
de la persona o cuando los pida. Un diagrama claro sin efectos es mejor que uno recargado. Cuando enriquezcas, sé
honesto con los datos: no inventes cifras; si son ilustrativas, dilo en el `summary` o en un cartel.

## Sin el mod

No inventes las herramientas. Dos salidas, en este orden:

- **Un bloque ```` ```mermaid ````** enriquecido según [las reglas](references/mermaid.md): es Mermaid válido en
  cualquier sitio y, con el mod, se dibuja con GraphX en el transcript.
- **Una página navegable** si el repositorio de GraphX está en disco (`graphx-build.mjs`): escribe el spec (o el
  `.mmd`) y `node graphx-build.mjs <fichero> --out <página>.html` da una página autocontenida (publicable como
  Artifact).

Di en una línea que con `graphx-mod` se vería en el lienzo, con recorrido y efectos.

## Referencias

- [references/mermaid.md](references/mermaid.md) — **cómo enriquecer un Mermaid**: qué va en `id@{…}`, qué en
  `%% @gx`, en qué tipos funciona cada cosa y los errores típicos. Léela antes de escribir Mermaid enriquecido.
- [references/capacidades.md](references/capacidades.md) — el catálogo: tipos, formas, aristas, bloques del panel,
  datos y efectos, navegación, con sus campos.
- [references/patrones.md](references/patrones.md) — recetas de diseño (mapa de servicios, postmortem, pipeline,
  clúster, CI/CD, proceso, revisión de PR…), un catálogo de perspectivas para documentar un sistema y el **atlas**
  (varias perspectivas del mismo sistema en una página). Inspiración para proponer, nunca un molde.
- `reference` (herramienta del mod) — la chuleta del formato JSON.
