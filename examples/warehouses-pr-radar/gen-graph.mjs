import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(HERE, 'data.js'), 'utf8') + ';this.D={PRS,GROUPS,RELATED,EPICS,TICKETS,ME}', ctx);
const { PRS, GROUPS, RELATED, EPICS, TICKETS, ME } = ctx.D;

const GH = (r, n) => `https://github.com/acme/${r}/pull/${n}`;
const JI = k => `https://example.atlassian.net/browse/${k}`;
const ART = id => `https://example.com/notes/${id}`;

const STATE = {
  merged: { label: 'Mergeada', color: { light: '#1f7a45', dark: '#5fd08e' } },
  pending: { label: 'Pendiente de aprobar', color: { light: '#b07004', dark: '#f0b64a' } },
  draft: { label: 'Draft', color: { light: '#7a6a9e', dark: '#b3a3dc' } },
  changes: { label: 'Cambios pedidos', color: { light: '#b42318', dark: '#ff8a7a' } },
};
const JSTATE = {
  'Done': { light: '#1f7a45', dark: '#5fd08e' },
  'In Code Review': { light: '#2c56c9', dark: '#8aa8ff' },
  'In Progress': { light: '#0b6e8c', dark: '#4fb3d1' },
  'To Do': { light: '#6b7385', dark: '#9aa3b5' },
  'Blocked': { light: '#b42318', dark: '#ff8a7a' },
};
const EPIC_IDS = new Set(EPICS.map(e => e.id));
const byId = Object.fromEntries(PRS.map(p => [p.id, p]));
const prNode = id => `pr-${id}`;
const tkNode = k => (EPIC_IDS.has(k) ? `ep-${k}` : `tk-${k}`);
const label = p => (p.r === 'ui-kit' ? 'ui-kit ' : '') + '#' + p.id;

const nodes = [];
const edges = [];
let eid = 0;
const edge = (from, to, kind, lbl, extra = {}) => edges.push({ id: `e${++eid}`, from, to, kind, label: lbl, ...extra });

const LANE_OF = { nav: 'page', members: 'page', detail: 'page', list: 'page', form: 'geo', geo: 'geo', mapview: 'geo', mapkit: 'geo', core: 'back', other: 'back' };
GROUPS.forEach(g => {
  const members = PRS.filter(p => p.g === g.id);
  const open = members.filter(p => p.s !== 'merged').length;
  nodes.push({
    id: `b-${g.id}`, lane: LANE_OF[g.id], kind: 'module', label: g.name, subtitle: g.sub,
    summary: `${members.length} PRs en este bloque: ${open} abiertas y ${members.length - open} mergeadas.`,
    metrics: [{ label: 'Abiertas', value: String(open) }, { label: 'Mergeadas', value: String(members.length - open) }],
  });
});

PRS.forEach(p => {
  const st = STATE[p.s];
  const when = p.s === 'merged' ? `mergeada el ${p.d}` : `abierta el ${p.d}`;
  const parts = [`${st.label}, ${when}, de ${p.a}.`];
  if (p.note) parts.push(p.note + '.');
  if (p.deps) parts.push('Depende de ' + p.deps.map(([d, k]) => `${label(byId[d])} (${k === 'stack' ? 'stack' : 'funcional'})`).join(', ') + '.');
  const notes = [];
  if (p.s === 'changes') notes.push({ tone: 'warn', text: 'Tiene cambios pedidos: bloquea a las PRs que cuelgan de ella.' });
  if (p.newToday) notes.push({ tone: 'info', text: 'Novedad de hoy: ' + (p.note || 'actividad nueva') });
  if (p.isNew) notes.push({ tone: 'info', text: 'PR abierta hoy.' });
  if (p.note && /Desbloqueada/.test(p.note)) notes.push({ tone: 'good', text: p.note });
  if (p.note && /paralelo/.test(p.note)) notes.push({ tone: 'warn', text: 'Dos PRs hacen la vista de mapa por caminos paralelos (#1027 y #1031).' });
  const links = [{ kind: 'pr', number: +p.id, repo: `acme/${p.r}`, status: p.s === 'merged' ? 'merged' : p.s === 'draft' ? 'draft' : 'open' }];
  (p.tk || []).forEach(([k]) => {
    const t = TICKETS[k]; const ep = EPICS.find(e => e.id === k);
    links.push({ kind: 'jira', key: k, status: (t || ep || {}).s || (ep && ep.status) || '', note: t ? `${t.t} · ${t.s} · ${t.w === '-' ? 'sin asignar' : t.w}${t.e !== 'WH-906' ? ' · épica ' + t.e : ''}` : ep ? `Épica ${ep.name}` : '' });
    if (t && t.warn) notes.push({ tone: 'warn', text: `${k}: ${t.warn}` });
  });
  (p.rev || []).forEach(([n, id]) => links.push({ kind: 'artifact', url: ART(id), label: n === 'v. 18-sep' ? `pr-${p.id}-review (18-sep)` : n, note: 'Artefacto de revisión' }));
  (p.rel || []).forEach(([n, id]) => links.push({ kind: 'artifact', url: ART(id), label: n, note: 'Relacionado por el nombre' }));
  if (p.id === '1027') links.push({ kind: 'node', target: 'pr-1031', note: 'Camino paralelo para la vista de mapa' });
  if (p.id === '1031') links.push({ kind: 'node', target: 'pr-1027', note: 'Camino paralelo para la vista de mapa' });
  const tkTxt = (p.tk || []).map(([k]) => { const t = TICKETS[k]; return t ? `${k} (${t.s})` : k; });
  if (tkTxt.length) parts.push(`Jira: ${tkTxt.join(', ')}${/Identificado/.test(p.o || '') ? ' — ' + p.o.toLowerCase() : ''}.`);
  if (p.rev) parts.push('Tiene artefacto de revisión.');
  nodes.push({
    id: prNode(p.id), parent: `b-${p.g}`, kind: p.r === 'ui-kit' ? 'package' : 'service', status: p.s,
    label: `${label(p)} · ${p.t}`, subtitle: `${st.label} · ${p.d}${p.a === ME ? ' · mía' : ''}`,
    summary: parts.join(' '),
    tags: [st.label, p.a, p.r, p.o || '', ...(p.tk || []).map(([k]) => k)].filter(Boolean),
    notes, links,
    metrics: [{ label: 'Estado', value: st.label }, { label: p.s === 'merged' ? 'Merge' : 'Inicio', value: '2026-' + p.d }, { label: 'Autor', value: p.a }],
  });
  (p.deps || []).forEach(([d, k]) => {
    if (!byId[d]) return;
    const blocking = byId[d].s !== 'merged';
    edge(prNode(d), prNode(p.id), k === 'stack' ? 'dependency' : 'async', k === 'stack' ? 'stack' : 'funcional', {
      summary: `${label(p)} ${k === 'stack' ? 'parte de la rama de' : 'necesita lo que trae'} ${label(byId[d])}${blocking ? '; sigue abierta, así que bloquea.' : '; ya mergeada.'}`,
      emphasis: blocking ? 'normal' : 'muted', animated: blocking && p.s !== 'merged',
    });
  });
});

const E = (a, b) => edges.find(e => e.from === a && e.to === b)?.id;
edges.forEach(e => {
  if ([E('pr-1025', 'pr-1027'), E('pr-1003', 'pr-1004')].includes(e.id)) e.emphasis = 'hero';
});

const flows = [
  {
    id: 'map', title: 'Camino al mapa', summary: 'Del motor MapView en ui-kit a la vista de mapa de Warehouses en el monorepo.',
    participants: ['pr-1026', 'pr-1038', 'pr-1030', 'pr-1025', 'pr-1027', 'pr-1028', 'pr-1031', 'pr-1029'],
    messages: [
      { id: 'm1', from: 'pr-1026', to: 'pr-1038', label: 'motor tras el MapAdapter (7 PRs mergeadas)', kind: 'sync' },
      { id: 'm2', from: 'pr-1038', to: 'pr-1030', label: 'proveedor Google · mergeada hoy', kind: 'sync' },
      { id: 'm3', from: 'pr-1026', to: 'pr-1025', label: 'vista map en Data Collection', kind: 'sync' },
      { id: 'm4', from: 'pr-1025', to: 'pr-1027', label: 'pin a la alpha · bloqueada por cambios pedidos', kind: 'async', note: 'ui-kit#1025 sigue en cambios pedidos' },
      { id: 'm5', from: 'pr-1025', to: 'pr-1031', label: 'pin a la alpha (camino paralelo)', kind: 'async' },
      { id: 'm6', from: 'pr-1027', to: 'pr-1028', label: 'stack: side panel', kind: 'sync' },
      { id: 'm7', from: 'pr-1030', to: 'pr-1029', label: 'desbloqueada: falta subir ui-kit-react', kind: 'return' },
    ],
  },
  {
    id: 'geo', title: 'geocoding', summary: 'Tus drafts: de las columnas nuevas a los selectores de lugar.',
    participants: ['pr-1017', 'pr-1018', 'pr-1019', 'pr-1020', 'pr-1021'],
    messages: [
      { id: 'g1', from: 'pr-1017', to: 'pr-1018', label: 'columnas geoname_state_id / geoname_city_id', kind: 'async' },
      { id: 'g2', from: 'pr-1018', to: 'pr-1019', label: 'stack: nombrar lugares por id', kind: 'sync' },
      { id: 'g3', from: 'pr-1019', to: 'pr-1020', label: 'stack: listar lugares para pickers', kind: 'sync' },
      { id: 'g4', from: 'pr-1020', to: 'pr-1021', label: 'stack: zona horaria desde la ciudad', kind: 'sync' },
    ],
  },
  {
    id: 'nav', title: 'Navegación y personas', summary: 'Lo que espera a que se mergee la #1003.',
    participants: ['pr-1003', 'pr-1004', 'pr-1007', 'pr-1008'],
    messages: [
      { id: 'n1', from: 'pr-1003', to: 'pr-1004', label: 'stack: link único', kind: 'sync' },
      { id: 'n2', from: 'pr-1003', to: 'pr-1007', label: 'namespace de i18n compartido', kind: 'async' },
      { id: 'n3', from: 'pr-1007', to: 'pr-1008', label: 'stack: filtro por relación', kind: 'sync' },
    ],
  },
];

const tour = {
  title: 'Qué pide atención hoy',
  steps: [
    { title: 'El mapa entero', body_html: '<p>Solo PRs, en tres carriles temáticos y diez bloques por funcionalidad. El color es el estado de la PR; las flechas animadas son dependencias que aún bloquean. Los tickets de Jira y los artefactos están como enlaces en el panel de cada PR.</p>', focus: { nodes: ['b-mapview', 'b-geo', 'b-nav', 'b-members'] } },
    { title: 'ui-kit#1025 frena la vista de mapa', body_html: '<p>Tiene la aprobación de bruno-soler, pero siguen los <b>cambios pedidos</b>. De su versión alpha cuelgan la #1027, la #1028 y la nueva #1031.</p>', focus: { nodes: ['pr-1025', 'pr-1027', 'pr-1028', 'pr-1031'] }, select: 'pr-1025' },
    { title: 'Dos caminos para el mismo mapa', body_html: '<p>La <b>#1027</b> (Bruno) y la <b>#1031</b> (Clara) montan la vista de mapa de Warehouses. Hay que decidir cuál sigue adelante.</p>', focus: { nodes: ['pr-1027', 'pr-1031'] } },
    { title: 'La #1003 abre paso a tres PRs', body_html: '<p>Tenía <b>2 aprobaciones</b>, pero el 24-sep fcsonline <b>pidió cambios</b>: hablar con el equipo de traducciones para reutilizar las actuales. Cuando se mergee, podrán avanzar la #1004, la #1007 y, detrás de esta, la #1008.</p>', focus: { nodes: ['pr-1003', 'pr-1004', 'pr-1007', 'pr-1008'] }, select: 'pr-1003' },
    { title: 'Tu cadena de geocoding', body_html: '<p>La <b>#1017</b> crea las columnas; la #1018 resuelve los ids; la #1019, la #1020 y la #1021 (zona horaria) van en stack encima. Las tres últimas son drafts sin ticket citado: encajan en WH-119 y WH-118.</p>', focus: { nodes: ['pr-1017', 'pr-1018', 'pr-1019', 'pr-1020', 'pr-1021'] } },
    { title: 'La #1029 ya puede avanzar', body_html: '<p>La <b>ui-kit#1030</b>, el proveedor de Google, se mergeó hoy. A la #1029 solo le falta subir la versión de ui-kit-react y los campos lat/long de la #1027.</p>', focus: { nodes: ['pr-1030', 'pr-1029', 'pr-1027'] }, select: 'pr-1029' },
    { title: 'Jira no refleja lo que ha pasado', body_html: '<p>Las PRs con aviso ⚠ tienen un ticket desajustado: la <b>ui-kit#1030</b> está mergeada con WH-122 en In Code Review; la <b>#1003</b> tiene WH-104 en Blocked; la #1027, la #1028, la #1013, la #1014 y la #1016 tienen su ticket en To Do sin asignar; la <b>#1007</b> implementa WH-111, que sigue en To Do. Abre cada PR para ir al ticket.</p>', focus: { nodes: ['pr-1030', 'pr-1003', 'pr-1027', 'pr-1028', 'pr-1013', 'pr-1014', 'pr-1016', 'pr-1007'] } },
  ],
};

const spec = {
  schema: 'graphx/1',
  title: 'PRs de Warehouses',
  summary: 'Foto del 23-sep-2026.',
  lang: 'es', direction: 'right', initialDepth: 2,
  levels: [{ depth: 0, label: 'Bloque' }, { depth: 1, label: 'PR' }],
  layout: { lanes: 'strict', frames: true },
  collapsed: ['b-mapkit', 'b-other'],
  theme: { light: { accent: '#2c56c9' }, dark: { accent: '#8aa8ff' } },
  links: { repo: 'acme/platform', jira: 'https://example.atlassian.net/browse/', related: [
    ...EPICS.filter(e => e.id !== 'WH-906').map(e => ({ kind: 'jira', key: e.id, status: e.status, note: 'Épica · ' + e.name })),
    ...RELATED.map(([n, id]) => ({ kind: 'artifact', url: ART(id), label: n, note: 'Contexto del proyecto' })),
  ] },
  lanes: [
    { id: 'page', label: 'Página y navegación', subtitle: 'Organización, personas, detalle, lista', color: { light: '#2c56c9', dark: '#8aa8ff' } },
    { id: 'geo', label: 'Direcciones y mapa', subtitle: 'formulario, geocoding, vista de mapa, MapView', color: { light: '#0b6e8c', dark: '#4fb3d1' } },
    { id: 'back', label: 'Backend y transversales', subtitle: 'eventos, core y fuera del proyecto', color: { light: '#8250df', dark: '#c297ff' } },
  ],
  statuses: Object.fromEntries(Object.entries(STATE).map(([k, v]) => [k, { label: v.label, color: v.color }])),
  icons: {
    service: 'M4 2.5h8A1.5 1.5 0 0 1 13.5 4v8a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 12V4A1.5 1.5 0 0 1 4 2.5zM10 5.3a1.9 1.9 0 0 0-3.2 1.4v5M5.4 8.3h3.6',
  },
  legend: {
    edges: [
      { label: 'stack: parte de la rama de otra PR', style: 'solid' },
      { label: 'funcional: necesita lo que trae otra', style: 'dashed' },
      { label: 'aún bloquea (la de origen sigue abierta)', style: 'flow' },
      { label: 'ya no bloquea (la de origen está mergeada)', style: 'muted' },
      { label: 'la dependencia que más frena hoy', style: 'hero' },
    ],
    kinds: { module: 'bloque funcional', service: 'PR del monorepo platform', package: 'PR de ui-kit (librería)' },
  },
  nodes, edges, flows, tour,
};
fs.writeFileSync(path.join(HERE, '..', 'warehouses-pr-radar.json'), JSON.stringify(spec, null, 2));
console.log(`nodes=${nodes.length} edges=${edges.length}`);
