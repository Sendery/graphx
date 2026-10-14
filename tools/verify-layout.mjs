/* Verificación del layout del grafo (ELK) y del layout sobre ejes, sin navegador.
 *   node tools/verify-layout.mjs
 * 1. ELK: tarjetas de un mismo ancho, carriles sueltos con su caja alrededor de sus piezas, troncos
 *    compartidos con una sola etiqueta y orígenes en la primera columna;
 * 2. ejes: bandas, números, mezcla, carriles como bandas y lo que no tiene posición;
 * 3. el builder avisa de bandas y números que no existen;
 * 4. bucles de realimentación: signos, retrasos, R/B, oscilación, insignias y avisos.             */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const R = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const fail = [];
const ok = (c, m) => { if (!c) fail.push(m); console.log((c ? '  ✓ ' : '  ✗ ') + m); };
async function mountSpec(spec, fx) {
  const html = `<!doctype html><html><head><style>${R('graphx.css')}</style></head><body><div data-gx><script type="application/json" class="gx-spec">${JSON.stringify(spec).replace(/</g, '\\u003c')}</script></div>
<script>${R('vendor/elk.bundled.js')}</script><script>${R('graphx-shapes.js')}</script><script>${R('graphx-layouts.js')}</script><script>${R('graphx.js')}</script>${fx ? `<script>${R('graphx-fx.js')}</script>` : ''}<script>GraphX.mountAll(document)</script></body></html>`;
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, beforeParse(w) { w.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }); w.HTMLCanvasElement.prototype.getContext = () => null; } });
  const w = dom.window; await new Promise(r => w.addEventListener('load', r));
  const host = w.document.querySelector('[data-gx]'); await host._gx.ready; await new Promise(r => setTimeout(r, 900));
  return { host, gx: host._gx };
}
const inside = (a, b) => a.x >= b.x - .5 && a.y >= b.y - .5 && a.x + a.w <= b.x + b.w + .5 && a.y + a.h <= b.y + b.h + .5;
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const cx = r => r.x + r.w / 2, cy = r => r.y + r.h / 2;

/* 1 · ELK */
console.log('— grafo —');
const lanes = {
  title: 't', lanes: [{ id: 'l1', label: 'Uno' }, { id: 'l2', label: 'Un carril con un nombre largo de verdad' }, { id: 'l3', label: 'Tres' }],
  nodes: [
    { id: 'a', lane: 'l1', label: 'A', summary: 's' }, { id: 'b', lane: 'l1', label: 'Una etiqueta bastante más larga', summary: 's' },
    { id: 'c', lane: 'l2', label: 'C', summary: 's' }, { id: 'd', lane: 'l3', label: 'D', summary: 's' }, { id: 'e', lane: 'l3', label: 'E', summary: 's' }],
  edges: [
    { id: 'x1', from: 'a', to: 'd', kind: 'event', label: 'pedido' }, { id: 'x2', from: 'b', to: 'd', kind: 'event', label: 'pedido' },
    { id: 'x3', from: 'c', to: 'e', kind: 'call', label: 'lee' }, { id: 'x4', from: 'a', to: 'c', kind: 'call' }]
};
{
  const { host, gx } = await mountSpec(lanes), r = id => gx.state.rects.get(id);
  const ws = ['a', 'b', 'c', 'd', 'e'].map(id => Math.round(r(id).w));
  ok(new Set(ws).size === 1, `tarjetas del mismo ancho (${ws[0]})`);
  ok(['a', 'b'].every(id => inside(r(id), r('l1'))) && inside(r('c'), r('l2')) && ['d', 'e'].every(id => inside(r(id), r('l3'))), 'carril suelto: su caja envuelve a sus piezas');
  ok(r('l1').x + r('l1').w <= r('l2').x && r('l2').x + r('l2').w <= r('l3').x, 'carriles sueltos: en orden y sin pisarse');
  const band = gx.state.bands.find(b => b.id === 'l2');
  ok(band && band.w >= 290, `la columna de un carril estrecho cabe su cabecera (${band && Math.round(band.w)} px)`);
  const labs = [...host.querySelectorAll('.gx-elabel')].map(l => l.textContent);
  ok(labs.filter(t => t === 'pedido').length === 1 && labs.includes('lee'), 'tronco: dos aristas iguales hacia D, una sola etiqueta');
}
{
  const fit = JSON.parse(JSON.stringify(lanes)); fit.layout = { cards: 'fit', trunks: false };
  const { host, gx } = await mountSpec(fit), r = id => gx.state.rects.get(id);
  ok(r('a').w < r('b').w, '`cards: "fit"`: cada tarjeta a su texto');
  ok([...host.querySelectorAll('.gx-elabel')].filter(l => l.textContent === 'pedido').length === 2, '`trunks: false`: cada arista con su etiqueta');
}
{
  const flat = { title: 't', layout: { frames: false }, lanes: lanes.lanes, nodes: lanes.nodes, edges: lanes.edges };
  const { gx } = await mountSpec(flat), r = id => gx.state.rects.get(id);
  ok(['a', 'b'].every(id => inside(r(id), r('l1'))) && !gx.state.bands.length, 'sin marcos, el carril sigue siendo una caja');
}
{
  const src = { title: 't', nodes: [{ id: 'g', label: 'Grupo', summary: 's' }, { id: 'p', parent: 'g', label: 'P', summary: 's' }, { id: 'q', parent: 'g', label: 'Q', summary: 's' }, { id: 'z', parent: 'g', label: 'Origen', summary: 's' }, { id: 'out', label: 'Fuera', summary: 's' }],
    edges: [{ id: 'y1', from: 'p', to: 'q' }, { id: 'y2', from: 'z', to: 'out' }], initialDepth: 2 };
  const { gx } = await mountSpec(src), r = id => gx.state.rects.get(id);
  ok(r('z').x <= r('p').x + 1, 'un origen empieza en la primera columna de su contenedor');
}

/* 2 · ejes */
console.log('— ejes —');
{
  const spec = JSON.parse(R('examples/axes/blueprint.json'));
  const { host, gx } = await mountSpec(spec), r = id => gx.state.rects.get(id);
  const byY = b => spec.nodes.filter(n => n.at.y === b).map(n => r(n.id));
  const rows = ['customer', 'frontstage', 'backstage', 'support'].map(byY);
  ok(spec.nodes.every(n => r(n.id)), 'blueprint: todas las piezas colocadas');
  ok(rows.every((l, i) => i === 0 || Math.min(...l.map(q => q.y)) > Math.max(...rows[i - 1].map(q => q.y + q.h))), 'blueprint: cada banda debajo de la anterior');
  const cols = ['find', 'buy', 'pay', 'wait'].map(b => spec.nodes.filter(n => n.at.x === b).map(n => cx(r(n.id))));
  ok(cols.every((l, i) => i === 0 || Math.min(...l) > Math.max(...cols[i - 1])), 'blueprint: las etapas de izquierda a derecha');
  ok(host.querySelectorAll('.gx-deco .gx-ax-line').length === 3 && host.querySelectorAll('.gx-deco .gx-ax-linet').length === 3, 'blueprint: las tres líneas con nombre');
  ok(host.classList.contains('gx-mode-axes') && !host.classList.contains('gx-framed'), 'el modo se elige solo con `axes`, sin marcos');
}
{
  const spec = JSON.parse(R('examples/axes/wardley.json'));
  const { gx } = await mountSpec(spec), r = id => gx.state.rects.get(id), list = spec.nodes.map(n => r(n.id));
  ok(list.every((a, i) => list.every((b, j) => i >= j || !overlap(a, b))), 'Wardley: ninguna pieza pisa a otra');
  ok(cx(r('cloud')) > cx(r('reco')) && cy(r('buyer')) < cy(r('cloud')), 'Wardley: más evolucionado a la derecha, más visible arriba');
}
{
  const spec = { title: 't', lanes: [{ id: 'w', label: 'Web' }, { id: 'p', label: 'Pagos' }],
    axes: { y: { bands: 'lanes' }, x: { range: [0, 10] } },
    nodes: [{ id: 'a', lane: 'w', label: 'A', summary: 's', at: { x: 9 } }, { id: 'b', lane: 'w', label: 'B', summary: 's', at: { x: 8.8 } }, { id: 'c', lane: 'p', label: 'C', summary: 's', at: { x: 1 } }, { id: 'd', lane: 'p', label: 'D', summary: 's' }] };
  const { host, gx } = await mountSpec(spec), r = id => gx.state.rects.get(id);
  ok(!overlap(r('a'), r('b')) && Math.abs(cx(r('a')) - cx(r('b'))) < 40, 'mezcla: dos piezas en el mismo punto abren otra fila');
  ok(cy(r('c')) > Math.max(cy(r('a')), cy(r('b'))), 'carriles como bandas: cada pieza en la banda de su carril');
  ok(r('d').x + r('d').w < r('c').x && [...host.querySelectorAll('.gx-ax-bandt.lost')].some(t => /sin posición/.test(t.textContent)), 'lo que no tiene número va aparte, rotulado');
}

/* 3 · builder */
console.log('— builder —');
const tmp = path.join(ROOT, 'examples', '.verify-axes.json');
fs.writeFileSync(tmp, JSON.stringify({ title: 't', axes: { preset: 'blueprint', x: { range: [0, 1] } }, nodes: [{ id: 'a', label: 'A', summary: 's', at: { x: 2, y: 'nada' } }, { id: 'b', label: 'B', summary: 's', at: { x: .5 } }] }));
let out = '';
try { out = execFileSync(process.execPath, [path.join(ROOT, 'graphx-build.mjs'), tmp, '--check'], { encoding: 'utf8', stdio: 'pipe' }); } catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
fs.unlinkSync(tmp);
ok(/at\.y «nada» no es una banda/.test(out), 'avisa de una banda que no existe');
ok(/at\.x debe ser un número entre 0 y 1/.test(out), 'avisa de un número fuera del rango');
ok(/nodo b: sin at\.y/.test(out), 'avisa de una pieza sin posición');

/* 4 · bucles */
console.log('— bucles —');
{
  vm.runInThisContext(R('graphx-fx.js'));
  const FXM = globalThis.GraphX.fx;
  const spec = JSON.parse(R('examples/systems/tienda.json')), out = FXM.findLoops(spec), by = new Map(out.loops.map(l => [l.name, l]));
  ok(out.loops.map(l => l.name).join(',') === 'B1,R1,B2', `tres bucles, del más corto al más largo (${out.loops.map(l => l.name).join(', ')})`);
  ok(by.get('R1').type === 'R' && by.get('B1').type === 'B' && by.get('B2').type === 'B', 'un número par de «−» refuerza; uno impar equilibra');
  ok(by.get('B1').osc && by.get('B2').osc && !by.get('R1').osc, 'equilibra con retraso: puede oscilar');
  ok(by.get('B1').goal && by.get('R1').label && !out.unmatched.length, 'los bucles nombrados en `loops` reciben su nombre y su meta');
  const ids = 'abcdefg'.split(''), full = { edges: ids.flatMap(a => ids.filter(b => b !== a).map(b => ({ id: a + b, from: a, to: b, polarity: '+' }))) };
  const big = FXM.findLoops(full);
  ok(big.truncated && big.loops.length === 60, 'un grafo denso se corta en 60 bucles y lo dice');
  ok(!FXM.findLoops({ edges: [{ id: 'x', from: 'a', to: 'b' }, { id: 'y', from: 'b', to: 'a' }] }).loops.length, 'sin polarity no hay bucle causal');
}
{
  const { host } = await mountSpec(JSON.parse(R('examples/systems/tienda.json')), true);
  ok(host.querySelectorAll('.gx-loop').length === 3 && host.querySelectorAll('.gx-lg-loops li').length === 3, 'una insignia y una línea de leyenda por bucle');
  ok(host.querySelectorAll('.gx-epol').length === 12 && host.querySelectorAll('.gx-epol.neg').length === 2, 'el signo junto a cada punta, dos «−»');
  ok(host.querySelectorAll('.gx-edelay').length === 4 && [...host.querySelectorAll('.gx-edelayt')].some(t => t.textContent === '6 semanas'), 'dos rayas y el tiempo en las aristas con retraso');
}
{
  const spec = { title: 't', collapsed: ['g'], nodes: [{ id: 'g', label: 'G', summary: 's' }, { id: 'a', parent: 'g', label: 'A', summary: 's' }, { id: 'b', parent: 'g', label: 'B', summary: 's' }],
    edges: [{ id: 'x', from: 'a', to: 'b', polarity: '+' }, { id: 'y', from: 'b', to: 'a', polarity: '-' }] };
  const { host } = await mountSpec(spec, true);
  ok(!host.querySelectorAll('.gx-loop').length && host.querySelectorAll('.gx-lg-loops li').length === 1, 'un bucle plegado dentro de una pieza no tiene insignia, pero sigue en la leyenda');
}
{
  const tmp2 = path.join(ROOT, 'examples', '.verify-loops.json');
  fs.writeFileSync(tmp2, JSON.stringify({ title: 't', nodes: [{ id: 'a', label: 'A', summary: 's' }, { id: 'b', label: 'B', summary: 's' }],
    edges: [{ id: 'x', from: 'a', to: 'b', polarity: '+' }, { id: 'y', from: 'b', to: 'a', polarity: 'raro' }], loops: [{ edges: ['x', 'y'], label: 'no cierra' }] }));
  let o2 = '';
  try { o2 = execFileSync(process.execPath, [path.join(ROOT, 'graphx-build.mjs'), tmp2, '--check'], { encoding: 'utf8', stdio: 'pipe' }); } catch (e) { o2 = (e.stdout || '') + (e.stderr || ''); }
  fs.unlinkSync(tmp2);
  ok(/polarity «raro» desconocida/.test(o2), 'el builder avisa de una polaridad desconocida');
  ok(/loops «no cierra»: sus aristas no forman un bucle/.test(o2), 'y de un bucle nombrado que no cierra');
}

console.log(fail.length ? `\n❌ ${fail.length} fallos` : '\n✅ Sin fallos');
process.exit(fail.length ? 1 : 0);
