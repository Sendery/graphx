#!/usr/bin/env node
/* Los distribuibles de una versión, clasificados, en release/<tag>/ (git lo ignora), listos para subir a una
 * release de GitHub con su SHA256SUMS.txt y sus notas.
 *   node tools/release.mjs [--tag v1.9.0-rc.1]        (sin --tag: v<versión de package.json>)
 *
 *   navegador · todo en uno   graphx-<v>.bundle.min.js      ELK + motor + formas + Mermaid + efectos + estilos
 *   navegador · ligero        graphx-<v>.lite.min.js        lo mismo sin ELK (lo carga de jsDelivr)
 *   por módulos               graphx-<v>-modules.zip        cada pieza minificada suelta, con sus estilos
 *   kit                       graphx-<v>-kit.zip            fuentes, dist/, react/, ELK y el ensamblador
 *   Claude Code               graphx-claude-<v del mod>.zip la skill graphx, el mod graphx-mod montado (con su bundle y
 *                                                           jsdom) y el instalador: se descomprime y `node install.mjs`
 *
 * dist/ tiene que corresponder a las fuentes (`node tools/build-dist.mjs`); el mod se monta con mod/build.mjs.
 * Necesita `zip` en el PATH. */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const r = (...p) => path.join(ROOT, ...p);
const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const VERSION = JSON.parse(fs.readFileSync(r('package.json'), 'utf8')).version;
const MOD_VERSION = JSON.parse(fs.readFileSync(r('mod', 'graphx-mod', '.claude-plugin', 'plugin.json'), 'utf8')).version;
const TAG = opt('--tag') ?? `v${VERSION}`;
const V = TAG.replace(/^v/, '');
if (!V.startsWith(VERSION)) { console.error(`✗ la etiqueta ${TAG} no es de la versión ${VERSION} de package.json`); process.exit(1); }
const pre = V.slice(VERSION.length);
const MV = MOD_VERSION + pre;

/* dist/ al día: la misma huella que comprueba graphx-build.mjs */
const SRC = ['graphx.js', 'graphx.css', 'graphx-mermaid.js', 'graphx-shapes.js', 'graphx-layouts.js', 'graphx-tree.js', 'graphx-fx.js'];
const hash = SRC.reduce((h, f) => h.update(fs.readFileSync(r(f))), crypto.createHash('sha256')).digest('hex');
if (fs.readFileSync(r('dist', 'SOURCE_HASH'), 'utf8').trim() !== hash) { console.error('✗ dist/ no corresponde a las fuentes: ejecuta `node tools/build-dist.mjs`'); process.exit(1); }

const OUT = r('release', TAG);
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const STAGE = fs.mkdtempSync(path.join(OUT, '.stage-'));
const copy = (from, to) => { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.cpSync(from, to, { recursive: true }); };
const zip = (name, dir) => execFileSync('zip', ['-qr', '-X', path.join(OUT, name), path.basename(dir)], { cwd: path.dirname(dir) });

/* navegador */
fs.copyFileSync(r('dist', 'graphx.bundle.min.js'), path.join(OUT, `graphx-${V}.bundle.min.js`));
fs.copyFileSync(r('dist', 'graphx.lite.min.js'), path.join(OUT, `graphx-${V}.lite.min.js`));

/* por módulos */
const mods = path.join(STAGE, `graphx-${V}-modules`);
for (const f of ['graphx.min.js', 'graphx.min.css', 'graphx-mermaid.min.js', 'graphx-shapes.min.js', 'graphx-layouts.min.js', 'graphx-tree.min.js', 'graphx-fx.min.js']) copy(r('dist', f), path.join(mods, f));
fs.writeFileSync(path.join(mods, 'LEEME.txt'), `GraphX ${V} por módulos, minificados.

Orden de carga: graphx.min.css · ELK (https://cdn.jsdelivr.net/npm/elkjs@0.12/lib/elk.bundled.js) ·
graphx-shapes · graphx-layouts · graphx-tree · graphx.min.js · graphx-mermaid · graphx-fx.
Solo hacen falta las piezas que se usen: el motor necesita ELK y las formas; Mermaid, árboles y efectos son opcionales.
Para un solo fichero, graphx-${V}.bundle.min.js (con ELK) o graphx-${V}.lite.min.js (ELK bajo demanda).
`);
zip(`graphx-${V}-modules.zip`, mods);

/* kit: fuentes, dist, react, ELK y el ensamblador */
const kit = path.join(STAGE, `graphx-${V}-kit`);
for (const f of [...SRC, 'graphx-build.mjs', 'package.json', 'README.md', 'README.es.md']) copy(r(f), path.join(kit, f));
copy(r('vendor', 'elk.bundled.js'), path.join(kit, 'vendor', 'elk.bundled.js'));
copy(r('react'), path.join(kit, 'react'));
for (const f of fs.readdirSync(r('dist'))) copy(r('dist', f), path.join(kit, 'dist', f));
zip(`graphx-${V}-kit.zip`, kit);

/* Claude Code: la skill, el mod montado y el instalador, listos para `node install.mjs` (sin npm ni compilar) */
const cc = path.join(STAGE, `graphx-claude-${MV}`);
execFileSync(process.execPath, [r('mod', 'build.mjs'), '--to', path.join(cc, 'mod', 'graphx-mod')], { stdio: ['ignore', 'ignore', 'inherit'] });
fs.rmSync(path.join(cc, 'mod', 'graphx-mod', 'tests'), { recursive: true, force: true });
copy(r('skills', 'graphx'), path.join(cc, 'skills', 'graphx'));
copy(r('install.mjs'), path.join(cc, 'install.mjs'));
fs.writeFileSync(path.join(cc, 'README.md'), `# GraphX ${MV} para Claude Code · for Claude Code

\`\`\`bash
node install.mjs          # casillas · checkboxes: skill, mod (terminal), mod (desktop app)
node install.mjs --all    # todo sin preguntar · everything, no questions
node install.mjs --help
\`\`\`

Necesita / needs \`node\` ≥ 18. Opcional / optional: \`rsvg-convert\` (librsvg) para la imagen del motor / for the
engine image. Se instala en / installs into \`~/.claude/skills\` (o / or \`$CLAUDE_CONFIG_DIR\`); abre una sesión nueva
de Claude Code / open a new Claude Code session:

| | |
|---|---|
| \`/graphx help\` | la skill: diagramas en lenguaje normal · the skill: diagrams in plain language |
| \`/graphx-mod help\` | el mod: el lienzo, el navegador, sus comandos y teclas · the mod: the canvas, the browser, its commands and keys |

\`node install.mjs --uninstall --all\` lo quita / removes it. GraphX ${V}: https://github.com/Sendery/graphx
`);
zip(`graphx-claude-${MV}.zip`, cc);

fs.rmSync(STAGE, { recursive: true, force: true });
const files = fs.readdirSync(OUT).filter(f => !f.startsWith('.')).sort();
fs.writeFileSync(path.join(OUT, 'SHA256SUMS.txt'), files.map(f => `${crypto.createHash('sha256').update(fs.readFileSync(path.join(OUT, f))).digest('hex')}  ${f}`).join('\n') + '\n');
const size = f => { const n = fs.statSync(path.join(OUT, f)).size; return n > 1 << 20 ? (n / (1 << 20)).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB'; };
for (const f of [...files, 'SHA256SUMS.txt']) console.log(`  ${f.padEnd(36)} ${size(f).padStart(8)}`);
console.log(`✓ ${TAG} en ${path.relative(ROOT, OUT)}/`);
