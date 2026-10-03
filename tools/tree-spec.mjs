#!/usr/bin/env node
/* Árbol de ficheros de un directorio o de un repo, como JSON de GraphX (layout `tree`).
 *
 *   node tools/tree-spec.mjs [dir] [--base <ref>] [--head <ref>] [--out tree.json] [--html tree.html]
 *                                  [--title T] [--lang es|en] [--root nombre] [--no-compact] [--right]
 *                                  [--focus <texto>] [--no-prune] [--tree salida-de-tree.txt]
 *
 * En un repo, el árbol es `git ls-files` (lo que no está en .gitignore); fuera de uno, se recorre el
 * directorio sin node_modules ni .git. Con --base se marcan los ficheros cambiados respecto a esa
 * revisión (`git diff --numstat` y `--name-status`, incluidos los borrados) y el diagrama se abre
 * filtrado a esos cambios. --focus abre el diagrama filtrado por una búsqueda. --tree lee la salida
 * del comando `tree` en vez de un directorio. --html emite también la página con graphx-build.mjs. */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const flag = k => args.includes(k);
const VALUED = new Set(['--base', '--head', '--out', '--html', '--title', '--lang', '--root', '--focus', '--tree']);
const dir = path.resolve(args.find((a, i) => !a.startsWith('--') && !VALUED.has(args[i - 1])) || '.');

const box = { console }; box.globalThis = box; vm.createContext(box);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'graphx-tree.js'), 'utf8'), box);
const TREE = box.GraphX.tree;
const lang = opt('--lang', 'es');
const git = (...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8', maxBuffer: 256 << 20 });

const common = { lang, title: opt('--title'), compact: !flag('--no-compact'), direction: flag('--right') ? 'right' : 'down', prune: flag('--no-prune') ? false : undefined };
let spec;
if (opt('--tree')) {
  spec = TREE.fromTreeText(fs.readFileSync(opt('--tree'), 'utf8'), Object.assign({ root: opt('--root') }, common));
} else {
  let inRepo = false;
  try { inRepo = git('rev-parse', '--is-inside-work-tree').trim() === 'true'; } catch (_) { }
  /* tamaño y líneas de cada fichero de texto (hasta 2 MB; los binarios, solo el tamaño) */
  const statOf = rel => {
    try {
      const st = fs.statSync(path.join(dir, rel)); if (!st.isFile()) return {};
      const out = { size: st.size };
      if (st.size < 2 << 20) { const b = fs.readFileSync(path.join(dir, rel)); if (!b.subarray(0, 8000).includes(0)) out.lines = b.length ? b.toString('utf8').split('\n').length - (b[b.length - 1] === 10 ? 1 : 0) : 0; }
      return out;
    } catch (_) { return {}; }
  };
  const rootName = opt('--root', path.basename(dir));
  if (inRepo) {
    const files = git('ls-files', '-z').split('\0').filter(Boolean);
    const base = opt('--base'), head = opt('--head');
    const range = base ? (head ? [`${base}...${head}`] : [base]) : null;
    const numstat = range ? git('diff', '--numstat', '-M', ...range) : '';
    const nameStatus = range ? git('diff', '--name-status', '-M', ...range) : '';
    spec = TREE.fromGit({ files, numstat, nameStatus, extra: files.map(f => Object.assign({ path: f }, statOf(f))) },
      Object.assign({ root: rootName, focus: base ? 'changes' : null, summary: base ? `${base}${head ? '…' + head : ''}` : undefined }, common));
    if (base) console.error(`git: ${numstat.split('\n').filter(Boolean).length} ficheros cambiados respecto a ${base}`);
  } else {
    const out = [];
    const walk = rel => fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).forEach(d => {
      if (d.name === 'node_modules' || d.name === '.git' || d.name === '.DS_Store') return;
      const r = rel ? rel + '/' + d.name : d.name;
      if (d.isDirectory()) walk(r); else if (d.isFile()) out.push(Object.assign({ path: r }, statOf(r)));
    });
    walk('');
    spec = TREE.fromPaths(out, Object.assign({ root: rootName, focus: null }, common));
  }
}
if (opt('--focus')) spec.focus = { query: opt('--focus'), label: '“' + opt('--focus') + '”', key: 'search' };
const json = JSON.stringify(spec, null, 1);
const outFile = opt('--out', opt('--html') ? opt('--html').replace(/\.html?$/i, '') + '.json' : null);
if (outFile) { fs.writeFileSync(outFile, json); console.log(`✓ ${outFile} · ${spec.nodes.length} piezas`); }
else if (!opt('--html')) process.stdout.write(json + '\n');
if (opt('--html')) execFileSync(process.execPath, [path.join(ROOT, 'graphx-build.mjs'), outFile, '--out', opt('--html')], { stdio: 'inherit' });
