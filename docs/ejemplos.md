# Ejemplos del repositorio

Cada ejemplo se convierte en una página con `node graphx-build.mjs <fichero>` (añade `--out x.html`).
Los que llevan datos sintéticos se regeneran con su script.

| Ejemplo | Qué demuestra | Se regenera con |
|---|---|---|
| [Checkout de la tienda](#checkout-de-la-tienda) | línea de tiempo TSV, calor, caudal, equipos, impacto, paneles ricos, secuencia | `node examples/fx/software/gen.mjs` |
| [Postmortem de un incidente](#postmortem-de-un-incidente) | cronología minuto a minuto, eventos, recorrido narrado, acciones | `node examples/fx/gen-ejemplos.mjs` |
| [La carga nocturna de datos](#la-carga-nocturna-de-datos) | CSV en formato largo con `tools/timeline.mjs`, caudales, retraso como calor | `node examples/fx/gen-ejemplos.mjs` |
| [Clúster de Kubernetes](#clúster-de-kubernetes) | tres niveles, calor que sube al contenedor, rollout, CrashLoopBackOff | `node examples/fx/gen-ejemplos.mjs` |
| [CI/CD en Mermaid](#cicd-en-mermaid) | Mermaid válido con datos `@gx`, tema `neutral`, formas con extras | (a mano) |
| [Plataforma de pagos en vivo](#plataforma-de-pagos-en-vivo) | el JSON base de la demo en vivo: KPI, gauge, donut, alertas | (a mano) |
| [Almacén de Getafe](#almacén-de-getafe) | proceso de negocio con calor, ritmo y KPIs | (a mano) |
| [Galería de piezas](#galería-de-piezas) | cada clase de pieza en una rejilla, con un bloque distinto en cada panel | `node examples/fx/galeria.mjs` |
| [Búsqueda de productos](#búsqueda-de-productos) | Mermaid con `@{…}` y `%% @gx` | (a mano) |
| [Incorporación de una persona](#incorporación-de-una-persona) | proceso de RR. HH. sin código: carriles, niveles, flujo | (a mano) |
| [Radar de PRs](#radar-de-prs) | estados propios, enlaces y recorrido generados desde datos | `node examples/warehouses-pr-radar/gen-graph.mjs` |
| [Revisión de una PR](#revisión-de-una-pr) | diff de 73 piezas en cuatro niveles | (a mano) |
| [Atlas de una tienda](#atlas-de-una-tienda) | varias perspectivas con las piezas compartidas, fichas e interiores | `node examples/fx/build-atlas.mjs <salida.html>` |
| Mermaid, uno por tipo | `examples/mermaid/*.mmd`: flowchart, secuencia, clases, estados, ER, gantt, git, C4… | (a mano) |

## Checkout de la tienda

`examples/fx/software.json` · el mapa de servicios de la pestaña Software. La tabla de 24 filas × 22 series
la escribe `software/gen.mjs`, como saldría de una consulta horaria.

![Checkout de la tienda](img/ej-software.webp)

## Postmortem de un incidente

`examples/fx/postmortem.json` · la caída del inicio de sesión del 2 de octubre, cada 2 minutos de 10:36 a
11:28. Seis eventos en la línea de tiempo, un recorrido de cinco pasos («Qué pasó») y, en los paneles, la
causa raíz, la cronología, las conexiones de la base de datos y el checklist de acciones.

![Postmortem a las 10:50](img/ej-postmortem.webp)

## La carga nocturna de datos

`examples/fx/pipeline-datos.json` · del CRM, el ERP y la analítica web al lakehouse. La línea de tiempo
sale de `datos/pipeline.csv` en formato largo (`time,id,field,value`) y de `datos/pipeline-eventos.tsv`:

```bash
node tools/timeline.mjs examples/fx/pipeline-datos.json examples/fx/datos/pipeline.csv --events examples/fx/datos/pipeline-eventos.tsv
```

![La carga nocturna a las 03:40](img/ej-pipeline.webp)

## Clúster de Kubernetes

`examples/fx/kubernetes.json` · namespaces → deployments → pods. El calor es la CPU de cada pod y un
deployment plegado enseña el máximo de los suyos; checkout está a mitad de un rollout y un pod de pagos en
CrashLoopBackOff. Abre el nivel «Pod».

![El clúster a nivel de pod](img/ej-kubernetes.webp)

## CI/CD en Mermaid

`examples/fx/ci-cd.mmd` · un pipeline de despliegue que sigue siendo Mermaid válido: la duración de cada
etapa como calor, el canario con su progreso, los equipos y, por `%% @gx`, los resultados de las pruebas.

![CI/CD](img/ej-ci-cd.webp)

## Plataforma de pagos en vivo

`examples/fx/plataforma-viva.json` · el JSON de partida de la pestaña En vivo.

![Plataforma de pagos](img/ej-plataforma-viva.webp)

## Almacén de Getafe

`examples/fx/almacen.json` · del camión al transportista, con el tiempo en cola como calor.

![Almacén](img/ej-almacen.webp)

## Galería de piezas

`examples/fx/galeria.json` · ver [catalogo.md](catalogo.md).

![Galería](img/demo-galeria.webp)

## Búsqueda de productos

`examples/fx/arquitectura.mmd` · ver [efectos.md](efectos.md#formas-de-mermaid-con-datos).

![Búsqueda de productos](img/fx-formas-mermaid.webp)

## Incorporación de una persona

`examples/onboarding-proceso.json` · un proceso entre departamentos, vertical y con colores.

![Incorporación](img/ej-onboarding.webp)

## Radar de PRs

`examples/warehouses-pr-radar.json` · las PRs de un proyecto y sus dependencias, generado desde
`warehouses-pr-radar/data.js`.

![Radar de PRs](img/ej-radar.webp)

## Revisión de una PR

`examples/pr-review-stack-202.json` · el ejemplo con el que nació GraphX: un diff en cuatro niveles.

![Revisión de una PR](img/ej-pr-review.webp)

## Atlas de una tienda

`examples/fx/atlas.json` (en inglés, `examples/en/fx/atlas.json`) · no es un diagrama sino un atlas: 20 piezas
declaradas una vez y siete perspectivas que las usan (arquitectura, ciclo de un pedido, flujo de datos, impacto,
cambios del sprint y, por dentro, Pagos y los estados de un pedido). Se monta con `examples/fx/atlas.js`;
`node examples/fx/build-atlas.mjs <salida.html> [--lang en]` hace la página. Ver [la demo](demo.md#atlas).

![El atlas](img/demo-atlas.webp)

