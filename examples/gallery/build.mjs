/* Galería de Mermaid en GraphX: una página con todos los ejemplos de examples/mermaid, la
 * comparación con Mermaid (render propio, lado a lado) y el catálogo de formas en React.
 *   node examples/gallery/build.mjs <salida.html>
 * Usa dist/graphx.lite.min.js: ELK, Mermaid y React se cargan de un CDN cuando hacen falta. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../..');
const out = process.argv[2];
if (!out) { console.error('uso: node examples/gallery/build.mjs <salida.html>'); process.exit(2); }
const order = ['flowchart', 'shapes', 'sequence', 'class', 'state', 'er', 'mindmap', 'gantt', 'journey', 'timeline', 'git', 'c4', 'architecture', 'block', 'requirement', 'sankey', 'kanban', 'treemap', 'pie'];
const samples = Object.fromEntries(order.map(n => [n, fs.readFileSync(path.join(ROOT, 'examples/mermaid', n + '.mmd'), 'utf8')]));
const script = f => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/<\/script/gi, '<\\/script');
const page = fs.readFileSync(path.join(HERE, 'gallery.tpl.html'), 'utf8')
  .replace('__ENGINE__', () => script('dist/graphx.lite.min.js'))
  .replace('__REACT_BRIDGE__', () => script('react/graphx-react.js'))
  .replace('__SAMPLES__', () => JSON.stringify(samples).replace(/</g, '\\u003c'));
fs.writeFileSync(out, page);
console.log(`✓ ${out} (${Math.round(page.length / 1024)} KB, ${order.length} ejemplos)`);
