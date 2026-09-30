/* Verificación del conversor de Mermaid (graphx-mermaid.js), sin navegador.
 *   node tools/verify-mermaid.mjs            convierte, valida y comprueba cada examples/mermaid/*.mmd
 *   node tools/verify-mermaid.mjs --mount    además monta cada diagrama en jsdom con ELK (más lento)
 * Cada ejemplo pasa por el mismo validador que el ensamblador (graphx-build.mjs --check --strict) y
 * por unas comprobaciones de lo que tiene que haber salido: formas, anidamiento, aristas, flujos.     */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const EX = path.join(ROOT, 'examples', 'mermaid');
const sb = { console: { warn() {}, error() {}, log() {} } }; sb.globalThis = sb; vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'graphx.js'), 'utf8'), sb);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'graphx-mermaid.js'), 'utf8'), sb);
const conv = (text, o) => { const r = sb.GraphX.fromMermaid(text, o); return Object.assign(r, { spec: JSON.parse(JSON.stringify(r.spec)) }); };

const fail = [];
const ok = (c, m) => { if (!c) fail.push(m); console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const node = (s, id) => s.nodes.find(n => n.id === id) || {};
const edge = (s, a, b) => s.edges.find(e => e.from === a && e.to === b);

/* lo que tiene que salir de cada ejemplo */
const CHECKS = {
  flowchart: s => {
    ok(s.direction === 'right', 'LR → direction right');
    ok(node(s, 'valida').shape === 'decision' && node(s, 'db').shape === 'datastore' && node(s, 'reserva').shape === 'subroutine' && node(s, 'web').shape === 'rect', 'formas: rombo, cilindro, subrutina, rectángulo');
    ok(node(s, 'fin').shape === 'dcircle' && node(s, 'cache').shape === 'circle' && node(s, 'aviso').shape === 'flag' && node(s, 'pago').shape === 'io', 'formas: doble círculo, círculo, bandera, entrada/salida');
    ok((edge(s, 'aviso', 'cliente') || {}).head === 'cross', '--x → punta en aspa');
    ok(node(s, 'correo').shape === 'document' && node(s, 'correo').label === 'Correo de confirmación', 'sintaxis nueva @{ shape, label }');
    ok(node(s, 'db').parent === 'datos' && node(s, 'datos').parent === 'backend', 'subgrafos anidados → niveles');
    ok((edge(s, 'valida', 'reserva') || {}).label === 'Sí' && (edge(s, 'cliente', 'web') || {}).label === 'hace un pedido', 'texto de enlace (-- x --> y |x|)');
    ok((edge(s, 'api', 'cache') || {}).kind === 'async' && (edge(s, 'reserva', 'pago') || {}).emphasis === 'hero', 'punteado → discontinua, grueso → hero');
    ok((edge(s, 'web', 'analitica') || {}).animated === true, 'e9@{ animate: true } anima la arista');
    ok(!!node(s, 'valida').color && !!node(s, 'db').color && (edge(s, 'cliente', 'web') || {}).color === '#0a0', 'classDef, style y linkStyle dan color');
    ok((node(s, 'web').links || [])[0].url === 'https://example.com/tienda', 'click con URL → enlace');
    ok(s.nodes.every(n => n.summary), 'todas las piezas tienen summary');
  },
  sequence: s => {
    const f = s.flows[0];
    ok(s.graphTab === false && f.participants.length === 5, 'solo secuencia, 5 participantes');
    ok(node(s, 'U').kind === 'actor' && node(s, 'DB').kind === 'datastore', 'actor y participante de tipo database');
    ok(s.lanes.length === 2 && node(s, 'A').lane === s.lanes[1].id, 'box → carril');
    ok(f.messages.filter(m => m.kind === 'block').length === 2 && f.messages.filter(m => m.kind === 'else').length === 1 && f.messages.filter(m => m.kind === 'end').length === 2, 'alt/else/loop → marcos con separador');
    ok(node(s, 'U').shape === 'actor' && node(s, 'DB').shape === 'datastore', 'cabeceras con forma: actor y base de datos');
    ok(f.messages.some(m => m.activate === 'A') && f.messages.some(m => m.deactivate === 'A'), '+/- → barras de activación');
    ok(f.messages.some(m => m.head === 'cross') && f.messages.some(m => m.head === 'open'), 'puntas de mensaje: aspa y abierta');
    ok(f.messages.filter(m => m.from).map(m => m.id).join() === Array.from({ length: 13 }, (_, i) => 'm' + (i + 1)).join(), 'los mensajes se numeran m1…m13 aunque haya marcos y notas entre ellos');
    ok(f.messages.some(m => m.kind === 'self') && f.messages.some(m => m.kind === 'return') && f.messages.some(m => m.kind === 'async'), 'self, return (-->>) y async (-))');
    ok(f.messages.some(m => m.kind === 'note' && m.side === 'right' && /redirección/.test(m.label)), 'Note → caja de nota a su lado');
    ok((node(s, 'A').links || []).length === 1, 'link A: … @ url');
  },
  class: s => {
    ok(node(s, 'Perro').parent === 'Dominio', 'namespace → contenedor');
    ok(edge(s, 'Perro', 'Animal') && edge(s, 'Perro', 'Nadador').kind === 'async', 'herencia hacia el padre; realización discontinua');
    ok(/Perro se compone de Collar/.test((edge(s, 'Collar', 'Perro') || {}).summary || ''), 'composición: el todo es el extremo con marca');
    ok(node(s, 'Collar').label === 'Collar<T>' && node(s, 'Veterinario').label === 'Clínica veterinaria', 'genéricos ~T~ y etiqueta ["…"]');
    ok(/hacerRuido/.test(node(s, 'Animal').details_html) && node(s, 'Animal').subtitle === '«abstract»', 'miembros en el panel y anotación');
    ok(node(s, 'Nadador').subtitle === '«interface»', '<<interface>> suelto');
    ok(s.nodes.some(n => n.shape === 'note' && n.label === 'El mejor amigo') && s.edges.some(e => e.to === 'Perro' && e.head === 'none'), 'note for → nota unida a su clase');
    ok(node(s, 'Animal').shape === 'class' && node(s, 'Animal').rows.some(r => r.section === 'method' && r.name === 'hacerRuido()' && r.type === 'void' && r.abstract), 'caja UML: filas con sección, tipo y abstracto');
    ok(edge(s, 'Perro', 'Animal').head === 'triangle' && edge(s, 'Collar', 'Perro').head === 'diamond' && edge(s, 'Animal', 'Veterinario').head === 'odiamond', 'puntas UML: triángulo, rombo lleno y hueco');
    ok(edge(s, 'Collar', 'Perro').headLabel === '1' && edge(s, 'Collar', 'Perro').tailLabel === '0..1', 'cardinalidades en los extremos');
  },
  state: s => {
    ok(node(s, 'start').kind === 'start' && node(s, 'end').kind === 'end', '[*] → inicio y fin');
    ok(node(s, 'Programado').parent === 'Aprobado' && s.nodes.some(n => n.kind === 'start' && n.parent === 'Aprobado'), 'estado compuesto con su propio [*]');
    ok(node(s, 'EnRevision').label === 'En revisión' && node(s, 'decide').kind === 'choice', 'state "…" as X y <<choice>>');
    ok(s.nodes.some(n => n.shape === 'note' && /otra persona/.test(n.label)) && !!node(s, 'Aprobado').color, 'note right of → nota; classDef');
    ok(node(s, 'Borrador').shape === 'rounded' && node(s, 'start').shape === 'start' && node(s, 'decide').shape === 'choice', 'formas de estado: redondeado, inicio, elección');
    ok(s.layout.cycles === 'dfs', 'ciclos rotos en profundidad, como dagre');
  },
  er: s => {
    ok(s.nodes.every(n => n.kind === 'table'), 'entidades');
    ok(/cero o más ORDER/.test(edge(s, 'CUSTOMER', 'ORDER').summary), 'cardinalidad ||--o{ en palabras');
    ok(edge(s, 'CUSTOMER', 'DELIVERY-ADDRESS').kind === 'async', 'relación no identificativa discontinua');
    ok(/email/.test(node(s, 'CUSTOMER').details_html) && node(s, 'CUSTOMER').tags.includes('email'), 'atributos en el panel y en la búsqueda');
    ok(node(s, 'CUSTOMER').shape === 'table' && node(s, 'CUSTOMER').rows.some(r => r.name === 'id' && r.keys === 'PK'), 'entidad como tabla con claves');
    ok(edge(s, 'CUSTOMER', 'ORDER').tail === 'one' && edge(s, 'CUSTOMER', 'ORDER').head === 'zero-many', 'patas de gallo ||--o{');
  },
  mindmap: s => {
    ok(s.nodes.length === 13 && s.edges.length === 12, 'árbol: 13 ideas, 12 ramas');
    ok(node(s, 'root').kind === 'circle' && node(s, 'Salidas').kind === 'cloud', 'formas ((…)) y )…(');
    const n2 = conv(fs.readFileSync(path.join(EX, 'mindmap.mmd'), 'utf8'), { nest: true }).spec;
    ok(n2.edges.length === 0 && n2.nodes.filter(n => n.parent === 'root').length === 3, 'con nest: ramas como contenedores');
  },
  gantt: s => {
    const b = s.nodes.find(n => n.label === 'Backend'), i = s.nodes.find(n => n.label === 'Integración');
    ok(b.status === 'crit' && s.statuses.done && s.statuses.active, 'done/active/crit → estados');
    ok((b.metrics || []).some(m => m.value === '2026-09-13'), 'fechas calculadas (after + duración)');
    ok(s.edges.filter(e => e.to === i.id).length === 2, 'after dev1 dev2 → dos dependencias');
    ok(s.nodes.some(n => n.kind === 'milestone' && n.span && n.span.milestone), 'hito');
    ok(b.shape === 'bar' && b.span.start === '2026-09-13' && s.nodes.some(n => n.span && n.span.live), 'barras con su intervalo; la activa, en movimiento');
  },
  journey: s => {
    ok(s.nodes.filter(n => n.kind === 'job').every(n => n.status && n.metrics[0].label), 'puntuación → estado y métrica con nombre');
    ok(s.edges.length === 3, 'tareas encadenadas');
  },
  timeline: s => {
    ok(s.nodes.filter(n => n.kind === 'event').length === 6, '6 eventos');
    ok(s.nodes.some(n => n.label === '2006' && n.kind === 'group'), 'periodo con eventos → grupo (incluidas las líneas «: evento»)');
  },
  git: s => {
    ok(s.lanes.map(l => l.label).join() === 'main,develop,feature/login', 'una rama por carril');
    ok(s.edges.some(e => e.label === 'merge') && s.edges.some(e => e.label === 'cherry-pick'), 'merge y cherry-pick');
    ok(node(s, 'feat-a').badge === 'v0.1', 'tag como etiqueta del commit');
    ok(s.nodes.some(n => n.shape === 'commit-merge') && s.nodes.some(n => n.shape === 'commit-highlight') && s.nodes.filter(n => n.head).length === 3, 'commits: fusión, destacado y un HEAD por rama');
  },
  c4: s => {
    ok(node(s, 'cliente').kind === 'actor' && node(s, 'mainframe').kind === 'datastore' && node(s, 'correo').kind === 'external', 'Person, SystemDb, System_Ext');
    ok(node(s, 'mainframe').parent === 'b1' && node(s, 'b1').parent === 'b0', 'boundaries anidados');
    ok(!!edge(s, 'correo', 'cliente'), 'Rel_Back invierte el sentido');
    ok(!!node(s, 'cliente').color, 'UpdateElementStyle');
    ok(node(s, 'cliente').shape === 'person' && node(s, 'mainframe').shape === 'c4-db' && node(s, 'b0').frame === 'dashed', 'C4: persona, base de datos y frontera discontinua');
    ok(node(s, 'banca').subtitle === '[Sistema]' && node(s, 'correo').subtitle === '[Sistema, externo]', 'C4: tipo traducido');
  },
  architecture: s => {
    ok(node(s, 'db').parent === 'api' && node(s, 'db').kind === 'datastore', 'service … in grupo');
    ok(node(s, 'j1').kind === 'junction' && !!edge(s, 'j1', 'server'), 'junction y arista con lados');
    ok(node(s, 'db').shape === 'tile' && node(s, 'disk1').kind === 'disk' && node(s, 'api').frame === 'dashed', 'baldosas con icono y grupo discontinuo');
  },
  block: s => {
    ok(!s.nodes.some(n => n.label === 'space'), 'space no es una pieza');
    ok(node(s, 'd').parent === 'grupo' && node(s, 'e').kind === 'circle', 'block:… end y formas');
    ok((edge(s, 'd', 'f') || {}).label === 'resultado', 'enlace con texto');
  },
  requirement: s => {
    ok(node(s, 'test_req').status === 'risk-high' && node(s, 'test_entity').kind === 'element', 'riesgo → estado; element');
    ok(!!edge(s, 'test_entity', 'test_req') && !!edge(s, 'test_req', 'login_req') === false, 'relaciones en su sentido');
  },
  sankey: s => {
    ok(s.edges.length === 5 && s.edges.filter(e => e.emphasis === 'hero').length === 2, 'flujos, los dos mayores con énfasis');
    ok(s.edges.every(e => typeof e.weight === 'number') && s.nodes.every(n => n.shape === 'flowbar' && typeof n.value === 'number'), 'grosor por valor y barra de nivel');
    ok(s.nodes.some(n => n.label === 'Mermas, transporte'), 'CSV con comillas');
  },
  kanban: s => {
    ok(s.lanes.length === 3 && node(s, 't3').lane === 'doing', 'columnas → carriles');
    ok((node(s, 't1').links || [])[0].url === 'https://example.atlassian.net/browse/PRJ-1', 'ticketBaseUrl del frontmatter');
    ok(node(s, 't1').shape === 'ticket' && node(s, 't1').badge === 'PRJ-1' && node(s, 't4').avatar === 'lu', 'ticket con número y avatar');
  },
  treemap: s => {
    ok(s.nodes.find(n => n.label === 'Presupuesto').subtitle === '1450', 'totales sumados hacia arriba');
    ok(s.nodes.filter(n => n.shape === 'block').every(n => typeof n.value === 'number'), 'hojas con área según su valor');
  }
};

for (const f of fs.readdirSync(EX).filter(f => f.endsWith('.mmd')).sort()) {
  const name = f.replace(/\.mmd$/, '');
  const text = fs.readFileSync(path.join(EX, f), 'utf8');
  console.log(`— ${name} —`);
  if (name === 'pie') {
    let msg = ''; try { conv(text); } catch (e) { msg = e.message; }
    ok(/gráfico de datos/.test(msg), 'pie se rechaza con un motivo');
    continue;
  }
  let r;
  try { r = conv(text); } catch (e) { ok(false, `convierte (${e.message})`); continue; }
  ok(r.warnings.length === 0, `sin avisos del conversor${r.warnings.length ? ': ' + r.warnings.join(' | ') : ''}`);
  let check = '';
  try { check = execFileSync('node', [path.join(ROOT, 'graphx-build.mjs'), path.join(EX, f), '--check', '--strict'], { encoding: 'utf8' }); }
  catch (e) { check = String(e.stdout || '') + String(e.stderr || ''); }
  ok(/✓ válido/.test(check), 'pasa el validador del ensamblador (--strict)' + (/✓ válido/.test(check) ? '' : '\n' + check));
  if (CHECKS[name]) { try { CHECKS[name](r.spec); } catch (e) { ok(false, 'comprobaciones: ' + e.message); } }
}

/* casos sueltos: sintaxis que ha dado problemas */
console.log('— sintaxis suelta —');
const one = t => conv(t).spec;
let s = one('graph TD\nA-->B;B-->C\nA -- "con -- guiones" --> D\nA <--> E\nA ~~~ F\nnode-1 --> node-2\ncafé --> niño');
ok(s.edges.length === 6 && (edge(s, 'A', 'D') || {}).label === 'con -- guiones', '`;`, texto con guiones, ~~~ invisible, ids con guion y tildes');
s = one('flowchart LR\nA-->B & C\nB & C --> D');
ok(s.edges.length === 4, 'A --> B & C');
let r = conv('flowchart LR\nA --> B\n??? nada\nC -->');
ok(r.spec.nodes.length === 2 && r.warnings.length === 2, 'una línea que no se entiende no deja piezas a medias y avisa');
r = conv('flowchart TB\nsubgraph g\n a\nend\na --> g');
ok(r.warnings.some(w => /propio contenedor/.test(w)), 'arista pieza → su contenedor: aviso');
s = one('flowchart LR\nroot --> x');
ok(s.nodes.some(n => n.id === 'root'), 'una pieza puede llamarse «root»');
s = one('sequenceDiagram\nAlice Smith->>Bob: hola\nBob->>Bob: piensa');
ok(s.flows[0].messages[1].kind === 'self' && s.nodes[0].label === 'Alice Smith', 'participantes con espacios y automensaje');
s = one('classDiagram\nclassC --* classD\nclassI -- classJ');
ok(/classD se compone de classC/.test(s.edges[0].summary), 'C --* D: D es el todo');
s = one('erDiagram\nCAR one or more to zero or more PERSON : drives');
ok(/cada PERSON, con uno o más CAR/.test(s.edges[0].summary), 'cardinalidad escrita en palabras');
s = conv('flowchart LR\nA-->B', { lang: 'en' }).spec;
ok(s.lang === 'en' && /Comes from/.test(s.nodes[1].summary), 'textos generados en inglés');
for (const [t, re] of [['xychart-beta\n x-axis [a]', /gráfico de datos/], ['zenuml\n A.b()', /ZenUML/], ['nada que ver', /no reconocido/], ['', /vacío/]]) {
  let m = ''; try { conv(t); } catch (e) { m = e.message; } ok(re.test(m), `rechazo con motivo: ${JSON.stringify(t.split('\n')[0]) || '(vacío)'}`);
}

/* montaje real (ELK en jsdom) */
if (process.argv.includes('--mount')) {
  console.log('— montaje en jsdom —');
  const { JSDOM } = await import('jsdom');
  const R = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
  const blocks = fs.readdirSync(EX).filter(f => f.endsWith('.mmd') && f !== 'pie.mmd').sort()
    .map(f => `<div data-gx data-name="${f}"><script type="text/plain" class="gx-mermaid">${R('examples/mermaid/' + f).replace(/<\/script/gi, '<\\/script')}</script></div>`).join('\n');
  const html = `<!doctype html><html><head><style>${R('graphx.css')}</style></head><body>${blocks}
<script>${R('vendor/elk.bundled.js')}</script><script>${R('graphx.js')}</script><script>${R('graphx-mermaid.js')}</script><script>GraphX.mountAll(document)</script></body></html>`;
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, beforeParse(w) { w.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }); w.HTMLCanvasElement.prototype.getContext = () => null; } });
  const w = dom.window; await new Promise(res => w.addEventListener('load', res));
  for (const el of w.document.querySelectorAll('[data-gx]')) {
    if (!el._gx) { ok(false, `${el.dataset.name}: no se montó (${el.textContent.slice(0, 80)})`); continue; }
    await el._gx.ready;
    const seq = el._gx.state.view !== 'graph';
    ok(seq ? el.querySelectorAll('.gx-seq-msg').length > 0 : el.querySelectorAll('.gx-node').length > 0, `${el.dataset.name}: montado (${seq ? 'secuencia' : el.querySelectorAll('.gx-node').length + ' piezas'})`);
  }
}

console.log(fail.length ? `\n❌ ${fail.length} fallos` : '\n✅ Sin fallos');
process.exit(fail.length ? 1 : 0);
