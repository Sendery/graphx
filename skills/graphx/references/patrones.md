# Patrones de diseño

Recetas sacadas de los ejemplos del repositorio (`examples/fx/`, la demo de `docs/demo/`). Sirven para **saber qué
se puede proponer** y para no empezar de cero; no son moldes. Lo que pida la persona manda: si quiere un flowchart
sin más, es un flowchart sin más. Como mucho, ofrece en una línea lo que lo haría más útil («¿le pongo la latencia
como calor y quién es dueño de cada servicio?»).

Cada receta dice qué pregunta contesta, la forma, qué enriquecer y cómo recorrerla. Lo marcado *(opcional)* es
adorno: añádelo solo si hay datos reales o si lo piden.

## Elegir

| La persona quiere saber… | Receta |
|---|---|
| cómo está hecho un sistema, quién es dueño de qué | [Mapa de servicios](#mapa-de-servicios) |
| qué pasó en un incidente, cuándo y hasta dónde llegó | [Postmortem](#postmortem) |
| dónde se atasca un proceso por etapas | [Pipeline](#pipeline-de-datos-o-de-trabajo) |
| qué está caliente o fallando en algo con muchos niveles | [Jerarquía con calor](#jerarquía-con-calor) |
| cómo va un despliegue / CI | [CI/CD en Mermaid](#cicd-en-mermaid) |
| quién hace qué y en qué orden (sin datos) | [Proceso de negocio](#proceso-de-negocio) |
| cómo funciona una PR y en qué orden leerla | [Revisión de PR](#revisión-de-pr) |
| qué está bloqueando qué | [Radar de trabajo](#radar-de-trabajo) |
| quién llama a quién y en qué orden | [Secuencia](#secuencia) |
| qué hay en un repo o qué cambió | [Árbol](#árbol-de-ficheros) |
| documentar un sistema entero | [Perspectivas](#perspectivas-para-documentar-un-sistema) y, para juntarlas, [Atlas](#atlas-de-un-sistema) |

## Mapa de servicios

*Ejemplo: `examples/fx/software.json` (checkout de una tienda), `examples/fx/arquitectura.mmd` (lo mismo en Mermaid).*

- **Forma**: grafo con carriles por capa o por equipo (cliente, borde, servicios, datos, terceros) y dos niveles
  (`levels`: capa › servicio). Aristas en el nivel más profundo, con `kind` real (`http`, `event`, `data`…) y
  `label` corto de lo que viaja.
- **Enriquecer** *(opcional)*: `heat` = latencia p95 con `fx.heat` (`traffic`, `ms`, dominio); `rate` en las aristas
  con caudal; `owners` en la raíz y `owner` en los carriles; un carril «panel» con 3–4 indicadores (`kpi` de pedidos,
  `gauge` de presupuesto de error, `donut` de reparto); `blocks` con SLOs (`table`) y la latencia del día (`chart`).
- **Recorrer**: 3 pasos — la entrada, el camino crítico (`focus` en sus piezas y aristas, `emphasis: hero` en una), el
  riesgo (un cartel `warn`). Para «¿y si cae X?»: `guide.blast`.

## Postmortem

*Ejemplo: `examples/fx/postmortem.json`.*

- **Forma**: el grafo del camino afectado, con un carril «impacto» (lo que vio el cliente).
- **Enriquecer**: `timeline` con una fila cada pocos minutos (`<id>.heat`, `<id>.alert`, `<arista>` para el caudal) y
  `events` (el despliegue, el primer error, la mitigación, el arreglo); `alert` donde falló; `blocks`: `timeline` de
  hechos, `checklist` de acciones, `quote` de quien lo vio.
- **Recorrer**: 5 pasos — el camino normal → dónde se rompe (`guide.timeline` al instante) → hasta dónde llega
  (`blast`) → por qué empeoró → qué cambiamos. `present: true` para la reunión.

## Pipeline (de datos o de trabajo)

*Ejemplos: `examples/fx/pipeline-datos.json` (carga nocturna), `examples/fx/almacen.json` (un almacén).*

- **Forma**: grafo `right` con un carril por etapa (fuentes → ingesta → transformación → servicio), o por zona.
- **Enriquecer** *(opcional)*: `heat` = retraso o tiempo en cola (`heat` como escala: duraciones), `rate` de filas o
  pedidos, `progress` en la etapa en curso, `spark` del ritmo por hora; `timeline` en formato largo
  (`time,id,field,value`, lo que devuelve una consulta; `tools/timeline.mjs` lo monta).
- **Recorrer**: de la fuente al resultado, parando donde se acumula.

## Jerarquía con calor

*Ejemplo: `examples/fx/kubernetes.json` (namespace › deployment › pod).*

- **Forma**: grafo con 3 niveles (`levels`) e `initialDepth: 1`; aristas entre las hojas.
- **Enriquecer**: `heat` en las hojas con `fx.heat.rollup: "max"` (o `avg`/`sum`): un contenedor plegado enseña lo
  peor de dentro; `progress` para un despliegue en curso; `alert: crit` + `blocks` (`code` con el error, `steps` para
  arreglarlo) en lo que falla.
- **Recorrer**: de lo plegado a lo concreto (`depth`, `expand` en cada paso).

## CI/CD en Mermaid

*Ejemplos: `examples/fx/ci-cd.mmd`, `examples/fx/despliegue.mmd`.*

- **Forma**: `flowchart LR`, una etapa por pieza; `theme: neutral` en el frontmatter.
- **Enriquecer**: `@{ heat: <duración>, spark: "…", owner }` por etapa, `progress` en el canario, `alert: warn` en lo
  inestable; aristas con id y `@{ rate, animation: slow }`; `%% @gx etapa {"blocks": [tabla de tests, chart de
  duraciones]}`. Ver [reglas](mermaid.md).

## Proceso de negocio

*Ejemplo: `examples/onboarding-proceso.json` (alta de una persona).*

- **Forma**: grafo `down`, carriles por área (RR. HH., IT, equipo) con su color, 3 niveles (área › etapa › tarea) y un
  `flow` para «el primer día» en secuencia. Sin datos: el valor está en el orden y en los dueños.
- **Recorrer**: pasos con `depth` creciente y uno con `view: "flow:<id>"`.

## Revisión de PR

*Ejemplo: `examples/pr-review-stack-202.json` (73 piezas, 4 niveles).*

- **Forma**: grafo por capas (UI › API › dominio › datos) con 3–4 niveles; `delta: added|modified|removed` en cada
  pieza y `files` con sus líneas; raíz `links: {repo, pr}`; `flows` para los 2–3 caminos que cambian.
- **Enriquecer**: `notes` (`warn`) en lo dudoso, `metrics` (tests, cobertura); «solo cambios» sale solo con `delta`.
  Para el árbol del diff, `show.paths` con `additions`/`deletions`/`status` y `tree_options.focus: "changes"`.
- **Recorrer**: el orden de lectura — de dónde entra el cambio al dato que toca —, 6–10 pasos con `depth` y `view` de
  flujo.

## Radar de trabajo

*Ejemplo: `examples/warehouses-pr-radar.json` (PRs y tickets).*

- **Forma**: grafo con `statuses` propios (`{label, color, pulse}`), `legend.edges` para explicar los tipos de
  dependencia, `layout.lanes: "strict"`, `collapsed` para lo terminado.
- **Enriquecer**: `links` con `status` (jira, pr), `notes` para las incoherencias, `flows` para las cadenas de merge.
- **Recorrer**: «lo que necesita atención hoy».

## Secuencia

- **Forma**: `sequenceDiagram` (o `flows` en un spec, para tenerla junto al grafo de las mismas piezas).
- **Enriquecer** *(opcional)*: `%% @gx <participante> {…}` para datos y bloques (en secuencias no hay `@{}` de datos);
  `phase` para agrupar, `note` para lo que no es un mensaje, `alt`/`loop` como en Mermaid.
- **Recorrer**: `guide.flow` la abre; «▶ Reproducir» (`f`) la cuenta mensaje a mensaje.

## Árbol de ficheros

- **Forma**: `show.paths` (del diff: `git diff --numstat`) o `tree_text` (de `tree`); `tree_options.root`, `compact`.
- **Enriquecer**: `status` y líneas por fichero; `focus: "changes"` para ver solo lo cambiado.

## Perspectivas para documentar un sistema

Cuando piden «documenta la arquitectura» conviene más de un dibujo. Un catálogo de perspectivas (lentes sobre el
mismo sistema; elige las 2–4 que apliquen, no todas):

| Perspectiva | Forma | Contesta |
|---|---|---|
| Arquitectura general | grafo con carriles y niveles | qué piezas hay y cómo se hablan (siempre) |
| Ciclo de una petición | secuencia | qué pasa desde que entra hasta que sale |
| Flujo de datos | grafo `right`, aristas `data` | por dónde viaja cada dato y dónde se guarda |
| Dependencias | grafo de módulos/paquetes | qué depende de qué; el radio de impacto |
| Integraciones externas | grafo con carril «terceros» | qué sale fuera y qué pasa si falla |
| Estados | `stateDiagram` | el ciclo de vida de una entidad |
| Rutas y pantallas | grafo o árbol | qué ve el usuario y qué llama cada pantalla |
| Superficie de comandos | árbol o grafo | qué se puede invocar (CLI, API pública) |
| Almacenamiento | `erDiagram` o grafo de datastores | qué se guarda, dónde y con qué forma |

Reglas que ayudan: **5–15 piezas por nivel** (si son más, pliega en niveles o parte en otra perspectiva); **cada
arista con su porqué** (`label` o `summary`); **los mismos ids** para la misma pieza en todas las perspectivas, para
que se reconozca; en cada pieza, `summary` y, si importa, `notes` (riesgos) y `links` (dónde está el código).

## Atlas de un sistema

*Ejemplo: `examples/fx/atlas.json` (una tienda online en 5 perspectivas y 2 interiores; en inglés,
`examples/en/fx/atlas.json`). Se ve en la pestaña «Atlas» de la demo (`docs/demo/`).*

Cuando una sola imagen no contesta todo: **varias perspectivas del mismo sistema, con las piezas compartidas**. Cada
pieza tiene una ficha que dice en qué otras perspectivas aparece (y salta a ellas), qué la condiciona y qué preocupa
de ella; algunas se abren **por dentro** con su propio diagrama. Proponlo cuando piden «documenta / explícame el
sistema entero», no para una pregunta concreta (para eso, una sola receta de arriba).

- **Formato** (un JSON):
  - `entities: { id: { label, kind, owner, path, summary, inner, doc } }` — las piezas, una vez. `doc` = `{ context,
    constraints: [], risks: [], todo: [{ text, done }] }`; `inner` = el id de la perspectiva que la abre por dentro;
    `path` = dónde está su código.
  - `owners` como en cualquier spec.
  - `perspectives: [{ id, title, short, icon, question, spec | mermaid, parent?, kind?: "sequence", after?: { blast } }]`
    — cada una es un spec de GraphX (o un Mermaid con `fx`) cuyas piezas **usan los ids de `entities`**: heredan
    nombre, icono, equipo y resumen, y sus riesgos salen como notas. `parent` la cuelga de una pieza («por dentro»).
- **Elegir perspectivas**: 3–5 de la tabla de arriba, cada una con **su pregunta** (`question`) y **su efecto**
  (arquitectura con calor y partículas; secuencia con `present`; datos con línea de tiempo; impacto con `neon` y
  `after.blast`; diff con `delta`; un interior con `blueprint`). 5–15 piezas por perspectiva.
- **Enriquecer** *(opcional)*: `doc.risks` en las piezas que preocupan (salen como notas y en «Con riesgos anotados»),
  `doc.todo` para lo pendiente, `path` para ir al código.
- **Salida**: `node examples/fx/build-atlas.mjs <atlas.json> <página>.html [--lang en]` (autocontenida, publicable como
  Artifact; la perspectiva y la pieza abiertas van en el enlace). En una página que ya carga el motor:
  `GraphXAtlas.mount(el, atlas, { lang, height, hash })` de `examples/fx/atlas.js`. El mod enseña una perspectiva
  cada vez: con él, `show` con el `spec` de la que toque y `guide` para recorrerla.

