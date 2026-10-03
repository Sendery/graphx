#!/usr/bin/env node
/* Compacta el motor para incluirlo en artifacts u otras webs.
 *   node tools/build-dist.mjs            (o npm run dist)
 * dist/graphx.min.js          el motor minificado (necesita ELK aparte)
 * dist/graphx.min.css         los estilos minificados
 * dist/graphx.bundle.min.js   UN solo fichero: ELK + motor + estilos (se inyectan solos) +
 *                             montaje automático de todo [data-gx] al cargar la página
 * dist/graphx.lite.min.js     lo mismo SIN ELK: lo carga de jsDelivr la primera vez (≈110 KB)
 * dist/graphx-mermaid.min.js  el conversor de Mermaid suelto (los dos bundles ya lo llevan)
 * dist/graphx-shapes.min.js   las formas sueltas (idem); graphx-layouts.min.js, los layouts por tipo;
 *                             graphx-tree.min.js, los árboles de ficheros                                      */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const r = f => path.join(ROOT, f);
const DIST = r('dist'); fs.mkdirSync(DIST, { recursive: true });
const esb = (inp, out, loader) => execFileSync('npx', ['--yes', 'esbuild@0.24.0', inp, '--minify', `--outfile=${out}`, '--log-level=warning', ...(loader ? [`--loader=${loader}`] : []), '--target=es2019', '--legal-comments=none'], { stdio: 'inherit' });

esb(r('graphx.js'), path.join(DIST, 'graphx.min.js'));
esb(r('graphx.css'), path.join(DIST, 'graphx.min.css'));
esb(r('graphx-mermaid.js'), path.join(DIST, 'graphx-mermaid.min.js'));
esb(r('graphx-shapes.js'), path.join(DIST, 'graphx-shapes.min.js'));
esb(r('graphx-layouts.js'), path.join(DIST, 'graphx-layouts.min.js'));
esb(r('graphx-tree.js'), path.join(DIST, 'graphx-tree.min.js'));
const elkMin = path.join(DIST, '.elk.min.js');
esb(r('vendor/elk.bundled.js'), elkMin);

const css = fs.readFileSync(path.join(DIST, 'graphx.min.css'), 'utf8').trim();
const mermaid = fs.readFileSync(path.join(DIST, 'graphx-mermaid.min.js'), 'utf8').trim();
const shapes = fs.readFileSync(path.join(DIST, 'graphx-shapes.min.js'), 'utf8').trim() + '\n' + fs.readFileSync(path.join(DIST, 'graphx-layouts.min.js'), 'utf8').trim() + '\n' + fs.readFileSync(path.join(DIST, 'graphx-tree.min.js'), 'utf8').trim();
const inject = `;(function(){if(typeof document==="undefined")return;function css(){if(document.querySelector("style[data-gx-css]"))return;var s=document.createElement("style");s.setAttribute("data-gx-css","1.4");s.textContent=${JSON.stringify(css)};(document.head||document.documentElement).appendChild(s)}function go(){css();window.GraphX&&window.GraphX.mountAll(document)}window.GraphX&&(window.GraphX.injectCSS=css);if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",go);else go()})();`;
const header = `/*! GraphX 1.4 · motor de diagramas navegables · incluye ELK 0.12 (EPL-2.0, https://eclipse.dev/elk) */\n`;
fs.writeFileSync(path.join(DIST, 'graphx.bundle.min.js'),
  header + fs.readFileSync(elkMin, 'utf8').trim() + '\n' + shapes + '\n' + fs.readFileSync(path.join(DIST, 'graphx.min.js'), 'utf8').trim() + '\n' + mermaid + '\n' + inject + '\n');
fs.writeFileSync(path.join(DIST, 'graphx.lite.min.js'),
  `/*! GraphX 1.4 · motor sin ELK: lo carga bajo demanda desde jsDelivr (o desde GraphX.elkURL) */\n` + shapes + '\n' + fs.readFileSync(path.join(DIST, 'graphx.min.js'), 'utf8').trim() + '\n' + mermaid + '\n' + inject + '\n');
fs.unlinkSync(elkMin);
/* huella de las fuentes: los ensambladores la comparan para saber si dist/ está al día. Las fechas
   de fichero no sirven: una copia o un git clone las cambian. */
const crypto = await import('crypto');
const hash = crypto.createHash('sha256').update(fs.readFileSync(r('graphx.js'))).update(fs.readFileSync(r('graphx.css'))).update(fs.readFileSync(r('graphx-mermaid.js'))).update(fs.readFileSync(r('graphx-shapes.js'))).update(fs.readFileSync(r('graphx-layouts.js'))).update(fs.readFileSync(r('graphx-tree.js'))).digest('hex');
fs.writeFileSync(path.join(DIST, 'SOURCE_HASH'), hash + '\n');

const kb = n => (n / 1024).toFixed(0) + ' KB';
const row = (label, f) => { const b = fs.readFileSync(f); console.log(`  ${label.padEnd(26)} ${kb(b.length).padStart(8)}  · gzip ${kb(zlib.gzipSync(b, { level: 9 }).length).padStart(7)}`); };
console.log('fuentes');
row('graphx.js', r('graphx.js')); row('graphx.css', r('graphx.css')); row('graphx-mermaid.js', r('graphx-mermaid.js')); row('graphx-shapes.js', r('graphx-shapes.js')); row('graphx-layouts.js', r('graphx-layouts.js')); row('graphx-tree.js', r('graphx-tree.js')); row('vendor/elk.bundled.js', r('vendor/elk.bundled.js'));
console.log('dist');
row('graphx.min.js', path.join(DIST, 'graphx.min.js')); row('graphx.min.css', path.join(DIST, 'graphx.min.css')); row('graphx-mermaid.min.js', path.join(DIST, 'graphx-mermaid.min.js')); row('graphx-shapes.min.js', path.join(DIST, 'graphx-shapes.min.js')); row('graphx.bundle.min.js', path.join(DIST, 'graphx.bundle.min.js')); row('graphx.lite.min.js', path.join(DIST, 'graphx.lite.min.js'));
