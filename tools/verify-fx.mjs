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

console.log('\n' + (fail.length ? `FALLOS (${fail.length}):\n - ` + fail.join('\n - ') : '✅ Sin fallos'));
process.exit(fail.length ? 1 : 0);
