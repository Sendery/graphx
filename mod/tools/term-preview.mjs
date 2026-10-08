#!/usr/bin/env node
/* Vista previa del lienzo del terminal, fuera de Claude Code: monta el módulo Client (hooks/canvas.tsx) con una
 * superficie simulada y pinta sus fotogramas en ANSI, para ver cómo queda cada diagrama a cada tamaño y con cada
 * capacidad de terminal.
 *
 *   node mod/tools/term-preview.mjs <spec.json | diagrama.mmd> [opciones]
 *     --cols 120 --rows 36           tamaño del lienzo
 *     --color truecolor|256|16|mono  profundidad de color
 *     --glyphs unicode|basic|ascii   juego de caracteres
 *     --theme dark|light
 *     --keys "tab,tab,b"             teclas a pulsar antes de pintar (nombres de ClientKeyEvent; «S-tab» con mayúscula)
 *     --at 1200                      milisegundos de reloj que avanzar (animaciones) antes de pintar
 *     --frames 3 --every 300         varios fotogramas seguidos
 *     --plain                        sin colores (el texto tal cual)
 *     --depth N --view flow:<id>     la vista del motor
 *     --detail                       pedir el detalle de la pieza seleccionada al motor
 *
 * Necesita `node mod/build.mjs` (el motor del servidor) y npx (esbuild). */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MOD = path.join(HERE, '..', 'graphx');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const flag = k => args.includes(k);
const file = args.find(a => !a.startsWith('--') && (a.endsWith('.json') || a.endsWith('.mmd') || a.endsWith('.md') || a.endsWith('.txt')));
const cols = +opt('--cols', 120), rows = +opt('--rows', 36);

/* el módulo, empaquetado */
const out = path.join(HERE, '.cache', 'canvas.mjs');
fs.mkdirSync(path.dirname(out), { recursive: true });
execFileSync('npx', ['--yes', 'esbuild@0.24.0', path.join(MOD, 'hooks', 'canvas.tsx'), '--bundle', '--format=esm', '--platform=neutral', '--jsx-factory=h', '--jsx-fragment=Fragment', '--external:claude-code', `--outfile=${out}`, '--log-level=error'], { stdio: 'inherit' });
globalThis.Fragment = 'Fragment';
globalThis.h = (type, props, ...children) => {
  const p = Object.assign({}, props || {}, children.length ? { children: children.flat(Infinity) } : {});
  return typeof type === 'function' ? type(p) : { type, props: p };
};
const Canvas = (await import(pathToFileURL(out).href + '?' + Date.now())).default;

/* la escena, del motor de verdad */
const { createEngine } = await import(pathToFileURL(path.join(MOD, 'server', 'engine.mjs')).href);
const eng = createEngine(MOD);
let source;
if (!file) { console.error('falta el diagrama'); process.exit(2); }
const text = fs.readFileSync(file, 'utf8');
if (file.endsWith('.json')) source = { kind: 'spec', spec: JSON.parse(text) };
else if (file.endsWith('.txt')) source = { kind: 'paths', entries: text.split('\n').filter(Boolean) };
else source = { kind: 'mermaid', text: file.endsWith('.md') ? (/```mermaid\n([\s\S]*?)```/.exec(text) || [, text])[1] : text };
const board = { source, patches: [], signs: [], banner: null, guide: { steps: [], at: -1, seq: 0 }, view: { seq: 0 }, fx: opt('--fx') ? (opt('--fx') === 'false' ? false : opt('--fx')) : undefined };
const ui = { open: new Set(), close: new Set() };
if (opt('--depth')) ui.depth = +opt('--depth');
if (opt('--view')) ui.view = opt('--view');
let { scene } = await eng.render(board, 1, ui);

const caps = {
  color: opt('--color', 'truecolor'), glyphs: opt('--glyphs', 'unicode'), braille: opt('--glyphs', 'unicode') === 'unicode', images: 'none', imageSource: 'file',
  pointer: true, fine: false, motion: opt('--motion', 'full'), fps: 10, theme: opt('--theme', 'dark'), term: 'preview', remote: false, mux: null, why: [],
};

/* la superficie simulada */
let clock = 1_000_000;
Date.now = () => clock;
const timers = [];
const posted = [];
let keyFn = null, ptrFn = null;
const surface = {
  elements: { Box: p => ({ type: 'Box', props: p }), Text: p => ({ type: 'Text', props: p }) },
  state: undefined,
  setState(n) { this.state = n; },
  columns: cols, rows,
  every(ms, fn) { timers.push({ ms, fn, next: clock + ms }); return () => { }; },
  onPointer(fn) { ptrFn = fn; return () => { }; },
  onKey(fn) { keyFn = fn; return () => { }; },
  post(d) { posted.push(d); },
};
let detail = null;
const props = () => ({ scene, caps, detail, height: rows, pane: 'dock' });
let tree = Canvas(props(), surface);
const rerender = () => { tree = Canvas(props(), surface); };
async function drain() {
  /* lo que el lienzo pide al mod: cambiar la vista del motor, el detalle… */
  while (posted.length) {
    const d = posted.shift();
    if (d.type === 'ui') { if (d.open) { ui.open.add(d.open); ui.close.delete(d.open); } if (d.close) { ui.close.add(d.close); ui.open.delete(d.close); } if (d.depth != null) { ui.depth = d.depth; ui.open.clear(); ui.close.clear(); } if (d.dir) ui.dir = d.dir; if (d.search != null) ui.search = d.search; if (d.view) ui.view = d.view; scene = (await eng.render(board, 1, ui)).scene; }
    else if (d.type === 'detail' && flag('--detail')) detail = eng.detail(d.id);
    else if (d.type === 'step') { board.guide = { ...board.guide, at: d.at, seq: board.guide.seq + 1 }; scene = (await eng.render(board, 1, ui)).scene; }
    else process.stderr.write(`post ${JSON.stringify(d)}\n`);
  }
}
const advance = ms => { const end = clock + ms; while (true) { const due = timers.filter(t => t.next <= end).sort((a, b) => a.next - b.next)[0]; if (!due) break; clock = due.next; due.next += due.ms; due.fn(); rerender(); } clock = end; rerender(); };

/* la cascada de entrada dura un segundo: las teclas, después */
advance(+opt('--wait', 1500));
for (const k of (opt('--keys', '') || '').split(',').filter(Boolean)) {
  const shift = k.startsWith('S-'); const key = shift ? k.slice(2) : k;
  keyFn && keyFn({ key: key === 'space' ? ' ' : key === 'comma' ? ',' : key, ...(shift ? { shift: true } : {}) });
  rerender(); await drain(); rerender();
  advance(60);
}
if (opt('--click')) { const [x, y] = opt('--click').split(',').map(Number); ptrFn && ptrFn({ type: 'down', x, y, button: 'left' }); ptrFn && ptrFn({ type: 'up', x, y, button: 'left' }); rerender(); await drain(); rerender(); }
if (opt('--hover')) { const [x, y] = opt('--hover').split(',').map(Number); ptrFn && ptrFn({ type: 'move', x, y }); rerender(); }
advance(+opt('--at', 0));

/* a ANSI */
const NAMES = { black: 30, red: 31, green: 32, yellow: 33, blue: 34, magenta: 35, cyan: 36, white: 37, gray: 90, redBright: 91, greenBright: 92, yellowBright: 93, blueBright: 94, magentaBright: 95, cyanBright: 96, whiteBright: 97 };
const col = (c, bg) => { if (!c) return ''; if (NAMES[c]) return `\x1b[${NAMES[c] + (bg ? 10 : 0)}m`; const m = /^#(..)(..)(..)$/.exec(c); return m ? `\x1b[${bg ? 48 : 38};2;${parseInt(m[1], 16)};${parseInt(m[2], 16)};${parseInt(m[3], 16)}m` : ''; };
function ansi(node, inh = {}) {
  if (node == null || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') {
    if (flag('--plain')) return String(node);
    const st = inh;
    return `${col(st.color)}${col(st.backgroundColor, true)}${st.bold ? '\x1b[1m' : ''}${st.dimColor ? '\x1b[2m' : ''}${st.italic ? '\x1b[3m' : ''}${st.underline ? '\x1b[4m' : ''}${st.inverse ? '\x1b[7m' : ''}${node}\x1b[0m`;
  }
  if (Array.isArray(node)) return node.map(n => ansi(n, inh)).join('');
  const p = node.props || {};
  if (node.type === 'Box') return [].concat(p.children || []).map(c => ansi(c, inh)).join('\n');
  const st = Object.assign({}, inh, Object.fromEntries(['color', 'backgroundColor', 'bold', 'dimColor', 'italic', 'underline', 'inverse'].filter(k => p[k] !== undefined).map(k => [k, p[k]])));
  return [].concat(p.children ?? []).map(c => ansi(c, st)).join('');
}
/* a PNG: cada celda en su sitio (SVG con fuente monoespaciada) rasterizada con rsvg-convert */
const ANSI_HEX = { black: '#000000', red: '#cd3131', green: '#0dbc79', yellow: '#e5e510', blue: '#2472c8', magenta: '#bc3fbc', cyan: '#11a8cd', white: '#e5e5e5', gray: '#666666', redBright: '#f14c4c', greenBright: '#23d18b', yellowBright: '#f5f543', blueBright: '#3b8eea', magentaBright: '#d670d6', cyanBright: '#29b8db', whiteBright: '#ffffff' };
function toPng(node, outFile) {
  const CW = 9, CH = 19, termBg = caps.theme === 'dark' ? '#0d1117' : '#ffffff', termFg = caps.theme === 'dark' ? '#d0d7de' : '#1f2328';
  const rowsOut = [];
  const walk = (n, st, row) => {
    if (n == null || n === false) return;
    if (typeof n === 'string' || typeof n === 'number') { for (const ch of String(n)) row.push({ ch, st }); return; }
    if (Array.isArray(n)) { n.forEach(c => walk(c, st, row)); return; }
    const p = n.props || {};
    if (n.type === 'Box') { [].concat(p.children || []).forEach(c => { const r = []; walk(c, st, r); rowsOut.push(r); }); return; }
    const s2 = Object.assign({}, st, Object.fromEntries(['color', 'backgroundColor', 'bold', 'dimColor', 'italic', 'underline', 'inverse'].filter(k => p[k] !== undefined).map(k => [k, p[k]])));
    [].concat(p.children ?? []).forEach(c => walk(c, s2, row));
  };
  walk(node, {}, null);
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const hexOf = c => (c ? ANSI_HEX[c] || c : null);
  let body = '';
  rowsOut.forEach((r, y) => {
    let x = 0;
    for (const { ch, st } of r) {
      const wide = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿＀-｠]|[\u{1f300}-\u{1faff}]/u.test(ch) ? 2 : 1;
      let fg = hexOf(st.color) || termFg, bg = hexOf(st.backgroundColor);
      if (st.inverse) { const t = fg; fg = bg || termBg; bg = t; }
      if (bg) body += `<rect x="${x * CW}" y="${y * CH}" width="${CW * wide + 0.6}" height="${CH + 0.6}" fill="${bg}"/>`;
      if (ch !== ' ') body += `<text x="${x * CW}" y="${y * CH + 14}" fill="${fg}"${st.bold ? ' font-weight="bold"' : ''}${st.dimColor ? ' opacity="0.55"' : ''}${st.italic ? ' font-style="italic"' : ''}${st.underline ? ' text-decoration="underline"' : ''}>${esc(ch)}</text>`;
      x += wide;
    }
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * CW}" height="${rows * CH}"><rect width="100%" height="100%" fill="${termBg}"/><g font-family="Menlo, Monaco, monospace" font-size="15">${body}</g></svg>`;
  const tmp = outFile.replace(/\.png$/, '.svg');
  fs.writeFileSync(tmp, svg);
  execFileSync('rsvg-convert', ['-o', outFile, tmp]);
  console.log('png →', outFile);
}
if (opt('--png')) { toPng(tree, opt('--png')); process.exit(0); }

const frames = +opt('--frames', 1);
for (let f = 0; f < frames; f++) {
  if (f) advance(+opt('--every', 300));
  const s = ansi(tree);
  const json = JSON.stringify(tree);
  console.log(`┄┄ ${path.basename(file)} · ${cols}×${rows} · ${caps.color} · ${caps.glyphs} · ${caps.theme} · t=${clock - 1_000_000}ms · ${json.length} car. serializados`);
  console.log(s);
}
if (flag('--posts')) console.log(posted);
process.exit(0);
