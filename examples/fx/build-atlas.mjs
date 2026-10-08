#!/usr/bin/env node
/* Una página autocontenida con un atlas: varias perspectivas del mismo sistema (examples/fx/atlas.js).
 *   node examples/fx/build-atlas.mjs [atlas.json] <salida.html> [--lang es|en]
 * Sin atlas.json, el de ejemplo (examples/fx/atlas.json, o examples/en/fx/atlas.json con --lang en). Lleva el
 * motor entero (dist/graphx.bundle.min.js, ELK dentro): funciona sin red salvo las fuentes. La perspectiva y la
 * pieza abiertas van en el enlace (#p=<perspectiva>&n=<pieza>). */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../..');
const argv = process.argv.slice(2), li = argv.indexOf('--lang');
const lang = li >= 0 && argv[li + 1] === 'en' ? 'en' : 'es';
const files = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--lang');
const out = files.length > 1 ? files[1] : files[0];
if (!out) { console.error('uso: node examples/fx/build-atlas.mjs [atlas.json] <salida.html> [--lang es|en]'); process.exit(2); }
const src = files.length > 1 ? files[0] : path.join(ROOT, lang === 'en' ? 'examples/en/fx/atlas.json' : 'examples/fx/atlas.json');
const atlas = JSON.parse(fs.readFileSync(src, 'utf8'));
for (const k of ['entities', 'perspectives']) if (!atlas[k]) { console.error(`✗ ${src}: falta «${k}»`); process.exit(1); }
const noClose = s => s.replace(/<\/script/gi, '<\\/script');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const page = `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(atlas.title || 'Atlas')} · atlas</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Public+Sans:wght@400;500;600&family=JetBrains+Mono:wght@500;600&display=swap">
<style>
:root { --bg: #f3f6f6; --surface-2: #e9efef; --panel: #fff; --ink: #142120; --muted: #4f605e; --hairline: #d3dcdb;
  --accent-ink: #0b7480; --accent-wash: rgba(11, 116, 128, .10); --signal: #b45309;
  --f-display: "Bricolage Grotesque", system-ui, sans-serif; --f-body: "Public Sans", system-ui, sans-serif; --f-mono: "JetBrains Mono", ui-monospace, monospace; color-scheme: light; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #0b1112; --surface-2: #121b1c; --panel: #111a1b; --ink: #e2ebea; --muted: #93a4a2;
  --hairline: #253234; --accent-ink: #3cc4cf; --accent-wash: rgba(60, 196, 207, .12); --signal: #f0a04b; color-scheme: dark; } }
:root[data-theme="dark"] { --bg: #0b1112; --surface-2: #121b1c; --panel: #111a1b; --ink: #e2ebea; --muted: #93a4a2;
  --hairline: #253234; --accent-ink: #3cc4cf; --accent-wash: rgba(60, 196, 207, .12); --signal: #f0a04b; color-scheme: dark; }
html, body { background: var(--bg); margin: 0; }
#atlas { padding: 20px 16px 24px; max-width: 1680px; margin: 0 auto; }
</style>
</head>
<body>
<div id="atlas"></div>
<script>${noClose(fs.readFileSync(path.join(ROOT, 'dist/graphx.bundle.min.js'), 'utf8'))}</script>
<script>${noClose(fs.readFileSync(path.join(HERE, 'atlas.js'), 'utf8'))}</script>
<script type="application/json" id="atlas-data">${JSON.stringify(atlas).replace(/</g, '\\u003c')}</script>
<script>
  GraphXAtlas.mount(document.getElementById('atlas'), JSON.parse(document.getElementById('atlas-data').textContent),
    { lang: '${lang}', hash: true, height: 'max(640px, calc(100vh - 190px))' });
</script>
</body>
</html>
`;
fs.writeFileSync(out, page);
console.log(`✓ ${out} (${Math.round(page.length / 1024)} KB, ${atlas.perspectives.length} perspectivas)`);
