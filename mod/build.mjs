#!/usr/bin/env node
/* Prepara el mod `graphx` para cargarlo en Claude Code.
 *
 *   node mod/build.mjs [--to <carpeta>] [--watch]
 *
 * Copia dist/graphx.bundle.min.js (motor + ELK + formas + layouts + árbol + Mermaid + efectos) al visor
 * del mod, en mod/graphx/viewer/vendor/, que git ignora: el bundle se genera con
 * `node tools/build-dist.mjs`. Empaqueta jsdom (del node_modules del repo: `npm install`) en
 * server/vendor/jsdom.cjs, con el que el servidor monta GraphX sin navegador para el terminal, el
 * escritorio y las capturas.
 *
 * Con --to copia además el mod entero a esa carpeta (la de mods de una sesión de Claude Code, que se
 * recarga en caliente, o la que se pase a `claude --plugin-dir`), sin los tipos que el motor escribe en
 * .claude-plugin/types. --watch repite la copia cada vez que cambia un fichero del mod. */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const MOD = path.join(HERE, 'graphx');
const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const to = opt('--to') ? path.resolve(opt('--to').replace(/^~(?=\/|$)/, process.env.HOME)) : null;

const bundle = path.join(ROOT, 'dist', 'graphx.bundle.min.js');
if (!fs.existsSync(bundle)) { console.error('✗ falta dist/graphx.bundle.min.js: ejecuta `node tools/build-dist.mjs`'); process.exit(1); }
const hashFile = path.join(ROOT, 'dist', 'SOURCE_HASH');
const hash = fs.existsSync(hashFile) ? fs.readFileSync(hashFile, 'utf8').trim() : 'sin-hash';

const SKIP = new Set(['node_modules', '.DS_Store']);
const skip = rel => rel.split(path.sep).some(p => SKIP.has(p)) || rel.startsWith(path.join('.claude-plugin', 'types'));
function copyTree(src, dst, rel = '') {
  let n = 0;
  for (const d of fs.readdirSync(path.join(src, rel), { withFileTypes: true })) {
    const r = path.join(rel, d.name);
    if (skip(r)) continue;
    if (d.isDirectory()) { fs.mkdirSync(path.join(dst, r), { recursive: true }); n += copyTree(src, dst, r); }
    else if (d.isFile()) {
      const a = path.join(src, r), b = path.join(dst, r);
      const same = fs.existsSync(b) && fs.statSync(b).size === fs.statSync(a).size && fs.readFileSync(a).equals(fs.readFileSync(b));
      if (!same) { fs.copyFileSync(a, b); n++; }
    }
  }
  return n;
}
/* lo que ya no está en el mod tampoco debe quedarse en la copia */
function prune(src, dst, rel = '') {
  let n = 0;
  if (!fs.existsSync(path.join(dst, rel))) return 0;
  for (const d of fs.readdirSync(path.join(dst, rel), { withFileTypes: true })) {
    const r = path.join(rel, d.name);
    if (skip(r)) continue;
    if (!fs.existsSync(path.join(src, r))) { fs.rmSync(path.join(dst, r), { recursive: true, force: true }); n++; }
    else if (d.isDirectory()) n += prune(src, dst, r);
  }
  return n;
}

/* jsdom en un solo fichero: el servidor lo necesita y el mod no tiene node_modules */
function bundleJsdom() {
  const out = path.join(MOD, 'server', 'vendor');
  const file = path.join(out, 'jsdom.cjs');
  const pkg = path.join(ROOT, 'node_modules', 'jsdom', 'package.json');
  if (!fs.existsSync(pkg)) { console.warn('⚠ sin node_modules/jsdom (npm install): el terminal y el escritorio no podrán dibujar'); return; }
  const version = JSON.parse(fs.readFileSync(pkg, 'utf8')).version;
  const stamp = path.join(out, 'JSDOM_VERSION');
  if (fs.existsSync(file) && fs.existsSync(stamp) && fs.readFileSync(stamp, 'utf8').trim() === version) return;
  fs.mkdirSync(out, { recursive: true });
  const live = path.join(ROOT, '..', '..', 'mod', 'graphx-live', 'server', 'vendor', 'jsdom.cjs');
  const liveStamp = path.join(path.dirname(live), 'JSDOM_VERSION');
  if (fs.existsSync(live) && fs.existsSync(liveStamp) && fs.readFileSync(liveStamp, 'utf8').trim() === version) fs.copyFileSync(live, file);
  else execFileSync('npx', ['--yes', 'esbuild@0.24.0', '--bundle', '--platform=node', '--format=cjs', '--external:canvas', '--minify', '--legal-comments=none', '--log-level=error', '--sourcefile=jsdom-entry.cjs', `--outfile=${file}`],
    { cwd: ROOT, input: "module.exports = require('jsdom');", stdio: ['pipe', 'inherit', 'inherit'] });
  /* jsdom busca este fichero con require.resolve aunque nunca haga XHR síncrono */
  fs.writeFileSync(path.join(out, 'xhr-sync-worker.js'), '/* graphx no usa XHR síncrono */\n');
  fs.writeFileSync(stamp, version + '\n');
  console.log(`✓ jsdom ${version} empaquetado en ${path.relative(ROOT, file)} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
}

function build() {
  bundleJsdom();
  const vendor = path.join(MOD, 'viewer', 'vendor');
  fs.mkdirSync(vendor, { recursive: true });
  const dst = path.join(vendor, 'graphx.bundle.min.js');
  if (!fs.existsSync(dst) || !fs.readFileSync(dst).equals(fs.readFileSync(bundle))) fs.copyFileSync(bundle, dst);
  fs.writeFileSync(path.join(vendor, 'SOURCE_HASH'), hash + '\n');
  if (!to) { console.log(`✓ ${path.relative(ROOT, dst)} (${(fs.statSync(dst).size / 1024).toFixed(0)} KB)`); return; }
  fs.mkdirSync(to, { recursive: true });
  const n = copyTree(MOD, to), gone = prune(MOD, to);
  console.log(`✓ mod copiado a ${to} (${n} fichero${n === 1 ? '' : 's'} nuevo${n === 1 ? '' : 's'} o cambiado${n === 1 ? '' : 's'}${gone ? `, ${gone} retirado${gone === 1 ? '' : 's'}` : ''})`);
}
build();
if (args.includes('--watch')) {
  let t = 0;
  fs.watch(MOD, { recursive: true }, (_, f) => { if (f && skip(f)) return; clearTimeout(t); t = setTimeout(build, 200); });
  console.log('… vigilando mod/graphx');
}
