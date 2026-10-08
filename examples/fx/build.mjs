/* El showcase de GraphX, en pestañas: software (servicios, línea de tiempo, impacto, equipos, paneles ricos y
 * Mermaid con datos), casos de uso, los 19 tipos de Mermaid frente a Mermaid (con y sin efectos, colores),
 * piezas (tarjetas, bloques, iconos), el catálogo de formas en React, el árbol de ficheros de este repo, efectos
 * en vivo y la guía de assets y efectos.
 *   node examples/fx/build.mjs <salida.html> [--standalone] [--base <ref>] [--lang es|en]
 * Usa dist/graphx.bundle.min.js (ELK dentro). React (cdnjs) y Mermaid (jsDelivr) se cargan solo en las
 * pestañas que los usan. La salida es el cuerpo de la página, sin <!doctype> ni <head>, tal como lo publica
 * la tool Artifact; con --standalone lleva su esqueleto. --base: la rama contra la que se marcan los cambios
 * del árbol del repositorio (por defecto, main). --lang en: la página en inglés; los textos de la plantilla
 * se traducen con examples/fx/showcase.en.txt (el build falla si una frase ya no está o si queda castellano)
 * y los datos salen de examples/en/, que replica examples/ con los ejemplos traducidos. */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import vm from 'vm';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../..');
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const out = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--base' && argv[i - 1] !== '--lang');
if (!out) { console.error('uso: node examples/fx/build.mjs <salida.html> [--standalone] [--lang es|en]'); process.exit(2); }
const LANG = opt('--lang', 'es') === 'en' ? 'en' : 'es', EN = LANG === 'en';
const L = (es, en) => (EN ? en : es);
const R = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
/* un ejemplo en el idioma de la página: su copia de examples/en/ si existe */
const local = f => { const t = f.replace(/^examples\//, 'examples/en/'); return EN && fs.existsSync(path.join(ROOT, t)) ? t : f; };
const SRC = ['graphx.js', 'graphx.css', 'graphx-mermaid.js', 'graphx-shapes.js', 'graphx-layouts.js', 'graphx-tree.js', 'graphx-fx.js'];
const hash = SRC.reduce((h, f) => h.update(fs.readFileSync(path.join(ROOT, f))), crypto.createHash('sha256')).digest('hex');
if (R('dist/SOURCE_HASH').trim() !== hash) { console.error('✗ dist/ no corresponde a las fuentes: ejecuta node tools/build-dist.mjs'); process.exit(1); }
const json = f => JSON.parse(R(local(f)));
const mmd = f => R(local(f));
const ORDER = ['flowchart', 'shapes', 'sequence', 'class', 'state', 'er', 'mindmap', 'gantt', 'journey', 'timeline', 'git', 'c4', 'architecture', 'block', 'requirement', 'sankey', 'kanban', 'treemap', 'pie'];
/* el árbol de este repo (solo lo que sigue git) con los cambios confirmados de la rama respecto a --base */
const BASE = opt('--base', 'main');
function repoTree() {
  let hasBase = true;
  try { execFileSync('git', ['-C', ROOT, 'rev-parse', '--verify', '--quiet', BASE], { stdio: 'ignore' }); } catch (_) { hasBase = false; }
  const args = [path.join(ROOT, 'tools/tree-spec.mjs'), ROOT, '--root', 'graphx', '--lang', LANG, '--title', L('GraphX: el repositorio', 'GraphX: the repository')].concat(hasBase ? ['--base', BASE, '--head', 'HEAD'] : []);
  const t = JSON.parse(execFileSync(process.execPath, args, { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] }));
  t.summary = hasBase ? L(`Los cambios de la rama respecto a ${BASE}`, `The branch's changes against ${BASE}`) : undefined;
  t.filters = [{ label: L('Motor', 'Engine'), query: 'graphx' }, { label: L('Pruebas', 'Tests'), query: 'verify' }, { label: L('Ejemplos', 'Examples'), query: 'examples' }, { label: L('Documentación', 'Docs'), query: '.md' }];
  return t;
}
const TREE_SAMPLE_ES = `tienda-web
├── [ 1.2K]  README.md
├── [  640]  package.json
├── src
│   ├── app
│   │   ├── [ 2.1K]  main.ts
│   │   ├── [ 3.4K]  router.ts
│   │   └── [ 1.8K]  store.ts
│   ├── components
│   │   ├── [ 4.2K]  Carrito.tsx
│   │   ├── [ 2.9K]  Ficha.tsx
│   │   ├── [ 1.1K]  Boton.tsx
│   │   └── [  980]  Carrito.module.css
│   ├── api
│   │   ├── [ 2.6K]  pedidos.ts
│   │   └── [ 1.4K]  pagos.ts
│   └── i18n
│       ├── [  3K]  es.json
│       └── [ 2.8K]  en.json
├── public
│   ├── [ 15K]  logo.svg
│   └── [ 32K]  favicon.ico
└── tests
    ├── [ 2.2K]  carrito.test.ts
    └── [ 1.9K]  pagos.test.ts

8 directories, 17 files`;
const TREE_SAMPLE_EN = TREE_SAMPLE_ES.replace('tienda-web', 'web-shop').replace('Carrito.tsx', 'Cart.tsx').replace('Ficha.tsx', 'ProductCard.tsx')
  .replace('Boton.tsx', 'Button.tsx').replace('Carrito.module.css', 'Cart.module.css').replace('pedidos.ts', 'orders.ts').replace('pagos.ts', 'payments.ts')
  .replace('carrito.test.ts', 'cart.test.ts').replace('pagos.test.ts', 'payments.test.ts');
/* lo que se lee del repo y se enseña en la página */
const ex = (f, o) => Object.assign({ file: local(f) }, o, /\.mmd$/.test(f) ? { mermaid: mmd(f) } : { spec: json(f) });
const data = {
  software: json('examples/fx/software.json'),
  galeria: json('examples/fx/galeria.json'),
  arquitectura: mmd('examples/fx/arquitectura.mmd'),
  blocks: json('examples/fx/bloques.json'),
  /* la pestaña de ejemplos: uno por caso de uso, con lo que demuestra */
  ejemplos: [
    ex('examples/fx/postmortem.json', { title: L('Postmortem de un incidente', 'Incident postmortem'), what: L('La caída del login, minuto a minuto: recorrido narrado, línea de tiempo con eventos, impacto y acciones.', 'The login outage, minute by minute: a narrated tour, a timeline with events, blast radius and follow-ups.'), shows: ['timeline', 'tour', 'blast', 'blocks'] }),
    ex('examples/fx/pipeline-datos.json', { title: L('La carga nocturna de datos', 'The nightly data load'), what: L('Un pipeline ETL con su línea de tiempo desde un CSV en formato largo, cargado con tools/timeline.mjs.', 'An ETL pipeline with its timeline built from a long-format CSV, loaded with tools/timeline.mjs.'), shows: ['timeline CSV', 'rate', 'heat', 'owners'] }),
    ex('examples/fx/kubernetes.json', { title: L('Clúster de Kubernetes', 'Kubernetes cluster'), what: L('Namespaces, deployments y pods con la CPU como calor, un rollout y un pod en CrashLoopBackOff.', 'Namespaces, deployments and pods with CPU as heat, a rollout and a pod in CrashLoopBackOff.'), shows: [L('niveles', 'levels'), 'heat rollup', 'progress', 'alert'] }),
    ex('examples/fx/ci-cd.mmd', { title: L('CI/CD en Mermaid', 'CI/CD in Mermaid'), what: L('Un pipeline de despliegue en Mermaid válido, con la duración de cada etapa, el canario y paneles por @gx.', 'A deployment pipeline in valid Mermaid, with each stage\'s duration, the canary and panels via @gx.'), shows: ['Mermaid', '@gx', 'attach', 'theme'] }),
    ex('examples/fx/almacen.json', { title: L('Almacén de Getafe', 'Getafe warehouse'), what: L('Un proceso de negocio: tiempo en cola como calor, ritmo por hora y KPIs del turno.', 'A business process: queue time as heat, hourly throughput and the shift\'s KPIs.'), shows: ['heat', 'spark', 'kpi', 'gauge', 'donut'] }),
    ex('examples/onboarding-proceso.json', { title: L('Incorporación de una persona', 'Employee onboarding'), what: L('Un proceso de RR. HH. entre departamentos, vertical y con colores, sin datos de código.', 'An HR process across departments, vertical and color-coded, with no code data at all.'), shows: [L('carriles', 'lanes'), L('niveles', 'levels'), L('flujo', 'flow')] }),
    ex('examples/warehouses-pr-radar.json', { title: L('Radar de PRs', 'PR radar'), what: L('Las PRs de un proyecto, sus dependencias y su estado, generado desde datos.', 'A project\'s PRs, their dependencies and status, generated from data.'), shows: ['statuses', 'links', 'tour'] }),
    ex('examples/pr-review-stack-202.json', { title: L('Revisión de una PR grande', 'Reviewing a large PR'), what: L('73 piezas en capas para revisar un cambio por partes, con el preset vivid y zoom semántico.', '73 nodes in layers to review a change piece by piece, with the vivid preset and semantic zoom.'), shows: [L('niveles', 'levels'), 'lod', 'vivid'], fx: 'vivid' }),
    ex('examples/mermaid/c4.mmd', { title: L('Banca online en C4', 'Online banking in C4'), what: L('El contexto de un sistema en notación C4, convertido desde Mermaid.', 'A system context in C4 notation, converted from Mermaid.'), shows: ['Mermaid', 'C4', L('fronteras', 'boundaries')] }),
    ex('examples/mermaid/gantt.mmd', { title: L('Plan de un lanzamiento', 'A launch plan'), what: L('Un gantt con secciones, dependencias y hitos en el eje de fechas.', 'A gantt with sections, dependencies and milestones on a date axis.'), shows: ['Mermaid', 'gantt', 'layout'] })
  ],
  viva: json('examples/fx/plataforma-viva.json'),
  almacen: json('examples/fx/almacen.json'),
  grande: json('examples/pr-review-stack-202.json'),
  diagramas: {
    types: ORDER.map(id => ({ id, name: id, file: local(`examples/mermaid/${id}.mmd`), code: mmd(`examples/mermaid/${id}.mmd`) })),
    rich: [
      { id: 'x-arquitectura', name: L('Búsqueda con calor y equipos', 'Search with heat and teams'), file: local('examples/fx/arquitectura.mmd'), code: mmd('examples/fx/arquitectura.mmd') },
      { id: 'x-cicd', name: L('CI/CD con duraciones', 'CI/CD with durations'), file: local('examples/fx/ci-cd.mmd'), code: mmd('examples/fx/ci-cd.mmd') },
      { id: 'x-despliegue', name: L('Despliegue: forest y a mano', 'Deploy: forest, hand-drawn'), file: local('examples/fx/despliegue.mmd'), code: mmd('examples/fx/despliegue.mmd') }
    ]
  },
  treeBase: BASE,
  treeRepo: repoTree(),
  treeSample: L(TREE_SAMPLE_ES, TREE_SAMPLE_EN)
};
const noClose = s => s.replace(/<\/script/gi, '<\\/script');
const fxMin = fs.readFileSync(path.join(ROOT, 'dist/graphx-fx.min.js'));
const kb = n => String(Math.round(n / 1024));
/* cuántas formas y bloques hay, contados de las fuentes */
const box = { console }; box.globalThis = box; box.window = box; vm.createContext(box);
vm.runInContext(R('graphx-shapes.js'), box);
const nShapes = (box.GraphX && box.GraphX.shapes ? box.GraphX.shapes.names.length : 0) + 1;
/* la plantilla en el idioma de la página: cada frase del diccionario debe seguir en la plantilla, y después
   no puede quedar castellano visible (fuera de los datos y del motor, que se inyectan luego) */
let tpl = R('examples/fx/showcase.tpl.html');
if (EN) {
  const pairs = [], lines = R('examples/fx/showcase.en.txt').split('\n');
  for (let i = 0; i < lines.length; i++) if (lines[i].startsWith('@@ ')) pairs.push([lines[i].slice(3), (lines[i + 1] || '').replace(/^=> ?/, '')]);
  const missing = pairs.filter(([es]) => !tpl.includes(es)).map(([es]) => es);
  if (missing.length) { console.error('✗ frases del diccionario que ya no están en la plantilla:\n  ' + missing.join('\n  ')); process.exit(1); }
  pairs.sort((a, b) => b[0].length - a[0].length).forEach(([es, en]) => { tpl = tpl.split(es).join(en); });
  const body = tpl.replace(/<style>[\s\S]*?<\/style>/, '').replace(/<!--[\s\S]*?-->/g, '');
  const ES = /[áéíóúñ¿¡]|\b(el|la|los|las|del|de|y|en|un|una|unas|que|con|sin|para|por|cada|se|al|lo|su|sus|más|como|pieza|piezas|si|sí|o|ver|solo|también|otros|nueva|nuevo)\b/i;
  /* solo lo que se ve: el texto del HTML y las cadenas del JS (no los comentarios ni los nombres de variables) */
  const seen = l => (l.match(/'(?:[^'\\\n]|\\.)*'|>[^<>]+</g) || []).join(' ');
  const left = body.split('\n').filter(l => !/^\s*(\/\*|\*|\/\/)|var ALIAS/.test(l) && ES.test(seen(l.replace(/\/\*.*?\*\//g, '')).replace(/mount\(el,/g, '')));
  if (left.length) { console.error(`✗ ${left.length} líneas con castellano en la plantilla inglesa:\n  ` + left.map(l => l.trim().slice(0, 160)).join('\n  ')); if (!argv.includes('--force')) process.exit(1); }
}
let page = tpl
  .replace(/__LANG__/g, LANG)
  .replace(/__NSHAPES__/g, String(nShapes)).replace('__NEX__', String(data.ejemplos.length))
  .replace('__REACT_BRIDGE__', () => noClose(R('react/graphx-react.js')))
  .replace('__FXKB__', kb(fxMin.length)).replace('__FXGZ__', kb((await import('zlib')).gzipSync(fxMin, { level: 9 }).length))
  .replace('__ENGINE__', () => noClose(R('dist/graphx.bundle.min.js')))
  .replace('__DATA__', () => noClose(JSON.stringify(data)).replace(/<!--/g, '<\\!--'));
if (process.argv.includes('--standalone')) page = `<!doctype html>\n<html lang="${LANG}">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n${page}\n</body>\n</html>\n`;
fs.writeFileSync(out, page);
console.log(`✓ ${out} (${Math.round(page.length / 1024)} KB)`);
