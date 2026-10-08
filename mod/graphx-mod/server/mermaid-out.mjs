/* Mermaid de ida y vuelta.
 *
 *   annotations(text)      lo que un Mermaid lleva de GraphX: las claves ricas de `id@{ … }` (las que Mermaid no
 *                          conoce: heat, spark, owner, rate…) y los comentarios `%% @gx [id] {json}`, por pieza,
 *                          arista y raíz. Es lo que el conversor recoge y Mermaid ignora.
 *   toMermaid(spec, opts)  un JSON de GraphX expresado como Mermaid válido que el conversor vuelve a leer igual:
 *                          un `flowchart` (subgraph por carril y por contenedor, la forma con `@{ shape }`, el
 *                          trazo de cada arista) o un `sequenceDiagram` (un flujo), con los datos de GraphX en
 *                          `@{ … }` (los escalares) y en `%% @gx` (lo que es JSON: bloques, métricas, enlaces, la
 *                          raíz con fx, equipos, línea de tiempo, estados y recorrido).
 *   overlay(text, extra)   un Mermaid de partida con datos añadidos después (parches, datos en vivo) como `%% @gx`. */

const MERMAID_SHAPE = {
  rect: 'rect', rounded: 'rounded', terminal: 'stadium', subroutine: 'subproc', datastore: 'cyl', 'cylinder-h': 'h-cyl',
  circle: 'circle', dcircle: 'dbl-circ', hexagon: 'hex', decision: 'diam', io: 'lean-r', 'io-l': 'lean-l', trapezoid: 'trap-b',
  'trapezoid-t': 'trap-t', flag: 'flag', document: 'doc', cloud: 'cloud', bang: 'bang', triangle: 'tri', 'triangle-down': 'flip-tri',
  hourglass: 'hourglass', delay: 'delay', card: 'notch-rect', text: 'text', start: 'sm-circ', end: 'fr-circ', junction: 'f-circ',
  fork: 'fork', 'arrow-right': 'flag', note: 'doc'
};
/* las claves de una pieza que viajan en `@{ … }` (escalares) y las que van en `%% @gx id {json}` */
const NODE_SCALAR = ['heat', 'unit', 'progress', 'alert', 'owner', 'value', 'change', 'good', 'min', 'max', 'decimals', 'status', 'kind', 'delta', 'subtitle'];
const NODE_LIST = ['spark', 'thresholds', 'tags'];
const NODE_JSON = ['blocks', 'metrics', 'links', 'notes', 'files', 'parts', 'rows', 'span', 'score', 'badge', 'avatar', 'color', 'fill', 'textColor', 'summary', 'frame', 'details_html'];
const EDGE_SCALAR = ['rate', 'speed', 'weight', 'emphasis', 'kind', 'delta'];
const EDGE_JSON = ['summary', 'data', 'trigger', 'color', 'head', 'tail', 'headLabel', 'tailLabel', 'links'];
const ROOT_JSON = ['fx', 'owners', 'timeline', 'statuses', 'tour', 'filters', 'legend', 'summary', 'initialDepth', 'focus', 'levels', 'theme', 'links', 'icons', 'collapsed'];
const RICH = new Set(['heat', 'spark', 'unit', 'progress', 'alert', 'owner', 'value', 'change', 'good', 'min', 'max', 'thresholds', 'decimals', 'parts', 'summary', 'subtitle', 'metrics', 'blocks', 'links', 'notes', 'status', 'color', 'tags', 'kind', 'files', 'delta', 'rate', 'speed', 'weight', 'emphasis', 'data', 'trigger', 'animated']);

/* ---------- recoger ---------- */
export function annotations(text, lang) {
  const tr = (es, en) => (lang === 'es' ? es : en);
  const out = { nodes: {}, edges: {}, root: [], comments: 0, inline: 0, lines: [] };
  const lines = String(text || '').split(/\r?\n/);
  lines.forEach((line, i) => {
    const gx = /^\s*%%\s*@gx(?:\s+([^\s{]+))?\s*(\{.*\})\s*$/.exec(line);
    if (gx) {
      out.comments++;
      let keys = [];
      try { keys = Object.keys(JSON.parse(gx[2])); } catch (_) { keys = [tr('(JSON no válido)', '(invalid JSON)')]; }
      if (gx[1]) { (out.nodes[gx[1]] = out.nodes[gx[1]] || new Set()); keys.forEach(k => out.nodes[gx[1]].add(k)); }
      else keys.forEach(k => out.root.push(k));
      out.lines.push({ line: i + 1, target: gx[1] || tr('(raíz)', '(root)'), keys });
      return;
    }
    if (/^\s*%%/.test(line)) return;
    for (const m of line.matchAll(/([A-Za-z0-9_\-.]+)@\{([^}]*)\}/g)) {
      const keys = [...m[2].matchAll(/([A-Za-z_][\w-]*)\s*:/g)].map(x => x[1]).filter(k => RICH.has(k));
      if (!keys.length) continue;
      out.inline++;
      /* `e1@-->` declara una arista; `e1@{ … }` en su propia línea la anota: si el id es de una arista, va a aristas */
      const isEdge = new RegExp(`(^|\\s)${m[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}@(-|=|\\.|~)`).test(text);
      const bag = isEdge ? out.edges : out.nodes;
      (bag[m[1]] = bag[m[1]] || new Set()); keys.forEach(k => bag[m[1]].add(k));
      out.lines.push({ line: i + 1, target: m[1], keys, inline: true });
    }
  });
  const flat = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, [...v]]));
  return { nodes: flat(out.nodes), edges: flat(out.edges), root: [...new Set(out.root)], comments: out.comments, inline: out.inline, lines: out.lines };
}

/* ---------- expresar ---------- */
const safeId = (id, used) => {
  let s = String(id).replace(/[^A-Za-z0-9_]/g, '_');
  if (!/^[A-Za-z_]/.test(s)) s = 'n_' + s;
  if (/^(end|subgraph|graph|flowchart|style|class|classDef|click|linkStyle|direction|default)$/i.test(s)) s += '_';
  let k = s, i = 2;
  while (used.has(k) && used.get(k) !== id) k = `${s}_${i++}`;
  used.set(k, id);
  return k;
};
const q = s => '"' + String(s == null ? '' : s).replace(/"/g, '#quot;').replace(/\n/g, '<br>') + '"';
const yamlVal = v => (typeof v === 'number' || typeof v === 'boolean' ? String(v) : q(v));
const pick = (o, keys) => Object.fromEntries(keys.filter(k => o[k] != null && o[k] !== '').map(k => [k, o[k]]));

function flowchart(spec, opts) {
  const used = new Map();
  const id = x => safeId(x, used);
  const dir = spec.direction === 'down' ? 'TD' : 'LR';
  const out = [];
  if (spec.title) out.push('---', `title: ${String(spec.title).replace(/\n/g, ' ')}`, '---');
  out.push(`flowchart ${dir}`);
  const nodes = spec.nodes || [];
  const byParent = new Map();
  for (const n of nodes) { const p = n.parent || (n.lane ? '§' + n.lane : null); if (!byParent.has(p)) byParent.set(p, []); byParent.get(p).push(n); }
  const hasKids = new Set(nodes.filter(n => byParent.has(n.id)).map(n => n.id));
  const gxLines = [];
  const decl = (n, ind) => {
    const nid = id(n.id);
    const attrs = [];
    const shp = MERMAID_SHAPE[n.shape] || (n.shape ? null : null);
    if (shp) attrs.push(`shape: ${shp}`);
    attrs.push(`label: ${q(n.label || n.id)}`);
    for (const [k, v] of Object.entries(pick(n, NODE_SCALAR))) attrs.push(`${k}: ${yamlVal(v)}`);
    for (const [k, v] of Object.entries(pick(n, NODE_LIST))) if (Array.isArray(v) && v.length) attrs.push(`${k}: ${q(v.join(' '))}`);
    out.push(`${ind}${nid}@{ ${attrs.join(', ')} }`);
    const rich = pick(n, NODE_JSON);
    if (n.shape && !MERMAID_SHAPE[n.shape]) rich.shape = n.shape;
    if (n.id !== nid) rich.id = n.id;
    if (Object.keys(rich).length) gxLines.push(`%% @gx ${nid} ${JSON.stringify(rich)}`);
  };
  const block = (pid, ind) => {
    for (const n of byParent.get(pid) || []) {
      if (hasKids.has(n.id)) {
        out.push(`${ind}subgraph ${id(n.id)} [${q(n.label || n.id)}]`);
        block(n.id, ind + '  ');
        out.push(`${ind}end`);
        const rich = pick(n, NODE_JSON.concat(NODE_SCALAR));
        if (Object.keys(rich).length) gxLines.push(`%% @gx ${id(n.id)} ${JSON.stringify(rich)}`);
      } else decl(n, ind);
    }
  };
  for (const l of spec.lanes || []) {
    if (!byParent.has('§' + l.id)) continue;
    out.push(`  subgraph ${id('lane_' + l.id)} [${q(l.label || l.id)}]`);
    block('§' + l.id, '    ');
    out.push('  end');
  }
  block(null, '  ');
  for (const e of spec.edges || []) {
    if (!used.has(id(e.from)) && !nodes.some(n => n.id === e.from)) continue;
    const dashed = e.kind === 'event' || e.kind === 'queue' || e.kind === 'async' || e.dashed;
    const arrow = e.emphasis === 'hero' ? '==>' : dashed ? '-.->' : (e.head === 'none' ? '---' : '-->');
    const eid = e.id ? id(e.id) : null;
    const lab = e.label ? `|${q(e.label)}|` : '';
    out.push(`  ${id(e.from)} ${eid ? eid + '@' : ''}${arrow}${lab} ${id(e.to)}`);
    const sc = pick(e, EDGE_SCALAR);
    if (e.animated) sc.animate = true;
    if (eid && Object.keys(sc).length) out.push(`  ${eid}@{ ${Object.entries(sc).map(([k, v]) => `${k}: ${yamlVal(v)}`).join(', ')} }`);
    const rich = pick(e, EDGE_JSON);
    if (eid && Object.keys(rich).length) gxLines.push(`%% @gx ${eid} ${JSON.stringify(rich)}`);
  }
  /* colores: classDef por color de pieza, así Mermaid también los pinta */
  const colors = new Map();
  for (const n of nodes) { const c = typeof n.color === 'string' ? n.color : n.color && n.color.light; if (c && /^#[0-9a-f]{3,8}$/i.test(c)) { if (!colors.has(c)) colors.set(c, []); colors.get(c).push(id(n.id)); } }
  let ci = 0;
  for (const [c, ids] of colors) { out.push(`  classDef c${ci} stroke:${c},stroke-width:2px`); out.push(`  class ${ids.join(',')} c${ci}`); ci++; }
  const root = pick(spec, ROOT_JSON);
  if (opts && opts.fx !== undefined) root.fx = opts.fx;
  /* el conversor enciende «▶ Flujo» en los flowchart: si el original no lo tenía, se dice */
  if (root.fx === undefined) root.fx = { play: false };
  else if (root.fx && typeof root.fx === 'object' && root.fx.play === undefined) root.fx = Object.assign({}, root.fx, { play: false });
  else if (typeof root.fx === 'string' && !/^(vivid|neon|blueprint|glass)$/.test(root.fx)) root.fx = { preset: root.fx, play: false };
  /* los flujos de secuencia viajan en la raíz, con los ids de Mermaid */
  if (Array.isArray(spec.flows) && spec.flows.length) {
    const mid = x => (used.has(id(x)) ? id(x) : x);
    root.flows = spec.flows.map(f => Object.assign({}, f, {
      participants: (f.participants || []).map(mid),
      messages: (f.messages || []).map(m => Object.assign({}, m, m.from != null ? { from: mid(m.from) } : {}, m.to != null ? { to: mid(m.to) } : {}, m.over ? { over: m.over.map(mid) } : {}, m.node ? { node: mid(m.node) } : {}))
    }));
  }
  if (Object.keys(root).length) out.push(`%% @gx ${JSON.stringify(root)}`);
  return out.concat(gxLines).join('\n') + '\n';
}

function sequence(spec, flow) {
  const used = new Map();
  const id = x => safeId(x, used);
  const out = ['sequenceDiagram'];
  if (flow.title) out.push(`  title ${flow.title}`);
  const byLane = new Map();
  const nodes = new Map((spec.nodes || []).map(n => [n.id, n]));
  for (const p of flow.participants || []) { const n = nodes.get(p) || { id: p }; const k = n.lane || ''; if (!byLane.has(k)) byLane.set(k, []); byLane.get(k).push(n); }
  for (const [lane, ps] of byLane) {
    const l = (spec.lanes || []).find(x => x.id === lane);
    if (l) out.push(`  box ${l.label || l.id}`);
    for (const n of ps) out.push(`  ${n.shape === 'actor' || n.kind === 'actor' ? 'actor' : 'participant'} ${id(n.id)} as ${String(n.label || n.id).replace(/\n/g, ' ')}`);
    if (l) out.push('  end');
  }
  const ARROW = { sync: '->>', async: '-)', return: '-->>', self: '->>' };
  for (const m of flow.messages || []) {
    if (m.kind === 'block') out.push(`  ${m.block === 'alt' ? 'alt' : m.block || 'loop'} ${m.label || ''}`.trimEnd());
    else if (m.kind === 'else') out.push(`  else ${m.label || ''}`.trimEnd());
    else if (m.kind === 'end') out.push('  end');
    else if (m.kind === 'note') out.push(`  Note ${m.side === 'left' ? 'left of' : m.side === 'right' ? 'right of' : 'over'} ${(m.over || []).map(id).join(',')}: ${m.label || ''}`);
    else if (m.phase) out.push(`  rect rgba(127,127,127,.08)\n  Note over ${(flow.participants || []).slice(0, 1).map(id).join(',')}: ${m.label || ''}\n  end`);
    else if (m.from != null && m.to != null) {
      let arrow = ARROW[m.kind] || '->>';
      if (m.head === 'cross') arrow = m.kind === 'return' ? '--x' : '-x';
      if (m.head === 'open') arrow = m.kind === 'return' ? '-->' : '->';
      out.push(`  ${id(m.from)}${arrow}${m.activate ? '+' : m.deactivate ? '-' : ''}${id(m.to)}: ${m.label || ''}`);
    }
  }
  const rich = {};
  for (const p of flow.participants || []) {
    const n = nodes.get(p); if (!n) continue;
    const r = pick(n, NODE_JSON.concat(NODE_SCALAR)); delete r.summary;
    if (n.shape && n.shape !== 'actor' && n.shape !== 'rect') { r.shape = n.shape; if (n.kind) r.kind = n.kind; }
    if (Object.keys(r).length) rich[id(p)] = r;
  }
  const lines = out;
  for (const [k, v] of Object.entries(rich)) lines.push(`%% @gx ${k} ${JSON.stringify(v)}`);
  return lines.join('\n') + '\n';
}

export function toMermaid(spec, opts = {}) {
  const flows = spec.flows || [];
  if (opts.flow || (spec.graphTab === false && flows.length)) {
    const f = flows.find(x => x.id === opts.flow) || flows[0];
    if (f) return { text: sequence(spec, f), type: 'sequenceDiagram', lossy: [] };
  }
  const lossy = [];
  const lang = opts.lang || spec.lang, tr = (es, en) => (lang === 'es' ? es : en);
  const mode = spec.layout && spec.layout.mode;
  if (mode && mode !== 'graph' && mode !== 'tree') lossy.push(tr(`layout.mode «${mode}» (se expresa como flowchart; el layout propio va en %% @gx)`, `layout.mode «${mode}» (written as a flowchart; the custom layout goes in %% @gx)`));
  if (flows.length) lossy.push(tr(`${flows.length} flujo(s) de secuencia: pide cada uno con flow: <id>`, `${flows.length} sequence flow(s): request each one with flow: <id>`));
  const text = flowchart(spec, opts);
  const extra = mode && mode !== 'graph' ? `%% @gx ${JSON.stringify({ layout: spec.layout })}\n` : '';
  return { text: text + extra, type: 'flowchart', lossy };
}

/* un Mermaid de partida con lo que se le ha añadido después (parches de Claude, datos en vivo), como `%% @gx` */
export function overlay(text, extra) {
  const lines = [];
  for (const [nid, data] of Object.entries(extra.nodes || {})) if (data && Object.keys(data).length) lines.push(`%% @gx ${nid} ${JSON.stringify(data)}`);
  if (extra.root && Object.keys(extra.root).length) lines.push(`%% @gx ${JSON.stringify(extra.root)}`);
  return String(text).replace(/\s*$/, '\n') + (lines.length ? lines.join('\n') + '\n' : '');
}
