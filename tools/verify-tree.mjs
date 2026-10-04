/* Verificación de los árboles de ficheros, sin navegador.
 *   node tools/verify-tree.mjs
 * 1. el constructor (graphx-tree.js): rutas, salida de `tree` y git, con renombrados y borrados;
 * 2. el motor con el layout `tree`: filtro por rutas, «··· N más», clic en carpetas y ficheros,
 *    detalle, teclado, búsqueda, columnas y líneas del árbol;
 * 3. React dibuja las tarjetas del árbol igual que el motor, y el ensamblador valida el JSON.     */
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
const wait = ms => new Promise(r => setTimeout(r, ms));

/* 1 · constructor */
console.log('— constructor —');
vm.runInThisContext(R('graphx-shapes.js'));
vm.runInThisContext(R('graphx-tree.js'));
const TR = globalThis.GraphX.tree;
const paths = ['src/main/java/App.java', 'src/main/java/Util.java', 'README.md', 'docs/guía rápida.md', 'docs/a10.md', 'docs/a9.md', 'package.json', '.gitignore', 'Makefile'];
const spec = TR.fromPaths(paths.map(p => ({ path: p, size: 1200, lines: 40 })).concat([{ path: 'src/new.ts', status: 'A', additions: 12, deletions: 0 }]), { root: 'demo' });
const byPath = p => spec.nodes.find(n => n.path === p);
ok(byPath('src/main/java') && byPath('src/main/java').label === 'main/java', 'las cadenas de carpetas con un solo hijo se unen (main/java, como GitHub)');
ok(spec.nodes.every(n => /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(n.id)), 'ids válidos para GraphX, también con espacios y tildes en la ruta');
const rootKids = spec.nodes.filter(n => n.parent === 'd:.').map(n => n.label);
ok(rootKids.join(',') === 'docs,src,.gitignore,Makefile,package.json,README.md', `carpetas primero y luego ficheros, por nombre (${rootKids.join(', ')})`);
ok(spec.nodes.filter(n => n.parent === byPath('docs').id).map(n => n.label).join(',') === 'a9.md,a10.md,guía rápida.md', 'orden natural de los números (a9 antes que a10)');
ok(byPath('.').tree.files === 10 && byPath('.').tree.dirs === 3 && byPath('Makefile').badge === 'MK' && byPath('.gitignore').badge === 'CFG', 'cuentas de la raíz e insignias de los ficheros sin extensión');
ok(spec.focus && spec.focus.key === 'changes' && byPath('src/new.ts').delta === 'added' && byPath('src').tree.changed.length === 1, 'con cambios, el árbol se abre filtrado a ellos');
const tt = `.
├── README.md
├── src
│\u00a0\u00a0 ├── [ 1.5K]  a.js
│\u00a0\u00a0 └── lib
│\u00a0\u00a0     └── b.js
├── empty/
└── package.json

3 directories, 4 files`;
const pt = TR.parseTree(tt);
ok(pt.entries.map(e => e.path).join(',') === 'README.md,src/a.js,src/lib/b.js,empty,package.json' && pt.entries[1].size === 1536 && pt.entries[3].dir, 'la salida de `tree` (con espacios duros, tamaños y carpetas vacías)');
const g = TR.fromGit({
  files: 'a.js\nsrc/b.js\nsrc/new.js\n',
  numstat: '3\t1\ta.js\n10\t0\tsrc/new.js\n0\t0\tsrc/{old => moved}.js\n0\t7\tgone.js\n',
  nameStatus: 'M\ta.js\nA\tsrc/new.js\nR100\tsrc/old.js\tsrc/moved.js\nD\tgone.js\n'
}, { root: 'r' });
const gp = p => g.nodes.find(n => n.path === p);
ok(gp('gone.js') && gp('gone.js').delta === 'removed' && gp('src/moved.js').renamed && !gp('src/old.js') && gp('a.js').files[0].additions === 3, 'git: borrados, renombrados (sin la ruta vieja) y líneas');

/* 2 · motor */
console.log('— motor —');
const page = sp => `<!doctype html><html><head><style>${R('graphx.css')}</style></head><body><div data-gx><script type="application/json" class="gx-spec">${JSON.stringify(sp).replace(/</g, '\\u003c')}</script></div>
<script>${R('graphx-shapes.js')}</script><script>${R('graphx-layouts.js')}</script><script>${R('graphx.js')}</script><script>GraphX.mountAll(document)</script></body></html>`;
async function mount(sp) {
  const errs = [];
  const dom = new JSDOM(page(sp), { runScripts: 'dangerously', pretendToBeVisual: true, beforeParse(w) { w.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }); w.HTMLCanvasElement.prototype.getContext = () => null; w.console.error = (...a) => errs.push(a.join(' ')); } });
  const w = dom.window; await new Promise(r => w.addEventListener('load', r));
  const host = w.document.querySelector('[data-gx]'); await host._gx.ready; await wait(700);
  return { w, host, gx: host._gx, errs };
}
const big = TR.fromPaths([
  'src/app/main.ts', 'src/app/routes.ts', 'src/app/store.ts', 'src/ui/Button.tsx', 'src/ui/Card.tsx', 'src/ui/Modal.tsx', 'src/lib/fmt.ts', 'src/lib/http.ts',
  'docs/intro.md', 'docs/api.md', 'test/app.test.ts', 'package.json', 'README.md'
].map(p => ({ path: p, size: 900, lines: 30 })).concat([{ path: 'src/ui/Tabs.tsx', status: 'A', additions: 80, deletions: 0 }, { path: 'src/lib/http.ts', status: 'M', additions: 5, deletions: 2 }]), { root: 'app' });
const m = await mount(big);
const { w, host, gx } = m;
const S = gx.state, idOf = p => big.nodes.find(n => n.path === p).id, el = id => host.querySelector(`.gx-node[data-id="${id}"]`);
const click = (id, sel) => (sel ? el(id).querySelector(sel) : el(id)).dispatchEvent(new w.MouseEvent('click', { bubbles: true, detail: 1 }));
ok(host.classList.contains('gx-flat') && S.focus && S.focus.ids.size === 2, 'se abre con el filtro de cambios (2 ficheros)');
ok(S.visible.has(idOf('src/ui/Tabs.tsx')) && !S.visible.has(idOf('src/ui/Card.tsx')) && !S.visible.has(idOf('docs')), 'el filtro deja abiertas solo las ramas que llevan a los cambios');
ok(host.querySelectorAll('.gx-deco .gx-more').length === 4 && /3 más/.test(host.querySelector(`.gx-more[data-more="${idOf('src/ui')}"]`).textContent), '«··· N más» en cada carpeta filtrada, con lo que oculta');
ok(!!el(idOf('src')) && el(idOf('src')).classList.contains('sh-folder-open') && !host.querySelector('.gx-group'), 'una carpeta abierta es una tarjeta de carpeta abierta, no un contenedor');
const nWires = () => host.querySelectorAll('.gx-wire.k-elbow:not(.more)').length;
ok(nWires() === S.visible.size - 1 && host.querySelectorAll('.gx-wire.more').length === 4, `un codo por pieza visible (${nWires()}) y una línea discontinua por «más»`);
ok(!![...host.querySelectorAll('.gx-wire')].find(x => x.classList.contains('d-added')), 'la línea hacia un fichero nuevo lleva el color del cambio');
ok(host.querySelector('.gx-filter.on') && /Cambios/.test(host.querySelector('.gx-filter').textContent), 'la barra enseña el filtro activo');
host.querySelector(`.gx-more[data-more="${idOf('src/ui')}"]`).dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await wait(700);
ok(S.visible.has(idOf('src/ui/Card.tsx')) && el(idOf('src/ui/Card.tsx')).classList.contains('off'), '«más» enseña lo oculto de esa carpeta, apagado');
/* detalle de un fichero: la tarjeta crece por abajo y la de debajo baja */
const fid = idOf('src/lib/http.ts'), r0 = S.rects.get(fid), below = S.order[S.order.indexOf(fid) + 1], b0 = S.rects.get(below).y;
click(fid); await wait(700);
const r1 = S.rects.get(fid);
ok(S.detail.has(fid) && r1.h > r0.h + 30 && Math.abs(r1.y - r0.y) < .5 && S.rects.get(below).y > b0 + 30, 'clic en un fichero: abre su detalle; la tarjeta crece hacia abajo y empuja a las de debajo');
ok(el(fid).classList.contains('det') && /Estado/.test(el(fid).textContent) && !!el(fid).querySelector('.gx-dbar-a') && !el(fid).style.clipPath, 'el detalle se dibuja (y sin recorte al acabar la animación)');
click(fid); await wait(700);
ok(!S.detail.has(fid) && Math.abs(S.rects.get(fid).h - r0.h) < .5, 'otro clic lo cierra');
/* carpetas: el chevron abre su detalle; el clic la pliega y la despliega */
const ui = idOf('src/ui');
click(ui, '.gx-det'); await wait(700);
ok(S.detail.has(ui) && el(ui).querySelectorAll('.gx-dfill').length >= 1, 'el chevron de una carpeta abre su detalle (reparto por extensión)');
click(ui); await wait(700);
ok(!host.querySelector('.gx-panel.on'), 'plegar o desplegar con un clic no abre el panel');
ok(!S.expanded.has(ui) && el(ui).classList.contains('sh-folder') && el(ui).querySelectorAll('.gx-stack').length === 2, 'clic en una carpeta abierta: se pliega y vuelve a ser la tarjeta que agrupa, con su pila');
ok(!!el(ui).querySelector('.gx-hits') && /1/.test(el(ui).querySelector('.gx-hits').textContent), 'plegada, cuenta las coincidencias del filtro que lleva dentro');
click(ui); await wait(700);
ok(S.expanded.has(ui) && el(ui).classList.contains('sh-folder-open'), 'y otro clic la vuelve a abrir');
/* teclado: ↓ ↑ → ← como en un explorador */
gx.select(null); S.selected = null;
const key = k => host.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true }));
key('ArrowDown'); ok(S.selected === S.order[0], 'teclado: ↓ pone el cursor en la primera tarjeta');
key('ArrowDown'); const second = S.selected; ok(second === S.order[1], 'teclado: ↓ baja a la siguiente');
key('ArrowLeft'); await wait(700); ok(!S.expanded.has(second) || M_children(second) === 0, 'teclado: ← pliega la carpeta abierta');
function M_children(id) { return gx.model.M.get(id).children.length; }
key('ArrowRight'); await wait(700); ok(S.expanded.has(second), 'teclado: → la abre');
key('ArrowRight'); ok(gx.model.M.get(S.selected).parent === second, 'teclado: → otra vez entra en su primer hijo');
key('ArrowLeft'); ok(S.selected === second, 'teclado: ← en un hijo sube a su carpeta');
/* el camino al pasar por encima */
await gx.reveal(fid, true); await wait(300);
el(fid).dispatchEvent(new w.Event('pointerenter'));
const lit = [...host.querySelectorAll('.gx-wire.lit')].length;
ok(lit >= gx.model.M.get(fid).depth * 2 && !host.querySelector('.gx-world').classList.contains('gx-dim'), `al pasar por un fichero se ilumina su camino desde la raíz (${lit} tramos) sin apagar el resto`);
el(fid).dispatchEvent(new w.Event('pointerleave'));
/* quitar el filtro devuelve lo que estaba abierto antes */
await gx.clearFilter();
ok(!S.focus && S.expanded.has(idOf('.')) && !S.expanded.has(idOf('src')) && !host.querySelector('.gx-more') && !host.querySelector('.gx-filter.on'), 'quitar el filtro devuelve el árbol a como estaba antes');
/* búsqueda: filtra el árbol mientras se escribe */
const input = host.querySelector('.gx-search input');
input.value = 'modal'; input.dispatchEvent(new w.Event('input')); await wait(1100);
ok(S.focus && S.focus.key === 'search' && S.focus.ids.size === 1 && S.visible.has(idOf('src/ui/Modal.tsx')) && !S.visible.has(idOf('docs')), 'buscar «modal» deja solo el camino hasta Modal.tsx');
input.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(800);
ok(!S.focus, 'Esc en la búsqueda quita el filtro');
/* columnas */
await gx.expandTo(9); await gx.setDirection('right'); await wait(300);
const kids = gx.model.M.get(idOf('src')).children.map(c => S.rects.get(c)), rs = S.rects.get(idOf('src'));
/* las carpetas abiertas tienen 40 de cabecera: ahí se anclan las líneas (el detalle abierto cuelga debajo) */
const mid = (kids[0].y + 20 + kids[kids.length - 1].y + 20) / 2;
if (Math.abs(rs.y + 20 - mid) >= 30) console.log('    ', JSON.stringify({ rs, kids }));
ok(kids.every(k => k.x > rs.x + rs.w) && Math.abs(rs.y + 20 - mid) < 30, 'columnas: los hijos a la derecha y la carpeta centrada en ellos');
ok(host.querySelectorAll('.gx-wire.k-cstem').length >= 3 && [...host.querySelectorAll('.gx-wire.k-celbow:not(.more)')].every(p => /Q|H/.test(p.getAttribute('d'))), 'columnas: un tallo por carpeta y codos redondeados hacia cada hijo');
ok(!m.errs.length, `sin errores en la consola${m.errs.length ? ': ' + m.errs[0] : ''}`);

/* un spec escrito a mano: sin cuentas, con un filtro con nombre y `focus` por rutas */
{
  const sp = { title: 't', layout: { mode: 'tree' }, nodes: [
    { id: 'r', label: 'raíz', shape: 'folder', openShape: 'folder-open', path: '.' },
    { id: 'a', label: 'a', parent: 'r', shape: 'folder', openShape: 'folder-open', path: 'a' },
    { id: 'a1', label: 'uno.js', parent: 'a', shape: 'file', ext: 'js', path: 'a/uno.js' },
    { id: 'a2', label: 'dos.js', parent: 'a', shape: 'file', ext: 'js', path: 'a/dos.js' },
    { id: 'b', label: 'b.md', parent: 'r', shape: 'file', ext: 'md', path: 'b.md' }],
    filters: [{ label: 'Docs', query: '.md' }], focus: { paths: ['a/dos.js'] } };
  const { host: h2, gx: g2 } = await mount(sp);
  ok(g2.state.visible.has('a2') && !g2.state.visible.has('a1') && !g2.state.visible.has('b'), '`focus` por rutas en un JSON escrito a mano');
  ok(g2.model.M.get('a').tree && g2.model.M.get('a').tree.files === 2, 'sin cuentas en el JSON, el motor las calcula');
  h2.querySelector('.gx-filters button').click(); await wait(800);
  ok(g2.state.focus.key === 'f0' && g2.state.visible.has('b') && !g2.state.visible.has('a2'), 'los filtros con nombre de la barra (`filters`)');
}

/* regresiones: lo que encontraron las revisiones */
console.log('— regresiones —');
{
  /* sin raíz y con una referencia hacia una carpeta que el filtro oculta entera */
  const sp = TR.fromPaths([{ path: 'a/n.js', status: 'A', additions: 3 }, 'a/m.js', 'b/z.js'], { root: false });
  sp.edges = [{ id: 'e1', from: sp.nodes.find(n => n.path === 'a/n.js').id, to: sp.nodes.find(n => n.path === 'b/z.js').id }];
  const { host: h, gx: g, errs } = await mount(sp);
  ok(!errs.length && h.querySelector('.gx-more[data-more=" gx-roots"]'), 'una raíz que el filtro oculta entera: sin errores y con su «··· N más»');
  await g.reveal(sp.edges[0].to); await wait(500);
  ok(g.state.visible.has(sp.edges[0].to), 'reveal enseña una pieza de una raíz podada');
  await g.expandTo(9); ok(!g.state.focus && g.state.visible.size === sp.nodes.length, 'expandTo quita el filtro y lo enseña todo');
}
{
  const sp = TR.fromPaths(['src/a.js', 'src/b.js', 'README.md'], { root: 'r' });
  const { host: h, gx: g } = await mount(sp);
  ok(h.querySelector('.gx-tools .gx-btn[aria-label="Solo cambios"]').style.display === 'none', 'sin cambios, no hay botón «Solo cambios»');
  const before = g.state.visible.size;
  await g.filter([], { label: 'nada' });
  ok(g.state.visible.size === before && /Sin resultados/.test(h.querySelector('.gx-filter').textContent) && h.querySelector('.gx-filter').classList.contains('warn'), 'un filtro sin coincidencias no pliega el árbol y lo avisa');
  await g.clearFilter();
  const inp = h.querySelector('.gx-search input'), w2 = h.ownerDocument.defaultView;
  inp.value = 'a.js'; inp.dispatchEvent(new w2.Event('input')); inp.dispatchEvent(new w2.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(600);
  ok(!g.state.focus, 'Esc antes de que salte la búsqueda: no se aplica después');
  /* foco del teclado: abrir con → deja el foco en la carpeta, y ↓ sigue funcionando */
  const src = sp.nodes.find(n => n.path === 'src').id;
  await g.toggle(src); await wait(100);
  const el2 = h.querySelector(`.gx-node[data-id="${src}"]`); el2.focus(); g.state.selected = src;
  h.dispatchEvent(new w2.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })); await wait(800);
  ok(h.ownerDocument.activeElement && h.ownerDocument.activeElement.dataset && h.ownerDocument.activeElement.dataset.id === src, 'plegar con ← rehace la tarjeta y el foco sigue en ella');
}
{
  /* una búsqueda sobre el filtro de cambios: al vaciarla, vuelve a los cambios */
  const { host: h, gx: g } = await mount(big);
  const inp = h.querySelector('.gx-search input'), w2 = h.ownerDocument.defaultView;
  inp.value = 'button'; inp.dispatchEvent(new w2.Event('input')); await wait(1000);
  ok(g.state.focus.key === 'search', 'buscar sobre el filtro de cambios');
  await g.clearFilter();
  ok(g.state.focus && g.state.focus.key === 'changes', 'vaciar la búsqueda vuelve al filtro de cambios');
  inp.value = 's'; inp.dispatchEvent(new w2.Event('input')); await wait(700);
  ok(g.state.focus.key === 'changes', 'una sola letra no filtra (no despliega el repo entero)');
}
{
  const g2 = TR.fromGit({ numstat: '1\t2\t"docs/gu\\303\\255a2.md" => "docs/gu\\303\\255a3.md"\n3\t1\t"caf\\303\\251.md"' }, { root: 'r' });
  const z = TR.fromGit({ numstatZ: '2\t0\t\0old name.js\0new name.js\0', nameStatusZ: 'R090\0old name.js\0new name.js\0' }, { root: 'r' });
  ok(g2.nodes.some(n => n.path === 'docs/guía3.md' && n.renamed) && g2.nodes.some(n => n.path === 'café.md') && z.nodes.some(n => n.path === 'new name.js' && n.renamed), 'rutas que git cita entre comillas (también en renombrados) y el formato -z');
  const pt2 = TR.parseTree('\u001b[01;34mproj\u001b[0m\n├── [drwxr-xr-x ana  4.0K]  src\n│   └── [-rw-r--r-- ana   120]  ./src/a.js\n\nmas\n└── x.txt\n');
  ok(pt2.entries.map(e => e.path).join(',') === 'proj/src/a.js,mas/x.txt', '`tree` con colores, -p/-u, -f y varias raíces');
  ok(TR.fromPaths(['a b.js', 'a-20b.js', './x/../y.js', '/abs/z.js']).nodes.map(n => n.id).join(',') === 'd:.,d:abs,f:abs/z.js,f:a-20b.js,f:a-2d20b.js,f:y.js', 'ids estables (el «-» también se escapa) y rutas con . y .. resueltas');
}

/* 3 · React y ensamblador */
console.log('— React y ensamblador —');
const { renderToStaticMarkup } = await import('react-dom/server');
const React = (await import('react')).default;
const RX = await import('../react/index.mjs');
let diffs = [], n = 0;
await gx.setDirection('down'); await wait(300);
for (const node of gx.model.M.values()) {
  const e = el(node.id); if (!e || node.children.length && S.expanded.has(node.id)) continue;
  /* el layout iguala el ancho de los ficheros hermanos: React recibe ese mismo ancho */
  const html = renderToStaticMarkup(React.createElement(RX.GraphXShape, { node, dir: S.dir, pad: 0, width: S.rects.get(node.id).w, height: S.rects.get(node.id).h }));
  const d = new JSDOM(`<body>${html}</body>`).window.document;
  const pick = r => ({ d: [...r.querySelectorAll('.gx-card')].map(x => x.getAttribute('d')).join('|'), t: [...r.querySelectorAll('text')].map(x => x.textContent).join('|') });
  const a = pick(e), b = pick(d.querySelector('g')); n++;
  if (a.d !== b.d || a.t !== b.t) diffs.push(node.id);
}
ok(n >= 8 && !diffs.length, `${n} tarjetas del árbol: mismo contorno y textos en React y en el motor${diffs.length ? ' — distintas: ' + diffs.join(', ') : ''}`);
ok(typeof RX.tree.fromPaths === 'function' && !!RX.Shapes.FolderOpen, 'el paquete de React exporta el constructor y las formas del árbol');
const tmp = path.join(ROOT, '.verify-tree.json');
fs.writeFileSync(tmp, JSON.stringify(big));
let out = '';
try { out = execFileSync(process.execPath, [path.join(ROOT, 'graphx-build.mjs'), tmp, '--check', '--strict'], { encoding: 'utf8' }); } catch (e) { out = String(e.stdout || e.message); }
fs.unlinkSync(tmp);
ok(/✓ válido/.test(out), 'el JSON del constructor pasa el ensamblador con --strict');

console.log(fail.length ? `\n❌ ${fail.length} fallos` : '\n✅ Sin fallos');
process.exit(fail.length ? 1 : 0);
