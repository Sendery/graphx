/* Galería de Mermaid en GraphX: una página con todos los ejemplos de examples/mermaid, la
 * comparación con Mermaid (render propio, lado a lado) y el catálogo de formas en React.
 *   node examples/gallery/build.mjs <salida.html>
 * Usa dist/graphx.lite.min.js: ELK, Mermaid y React se cargan de un CDN cuando hacen falta. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../..');
const out = process.argv.slice(2).find(a => !a.startsWith('--') && process.argv[process.argv.indexOf(a) - 1] !== '--base');
/* el árbol de este repo con los cambios de la rama respecto a --base (por defecto, la rama de la que sale) */
const base = (() => { const i = process.argv.indexOf('--base'); return i > 0 ? process.argv[i + 1] : 'feat/mermaid-shapes'; })();
const treeArgs = [path.join(ROOT, 'tools/tree-spec.mjs'), ROOT, '--root', 'graphx', '--title', 'GraphX: el repositorio'];
let hasBase = true;
try { execFileSync('git', ['-C', ROOT, 'rev-parse', '--verify', '--quiet', base], { stdio: 'ignore' }); } catch (_) { hasBase = false; }
const repoTree = JSON.parse(execFileSync(process.execPath, treeArgs.concat(hasBase ? ['--base', base] : []), { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] }));
repoTree.summary = hasBase ? `Cambios respecto a ${base}` : undefined;
repoTree.filters = [{ label: 'Motor', query: 'graphx' }, { label: 'Pruebas', query: 'verify' }, { label: 'Ejemplos Mermaid', query: '.mmd' }];
if (!out) { console.error('uso: node examples/gallery/build.mjs <salida.html>'); process.exit(2); }
const order = ['flowchart', 'shapes', 'sequence', 'class', 'state', 'er', 'mindmap', 'gantt', 'journey', 'timeline', 'git', 'c4', 'architecture', 'block', 'requirement', 'sankey', 'kanban', 'treemap', 'pie'];
const samples = Object.fromEntries(order.map(n => [n, fs.readFileSync(path.join(ROOT, 'examples/mermaid', n + '.mmd'), 'utf8')]));
const script = f => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/<\/script/gi, '<\\/script');
const page = fs.readFileSync(path.join(HERE, 'gallery.tpl.html'), 'utf8')
  .replace('__ENGINE__', () => script('dist/graphx.lite.min.js'))
  .replace('__REACT_BRIDGE__', () => script('react/graphx-react.js'))
  .replace('__SAMPLES__', () => JSON.stringify(samples).replace(/</g, '\\u003c'))
  .replace('__TREE_REPO__', () => JSON.stringify(repoTree).replace(/</g, '\\u003c'));
fs.writeFileSync(out, page);
console.log(`✓ ${out} (${Math.round(page.length / 1024)} KB, ${order.length} ejemplos)`);
