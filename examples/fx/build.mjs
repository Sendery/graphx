/* Página de demostración de los efectos (graphx-fx.js), en pestañas: software (servicios, línea de tiempo,
 * impacto, equipos, paneles ricos y Mermaid con datos), galería (piezas, bloques, iconos), en vivo (presets y
 * datos que cambian), Mermaid con y sin efectos y la referencia de `fx`.
 *   node examples/fx/build.mjs <salida.html>
 * Usa dist/graphx.bundle.min.js (ELK dentro: funciona sin red). La salida es el cuerpo de la página,
 * sin <!doctype> ni <head>, tal como lo publica la tool Artifact; con --standalone lleva su esqueleto. */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../..');
const out = process.argv.slice(2).find(a => !a.startsWith('--'));
if (!out) { console.error('uso: node examples/fx/build.mjs <salida.html> [--standalone]'); process.exit(2); }
const R = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SRC = ['graphx.js', 'graphx.css', 'graphx-mermaid.js', 'graphx-shapes.js', 'graphx-layouts.js', 'graphx-tree.js', 'graphx-fx.js'];
const hash = SRC.reduce((h, f) => h.update(fs.readFileSync(path.join(ROOT, f))), crypto.createHash('sha256')).digest('hex');
if (R('dist/SOURCE_HASH').trim() !== hash) { console.error('✗ dist/ no corresponde a las fuentes: ejecuta node tools/build-dist.mjs'); process.exit(1); }
const json = f => JSON.parse(R(f));
const data = {
  software: json('examples/fx/software.json'),
  galeria: json('examples/fx/galeria.json'),
  arquitectura: R('examples/fx/arquitectura.mmd'),
  blocks: json('examples/fx/bloques.json'),
  /* la pestaña de ejemplos: uno por caso de uso, con lo que demuestra */
  ejemplos: [
    { title: 'Postmortem de un incidente', file: 'examples/fx/postmortem.json', what: 'La caída del login, minuto a minuto: recorrido narrado, línea de tiempo con eventos, impacto y acciones.', shows: ['timeline', 'tour', 'blast', 'blocks'], spec: json('examples/fx/postmortem.json') },
    { title: 'La carga nocturna de datos', file: 'examples/fx/pipeline-datos.json', what: 'Un pipeline ETL con su línea de tiempo desde un CSV en formato largo, cargado con tools/timeline.mjs.', shows: ['timeline CSV', 'rate', 'heat', 'owners'], spec: json('examples/fx/pipeline-datos.json') },
    { title: 'Clúster de Kubernetes', file: 'examples/fx/kubernetes.json', what: 'Namespaces, deployments y pods con la CPU como calor, un rollout y un pod en CrashLoopBackOff.', shows: ['niveles', 'heat rollup', 'progress', 'alert'], spec: json('examples/fx/kubernetes.json') },
    { title: 'CI/CD en Mermaid', file: 'examples/fx/ci-cd.mmd', what: 'Un pipeline de despliegue en Mermaid válido, con la duración de cada etapa, el canario y paneles por @gx.', shows: ['Mermaid', '@gx', 'attach', 'theme'], mermaid: R('examples/fx/ci-cd.mmd') },
    { title: 'Almacén de Getafe', file: 'examples/fx/almacen.json', what: 'Un proceso de negocio: tiempo en cola como calor, ritmo por hora y KPIs del turno.', shows: ['heat', 'spark', 'kpi', 'gauge', 'donut'], spec: json('examples/fx/almacen.json') },
    { title: 'Incorporación de una persona', file: 'examples/onboarding-proceso.json', what: 'Un proceso de RR. HH. entre departamentos, vertical y con colores, sin datos de código.', shows: ['carriles', 'niveles', 'flujo'], spec: json('examples/onboarding-proceso.json') },
    { title: 'Radar de PRs', file: 'examples/warehouses-pr-radar.json', what: 'Las PRs de un proyecto, sus dependencias y su estado, generado desde datos.', shows: ['statuses', 'links', 'tour'], spec: json('examples/warehouses-pr-radar.json') },
    { title: 'Todas las formas de Mermaid', file: 'examples/mermaid/shapes.mmd', what: 'Las formas de un flowchart de Mermaid, convertidas.', shows: ['Mermaid', 'formas'], mermaid: R('examples/mermaid/shapes.mmd') }
  ],
  viva: json('examples/fx/plataforma-viva.json'),
  almacen: json('examples/fx/almacen.json'),
  grande: json('examples/pr-review-stack-202.json'),
  mermaid: [
    { name: 'Alta de un pedido (flowchart)', code: R('examples/mermaid/flowchart.mmd') },
    { name: 'Despliegue: forest y a mano', code: R('examples/fx/despliegue.mmd') },
    { name: 'Búsqueda con datos (@gx)', code: R('examples/fx/arquitectura.mmd') },
    { name: 'Ciclo de un artículo (estados)', code: R('examples/mermaid/state.mmd') }
  ]
};
const noClose = s => s.replace(/<\/script/gi, '<\\/script');
const fxMin = fs.readFileSync(path.join(ROOT, 'dist/graphx-fx.min.js'));
const kb = n => String(Math.round(n / 1024));
let page = R('examples/fx/showcase.tpl.html')
  .replace('__FXKB__', kb(fxMin.length)).replace('__FXGZ__', kb((await import('zlib')).gzipSync(fxMin, { level: 9 }).length))
  .replace('__ENGINE__', () => noClose(R('dist/graphx.bundle.min.js')))
  .replace('__DATA__', () => noClose(JSON.stringify(data)).replace(/<!--/g, '<\\!--'));
if (process.argv.includes('--standalone')) page = `<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n${page}\n</body>\n</html>\n`;
fs.writeFileSync(out, page);
console.log(`✓ ${out} (${Math.round(page.length / 1024)} KB)`);
