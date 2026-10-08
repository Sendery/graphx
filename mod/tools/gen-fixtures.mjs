#!/usr/bin/env node
/* Escenas de verdad para las pruebas del mod (tests/fixtures.ts): las saca el motor sin navegador, como en una sesión.
 *   node mod/tools/gen-fixtures.mjs */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..');
const MOD = path.join(HERE, '..', 'graphx');
const { createEngine } = await import(pathToFileURL(path.join(MOD, 'server', 'engine.mjs')).href);
const eng = createEngine(MOD);
const R = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const board = source => ({ source, patches: [], signs: [{ id: 's1', at: 'pagos', text: 'Sin reintentos', tone: 'warn' }], banner: null, guide: { steps: [{ title: 'Entra el pedido', body: 'El cliente compra.', nodes: ['checkout'] }, { title: 'Se cobra', body: 'Pagos cobra el pedido.', nodes: ['pagos'] }], at: -1, seq: 0 }, view: { seq: 0 } });
const out = {};
const take = async (name, source, ui = {}) => {
  const r = await eng.render(board(source), 1, Object.assign({ open: new Set(), close: new Set() }, ui));
  out[name] = r.scene;
  console.log(name, r.scene.kind, JSON.stringify(r.scene).length);
};
await take('graph', { kind: 'spec', spec: JSON.parse(R('examples/fx/software.json')) });
await take('seq', { kind: 'mermaid', text: R('examples/mermaid/sequence.mmd') });
await take('gantt', { kind: 'mermaid', text: R('examples/mermaid/gantt.mmd') });
await take('tree', { kind: 'paths', entries: ['src/app.ts', { path: 'src/ui/Boton.tsx', additions: 12, deletions: 3, status: 'M' }, 'src/ui/Menu.tsx', 'README.md', { path: 'docs/guia.md', status: 'A', additions: 40 }] });
const detail = eng.detail('gateway');
const file = path.join(MOD, 'tests', 'fixtures.ts');
fs.writeFileSync(file, `/* Escenas del motor de verdad (node mod/tools/gen-fixtures.mjs): lo que el servidor le da al lienzo. */\nimport type { Detail, Scene } from '../types'\n\nexport const SCENES: Record<'graph' | 'seq' | 'gantt' | 'tree', Scene> = ${JSON.stringify(out)} as unknown as Record<'graph' | 'seq' | 'gantt' | 'tree', Scene>\nexport const DETAIL: Detail = ${JSON.stringify(detail)} as unknown as Detail\n`);
console.log('→', path.relative(ROOT, file), (fs.statSync(file).size / 1024).toFixed(0), 'KB');
process.exit(0);
