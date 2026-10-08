#!/usr/bin/env node
/* GIFs animados de los README (docs/gif/<es|en>/*.gif), grabados de la página de demostración en cada idioma.
 *   node tools/capture-gifs.mjs [nombre…] [--lang es|en]      (sin nombres, todos; sin --lang, los dos idiomas)
 * Graba cada escena con Playwright (vídeo del navegador), recorta el elemento que importa y la convierte
 * a GIF con ffmpeg (paleta propia por escena). Necesita Playwright con Chromium (o PLAYWRIGHT=/…/index.mjs,
 * como tools/capture-docs.mjs) y ffmpeg en el PATH (o FFMPEG=/ruta). La demostración se construye con
 * dist/, que debe estar al día. Las pestañas de Mermaid y React cargan sus librerías de la red.        */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'docs/gif');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'graphx-gif-'));
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const argv = process.argv.slice(2), li = argv.indexOf('--lang');
const LANGS = li >= 0 ? [argv[li + 1]] : ['es', 'en'];
const only = new Set(argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--lang'));
const { chromium } = await import(process.env.PLAYWRIGHT ? pathToFileURL(process.env.PLAYWRIGHT).href : 'playwright');
fs.mkdirSync(OUT, { recursive: true });

const DEMO = {};
for (const lang of LANGS) {
  console.log(`construyendo la demostración (${lang})…`);
  DEMO[lang] = path.join(TMP, `demo-${lang}.html`);
  execFileSync(process.execPath, ['examples/fx/build.mjs', DEMO[lang], '--standalone', '--lang', lang], { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] });
}
const pause = (p, ms) => p.waitForTimeout(ms);
/* un clic sin que Playwright desplace la página (el recorte del vídeo es fijo) */
const tap = (p, sel) => p.evaluate(s => { const el = document.querySelector(s); if (!el) throw new Error('no encuentro ' + s); el.click(); }, sel);

/* Cada escena: la pestaña, el elemento que se recorta, qué se hace mientras se graba (`act`, que marca con
   `mark()` el momento desde el que interesa el vídeo) y el ancho del GIF. */
const S = [
  { name: 'software', tab: 'software', sel: '#g-soft', view: [1280, 1000], width: 800, act: async (p, mark) => {
    await tap(p, '#g-soft .gx-tml-sp [data-k="4"]');
    mark(); await tap(p, '#s-play'); await pause(p, 8500);
  } },
  { name: 'impacto', tab: 'software', sel: '#g-soft .gx-stage', view: [1280, 1000], width: 800, act: async (p, mark) => {
    mark(); await pause(p, 600); await tap(p, '#s-blast'); await pause(p, 4200);
  } },
  { name: 'diagramas', tab: 'diagramas', sel: '#p-diagramas .console', view: [1360, 1100], width: 800, act: async (p, mark) => {
    /* Mermaid llega de jsDelivr: se espera a su dibujo (la primera vez y tras cada cambio) */
    const drawn = () => p.waitForFunction(() => document.querySelector('#dg-mmd svg') && !document.querySelector('#dg-mmd .mmd-note'), null, { timeout: 60000 });
    await tap(p, '.tchip[data-id="flowchart"]'); await drawn(); await pause(p, 1500);
    for (const id of ['sequence', 'gantt', 'c4', 'pie']) await (async () => { await tap(p, `.tchip[data-id="${id}"]`); await drawn(); })();
    await tap(p, '.tchip[data-id="flowchart"]'); await drawn(); await pause(p, 800);
    mark(); await pause(p, 1600);
    for (const id of ['sequence', 'gantt', 'c4', 'pie']) { await tap(p, `.tchip[data-id="${id}"]`); await drawn(); await pause(p, 1900); }
  } },
  { name: 'efectos', tab: 'diagramas', sel: '#p-diagramas .console', view: [1360, 1100], width: 800, dark: true, act: async (p, mark) => {
    await tap(p, '.tchip[data-id="x-arquitectura"]'); await tap(p, '#dg-view [data-v="fx"]'); await tap(p, '#dg-presets [data-v="vivid"]'); await pause(p, 2500);
    mark(); await pause(p, 1800);
    for (const v of ['neon', 'blueprint', 'glass']) { await tap(p, `#dg-presets [data-v="${v}"]`); await pause(p, 2300); }
  } },
  { name: 'vivo', tab: 'vivo', sel: '#g-viva', view: [1280, 900], width: 800, dark: true, act: async (p, mark) => {
    await tap(p, '#presets [data-p="neon"]'); await pause(p, 2500);
    mark(); await pause(p, 2500); await tap(p, '#b-incident'); await pause(p, 6000);
  } },
  { name: 'formas', tab: 'formas', sel: null, view: [1280, 860], width: 800, act: async (p, mark) => {
    await p.waitForSelector('.cat-item svg', { timeout: 20000 }); await pause(p, 800);
    await p.evaluate(() => window.scrollTo(0, document.getElementById('fm-state').getBoundingClientRect().top + scrollY - 70));
    mark(); await pause(p, 900);
    for (const [g, v] of [['fm-state', 'lit'], ['fm-color', '#8250df'], ['fm-state', 'sel'], ['fm-delta', 'added'], ['fm-color', '#1a7f37'], ['fm-dir', 'down']]) { await tap(p, `#${g} [data-v="${v}"]`); await pause(p, 900); }
    await p.evaluate(() => window.scrollTo(0, document.getElementById('fam-chart').getBoundingClientRect().top + scrollY - 70)); await pause(p, 1800);
  } },
  { name: 'arbol', tab: 'arbol', sel: '#g-tree', view: [1280, 1000], width: 800, act: async (p, mark) => {
    await pause(p, 800); mark(); await pause(p, 1200);
    await p.evaluate(() => document.querySelector('#g-tree input').focus({ preventScroll: true })); await p.keyboard.type('graphx-fx', { delay: 140 }); await pause(p, 2200);
  } }
];

const browser = await chromium.launch();
let n = 0, bytes = 0;
for (const lang of LANGS) for (const sc of S) {
  if (only.size && !only.has(sc.name)) continue;
  const url = tab => pathToFileURL(DEMO[lang]).href + '#' + tab;
  fs.mkdirSync(path.join(OUT, lang), { recursive: true });
  const [w, h] = sc.view;
  const dir = path.join(TMP, lang + '-' + sc.name);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: sc.dark ? 'dark' : 'light', reducedMotion: 'no-preference', recordVideo: { dir, size: { width: w, height: h } } });
  const p = await ctx.newPage(), t0 = Date.now();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(url(sc.tab), { waitUntil: 'domcontentloaded', timeout: 90000 }); await pause(p, 3500);
  let box = null, from = 0;
  if (sc.sel) {
    const el = await p.$(sc.sel);
    if (!el) { console.log(`  ✗ ${sc.name}: no encuentro ${sc.sel}`); await ctx.close(); continue; }
    await el.evaluate(e => window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 64)); await pause(p, 300);
  }
  if (sc.sel) { const b = await (await p.$(sc.sel)).boundingBox(); box = { x: Math.max(0, b.x), y: Math.max(0, b.y), w: Math.min(b.width, w - b.x), h: Math.min(b.height, h - Math.max(0, b.y)) }; }
  else box = { x: 0, y: 64, w, h: h - 64 };
  await sc.act(p, () => { from = (Date.now() - t0) / 1000; });
  const dur = (Date.now() - t0) / 1000 - from;
  await ctx.close();
  const video = fs.readdirSync(dir).find(f => f.endsWith('.webm'));
  const ev = v => Math.floor(v / 2) * 2;
  const crop = `crop=${ev(box.w)}:${ev(box.h)}:${ev(box.x)}:${ev(box.y)}`;
  const out = path.join(OUT, lang, sc.name + '.gif');
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-ss', from.toFixed(2), '-t', dur.toFixed(2), '-i', path.join(dir, video),
    '-vf', `${crop},fps=7,scale=${sc.width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=80:stats_mode=diff[pal];[b][pal]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
    '-loop', '0', out]);
  const kb = fs.statSync(out).size / 1024;
  n++; bytes += kb;
  console.log(`  ✓ ${lang}/${sc.name}.gif  ${dur.toFixed(1)} s · ${Math.round(kb)} KB${errs.length ? '  ⚠ ' + errs.join(' | ') : ''}`);
}
await browser.close();
fs.rmSync(TMP, { recursive: true, force: true });
console.log(`✓ ${n} GIFs en docs/gif (${Math.round(bytes)} KB)`);
