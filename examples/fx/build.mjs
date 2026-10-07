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
