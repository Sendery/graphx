#!/usr/bin/env node
/* Lleva una tabla (TSV o CSV, formato ancho o largo) a la línea de tiempo de un diagrama.
 *   node tools/timeline.mjs <spec.json> <datos.tsv|.csv> [--events eventos.tsv] [--out salida.json]
 *                           [--label "…"] [--step 900] [--window 12] [--start end|start]
 * Formato ancho: una columna de tiempo y una por serie, `<id>.<campo>` (heat, rate, value, progress, change,
 * spark, weight, alert). Formato largo: columnas time · id · field · value, una fila por dato (lo que devuelve
 * una consulta). Los eventos, en otra tabla con columnas time · label · tone · nodes (ids separados por comas).
 * Avisa de las columnas o los ids que no son ninguna pieza ni arista del diagrama. Sin --out, escribe encima. */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const VALUED = new Set(['--events', '--out', '--label', '--step', '--window', '--start']);
const [specPath, dataPath] = args.filter((a, i) => !a.startsWith('--') && !VALUED.has(args[i - 1]));
if (!specPath || !dataPath) { console.error('uso: node tools/timeline.mjs <spec.json> <datos.tsv|.csv> [--events eventos.tsv] [--out salida.json]'); process.exit(2); }
const box = { console }; box.globalThis = box; vm.createContext(box);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'graphx-fx.js'), 'utf8'), box);
const { parseTable } = box.GraphX.fx;

const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const text = fs.readFileSync(dataPath, 'utf8').trim() + '\n';
const tab = parseTable(text);
if (tab.rows.length < 2) { console.error(`✗ ${dataPath}: hacen falta al menos dos filas de datos`); process.exit(1); }
const ids = new Set([...(spec.nodes || []).map(n => n.id), ...(spec.lanes || []).map(l => l.id), ...(spec.edges || []).map(e => e.id)]);
const lc = tab.columns.map(c => String(c).toLowerCase());
const long = lc.includes('value') && (lc.includes('id') || lc.includes('target'));
const FIELDS = /^(heat|rate|value|progress|change|spark|weight|alert)$/;
const idOf = k => { const d = k.lastIndexOf('.'); return d > 0 && FIELDS.test(k.slice(d + 1)) ? k.slice(0, d) : k; };
let targets;
if (long) { const c = tab.columns[lc.indexOf(lc.includes('id') ? 'id' : 'target')]; targets = [...new Set(tab.rows.map(r => String(r[c])))]; }
else targets = tab.columns.filter((c, i) => i > 0 && !/^(event|evento)$/i.test(c)).map(idOf);
const unknown = [...new Set(targets.filter(id => !ids.has(id)))];
const series = new Set(long ? tab.rows.map(r => `${r[tab.columns[lc.indexOf(lc.includes('id') ? 'id' : 'target')]]}.${r.field || r.metric || ''}`) : tab.columns.slice(1));
console.log(`${path.basename(dataPath)}: ${long ? 'formato largo' : 'formato ancho'} · ${new Set(tab.rows.map(r => String(r[tab.columns[0]]))).size} instantes · ${series.size} series`);
if (unknown.length) console.log(`  ⚠ ${unknown.length} ids no están en el diagrama (se ignorarán): ${unknown.slice(0, 6).join(', ')}`);

const tl = Object.assign({}, spec.timeline || {}, { data: text });
delete tl.rows; delete tl.columns; delete tl.values;
if (opt('--label')) tl.label = opt('--label');
if (opt('--step')) tl.step = +opt('--step');
if (opt('--window')) tl.window = +opt('--window');
if (opt('--start')) tl.start = opt('--start');
const evPath = opt('--events');
if (evPath) {
  const ev = parseTable(fs.readFileSync(evPath, 'utf8'));
  tl.events = ev.rows.map(r => ({ time: String(r.time), label: String(r.label || ''), tone: r.tone || 'info', nodes: String(r.nodes || '').split(/[\s,;]+/).filter(Boolean) }));
  const bad = tl.events.flatMap(e => e.nodes).filter(id => !ids.has(id));
  if (bad.length) console.log(`  ⚠ eventos con piezas que no existen: ${[...new Set(bad)].join(', ')}`);
  console.log(`  ${tl.events.length} eventos`);
}
spec.timeline = tl;
const out = opt('--out', specPath);
fs.writeFileSync(out, JSON.stringify(spec, null, 2) + '\n');
console.log(`✓ ${out}`);
