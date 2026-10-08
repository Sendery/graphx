#!/usr/bin/env node
/* Las capturas y los GIF de mod/README.md (mod/docs/img, mod/docs/gif), grabados del lienzo del terminal con
 * term-preview y del motor con el servidor del mod.
 *
 *   node mod/tools/capture-media.mjs [nombre…]        (sin nombres, todas)
 *
 * Necesita `node mod/build.mjs`, rsvg-convert y ffmpeg en el PATH. Los mosaicos juntan varias capturas del
 * mismo tamaño en una imagen (filtro `tile` de ffmpeg). */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..');
const MOD = path.join(HERE, '..', 'graphx-mod');
const DEMOS = path.join(MOD, 'assets', 'demos');
const OUT = path.join(HERE, '..', 'docs');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'graphx-mod-media-'));
const only = new Set(process.argv.slice(2));
fs.mkdirSync(path.join(OUT, 'img'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'gif'), { recursive: true });

const demo = f => path.join(DEMOS, f);
const preview = (file, o) => execFileSync(process.execPath, [path.join(HERE, 'term-preview.mjs'), file, ...Object.entries(o).flatMap(([k, v]) => v === true ? [`--${k}`] : [`--${k}`, String(v)])], { stdio: ['ignore', 'pipe', 'inherit'] });
/* varias capturas del mismo tamaño en una sola imagen */
function mosaic(out, cols, shots) {
  const dir = fs.mkdtempSync(path.join(TMP, 'tile-'));
  shots.forEach(([file, o], i) => preview(file, { ...o, png: path.join(dir, `t${String(i).padStart(2, '0')}.png`) }));
  const rows = Math.ceil(shots.length / cols);
  /* `tile` quiere fotogramas iguales: las más pequeñas se rellenan (transparente) hasta la mayor */
  const size = f => { const b = fs.readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort().map(f => path.join(dir, f));
  const dims = files.map(size), mw = Math.max(...dims.map(d => d[0])), mh = Math.max(...dims.map(d => d[1]));
  files.forEach((f, i) => {
    if (dims[i][0] === mw && dims[i][1] === mh) return;
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', f, '-vf', `format=rgba,pad=${mw}:${mh}:0:0:color=0x00000000`, f + '.p.png']);
    fs.renameSync(f + '.p.png', f);
  });
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(dir, 't%02d.png'), '-vf', `format=rgba,tile=${cols}x${rows}:padding=18:color=0x00000000`, '-frames:v', '1', out]);
}

/* un árbol de ficheros de verdad: el de este repositorio, sin lo generado */
const treeTxt = path.join(TMP, 'repo.txt');
fs.writeFileSync(treeTxt, execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(f => f && !/^(docs\/(gif|img|demo)|examples\/|vendor\/|dist\/)/.test(f)).join('\n'));

const W = 'claude · /graphx-mod';
const S = [
  /* películas */
  { name: 'presentacion', gif: demo('software.json'), o: { cols: 150, rows: 40, fps: 6, chrome: `${W} demo software · r presentar`, script: 'hold:1500;r;hold:3500;n;hold:3500;n;hold:3500;b;hold:1500' } },
  { name: 'zoom', gif: demo('kubernetes.json'), o: { cols: 120, rows: 32, fps: 6, chrome: `${W} demo kubernetes · z x zoom semántico`, script: 'hold:1500;z;hold:1500;z;hold:1500;z;hold:2000;x;hold:1200;x;hold:1200;x;hold:1500' } },
  /* seis tabuladores llegan a Antifraude en el orden de lectura de esta escena a 150 × 40 */
  { name: 'impacto', gif: demo('software.json'), o: { cols: 150, rows: 40, fps: 8, chrome: `${W} · c impacto · t trazar`, script: 'hold:600;tab tab tab tab tab tab;hold:900;c;hold:3500;c;t;hold:2500' } },
  { name: 'tiempo', gif: demo('software.json'), o: { cols: 150, rows: 40, fps: 6, chrome: `${W} · y línea de tiempo`, script: 'hold:600;y;hold:9000' } },
  { name: 'secuencia', gif: demo('sequence.mmd'), o: { cols: 120, rows: 36, fps: 6, chrome: `${W} · f reproducir la secuencia`, script: 'hold:800;f;hold:9000' } },
  { name: 'arbol', gif: treeTxt, o: { cols: 110, rows: 30, fps: 6, chrome: `${W} paths · árbol de ficheros`, script: 'hold:800;j;hold:400;j;hold:400;j;hold:700;o;hold:900;j;hold:400;j;hold:400;j;hold:400;j;hold:700;o;hold:1800' } },
  /* fotos */
  { name: 'claro', png: demo('onboarding.json'), o: { cols: 132, rows: 34, theme: 'light', chrome: `${W} demo onboarding · tema claro`, wait: 2500 } },
  { name: 'ancho', png: demo('flowchart.mmd'), o: { cols: 150, rows: 36, keys: 'tab,tab,tab', detail: true, chrome: 'ancho · 150 × 36 · el grafo y el panel lateral' } },
  { name: 'tamanos', mosaic: 3, shots: [
    [demo('flowchart.mmd'), { cols: 96, rows: 30, chrome: 'normal · 96 × 30 · compacto' }],
    [demo('flowchart.mmd'), { cols: 60, rows: 30, chrome: 'estrecho · 60 × 30 · el esquema' }],
    [demo('flowchart.mmd'), { cols: 38, rows: 30, chrome: 'micro · 38 × 30' }],
  ] },
  { name: 'color', mosaic: 2, shots: ['truecolor', '256', '16', 'mono'].map(c => [demo('flowchart.mmd'), { cols: 96, rows: 30, color: c, chrome: `color: ${c}` }]) },
  { name: 'caracteres', mosaic: 3, shots: ['unicode', 'basic', 'ascii'].map(g => [demo('ci-cd.mmd'), { cols: 72, rows: 26, glyphs: g, chrome: `caracteres: ${g}` }]) },
  { name: 'mermaid', mosaic: 3, shots: ['gantt', 'git', 'class', 'er', 'mindmap', 'pie', 'sankey', 'journey', 'kanban', 'timeline', 'c4', 'architecture'].map(t =>
    [demo(`${t}.mmd`), { cols: 96, rows: 28, chrome: `${t}`, wait: 2500 }]) },
];

for (const s of S) {
  if (only.size && !only.has(s.name)) continue;
  const t0 = Date.now();
  if (s.gif) preview(s.gif, { ...s.o, gif: path.join(OUT, 'gif', `${s.name}.gif`) });
  else if (s.png) preview(s.png, { ...s.o, png: path.join(OUT, 'img', `${s.name}.png`) });
  else mosaic(path.join(OUT, 'img', `${s.name}.png`), s.mosaic, s.shots);
  console.log(`✓ ${s.name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}

/* el escritorio: el SVG del motor, que es lo que ve el panel de Claude Desktop */
if (!only.size || only.has('escritorio')) {
  const { createEngine } = await import(pathToFileURL(path.join(MOD, 'server', 'engine.mjs')).href);
  const eng = createEngine(MOD);
  for (const theme of ['light', 'dark']) {
    const board = { source: { kind: 'spec', spec: JSON.parse(fs.readFileSync(demo('software.json'), 'utf8')) }, patches: [], signs: [], banner: null, guide: { steps: [], at: -1, seq: 0 }, view: { seq: 0 } };
    await eng.render(board, 1, { open: new Set(), close: new Set() });
    const png = await eng.png(theme, { width: 1400 });
    fs.writeFileSync(path.join(OUT, 'img', `escritorio-${theme}.png`), png);
  }
  console.log('✓ escritorio');
}
fs.rmSync(TMP, { recursive: true, force: true });
process.exit(0);
