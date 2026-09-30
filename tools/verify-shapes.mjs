/* Verificación de las formas (graphx-shapes.js), de su uso en el motor y de los componentes de
 * React, sin navegador.
 *   node tools/verify-shapes.mjs
 * 1. cada forma se mide y se dibuja en las dos orientaciones sin valores rotos;
 * 2. el motor pinta cada pieza con su forma, crea las puntas de arista y, en una secuencia,
 *    los marcos, las notas y las activaciones;
 * 3. React y el motor dibujan lo mismo: mismo contorno y mismos textos para cada pieza.          */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const R = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const fail = [];
const ok = (c, m) => { if (!c) fail.push(m); console.log((c ? '  ✓ ' : '  ✗ ') + m); };

/* 1 · las formas por sí solas */
console.log('— formas —');
vm.runInThisContext(R('graphx-shapes.js'));
vm.runInThisContext(R('graphx.js'));
vm.runInThisContext(R('graphx-mermaid.js'));
const S = globalThis.GraphX.shapes;
ok(S.names.length >= 50, `${S.names.length} formas registradas`);
const sample = shape => ({ id: 'x', shape, kind: 'other', label: 'Una etiqueta bastante larga para partir en líneas', subtitle: 'sub', summary: 'Una descripción de prueba para las cajas de C4.',
  rows: [{ name: 'id', type: 'int', keys: 'PK' }, { name: 'nombre', vis: '+', section: 'attr' }, { name: 'hacer()', type: 'void', vis: '-', section: 'method' }],
  span: { start: '2026-09-02', end: '2026-09-06', live: true }, score: 4, badge: 'v1', avatar: 'AR', value: 6, head: true });
let broken = [];
for (const dir of ['right', 'down']) for (const k of S.names) {
  const ctx = { dir, span: { min: Date.UTC(2026, 8, 1), max: Date.UTC(2026, 8, 10) }, maxValue: 10, now: Date.UTC(2026, 8, 4) };
  const n = sample(k), lay = S.measure(n, ctx), t = S.render(n, lay.w, lay.h, ctx, lay);
  const bad = !(lay.w > 0 && lay.h > 0) || !t.children.length || /NaN|undefined|Infinity/.test(JSON.stringify(t)) || !JSON.stringify(t).includes('gx-card');
  if (bad) broken.push(`${k}/${dir}`);
}
ok(!broken.length, `todas se miden y se dibujan en las dos orientaciones${broken.length ? ': ' + broken.join(', ') : ''}`);
ok(S.measure({ label: 'x', shape: 'fork' }, { dir: 'down' }).w > S.measure({ label: 'x', shape: 'fork' }, { dir: 'right' }).w, 'la bifurcación es perpendicular al sentido del diagrama');
ok(Object.values(S.markers).every(m => /^[MmLlHhVvAaZz0-9.,\s-]+$/.test(m.d)), `${Object.keys(S.markers).length} puntas de arista con trazados válidos`);

/* 2 · en el motor */
console.log('— motor —');
const page = mmd => `<!doctype html><html><head><style>${R('graphx.css')}</style></head><body>
<div data-gx><script type="text/plain" class="gx-mermaid">${R('examples/mermaid/' + mmd).replace(/<\/script/gi, '<\\/script')}</script></div>
<script>${R('vendor/elk.bundled.js')}</script><script>${R('graphx-shapes.js')}</script><script>${R('graphx.js')}</script><script>${R('graphx-mermaid.js')}</script><script>GraphX.mountAll(document)</script></body></html>`;
async function mount(mmd) {
  const dom = new JSDOM(page(mmd), { runScripts: 'dangerously', pretendToBeVisual: true, beforeParse(w) { w.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }); w.HTMLCanvasElement.prototype.getContext = () => null; } });
  const w = dom.window; await new Promise(r => w.addEventListener('load', r));
  const host = w.document.querySelector('[data-gx]'); await host._gx.ready; await new Promise(r => setTimeout(r, 900));
  return { w, host, gx: host._gx };
}
const mounted = {};
for (const f of ['shapes.mmd', 'class.mmd', 'er.mmd', 'gantt.mmd']) {
  const m = mounted[f] = await mount(f);
  const want = m.gx.model.M.size ? [...m.gx.model.M.values()].filter(n => n.shape && !n.children.length).length : 0;
  const got = m.host.querySelectorAll('.gx-shape').length;
  ok(got === want, `${f}: ${got} de ${want} piezas dibujadas con su forma`);
}
const cls = mounted['class.mmd'];
ok(!!cls.host.querySelector('marker[id*="-m-triangle-"]') && !!cls.host.querySelector('marker[id*="-m-diamond-"]') && !!cls.host.querySelector('marker[id*="-m-odiamond-"]'), 'clases: puntas de herencia, composición y agregación');
ok(cls.host.querySelectorAll('.gx-eend').length >= 4, 'clases: cardinalidades en los extremos');
ok(!!mounted['er.mmd'].host.querySelector('marker[id*="-m-zero-many-"]') && !!mounted['er.mmd'].host.querySelector('.gx-key.k-pk'), 'ER: patas de gallo y claves');
ok(mounted['gantt.mmd'].host.querySelectorAll('.gx-bar-fill').length >= 5 && !!mounted['gantt.mmd'].host.querySelector('.gx-bar-ms'), 'gantt: barras en su fecha y el hito');
{
  const { gx, host } = mounted['shapes.mmd'];
  gx.select('ok'); await new Promise(r => setTimeout(r, 400));
  ok(host.querySelector('.gx-shape[data-id="ok"]').classList.contains('sel'), 'una forma se selecciona como una tarjeta');
  const t = host.querySelector('.gx-shape[data-id="ok"]').getAttribute('transform');
  ok(/^translate\([^)]*\)$/.test(t), 'en reposo, una forma solo se traslada (la escala es para la animación)');
}
{
  const { host } = await mount('sequence.mmd');
  ok(host.querySelectorAll('.gx-seq-fr').length === 2 && host.querySelectorAll('.gx-seq-else').length === 1, 'secuencia: dos marcos y un separador else');
  ok(host.querySelectorAll('.gx-seq-note-b').length === 1 && host.querySelectorAll('.gx-seq-act').length >= 1, 'secuencia: la nota y la barra de activación');
  ok(!!host.querySelector('.gx-seq-p.sh-actor') && !!host.querySelector('.gx-seq-p.sh-datastore'), 'secuencia: cabeceras de actor y de base de datos');
  ok(!!host.querySelector('.gx-seq svg marker, .gx-seq marker[id*="-m-cross-"]'), 'secuencia: punta de aspa en el mensaje perdido');
  host.querySelector('.gx-seq-msg[data-id="m10"]').dispatchEvent(new host.ownerDocument.defaultView.MouseEvent('click', { bubbles: true }));
  ok([...host.querySelectorAll('.gx-seq-fr')].some(f => f.classList.contains('lit')), 'secuencia: iluminar un mensaje ilumina su marco');
}

/* 3 · React dibuja lo mismo que el motor */
console.log('— React —');
const { renderToStaticMarkup } = await import('react-dom/server');
const React = (await import('react')).default;
const RX = await import('../react/index.mjs');
ok(typeof RX.GraphX === 'function' && typeof RX.GraphXShape === 'function' && Object.keys(RX.Shapes).length === S.names.length, `componentes: GraphX, GraphXShape y ${Object.keys(RX.Shapes).length} formas con nombre`);
let compared = 0, diffs = [];
for (const f of ['shapes.mmd', 'class.mmd', 'er.mmd']) {
  const { host, gx } = mounted[f];
  const nodes = [...gx.model.M.values()].filter(n => n.shape && !n.children.length);
  for (const n of nodes) {
    const el = host.querySelector(`.gx-shape[data-id="${n.id}"]`); if (!el) continue;
    const html = renderToStaticMarkup(React.createElement(RX.GraphXShape, { node: n, dir: gx.state.dir, pad: 0 }));
    const dom = new JSDOM(`<body>${html}</body>`).window.document;
    const pick = root => ({ d: [...root.querySelectorAll('.gx-card')].map(x => x.getAttribute('d')).join('|'), t: [...root.querySelectorAll('text')].map(x => x.textContent).join('|') });
    const a = pick(el), b = pick(dom.querySelector('g'));
    compared++;
    if (a.d !== b.d || a.t !== b.t) diffs.push(`${f}:${n.id}`);
  }
}
ok(compared > 20 && !diffs.length, `${compared} piezas: mismo contorno y mismos textos en React y en el motor${diffs.length ? ' — distintas: ' + diffs.join(', ') : ''}`);
ok(/class="gx-node gx-leaf gx-shape fam-flow sh-decision d-unchanged lit has-c"/.test(renderToStaticMarkup(React.createElement(RX.Shapes.Decision, { node: { label: '¿Sí?' }, state: 'lit', color: '#c00' }))), 'estado y color: las mismas clases que usa el motor');

console.log(fail.length ? `\n❌ ${fail.length} fallos` : '\n✅ Sin fallos');
process.exit(fail.length ? 1 : 0);
