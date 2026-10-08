#!/usr/bin/env node
/* Capturas de la documentación (docs/img/*.webp): la página de demostración, cada efecto de cerca, el
 * catálogo de piezas y layouts y cada ejemplo del repositorio.
 *   node tools/capture-docs.mjs [nombre…]        (sin nombres, todas)
 * Necesita Playwright con Chromium (`npm i -D playwright && npx playwright install chromium`) o la ruta a
 * su módulo en PLAYWRIGHT=/…/playwright/index.mjs. Construye las páginas en un directorio temporal con las
 * fuentes (y la demostración con dist/, que debe estar al día) y convierte cada PNG a WebP en el propio
 * navegador, sin más dependencias.                                                                   */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'docs/img');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'graphx-docs-'));
const only = new Set(process.argv.slice(2));
const { chromium } = await import(process.env.PLAYWRIGHT ? pathToFileURL(process.env.PLAYWRIGHT).href : 'playwright');
fs.mkdirSync(OUT, { recursive: true });

/* ---------- páginas ---------- */
const run = (...a) => execFileSync(process.execPath, a, { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] });
const page = (src, name) => { const f = path.join(TMP, name + '.html'); run('graphx-build.mjs', src, '--out', f, '--mode', 'dev'); return f; };
const variant = (file, name, attrs) => { const f = path.join(TMP, name + '.html'); fs.writeFileSync(f, fs.readFileSync(file, 'utf8').replace('<div class="gx-host" data-gx', `<div class="gx-host" ${attrs} data-gx`)); return f; };
console.log('construyendo las páginas…');
run('examples/fx/build.mjs', path.join(TMP, 'demo.html'), '--standalone');
const P = {
  demo: path.join(TMP, 'demo.html'),
  viva: page('examples/fx/plataforma-viva.json', 'viva'), software: page('examples/fx/software.json', 'software'), galeria: page('examples/fx/galeria.json', 'galeria'),
  arq: page('examples/fx/arquitectura.mmd', 'arq'), despliegue: page('examples/fx/despliegue.mmd', 'despliegue'), postmortem: page('examples/fx/postmortem.json', 'postmortem'),
  pipeline: page('examples/fx/pipeline-datos.json', 'pipeline'), k8s: page('examples/fx/kubernetes.json', 'k8s'), cicd: page('examples/fx/ci-cd.mmd', 'cicd'),
  almacen: page('examples/fx/almacen.json', 'almacen'), onboarding: page('examples/onboarding-proceso.json', 'onboarding'), radar: page('examples/warehouses-pr-radar.json', 'radar'),
  stack: page('examples/pr-review-stack-202.json', 'stack'),
  shapes: page('examples/mermaid/shapes.mmd', 'shapes'), sequence: page('examples/mermaid/sequence.mmd', 'sequence'), gantt: page('examples/mermaid/gantt.mmd', 'gantt'),
  sankey: page('examples/mermaid/sankey.mmd', 'sankey'), treemap: page('examples/mermaid/treemap.mmd', 'treemap'), git: page('examples/mermaid/git.mmd', 'git'),
  classd: page('examples/mermaid/class.mmd', 'classd'), er: page('examples/mermaid/er.mmd', 'er')
};
P.neon = variant(P.viva, 'neon', `data-fx='{"preset":"neon","heat":{"label":"Latencia p95","unit":"ms","domain":[0,600]}}'`);
P.blueprint = variant(P.viva, 'blueprint', `data-fx='{"preset":"blueprint","heat":{"label":"Latencia p95","unit":"ms","domain":[0,600]}}'`);
P.glass = variant(P.viva, 'glass', `data-fx='{"preset":"glass","heat":{"label":"Latencia p95","unit":"ms","domain":[0,600]}}'`);

/* ---------- escenas ---------- */
const gx = 'document.querySelector("[data-gx]")._gx';
const S = [
  /* la página de demostración */
  { name: 'demo-portada', url: P.demo, view: [1400, 820], full: true },
  { name: 'demo-software', url: P.demo + '#software', sel: '#g-soft' },
  { name: 'demo-panel', url: P.demo + '#software', js: `document.getElementById('g-soft')._g || 0`, act: async p => { await p.evaluate(() => { const h = document.getElementById('g-soft'); h.querySelector('.gx-node[data-id="pagos"]').dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })); }); }, wait: 1200, sel: '#g-soft .gx-panel' },
  { name: 'demo-impacto', url: P.demo + '#software', act: async p => { await p.click('#s-blast'); }, wait: 1800, sel: '#g-soft .gx-stage' },
  { name: 'demo-equipos', url: P.demo + '#software', act: async p => { await p.click('#g-soft .gx-fx-own'); await p.click('#g-soft .gx-own-r[data-o="pagos"]'); }, wait: 600, clip: '#g-soft', h: 720 },
  { name: 'demo-tiempo', url: P.demo + '#software', act: async p => { await p.click('#s-incident'); }, wait: 2200, sel: '#g-soft .gx-tml' },
  { name: 'demo-galeria', url: P.demo + '#galeria', sel: '#g-gal', wait: 3500 },
  { name: 'demo-bloques', url: P.demo + '#galeria', sel: '#bk-grid' },
  { name: 'demo-iconos', url: P.demo + '#galeria', sel: '#icons' },
  { name: 'demo-vivo', url: P.demo + '#vivo', sel: '#p-vivo .console', wait: 5000 },
  { name: 'demo-ejemplos', url: P.demo + '#ejemplos', sel: '#p-ejemplos .exs', wait: 3500 },
  { name: 'demo-mermaid', url: P.demo + '#diagramas', act: async p => { await p.waitForFunction(() => document.querySelector('#dg-mmd svg'), null, { timeout: 60000 }); }, wait: 1500, sel: '#p-diagramas .console' },
  { name: 'demo-formas', url: P.demo + '#formas', act: async p => { await p.waitForSelector('.cat-item svg', { timeout: 60000 }); }, wait: 800, clip: '#p-formas', h: 1500 },
  { name: 'demo-arbol', url: P.demo + '#arbol', sel: '#p-arbol .console', wait: 3000 },
  { name: 'demo-atlas', url: P.demo + '#atlas', act: async p => { await p.waitForSelector('#g-atlas .gxa-chip[data-sel="pagos"]', { timeout: 60000 }); await p.click('#g-atlas .gxa-chip[data-sel="pagos"]'); }, wait: 2000, sel: '#g-atlas .gxa-grid' },
  { name: 'demo-guia', url: P.demo + '#referencia', sel: 'section[aria-labelledby="h-efectos"]' },
  /* los efectos, de cerca */
  { name: 'fx-particulas', url: P.viva, dark: true, act: async p => { await p.evaluate(`${gx}.focusNode('gateway')`); await p.mouse.click(4, 4); await p.evaluate(`${gx}.state.selected = null; document.querySelector('.gx-panel').classList.remove('on')`); }, wait: 1500, sel: '.gx-stage' },
  { name: 'fx-calor-tarjetas', url: P.galeria, act: async p => { await p.evaluate(`${gx}.focusNode('g-cards')`); }, wait: 1300, sel: '.gx-stage', closePanel: true },
  { name: 'fx-formas-mermaid', url: P.arq, sel: '.gx-stage' },
  { name: 'fx-ondas', url: P.software, act: async p => { await p.evaluate(`${gx}.trace('gateway','up')`); }, wait: 520, sel: '.gx-stage' },
  { name: 'fx-flujo', url: P.software, act: async p => { await p.click('.gx-fx-play'); }, wait: 1700, sel: '.gx-stage' },
  { name: 'fx-foco', url: P.software, act: async p => { await p.evaluate(`${gx}.focusNode('checkout')`); }, wait: 1500, sel: '.gx-stage' },
  { name: 'fx-vecindad', url: P.software, act: async p => { await p.evaluate(`${gx}.select('checkout')`); await p.evaluate(() => { const pl = document.querySelector('.gx-panel'); pl.scrollTop = pl.scrollHeight; }); }, wait: 900, sel: '.gx-egow' },
  { name: 'fx-zoom-semantico', url: P.demo + '#vivo', sel: '#g-grande .gx-stage', wait: 4500 },
  { name: 'fx-minimapa', url: P.arq, act: async p => { await p.evaluate(`${gx}.setMinimap(false)`); await p.hover('.gx-mini'); }, wait: 700, clipBox: async p => { const r = await p.evaluate(() => { const b = document.querySelector('.gx-stage').getBoundingClientRect(); return { x: b.x, y: b.y + b.height - 230, width: 520, height: 230 }; }); return r; } },
  { name: 'fx-piel-neon', url: P.neon, dark: true, sel: '.gx-host' },
  { name: 'fx-piel-blueprint', url: P.blueprint, sel: '.gx-host' },
  { name: 'fx-piel-glass', url: P.glass, sel: '.gx-stage' },
  { name: 'fx-trazo-mano', url: P.despliegue, sel: '.gx-stage' },
  /* catálogo */
  { name: 'cat-formas-flujo', url: P.shapes, sel: '.gx-stage' },
  { name: 'cat-graficos', url: P.galeria, act: async p => { await p.evaluate(`${gx}.focusNode('g-charts')`); }, wait: 1300, sel: '.gx-stage', closePanel: true },
  { name: 'cat-formas-datos', url: P.galeria, act: async p => { await p.evaluate(`${gx}.focusNode('g-shapes')`); }, wait: 1300, sel: '.gx-stage', closePanel: true },
  { name: 'cat-secuencia', url: P.sequence, sel: '.gx-stage' },
  { name: 'cat-gantt', url: P.gantt, sel: '.gx-stage' },
  { name: 'cat-sankey', url: P.sankey, sel: '.gx-stage' },
  { name: 'cat-treemap', url: P.treemap, sel: '.gx-stage' },
  { name: 'cat-git', url: P.git, sel: '.gx-stage' },
  { name: 'cat-clases', url: P.classd, sel: '.gx-stage' },
  { name: 'cat-er', url: P.er, sel: '.gx-stage' },
  /* ejemplos */
  { name: 'ej-plataforma-viva', url: P.viva, sel: '.gx-host' },
  { name: 'ej-software', url: P.software, sel: '.gx-host', view: [1400, 1100] },
  { name: 'ej-postmortem', url: P.postmortem, act: async p => { await p.evaluate(`${gx}.timeline.seek('10:50')`); }, wait: 1200, sel: '.gx-host', view: [1400, 1100] },
  { name: 'ej-pipeline', url: P.pipeline, act: async p => { await p.evaluate(`${gx}.timeline.seek('03:40')`); }, wait: 1200, sel: '.gx-host', view: [1400, 1100] },
  { name: 'ej-kubernetes', url: P.k8s, dark: true, act: async p => { await p.evaluate(`${gx}.expandTo(2)`); }, wait: 1500, sel: '.gx-stage' },
  { name: 'ej-ci-cd', url: P.cicd, sel: '.gx-stage' },
  { name: 'ej-almacen', url: P.almacen, sel: '.gx-stage' },
  { name: 'ej-onboarding', url: P.onboarding, sel: '.gx-stage' },
  { name: 'ej-radar', url: P.radar, sel: '.gx-stage' },
  { name: 'ej-pr-review', url: P.stack, sel: '.gx-stage' }
];

/* ---------- captura ---------- */
const browser = await chromium.launch();
const conv = await (await browser.newContext()).newPage();
await conv.setContent('<!doctype html><html><body></body></html>');
const toWebp = png => conv.evaluate(async b64 => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img, 0, 0);
  return c.toDataURL('image/webp', .82).split(',')[1];
}, png.toString('base64'));
let n = 0, bytes = 0;
for (const sc of S) {
  if (only.size && !only.has(sc.name)) continue;
  const [w, h] = sc.view || [1400, 900];
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: sc.dark ? 'dark' : 'light', reducedMotion: 'no-preference' });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(pathToFileURL(sc.url.split('#')[0]).href + (sc.url.includes('#') ? '#' + sc.url.split('#')[1] : ''), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForTimeout(sc.wait && !sc.act ? sc.wait : 3000);
  if (sc.act) { await sc.act(p); await p.waitForTimeout(sc.wait || 800); }
  if (sc.closePanel) await p.evaluate(`(() => { const g = ${gx}; g.state.selected = null; document.querySelector('.gx-panel').classList.remove('on'); g.state.trace = null; })()`);
  let png;
  if (sc.full) png = await p.screenshot();
  else if (sc.clipBox) png = await p.screenshot({ clip: await sc.clipBox(p) });
  else if (sc.clip) { const el = await p.$(sc.clip); await el.scrollIntoViewIfNeeded(); const b = await el.boundingBox(); png = await p.screenshot({ clip: { x: b.x, y: b.y, width: b.width, height: Math.min(b.height, sc.h || b.height) } }); }
  else { const el = await p.$(sc.sel); if (!el) { console.log(`  ✗ ${sc.name}: no encuentro ${sc.sel}`); await ctx.close(); continue; } await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(250); png = await el.screenshot(); }
  const webp = Buffer.from(await toWebp(png), 'base64');
  fs.writeFileSync(path.join(OUT, sc.name + '.webp'), webp);
  n++; bytes += webp.length;
  console.log(`  ✓ ${sc.name}.webp  ${Math.round(webp.length / 1024)} KB${errs.length ? '  ⚠ ' + errs.join(' | ') : ''}`);
  await ctx.close();
}
await browser.close();
fs.rmSync(TMP, { recursive: true, force: true });
console.log(`✓ ${n} capturas en docs/img (${Math.round(bytes / 1024)} KB)`);
