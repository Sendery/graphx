/* Verificación sin navegador del motor (jsdom). Chrome headless se cuelga con estas páginas.
 *   node verify.mjs examples/stack-202.html [--snapshot out.svg]
 * --snapshot vuelca el SVG del estado final con los tokens resueltos, para rasterizarlo
 * con rsvg-convert y mirarlo.                                                          */
import { JSDOM } from 'jsdom';
import fs from 'fs';

const FILE = process.argv[2] || 'examples/pr-review-stack-202.html';
const snapIdx = process.argv.indexOf('--snapshot');
const dom = new JSDOM(fs.readFileSync(FILE, 'utf8'), {
  runScripts: 'dangerously', pretendToBeVisual: true,
  beforeParse(w) {
    w.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
    w.Element.prototype.setPointerCapture = function () {};
    if (!w.PointerEvent) w.PointerEvent = class PointerEvent extends w.MouseEvent {
      constructor(t, o = {}) { super(t, o); this.pointerId = o.pointerId || 1; this.pointerType = o.pointerType || 'mouse'; }
    };
    w.HTMLCanvasElement.prototype.getContext = () => null;
    w.console.error = (...a) => { process.stderr.write('[page] ' + a.join(' ') + '\n'); };
  }
});
const { window: w } = dom; const d = w.document;
await new Promise(r => w.addEventListener('load', r));
const wait = ms => new Promise(r => w.setTimeout(r, ms));
const fail = []; const ok = (c, m) => { if (!c) fail.push(m); console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const host = d.querySelector('[data-gx]');
const gx = host._gx;
ok(!!gx, 'el motor se montó sobre [data-gx]');
await gx.ready; await wait(700);
const S = gx.state, G = gx.model;
const count = sel => host.querySelectorAll(sel).length;

console.log('— montaje —');
ok(count('.gx-lane') === 5, `5 carriles como contenedores (${count('.gx-lane')})`);
ok(count('.gx-leaf') > 5, `tarjetas pintadas a profundidad inicial (${count('.gx-leaf')})`);
ok(count('.gx-edge') > 5, `aristas pintadas (${count('.gx-edge')})`);
const onDepth = host.querySelector('.gx-seg-b.on');
ok(onDepth && onDepth.textContent === 'Concepto', 'el selector marca la profundidad inicial «Concepto»');
ok(count('.gx-edge.lifted') > 0, `hay aristas elevadas al contenedor visible (${count('.gx-edge.lifted')})`);
const leaf0 = host.querySelector('.gx-leaf');
ok(/translate\(/.test(leaf0.getAttribute('transform')), 'las tarjetas tienen posición del layout');

console.log('— conectividad entre niveles —');
const concepts = S.vedges.find(v => v.from === 'c-repo' && v.to === 'c-kit');
ok(!!concepts && concepts.list.length >= 3, `Operations → Kit agrupa ${concepts ? concepts.list.length : 0} conexiones de nivel método`);

console.log('— expandir en su sitio —');
const before = count('.gx-node');
await gx.toggle('c-job'); await wait(700);
ok(count('.gx-node') > before, `expandir RunOperationJob muestra sus métodos (${before} → ${count('.gx-node')})`);
ok(!!host.querySelector('.gx-group[data-id="c-job"]'), 'c-job pasa a contenedor');
ok(S.vedges.some(v => v.from === 'm-job-move'), 'las aristas bajan al método ya visible');
await gx.toggle('c-job'); await wait(700);
ok(!host.querySelector('.gx-group[data-id="c-job"]'), 'plegar vuelve a tarjeta');

console.log('— profundidad —');
host.querySelector('.gx-seg-b[data-depth="3"]').click(); await wait(900);
ok(!!host.querySelector('.gx-leaf[data-id="m-renew"]'), 'nivel Método: aparece InFlightGuard#renew');
host.querySelector('.gx-seg-b[data-depth="0"]').click(); await wait(900);
ok(count('.gx-group') === 0 && count('.gx-leaf') === 5, `nivel Carril: 5 carriles plegados como tarjetas (${count('.gx-leaf')} tarjetas, ${count('.gx-group')} grupos)`);

console.log('— tooltip y panel —');
host.querySelector('.gx-seg-b[data-depth="1"]').click(); await wait(900);
const card = host.querySelector('.gx-leaf[data-id="c-job"]');
card.dispatchEvent(new w.PointerEvent('pointerenter', { bubbles: false, clientX: 100, clientY: 100 }));
await wait(200);
const tip = host.querySelector('.gx-tip');
ok(tip.classList.contains('on') && /RunOperationJob/.test(tip.textContent), 'tooltip con la pieza al pasar');
ok(/↗/.test(tip.textContent), 'el tooltip cuenta entradas y salidas');
ok(host.querySelector('.gx-dim') && host.querySelector('.gx-leaf[data-id="c-job"].lit'), 'al pasar se ilumina la vecindad');
card.dispatchEvent(new w.PointerEvent('pointerleave'));
card.dispatchEvent(new w.MouseEvent('click', { bubbles: true, detail: 1 }));
const panel = host.querySelector('.gx-panel');
ok(panel.classList.contains('on'), 'clic abre el panel');
ok(/run_operation_job\.rb/.test(panel.textContent), 'el panel lista el fichero');
ok(/\+\d+/.test(panel.querySelector('.gx-files').textContent), 'con las stats +N de git');
ok(!!panel.querySelector('.gx-files a[href*="pull/103/files#diff-"]'), 'y el enlace al diff de la PR');
ok(/Salidas/.test(panel.textContent) && /Entradas/.test(panel.textContent), 'y sus conexiones de entrada y salida');
ok(panel.querySelectorAll('.gx-stepn').length > 0 && !/Pasos que lo explican/.test(panel.querySelector('.gx-pbody').textContent), 'los pasos que lo nombran van como números, sin el título grande');
ok(panel.querySelectorAll('details.gx-fold').length === 2 && [...panel.querySelectorAll('details.gx-fold')].every(d => !d.open), 'entradas y salidas plegables, plegadas por defecto');
const cssTxt = [...d.querySelectorAll('style')].map(x => x.textContent).join('');
ok(!!panel.querySelector('.gx-pact') && /\.gx-pact\s*\{[^}]*flex-wrap:\s*nowrap/.test(cssTxt), 'acciones del panel en una sola línea');

console.log('— trazado transitivo —');
panel.querySelector('[data-act="down"]').click(); await wait(50);
ok(S.trace && S.trace.nodes.size > 1, `«qué depende de esto» ilumina ${S.trace ? S.trace.nodes.size : 0} piezas`);
panel.querySelector('[data-act="up"]').click(); await wait(50);
ok(S.trace && S.trace.dir === 'up' && S.trace.nodes.has('sidekiq') === false || S.trace.nodes.size > 1, '«de qué depende» recorre hacia atrás');

console.log('— navegar desde el panel y búsqueda —');
await gx.reveal('m-team-result'); await wait(900);
ok(!!host.querySelector('.gx-leaf[data-id="m-team-result"]'), 'reveal abre los antepasados del método');
ok(S.selected === 'm-team-result', 'y lo selecciona');
ok(!!panel.querySelector('.gx-note.warn'), 'el panel muestra la nota del hallazgo');
const inp = host.querySelector('.gx-search input');
inp.value = 'guard'; inp.dispatchEvent(new w.Event('input'));
ok(host.querySelectorAll('.gx-search-list button').length >= 2, 'la búsqueda encuentra InFlightGuard y sus métodos (sin tildes ni mayúsculas)');
inp.value = 'reejecución'; inp.dispatchEvent(new w.Event('input'));

console.log('— recorrido —');
await gx.goStep(0); await wait(900);
ok(/Paso 1 de 10/.test(host.querySelector('.gx-tour').textContent), 'paso 1 de 10');
await gx.goStep(1); await wait(900);
ok(!!host.querySelector('.gx-leaf[data-id="m-validate"].lit'), 'el paso 2 abre hasta el método y lo ilumina');
ok(S.selected === 'm-validate' && panel.classList.contains('on'), 'y abre su panel (select)');
await gx.goStep(3); await wait(900);
ok(S.view === 'flow:aceptar' && host.classList.contains('gx-flowview'), 'el paso 4 cambia a la secuencia «Aceptar»');
ok(host.querySelectorAll('.gx-seq-msg.lit').length === 4, `ilumina sus 4 mensajes (${host.querySelectorAll('.gx-seq-msg.lit').length})`);
await gx.goStep(5); await wait(900);
ok(S.view === 'graph' && !!host.querySelector('.gx-edge.lit.hero'), 'el paso 6 vuelve al grafo e ilumina la arista hero');

console.log('— secuencia —');
gx.showView('flow:reejecutar'); await wait(100);
ok(host.querySelectorAll('.gx-seq-msg').length === 10, `«Reejecutar» dibuja 10 mensajes (${host.querySelectorAll('.gx-seq-msg').length})`);
ok(host.querySelectorAll('.gx-seq-p').length === 6, '6 participantes');
ok(!!host.querySelector('.gx-seq-msg.k-self'), 'con el mensaje reflexivo');

console.log('— presentación —');
gx.setPresent(true); await wait(900);
ok(host.classList.contains('gx-present'), 'modo presentación');
host.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); await wait(900);
ok(S.tour >= 1, 'flecha derecha avanza');
host.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(200);
ok(!host.classList.contains('gx-present') && S.tour === -1, 'Esc sale y termina el recorrido');

console.log('— ficheros y diff —');
host.querySelector('.gx-seg-b[data-depth="1"]').click(); await wait(900);
const bF = [...host.querySelectorAll('.gx-btn')].find(b => /Ficheros/.test(b.textContent));
ok(!!bF && /\d+/.test(bF.textContent), `botón Ficheros con recuento (${bF && bF.textContent})`);
bF.click(); await wait(50);
ok(panel.classList.contains('on') && /Ficheros cambiados/.test(panel.textContent), 'la lista global de ficheros abre en el panel');
const diffs = panel.querySelectorAll('a.gx-diffb[href*="/pull/103/files#diff-"]');
ok(diffs.length >= 20, `cada fichero cambiado enlaza a su diff en la PR (${diffs.length})`);
ok(!!panel.querySelector('a.gx-prlink[href$="/pull/103/files"]'), 'y hay un enlace a todos los cambios de la PR');
ok(!!panel.querySelector('.gx-fown [data-go]'), 'cada fichero dice en qué pieza vive, y navega a ella');
ok(!!panel.querySelector('.gx-ctxfiles'), 'los ficheros de contexto sin cambios van aparte, plegados');
const pill = host.querySelector('.gx-leaf[data-id="c-job"] .gx-fpill');
ok(!!pill && /± 1/.test(pill.textContent) && /#diff-/.test(pill.getAttribute('href') || ''), 'la tarjeta de un solo fichero enlaza directo a su diff');
const pill2 = host.querySelector('.gx-leaf[data-id="c-kit"] .gx-fpill');
ok(!!pill2 && /± \d{2}|± [2-9]/.test(pill2.textContent), `un concepto con varios ficheros muestra cuántos (${pill2 && pill2.textContent})`);
pill2.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); await wait(80);
ok(S.selected === 'c-kit' && !!panel.querySelector('.gx-fown'), 'y al pulsarla abre su panel con los ficheros de dentro');

console.log('— enlaces relacionados —');
bF.click(); await wait(20); bF.click(); await wait(50);
ok(!!panel.querySelector('a.gx-lchip.k-gh[href="https://github.com/acme/platform/pull/101"]'), 'enlaces globales: PRs del stack');
ok(!!panel.querySelector('a.gx-lchip.k-claude[href^="https://claude.ai/"]'), 'y el artefacto de revisión');
await gx.reveal('m-team-result'); await wait(900);
ok(!!panel.querySelector('.gx-conn [data-go="m-entity-ar"]'), 'enlace interno: relaciona la pieza con otra del diagrama');
ok(!!host.querySelector('.gx-leaf[data-id="m-team-result"] .gx-lk'), 'la tarjeta marca que tiene enlaces');
const G2 = w.GraphX;
ok(G2.resolveLink({ kind: 'url', url: 'javascript:alert(1)' }, {}) === null, 'un enlace que no es http(s) se descarta');
ok(/atlassian\.net\/browse\/PRJ-100$/.test(G2.resolveLink({ kind: 'jira', key: 'PRJ-100' }, {}).url), 'jira con solo la clave resuelve la URL');

console.log('— orientación vertical y cabeceras —');
await gx.setDirection('down'); await wait(900);
ok(host.querySelectorAll('.gx-band.v').length === 5, `abajo: 5 franjas con cabecera lateral (${host.querySelectorAll('.gx-band.v').length})`);
const bb = S.bands; ok(bb[1].y >= bb[0].y + bb[0].h - 1, 'las franjas se apilan sin solaparse');
w.document.querySelector('[data-gx] .gx-stage').getBoundingClientRect = () => ({ left: 0, top: 0, width: 900, height: 560, right: 900, bottom: 560 });
host.querySelector('.gx-panel').getBoundingClientRect = () => ({ left: 520, top: 10, width: 370, height: 540, right: 890, bottom: 550 });
gx.state.cam && (host.querySelector('.gx-world'));
const c0 = S.cam; await gx.reveal('m-renew'); await wait(900);
ok(host.querySelector('.gx-sticky').classList.contains('on'), 'al acercar, las cabeceras quedan fijas al borde');
ok(host.querySelector('.gx-sticky').classList.contains('v'), 'en vertical, fijas a la izquierda');
await gx.setDirection('right'); await wait(900);
ok(host.querySelectorAll('.gx-band.v').length === 0 && host.querySelectorAll('.gx-band').length === 5, 'a la derecha: vuelven las columnas');

console.log('— móvil —');
const stg = host.querySelector('.gx-stage');
const camA = JSON.stringify(S.cam);
stg.dispatchEvent(new w.PointerEvent('pointerdown', { pointerType: 'touch', pointerId: 7, clientX: 300, clientY: 300, bubbles: true }));
stg.dispatchEvent(new w.PointerEvent('pointermove', { pointerType: 'touch', pointerId: 7, clientX: 300, clientY: 150, bubbles: true }));
stg.dispatchEvent(new w.PointerEvent('pointerup', { pointerType: 'touch', pointerId: 7, clientX: 300, clientY: 150, bubbles: true }));
ok(JSON.stringify(S.cam) === camA, 'un dedo sobre el lienzo en línea no lo mueve: deja desplazar la página');
ok(/Dos dedos/.test(host.querySelector('.gx-hint').textContent), 'y avisa de cómo moverlo');
gx.setExplore(true); await wait(100);
ok(host.classList.contains('gx-expanded'), 'Explorar pone el lienzo a pantalla completa');
stg.dispatchEvent(new w.PointerEvent('pointerdown', { pointerType: 'touch', pointerId: 8, clientX: 300, clientY: 300, bubbles: true }));
stg.dispatchEvent(new w.PointerEvent('pointermove', { pointerType: 'touch', pointerId: 8, clientX: 200, clientY: 250, bubbles: true }));
stg.dispatchEvent(new w.PointerEvent('pointerup', { pointerType: 'touch', pointerId: 8, clientX: 200, clientY: 250, bubbles: true }));
ok(JSON.stringify(S.cam) !== camA, 'y ahí un dedo ya mueve el diagrama');
host.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(50);
ok(!host.classList.contains('gx-expanded'), 'Esc cierra Explorar');

console.log('— 1.3 —');
host.querySelector('.gx-seg-b[data-depth="1"]').click(); await wait(900);
const widths = [...host.querySelectorAll('.gx-leaf .gx-card')].map(r => +r.getAttribute('width'));
ok(Math.max(...widths) <= 212, `tarjetas de 212 px como mucho (máx ${Math.max(...widths)})`);
await gx.reveal('m-validate'); await wait(900);
const t2 = host.querySelector('.gx-leaf[data-id="m-validate"] .gx-t + .gx-t');
ok(t2 && t2.textContent.length > 0, `un título largo parte en dos líneas («${host.querySelector('.gx-leaf[data-id="m-validate"] .gx-t').textContent}» / «${t2 && t2.textContent}»)`);
await gx.reveal('c-job'); await wait(300);
const icons = [...host.querySelectorAll('.gx-leaf[data-id="c-job"] .gx-lki')].map(x => x.getAttribute('class'));
ok(icons.some(c => /k-gh/.test(c)) && icons.some(c => /k-claude/.test(c)), `la tarjeta muestra el icono de cada tipo de enlace (${icons.map(c => c.split('k-')[1]).join(', ')})`);
ok(!!panel.querySelector('.gx-lchip.k-gh span') && !panel.querySelector('.gx-xk'), 'en el panel, los enlaces son chips con el icono pegado al identificador');
const camW = JSON.stringify(S.cam);
panel.dispatchEvent(new w.WheelEvent('wheel', { deltaY: 200, bubbles: true, cancelable: true }));
ok(JSON.stringify(S.cam) === camW, 'la rueda sobre el panel no mueve el lienzo');
const kids0 = S.expanded.has('c-job');
const cj = host.querySelector('[data-id="c-job"]');
const tgt = cj.classList.contains('gx-group') ? cj.querySelector('.gx-ghead') : cj;
tgt.dispatchEvent(new w.MouseEvent('dblclick', { bubbles: true })); await wait(700);
ok(S.expanded.has('c-job') === kids0, 'doble clic ya no abre ni pliega');
ok(S.selected === 'c-job' && panel.classList.contains('on'), 'selecciona la pieza y abre su panel');
const rr = S.rects.get('c-job'), cam = S.cam, vw = 900;
const cx = (rr.x + rr.w / 2) * cam.k + cam.x;
ok(cx < vw - 300, `y la centra en el hueco que deja el panel (centro en ${Math.round(cx)} px de 900)`);
await gx.goStep(2); await wait(900);
ok(!!host.querySelector('.gx-tour [data-t="stop"]'), 'con el recorrido en marcha hay un botón Detener');
host.querySelector('.gx-tour [data-t="stop"]').click(); await wait(900);
ok(S.tour === -1 && !root_dim() && !panel.classList.contains('on'), 'Detener sale del recorrido, quita el velo y cierra el panel');
ok(host.querySelector('.gx-seg-b.on') && host.querySelector('.gx-seg-b.on').dataset.depth === '1', 'y vuelve al nivel inicial');
/* la carrera de la imagen: salir con un relayout aún pendiente dejaba el velo puesto */
gx.goStep(4); await wait(30); gx.resetView(); await wait(1200);
ok(!root_dim(), 'salir del recorrido a mitad de un paso no deja el velo atascado');
const n0 = host.querySelector('.gx-leaf');
n0.dispatchEvent(new w.PointerEvent('pointerenter', { clientX: 10, clientY: 10 })); await wait(150);
ok(root_dim(), 'al pasar por encima se ilumina la vecindad');
await gx.toggle('c-kit'); await wait(900);
ok(!root_dim(), 'y al relayoutear bajo el puntero no se queda iluminada');
await gx.toggle('c-kit'); await wait(900);
function root_dim() { return !!host.querySelector('.gx-world.gx-dim'); }

console.log('— aislamiento —');
const ids = [...d.querySelectorAll('[id]')].map(e => e.id);
ok(new Set(ids).size === ids.length, `sin ids duplicados (${ids.length})`);

if (snapIdx > 0) {
  gx.showView('graph');
  host.querySelector('.gx-seg-b[data-depth="1"]').click(); await wait(1000);
  await gx.goStep(5); await wait(1000); gx.showView('graph'); await wait(200);
  const svg = host.querySelector('.gx-svg:not(.gx-seq)').cloneNode(true);
  const b = S.bbox;
  svg.querySelector('.gx-world').setAttribute('transform', '');
  svg.setAttribute('viewBox', `${b.x} ${b.y} ${b.w} ${b.h}`); svg.setAttribute('width', b.w); svg.setAttribute('height', b.h);
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  fs.writeFileSync(process.argv[snapIdx + 1], svg.outerHTML);
  console.log('snapshot →', process.argv[snapIdx + 1]);
}
console.log('\n' + (fail.length ? `FALLOS (${fail.length}):\n - ` + fail.join('\n - ') : '✅ Sin fallos'));
process.exit(fail.length ? 1 : 0);
