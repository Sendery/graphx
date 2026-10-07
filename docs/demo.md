# La página de demostración

Una página autocontenida (motor, ELK, datos y estilos dentro: funciona sin red) que enseña GraphX 1.9 en
seis pestañas. Se genera con:

```bash
node tools/build-dist.mjs                                   # dist/ al día
node examples/fx/build.mjs /tmp/graphx-demo.html --standalone   # con <!doctype>, para abrirla en local
node examples/fx/build.mjs /tmp/graphx-demo.html                # sin esqueleto, para publicarla como artifact
```

Pesa unos 2 MB. Cada pestaña se monta la primera vez que se abre; la dirección recuerda la pestaña
(`#software`, `#galeria`, `#vivo`, `#ejemplos`, `#mermaid`, `#referencia`). Las capturas de este documento
se regeneran con `node tools/capture-docs.mjs` (ver [README](README.md)).

![La portada](img/demo-portada.webp)

## Software

El checkout de una tienda (`examples/fx/software.json`): servicios en carriles, equipos, la latencia p95
como calor, el caudal como partículas y tres indicadores. Debajo, la línea de tiempo de un día entero sale de
una tabla TSV de 24 filas que genera `examples/fx/software/gen.mjs`.

![El mapa de servicios con su línea de tiempo](img/demo-software.webp)

| Botón | Qué enseña |
|---|---|
| ▶ Reproducir el día | la línea de tiempo desde las 00:00: el pico de mediodía, el despliegue de las 09:00 y el incidente |
| Ir a las 13:00 | cruza el evento del incidente: Antifraude y Pagos en rojo, el aviso arriba |
| ✺ Impacto de Antifraude | el radio de impacto: anillos por salto y el resumen en el panel |
| Solo el equipo de Pagos | el filtro de equipos |
| Volver a empezar | todo como al abrir |

Pulsa cualquier pieza para ver su panel: Pagos lleva un aviso, cifras con su serie, la latencia del día,
sus SLO, el comando de rollback, un runbook y sus últimos cambios; Checkout, la saga de la compra, sus
endpoints más lentos y sus errores; PostgreSQL, su CPU y la carga de la semana.

| El panel de Pagos | El incidente de las 13:00 |
|---|---|
| ![Panel con bloques](img/demo-panel.webp) | ![Línea de tiempo a las 13:00](img/demo-tiempo.webp) |

![Radio de impacto](img/demo-impacto.webp)

Debajo, **Mermaid, igual de rico**: `examples/fx/arquitectura.mmd`, un flowchart válido con datos de GraphX
en `@{…}` y en comentarios `%% @gx` (resaltados en el código).

## Galería

Las 28 clases de pieza en una rejilla (`examples/fx/galeria.json`, layout `grid`), con datos que cambian
cada dos segundos. Cada pieza lleva en su panel un tipo de bloque distinto. Después, todos los bloques del
panel uno a uno (`examples/fx/bloques.json`, pintados con `GraphX.fx.renderBlocks`) y los 35 iconos de tipo,
que se dibujan al pasar por encima.

![La galería de piezas](img/demo-galeria.webp)

![Los bloques del panel](img/demo-bloques.webp)

## En vivo

Una plataforma de pagos que recibe datos nuevos cada segundo y medio. Arriba, los presets y un interruptor
por efecto; la línea de código muestra el `fx` que resulta. «Provocar un incidente» dispara la latencia de
Antifraude y traza lo que depende de él. Debajo, el almacén (un proceso de negocio con KPIs) y la revisión de
una PR de 73 piezas con el preset `vivid` (zoom semántico, marcha al pasar, minimapa plegable).

![La sala de control](img/demo-vivo.webp)

## Ejemplos

Ocho ejemplos del repositorio, cada uno con lo que demuestra y su fichero; al elegirlo se monta al lado.
Ver [ejemplos.md](ejemplos.md).

![La pestaña de ejemplos](img/demo-ejemplos.webp)

## Mermaid

El mismo código de Mermaid convertido sin efectos y con un preset (vivid, neon, blueprint o glass). El código
se edita y los dos lados se rehacen. Ejemplos: un flowchart con subgrafos, un despliegue con tema `forest` y
trazo a mano, la búsqueda con datos `@gx` y una máquina de estados.

![Mermaid con y sin efectos](img/demo-mermaid.webp)

## Guía

La clasificación de lo que se puede dibujar y de los efectos, con «Ver →» hacia la pestaña donde se ve cada
cosa, y la referencia de configuración (presets, equipos y bloques, línea de tiempo, Mermaid con datos, API).

![La guía de efectos](img/demo-guia.webp)
