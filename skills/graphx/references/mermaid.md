# Enriquecer un Mermaid con datos de GraphX

Un Mermaid enriquecido **sigue siendo Mermaid válido**: Mermaid ignora lo que no conoce (claves extra en `@{…}` y
comentarios `%%`), así que se ve en GitHub, en un README o en Mermaid Live, y GraphX además lo dibuja con datos,
equipos, efectos, recorrido y panel. Estas reglas salen del conversor (`graphx-mermaid.js`); son las que hay que
cumplir. Qué enriquecer es decisión de diseño (ver [patrones](patrones.md)); **cómo** se escribe es esto.

## Las dos vías

| Vía | Dónde funciona | Para qué |
|---|---|---|
| `id@{ clave: valor, … }` | **solo `flowchart`/`graph` y `block`** | valores planos de una pieza o de una arista: números, texto corto, listas de números |
| `%% @gx {json}` · `%% @gx <id> {json}` | **los 18 tipos** (se aplica después de convertir) | la raíz (`fx`, `owners`, `timeline`, `tour`…) y lo estructurado de una pieza o arista (`blocks`, `metrics`, `parts`, `shape: "kpi"`…) |

En `sequenceDiagram`, `classDiagram`, `stateDiagram`, `erDiagram`, `gantt`, C4, etc. **no pongas datos en `@{}`**:
usa `%% @gx <id> {…}`. Para saber qué ids genera la conversión, `convert` con el Mermaid (lista ids y anotaciones).

## Piezas: `id@{ … }`

```
api@{ shape: hex, label: "API de pagos", heat: 85, spark: "40 52 61 58", unit: "ms", owner: pagos, alert: warn }
```

- Valores: `"entre comillas dobles"`, `'simples'` o sueltos hasta `,` `}` o fin de línea. Planos: nada de objetos ni
  listas JSON aquí.
- De Mermaid: `shape` (nombres de Mermaid: `rect rounded stadium cyl h-cyl circle diam hex lean-r lean-l trap-b
  trap-t doc cloud bang flag fork notch-rect tri hourglass delay brace text`…) y `label`.
- De GraphX:

| Clave | Valor | Dibuja |
|---|---|---|
| `heat` | número (coma decimal admitida) | tiñe la pieza y pone la cifra; la escala, en `fx.heat` |
| `spark` | `"1 2 3"` (espacios, comas o `;`) | una serie en la tarjeta, con su último valor |
| `unit` | texto | la unidad de `spark`/`value` |
| `progress` | 0–1 o 0–100 | un anillo de avance |
| `alert` | `crit` · `warn` · `info` · `ok` | un halo que late |
| `owner` | id de un equipo de `owners` | sus iniciales; filtrar y colorear por equipo |
| `value` · `change` · `min` · `max` · `decimals` | números | lo que usan `kpi`/`gauge` (la forma, por `%% @gx`) |
| `thresholds` | `"40 20"` | umbrales de un `gauge` |
| `good` | `down` · `high`… | qué sentido de `change` es bueno |
| `summary` · `subtitle` | texto | el resumen (tooltip y panel) y el subtítulo |
| `status` | clave de `statuses` | etiqueta y color del estado |
| `color` | color CSS | color propio |
| `kind` | un kind de GraphX (`service`, `datastore`, `queue`, `user`…) | el icono |
| `tags` | `"a b c"` | entran en la búsqueda |
| `delta` | `added` · `modified` · `removed` | marca de diff |

**Cuidado**: si la misma declaración lleva `shape`, el `kind` lo decide la forma (el tuyo se pierde); pon `kind` en
una línea `id@{ kind: … }` aparte o en `%% @gx`. `blocks`, `metrics`, `parts`, `links`, `notes` y `files` **no** van en
`@{}` (llegarían como texto): van en `%% @gx id {…}`.

## Aristas: `e1@{ … }`

```
web e1@--> api
e1@{ rate: 900, speed: fast, summary: "Cobros con tarjeta" }
```

- La arista necesita **id** (`a e1@--> b`) y su `e1@{…}` va **después** de declararla.
- `animate: true|fast|slow` (o `animation`) la anima. Claves: `rate` (caudal → partículas), `speed` (`fast`, `slow` o
  un factor), `weight` (grosor), `emphasis` (`hero`, una o dos como mucho; `muted`), `summary`, `data` (qué viaja),
  `trigger` (qué la dispara), `label`, `color`, `delta`, `head`/`tail` (puntas), `headLabel`/`tailLabel`
  (cardinalidades), `curve: true`.
- **El tipo de arista sale de la flecha, no de una clave** (`kind` en `@{}` se ignora): `-->` llamada, `-.->`
  asíncrona/evento (discontinua; el radio de impacto **baja** hacia quien consume), `==>` principal (`hero`). Elige la
  flecha pensando en el impacto: en una llamada el fallo sube hacia quien llama.

## `%% @gx`: raíz y lo estructurado

- **Una sola línea** por comentario: `%% @gx { … }` o `%% @gx <id> { … }`. El JSON puede ser laxo (comillas simples,
  claves sin comillas, coma final), pero no puede partirse en varias líneas. Varios `%% @gx` se suman.
- **Raíz** (sin id): `fx`, `owners`, `timeline`, `statuses`, `tour`, `filters`, `legend`, `title`, `summary`,
  `initialDepth`, `focus`, `flows`. `fx` se mezcla (un texto es un preset; `false`/`"off"` lo apaga).
  **Se ignoran en la raíz**: `levels`, `layout`, `theme`, `icons`, `links`, `collapsed`, `minimap`, `direction`,
  `lanes`, `initialView`. Si los necesitas, el diagrama pide un spec JSON (o `patch` con `set` en el lienzo).
- **Con id**: el id de una pieza, un carril/subgraph o una arista (un id desconocido da aviso). Una pieza admite todo
  lo de arriba **y** lo estructurado: `blocks`, `metrics`, `parts`, `links`, `notes`, `files`, `shape` de GraphX
  (`kpi`, `gauge`, `donut`, `table`…), `rows`, `span`, `score`, `badge`, `avatar`, `fill`, `textColor`, `frame`,
  `details_html`. No se cambian aquí: el `label` de una pieza, su `parent`/`lane` ni el tipo de una arista.

```
%% @gx { "owners": { "pagos": { "label": "Equipo Pagos", "short": "PG", "contact": "#pagos" } }, "fx": { "heat": { "label": "Latencia p95", "unit": "ms", "domain": [0, 400] } } }
%% @gx api { "blocks": [ { "type": "callout", "tone": "warn", "text": "p95 por encima de **80 ms**" } ] }
%% @gx k1 { "shape": "kpi", "value": 820, "change": 4.2, "unit": "pedidos/h" }
```

## Buenas costumbres

- **Primero el Mermaid limpio**, luego los datos al final del bloque (`@{}` de aristas y `%% @gx` juntos): quien lo
  lea en GitHub ve primero el diagrama.
- **`heat` siempre con su `fx.heat`** (`label`, `unit`, `domain`, `scheme`): sin eso el color no se explica. Escalas:
  `traffic` para salud (verde → rojo), `heat` para duraciones, `cool`/`viridis`/`magma` para cantidades neutras;
  `invert: true` si más es mejor.
- **`owner` con su `owners`** en la raíz (`label`, `short` de 2–3 letras, `contact`).
- **Un recorrido** (`%% @gx { "tour": { "steps": [ { "title": "…", "body_html": "…", "focus": { "nodes": ["api"] } } ] } }`)
  convierte el diagrama en una explicación; con el mod, mejor `guide`.
- **Tema y trazo** son de Mermaid, en el frontmatter (`---` / `config:` / `theme: neutral` · `forest` · `dark` · `base`,
  `look: handDrawn` enciende el trazo a mano) o en `%%{init: {"theme": "neutral"}}%%`.
- **Comprueba** con `convert`: dice el tipo, los avisos línea a línea y qué anotaciones ha recogido de cada pieza; lo
  que no salga ahí no se aplicó.
- **`export`** escribe el diagrama del lienzo como Mermaid con sus anotaciones. Es útil para compartir, pero la ida y
  vuelta no es perfecta (carriles, niveles, tema y el `kind` de las aristas se pierden): la fuente de verdad de un
  diagrama rico es su spec JSON.
