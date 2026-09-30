#!/usr/bin/env node
/* Ensamblador de GraphX: valida el JSON, lo enriquece con las stats de git y emite
 * una página autocontenida (motor + ELK + estilos + datos) o un fragmento para la
 * plantilla de revisión.
 *
 *   node graphx-build.mjs <graph.json> [--out page.html] [--git <repo> --base <ref> --head <ref>]
 *                                      [--fragment] [--height 640] [--strict]
 *
 * --git     rellena additions/deletions de cada fichero con `git diff --numstat` y el
 *           enlace al diff de la PR (`links.pr`) si el JSON no los trae.
 * --fragment emite solo el bloque `[data-gx]`, sin motor: la plantilla lo inyecta una vez.
 * --strict  convierte los avisos en error.
 * --check   solo valida (lo usa el ensamblador de la plantilla).
 * --mode full|lite|dev  full (defecto) bundle minificado con ELK · lite ELK desde jsDelivr · dev fuentes
 * --json-out <f> guarda el JSON ya enriquecido (stats y enlaces) para inlinearlo en otra página.
 *
 * La entrada también puede ser Mermaid: un `.mmd`/`.mermaid`, o un `.md` del que se toma el bloque
 * ```mermaid número --block N (el primero por defecto). graphx-mermaid.js lo traduce al JSON y el
 * resto del camino es el mismo. --lang en|es fija el idioma de los textos generados.               */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const flag = k => args.includes(k);
/* el fichero de entrada es el primer argumento que no es valor de una opción */
const VALUED = new Set(['--out', '--title', '--height', '--json-out', '--mode', '--git', '--base', '--head', '--block', '--lang']);
const src = args.find((a, i) => !a.startsWith('--') && !VALUED.has(args[i - 1]));
const SRC_RE = /\.(json|mmd|mermaid|md|markdown)$/i;
if (!src || !SRC_RE.test(src)) { console.error('uso: graphx-build.mjs <graph.json | diagrama.mmd | doc.md> [--out x.html] [--git <repo> --base <ref>] [--fragment]'); process.exit(2); }

const sandbox = { console: { warn() {}, error() {}, log() {} } };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(HERE, 'graphx.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(HERE, 'graphx-mermaid.js'), 'utf8'), sandbox);

const errors = [], warns = [];
let spec;
if (/\.json$/i.test(src)) spec = JSON.parse(fs.readFileSync(src, 'utf8'));
else {
  /* --- Mermaid → JSON de GraphX --- */
  let text = fs.readFileSync(src, 'utf8');
  if (/\.(md|markdown)$/i.test(src)) {
    const blocks = [...text.matchAll(/^([ \t]*)(```|~~~)[ \t]*mermaid[^\n]*\n([\s\S]*?)^\1\2[ \t]*$/gm)].map(m => m[3]);
    const k = +opt('--block', 1);
    if (!blocks.length) { console.error(`✗ ${src}: no hay ningún bloque \`\`\`mermaid`); process.exit(1); }
    if (!blocks[k - 1]) { console.error(`✗ ${src}: pides el bloque ${k} y solo hay ${blocks.length}`); process.exit(1); }
    text = blocks[k - 1];
    if (blocks.length > 1) console.log(`mermaid: bloque ${k} de ${blocks.length} (elige otro con --block N)`);
  }
  let r;
  try { r = sandbox.GraphX.fromMermaid(text, { lang: opt('--lang', 'es'), title: opt('--title') }); }
  catch (e) { console.error(`✗ mermaid, ${e.message}`); process.exit(1); }
  spec = JSON.parse(JSON.stringify(r.spec));
  r.warnings.forEach(w => warns.push('mermaid, ' + w));
  console.log(`mermaid: ${r.type} → ${spec.nodes.length} piezas, ${spec.edges.length} conexiones${(spec.flows || []).length ? `, ${spec.flows.length} flujo` : ''}`);
}

/* --- el propio modelo del motor detecta ids duplicados, padres y extremos desconocidos, ciclos --- */
const G = sandbox.GraphX.buildModel(spec);
G.warn.forEach(w => errors.push(w));

const ids = new Set([...(spec.lanes || []).map(l => l.id), ...(spec.nodes || []).map(n => n.id)]);
const eids = new Set((spec.edges || []).map(e => e.id).filter(Boolean));
const KINDS = new Set(['service', 'app', 'module', 'function', 'method', 'class', 'file', 'route', 'job', 'queue', 'datastore', 'cache', 'external', 'ui', 'config', 'test', 'package', 'other']);
const DELTAS = new Set(['added', 'modified', 'removed', 'unchanged']);
const EKINDS = new Set(['call', 'http', 'rpc', 'event', 'queue', 'data', 'dependency', 'render', 'async', 'other']);

/* iconos propios, estados propios y leyenda (1.4) */
const PATH_RE = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/;
for (const [k, v] of Object.entries(spec.icons || {})) {
  const d = typeof v === 'string' ? v : v && v.path;
  if (typeof d !== 'string' || !PATH_RE.test(d) || d.length >= 6000) errors.push(`icons.${k}: path SVG no válido (solo comandos y números, <6000 caracteres)`);
  else KINDS.add(k);
}
const STATUSES = spec.statuses || {};
for (const [k, v] of Object.entries(STATUSES)) {
  if (!v || typeof v !== 'object' || !v.label) errors.push(`statuses.${k}: necesita label`);
}
for (const [i, e] of ((spec.legend && spec.legend.edges) || []).entries()) {
  if (!e.label) errors.push(`legend.edges[${i}]: sin label`);
  if (e.style && !['solid', 'dashed', 'hero', 'flow', 'muted'].includes(e.style)) errors.push(`legend.edges[${i}]: style «${e.style}» inválido`);
}
for (const n of spec.nodes || []) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(n.id)) errors.push(`nodo ${n.id}: id con caracteres no admitidos`);
  if (n.kind && !KINDS.has(n.kind)) warns.push(`nodo ${n.id}: kind «${n.kind}» desconocido (se pinta como other)`);
  if (n.status && !STATUSES[n.status]) errors.push(`nodo ${n.id}: status «${n.status}» no está en statuses`);
  if (n.delta && !DELTAS.has(n.delta)) errors.push(`nodo ${n.id}: delta «${n.delta}» inválido`);
  if (!n.summary) warns.push(`nodo ${n.id}: sin summary — el tooltip y el panel saldrán vacíos`);
  if (!n.label) errors.push(`nodo ${n.id}: sin label`);
}
for (const e of spec.edges || []) {
  if (!e.id) warns.push(`arista ${e.from}→${e.to}: sin id — un paso del recorrido no podrá apuntarla`);
  if (e.kind && !EKINDS.has(e.kind)) warns.push(`arista ${e.id}: kind «${e.kind}» desconocido`);
  if (e.delta && !DELTAS.has(e.delta)) errors.push(`arista ${e.id}: delta «${e.delta}» inválido`);
}
/* --- enlaces relacionados (opcionales): jira · pr · notion · artifact · doc · url · node --- */
const LKINDS = new Set(['jira', 'pr', 'notion', 'artifact', 'doc', 'url', 'node']);
const checkLinks = (list, where) => (list || []).forEach((l, i) => {
  const w = `${where}.links[${i}]`;
  if (!l || typeof l !== 'object') return errors.push(`${w}: debe ser un objeto`);
  const k = l.kind || 'url';
  if (!LKINDS.has(k)) warns.push(`${w}: kind «${k}» desconocido (se trata como url)`);
  if (k === 'node') { if (!ids.has(l.target)) errors.push(`${w}: target desconocido ${l.target}`); return; }
  if (k === 'jira' && !l.url && !l.key) errors.push(`${w}: jira necesita key o url`);
  if (k === 'pr' && !l.url && !l.number) errors.push(`${w}: pr necesita number o url`);
  if (k === 'pr' && !l.url && !l.repo && !(spec.links && spec.links.repo)) errors.push(`${w}: pr sin repo ni links.repo`);
  if (l.url && !/^https?:\/\//i.test(l.url)) errors.push(`${w}: solo se admiten URLs http(s) — «${String(l.url).slice(0, 40)}»`);
  if (['notion', 'artifact', 'doc', 'url'].includes(k) && !l.url) errors.push(`${w}: ${k} necesita url`);
});
(spec.lanes || []).forEach(n => checkLinks(n.links, `carril ${n.id}`));
(spec.nodes || []).forEach(n => checkLinks(n.links, `nodo ${n.id}`));
(spec.edges || []).forEach(e => checkLinks(e.links, `arista ${e.id}`));
checkLinks(spec.links && spec.links.related, 'links.related');
/* --- colores opcionales: solo valores de color CSS --- */
const checkColor = (v, where) => {
  if (v == null) return;
  const one = x => x == null || sandbox.GraphX.safeColor(x);
  const ok = typeof v === 'string' ? one(v) : (typeof v === 'object' && one(v.light) && one(v.dark) && (v.light || v.dark));
  if (!ok) errors.push(`${where}: color no válido ${JSON.stringify(v)} — usa hex, rgb()/hsl()/oklch(), un nombre CSS o { light, dark }`);
};
(spec.lanes || []).forEach(n => checkColor(n.color, `carril ${n.id}`));
(spec.nodes || []).forEach(n => checkColor(n.color, `nodo ${n.id}`));
(spec.edges || []).forEach(e => checkColor(e.color, `arista ${e.id}`));
Object.entries(spec.statuses || {}).forEach(([k, v]) => checkColor(v && v.color, `statuses.${k}`));
((spec.legend && spec.legend.edges) || []).forEach((e, i) => checkColor(e.color, `legend.edges[${i}]`));
(spec.flows || []).forEach(f => (f.messages || []).forEach(m => checkColor(m.color, `flujo ${f.id}, mensaje ${m.id}`)));
if (spec.theme) {
  const known = new Set(sandbox.GraphX.THEME_KEYS);
  const sets = spec.theme.light || spec.theme.dark ? [['light', spec.theme.light || {}], ['dark', spec.theme.dark || {}]] : [['theme', spec.theme]];
  sets.forEach(([mode, set]) => Object.entries(set).forEach(([k, v]) => {
    if (!known.has(k)) warns.push(`theme.${mode}.${k}: token desconocido (válidos: ${[...known].join(', ')})`);
    else if (!sandbox.GraphX.safeColor(v)) errors.push(`theme.${mode}.${k}: color no válido «${v}»`);
  }));
}
const heroes = (spec.edges || []).filter(e => e.emphasis === 'hero').length;
if (heroes > 2) warns.push(`${heroes} aristas hero: con más de dos el énfasis deja de señalar nada`);
const anim = (spec.edges || []).filter(e => e.animated).length;
if (anim > Math.max(6, (spec.edges || []).length * .3)) warns.push(`${anim} aristas animadas: si todo se mueve, nada destaca`);

if (spec.initialView && !(spec.flows || []).some(f => 'flow:' + f.id === spec.initialView)) errors.push(`initialView: flujo desconocido ${spec.initialView}`);
if (spec.graphTab === false && !(spec.flows || []).length) errors.push('graphTab: false exige al menos un flujo');
const flowIds = new Set();
for (const f of spec.flows || []) {
  flowIds.add(f.id);
  const parts = new Set((f.participants || []).map(p => typeof p === 'string' ? p : p.node));
  parts.forEach(p => { if (!ids.has(p)) errors.push(`flujo ${f.id}: participante desconocido ${p}`); });
  const mids = new Set();
  for (const m of f.messages || []) {
    if (m.id && mids.has(m.id)) errors.push(`flujo ${f.id}: mensaje duplicado ${m.id}`); mids.add(m.id);
    if (m.kind === 'phase') { if (!m.label) warns.push(`flujo ${f.id}: fase sin label`); continue; }
    if (!parts.has(m.from) || !parts.has(m.to)) errors.push(`flujo ${f.id}, mensaje ${m.id || m.label}: extremo que no es participante`);
    if ((m.kind === 'self') !== (m.from === m.to)) errors.push(`flujo ${f.id}, mensaje ${m.id}: self exige from === to (y al revés)`);
  }
  f._mids = mids;
}
((spec.tour && spec.tour.steps) || []).forEach((st, i) => {
  const w = `paso ${i + 1}`;
  const fo = st.focus || {};
  (fo.nodes || []).forEach(id => { if (!ids.has(id)) errors.push(`${w}: nodo desconocido ${id}`); });
  (fo.edges || []).forEach(id => { if (!eids.has(id)) errors.push(`${w}: arista desconocida ${id}`); });
  (st.expand || []).concat(st.collapse || []).forEach(id => { if (!ids.has(id)) errors.push(`${w}: expand/collapse desconocido ${id}`); });
  if (st.select && !ids.has(st.select)) errors.push(`${w}: select desconocido ${st.select}`);
  if (st.view && st.view.startsWith('flow:')) {
    const f = (spec.flows || []).find(x => 'flow:' + x.id === st.view);
    if (!f) errors.push(`${w}: flujo desconocido ${st.view}`);
    else (fo.messages || []).forEach(m => { if (!f._mids.has(m)) errors.push(`${w}: el mensaje ${m} no es del flujo ${f.id}`); });
  } else if ((fo.messages || []).length) errors.push(`${w}: messages exige view: "flow:<id>"`);
  if (!st.title) warns.push(`${w}: sin title`);
  const body = String(st.body_html || st.body || '').replace(/<[^>]+>/g, '');
  if (body.length < 80) warns.push(`${w}: explicación de ${body.length} caracteres — di qué pasa, qué viaja y qué lo dispara`);
  if (!(fo.nodes || []).length && !(fo.edges || []).length && !(fo.messages || []).length && st.depth == null) warns.push(`${w}: sin foco — el paso no señala nada en el dibujo`);
});
(spec.flows || []).forEach(f => delete f._mids);

/* --- enriquecimiento con git --- */
const gitDir = opt('--git');
if (gitDir) {
  const base = opt('--base', 'origin/main');
  /* --head fija la revisión: el worktree puede estar en otra rama. Por defecto, links.sha del JSON. */
  const head = opt('--head', (spec.links && spec.links.sha) || 'HEAD');
  let numstat = '';
  try { numstat = execFileSync('git', ['-C', gitDir, 'diff', '--numstat', `${base}...${head}`], { encoding: 'utf8', maxBuffer: 64 << 20 }); }
  catch (e) { warns.push('git diff --numstat falló: ' + e.message.split('\n')[0]); }
  const stat = new Map();
  numstat.split('\n').filter(Boolean).forEach(l => { const [a, d, p] = l.split('\t'); stat.set(p, { additions: +a || 0, deletions: +d || 0 }); });
  const repo = spec.links && spec.links.repo, pr = spec.links && spec.links.pr;
  let filled = 0, missing = [];
  for (const n of spec.nodes || []) for (const f of n.files || []) {
    const st = stat.get(f.path);
    if (st) { if (f.additions == null) f.additions = st.additions; if (f.deletions == null) f.deletions = st.deletions; filled++; }
    else if (f.additions == null && n.delta !== 'unchanged') missing.push(f.path);
    if (!f.diff_url && repo && pr && st) f.diff_url = `https://github.com/${repo}/pull/${pr}/files#diff-${crypto.createHash('sha256').update(f.path).digest('hex')}`;
  }
  if (missing.length) warns.push(`${missing.length} ficheros sin cambios en ${base}...${head} (¿ruta mal escrita o vecino sin tocar?): ${[...new Set(missing)].slice(0, 4).join(', ')}${missing.length > 4 ? '…' : ''}`);
  console.log(`git: ${filled} ficheros con stats`);
}

warns.forEach(w => console.log('  ⚠ ' + w));
if (opt('--json-out')) { fs.writeFileSync(opt('--json-out'), JSON.stringify(spec, null, 2)); console.log('json enriquecido →', opt('--json-out')); }
errors.forEach(e => console.log('  ✗ ' + e));
if (errors.length || (flag('--strict') && warns.length)) { console.error(`✗ ${errors.length} errores${flag('--strict') ? `, ${warns.length} avisos (--strict)` : ''}`); process.exit(1); }

if (flag('--check')) { console.log(`✓ válido · ${warns.length} avisos`); process.exit(0); }
/* --- emisión --- */
const json = JSON.stringify(spec).replace(/</g, '\\u003c');
const height = opt('--height');
const block = `<div class="gx-host" data-gx${height ? ` data-height="${+height}"` : ''}><script type="application/json" class="gx-spec">${json}</script></div>`;
const escHtml = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
let out;
if (flag('--fragment')) out = block;
else {
  /* --mode full (defecto): bundle minificado con ELK dentro, funciona sin red.
     --mode lite: sin ELK, se carga de jsDelivr al abrir (≈110 KB + datos).
     --mode dev:  fuentes sin minificar, para depurar. */
  const mode = opt('--mode', 'full');
  const D = f => path.join(HERE, 'dist', f);
  /* dist/ vale si su huella coincide con la de las fuentes (tools/build-dist.mjs la escribe) */
  const srcHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'graphx.js'))).update(fs.readFileSync(path.join(HERE, 'graphx.css'))).update(fs.readFileSync(path.join(HERE, 'graphx-mermaid.js'))).digest('hex');
  const distOK = fs.existsSync(D('SOURCE_HASH')) && fs.readFileSync(D('SOURCE_HASH'), 'utf8').trim() === srcHash;
  const fresh = f => distOK && fs.existsSync(D(f));
  let engine;
  if (mode !== 'dev' && !fresh(mode === 'lite' ? 'graphx.lite.min.js' : 'graphx.bundle.min.js')) {
    console.log(`  ⚠ dist/ no existe o no corresponde a las fuentes actuales: ejecuta \`node tools/build-dist.mjs\`. Uso las fuentes (modo dev).`);
  }
  if (mode === 'lite' && fresh('graphx.lite.min.js')) engine = `<script>${fs.readFileSync(D('graphx.lite.min.js'), 'utf8')}</script>`;
  else if (mode !== 'dev' && mode !== 'lite' && fresh('graphx.bundle.min.js')) engine = `<script>${fs.readFileSync(D('graphx.bundle.min.js'), 'utf8')}</script>`;
  else engine = `<style>${fs.readFileSync(path.join(HERE, 'graphx.css'), 'utf8')}</style>\n<script>${fs.readFileSync(path.join(HERE, 'vendor', 'elk.bundled.js'), 'utf8')}</script>\n<script>${fs.readFileSync(path.join(HERE, 'graphx.js'), 'utf8')}</script>\n<script>${fs.readFileSync(path.join(HERE, 'graphx-mermaid.js'), 'utf8')}</script>\n<script>GraphX.mountAll(document);</script>`;
  out = `<!doctype html>
<html lang="${spec.lang || 'es'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escHtml(opt('--title', spec.title || 'Diagrama'))}</title>
<style>
:root { --bg: #fbfbfc; --ink: #1f2328; --muted: #59636e; --hairline: #d8dee4; --surface-2: #f3f5f8; --accent-ink: #0969da; color-scheme: light dark; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #0d1117; --ink: #e6edf3; --muted: #9198a1; --hairline: #30363d; --surface-2: #161b22; --accent-ink: #4493f8; } }
:root[data-theme="dark"] { --bg: #0d1117; --ink: #e6edf3; --muted: #9198a1; --hairline: #30363d; --surface-2: #161b22; --accent-ink: #4493f8; }
html, body { margin: 0; background: var(--bg); color: var(--ink); }
body { font: 15px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 1320px; margin: 0 auto; padding: 28px 16px 48px; display: flex; flex-direction: column; gap: 18px; }
header h1 { margin: 0; font-size: 24px; line-height: 1.25; letter-spacing: -.01em; text-wrap: balance; }
header p { margin: 8px 0 0; color: var(--muted); max-width: 75ch; }
.gx-host { --gx-h: min(72vh, 760px); }
footer { color: var(--muted); font-size: 12.5px; }
</style>
</head>
<body>
<main>
<header><h1>${escHtml(spec.title || '')}</h1>${spec.summary ? `<p>${escHtml(spec.summary)}</p>` : ''}</header>
${block}
<footer>GraphX · ${(spec.nodes || []).length} piezas · ${(spec.edges || []).length} conexiones · ${(spec.flows || []).length} flujos · ${((spec.tour && spec.tour.steps) || []).length} pasos</footer>
</main>
${engine}
</body>
</html>`;
}
const dest = opt('--out', src.replace(SRC_RE, flag('--fragment') ? '.fragment.html' : '.html'));
fs.writeFileSync(dest, out);
console.log(`✓ ${dest} (${Math.round(out.length / 1024)} KB) · ${(spec.nodes || []).length} nodos · ${(spec.edges || []).length} aristas · profundidad ${G.maxDepth + 1} · ${warns.length} avisos`);
