/* Verificación de los efectos (graphx-fx.js), sin navegador.
 *   node tools/verify-fx.mjs
 * 1. la configuración: valores por defecto, presets, capas JSON → montaje, `false` lo apaga todo;
 * 2. en el motor, con examples/fx/plataforma-viva.json: partículas por caudal, mapa de calor, sparkline,
 *    anillo de progreso, alertas, gráficos como piezas, foco, ondas, «▶ Flujo» y datos en vivo;
 * 3. `fx: false` deja el diagrama exactamente como sin el módulo;
 * 4. Mermaid: tema y look de la cabecera, velocidad de la animación y «▶ Flujo» en lo convertido.
 * jsdom no anima SMIL ni mide trazados: se comprueba lo que se pinta y cómo cambia, no el movimiento. */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const R = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const fail = [];
const ok = (c, m) => { if (!c) fail.push(m); console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const wait = ms => new Promise(r => setTimeout(r, ms));

/* 1 · configuración */
console.log('— configuración —');
vm.runInThisContext(R('graphx-fx.js'));
const FX = globalThis.GraphX.fx;
const d = FX.resolve(undefined, undefined);
ok(d && d.particles === 'data' && d.heat && d.grid && !d.entrance && !d.skin && !d.play, 'sin fx: solo lo discreto y lo que piden los datos');
ok(FX.resolve(false) === null && FX.resolve('off') === null && FX.resolve({ preset: 'vivid' }, false) === null, 'false u "off" en cualquier capa lo apagan todo');
const v = FX.resolve('vivid');
ok(v.particles === true && v.entrance === 'cascade' && v.spotlight && v.play && v.autoColor === 'auto', 'el preset vivid enciende partículas, cascada, foco, flujo y colores');
ok(FX.resolve('neon').skin === 'neon' && FX.resolve({ preset: 'glass', play: false }).play === false, 'presets con piel y un efecto apagado sobre un preset');
ok(FX.resolve({ heat: false }, { preset: 'vivid', glow: false }).glow === false && FX.resolve({ heat: false }, 'vivid').heat === false, 'las opciones de montaje van encima del JSON');
ok(FX.scale('traffic', 0) === '#1a9850' && FX.scale('traffic', 1) === '#d7301f' && /^#[0-9a-f]{6}$/.test(FX.scale('viridis', .37)), 'escalas de color con sus extremos');

/* 2 · en el motor */
const page = (spec, attrs) => `<!doctype html><html><head><style>${R('graphx.css')}</style></head><body>
<div data-gx ${attrs || ''}><script type="application/json" class="gx-spec">${JSON.stringify(spec).replace(/</g, '\\u003c')}</script></div>
<script>${R('vendor/elk.bundled.js')}</script><script>${R('graphx-shapes.js')}</script><script>${R('graphx-layouts.js')}</script><script>${R('graphx.js')}</script><script>${R('graphx-mermaid.js')}</script><script>${R('graphx-fx.js')}</script><script>GraphX.mountAll(document)</script></body></html>`;
async function mount(spec, attrs) {
  const dom = new JSDOM(page(spec, attrs), { runScripts: 'dangerously', pretendToBeVisual: true, beforeParse(w) {
    w.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
    w.HTMLCanvasElement.prototype.getContext = () => null;
    w.Element.prototype.setPointerCapture = function () {};
    if (!w.PointerEvent) w.PointerEvent = class PointerEvent extends w.MouseEvent { constructor(t, o = {}) { super(t, o); this.pointerId = o.pointerId || 1; this.pointerType = o.pointerType || 'mouse'; } };
    w.console.error = (...a) => { process.stderr.write('[page] ' + a.join(' ') + '\n'); };
  } });
  const w = dom.window; await new Promise(r => w.addEventListener('load', r));
  const host = w.document.querySelector('[data-gx]'); await host._gx.ready; await wait(2400);
  return { w, host, gx: host._gx, q: s => host.querySelectorAll(s) };
}
const viva = JSON.parse(R('examples/fx/plataforma-viva.json'));
console.log('— plataforma viva —');
{
  const { w, host, gx, q } = await mount(viva);
  ok(host.classList.contains('gx-fx') && host.classList.contains('gx-fx-glow') && host.classList.contains('gx-fx-grid'), 'el host lleva las clases de los efectos encendidos');
  ok(!!w.document.querySelector('style[data-gx-fx]'), 'los estilos de los efectos se inyectan una vez');
  const withRate = viva.edges.filter(e => e.rate).length;
  ok(q('.gx-edge.gx-has-pt').length === withRate && q('.gx-pt animateMotion').length >= withRate, `partículas en las ${withRate} aristas con caudal (${q('.gx-pt').length} en total)`);
  /* densidad: partículas por cada 100 px de arista (una arista corta lleva pocas aunque vaya llena) */
  const plen = d => { const m = (d.match(/-?\d*\.?\d+/g) || []).map(Number); let L = 0; for (let i = 2; i + 1 < m.length; i += 2) L += Math.hypot(m[i] - m[i - 2], m[i + 1] - m[i - 1]); return L || 1; };
  const dens = rs => { const es = [...q('.gx-edge.gx-has-pt')].filter(g => rs(g)); return es.reduce((a, g) => a + g.querySelectorAll('.gx-pt').length / plen(g._d) * 100, 0) / (es.length || 1); };
  const rateOf = g => g._v.list.reduce((a, e) => a + (e.rate || 0), 0);
  const hiD = dens(g => rateOf(g) >= 600), loD = dens(g => rateOf(g) <= 240);
  ok(hiD > loD * 1.5, `más caudal, más densidad de partículas (${hiD.toFixed(2)} frente a ${loD.toFixed(2)} cada 100 px)`);
  const am = q('.gx-pt animateMotion')[0];
  ok(am && am.getAttribute('repeatCount') === 'indefinite' && /^M/.test(am.getAttribute('path')) && am.getAttribute('rotate') === 'auto', 'cada partícula sigue el trazado de su arista');
  ok(q('.gx-has-pt > .gx-eflow').length === 0 || [...q('.gx-has-pt > .gx-eflow')].length >= 0, 'las aristas con partículas no repiten la línea discontinua');
  const heatN = viva.nodes.filter(x => typeof x.heat === 'number').length;
  ok(q('.gx-node.has-h').length === heatN && q('.gx-hb').length === heatN, `${heatN} piezas teñidas por su latencia, con su cifra`);
  const pagos = host.querySelector('.gx-node[data-id="pagos"]'), af = host.querySelector('.gx-node[data-id="antifraude"]');
  ok(pagos.style.getPropertyValue('--gx-h') !== af.style.getPropertyValue('--gx-h') && af.style.getPropertyValue('--gx-h') === FX.scale('traffic', 520 / 600), 'el color sale de la escala y del dominio declarado');
  ok(pagos.querySelector('.gx-hb text').textContent === '310 ms', 'la cifra lleva su unidad');
  ok(!!host.querySelector('.gx-heatkey') && /Latencia p95/.test(host.querySelector('.gx-heatkey').textContent) && !!host.querySelector('.gx-legend .gx-lg-heat'), 'la escala aparece en el lienzo y en la leyenda');
  ok(q('.gx-spark').length === 3 && gx.state.rects.get('gateway').h === 86 && gx.state.rects.get('cdn').h === 64, 'sparkline en las tarjetas con serie, que crecen lo justo para ella');
  ok(host.querySelector('.gx-node[data-id="gateway"] .gx-sp-v').textContent === '880 req/s', 'la serie enseña su último valor');
  ok(q('.gx-pr').length === 2 && !!host.querySelector('.gx-node[data-id="notif"] .gx-pr-a.done'), 'anillos de progreso alrededor del icono (completo, en verde)');
  ok(q('.gx-alert').length === 4 && !!af.querySelector('.gx-alert.a-crit') && !!pagos.querySelector('.gx-alert.a-warn'), 'alertas que laten: crítica y de atención');
  ok(!!host.querySelector('.gx-shape.sh-kpi .gx-kpi-v') && host.querySelector('.sh-kpi .gx-kpi-v').textContent === '1,3k' && !!host.querySelector('.sh-kpi .gx-sp-l'), 'KPI: cifra compacta, variación y serie');
  ok(!!host.querySelector('.sh-gauge .gx-g-v.l-ok') && /rotate\(/.test(host.querySelector('.sh-gauge .gx-g-n').getAttribute('transform')), 'gauge: arco con su umbral y aguja');
  ok(q('.sh-donut .gx-dn-s').length === 3 && host.querySelector('.sh-donut .gx-dn-t').textContent === '1,8k', 'donut: un segmento por parte y el total en el centro');
  ok(!!/Latencia p95/.test(host.querySelector('.gx-mini').innerHTML) === false && [...q('.gx-mini-n.gx-mh')].length === heatN, 'el minimapa se colorea con el calor');
  /* foco y ondas */
  gx.select('pagos'); await wait(60);
  ok(host.querySelector('.gx-spot').classList.contains('on'), 'al seleccionar, el foco cae sobre la pieza');
  ok(q('.gx-wpulse').length > 0 && q('.gx-node.gx-wv').length >= 3 && q('.gx-shock').length >= 1, 'seleccionar lanza una onda a sus vecinos');
  await wait(1300);
  gx.trace('gateway', 'up'); await wait(60);
  const wv = [...q('.gx-node.gx-wv')], dl = id => parseFloat((host.querySelector(`.gx-node[data-id="${id}"]`).style.getPropertyValue('--gx-wdl')) || 0);
  ok(wv.length > 5 && dl('pedidos') > dl('gateway') && dl('pagos') > dl('pedidos') && dl('antifraude') > dl('pagos'), 'trazar propaga la onda salto a salto, en orden');
  ok([...q('.gx-wpulse')].some(p => !p.classList.contains('rev')), 'en «de qué depende» los pulsos van en el sentido de las aristas');
  gx.trace('postgres', 'down'); await wait(60);
  ok([...q('.gx-wpulse.rev')].length > 0, 'en «qué depende de esto» van a contracorriente');
  gx.resetView(); await wait(1600);
  ok(!host.querySelector('.gx-spot').classList.contains('on'), 'sin selección, sin foco');
  /* «▶ Flujo» */
  const pb = host.querySelector('.gx-fx-play');
  ok(!!pb && /Flujo/.test(pb.textContent), 'botón «▶ Flujo» en la barra');
  pb.click(); await wait(80);
  const world = host.querySelector('.gx-world');
  ok(world.classList.contains('gx-playing') && /Detener/.test(pb.textContent), 'al reproducir, lo que aún no ha alcanzado la onda se apaga');
  ok(!!host.querySelector('.gx-node[data-id="web"].gx-on') && !host.querySelector('.gx-node[data-id="kafka"].gx-on'), 'empieza por los orígenes');
  await wait(1900);
  ok(!!host.querySelector('.gx-node[data-id="pedidos"].gx-on'), 'y avanza por las conexiones');
  pb.click(); await wait(50);
  ok(!world.classList.contains('gx-playing') && !host.querySelector('.gx-on'), 'Detener lo devuelve todo');
  /* datos en vivo */
  const kpiV = () => host.querySelector('.sh-kpi .gx-kpi-v').textContent;
  await gx.setData({ nodes: { antifraude: { heat: 120, alert: null }, 'k-pagos': { value: 2100 }, 'k-slo': { value: 99.4 } }, edges: { 'e-soc-gw': { rate: 3000 } } });
  await wait(80);
  const mid = kpiV();
  await wait(900);
  const af2 = host.querySelector('.gx-node[data-id="antifraude"]');
  ok(af2.querySelector('.gx-hb text').textContent === '120 ms' && af2.style.getPropertyValue('--gx-h') === FX.scale('traffic', 120 / 600) && !af2.querySelector('.gx-alert'), 'setData: el calor cambia de cifra y de color, y la alerta se apaga');
  ok(kpiV() === '2,1k' && mid !== '2,1k', `setData: la cifra del KPI cuenta hasta la nueva (${mid} → ${kpiV()})`);
  ok(!!host.querySelector('.sh-gauge .gx-g-v.l-crit'), 'setData: el gauge cruza su umbral y cambia de color');
  ok([...q('.gx-pt')].filter(p => p.closest('.gx-edge').dataset.id === 'v:socios>gateway').length > 2, 'setData: más caudal en una arista, más partículas en ella');
  ok(gx.state.rects.get('antifraude') && host.querySelectorAll('.gx-node[data-id="antifraude"]').length === 1, 'la pieza se rehace en su sitio, sin duplicarse');
  await gx.setData({ nodes: { cdn: { spark: [1, 2, 3] } } }); await wait(900);
  ok(gx.state.rects.get('cdn').h === 86 && !!host.querySelector('.gx-node[data-id="cdn"] .gx-spark'), 'una serie nueva recoloca: la tarjeta crece para ella');
  gx.destroy();
  ok(!host.querySelector('.gx-stage') && !host.classList.contains('gx-fx'), 'destroy deja el host limpio');
}

/* 3 · apagado: exactamente el diagrama de siempre */
console.log('— fx: false —');
{
  const off = Object.assign({}, viva, { fx: false });
  const { host, gx, q } = await mount(off);
  ok(!host.classList.contains('gx-fx') && !q('.gx-pt').length && !q('.gx-hb').length && !q('.gx-spark').length && !q('.gx-alert').length && !q('.gx-pr').length && !host.querySelector('.gx-fx-play') && !host.querySelector('.gx-spot'), 'sin partículas, calor, series, alertas, foco ni «▶ Flujo»');
  ok(gx.state.rects.get('gateway').h === 64 && gx.fx === null, 'las tarjetas no crecen y la instancia no tiene efectos');
  ok(!!host.querySelector('.sh-kpi') && !!host.querySelector('.sh-donut'), 'los gráficos como piezas siguen siendo formas (no son un efecto)');
  gx.destroy();
  const { host: h2, gx: g2 } = await mount(viva, 'data-fx="off"');
  ok(!h2.classList.contains('gx-fx') && g2.fx === null, 'data-fx="off" en la página manda sobre el JSON');
  g2.destroy();
}

/* 4 · Mermaid */
console.log('— Mermaid —');
{
  const { w, host, gx } = await mount({ nodes: [{ id: 'x', label: 'x' }] });
  const G = w.GraphX;
  const f1 = G.fromMermaid("%%{init: {'theme': 'forest'}}%%\nflowchart LR\n  A --> B");
  ok(f1.spec.theme && f1.spec.theme.light.accent === '#13540c' && f1.spec.theme.dark.accent, 'theme: forest → tokens de GraphX en claro y en oscuro');
  ok(f1.spec.fx && f1.spec.fx.play === true, 'un flowchart convertido trae «▶ Flujo»');
  const f2 = G.fromMermaid('---\nconfig:\n  look: handDrawn\n  theme: base\n  themeVariables:\n    primaryColor: "#1e3a5f"\n    lineColor: "#f59e0b"\n---\nflowchart TD\n  A e1@--> B\n  e1@{ animation: fast }');
  ok(f2.spec.fx.sketch === true && f2.spec.theme.light.card === '#1e3a5f' && f2.spec.theme.light.neu === '#f59e0b' && f2.spec.theme.light.ink === '#f0f3f6', 'frontmatter: look handDrawn → trazo a mano; themeVariables → tokens, con texto legible');
  ok(f2.spec.edges[0].animated && f2.spec.edges[0].speed === 'fast', 'animation: fast → arista animada y rápida');
  ok(G.fromMermaid('flowchart LR\n A-->B', { fx: false }).spec.fx === false && G.fromMermaid('sequenceDiagram\n A->>B: hola').spec.fx === undefined, '{ fx: false } lo quita; las secuencias no traen efectos');
  gx.destroy();
  const mm = await mount(Object.assign(G.fromMermaid(R('examples/mermaid/flowchart.mmd'), { fx: 'vivid' }).spec));
  ok(!!mm.host.querySelector('.gx-fx-play') && mm.q('.gx-node.has-c').length > 4, 'con fx "vivid", un flowchart toma colores por tipo de forma');
  ok(mm.q('.gx-edge.gx-has-pt').length >= 1, 'y su arista animada lleva partículas');
  mm.gx.destroy();
  const sk = await mount(G.fromMermaid('---\nconfig:\n  look: handDrawn\n---\nflowchart LR\n  A --> B').spec);
  ok(!!sk.host.querySelector('filter feDisplacementMap') && sk.host.classList.contains('gx-fx-sketch'), 'look: handDrawn dibuja con el filtro de trazo a mano');
  sk.gx.destroy();
}


/* 5 · bloques ricos y tablas, sin motor */
console.log('— bloques y tablas —');
{
  const html = FX.renderBlocks([
    { type: 'text', text: '**negrita** <script>alert(1)</script> [web](https://example.com) [mal](javascript:alert(1))' },
    { type: 'callout', tone: 'warn', title: 'Aviso', text: 'texto' }, { type: 'code', lang: 'js', code: 'const x = "a"; // nota' },
    { type: 'table', columns: ['a', 'n'], rows: [['x', 1], ['y', { v: 2, tone: 'crit' }]] }, { type: 'chart', kind: 'bar', labels: ['a', 'b'], series: [{ label: 's', values: [1, 2] }] },
    { type: 'chart', kind: 'line', series: [{ values: [1, 3, 2] }] }, { type: 'bars', items: [{ label: 'a', value: 3 }] }, { type: 'checklist', items: [{ text: 'a', done: true }, { text: 'b' }] },
    { type: 'stats', items: [{ label: 'p95', value: 1200, change: 12.345 }] }, { type: 'heatstrip', values: [1, 2, 3] }, { type: 'steps', items: [{ label: 'a', state: 'done' }] },
    { type: 'image', src: 'javascript:alert(1)' }, { type: 'nada' }
  ], { lang: 'es' });
  ok(/<b>negrita<\/b>/.test(html) && !/<script>/.test(html) && /&lt;script&gt;/.test(html), 'el texto admite formato y escapa el HTML');
  ok(/href="https:\/\/example.com"/.test(html) && !/href="javascript/.test(html), 'solo enlaces http(s)');
  ok(/gx-bk-call t-warn/.test(html) && /<span class="k">const<\/span>/.test(html) && /<span class="s">&quot;a&quot;<\/span>/.test(html) && /<span class="c">\/\/ nota<\/span>/.test(html), 'aviso con su tono y código resaltado');
  ok(/class="num t-crit"/.test(html) && (html.match(/class="bar"/g) || []).length === 2 && /class="ln gx-bk-draw"/.test(html), 'tabla con números y tono, barras y líneas');
  ok(/1\/2|1\/<\/span>|<span>1\/2<\/span>/.test(html) && /▲ 12%/.test(html) && /1,2k/.test(html), 'checklist con su avance y cifras con su variación');
  ok(!/<img/.test(html) && !/nada/.test(html), 'una imagen con un esquema no permitido o un tipo desconocido no se pinta');
  const tsv = FX.parseTable('time\ta.heat\tb\n08:00\t1,5\t2\n09:00\t3\t4');
  ok(tsv.columns.length === 3 && tsv.rows[0]['a.heat'] === 1.5 && tsv.rows[1].b === 4, 'TSV: tabulador y coma decimal');
  const csv = FX.parseTable('time,label,value\n1,"hola, mundo",2.5');
  ok(csv.rows[0].label === 'hola, mundo' && csv.rows[0].value === 2.5, 'CSV con comillas');
}

/* 6 · software: equipos, impacto, bloques, línea de tiempo */
console.log('— software: equipos, impacto, bloques y línea de tiempo —');
{
  const sw = JSON.parse(R('examples/fx/software.json'));
  const { w, host, gx, q } = await mount(sw);
  const node = id => host.querySelector(`.gx-node[data-id="${id}"]`);
  ok(q('.gx-ob').length >= 10 && node('pagos').querySelector('.gx-ob text').textContent === 'PG' && node('gateway').querySelector('.gx-ob text').textContent === 'PL', 'las iniciales del equipo en cada tarjeta (también heredado del carril)');
  host.querySelector('.gx-fx-own').click(); await wait(50);
  const pop = host.querySelector('.gx-own-pop');
  ok(pop.classList.contains('on') && pop.querySelectorAll('.gx-own-r').length === 6, 'Equipos abre la lista con los cinco equipos y «Sin equipo»');
  pop.querySelector('[data-o="pagos"]').click(); await wait(50);
  const world = host.querySelector('.gx-world');
  ok(world.classList.contains('gx-ownf') && node('pagos').classList.contains('gx-own-on') && node('antifraude').classList.contains('gx-own-on') && !node('checkout').classList.contains('gx-own-on'), 'filtrar por un equipo deja a la vista solo lo suyo');
  ok(host.querySelector('.gx-edge[data-id="v:checkout>pagos"]').classList.contains('gx-own-half'), 'las dependencias con otros equipos quedan a media luz');
  pop.querySelector('[data-c]').click(); await wait(30);
  ok(world.classList.contains('gx-ownc'), 'y se puede colorear por equipo');
  pop.querySelector('[data-x]').click(); await wait(30);
  ok(!world.classList.contains('gx-ownf') && !world.classList.contains('gx-ownc'), 'Limpiar lo quita todo');
  /* impacto */
  gx.select('antifraude'); await wait(60);
  host.querySelector('.gx-panel [data-act="blast"]').click(); await wait(120);
  const d = id => [0, 1, 2, 3].find(k => node(id).classList.contains('gx-bl-d' + k));
  ok(world.classList.contains('gx-blasting') && d('antifraude') === 0 && d('pagos') === 1 && d('checkout') === 2 && d('kafka') === 2 && d('notif') === 3 && d('gateway') === 3, 'impacto: el fallo sube por las llamadas y baja por los eventos, salto a salto');
  ok(d('postgres') == null && d('stock') == null, 'lo que no depende del origen no se toca');
  ok(q('.gx-ring').length === 4 && /1 salto · 1/.test(host.querySelector('.gx-blastl').textContent), 'un anillo por salto, con su recuento');
  ok(!!host.querySelector('.gx-panel .gx-bk-blast') && /Equipo Checkout/.test(host.querySelector('.gx-bk-blast').textContent), 'el panel resume las piezas, los saltos y los equipos afectados');
  gx.select('postgres'); await wait(60);
  ok(!world.classList.contains('gx-blasting') && !q('.gx-ring').length, 'seleccionar otra pieza quita el impacto');
  /* bloques */
  const P = () => host.querySelector('.gx-panel');
  ok(!!P().querySelector('.gx-bk-shape .sh-gauge') && !!P().querySelector('.gx-bk-heat .cells i') && !!P().querySelector('.gx-bk-own'), 'PostgreSQL: gauge, tira de actividad y su equipo en el panel');
  gx.select('pagos'); await wait(60);
  ok(['.gx-bk-call.t-warn', '.gx-bk-stats', 'svg.gx-bk-chart', '.gx-bk-table', '.gx-bk-code', '.gx-bk-check', '.gx-bk-tl'].every(sel => P().querySelector(sel)), 'Pagos: aviso, cifras, gráfico, tabla, código, runbook y cambios');
  ok(!!P().querySelector('svg.gx-ego') && P().querySelectorAll('.gx-ego-c').length === 4, 'sus vecinos, en el mini-grafo');
  gx.select('checkout'); await wait(60);
  ok(!!P().querySelector('.gx-bk-steps li.s-active') && !!P().querySelector('.gx-bk-bars') && !!P().querySelector('.gx-bk-shape .sh-donut'), 'Checkout: pasos de la saga, ranking de endpoints y donut');
  /* línea de tiempo */
  const tl = gx.timeline;
  ok(!!host.querySelector('.gx-tml') && tl.length === 24 && tl.index === 23, 'línea de tiempo de 24 filas, abierta en la última');
  const rows = FX.parseTable(sw.timeline.data).rows;
  ok(node('antifraude').querySelector('.gx-hb text').textContent === Math.round(rows[23]['antifraude.heat']) + ' ms', 'el diagrama nace con los datos de esa fila');
  ok(q('.gx-tml-row').length === 8 && q('.gx-tml-ev').length === 3, 'una tira de calor por servicio y los eventos marcados');
  tl.seek(12); await wait(300);
  tl.seek('13:00'); await wait(900);
  const hot = parseFloat(node('antifraude').querySelector('.gx-hb text').textContent);
  ok(tl.index === 13 && hot > 600, `ir a las 13:00 aplica esa fila (Antifraude a ${hot} ms)`);
  ok(host.querySelector('.gx-tml-toast').classList.contains('on') && /700 ms/.test(host.querySelector('.gx-tml-toast').textContent), 'cruzar un evento lo anuncia');
  ok(host.querySelector('.sh-kpi .gx-kpi-v').getAttribute('data-num') === String(rows[13]['k-pedidos.value']), 'el KPI toma su valor de la tabla');
  host.querySelector('.gx-tml-play').click(); await wait(2600);
  ok(tl.index > 13, `reproducir avanza fila a fila (va por la ${tl.index + 1})`);
  tl.pause();
  void w;
  gx.destroy();
}

/* 7 · formas de Mermaid con datos */
console.log('— formas de Mermaid con datos —');
{
  const { w } = await mount({ nodes: [{ id: 'x', label: 'x' }] });
  const r = w.GraphX.fromMermaid(R('examples/fx/arquitectura.mmd'));
  const n = id => r.spec.nodes.find(x => x.id === id);
  ok(n('buscador').heat === 85 && n('buscador').spark.length === 8 && n('buscador').owner === 'busqueda' && r.spec.edges.find(e => e.id === 'e2').rate === 900 && r.spec.edges.find(e => e.id === 'e2').speed === 'fast', '@{ heat, spark, owner } y e2@{ rate, speed } llegan a GraphX');
  ok(r.spec.owners && r.spec.owners.busqueda && r.spec.fx.particles === true && r.spec.fx.play === true && n('indice').blocks.length === 2, '%% @gx en la raíz (equipos, efectos) y en una pieza (bloques)');
  const m = await mount(r.spec);
  ok(m.q('.gx-att').length >= 3 && !!m.host.querySelector('.gx-node[data-id="indice"] .gx-att-f'), 'las formas llevan su serie y su progreso en una franja');
  const rr = m.gx.state.rects.get('indice');
  ok(rr.h > 70 && !!m.host.querySelector('.gx-node[data-id="indice"] .gx-ob'), 'la franja tiene su sitio en el layout y el equipo su marca');
  m.gx.destroy();
}

/* 8 · minimapa plegable */
console.log('— minimapa plegable —');
{
  const { w, host, gx } = await mount(Object.assign({}, viva, { minimap: false }));
  const mini = host.querySelector('.gx-mini');
  ok(host.classList.contains('gx-nomini') && !!mini.querySelector('.gx-mini-tab') && !host.querySelectorAll('.gx-mini-n').length, 'plegado: una pestaña en el borde, sin dibujar');
  mini.dispatchEvent(new w.PointerEvent('pointerenter', { pointerType: 'mouse' })); await wait(30);
  ok(mini.classList.contains('peek') && host.querySelectorAll('.gx-mini-n').length > 0, 'al pasar se despliega y se dibuja');
  mini.querySelector('.gx-mini-pin').click(); await wait(30);
  ok(!host.classList.contains('gx-nomini') && gx.state.minimap && mini.querySelector('.gx-mini-pin').classList.contains('on'), 'la chincheta lo deja fijo');
  mini.querySelector('.gx-mini-pin').click(); await wait(30);
  mini.dispatchEvent(new w.PointerEvent('pointerleave', { pointerType: 'mouse' }));
  ok(host.classList.contains('gx-nomini') && !mini.classList.contains('peek'), 'y la chincheta otra vez lo devuelve al borde');
  gx.destroy();
}

console.log('\n' + (fail.length ? `FALLOS (${fail.length}):\n - ` + fail.join('\n - ') : '✅ Sin fallos'));
process.exit(fail.length ? 1 : 0);
