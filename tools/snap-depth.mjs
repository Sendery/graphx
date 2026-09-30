/* Vuelca el SVG de una profundidad dada, sin foco, para mirarlo rasterizado. */
import { JSDOM } from 'jsdom'; import fs from 'fs';
const [, , file, depth, out, dir] = process.argv;
const dom = new JSDOM(fs.readFileSync(file, 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true,
  beforeParse(w) { w.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }); w.HTMLCanvasElement.prototype.getContext = () => null; } });
const w = dom.window; await new Promise(r => w.addEventListener('load', r));
const host = w.document.querySelector('[data-gx]'), gx = host._gx;
await gx.ready; if (dir) await gx.setDirection(dir); await gx.expandTo(+depth); await new Promise(r => setTimeout(r, 900));
const svg = host.querySelector('.gx-svg:not(.gx-seq)').cloneNode(true), b = gx.state.bbox;
svg.querySelector('.gx-world').setAttribute('transform', '');
svg.setAttribute('class', svg.getAttribute('class') + ' ' + [...host.classList].filter(c => c.startsWith('gx-framed')).join(' '));
svg.setAttribute('viewBox', `${b.x} ${b.y} ${b.w} ${b.h}`); svg.setAttribute('width', b.w); svg.setAttribute('height', b.h); svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
/* la paleta de la instancia (colores declarados en el JSON) viaja con el SVG para poder rasterizarlo */
const inst = host.querySelector('style'); if (inst) svg.setAttribute('data-gx-theme', inst.textContent);
fs.writeFileSync(out, svg.outerHTML); console.log(out, Math.round(b.w) + '×' + Math.round(b.h)); process.exit(0);
