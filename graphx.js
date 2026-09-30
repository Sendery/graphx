/* GraphX — motor de diagramas navegables para artifacts.
 *
 * Entrada: un único JSON (ver schema.md). Salida: un diagrama con jerarquía plegable
 * por niveles, conexiones que suben al contenedor visible cuando sus extremos están
 * plegados, tooltips, panel de detalle, búsqueda, trazado de dependencias, vista de
 * secuencia por flujo y recorrido guiado con modo presentación.
 *
 * Depende de ELK (window.ELK, elk.bundled.js) para el layout. Todo lo demás es propio.
 * API: GraphX.mount(host, spec, opts) → instancia.                                   */
(function (global) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const DUR = 460;
  const DELTA_RANK = { added: 3, removed: 3, modified: 2, unchanged: 0 };
  const DASHED_KINDS = { event: 1, queue: 1, async: 1 };
  /* filas de una secuencia que no son mensajes: marcos, notas, activaciones y fases */
  const SEQ_META = { phase: 1, block: 1, else: 1, end: 1, note: 1, activate: 1, deactivate: 1 };

  const STR = {
    es: {
      graph: 'Grafo', depth: 'Profundidad', expandAll: 'Expandir todo', collapseAll: 'Plegar todo',
      search: 'Buscar pieza…', onlyChanges: 'Solo cambios', legend: 'Leyenda', fit: 'Ajustar', present: 'Presentar',
      exitPresent: 'Salir', tour: 'Recorrido guiado', step: 'Paso', of: 'de', prev: 'Anterior', next: 'Siguiente',
      close: 'Cerrar', expand: 'Expandir', collapse: 'Plegar', center: 'Centrar', upstream: 'De qué depende',
      downstream: 'Qué depende de esto', clearTrace: 'Quitar trazado', outgoing: 'Salidas', incoming: 'Entradas',
      children: 'Contiene', files: 'Ficheros', stepsHere: 'Pasos que lo explican', notes: 'A tener en cuenta',
      data: 'Qué viaja', trigger: 'Qué lo dispara', from: 'Desde', to: 'Hacia', connections: 'conexiones',
      viaChildren: 'a través de piezas plegadas', clickHint: 'Clic para el detalle', dblHint: 'doble clic para centrar', expHint: '+N para abrir',
      zoomHint: 'Pulsa en el diagrama o usa ⌘/Ctrl + rueda para hacer zoom', play: 'Reproducir', pause: 'Pausa',
      stop: 'Detener', upShort: 'Depende de', downShort: 'Dependientes', inTour: 'En el recorrido',
      seeInGraph: 'Ver en el grafo', layouting: 'Recolocando…', noMatch: 'Sin resultados', items: 'piezas',
      delta: { added: 'nuevo', modified: 'modificado', removed: 'eliminado', unchanged: 'sin cambios' },
      deltaShort: { added: 'NUEVO', modified: 'MOD', removed: 'ELIM', unchanged: '' },
      edgeKinds: { sync: 'llamada', async: 'asíncrono / evento', hero: 'la conexión que importa', animated: 'flujo principal', agg: 'conexiones agrupadas' },
      kbd: '← → pasos · Esc salir · + − zoom · 0 ajustar', lane: 'Carril', diffOpen: 'Ver diff', frames: 'Marcos',
      bandAdd: 'nuevas', bandMod: 'modificadas', orient: 'Orientación', explore: 'Explorar', exitExplore: 'Cerrar',
      touchHint: 'Dos dedos para mover el diagrama · o pulsa ⤢ Explorar', changedFiles: 'Ficheros cambiados', allChanges: 'Todos los cambios en GitHub',
      links: 'Enlaces', related: 'Relacionado en este diagrama', linkKinds: { jira: 'Jira', pr: 'PR', notion: 'Notion', artifact: 'Artefacto', doc: 'Documento', url: 'Enlace', node: 'Pieza' },
      filesBtn: 'Ficheros', inNodes: 'en', unchangedFiles: 'Ficheros de contexto (sin cambios)', filesOf: 'ficheros', openDiff: 'Abrir diff'
    },
    en: {
      graph: 'Graph', depth: 'Depth', expandAll: 'Expand all', collapseAll: 'Collapse all',
      search: 'Search…', onlyChanges: 'Changes only', legend: 'Legend', fit: 'Fit', present: 'Present',
      exitPresent: 'Exit', tour: 'Guided tour', step: 'Step', of: 'of', prev: 'Previous', next: 'Next',
      close: 'Close', expand: 'Expand', collapse: 'Collapse', center: 'Center', upstream: 'What it depends on',
      downstream: 'What depends on it', clearTrace: 'Clear trace', outgoing: 'Outgoing', incoming: 'Incoming',
      children: 'Contains', files: 'Files', stepsHere: 'Steps that explain it', notes: 'Worth knowing',
      data: 'Data', trigger: 'Triggered by', from: 'From', to: 'To', connections: 'connections',
      viaChildren: 'through collapsed parts', clickHint: 'Click for details', dblHint: 'double-click to center', expHint: '+N to open',
      zoomHint: 'Click the diagram or use ⌘/Ctrl + wheel to zoom', play: 'Play', pause: 'Pause',
      stop: 'Stop', upShort: 'Depends on', downShort: 'Dependents', inTour: 'In the tour',
      seeInGraph: 'Show in graph', layouting: 'Laying out…', noMatch: 'No matches', items: 'parts',
      delta: { added: 'new', modified: 'modified', removed: 'removed', unchanged: 'unchanged' },
      deltaShort: { added: 'NEW', modified: 'MOD', removed: 'DEL', unchanged: '' },
      edgeKinds: { sync: 'call', async: 'async / event', hero: 'the connection that matters', animated: 'main flow', agg: 'grouped connections' },
      kbd: '← → steps · Esc exit · + − zoom · 0 fit', lane: 'Lane', diffOpen: 'Open diff', frames: 'Frames',
      bandAdd: 'new', bandMod: 'modified', orient: 'Orientation', explore: 'Explore', exitExplore: 'Close',
      touchHint: 'Two fingers to move the diagram · or tap ⤢ Explore', changedFiles: 'Changed files', allChanges: 'All changes on GitHub',
      links: 'Links', related: 'Related in this diagram', linkKinds: { jira: 'Jira', pr: 'PR', notion: 'Notion', artifact: 'Artifact', doc: 'Doc', url: 'Link', node: 'Part' },
      filesBtn: 'Files', inNodes: 'in', unchangedFiles: 'Context files (unchanged)', filesOf: 'files', openDiff: 'Open diff'
    }
  };

  /* Iconos de 16×16, trazo. Uno por `kind`; los desconocidos caen en `other`. */
  const ICON = {
    service: 'M3 3h10v4H3zM3 9h10v4H3zM5.5 5h.01M5.5 11h.01',
    app: 'M2.5 3.5h11v9h-11zM2.5 6h11',
    module: 'M8 2l5.5 3v6L8 14l-5.5-3V5zM8 8l5.5-3M8 8v6M8 8L2.5 5',
    function: 'M10.5 2.5c-2 0-2.5 1-2.5 3v5c0 2-.5 3-2.5 3M5 7h5',
    route: 'M2.5 8h8M8 4.5L11.5 8 8 11.5M13.5 3v10',
    job: 'M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM8 5v3l2 1.5',
    queue: 'M2.5 4.5h11M2.5 8h11M2.5 11.5h11M11 2.5l2.5 2-2.5 2',
    datastore: 'M3 4c0-1.1 2.2-2 5-2s5 .9 5 2-2.2 2-5 2-5-.9-5-2zM3 4v8c0 1.1 2.2 2 5 2s5-.9 5-2V4M3 8c0 1.1 2.2 2 5 2s5-.9 5-2',
    cache: 'M9 2L4 9h4l-1 5 5-7H8z',
    external: 'M6 3H3v10h10v-3M9 2.5h4.5V7M13.5 2.5L7 9',
    ui: 'M2.5 3h11v8h-11zM6 14h4M8 11v3',
    config: 'M3 4.5h6M11 4.5h2M3 11.5h2M7 11.5h6M9 3v3M5 10v3',
    test: 'M6 2.5v4L2.8 12a1 1 0 0 0 .9 1.5h8.6a1 1 0 0 0 .9-1.5L10 6.5v-4M5 2.5h6',
    package: 'M2.5 6.5h11v7h-11zM2.5 6.5L4 3h8l1.5 3.5M8 3v3.5M6.5 9h3',
    lane: 'M2.5 4h11M2.5 8h11M2.5 12h11',
    method: 'M5 4L2 8l3 4M11 4l3 4-3 4',
    class: 'M3 3h10v10H3zM3 6.5h10M6 3v10',
    file: 'M4 2h5l3 3v9H4zM9 2v3h3',
    other: 'M8 3a5 5 0 1 0 0 10A5 5 0 0 0 8 3z',
    link: 'M6.5 9.5l3-3M7 4.5l1-1a2.5 2.5 0 0 1 3.5 3.5l-1 1M9 11.5l-1 1A2.5 2.5 0 0 1 4.5 9l1-1',
    jira: 'M8 2l6 6-6 6-6-6zM8 5.5L10.5 8 8 10.5 5.5 8z',
    pr: 'M4.5 3.5v9M4.5 3.5a1.5 1.5 0 1 0 0-.01M11.5 12.5a1.5 1.5 0 1 0 0 .01M11.5 11V6.5c0-1-.5-1.5-1.5-1.5H7.5M9 3.5L7.5 5 9 6.5',
    notion: 'M3.5 3h7l2 2v8h-9zM6 6v5M6 6l4 5M10 6v5',
    artifact: 'M8 2.5l1.5 3.5 3.5 1.5-3.5 1.5L8 12.5 6.5 9 3 7.5 6.5 6z',
    doc: 'M4 2h5l3 3v9H4zM6 8h4M6 10.5h4',
    url: 'M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM2.5 8h11M8 2.5c1.6 1.6 2.3 3.5 2.3 5.5S9.6 11.9 8 13.5M8 2.5C6.4 4.1 5.7 6 5.7 8s.7 3.9 2.3 5.5',
    node: 'M3 5h4v6H3zM9 5h4v6H9zM7 8h2',
    claude: 'M8 1.8v12.4M1.8 8h12.4M3.6 3.6l8.8 8.8M12.4 3.6l-8.8 8.8'
  };
  /* marca de GitHub (octicon mark-github, MIT): va rellena, no en trazo */
  const GH = 'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z';
  /* icono de enlace por tipo; artifact y claude comparten la marca de Claude */
  const LINK_ICON = { pr: 'gh', jira: 'jira', notion: 'notion', artifact: 'claude', doc: 'doc', url: 'url', node: 'node' };
  const STATUS_CLASS = s => {
    s = String(s || '').toLowerCase();
    if (/merged|fusionad/.test(s)) return 'merged';
    if (/draft|borrador/.test(s)) return 'draft';
    if (/closed|cerrad|cancel|rechaz|won't|wont/.test(s)) return 'closed';
    if (/done|hecho|resuel|complet|terminad/.test(s)) return 'done';
    if (/progress|curso|review|revisi/.test(s)) return 'progress';
    if (/open|abiert|todo|pendiente|to do/.test(s)) return 'open';
    return s ? 'other' : '';
  };
  /* Colores opcionales. Solo se aceptan valores de color CSS (hex, rgb/hsl/oklch, nombre), nunca
     texto libre: el valor acaba dentro de una hoja de estilos. */
  const COLOR_RE = /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\([0-9.,%\s/+-]+(deg|turn|rad)?[0-9.,%\s/+-]*\)|[a-z]{3,20})$/i;
  const safeColor = v => typeof v === 'string' && COLOR_RE.test(v.trim()) ? v.trim() : null;
  /* un color puede ser "#hex" (vale para los dos temas) o { light, dark } */
  const colorPair = v => {
    if (v == null) return null;
    if (typeof v === 'string') { const c = safeColor(v); return c ? { light: c, dark: c } : null; }
    if (typeof v === 'object') { const l = safeColor(v.light), d = safeColor(v.dark); return l || d ? { light: l || d, dark: d || l } : null; }
    return null;
  };
  /* tokens del tema que se pueden sobreescribir desde el JSON (`theme.light` / `theme.dark`) */
  const THEME_KEYS = ['bg', 'canvas', 'ink', 'muted', 'faint', 'line', 'card', 'card-line', 'glyph-bg', 'lane', 'lane-line', 'group', 'group-line',
    'accent', 'accent-soft', 'add', 'add-soft', 'mod', 'mod-soft', 'del', 'del-soft', 'neu', 'warn', 'band-a', 'band-b', 'band-head', 'frame', 'band-div', 'note', 'note-line'];

  /* Enlaces relacionados: se admiten solo http(s); cualquier otro esquema se descarta. */
  function resolveLink(l, spec) {
    if (!l || typeof l !== 'object') return null;
    const L = spec.links || {};
    const kind = l.kind || 'url';
    let url = l.url || null, label = l.label || null;
    if (kind === 'jira' && !url && l.key) { url = (L.jira || 'https://example.atlassian.net/browse/').replace(/\/?$/, '/') + encodeURIComponent(l.key); label = label || l.key; }
    if (kind === 'pr' && !url && l.number) { const repo = l.repo || L.repo; if (repo) url = `https://github.com/${repo}/pull/${l.number}`; label = label || `#${l.number}${l.repo && l.repo !== L.repo ? ' · ' + l.repo : ''}`; }
    if (kind === 'node') return l.target ? { kind, target: l.target, label: label || l.target, note: l.note || '' } : null;
    if (!url || !/^https?:\/\//i.test(String(url))) return null;
    return { kind, url: String(url), label: label || String(url).replace(/^https?:\/\/(www\.)?/, '').slice(0, 48), note: l.note || '', status: l.status || '' };
  }

  /* ---------- utilidades ---------- */
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function s(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function h(tag, cls, html, parent) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  }
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerpRect = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t) });
  const raf = global.requestAnimationFrame ? global.requestAnimationFrame.bind(global) : (f => setTimeout(() => f(Date.now()), 16));
  const now = () => (global.performance && performance.now) ? performance.now() : Date.now();
  let uid = 0;

  let ctx2d = null;
  function textW(text, size, weight, mono) {
    if (ctx2d === null) {
      try { ctx2d = document.createElement('canvas').getContext('2d') || false; } catch (_) { ctx2d = false; }
    }
    if (ctx2d) {
      ctx2d.font = `${weight || 400} ${size}px ${mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'system-ui, -apple-system, "Segoe UI", sans-serif'}`;
      return ctx2d.measureText(String(text)).width;
    }
    if (mono) return String(text).length * size * .62;
    let w = 0; for (const ch of String(text)) w += /[A-ZÁÉÍÓÚÑ#@MW]/.test(ch) ? .7 : /[\s.,:;'|il]/.test(ch) ? .3 : /[0-9]/.test(ch) ? .56 : .54;
    return w * size * (weight >= 600 ? 1.05 : 1);
  }
  function fitText(text, max, size, weight, mono) {
    text = String(text || '');
    if (textW(text, size, weight, mono) <= max) return text;
    let lo = 0, hi = text.length;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (textW(text.slice(0, m) + '…', size, weight, mono) <= max) lo = m; else hi = m - 1; }
    return text.slice(0, lo) + '…';
  }
  function roundedPath(pts, r) {
    if (pts.length < 2) return '';
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i - 1], c = pts[i], n = pts[i + 1];
      const d1 = Math.hypot(c.x - p.x, c.y - p.y), d2 = Math.hypot(n.x - c.x, n.y - c.y);
      const rr = Math.min(r, d1 / 2, d2 / 2);
      const a = { x: c.x + (p.x - c.x) * rr / (d1 || 1), y: c.y + (p.y - c.y) * rr / (d1 || 1) };
      const b = { x: c.x + (n.x - c.x) * rr / (d2 || 1), y: c.y + (n.y - c.y) * rr / (d2 || 1) };
      d += ` L${a.x},${a.y} Q${c.x},${c.y} ${b.x},${b.y}`;
    }
    const last = pts[pts.length - 1];
    return d + ` L${last.x},${last.y}`;
  }

  /* ---------- modelo ---------- */
  function buildModel(spec) {
    const M = new Map(), roots = [], warn = [];
    (spec.lanes || []).forEach((l, i) => M.set(l.id, Object.assign({}, l, { kind: 'lane', isLane: true, parent: null, order: i, children: [] })));
    (spec.nodes || []).forEach((n, i) => {
      if (M.has(n.id)) { warn.push('id duplicado: ' + n.id); return; }
      M.set(n.id, Object.assign({ kind: 'other', delta: 'unchanged' }, n, { order: 1000 + i, children: [] }));
    });
    for (const n of M.values()) {
      if (n.isLane) continue;
      let p = n.parent != null ? n.parent : (n.lane != null ? n.lane : null);
      if (p != null && !M.has(p)) { warn.push(`padre desconocido en ${n.id}: ${p}`); p = null; }
      n.parent = p;
    }
    for (const n of M.values()) {
      let seen = new Set([n.id]), p = n.parent;
      while (p != null) { if (seen.has(p)) { warn.push('ciclo en ' + n.id); n.parent = null; break; } seen.add(p); p = M.get(p).parent; }
    }
    for (const n of M.values()) (n.parent == null ? roots : M.get(n.parent).children).push(n.id);
    const byOrder = (a, b) => M.get(a).order - M.get(b).order;
    roots.sort(byOrder); for (const n of M.values()) n.children.sort(byOrder);
    const depthOf = id => { let d = 0, p = M.get(id).parent; while (p != null) { d++; p = M.get(p).parent; } return d; };
    let maxDepth = 0;
    for (const n of M.values()) { n.depth = depthOf(n.id); maxDepth = Math.max(maxDepth, n.depth); }
    for (const n of M.values()) {
      let p = n.id; while (p != null && !M.get(p).isLane) p = M.get(p).parent;
      n.laneId = p;
    }
    /* delta y stats de un contenedor: si no los declara, se derivan de lo que contiene */
    const post = id => {
      const n = M.get(id); let add = 0, del = 0, files = new Map(), rank = 0, count = 0;
      (n.files || []).forEach(f => files.set(f.path, f));
      for (const c of n.children) {
        const r = post(c); count += 1 + r.count; rank = Math.max(rank, r.rank);
        r.files.forEach((f, k) => files.set(k, f));
      }
      files.forEach(f => { add += f.additions || 0; del += f.deletions || 0; });
      if (!n.isLane && n.delta === 'unchanged' && !(spec.nodes || []).find(x => x.id === id && x.delta)) {
        if (rank > 0) n.delta = 'modified';
      }
      n.stat = { additions: add, deletions: del, files: files.size };
      n.descendants = count;
      return { rank: Math.max(rank, n.isLane ? 0 : (DELTA_RANK[n.delta] || 0)), files, count };
    };
    roots.forEach(post);

    const edges = (spec.edges || []).map((e, i) => Object.assign({ id: 'e' + i, kind: 'call', delta: 'unchanged' }, e))
      .filter(e => { const ok = M.has(e.from) && M.has(e.to); if (!ok) warn.push(`arista ${e.id}: extremo desconocido`); return ok; });
    const flows = (spec.flows || []).map(f => Object.assign({}, f, {
      participants: (f.participants || []).map(p => typeof p === 'string' ? { node: p } : p),
      messages: (f.messages || []).map((m, i) => Object.assign({ id: f.id + '-m' + i, kind: 'sync' }, m))
    }));
    const steps = ((spec.tour && spec.tour.steps) || []).map((st, i) => Object.assign({ id: 's' + i, focus: {} }, st));
    const nodeSteps = new Map(), edgeSteps = new Map();
    steps.forEach((st, i) => {
      (st.focus.nodes || []).forEach(id => { let p = id; while (p != null && M.has(p)) { if (!nodeSteps.has(p)) nodeSteps.set(p, []); if (!nodeSteps.get(p).includes(i)) nodeSteps.get(p).push(i); p = M.get(p).parent; } });
      (st.focus.edges || []).forEach(id => { if (!edgeSteps.has(id)) edgeSteps.set(id, []); edgeSteps.get(id).push(i); });
    });
    const levels = spec.levels && spec.levels.length ? spec.levels : Array.from({ length: maxDepth + 1 }, (_, d) => ({ depth: d, label: String(d + 1) }));
    return { M, roots, edges, flows, steps, nodeSteps, edgeSteps, levels, maxDepth, warn };
  }
  const ancestors = (M, id) => { const out = []; let p = M.get(id) && M.get(id).parent; while (p != null) { out.push(p); p = M.get(p).parent; } return out; };
  const isAncestor = (M, a, b) => ancestors(M, b).includes(a);

  /* ---------- montaje ---------- */
  function mount(host, spec, opts) {
    opts = opts || {};
    const lang = STR[opts.lang || spec.lang] ? (opts.lang || spec.lang) : 'es';
    const T = STR[lang];
    const G = buildModel(spec);
    /* nombre legible de un tipo: el de `legend.kinds` si lo trae, si no el propio `kind` */
    const kindName = k => (spec.legend && spec.legend.kinds && spec.legend.kinds[k]) || k;
    const M = G.M;
    const I = 'gx' + (++uid);
    const reduce = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const dur = reduce ? 0 : DUR;
    if (G.warn.length && global.console) console.warn('[GraphX]', G.warn.join('\n'));

    host.classList.add('gx');
    const ownId = !host.id;
    if (ownId) host.id = I;
    /* paleta: tokens del tema + un color por carril/pieza/arista/mensaje que lo declare */
    const palette = new Map();
    /* iconos propios del JSON (`icons`): trazos de 16×16; solo comandos de path, nada de marcado */
    const IC = Object.assign({}, ICON);
    const ICFILL = new Set();
    Object.entries(spec.icons || {}).forEach(([k, v]) => {
      const d = typeof v === 'string' ? v : v && v.path;
      if (typeof d === 'string' && d.length < 6000 && /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/.test(d)) { IC[k] = d; if (v && v.fill) ICFILL.add(k); }
    });
    /* estados propios (`statuses`): cada pieza con `status` toma su etiqueta y, si no trae color, el suyo */
    const STATUSES = spec.statuses && typeof spec.statuses === 'object' ? spec.statuses : {};
    const HAS_DELTA = (spec.nodes || []).some(n => n.delta) || (spec.edges || []).some(e => e.delta);
    const colorVar = v => {
      const c = colorPair(v); if (!c) return null;
      const key = c.light + '|' + c.dark;
      if (!palette.has(key)) palette.set(key, { i: palette.size, c });
      return `var(--gx-u${palette.get(key).i})`;
    };
    const themeCSS = () => {
      const th = spec.theme || {}, sel = '#' + host.id;
      const decl = (set, mode) => {
        const out = [];
        THEME_KEYS.forEach(k => { const c = safeColor(set && set[k]); if (c) out.push(`--gx-${k}:${c}`); });
        palette.forEach(({ i, c }) => out.push(`--gx-u${i}:${c[mode]}`));
        return out.join(';');
      };
      const L = decl(th.light || th, 'light'), D = decl(th.dark || th, 'dark');
      return `${sel}.gx{${L}}@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) ${sel}.gx{${D}}}:root[data-theme="dark"] ${sel}.gx{${D}}`;
    };
    host.innerHTML = '';
    host.setAttribute('tabindex', '0');
    if (opts.height) host.style.setProperty('--gx-h', typeof opts.height === 'number' ? opts.height + 'px' : opts.height);

    /* --- chrome --- */
    const bar = h('div', 'gx-bar', null, host);
    const tabs = h('div', 'gx-tabs', null, bar);
    const tools = h('div', 'gx-tools', null, bar);
    const depthSeg = h('div', 'gx-seg gx-graphonly', null, tools);
    depthSeg.setAttribute('role', 'group'); depthSeg.setAttribute('aria-label', T.depth);
    const bExpand = btn(tools, '⊕', T.expandAll, 'gx-graphonly'), bCollapse = btn(tools, '⊖', T.collapseAll, 'gx-graphonly');
    const searchWrap = h('div', 'gx-search gx-graphonly', null, tools);
    const searchIn = h('input', null, null, searchWrap);
    searchIn.type = 'search'; searchIn.placeholder = T.search; searchIn.setAttribute('aria-label', T.search);
    const searchList = h('div', 'gx-search-list', null, searchWrap);
    const bOnly = btn(tools, T.onlyChanges, T.onlyChanges, 'gx-toggle gx-graphonly');
    const bFrames = btn(tools, T.frames, T.frames, 'gx-toggle gx-graphonly');
    const bLegend = btn(tools, T.legend, T.legend, 'gx-toggle');
    const bDir = btn(tools, '↦', T.orient, 'gx-graphonly');
    const bFiles = btn(tools, T.filesBtn, T.changedFiles, 'gx-graphonly');
    const bFit = btn(tools, '◎', T.fit);
    const bExplore = btn(tools, '⤢ ' + T.explore, T.explore, 'gx-explore-b');
    const bPresent = btn(tools, '▶ ' + T.present, T.present, 'gx-primary');

    const stage = h('div', 'gx-stage', null, host);
    const svg = s('svg', { class: 'gx-svg', role: 'img', 'aria-label': spec.title || 'Diagrama' }, stage);
    const defs = s('defs', null, svg);
    ['added', 'modified', 'removed', 'unchanged', 'lit'].forEach(d => {
      const m = s('marker', { id: `${I}-mk-${d}`, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
      s('path', { d: 'M0,1 L10,5 L0,9 z', class: 'gx-mk gx-mk-' + d }, m);
    });
    const world = s('g', { class: 'gx-world' }, svg);
    const clip = s('clipPath', { id: `${I}-clip` }, defs);
    const clipR = s('rect', { rx: 18 }, clip);
    const gBands = s('g', { class: 'gx-bands', 'clip-path': `url(#${I}-clip)` }, world);
    const frameR = s('rect', { class: 'gx-frame', rx: 18 }, world);
    const gGroups = s('g', { class: 'gx-groups' }, world);
    const gEdges = s('g', { class: 'gx-edges' }, world);
    const gNodes = s('g', { class: 'gx-nodes' }, world);
    const gLabels = s('g', { class: 'gx-elabels' }, world);

    const seqSvg = s('svg', { class: 'gx-svg gx-seq', role: 'img' }, stage);
    seqSvg.innerHTML = defs.outerHTML.replace(new RegExp(I + '-', 'g'), I + 's-');
    const seqWorld = s('g', { class: 'gx-world' }, seqSvg);

    const legend = h('div', 'gx-legend', null, stage);
    const tip = h('div', 'gx-tip', null, stage);
    const panel = h('aside', 'gx-panel', null, stage);
    const mini = h('div', 'gx-mini', null, stage);
    const miniSvg = s('svg', { class: 'gx-mini-svg' }, mini);
    const hint = h('div', 'gx-hint', esc(T.zoomHint), stage);
    const busy = h('div', 'gx-busy', esc(T.layouting), stage);
    const progress = h('div', 'gx-progress', '<i></i>', stage);
    const seqCtl = h('div', 'gx-seqctl', null, stage);
    const sticky = h('div', 'gx-sticky', null, stage);

    const tourBox = h('div', 'gx-tour', null, host);
    const themeEl = h('style', null, null, host);
    for (const n of M.values()) {
      const src = (spec.nodes || []).find(x => x.id === n.id) || {};
      n.status = src.status && STATUSES[src.status] ? src.status : null;
      n.cvar = colorVar(n.color || (n.status ? STATUSES[n.status].color : null));
    }
    const statusCvar = k => colorVar(STATUSES[k] && STATUSES[k].color);
    G.edges.forEach(e => { e.cvar = colorVar(e.color); });
    G.flows.forEach(f => f.messages.forEach(m => { m.cvar = colorVar(m.color); }));
    themeEl.textContent = themeCSS();
    /* un marcador de flecha por color declarado: el marcador no hereda el color de la línea */
    const colorMarker = (cvar, prefix) => {
      const id = `${prefix}-mkc-${cvar.replace(/\D/g, '')}`;
      const root = prefix === I ? defs : seqSvg.querySelector('defs');
      if (!root.querySelector('#' + id)) {
        const m = s('marker', { id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, root);
        const pth = s('path', { d: 'M0,1 L10,5 L0,9 z' }, m); pth.style.fill = cvar;
      }
      return `url(#${id})`;
    };
    const paint = (el, cvar) => { if (cvar) { el.classList.add('has-c'); el.style.setProperty('--gx-c', cvar); } };

    function btn(parent, label, title, cls) {
      const b = h('button', 'gx-btn' + (cls ? ' ' + cls : ''), esc(label), parent);
      b.type = 'button'; b.title = title; b.setAttribute('aria-label', title); return b;
    }

    /* --- estado --- */
    const S = {
      expanded: new Set(), visible: new Set(), rects: new Map(), vedges: [], els: new Map(), edgeEls: [],
      cam: { x: 0, y: 0, k: 1 }, seqCam: { x: 0, y: 0, k: 1 }, view: 'graph', selected: null, trace: null,
      tourTok: 0, onlyChanges: false, dir: spec.direction === 'down' ? 'down' : 'right', expanded2: false, frames: !(spec.layout && spec.layout.frames === false), bands: [], bandEls: new Map(), tour: -1, present: false, engaged: false, seq: null, seqPlay: null, layoutId: 0, bbox: null
    };
    const initial = spec.initialDepth != null ? spec.initialDepth : Math.min(1, G.maxDepth);
    setDepthSet(initial);

    /* --- pestañas de vista --- */
    const tabBtns = [];
    const mkTab = (id, label) => { const b = btn(tabs, label, label, 'gx-tab'); b.dataset.view = id; b.onclick = () => showView(id); tabBtns.push(b); };
    /* Solo secuencia: `graphTab: false` quita la vista de grafo (las piezas son
       solo participantes) y `initialView` elige el flujo con el que se abre. */
    const graphTab = spec.graphTab !== false || !G.flows.length;
    const homeView = (spec.initialView && G.flows.some(f => 'flow:' + f.id === spec.initialView)) ? spec.initialView
      : (graphTab ? 'graph' : 'flow:' + G.flows[0].id);
    if (graphTab) mkTab('graph', T.graph);
    G.flows.forEach(f => mkTab('flow:' + f.id, '⇄ ' + (f.title || f.id)));
    if (tabBtns.length < 2) tabs.style.display = 'none';
    if (!graphTab) host.classList.add('gx-seqonly');
    if (spec.title) { const t = h('div', 'gx-title', esc(spec.title)); bar.insertBefore(t, tabs); }

    /* --- profundidad --- */
    G.levels.forEach((lv, i) => {
      const b = btn(depthSeg, lv.label, `${T.depth}: ${lv.label}`, 'gx-seg-b');
      b.dataset.depth = lv.depth != null ? lv.depth : i;
      b.onclick = () => { setDepthSet(+b.dataset.depth); relayout({ fit: true }); };
    });
    if (G.levels.length < 2) depthSeg.style.display = 'none';
    function setDepthSet(d) {
      S.expanded = new Set();
      for (const n of M.values()) if (n.children.length && n.depth < d) S.expanded.add(n.id);
      if (spec.collapsed) spec.collapsed.forEach(id => S.expanded.delete(id));
    }
    function currentDepth() {
      for (let d = 0; d <= G.maxDepth; d++) {
        let ok = true;
        for (const n of M.values()) if (n.children.length && (n.depth < d) !== S.expanded.has(n.id)) { ok = false; break; }
        if (ok) return d;
      }
      return -1;
    }
    function syncDepthUI() {
      const d = currentDepth();
      depthSeg.querySelectorAll('.gx-seg-b').forEach(b => b.classList.toggle('on', +b.dataset.depth === d));
    }
    bExpand.onclick = () => { setDepthSet(G.maxDepth + 1); relayout({ fit: true }); };
    bCollapse.onclick = () => { setDepthSet(0); relayout({ fit: true }); };

    /* --- grafo visible: arista elevada al contenedor visible más cercano --- */
    function computeVisible() {
      const vis = new Set();
      const walk = id => { vis.add(id); const n = M.get(id); if (n.children.length && S.expanded.has(id)) n.children.forEach(walk); };
      G.roots.forEach(walk);
      const rep = id => { let x = id; while (!vis.has(x)) x = M.get(x).parent; return x; };
      const agg = new Map();
      for (const e of G.edges) {
        const a = rep(e.from), b = rep(e.to);
        if (a === b || isAncestor(M, a, b) || isAncestor(M, b, a)) continue;
        const k = a + '\u0000' + b;
        if (!agg.has(k)) agg.set(k, { id: 'v:' + a + '>' + b, from: a, to: b, list: [] });
        agg.get(k).list.push(e);
      }
      const vedges = [...agg.values()].map(v => {
        const rank = Math.max(...v.list.map(e => DELTA_RANK[e.delta] || 0));
        const lead = v.list.slice().sort((x, y) => ((y.emphasis === 'hero') - (x.emphasis === 'hero')) || ((DELTA_RANK[y.delta] || 0) - (DELTA_RANK[x.delta] || 0)))[0];
        return Object.assign(v, {
          delta: lead.delta && DELTA_RANK[lead.delta] === rank ? lead.delta : (rank === 3 ? 'added' : rank === 2 ? 'modified' : 'unchanged'),
          kind: lead.kind, animated: v.list.some(e => e.animated), hero: v.list.some(e => e.emphasis === 'hero'),
          muted: v.list.every(e => e.emphasis === 'muted'),
          lifted: v.list.some(e => e.from !== v.from || e.to !== v.to),
          label: v.list.length > 1 ? (lead.label ? `${lead.label} +${v.list.length - 1}` : `×${v.list.length}`) : (lead.label || '')
        });
      });
      return { vis, vedges, rep };
    }

    /* --- tamaños --- */
    const isGroup = id => { const n = M.get(id); return n.children.length > 0 && S.expanded.has(id) && S.visible.has(id); };
    /* Tarjetas más estrechas y más altas: el título parte en dos líneas antes que ensanchar
       la caja, así cuatro piezas enlazadas caben en pantalla sin bajar el zoom. */
    const CARD_MIN = 140, CARD_MAX = 212, PADX = 66;
    function wrap2(text, w1, w2) {
      const toks = String(text).split(/(?<=[\s#:_./-])/);
      let l1 = '', i = 0;
      while (i < toks.length && textW(l1 + toks[i], 13, 600) <= w1) l1 += toks[i++];
      if (!l1) { let k = 1; while (k < text.length && textW(text.slice(0, k + 1), 13, 600) <= w1) k++; return [text.slice(0, k), fitText(text.slice(k), w2, 13, 600)]; }
      const rest = toks.slice(i).join('');
      return rest ? [l1.trimEnd(), fitText(rest.trimStart(), w2, 13, 600)] : [l1.trimEnd()];
    }
    function cardLayout(n) {
      if (hasShape(n)) return shapeLayout(n);
      if (n._card) return n._card;
      const chipW = n.delta && n.delta !== 'unchanged' ? textW(T.deltaShort[n.delta], 9.5, 700) + 16 : 0;
      const full = textW(n.label, 13, 600), sub = n.subtitle ? textW(n.subtitle, 11, 400, true) : 0;
      if (full + chipW + 6 <= CARD_MAX - PADX) {
        const w = clamp(Math.max(full + chipW + 6, Math.min(sub, CARD_MAX - PADX)) + PADX, CARD_MIN, CARD_MAX);
        return (n._card = { w, h: 64, lines: [n.label] });
      }
      const lines = wrap2(n.label, CARD_MAX - PADX - chipW, CARD_MAX - PADX);
      return (n._card = { w: CARD_MAX, h: lines.length > 1 ? 80 : 64, lines });
    }
    function leafSize(n) { const c = cardLayout(n); return { w: c.w, h: c.h }; }

    /* --- formas (graphx-shapes.js): rombos, círculos, tablas, barras… --- */
    /* El módulo es opcional: sin él, toda pieza es una tarjeta. El contexto lleva lo que una forma
       necesita saber del diagrama entero (rango de fechas de un gantt, valor máximo de un sankey). */
    const SHP = global.GraphX && global.GraphX.shapes ? global.GraphX.shapes : null;
    const hasShape = n => !!(SHP && n.shape && SHP.has(n.shape) && !n.isLane);
    const shapeCtx = (() => {
      const toMs = v => { const t = typeof v === 'number' ? v : Date.parse(String(v).length === 10 ? v + 'T00:00:00Z' : String(v).replace(' ', 'T') + (/Z|[+-]\d\d:?\d\d$/.test(v) ? '' : 'Z')); return isNaN(t) ? null : t; };
      let lo = Infinity, hi = -Infinity, maxV = 0;
      for (const n of M.values()) {
        if (n.span) [n.span.start, n.span.end].forEach(v => { const t = v == null ? null : toMs(v); if (t != null) { lo = Math.min(lo, t); hi = Math.max(hi, t); } });
        if (typeof n.value === 'number') maxV = Math.max(maxV, n.value);
      }
      return { textW, dir: S.dir, span: lo < hi ? { min: lo, max: hi } : null, maxValue: maxV || 1, now: Date.now() };
    })();
    function shapeLayout(n) {
      shapeCtx.dir = S.dir;
      if (n._card && n._card.dir === S.dir) return n._card;
      const lay = SHP.measure(n, shapeCtx);
      return (n._card = { w: lay.w, h: lay.h, lines: [n.label], lay, dir: S.dir });
    }

    /* --- layout con ELK --- */
    let elk = null;
    const strictLanes = (spec.layout && spec.layout.lanes) !== 'flow' && (spec.lanes || []).length > 1;
    /* `layout.cycles`: cómo se rompen los ciclos. "dfs" invierte solo las aristas de retorno de un
       recorrido en profundidad que empieza por las piezas escritas primero (como dagre, el layout de
       Mermaid); "order" invierte toda arista que apunte a una pieza anterior. Por defecto, la heurística de ELK. */
    const CYCLES = { dfs: 'DEPTH_FIRST', order: 'MODEL_ORDER', greedy: 'GREEDY' };
    const cycleStrategy = CYCLES[spec.layout && spec.layout.cycles] || null;
    const framed = () => S.frames && strictLanes;
    if (!strictLanes) bFrames.style.display = 'none';
    bFrames.classList.toggle('on', S.frames);
    host.classList.toggle('gx-framed', framed());
    async function layout(vis, vedges) {
      /* foto del estado: la segunda pasada de ELK ocurre tras un await, y para entonces otra
         acción (Detener, un paso nuevo) puede haber cambiado lo que está abierto */
      const exp = new Set(S.expanded);
      const make = id => {
        const n = M.get(id);
        const kids = n.children.filter(c => vis.has(c));
        if (kids.length && exp.has(id)) {
          const top = n.isLane && framed() ? 18 : 46;
          const hw = textW(n.label, n.isLane ? 11 : 12.5, 700) * (n.isLane ? 1.25 : 1) + textW(n.subtitle || '', 11, 400, !n.isLane) + 120;
          return {
            id, children: kids.map(make),
            layoutOptions: { 'elk.padding': `[top=${top},left=18,bottom=18,right=18]`, 'elk.nodeSize.constraints': 'MINIMUM_SIZE', 'elk.nodeSize.minimum': `(${Math.round(hw)},60)` }
          };
        }
        const z = leafSize(n); return { id, width: z.w, height: z.h };
      };
      const buildGraph = list => ({
        id: ' gx-root',
        layoutOptions: {
          'elk.algorithm': 'layered', 'elk.direction': S.dir === 'down' ? 'DOWN' : 'RIGHT',
          'elk.hierarchyHandling': 'INCLUDE_CHILDREN', 'elk.edgeRouting': 'ORTHOGONAL',
          'elk.json.edgeCoords': 'ROOT', 'elk.json.shapeCoords': 'ROOT',
          'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
          'elk.layered.spacing.nodeNodeBetweenLayers': '54', 'elk.spacing.nodeNode': '22',
          'elk.layered.spacing.edgeNodeBetweenLayers': '22', 'elk.spacing.edgeNode': '18', 'elk.spacing.edgeEdge': '12',
          'elk.spacing.edgeLabel': '4', 'elk.edgeLabels.inline': 'false', 'elk.padding': '[top=24,left=24,bottom=24,right=24]',
          'elk.partitioning.activate': strictLanes ? 'true' : 'false',
          ...(cycleStrategy ? { 'elk.layered.cycleBreaking.strategy': cycleStrategy } : {})
        },
        children: G.roots.filter(r => vis.has(r)).map((r, i) => {
          const el = make(r);
          if (strictLanes && M.get(r).isLane) el.layoutOptions = Object.assign(el.layoutOptions || {}, { 'elk.partitioning.partition': String(M.get(r).order) });
          return el;
        }),
        edges: list.map(v => ({
          id: v.id, sources: [v.from], targets: [v.to],
          labels: v.label ? [{ text: v.label, width: Math.ceil(textW(v.label, 11, 500)) + 16, height: 20 }] : []
        }))
      });
      if (!elk) elk = new (await loadELK())();
      const rectsOf = res => { const r = new Map(); const walk = n => { if (n.id !== ' gx-root') r.set(n.id, { x: n.x, y: n.y, w: n.width, h: n.height }); (n.children || []).forEach(walk); }; walk(res); return r; };
      /* Una arista que acaba «antes» que su origen obliga a ELK a rodear contenedores enteros
         y a reservar canales vacíos para ello. Se detecta en una primera pasada, se saca del
         layout y se dibuja como arco sobre las posiciones de la segunda. */
      let res = await elk.layout(buildGraph(vedges));
      const down = S.dir === 'down';
      const c1 = rectsOf(res), ctr = (m, id) => { const r = m.get(id); return down ? r.y + r.h / 2 : r.x + r.w / 2; };
      const laneIx = id => { const l = M.get(id).laneId; return l != null ? M.get(l).order : -1; };
      const back = new Set(vedges.filter(v => c1.has(v.from) && c1.has(v.to) && (
        (strictLanes && laneIx(v.to) >= 0 && laneIx(v.from) >= 0 ? laneIx(v.to) < laneIx(v.from) : false) ||
        ((!strictLanes || laneIx(v.to) === laneIx(v.from)) && ctr(c1, v.to) < ctr(c1, v.from) - 12))).map(v => v.id));
      if (back.size) res = await elk.layout(buildGraph(vedges.filter(v => !back.has(v.id))));
      vedges.forEach(v => { v.back = back.has(v.id); });
      const rects = rectsOf(res);
      const paths = new Map();
      (res.edges || []).forEach(e => {
        /* una arista que cruza contenedores llega partida en varias secciones encadenadas */
        const secs = e.sections || []; if (!secs.length) return;
        const byId = new Map(secs.map(x => [x.id, x]));
        let cur = secs.find(x => !(x.incomingSections || []).length) || secs[0];
        const pts = [], seen = new Set();
        while (cur && !seen.has(cur.id)) {
          seen.add(cur.id);
          const seg = [cur.startPoint].concat(cur.bendPoints || [], [cur.endPoint]);
          const last = pts[pts.length - 1];
          seg.forEach((q, i) => { if (!(i === 0 && last && Math.abs(last.x - q.x) < .5 && Math.abs(last.y - q.y) < .5)) pts.push(q); });
          cur = byId.get((cur.outgoingSections || [])[0]);
        }
        secs.forEach(x => { if (!seen.has(x.id)) pts.push(x.startPoint, ...(x.bendPoints || []), x.endPoint); });
        const lab = (e.labels || [])[0];
        paths.set(e.id, { pts, label: lab ? { x: lab.x, y: lab.y, w: lab.width, h: lab.height } : null });
      });
      let bb = { x: 0, y: 0, w: res.width, h: res.height };
      for (const v of vedges) {
        if (!v.back) continue;
        const a = rects.get(v.from), b = rects.get(v.to); if (!a || !b) continue;
        let d, lx, ly;
        if (down) {
          const sx = a.x + a.w, sy = a.y + a.h / 2, tx = b.x + b.w, ty = b.y + b.h / 2, k = clamp(40 + Math.abs(sy - ty) * .18, 50, 220), cx = Math.max(sx, tx) + k;
          d = `M${sx},${sy} C${cx},${sy} ${cx},${ty} ${tx + 6},${ty}`; lx = .125 * sx + .75 * cx + .125 * tx; ly = (sy + ty) / 2;
          bb.w = Math.max(bb.w, cx - 10);
        } else {
          const sx = a.x + a.w / 2, sy = a.y, tx = b.x + b.w / 2, ty = b.y, k = clamp(40 + Math.abs(sx - tx) * .16, 50, 200), cy = Math.min(sy, ty) - k;
          d = `M${sx},${sy} C${sx},${cy} ${tx},${cy} ${tx},${ty - 6}`; lx = (sx + tx) / 2; ly = .125 * sy + .75 * cy + .125 * ty;
          bb.y = Math.min(bb.y, cy + 20); 
        }
        const lw = v.label ? Math.ceil(textW(v.label, 11, 500)) + 16 : 0;
        paths.set(v.id, { d, label: v.label ? { x: lx - lw / 2, y: ly - 10, w: lw, h: 20 } : null });
      }
      if (bb.y < 0) { bb.h -= bb.y; }
      return { rects, paths, bbox: bb };
    }

    /* --- elementos de nodo --- */
    function glyph(parent, kind, x, y, size) {
      const g = s('g', { class: 'gx-glyph', transform: `translate(${x},${y})` }, parent);
      s('rect', { width: size, height: size, rx: size * .28, class: 'gx-glyph-bg' }, g);
      const sc = (size - 10) / 16;
      s('path', { d: IC[kind] || IC.other, transform: `translate(5,5) scale(${sc})`, class: 'gx-glyph-ic' + (ICFILL.has(kind) ? ' fill' : '') }, g);
      return g;
    }
    /* árbol de graphx-shapes → nodos SVG */
    function toSVG(node, parent) {
      const a = node.attrs;
      if (node.tag === 'glyph') {
        if (a.bare) s('path', { d: IC[a.kind] || IC.other, transform: `translate(${a.x},${a.y}) scale(${a.size / 16})`, class: 'gx-glyph-ic gx-bigic' + (ICFILL.has(a.kind) ? ' fill' : '') }, parent);
        else glyph(parent, a.kind, a.x, a.y, a.size);
        return;
      }
      const e = s(node.tag, a, parent);
      if (node.text != null) e.textContent = node.text;
      node.children.forEach(c => toSVG(c, e));
    }
    /* Una pieza con forma se construye una vez, con su tamaño final; al animar (nacer de su
       contenedor, plegarse) se escala el grupo entero en vez de rehacer el dibujo en cada fotograma. */
    function makeShapeLeaf(n) {
      const cl = shapeLayout(n);
      const tree = SHP.render(n, cl.w, cl.h, shapeCtx, cl.lay);
      const g = s('g', { class: `gx-node gx-leaf gx-shape fam-${tree.family} sh-${n.shape} d-${n.delta}`, 'data-id': n.id, tabindex: 0, role: 'button', 'aria-label': `${n.label}${n.delta !== 'unchanged' ? ' — ' + (T.delta[n.delta] || '') : ''}` });
      paint(g, n.cvar || (n.laneId && !n.isLane && M.get(n.laneId).cvar && spec.layout && spec.layout.inheritLaneColor ? M.get(n.laneId).cvar : null));
      if (n.status) g.classList.add('st-' + String(n.status).replace(/[^\w-]/g, ''));
      /* plegada con hijos: dos copias del contorno detrás, como la pila de una tarjeta */
      const od = n.children.length ? SHP.outlineOf(tree) : null;
      if (od) [8, 4].forEach(k => s('path', { class: 'gx-stack', d: od, transform: `translate(${k},${k})` }, g));
      tree.children.forEach(c => toSVG(c, g));
      const parts = {}, ch = tree.chrome;
      if (ch) {
        let x = ch.x;
        if (n.notes && n.notes.length) { s('circle', { class: 'gx-note-dot ' + (n.notes[0].tone || 'warn'), r: 4, cx: x - 4, cy: ch.y }, g); x -= 14; }
        const kinds = [...new Set((n.links || []).map(l => resolveLink(l, spec)).filter(Boolean).map(l => LINK_ICON[l.kind] || 'url'))].slice(0, 3);
        if (kinds.length) {
          const lk = s('g', { class: 'gx-lk', transform: `translate(${x - kinds.length * 15},${ch.y - 6})` }, g);
          kinds.forEach((k, i) => { const ig = s('g', { class: 'gx-lki k-' + k, transform: `translate(${i * 15},0)` }, lk); if (k === 'gh') s('path', { d: GH, transform: 'scale(.75)', class: 'fill' }, ig); else s('path', { d: IC[k] || IC.url, transform: 'scale(.75)' }, ig); });
          x -= kinds.length * 15 + 6;
        }
        if (n.children.length) {
          parts.exp = s('g', { class: 'gx-exp', role: 'button', 'aria-label': T.expand }, g);
          const txt = '+' + n.descendants, ew = textW(txt, 10.5, 700) + 14;
          s('rect', { rx: 8, height: 17, width: ew }, parts.exp);
          const t = s('text', { y: 12.5, x: ew / 2 }, parts.exp); t.textContent = txt;
          parts.exp.setAttribute('transform', `translate(${x - ew},${ch.y - 8.5})`);
          parts.exp.addEventListener('click', ev => { ev.stopPropagation(); toggle(n.id); });
        }
      }
      g._parts = parts; g._kind = 'leaf'; g._shape = true; g._sz = { w: cl.w, h: cl.h };
      return g;
    }
    function makeLeaf(n) {
      if (hasShape(n)) return makeShapeLeaf(n);
      const g = s('g', { class: `gx-node gx-leaf d-${n.delta}`, 'data-id': n.id, tabindex: 0, role: 'button', 'aria-label': `${n.label} — ${T.delta[n.delta] || ''}` });
      paint(g, n.cvar || (n.laneId && !n.isLane && M.get(n.laneId).cvar && spec.layout && spec.layout.inheritLaneColor ? M.get(n.laneId).cvar : null));
      const hasKids = n.children.length > 0;
      const parts = {};
      if (hasKids) { parts.stack2 = s('rect', { class: 'gx-stack', rx: 10 }, g); parts.stack1 = s('rect', { class: 'gx-stack', rx: 10 }, g); }
      parts.box = s('rect', { class: 'gx-card', rx: 10 }, g);
      parts.accent = s('rect', { class: 'gx-accent', x: 7, y: 12, width: 3, rx: 1.5 }, g);
      glyph(g, n.kind, 17, 17, 28);
      const cl = cardLayout(n);
      parts.title = s('text', { class: 'gx-t', x: 55, y: 26 }, g);
      parts.title2 = s('text', { class: 'gx-t', x: 55, y: 42 }, g);
      parts.sub = s('text', { class: 'gx-st', x: 55, y: cl.lines.length > 1 ? 58 : 42 }, g);
      if (n.delta && n.delta !== 'unchanged') { parts.chip = s('g', { class: 'gx-chip' }, g); parts.chipR = s('rect', { rx: 4, height: 15, y: 9 }, parts.chip); parts.chipT = s('text', { y: 20 }, parts.chip); parts.chipT.textContent = T.deltaShort[n.delta]; }
      if (n.stat && (n.stat.additions || n.stat.deletions)) {
        parts.dbar = s('g', { class: 'gx-dbar' }, g);
        const tot = n.stat.additions + n.stat.deletions, w = 36, wa = Math.max(tot ? w * n.stat.additions / tot : 0, n.stat.additions ? 2 : 0);
        s('rect', { class: 'gx-dbar-a', width: wa, height: 3, rx: 1.5 }, parts.dbar);
        if (n.stat.deletions) s('rect', { class: 'gx-dbar-d', x: wa + 1, width: Math.max(w - wa - 1, 2), height: 3, rx: 1.5 }, parts.dbar);
      }
      const own = n.children.length ? filesUnder(n.id).map(x => x.f) : (n.files || []);
      /* sin stats (no se ensambló con --git) cuenta como cambiado si la pieza lo está */
      const changed = own.filter(f => churn(f) || (f.additions == null && n.delta !== 'unchanged'));
      if (changed.length) {
        /* un fichero: la pastilla es un enlace a su diff; varios: abre el panel en la lista */
        parts.fp = s('a', { class: 'gx-fpill', target: '_blank', rel: 'noopener' }, g);
        parts.fpR = s('rect', { rx: 4, height: 13 }, parts.fp);
        parts.fpT = s('text', { y: 9.7 }, parts.fp);
        parts.fpT.textContent = `± ${changed.length}`;
        const sync = () => { const u = changed.length === 1 && changed[0].diff_url; if (u) { parts.fp.setAttribute('href', u); } };
        sync(); g._syncPill = sync;
        parts.fp.setAttribute('aria-label', changed.length === 1 ? `${T.openDiff}: ${changed[0].path}` : `${changed.length} ${T.filesOf}`);
        parts.fp.addEventListener('click', ev => {
          ev.stopPropagation();
          if (changed.length === 1 && changed[0].diff_url) return;
          ev.preventDefault(); S.scrollFiles = true; select(n.id);
        });
        parts.fp.addEventListener('pointerenter', ev => { ev.stopPropagation(); showTip(`<div class="gx-tip-h"><b>${changed.length === 1 ? esc(T.openDiff) : esc(T.changedFiles)}</b></div><ul>${changed.slice(0, 6).map(f => `<li><code>${esc(f.path.split('/').pop())}</code> <span class="gx-add">+${f.additions || 0}</span> <span class="gx-del">−${f.deletions || 0}</span></li>`).join('')}</ul>`, ev); });
      }
      /* un icono por tipo de enlace (GitHub, Jira, Notion, Claude…): se ve de lejos qué hay en el detalle */
      const kinds = [...new Set((n.links || []).map(l => resolveLink(l, spec)).filter(Boolean).map(l => LINK_ICON[l.kind] || 'url'))];
      if (kinds.length) {
        parts.lk = s('g', { class: 'gx-lk' }, g);
        kinds.slice(0, 3).forEach((k, i) => {
          const ig = s('g', { class: 'gx-lki k-' + k, transform: `translate(${i * 15},0)` }, parts.lk);
          s('title', null, ig).textContent = T.linkKinds[Object.keys(LINK_ICON).find(x => LINK_ICON[x] === k)] || k;
          if (k === 'gh') s('path', { d: GH, transform: 'scale(.75)', class: 'fill' }, ig);
          else s('path', { d: IC[k] || IC.url, transform: 'scale(.75)' }, ig);
        });
        if (kinds.length > 3) { const t = s('text', { x: 46, y: 10, class: 'gx-lkmore' }, parts.lk); t.textContent = '+' + (kinds.length - 3); }
        parts.lkW = Math.min(kinds.length, 3) * 15 + (kinds.length > 3 ? 14 : 0);
      }
      if (n.notes && n.notes.length) parts.note = s('circle', { class: 'gx-note-dot ' + (n.notes[0].tone || 'warn'), r: 4 }, g);
      if (hasKids) {
        parts.exp = s('g', { class: 'gx-exp', role: 'button', 'aria-label': T.expand }, g);
        parts.expR = s('rect', { rx: 8, height: 17 }, parts.exp);
        parts.expT = s('text', { y: 12.5 }, parts.exp);
        parts.expT.textContent = '+' + n.descendants;
        parts.exp.addEventListener('click', ev => { ev.stopPropagation(); toggle(n.id); });
      }
      g._parts = parts; g._kind = 'leaf';
      return g;
    }
    function placeLeaf(g, r, n) {
      if (g._shape) {
        const kx = r.w / g._sz.w, ky = r.h / g._sz.h;
        g.setAttribute('transform', `translate(${r.x},${r.y})` + (Math.abs(kx - 1) > .002 || Math.abs(ky - 1) > .002 ? ` scale(${kx},${ky})` : ''));
        return;
      }
      const p = g._parts;
      g.setAttribute('transform', `translate(${r.x},${r.y})`);
      p.box.setAttribute('width', r.w); p.box.setAttribute('height', r.h);
      if (p.stack1) {
        p.stack1.setAttribute('x', 4); p.stack1.setAttribute('y', 4); p.stack1.setAttribute('width', r.w); p.stack1.setAttribute('height', r.h);
        p.stack2.setAttribute('x', 8); p.stack2.setAttribute('y', 8); p.stack2.setAttribute('width', r.w); p.stack2.setAttribute('height', r.h);
      }
      p.accent.setAttribute('height', Math.max(r.h - 24, 4));
      const chipW = p.chip ? textW(T.deltaShort[n.delta], 9.5, 700) + 10 : 0;
      if (g._w !== Math.round(r.w)) {
        g._w = Math.round(r.w);
        const cl = cardLayout(n);
        p.title.textContent = cl.lines.length > 1 ? cl.lines[0] : fitText(n.label, r.w - 66 - (chipW ? chipW + 6 : 0), 13, 600);
        p.title2.textContent = cl.lines[1] || '';
        const par = n.parent != null ? M.get(n.parent) : null;
        const fallback = n.children.length ? `${n.children.length} ${T.items}` : (par && !par.isLane ? par.label : kindName(n.kind));
        p.sub.textContent = fitText(n.subtitle || fallback, r.w - 66, 11, 400, true);
      }
      if (p.chip) { p.chipR.setAttribute('x', r.w - chipW - 9); p.chipR.setAttribute('width', chipW); p.chipT.setAttribute('x', r.w - chipW / 2 - 9); }
      if (p.dbar) p.dbar.setAttribute('transform', `translate(55,${r.h - 12})`);
      if (p.fp) { const fw = textW(p.fpT.textContent, 10, 700) + 12; p.fp.setAttribute('transform', `translate(${p.dbar ? 97 : 55},${r.h - 17})`); p.fpR.setAttribute('width', fw); p.fpT.setAttribute('x', fw / 2); }
      if (p.note) { p.note.setAttribute('cx', r.w - 10); p.note.setAttribute('cy', r.h - 10); }
      if (p.lk) p.lk.setAttribute('transform', `translate(${r.w - (p.note ? 20 : 8) - p.lkW},${r.h - 17})`);
      if (p.exp) {
        const ew = textW(p.expT.textContent, 10.5, 700) + 14;
        p.exp.setAttribute('transform', `translate(${r.w - ew - (p.note ? 20 : 9) - (p.lk ? p.lkW + 4 : 0)},${r.h - 24})`);
        p.expR.setAttribute('width', ew); p.expT.setAttribute('x', ew / 2);
      }
    }
    function makeGroup(n) {
      const g = s('g', { class: `gx-group ${n.isLane ? 'gx-lane' : ''} d-${n.delta} depth-${Math.min(n.depth, 4)}${n.frame ? ' fr-' + String(n.frame).replace(/[^\w-]/g, '') : ''}`, 'data-id': n.id });
      paint(g, n.cvar);
      const parts = {};
      parts.box = s('rect', { class: 'gx-gbox', rx: n.isLane ? 16 : 13 }, g);
      parts.head = s('g', { class: 'gx-ghead', tabindex: 0, role: 'button', 'aria-label': n.label }, g);
      parts.hit = s('rect', { class: 'gx-ghit', height: 40, rx: 12 }, parts.head);
      if (n.isLane) {
        parts.title = s('text', { class: 'gx-lt', x: 18, y: 26 }, parts.head);
        parts.sub = s('text', { class: 'gx-lst', y: 26 }, parts.head);
      } else {
        glyph(parts.head, n.kind, 14, 10, 22);
        parts.title = s('text', { class: 'gx-gt', x: 44, y: 26 }, parts.head);
        parts.sub = s('text', { class: 'gx-gst', y: 26 }, parts.head);
        if (n.delta && n.delta !== 'unchanged') { parts.chip = s('g', { class: 'gx-chip' }, parts.head); parts.chipR = s('rect', { rx: 4, height: 15, y: 13 }, parts.chip); parts.chipT = s('text', { y: 24 }, parts.chip); parts.chipT.textContent = T.deltaShort[n.delta]; }
      }
      parts.col = s('g', { class: 'gx-col', role: 'button', 'aria-label': T.collapse }, parts.head);
      s('rect', { width: 22, height: 22, rx: 6, y: 9 }, parts.col);
      s('path', { d: 'M6,20 h10', transform: 'translate(0,0)' }, parts.col);
      parts.col.addEventListener('click', ev => { ev.stopPropagation(); toggle(n.id); });
      g._parts = parts; g._kind = 'group';
      return g;
    }
    function placeGroup(g, r, n) {
      const p = g._parts;
      g.setAttribute('transform', `translate(${r.x},${r.y})`);
      p.box.setAttribute('width', r.w); p.box.setAttribute('height', r.h);
      p.hit.setAttribute('width', r.w);
      if (g._w !== Math.round(r.w)) {
        g._w = Math.round(r.w);
        const label = n.isLane ? String(n.label).toUpperCase() : n.label;
        const tx = n.isLane ? 18 : 44;
        const chipW = p.chip ? textW(T.deltaShort[n.delta], 9.5, 700) + 10 : 0;
        const room = r.w - tx - 42 - (chipW ? chipW + 8 : 0);
        p.title.textContent = fitText(label, room - (n.isLane ? label.length * 1.32 : 0), n.isLane ? 11 : 12.5, 700);
        const tw = textW(p.title.textContent, n.isLane ? 11 : 12.5, 700) + (n.isLane ? p.title.textContent.length * 11 * .12 : 0);
        const sub = n.isLane ? (n.subtitle || '') : (n.subtitle || `${n.children.length} ${T.items}`);
        const subRoom = room - tw - 12;
        p.sub.textContent = subRoom > 40 ? fitText(sub, subRoom, 11, 400, !n.isLane) : '';
        p.sub.setAttribute('x', tx + tw + 10);
        if (p.chip) { const cx = tx + tw + 10 + (p.sub.textContent ? textW(p.sub.textContent, 11, 400, !n.isLane) + 10 : 0); p.chipR.setAttribute('x', cx); p.chipR.setAttribute('width', chipW); p.chipT.setAttribute('x', cx + chipW / 2); }
      }
      p.col.setAttribute('transform', `translate(${r.w - 32},0)`);
    }

    /* --- aristas --- */
    /* Puntas de arista (graphx-shapes.markers): una definición por tipo y color, creada al usarse.
       La flecha por defecto sigue siendo la de siempre. */
    const MK_COLOR = { unchanged: 'var(--gx-neu)', added: 'var(--gx-add)', modified: 'var(--gx-mod)', removed: 'var(--gx-del)', lit: 'var(--gx-accent)' };
    function markerRef(type, key, prefix, fixed) {
      prefix = prefix || I;
      if (!type || type === 'none' || type === 'line') return null;
      /* la flecha de siempre crece con el grosor de la línea; en una arista gruesa (weight) va la de tamaño fijo */
      if ((type === 'arrow' && !fixed) || !SHP || !SHP.markers[type]) return MK_COLOR[key] ? `url(#${prefix}-mk-${key})` : colorMarker(key, prefix);
      const root = prefix === I ? defs : seqSvg.querySelector('defs');
      const def = SHP.markers[type], id = `${prefix}-m-${type}-${String(key).replace(/\W/g, '_')}`;
      if (!root.querySelector('#' + id)) {
        const m = s('marker', { id, viewBox: '0 0 20 20', refX: 19.5, refY: 10, markerWidth: 15, markerHeight: 15, markerUnits: 'userSpaceOnUse', orient: 'auto-start-reverse' }, root);
        const col = MK_COLOR[key] || key, pth = s('path', { d: def.d, class: 'gx-mkx' }, m);
        pth.style.stroke = def.fill === 'solid' ? 'none' : col;
        pth.style.fill = def.fill === 'solid' ? col : def.fill === 'line' ? 'none' : 'var(--gx-canvas)';
        pth.style.strokeWidth = '1.8';
      }
      return `url(#${id})`;
    }
    /* una arista agrupada (×N) lleva las puntas de sus aristas si todas coinciden; si no, la flecha */
    const edgeEnds = v => {
      const same = k => { const vals = [...new Set(v.list.map(e => e[k] || null))]; return vals.length === 1 ? vals[0] : undefined; };
      const head = same('head'), tail = same('tail');
      return { head: head === undefined ? 'arrow' : (head || 'arrow'), tail: tail || null };
    };
    function markEdge(line, v, lit) {
      const key = lit && !v.hero ? 'lit' : (v.cvar || (MK_COLOR[v.delta] ? v.delta : 'unchanged'));
      const { head, tail } = edgeEnds(v);
      const me = markerRef(head, key, I, v._weighted), ms = markerRef(tail, key, I, v._weighted);
      if (me) line.setAttribute('marker-end', me); else line.removeAttribute('marker-end');
      if (ms) line.setAttribute('marker-start', ms); else line.removeAttribute('marker-start');
    }
    const maxWeight = Math.max(0, ...(spec.edges || []).map(e => typeof e.weight === 'number' ? e.weight : 0));
    function makeEdge(v, path) {
      const g = s('g', { class: `gx-edge d-${v.delta} k-${v.kind}${v.back ? ' back' : ''}${v.hero ? ' hero' : ''}${v.muted ? ' muted' : ''}${v.lifted ? ' lifted' : ''}${DASHED_KINDS[v.kind] ? ' dashed' : ''}`, 'data-id': v.id });
      const d = path.d || roundedPath(path.pts, 9);
      s('path', { class: 'gx-ehit', d }, g);
      /* halo en vez de filtro: un filtro sobre una línea recta tiene caja de altura 0 y no se pinta */
      if (v.hero) s('path', { class: 'gx-ehalo', d }, g);
      v.cvar = (v.list.find(e => e.cvar) || {}).cvar || null;
      paint(g, v.cvar);
      const line = s('path', { class: 'gx-eline', d }, g);
      /* grosor por valor (sankey): la arista se lee como un caudal */
      const wsum = v.list.reduce((a, e) => a + (typeof e.weight === 'number' ? e.weight : 0), 0);
      v._weighted = !!(maxWeight && wsum);
      if (v._weighted) { g.classList.add('weighted'); line.style.strokeWidth = (1.6 + 13 * Math.min(wsum / maxWeight, 1)).toFixed(1) + 'px'; }
      markEdge(line, v, false);
      if (v.animated) s('path', { class: 'gx-eflow', d }, g);
      /* cardinalidades en los extremos (1, 0..*, …) */
      const one = v.list.length === 1 ? v.list[0] : null;
      if (one && path.pts && path.pts.length > 1 && (one.headLabel || one.tailLabel)) {
        const endLab = (a, b, text) => {
          const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
          const t = s('text', { class: 'gx-eend', x: a.x + ux * 17 - uy * 9, y: a.y + uy * 17 + ux * 9 + 4 }, g); t.textContent = text;
        };
        const P0 = path.pts;
        if (one.tailLabel) endLab(P0[0], P0[1], one.tailLabel);
        if (one.headLabel) endLab(P0[P0.length - 1], P0[P0.length - 2], one.headLabel);
      }
      g._line = line; g._v = v;
      const lab = path.label && v.label ? s('g', { class: `gx-elabel d-${v.delta}`, 'data-id': v.id, transform: `translate(${path.label.x},${path.label.y})` }) : null;
      if (lab) {
        s('rect', { width: path.label.w, height: path.label.h, rx: 6 }, lab);
        const t = s('text', { x: path.label.w / 2, y: 14 }, lab); t.textContent = v.label;
        if (v.list.length > 1) lab.classList.add('agg');
      }
      return { g, lab };
    }

    /* --- marcos: una columna por carril, de arriba abajo, con cabecera común --- */
    /* Horizontal (el diagrama va a la derecha): columnas con la cabecera arriba.
       Vertical (va hacia abajo): franjas con la cabecera a la izquierda. */
    const BAND_HEAD = 70, BAND_SIDE = 172;
    function computeBands(L) {
      if (!framed()) return [];
      const down = S.dir === 'down';
      const lanes = G.roots.filter(id => M.get(id).isLane && L.rects.has(id)).map(id => ({ id, r: L.rects.get(id) }))
        .sort((a, b) => down ? a.r.y - b.r.y : a.r.x - b.r.x);
      if (!lanes.length) return [];
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const r of L.rects.values()) { x0 = Math.min(x0, r.x); x1 = Math.max(x1, r.x + r.w); y0 = Math.min(y0, r.y); y1 = Math.max(y1, r.y + r.h); }
      x0 = Math.min(x0, L.bbox.x); y0 = Math.min(y0, L.bbox.y); x1 = Math.max(x1, L.bbox.x + L.bbox.w);
      if (down) {
        const bx0 = x0 - BAND_SIDE - 20, bx1 = x1 + 26;
        return lanes.map((l, i) => {
          const prev = lanes[i - 1], next = lanes[i + 1];
          const a = prev ? (prev.r.y + prev.r.h + l.r.y) / 2 : l.r.y - 26;
          const b = next ? (l.r.y + l.r.h + next.r.y) / 2 : l.r.y + l.r.h + 26;
          return { id: l.id, i, x: bx0, y: a, w: bx1 - bx0, h: b - a, down: true };
        });
      }
      const by0 = y0 - BAND_HEAD - 16, by1 = y1 + 26;
      return lanes.map((l, i) => {
        const prev = lanes[i - 1], next = lanes[i + 1];
        const a = prev ? (prev.r.x + prev.r.w + l.r.x) / 2 : l.r.x - 26;
        const b = next ? (l.r.x + l.r.w + next.r.x) / 2 : l.r.x + l.r.w + 26;
        return { id: l.id, i, x: a, y: by0, w: b - a, h: by1 - by0, down: false };
      });
    }
    function laneCounts(id) {
      const ds = descendantsOf(id).map(x => M.get(x)).filter(n => !n.children.length);
      return { n: ds.length, a: ds.filter(n => n.delta === 'added').length, m: ds.filter(n => n.delta === 'modified').length };
    }
    function makeBand(n) {
      const g = s('g', { class: 'gx-band', 'data-id': n.id });
      paint(g, n.cvar);
      const p = {};
      p.bg = s('rect', { class: 'gx-bandbg' }, g);
      p.acc = s('rect', { class: 'gx-bandacc' }, g);
      p.div = s('line', { class: 'gx-banddiv' }, g);
      p.head = s('g', { class: 'gx-bandhead', tabindex: 0, role: 'button', 'aria-label': n.label }, g);
      p.hbg = s('rect', { class: 'gx-bandhbg' }, p.head);
      p.hline = s('line', { class: 'gx-bandhline' }, p.head);
      p.idx = s('text', { class: 'gx-bandidx', x: 20, y: 29 }, p.head);
      p.title = s('text', { class: 'gx-bandt', y: 29 }, p.head);
      p.sub = s('text', { class: 'gx-bandst', x: 20, y: 47 }, p.head);
      p.sub2 = s('text', { class: 'gx-bandst', x: 16 }, p.head);
      p.stat = s('g', { class: 'gx-bandstat', transform: 'translate(20,60)' }, p.head);
      p.col = s('g', { class: 'gx-col', role: 'button', 'aria-label': T.collapse }, p.head);
      s('rect', { width: 22, height: 22, rx: 6, y: 13 }, p.col);
      p.colP = s('path', { d: 'M6,24 h10' }, p.col);
      p.col.addEventListener('click', ev => { ev.stopPropagation(); toggle(n.id); });
      g.appendChild(p.acc);
      p.head.addEventListener('click', ev => { ev.stopPropagation(); if (ev.detail > 1) return; select(n.id); });
      p.head.addEventListener('dblclick', ev => { ev.stopPropagation(); focusNode(n.id); });
      p.head.addEventListener('pointerenter', ev => showTip(nodeTip(n), ev));
      p.head.addEventListener('pointermove', moveTip);
      p.head.addEventListener('pointerleave', hideTip);
      g._p = p; return g;
    }
    function placeBand(g, b, n) {
      const p = g._p;
      g.setAttribute('transform', `translate(${b.x},${b.y})`);
      g.classList.toggle('alt', b.i % 2 === 1);
      p.bg.setAttribute('width', b.w); p.bg.setAttribute('height', b.h);
      const dn = !!b.down;
      g.classList.toggle('v', dn);
      if (dn) { p.div.setAttribute('x1', 0); p.div.setAttribute('x2', b.w); p.div.setAttribute('y1', 0); p.div.setAttribute('y2', 0); }
      else { p.div.setAttribute('y1', 0); p.div.setAttribute('y2', b.h); p.div.setAttribute('x1', 0); p.div.setAttribute('x2', 0); }
      p.div.style.display = b.i === 0 ? 'none' : '';
      p.hbg.setAttribute('width', dn ? BAND_SIDE : b.w); p.hbg.setAttribute('height', dn ? b.h : BAND_HEAD);
      if (dn) { p.acc.setAttribute('x', 0); p.acc.setAttribute('y', 0); p.acc.setAttribute('width', 4); p.acc.setAttribute('height', b.h); }
      else { p.acc.setAttribute('x', 0); p.acc.setAttribute('y', 0); p.acc.setAttribute('width', b.w); p.acc.setAttribute('height', 4); }
      if (dn) { p.hline.setAttribute('x1', BAND_SIDE); p.hline.setAttribute('x2', BAND_SIDE); p.hline.setAttribute('y1', 0); p.hline.setAttribute('y2', b.h); }
      else { p.hline.setAttribute('x1', 0); p.hline.setAttribute('x2', b.w); p.hline.setAttribute('y1', BAND_HEAD); p.hline.setAttribute('y2', BAND_HEAD); }
      p.col.setAttribute('transform', dn ? `translate(${BAND_SIDE - 34},0)` : `translate(${b.w - 34},0)`);
      p.colP.setAttribute('d', S.expanded.has(n.id) ? 'M6,24 h10' : 'M6,24 h10 M11,19 v10');
      const key = Math.round(dn ? b.h : b.w) + ':' + dn + ':' + S.expanded.has(n.id);
      if (g._k !== key) {
        g._k = key;
        const c = laneCounts(n.id); p.stat.innerHTML = '';
        const label = String(n.label).toUpperCase();
        p.idx.textContent = String(b.i + 1).padStart(2, '0');
        if (dn) {
          /* cabecera lateral: el texto va en horizontal, apilado — se lee sin girar la cabeza */
          const W = BAND_SIDE - 30;
          const words = label.split(' '); let l1 = '', l2 = '';
          for (const w0 of words) { if (!l2 && textW((l1 + ' ' + w0).trim(), 11.5, 700) + (l1 + w0).length * 1.4 <= W) l1 = (l1 + ' ' + w0).trim(); else l2 = (l2 + ' ' + w0).trim(); }
          p.idx.setAttribute('x', 16); p.idx.setAttribute('y', 26);
          p.title.setAttribute('x', 16); p.title.setAttribute('y', 46); p.title.textContent = fitText(l1, W - l1.length * 1.4, 11.5, 700);
          p.sub.setAttribute('x', 16); p.sub.setAttribute('y', 62); p.sub.setAttribute('class', 'gx-bandt'); p.sub.textContent = l2 ? fitText(l2, W - l2.length * 1.4, 11.5, 700) : '';
          const yS = l2 ? 80 : 64;
          p.sub2.setAttribute('y', yS); p.sub2.textContent = n.subtitle ? fitText(n.subtitle, W, 11, 400, true) : '';
          p.stat.setAttribute('transform', `translate(16,${yS + 18})`);
          if (b.h > yS + 30) {
            const put = (txt, cls, k) => { const t = s('text', { class: 'gx-bandsx ' + (cls || ''), x: 0, y: k * 16 }, p.stat); t.textContent = txt; };
            put(`${c.n} ${T.items}`, '', 0);
            if (c.a && b.h > yS + 46) put(`● ${c.a} ${T.bandAdd}`, 'a', 1);
            if (c.m && b.h > yS + 62) put(`● ${c.m} ${T.bandMod}`, 'm', 2);
          }
          return;
        }
        p.sub.setAttribute('class', 'gx-bandst'); p.sub2.textContent = '';
        p.idx.setAttribute('x', 20); p.idx.setAttribute('y', 29); p.title.setAttribute('y', 29); p.sub.setAttribute('x', 20); p.sub.setAttribute('y', 47);
        p.stat.setAttribute('transform', 'translate(20,60)');
        const room = b.w - 76;
        p.title.setAttribute('x', 46);
        p.title.textContent = fitText(label, room - label.length * 1.4, 11.5, 700);
        p.sub.textContent = n.subtitle ? fitText(n.subtitle, b.w - 40, 11, 400, true) : '';
        let x = 0;
        const put = (txt, cls) => { const t = s('text', { class: 'gx-bandsx ' + (cls || ''), x }, p.stat); t.textContent = txt; x += textW(txt, 10.5, 600) + 10; };
        if (room > 60) {
          put(`${c.n} ${T.items}`);
          if (c.a && x + 60 < b.w - 40) put(`● ${c.a} ${T.bandAdd}`, 'a');
          if (c.m && x + 60 < b.w - 40) put(`● ${c.m} ${T.bandMod}`, 'm');
        }
      }
    }

    /* --- render con transición --- */
    let busyTimer = null;
    async function relayout(o) {
      o = o || {};
      /* solo secuencia: no hay grafo que colocar, asi que ni se carga ELK */
      if (!graphTab) { if (o.after) o.after(); return; }
      const my = ++S.layoutId;
      hoverSet = null; hideTip();
      clearTimeout(busyTimer); busyTimer = setTimeout(() => busy.classList.add('on'), 180);
      const prevRects = S.rects;
      const { vis, vedges } = computeVisible();
      let L;
      try { L = await layout(vis, vedges); } catch (err) { busy.classList.remove('on'); clearTimeout(busyTimer); if (global.console) console.error(err); return; }
      clearTimeout(busyTimer); busy.classList.remove('on');
      if (my !== S.layoutId) return;
      const prevVisible = S.visible;
      const bands = computeBands(L);
      if (bands.length) {
        const x0 = Math.min(...bands.map(b => b.x)), x1 = Math.max(...bands.map(b => b.x + b.w));
        const y0 = Math.min(...bands.map(b => b.y)), y1 = Math.max(...bands.map(b => b.y + b.h));
        L.bbox = { x: x0 - 12, y: y0 - 12, w: x1 - x0 + 24, h: y1 - y0 + 24 };
      }
      const prevBands = new Map(S.bands.map(b => [b.id, b]));
      S.bands = bands;
      S.visible = vis; S.vedges = vedges; S.rects = L.rects; S.bbox = L.bbox;
      syncDepthUI();

      /* cámara: la pieza que se abre o se cierra se queda donde estaba en pantalla */
      let camTo = null;
      if (o.anchor && prevRects.has(o.anchor) && L.rects.has(o.anchor)) {
        const a = prevRects.get(o.anchor), b = L.rects.get(o.anchor);
        camTo = { k: S.cam.k, x: S.cam.x - (b.x - a.x) * S.cam.k, y: S.cam.y - (b.y - a.y) * S.cam.k };
      } else if (o.focus) camTo = camFor(bboxOf(o.focus.nodes, o.focus.edges) || L.bbox, o.pad);
      else if (o.fit || prevRects.size === 0) camTo = camFor(L.bbox);

      const items = [];
      const next = new Map();
      const order = [...vis].sort((a, b) => M.get(a).depth - M.get(b).depth);
      for (const id of order) {
        const n = M.get(id), r = L.rects.get(id); if (!r) continue;
        const kind = isGroup(id) ? 'group' : 'leaf';
        let el = S.els.get(id);
        if (el && el._kind !== kind) { fadeOut(el); el = null; }
        /* una forma se dibuja a su tamaño: si cambia (al girar el diagrama, la bifurcación se tumba),
           se rehace y se anima desde el rectángulo que ocupaba */
        let reshaped = null;
        if (el && el._shape && kind === 'leaf') { const z = leafSize(n); if (z.w !== el._sz.w || z.h !== el._sz.h) { reshaped = el._r; el.remove(); el = null; } }
        const fresh = !el;
        if (fresh) {
          el = kind === 'group' ? makeGroup(n) : makeLeaf(n);
          (kind === 'group' ? gGroups : gNodes).appendChild(el);
          bindNode(el, n.id);
        } else if (kind === 'group') gGroups.appendChild(el);
        next.set(id, el);
        let from = fresh ? null : el._r;
        if (fresh) {
          /* lo nuevo nace de su antepasado anterior: se lee como «se abre en su sitio» */
          const anc = [n.parent].concat(ancestors(M, id)).find(a => a != null && prevRects.has(a));
          const pr = prevRects.get(id) || (anc ? prevRects.get(anc) : null);
          from = pr ? { x: pr.x + pr.w / 2 - r.w * .3, y: pr.y + pr.h / 2 - r.h * .3, w: r.w * .6, h: r.h * .6 } : { x: r.x + r.w * .2, y: r.y + r.h * .2, w: r.w * .6, h: r.h * .6 };
          if (reshaped) from = reshaped; else el.style.opacity = 0;
        }
        items.push({ el, n, from, to: r, fresh: fresh && !reshaped, kind });
      }
      for (const [id, el] of S.els) {
        if (next.has(id) && next.get(id) === el) continue;
        if (!el.isConnected) continue;
        let p = M.get(id).parent; while (p != null && !L.rects.has(p)) p = M.get(p).parent;
        const target = p != null && isGroup(p) ? null : (p != null ? L.rects.get(p) : null);
        const from = el._r;
        if (target && from) items.push({ el, n: M.get(id), from, to: { x: target.x + target.w * .3, y: target.y + target.h * .3, w: from.w * .5, h: from.h * .5 }, dying: true, kind: el._kind });
        else fadeOut(el);
      }
      S.els = next;
      S.edgeEls.forEach(x => { x.g.classList.add('gx-out'); if (x.lab) x.lab.classList.add('gx-out'); setTimeout(() => { x.g.remove(); x.lab && x.lab.remove(); }, 180); });
      S.edgeEls = [];

      const bandItems = [];
      const nextBands = new Map();
      for (const b of bands) {
        let el = S.bandEls.get(b.id); const fresh = !el;
        if (fresh) { el = makeBand(M.get(b.id)); gBands.appendChild(el); el.style.opacity = 0; }
        nextBands.set(b.id, el);
        bandItems.push({ el, n: M.get(b.id), from: prevBands.get(b.id) || null, to: b, fresh });
      }
      for (const [id, el] of S.bandEls) if (!nextBands.has(id)) fadeOut(el);
      S.bandEls = nextBands;
      const fb = bands.length ? (() => { const L0 = bands[0], L1 = bands[bands.length - 1];
        return L0.down ? { x: L0.x, y: L0.y, w: L0.w, h: L1.y + L1.h - L0.y } : { x: L0.x, y: L0.y, w: L1.x + L1.w - L0.x, h: L0.h }; })() : null;
      const pf = S.frameBox || fb;
      S.frameBox = fb;
      frameR.style.display = fb ? '' : 'none';
      const camFrom = Object.assign({}, S.cam);
      await tween(t => {
        for (const it of bandItems) {
          const r = it.from ? lerpRect(it.from, it.to, t) : it.to;
          placeBand(it.el, Object.assign({}, it.to, r), it.n);
          if (it.fresh) it.el.style.opacity = t;
        }
        if (fb) {
          const f = pf ? lerpRect(pf, fb, t) : fb;
          [clipR, frameR].forEach(r => { r.setAttribute('x', f.x); r.setAttribute('y', f.y); r.setAttribute('width', f.w); r.setAttribute('height', f.h); });
        }
        for (const it of items) {
          const r = lerpRect(it.from || it.to, it.to, it.from ? t : 1);
          (it.kind === 'group' ? placeGroup : placeLeaf)(it.el, r, it.n);
          it.el._r = it.dying ? it.from : it.to;
          if (it.fresh) it.el.style.opacity = t;
          if (it.dying) it.el.style.opacity = 1 - t;
        }
        if (camTo) setCam(lerpCam(camFrom, camTo, t));
      }, (items.length ? dur : 0));
      items.forEach(it => { if (it.dying) it.el.remove(); else { it.el.style.opacity = ''; it.el._r = it.to; } });
      bandItems.forEach(it => { it.el.style.opacity = ''; });
      if (my !== S.layoutId) return;

      for (const v of vedges) {
        const p = L.paths.get(v.id); if (!p) continue;
        const e = makeEdge(v, p);
        gEdges.appendChild(e.g); if (e.lab) gLabels.appendChild(e.lab);
        bindEdge(e.g, v); if (e.lab) bindEdge(e.lab, v);
        if (!reduce) {
          e.g.classList.add('gx-in'); if (e.lab) e.lab.classList.add('gx-in');
          /* pathLength normaliza la longitud: el trazo se dibuja entero sea cual sea su tamaño */
          e.g._line.setAttribute('pathLength', '1');
          setTimeout(() => { e.g.classList.remove('gx-in'); e.g._line.removeAttribute('pathLength'); if (e.lab) e.lab.classList.remove('gx-in'); }, 700);
        }
        S.edgeEls.push(e);
      }
      applyHighlight();
      drawMini();
      if (o.after) o.after();
    }
    function fadeOut(el) { el.style.transition = 'opacity .18s'; el.style.opacity = 0; setTimeout(() => el.remove(), 200); }
    function tween(fn, ms) {
      return new Promise(res => {
        if (!ms) { fn(1); return res(); }
        const t0 = now();
        const step = () => { const t = clamp((now() - t0) / ms, 0, 1); fn(ease(t)); if (t < 1) raf(step); else res(); };
        raf(step);
      });
    }

    /* --- cámara --- */
    function setCam(c) { S.cam = c; world.setAttribute('transform', `translate(${c.x},${c.y}) scale(${c.k})`); drawMiniView(); drawSticky(); }
    /* Cuando la cabecera real sale de la vista (zoom o desplazamiento), su nombre queda
       fijado al borde del lienzo, en el tramo de pantalla que ocupa su carril. */
    function drawSticky() {
      if (!S.bands.length || S.view !== 'graph') { sticky.className = 'gx-sticky'; return; }
      const v = viewSize(), c = S.cam, dn = S.bands[0].down;
      const headOut = dn ? (S.bands[0].x + BAND_SIDE) * c.k + c.x < 6 : (S.bands[0].y + BAND_HEAD) * c.k + c.y < 6;
      sticky.className = 'gx-sticky' + (headOut ? ' on' : '') + (dn ? ' v' : '');
      if (!headOut) return;
      if (sticky._n !== S.bands.length || sticky._dn !== dn) {
        sticky.innerHTML = S.bands.map(b => `<button type="button" data-id="${esc(b.id)}"><b>${String(b.i + 1).padStart(2, '0')}</b><span>${esc(M.get(b.id).label)}</span></button>`).join('');
        sticky.querySelectorAll('button').forEach(el => el.onclick = ev => { ev.stopPropagation(); select(el.dataset.id); });
        sticky._n = S.bands.length; sticky._dn = dn;
      }
      [...sticky.children].forEach((el, i) => {
        const b = S.bands[i]; if (!b) return;
        const a = dn ? b.y * c.k + c.y : b.x * c.k + c.x, len = (dn ? b.h : b.w) * c.k;
        const lo = Math.max(a, 0), hi = Math.min(a + len, dn ? v.h : v.w);
        el.style.display = hi - lo > 26 ? '' : 'none';
        if (dn) { el.style.top = lo + 'px'; el.style.height = (hi - lo) + 'px'; el.style.left = ''; el.style.width = ''; }
        else { el.style.left = lo + 'px'; el.style.width = (hi - lo) + 'px'; el.style.top = ''; el.style.height = ''; }
        el.classList.toggle('lit', !!S.bandEls.get(b.id) && S.bandEls.get(b.id).classList.contains('lit'));
      });
    }
    const lerpCam = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), k: lerp(a.k, b.k, t) });
    function viewSize(el) { const r = (el || stage).getBoundingClientRect(); return { w: r.width || 900, h: r.height || 560 }; }
    function camFor(b, pad, el, maxK) {
      const v = viewSize(el);
      pad = pad != null ? pad : 36;
      /* el panel abierto tapa la derecha (o el fondo, en pantallas estrechas): se centra en lo que queda */
      const pOn = panel.classList.contains('on') && (!el || el === svg);
      const narrow = v.w < 720;
      const pr = pOn ? panel.getBoundingClientRect() : null;
      const reserve = pOn && !narrow ? Math.min((pr && pr.width ? pr.width + 20 : 380), v.w * .5) : 0;
      let bottom = S.present && S.tour >= 0 ? 150 : 0;
      if (pOn && narrow) bottom = Math.max(bottom, Math.min(pr && pr.height ? pr.height + 12 : v.h * .6, v.h * .7));
      const W = v.w - reserve, H = v.h - bottom;
      const k = clamp(Math.min((W - pad * 2) / Math.max(b.w, 1), (H - pad * 2) / Math.max(b.h, 1)), .12, maxK || 1.6);
      return { k, x: (W - b.w * k) / 2 - b.x * k, y: (H - b.h * k) / 2 - b.y * k };
    }
    function bboxOf(nodes, edges) {
      const R = [];
      (nodes || []).forEach(id => { const r = S.rects.get(repOf(id)); if (r) R.push(r); });
      (edges || []).forEach(id => { const v = vedgeOf(id); if (v) [v.from, v.to].forEach(x => { const r = S.rects.get(x); if (r) R.push(r); }); });
      if (!R.length) return null;
      const x0 = Math.min(...R.map(r => r.x)), y0 = Math.min(...R.map(r => r.y));
      const x1 = Math.max(...R.map(r => r.x + r.w)), y1 = Math.max(...R.map(r => r.y + r.h));
      const p = 40; return { x: x0 - p, y: y0 - p, w: x1 - x0 + 2 * p, h: y1 - y0 + 2 * p };
    }
    function animateCam(to, which) {
      const from = Object.assign({}, which === 'seq' ? S.seqCam : S.cam);
      return tween(t => (which === 'seq' ? setSeqCam : setCam)(lerpCam(from, to, t)), dur);
    }
    function zoomAt(f, cx, cy, which) {
      const c = which === 'seq' ? S.seqCam : S.cam;
      const k = clamp(c.k * f, .08, 3.2);
      const nc = { k, x: cx - (cx - c.x) * (k / c.k), y: cy - (cy - c.y) * (k / c.k) };
      (which === 'seq' ? setSeqCam : setCam)(nc);
    }

    /* --- interacción: pan, zoom, pinch --- */
    const ptrs = new Map(); let drag = null, pinch = null;
    const activeSvg = () => S.view === 'graph' ? svg : seqSvg;
    const which = () => S.view === 'graph' ? 'graph' : 'seq';
    /* En táctil y dentro de la página, un dedo desplaza la PÁGINA (touch-action: pan-y) y
       dos dedos mueven y amplían el diagrama. En Explorar o Presentar, un dedo ya es del lienzo. */
    const ownsOneFinger = () => S.present || S.expanded2;
    stage.addEventListener('pointerdown', ev => {
      S.touched = true;
      if (ev.pointerType !== 'touch') { S.engaged = true; host.classList.add('gx-engaged'); }
      if (ev.target.closest('.gx-panel,.gx-legend,.gx-mini,.gx-seqctl,.gx-sticky')) return;
      ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; drag = null; return;
      }
      if (ev.target.closest('.gx-node,.gx-ghead,.gx-bandhead,.gx-edge,.gx-elabel,.gx-seq-msg,.gx-seq-p,.gx-fpill')) return;
      if (ev.pointerType === 'touch' && !ownsOneFinger()) { touchHint(); return; }
      const c = which() === 'seq' ? S.seqCam : S.cam;
      drag = { x: ev.clientX, y: ev.clientY, cx: c.x, cy: c.y, moved: 0 };
      try { stage.setPointerCapture(ev.pointerId); } catch (_) { }
      stage.classList.add('gx-grab');
    });
    stage.addEventListener('pointermove', ev => {
      if (ptrs.has(ev.pointerId)) ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (pinch && ptrs.size === 2) {
        const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const r = stage.getBoundingClientRect();
        const c = which() === 'seq' ? S.seqCam : S.cam;
        (which() === 'seq' ? setSeqCam : setCam)({ k: c.k, x: c.x + mx - pinch.mx, y: c.y + my - pinch.my });
        zoomAt(d / pinch.d, mx - r.left, my - r.top, which()); pinch.d = d; pinch.mx = mx; pinch.my = my; return;
      }
      if (!drag) return;
      drag.moved = Math.max(drag.moved, Math.abs(ev.clientX - drag.x) + Math.abs(ev.clientY - drag.y));
      const c = which() === 'seq' ? S.seqCam : S.cam;
      (which() === 'seq' ? setSeqCam : setCam)({ k: c.k, x: drag.cx + ev.clientX - drag.x, y: drag.cy + ev.clientY - drag.y });
    });
    const endPtr = ev => {
      ptrs.delete(ev.pointerId); if (ptrs.size < 2) pinch = null;
      if (drag) { if (drag.moved < 4 && !ev.target.closest('.gx-node,.gx-ghead,.gx-edge,.gx-elabel,.gx-seq-msg,.gx-seq-p,.gx-panel')) clearSelection(); drag = null; stage.classList.remove('gx-grab'); }
    };
    stage.addEventListener('pointerup', endPtr); stage.addEventListener('pointercancel', endPtr);
    /* si la pieza bajo el puntero se sustituye al relayoutear, el navegador no emite su
       pointerleave y la vecindad se quedaría iluminada: se apaga al salir o al pasar por el fondo */
    stage.addEventListener('pointerleave', () => { if (hoverSet) { hideTip(); hoverLit(null); } });
    stage.addEventListener('pointerover', ev => {
      if (hoverSet && !(ev.target.closest && ev.target.closest('.gx-node,.gx-ghead,.gx-bandhead,.gx-edge,.gx-elabel,.gx-fpill'))) { hideTip(); hoverLit(null); }
    });
    stage.addEventListener('wheel', ev => {
      if (ev.target.closest && ev.target.closest('.gx-panel,.gx-legend,.gx-search-list,.gx-seqctl,.gx-sticky')) return;
      if (!(S.engaged || S.present || ev.ctrlKey || ev.metaKey)) { hint.classList.add('on'); clearTimeout(hint._t); hint._t = setTimeout(() => hint.classList.remove('on'), 1400); return; }
      ev.preventDefault();
      const r = stage.getBoundingClientRect();
      zoomAt(Math.exp(-ev.deltaY * (ev.ctrlKey ? .01 : .0018)), ev.clientX - r.left, ev.clientY - r.top, which());
    }, { passive: false });
    function touchHint() {
      hint.textContent = T.touchHint; hint.classList.add('on');
      clearTimeout(hint._t); hint._t = setTimeout(() => { hint.classList.remove('on'); hint.textContent = T.zoomHint; }, 1800);
    }
    const onDocDown = ev => { if (!host.contains(ev.target)) { S.engaged = false; host.classList.remove('gx-engaged'); } };
    document.addEventListener('pointerdown', onDocDown);

    /* --- hover, tooltip, selección --- */
    let tipTimer = null;
    function showTip(html, ev) {
      clearTimeout(tipTimer);
      tipTimer = setTimeout(() => { tip.innerHTML = html; tip.classList.add('on'); moveTip(ev); }, 110);
    }
    function moveTip(ev) {
      if (!ev) return;
      const r = stage.getBoundingClientRect(); const tw = tip.offsetWidth || 280, th = tip.offsetHeight || 120;
      let x = ev.clientX - r.left + 16, y = ev.clientY - r.top + 16;
      if (x + tw > r.width - 8) x = ev.clientX - r.left - tw - 16;
      if (y + th > r.height - 8) y = Math.max(8, ev.clientY - r.top - th - 12);
      tip.style.transform = `translate(${Math.max(8, x)}px,${Math.max(8, y)}px)`;
    }
    function hideTip() { clearTimeout(tipTimer); tip.classList.remove('on'); }
    const deltaPill = d => d && d !== 'unchanged' ? `<span class="gx-pill d-${d}">${esc(T.delta[d])}</span>` : HAS_DELTA ? `<span class="gx-pill">${esc(T.delta.unchanged)}</span>` : '';
    const kindLabel = k => (spec.legend && spec.legend.kinds && spec.legend.kinds[k]) || k;
    const nodePill = n => n.status ? `<span class="gx-pill gx-pst" style="--gx-pc:${statusCvar(n.status) || 'var(--gx-neu)'}">${esc(STATUSES[n.status].label || n.status)}</span>` : deltaPill(n.delta);
    const statTxt = st => st && (st.additions || st.deletions) ? `<span class="gx-add">+${st.additions}</span> <span class="gx-del">−${st.deletions}</span>${st.files ? ` · ${st.files} ${T.filesOf}` : ''}` : '';
    function nodeTip(n) {
      const deg = degreeOf(n.id);
      const sum = n.summary ? esc(n.summary.length > 220 ? n.summary.slice(0, 217) + '…' : n.summary) : '';
      return `<div class="gx-tip-h">${iconHTML(n.kind)}<b>${esc(n.label)}</b></div>
        <div class="gx-tip-m">${nodePill(n)}<span>${esc(kindLabel(n.kind))}</span>${n.laneId && !n.isLane ? `<span>${esc(M.get(n.laneId).label)}</span>` : ''}</div>
        ${sum ? `<p>${sum}</p>` : ''}
        ${(n.links || []).length ? `<div class="gx-tip-f">${(n.links || []).map(l => resolveLink(l, spec)).filter(Boolean).slice(0, 4).map(l => `<span>${iconHTML(IC[l.kind] ? l.kind : 'url')} ${esc(l.kind === 'node' ? (M.get(l.target) || {}).label || l.label : l.label)}</span>`).join('')}</div>` : ''}
        <div class="gx-tip-f">${statTxt(n.stat)}${deg ? `<span>${deg.out}↗ ${deg.in}↘</span>` : ''}${n.children.length ? `<span>${n.descendants} ${esc(T.items)}</span>` : ''}</div>
        <div class="gx-tip-k">${esc(T.clickHint)} · ${esc(T.dblHint)}${n.children.length && !S.expanded.has(n.id) ? ' · ' + esc(T.expHint) : ''}${n.stat && n.stat.files ? ' · ± ' + esc(T.openDiff).toLowerCase() : ''}</div>`;
    }
    function edgeTip(v) {
      const lines = v.list.slice(0, 5).map(e => `<li><b>${esc(M.get(e.from).label)}</b> → <b>${esc(M.get(e.to).label)}</b>${e.label ? ` · ${esc(e.label)}` : ''}</li>`).join('');
      const e0 = v.list[0];
      return `<div class="gx-tip-h"><b>${esc(M.get(v.from).label)} → ${esc(M.get(v.to).label)}</b></div>
        <div class="gx-tip-m">${deltaPill(v.delta)}<span>${esc(v.kind)}</span>${v.list.length > 1 ? `<span>${v.list.length} ${esc(T.connections)}</span>` : ''}</div>
        ${v.list.length === 1 ? `${e0.summary ? `<p>${esc(e0.summary)}</p>` : ''}${e0.data ? `<p><i>${esc(T.data)}:</i> ${esc(e0.data)}</p>` : ''}${e0.trigger ? `<p><i>${esc(T.trigger)}:</i> <code>${esc(e0.trigger)}</code></p>` : ''}`
          : `<ul>${lines}</ul>${v.list.length > 5 ? `<p>… +${v.list.length - 5}</p>` : ''}`}
        ${v.lifted ? `<div class="gx-tip-k">${esc(T.viaChildren)}</div>` : ''}`;
    }
    const iconHTML = k => `<svg class="gx-ic${ICFILL.has(k) ? ' fill' : ''}" viewBox="0 0 16 16" aria-hidden="true"><path d="${IC[k] || IC.other}"/></svg>`;
    function degreeOf(id) {
      const inside = new Set([id, ...descendantsOf(id)]);
      let out = 0, inn = 0;
      for (const e of G.edges) { const a = inside.has(e.from), b = inside.has(e.to); if (a && !b) out++; if (b && !a) inn++; }
      return out + inn ? { out, in: inn } : null;
    }
    function descendantsOf(id) { const out = []; const w = x => M.get(x).children.forEach(c => { out.push(c); w(c); }); w(id); return out; }

    function bindNode(el, id) {
      const target = el._kind === 'group' ? el._parts.head : el;
      target.addEventListener('pointerenter', ev => { if (S.tour >= 0 && S.present) return; hoverLit(id); showTip(nodeTip(M.get(id)), ev); });
      target.addEventListener('pointermove', moveTip);
      target.addEventListener('pointerleave', () => { hideTip(); hoverLit(null); });
      target.addEventListener('click', ev => { ev.stopPropagation(); if (ev.detail > 1) return; select(id); });
      target.addEventListener('dblclick', ev => { ev.stopPropagation(); focusNode(id); });
      target.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(id); } });
    }
    function bindEdge(el, v) {
      el.addEventListener('pointerenter', ev => { hoverLit(null, v); showTip(edgeTip(v), ev); });
      el.addEventListener('pointermove', moveTip);
      el.addEventListener('pointerleave', () => { hideTip(); hoverLit(null); });
      el.addEventListener('click', ev => { ev.stopPropagation(); selectEdge(v); });
    }

    /* --- iluminación: foco del paso, trazado, vecindad al pasar, filtro de cambios --- */
    let hoverSet = null;
    function hoverLit(id, v) {
      if (S.tour >= 0 || S.trace) { hoverSet = null; applyHighlight(); return; }
      if (!id && !v) { hoverSet = null; applyHighlight(); return; }
      const nodes = new Set(), edges = new Set();
      if (v) { nodes.add(v.from); nodes.add(v.to); edges.add(v.id); }
      else {
        nodes.add(id);
        for (const e of S.vedges) if (e.from === id || e.to === id) { edges.add(e.id); nodes.add(e.from); nodes.add(e.to); }
      }
      hoverSet = { nodes, edges }; applyHighlight();
    }
    let stepSet = null;
    function applyHighlight() {
      const set = hoverSet || S.trace || stepSet;
      world.classList.toggle('gx-dim', !!set);
      for (const [id, el] of S.els) {
        const lit = set ? (set.nodes.has(id) || (isGroup(id) && [...set.nodes].some(x => isAncestor(M, id, x)))) : false;
        el.classList.toggle('lit', lit);
        el.classList.toggle('sel', S.selected === id);
        el.classList.toggle('faded', S.onlyChanges && M.get(id).delta === 'unchanged' && !isGroup(id));
      }
      for (const [id, el] of S.bandEls) {
        const lit = set ? [...set.nodes].some(x => x === id || isAncestor(M, id, x)) : false;
        el.classList.toggle('lit', lit); el.classList.toggle('sel', S.selected === id);
      }
      for (const x of S.edgeEls) {
        const v = x.g._v;
        const lit = set ? set.edges.has(v.id) : false;
        x.g.classList.toggle('lit', lit); if (x.lab) x.lab.classList.toggle('lit', lit);
        markEdge(x.g._line, v, lit);
        const faded = S.onlyChanges && v.delta === 'unchanged';
        x.g.classList.toggle('faded', faded); if (x.lab) x.lab.classList.toggle('faded', faded);
        x.g.classList.toggle('sel', S.selected === v.id);
      }
    }
    const repOf = id => { let x = id; while (x != null && !S.visible.has(x)) x = M.get(x) ? M.get(x).parent : null; return x; };
    function vedgeOf(eid) {
      const e = G.edges.find(x => x.id === eid); if (!e) return null;
      return S.vedges.find(v => v.list.includes(e)) || null;
    }
    function setFocusSet(nodes, edges) {
      if (!nodes && !edges) { stepSet = null; applyHighlight(); return; }
      const N = new Set(), E = new Set();
      (nodes || []).forEach(id => { const r = repOf(id); if (r) N.add(r); });
      (edges || []).forEach(id => { const v = vedgeOf(id); if (v) { E.add(v.id); N.add(v.from); N.add(v.to); } });
      if (!edges || !edges.length) for (const v of S.vedges) if (N.has(v.from) && N.has(v.to)) E.add(v.id);
      stepSet = { nodes: N, edges: E }; applyHighlight();
    }

    /* --- trazado transitivo sobre el grafo completo, mapeado a lo visible --- */
    function trace(id, dir) {
      const inside = new Set([id, ...descendantsOf(id)]);
      const reach = new Set(inside), es = new Set(), q = [...inside];
      while (q.length) {
        const x = q.shift();
        for (const e of G.edges) {
          const [a, b] = dir === 'down' ? [e.to, e.from] : [e.from, e.to];
          if (a === x && !reach.has(b)) { reach.add(b); q.push(b); es.add(e.id); } else if (a === x) es.add(e.id);
        }
      }
      const N = new Set(), E = new Set();
      reach.forEach(x => { const r = repOf(x); if (r) N.add(r); });
      es.forEach(eid => { const v = vedgeOf(eid); if (v) E.add(v.id); });
      S.trace = { nodes: N, edges: E, id, dir }; hoverSet = null; applyHighlight(); renderPanel();
    }

    /* --- panel de detalle --- */
    function select(id) {
      if (S.view !== 'graph') showView('graph');
      S.selected = id; S.trace = null; hideTip(); renderPanel(); applyHighlight();
    }
    function selectEdge(v) { S.selected = v.id; S.selEdge = v; S.trace = null; hideTip(); renderPanel(); applyHighlight(); }
    function clearSelection() { if (!S.selected && !S.trace) return; S.selected = null; S.selEdge = null; S.trace = null; panel.classList.remove('on'); applyHighlight(); }
    const prFilesURL = spec.links && spec.links.repo && spec.links.pr ? `https://github.com/${spec.links.repo}/pull/${spec.links.pr}/files` : null;
    const churn = f => (f.additions || 0) + (f.deletions || 0);
    function filesUnder(id) {
      const map = new Map();
      const add = nid => (M.get(nid).files || []).forEach(f => { if (!map.has(f.path)) map.set(f.path, { f, owners: [] }); map.get(f.path).owners.push(nid); });
      if (id == null) for (const n of M.values()) add(n.id); else { add(id); descendantsOf(id).forEach(add); }
      return [...map.values()].sort((a, b) => churn(b.f) - churn(a.f) || a.f.path.localeCompare(b.f.path));
    }
    /* El ancla del diff de un fichero en la PR es sha256 de su ruta. Si el JSON no la trae
       (no se ensambló con --git), se calcula aquí con WebCrypto. */
    const allFileObjs = () => [...M.values()].flatMap(n => n.files || []);
    const diffReady = (async () => {
      if (!prFilesURL || !(global.crypto && crypto.subtle && global.TextEncoder)) return;
      const pending = allFileObjs().filter(f => !f.diff_url && (churn(f) || f.additions == null));
      for (const f of pending) {
        try {
          const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(f.path));
          f.diff_url = prFilesURL + '#diff-' + [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('');
        } catch (_) { return; }
      }
      if (pending.length) { S.els.forEach(el => el._syncPill && el._syncPill()); if (panel.classList.contains('on')) renderPanel(); }
    })();
    const ghURL = f => f.url || (spec.links && spec.links.repo && spec.links.sha ? `https://github.com/${spec.links.repo}/blob/${spec.links.sha}/${f.path}${f.lines ? '#L' + String(f.lines).replace('-', '-L') : ''}` : null);
    function filesHTML(files, opts) {
      opts = opts || {};
      if (!files || !files.length) return '';
      const rowsOf = list => list.map(item => {
        const f = item.f || item, owners = item.owners || [];
        const tot = (f.additions || 0) + (f.deletions || 0), n = 5;
        const ga = tot ? Math.round(n * (f.additions || 0) / tot) : 0;
        const sq = Array.from({ length: n }, (_, i) => `<i class="${i < ga ? 'a' : (tot ? 'd' : '')}"></i>`).join('');
        const u = ghURL(f), du = f.diff_url;
        const own = opts.owners && owners.length ? `<span class="gx-fown">${esc(T.inNodes)} ${owners.slice(0, 3).map(o => `<button type="button" class="gx-link" data-go="${esc(o)}">${esc(M.get(o).label)}</button>`).join(', ')}${owners.length > 3 ? ` +${owners.length - 3}` : ''}</span>` : '';
        const name = `<code title="${esc(f.path)}">${esc(f.path.split('/').slice(-2).join('/'))}${f.lines ? `<small>:${esc(f.lines)}</small>` : ''}</code>`;
        return `<li class="${tot ? 'chg' : ''}">${du ? `<a class="gx-fname" href="${esc(du)}" target="_blank" rel="noopener" title="${esc(T.openDiff)}: ${esc(f.path)}">${name}</a>` : name}
          <span class="gx-fstat">${tot ? `<span class="gx-add">+${f.additions || 0}</span><span class="gx-del">−${f.deletions || 0}</span><span class="gx-sq">${sq}</span>` : ''}</span>
          <span class="gx-flinks">${du ? `<a class="gx-diffb" href="${esc(du)}" target="_blank" rel="noopener">${esc(T.diffOpen)}</a>` : ''}${u ? `<a href="${esc(u)}" target="_blank" rel="noopener" title="blob">↗</a>` : ''}</span>${own}</li>`;
      }).join('');
      const chg = files.filter(x => churn(x.f || x)), ctx = files.filter(x => !churn(x.f || x));
      const tot = chg.reduce((a, x) => [a[0] + ((x.f || x).additions || 0), a[1] + ((x.f || x).deletions || 0)], [0, 0]);
      const head = `<h4 id="${I}-files">${esc(opts.title || T.files)} · ${chg.length}${tot[0] + tot[1] ? ` <span class="gx-add">+${tot[0]}</span> <span class="gx-del">−${tot[1]}</span>` : ''}</h4>`;
      return head + (chg.length ? `<ul class="gx-files">${rowsOf(chg)}</ul>` : '')
        + (ctx.length ? `<details class="gx-ctxfiles"${chg.length ? '' : ' open'}><summary>${esc(T.unchangedFiles)} · ${ctx.length}</summary><ul class="gx-files">${rowsOf(ctx)}</ul></details>` : '')
        + (prFilesURL && opts.prLink ? `<p><a class="gx-btn gx-prlink" href="${esc(prFilesURL)}" target="_blank" rel="noopener">${esc(T.allChanges)} ↗</a></p>` : '');
    }
    function linksHTML(list, withOwners) {
      const items = (list || []).map(x => ({ l: resolveLink(x.l || x, spec), owner: x.owner })).filter(x => x.l);
      if (!items.length) return '';
      const ext = items.filter(x => x.l.kind !== 'node'), rel = items.filter(x => x.l.kind === 'node' && M.has(x.l.target));
      /* enlaces compactos: icono pegado al identificador, el estado como color y la nota en el tooltip */
      const chip = ({ l, owner }) => {
        const k = LINK_ICON[l.kind] || 'url', st = STATUS_CLASS(l.status);
        const tip = [T.linkKinds[l.kind] || l.kind, l.label, l.status, l.note, withOwners && owner ? `${T.inNodes} ${M.get(owner).label}` : ''].filter(Boolean).join(' · ');
        const ic = k === 'gh' ? `<svg class="gx-ic fill" viewBox="0 0 16 16" aria-hidden="true"><path d="${GH}"/></svg>` : iconHTML(IC[k] ? k : 'url');
        return `<a class="gx-lchip k-${esc(k)}${st ? ' s-' + st : ''}" href="${esc(l.url)}" target="_blank" rel="noopener" title="${esc(tip)}">${ic}<span>${esc(l.label)}</span>${st ? '<i></i>' : ''}</a>`;
      };
      const rli = ({ l }) => `<li><button type="button" class="gx-link" data-go="${esc(l.target)}">${iconHTML(M.get(l.target).kind)}${esc(M.get(l.target).label)}</button>${l.note ? `<span>${esc(l.note)}</span>` : ''}</li>`;
      return (ext.length ? `<h4>${esc(T.links)} · ${ext.length}</h4><div class="gx-lchips">${ext.map(chip).join('')}</div>` : '')
        + (rel.length ? `<h4>${esc(T.related)}</h4><ul class="gx-conn">${rel.map(rli).join('')}</ul>` : '');
    }
    function connList(id) {
      const inside = new Set([id, ...descendantsOf(id)]);
      const out = [], inn = [];
      for (const e of G.edges) { const a = inside.has(e.from), b = inside.has(e.to); if (a && !b) out.push(e); else if (b && !a) inn.push(e); }
      const li = (e, other) => `<li><button type="button" class="gx-link" data-go="${esc(other)}">${iconHTML(M.get(other).kind)}${esc(M.get(other).label)}</button>${e.label ? `<span>${esc(e.label)}</span>` : ''}${e.delta !== 'unchanged' ? `<span class="gx-pill d-${e.delta}">${esc(T.delta[e.delta])}</span>` : ''}</li>`;
      /* plegadas por defecto: con muchas conexiones empujaban el resto del panel fuera de la vista */
      const fold = (t, list, f) => `<details class="gx-fold"><summary>${esc(t)} <b>${list.length}</b></summary><ul class="gx-conn">${list.map(f).join('')}</ul></details>`;
      return (out.length ? fold(T.outgoing, out, e => li(e, e.to)) : '') + (inn.length ? fold(T.incoming, inn, e => li(e, e.from)) : '');
    }
    /* los pasos que nombran la pieza: solo el número, con el título en el tooltip */
    function stepsHTML(list) {
      if (!list || !list.length) return '';
      return `<div class="gx-steps-r" aria-label="${esc(T.stepsHere)}"><span class="gx-steps-k" title="${esc(T.stepsHere)}">▶ ${esc(T.inTour)}</span>${list.map(i => `<button type="button" class="gx-stepn" data-step="${i}" data-tip="${esc(G.steps[i].title || '')}" aria-label="${esc(T.step)} ${i + 1}: ${esc(G.steps[i].title || '')}">${i + 1}</button>`).join('')}</div>`;
    }
    function renderPanel() {
      const id = S.selected;
      if (!id) { panel.classList.remove('on'); return; }
      let html = '';
      if (id === '__files__') {
        const all = filesUnder(null);
        html = `<header><div class="gx-ph">${iconHTML('file')}${esc(T.changedFiles)}</div>${spec.links && spec.links.pr ? `<div class="gx-tip-m"><span>PR #${esc(spec.links.pr)}</span><span>${esc(spec.links.repo || '')}</span></div>` : ''}</header>`
          + linksHTML((spec.links && spec.links.related || []).map(l => ({ l })))
          + linksHTML([...M.values()].flatMap(n => (n.links || []).filter(l => l.kind !== 'node').map(l => ({ l, owner: n.id }))), true)
          + filesHTML(all, { owners: true, prLink: true, title: T.files });
      } else if (S.selEdge && S.selEdge.id === id) {
        const v = S.selEdge;
        html = `<header><div class="gx-ph">${esc(M.get(v.from).label)} <span>→</span> ${esc(M.get(v.to).label)}</div>${deltaPill(v.delta)}</header>`
          + v.list.map(e => `<section class="gx-pe"><div class="gx-pe-h"><button type="button" class="gx-link" data-go="${esc(e.from)}">${esc(M.get(e.from).label)}</button> → <button type="button" class="gx-link" data-go="${esc(e.to)}">${esc(M.get(e.to).label)}</button></div>
              ${e.label ? `<div class="gx-pe-l">${esc(e.label)} · <i>${esc(e.kind)}</i></div>` : ''}
              ${e.summary ? `<p>${esc(e.summary)}</p>` : ''}${e.data ? `<p><b>${esc(T.data)}.</b> ${esc(e.data)}</p>` : ''}${e.trigger ? `<p><b>${esc(T.trigger)}.</b> <code>${esc(e.trigger)}</code></p>` : ''}
              ${linksHTML(e.links)}${stepsHTML(G.edgeSteps.get(e.id))}</section>`).join('');
      } else {
        const n = M.get(id); if (!n) return;
        const crumbs = ancestors(M, id).reverse().map(a => `<button type="button" class="gx-link" data-go="${esc(a)}">${esc(M.get(a).label)}</button>`).join('<span>›</span>');
        const kids = n.children.length ? `<h4>${esc(T.children)} · ${n.children.length}</h4><ul class="gx-kids">${n.children.map(c => `<li><button type="button" class="gx-link" data-go="${esc(c)}">${iconHTML(M.get(c).kind)}${esc(M.get(c).label)}</button>${M.get(c).delta !== 'unchanged' ? `<span class="gx-pill d-${M.get(c).delta}">${esc(T.delta[M.get(c).delta])}</span>` : ''}</li>`).join('')}</ul>` : '';
        const notes = n.notes && n.notes.length ? `<h4>${esc(T.notes)}</h4>${n.notes.map(x => `<div class="gx-note ${esc(x.tone || 'warn')}">${x.html || esc(x.text || '')}</div>`).join('')}` : '';
        const metrics = n.metrics && n.metrics.length ? `<dl class="gx-metrics">${n.metrics.map(m => `<div><dt>${esc(m.label)}</dt><dd>${esc(m.value)}</dd></div>`).join('')}</dl>` : '';
        const tr = S.trace && S.trace.id === id;
        html = `<header>${crumbs ? `<nav class="gx-crumbs">${crumbs}</nav>` : ''}<div class="gx-ph">${iconHTML(n.kind)}${esc(n.label)}</div>
            <div class="gx-tip-m">${n.isLane ? `<span>${esc(T.lane)}</span>` : nodePill(n) + `<span>${esc(kindLabel(n.kind))}</span>`}${statTxt(n.stat) ? `<span>${statTxt(n.stat)}</span>` : ''}</div>
            ${n.subtitle ? `<code class="gx-psub">${esc(n.subtitle)}</code>` : ''}</header>
          <div class="gx-pact">
            ${n.children.length ? `<button type="button" class="gx-btn" data-act="toggle" title="${esc(S.expanded.has(id) ? T.collapse : T.expand)}">${S.expanded.has(id) ? '⊖' : '⊕'}</button>` : ''}
            <button type="button" class="gx-btn" data-act="center" title="${esc(T.center)}">◎ ${esc(T.center)}</button>
            <button type="button" class="gx-btn${tr && S.trace.dir === 'up' ? ' on' : ''}" data-act="up" title="${esc(T.upstream)}">⟵ ${esc(T.upShort)}</button>
            <button type="button" class="gx-btn${tr && S.trace.dir === 'down' ? ' on' : ''}" data-act="down" title="${esc(T.downstream)}">${esc(T.downShort)} ⟶</button>
            ${tr ? `<button type="button" class="gx-btn" data-act="untrace" title="${esc(T.clearTrace)}">✕</button>` : ''}
          </div>
          ${n.summary ? `<p class="gx-psum">${esc(n.summary)}</p>` : ''}${n.details_html || ''}${metrics}${notes}
          ${linksHTML(n.links)}${filesHTML(n.children.length ? filesUnder(id) : (n.files || []), { owners: n.children.length > 0, prLink: false })}${stepsHTML(G.nodeSteps.get(id))}${connList(id)}${kids}`;
      }
      panel.innerHTML = `<button type="button" class="gx-x" aria-label="${esc(T.close)}">×</button><div class="gx-pbody">${html}</div>`;
      panel.classList.add('on');
      panel.querySelector('.gx-x').onclick = clearSelection;
      panel.querySelectorAll('[data-go]').forEach(b => b.onclick = () => reveal(b.dataset.go));
      if (S.scrollFiles) { S.scrollFiles = false; const hf = panel.querySelector(`#${I}-files`); if (hf) setTimeout(() => { if (panel.scrollTo) panel.scrollTo({ top: hf.offsetTop - 12, behavior: reduce ? 'auto' : 'smooth' }); else panel.scrollTop = hf.offsetTop - 12; }, 30); }
      panel.querySelectorAll('[data-step]').forEach(b => b.onclick = () => goStep(+b.dataset.step));
      panel.querySelectorAll('.gx-stepn').forEach(b => {
        b.onpointerenter = ev => showTip(`<div class="gx-tip-h"><b>${esc(T.step)} ${+b.dataset.step + 1}</b></div><p>${esc(b.dataset.tip)}</p>`, ev);
        b.onpointermove = moveTip; b.onpointerleave = hideTip;
      });
      panel.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
        const a = b.dataset.act;
        if (a === 'toggle') toggle(id);
        if (a === 'center') animateCam(camFor(bboxOf([id]) || S.bbox, 60));
        if (a === 'up' || a === 'down') trace(id, a);
        if (a === 'untrace') { S.trace = null; applyHighlight(); renderPanel(); }
      });
    }

    /* --- navegación --- */
    function focusNode(id) {
      if (S.selected !== id) select(id);
      const b = bboxOf([id]); if (!b) return;
      const r = S.rects.get(repOf(id));
      /* una tarjeta se acerca hasta leerse cómoda; un contenedor se encuadra entero */
      return animateCam(camFor(b, r && r.w > 400 ? 40 : 70, null, r && r.w > 400 ? 1.6 : 1.35));
    }
    function toggle(id) {
      const n = M.get(id); if (!n || !n.children.length) return;
      if (S.expanded.has(id)) { S.expanded.delete(id); descendantsOf(id).forEach(d => S.expanded.delete(d)); }
      else S.expanded.add(id);
      hideTip(); hoverSet = null;
      return relayout({ anchor: id, after: () => { if (S.selected === id) renderPanel(); } });
    }
    async function reveal(id, noSelect) {
      if (!M.has(id)) return;
      if (S.view !== 'graph') showView('graph');
      let changed = false;
      ancestors(M, id).forEach(a => { if (!S.expanded.has(a)) { S.expanded.add(a); changed = true; } });
      if (changed) await relayout({});
      if (!noSelect) select(id);
      await animateCam(camFor(bboxOf([id]) || S.bbox, 80));
    }

    /* --- búsqueda --- */
    const index = [...M.values()].map(n => ({ id: n.id, key: fold([n.label, n.id, n.subtitle, (n.tags || []).join(' ')].join(' ')), n }));
    let hits = [], hitI = 0;
    searchIn.addEventListener('input', () => {
      const q = fold(searchIn.value.trim());
      if (!q) { searchList.classList.remove('on'); return; }
      hits = index.filter(x => x.key.includes(q)).slice(0, 8); hitI = 0;
      searchList.innerHTML = hits.length ? hits.map((x, i) => `<button type="button" class="${i === 0 ? 'on' : ''}" data-go="${esc(x.id)}">${iconHTML(x.n.kind)}<span><b>${esc(x.n.label)}</b><small>${esc(ancestors(M, x.id).reverse().map(a => M.get(a).label).join(' › '))}</small></span></button>`).join('') : `<div class="gx-nomatch">${esc(T.noMatch)}</div>`;
      searchList.classList.add('on');
      searchList.querySelectorAll('[data-go]').forEach(b => b.onmousedown = ev => { ev.preventDefault(); pickHit(b.dataset.go); });
    });
    searchIn.addEventListener('keydown', ev => {
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault(); if (!hits.length) return;
        hitI = (hitI + (ev.key === 'ArrowDown' ? 1 : hits.length - 1)) % hits.length;
        searchList.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i === hitI));
      } else if (ev.key === 'Enter' && hits[hitI]) { ev.preventDefault(); pickHit(hits[hitI].id); }
      else if (ev.key === 'Escape') { searchIn.value = ''; searchList.classList.remove('on'); }
      ev.stopPropagation();
    });
    searchIn.addEventListener('blur', () => setTimeout(() => searchList.classList.remove('on'), 120));
    function pickHit(id) { searchList.classList.remove('on'); searchIn.value = ''; searchIn.blur(); reveal(id); }

    /* --- filtros, leyenda, ajustar --- */
    const syncDir = () => { bDir.innerHTML = S.dir === 'down' ? '↧' : '↦'; bDir.title = `${T.orient}: ${S.dir === 'down' ? '↓' : '→'}`; };
    syncDir();
    bDir.onclick = () => { S.dir = S.dir === 'down' ? 'right' : 'down'; syncDir(); S.frameBox = null; relayout({ fit: true }); };
    bFiles.onclick = () => { if (S.selected === '__files__') return clearSelection(); S.selected = '__files__'; S.selEdge = null; S.trace = null; renderPanel(); applyHighlight(); };
    const nChanged = filesUnder(null).filter(x => churn(x.f)).length;
    bFiles.innerHTML = `${esc(T.filesBtn)} <b>${nChanged}</b>`;
    if (!filesUnder(null).length) bFiles.style.display = 'none';
    bFrames.onclick = () => {
      S.frames = !S.frames; bFrames.classList.toggle('on', S.frames); host.classList.toggle('gx-framed', framed());
      S.frameBox = null; relayout({ fit: true });
    };
    bOnly.onclick = () => { S.onlyChanges = !S.onlyChanges; bOnly.classList.toggle('on', S.onlyChanges); applyHighlight(); };
    const kindsUsed = [...new Set([...M.values()].filter(n => !n.isLane).map(n => n.kind))];
    const LG = spec.legend || {};
    const swatches = Object.keys(STATUSES).length
      ? Object.entries(STATUSES).map(([k, v]) => `<li><i class="gx-lg-sw on" style="--gx-pc:${statusCvar(k) || 'var(--gx-neu)'}"></i>${esc(v.label || k)}</li>`).join('')
      : (LG.delta === false || (!HAS_DELTA && LG.delta !== true)) ? '' : ['added', 'modified', 'removed', 'unchanged'].map(d => `<li><i class="gx-lg-sw d-${d}"></i>${esc(T.delta[d])}</li>`).join('');
    const EST = { solid: '', dashed: ' dashed', hero: ' hero', flow: ' flow', muted: ' muted' };
    const edgeRows = Array.isArray(LG.edges) && LG.edges.length
      ? LG.edges.map(e => { const cv = colorVar(e.color); return `<li><svg viewBox="0 0 36 10"><path class="gx-lg-e${EST[e.style] || ''}" d="M2 5h32"${cv ? ` style="stroke:${cv}"` : ''}/></svg>${esc(e.label || '')}</li>`; }).join('')
      : `<li><svg viewBox="0 0 36 10"><path class="gx-lg-e" d="M2 5h32"/></svg>${esc(T.edgeKinds.sync)}</li>
      <li><svg viewBox="0 0 36 10"><path class="gx-lg-e dashed" d="M2 5h32"/></svg>${esc(T.edgeKinds.async)}</li>
      <li><svg viewBox="0 0 36 10"><path class="gx-lg-e hero" d="M2 5h32"/></svg>${esc(T.edgeKinds.hero)}</li>
      <li><svg viewBox="0 0 36 10"><path class="gx-lg-e flow" d="M2 5h32"/></svg>${esc(T.edgeKinds.animated)}</li>`;
    legend.innerHTML = `<h4>${esc(T.legend)}</h4>${swatches ? `<ul>${swatches}</ul>` : ''}<ul>
      ${edgeRows}
      <li><span class="gx-lg-agg">+2</span>${esc(T.edgeKinds.agg)}</li></ul><ul class="gx-lg-k">
      ${kindsUsed.map(k => `<li>${iconHTML(k)}${esc(kindLabel(k))}</li>`).join('')}</ul>`;
    bLegend.onclick = () => { legend.classList.toggle('on'); bLegend.classList.toggle('on', legend.classList.contains('on')); };
    bFit.onclick = () => S.view === 'graph' ? animateCam(camFor(S.bbox)) : animateCam(camFor(S.seq.bbox, 30, seqSvg), 'seq');

    /* --- minimapa --- */
    const miniWorld = s('g', null, miniSvg), miniView = s('rect', { class: 'gx-mini-v' }, miniSvg);
    function drawMini() {
      if (!S.bbox) return;
      miniWorld.innerHTML = '';
      const b = S.bbox; miniSvg.setAttribute('viewBox', `${b.x} ${b.y} ${b.w} ${b.h}`);
      S.bands.forEach(bd => s('rect', { x: bd.x, y: bd.y, width: bd.w, height: bd.h, class: 'gx-mini-band' + (bd.i % 2 ? ' alt' : '') }, miniWorld));
      for (const [id, r] of S.rects) {
        const n = M.get(id);
        const mr = s('rect', { x: r.x, y: r.y, width: r.w, height: r.h, rx: isGroup(id) ? 14 : 8, class: `gx-mini-n ${isGroup(id) ? 'grp' : ''} d-${n.delta}${n.isLane ? ' lane' : ''}` }, miniWorld);
        paint(mr, n.cvar);
      }
      drawMiniView();
    }
    function drawMiniView() {
      if (!S.bbox) return;
      const v = viewSize(), c = S.cam;
      miniView.setAttribute('x', -c.x / c.k); miniView.setAttribute('y', -c.y / c.k);
      miniView.setAttribute('width', v.w / c.k); miniView.setAttribute('height', v.h / c.k);
      miniView.setAttribute('stroke-width', Math.max(S.bbox.w, S.bbox.h) / 90);
    }
    mini.addEventListener('pointerdown', ev => {
      const go = e2 => {
        const r = miniSvg.getBoundingClientRect(), b = S.bbox, v = viewSize();
        const sc = Math.max(b.w / r.width, b.h / r.height);
        const wx = b.x + (e2.clientX - r.left - (r.width - b.w / sc) / 2) * sc, wy = b.y + (e2.clientY - r.top - (r.height - b.h / sc) / 2) * sc;
        setCam({ k: S.cam.k, x: v.w / 2 - wx * S.cam.k, y: v.h / 2 - wy * S.cam.k });
      };
      go(ev); ev.stopPropagation();
      const mv = e2 => go(e2), up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); };
      document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
    });

    /* --- vista de secuencia --- */
    function setSeqCam(c) { S.seqCam = c; seqWorld.setAttribute('transform', `translate(${c.x},${c.y}) scale(${c.k})`); }
    /* los mensajes que dibujan algo en la secuencia (no marcos, notas ni activaciones) */
    const isMsg = m => m.from != null && m.to != null && !SEQ_META[m.kind];
    function renderFlow(f) {
      seqWorld.innerHTML = '';
      const P = f.participants.filter(p => M.has(p.node));
      const lab = p => p.label || M.get(p.node).label;
      const overOf = m => [].concat(m.over == null ? [] : m.over).filter(id => typeof id === 'string');
      if (!P.length) { S.seq = { f, msgEls: [], frames: [], bbox: { x: 0, y: 0, w: 400, h: 200 }, X: new Map() }; seqCtl.innerHTML = ''; return; }
      const colW = Math.max(170, ...P.map(p => textW(lab(p), 13, 600) + 76));
      const X = new Map(); P.forEach((p, i) => X.set(p.node, 40 + colW / 2 + i * (colW + 26)));
      /* cabecera: tarjeta o, si el participante tiene forma (actor, base de datos, cola), su forma */
      /* con forma, la cabecera se mide con la etiqueta del participante (puede no ser la de la pieza) */
      const heads = P.map(p => {
        const n0 = M.get(p.node);
        if (!hasShape(n0)) return { n: n0, h: 56 };
        if (!p.label || p.label === n0.label) { const cl = shapeLayout(n0); return { n: n0, h: cl.h, cl }; }
        const n = Object.assign({}, n0, { label: p.label }), lay = SHP.measure(n, shapeCtx);
        return { n, h: lay.h, cl: { w: lay.w, h: lay.h, lay } };
      });
      const headH = Math.max(56, ...heads.map(x => x.h));
      const rowH = 54, top = headH + 40;
      let y = top; const rows = [];
      const noteLines = m => { const ov = overOf(m).filter(id => X.has(id)); return wrapLines(m.label, m.side === 'over' && ov.length > 1 ? Math.max(Math.abs(X.get(ov[ov.length - 1]) - X.get(ov[0])) + 60, 180) : 190, 12); };
      f.messages.forEach(m => {
        if (m.kind === 'phase') { rows.push({ m, y: y + 6 }); y += 40; return; }
        if (m.kind === 'block') { rows.push({ m, y: y + 4 }); y += 34; return; }
        if (m.kind === 'else') { rows.push({ m, y: y + 6 }); y += 30; return; }
        if (m.kind === 'end') { rows.push({ m, y: y + 2 }); y += 16; return; }
        if (m.kind === 'activate' || m.kind === 'deactivate') { rows.push({ m, y }); return; }
        if (m.kind === 'note') { const L = noteLines(m); rows.push({ m, y: y + 6, lines: L }); y += L.length * 15 + 30; return; }
        const hh = rowH + (m.note ? 22 : 0) + (m.kind === 'self' ? 14 : 0); rows.push({ m, y: y + 18 }); y += hh;
      });
      const H = y + 30, W = 40 + P.length * (colW + 26) + 180;
      const xs = ids => ids.filter(id => X.has(id)).map(id => X.get(id));
      /* marcos: de su fila de inicio a su `end`, tan anchos como los participantes que tocan */
      const frames = [], open = [];
      rows.forEach((r, i) => {
        const m = r.m;
        if (m.kind === 'block') open.push({ m, y0: r.y, depth: open.length, elses: [], xs: [], ids: [] });
        else if (m.kind === 'else' && open.length) open[open.length - 1].elses.push(r);
        else if (m.kind === 'end' && open.length) { const fr = open.pop(); fr.y1 = r.y + 8; frames.push(fr); if (open.length) { open[open.length - 1].xs.push(...fr.xs); } }
        else if (isMsg(m)) open.forEach(fr => { fr.xs.push(X.get(m.from), X.get(m.to)); fr.ids.push(m.id); if (m.kind === 'self' || m.from === m.to) fr.xs.push(X.get(m.from) + 70); });
        else if (m.kind === 'note') open.forEach(fr => fr.xs.push(...xs(overOf(m))));
      });
      open.forEach(fr => { fr.y1 = H - 24; frames.push(fr); });
      const gfr = s('g', { class: 'gx-seq-frames' }, seqWorld);
      frames.sort((a, b) => a.depth - b.depth).forEach(fr => {
        const vx = fr.xs.filter(v => v != null && !isNaN(v));
        const x0 = (vx.length ? Math.min(...vx) : X.get(P[0].node)) - colW * .42 + fr.depth * 8;
        const x1 = (vx.length ? Math.max(...vx) : X.get(P[P.length - 1].node)) + colW * .42 - fr.depth * 8;
        const g = s('g', { class: 'gx-seq-fr b-' + fr.m.block }, gfr);
        paint(g, fr.m.cvar);
        g._ids = new Set(fr.ids);
        s('rect', { class: fr.m.block === 'rect' ? 'gx-seq-rect' : 'gx-seq-frame', x: x0, y: fr.y0, width: x1 - x0, height: fr.y1 - fr.y0, rx: 6 }, g);
        if (fr.m.block !== 'rect') {
          const tab = String(fr.m.title || fr.m.block).toUpperCase(), tw0 = textW(tab, 10.5, 700) * 1.1 + 18;
          s('path', { class: 'gx-seq-ftab', d: `M${x0},${fr.y0 + 6}a6,6 0 0 1 6,-6H${x0 + tw0}V${fr.y0 + 13}l-7,7H${x0}Z` }, g);
          const tt = s('text', { class: 'gx-seq-ftt', x: x0 + 9, y: fr.y0 + 14 }, g); tt.textContent = tab;
          if (fr.m.label) { const tl = s('text', { class: 'gx-seq-fl', x: x0 + tw0 + 10, y: fr.y0 + 14 }, g); tl.textContent = '[' + fitText(fr.m.label, x1 - x0 - tw0 - 24, 11.5, 500) + ']'; }
          fr.elses.forEach(r => {
            s('path', { class: 'gx-seq-else', d: `M${x0},${r.y}H${x1}` }, g);
            const et = s('text', { class: 'gx-seq-fl', x: x0 + 10, y: r.y + 16 }, g);
            et.textContent = (r.m.title ? r.m.title.toUpperCase() + ' ' : '') + (r.m.label ? '[' + fitText(r.m.label, x1 - x0 - 90, 11.5, 500) + ']' : '');
          });
        }
      });
      /* las fases van debajo de todo: una banda con su rotulo que agrupa los mensajes que siguen */
      const gph = s('g', { class: 'gx-seq-phases' }, seqWorld);
      /* versalitas con tracking: se mide con margen, y el rotulo se recorta al ancho del diagrama
         (entero en el tooltip) en vez de salirse de su banda */
      rows.filter(r => r.m.kind === 'phase').forEach(r => {
        const bw = W - 204, lab = String(r.m.label || '').toUpperCase();
        const g = s('g', { class: 'gx-seq-ph' }, gph);
        s('rect', { class: 'gx-seq-phase', x: 12, y: r.y - 4, width: bw, height: 28, rx: 7 }, g);
        const t = s('text', { class: 'gx-seq-phase-t', x: 26, y: r.y + 14 }, g);
        t.textContent = fitText(lab, (bw - 30) / 1.22, 11, 700);
        if (t.textContent !== lab) { const tt = s('title', null, g); tt.textContent = r.m.label; }
      });
      const gl = s('g', { class: 'gx-seq-life' }, seqWorld);
      P.forEach(p => s('path', { d: `M${X.get(p.node)},${headH + 16} V${H - 20}` }, gl));
      /* barras de activación: se abren con `+`/activate y se cierran con `-`/deactivate; anidables */
      const gact = s('g', { class: 'gx-seq-acts' }, seqWorld);
      const act = new Map(), bars = [];
      const openAct = (id, yy) => { if (!X.has(id)) return; const st = act.get(id) || []; st.push(yy); act.set(id, st); };
      const closeAct = (id, yy) => { const st = act.get(id); if (!st || !st.length) return; const y0 = st.pop(); bars.push({ id, y0, y1: yy, d: st.length }); };
      rows.forEach(r => {
        const m = r.m;
        if (m.kind === 'activate') openAct(m.node, r.y);
        else if (m.kind === 'deactivate') closeAct(m.node, r.y);
        else if (isMsg(m)) { if (m.deactivate) closeAct(m.deactivate, r.y + 4); if (m.activate) openAct(m.activate, r.y - 4); }
      });
      act.forEach((st, id) => { while (st.length) closeAct(id, H - 26); });
      bars.forEach(bb => {
        const g = s('g', { class: 'gx-seq-act', 'data-id': bb.id }, gact); paint(g, M.get(bb.id).cvar);
        s('rect', { x: X.get(bb.id) - 5 + bb.d * 5, y: bb.y0, width: 10, height: Math.max(bb.y1 - bb.y0, 10), rx: 2 }, g);
      });
      heads.forEach(({ n, h, cl }, i) => {
        const p = P[i], cx = X.get(p.node);
        const w = cl ? cl.w : colW, x = cx - w / 2, yy = 10 + headH - h;
        const g = s('g', { class: `gx-seq-p gx-node gx-leaf${cl ? ` gx-shape fam-${SHP.families[n.shape]} sh-${n.shape}` : ''} d-${n.delta}`, transform: `translate(${x},${yy})`, 'data-id': n.id, tabindex: 0, role: 'button' }, seqWorld);
        paint(g, n.cvar);
        if (cl) SHP.render(n, cl.w, cl.h, shapeCtx, cl.lay).children.forEach(c => toSVG(c, g));
        else {
          s('rect', { class: 'gx-card', rx: 10, width: colW, height: 56 }, g);
          s('rect', { class: 'gx-accent', x: 7, y: 12, width: 3, height: 32, rx: 1.5 }, g);
          glyph(g, n.kind, 17, 14, 28);
          const t = s('text', { class: 'gx-t', x: 55, y: 30 }, g); t.textContent = fitText(lab(p), colW - 66, 13, 600);
          const st = s('text', { class: 'gx-st', x: 55, y: 45 }, g); st.textContent = fitText(n.subtitle || (n.kind !== 'other' ? kindName(n.kind) : ''), colW - 66, 11, 400, true);
        }
        g.addEventListener('pointerenter', ev => showTip(nodeTip(n), ev)); g.addEventListener('pointermove', moveTip); g.addEventListener('pointerleave', hideTip);
        /* sin vista de grafo no hay a donde saltar: el clic ilumina los mensajes de ese participante */
        g.addEventListener('click', ev => { ev.stopPropagation(); hideTip();
          if (graphTab) { reveal(n.id); return; }
          litSeq(f.messages.filter(m => isMsg(m) && (m.from === n.id || m.to === n.id)).map(m => m.id)); });
      });
      /* notas: una hoja sobre uno o varios participantes, o a un lado */
      const gnote = s('g', { class: 'gx-seq-notes' }, seqWorld);
      let minX = 0, maxX = W;
      rows.filter(r => r.m.kind === 'note').forEach(r => {
        const m = r.m, ox = xs(overOf(m)); if (!ox.length) return;
        const lw = Math.max(...r.lines.map(l => textW(l, 12, 400))) + 28;
        let x0, w;
        if (m.side === 'left') { w = Math.max(lw, 110); x0 = ox[0] - 16 - w; }
        else if (m.side === 'right') { w = Math.max(lw, 110); x0 = ox[0] + 16; }
        else { const a = Math.min(...ox), b = Math.max(...ox); w = Math.max(lw, b - a + 70, 120); x0 = (a + b) / 2 - w / 2; }
        const hh = r.lines.length * 15 + 16;
        minX = Math.min(minX, x0); maxX = Math.max(maxX, x0 + w);
        const g = s('g', { class: 'gx-seq-note-b', transform: `translate(${x0},${r.y})` }, gnote);
        s('path', { class: 'gx-seq-notebox', d: `M0,0H${w - 10}L${w},10V${hh}H0Z` }, g);
        s('path', { class: 'gx-seq-notefold', d: `M${w - 10},0V10H${w}` }, g);
        r.lines.forEach((l, k) => { const t = s('text', { class: 'gx-seq-nt', x: 12, y: 19 + k * 15 }, g); t.textContent = l; });
      });
      const msgEls = [];
      let num = 0;
      rows.forEach(row => {
        const m = row.m; if (!isMsg(m) || !X.has(m.from) || !X.has(m.to)) return;
        const i = num++;
        const x1 = X.get(m.from), x2 = X.get(m.to), yy = row.y;
        const g = s('g', { class: `gx-seq-msg k-${m.kind} d-${m.delta || 'unchanged'}${m.animated ? ' anim' : ''}`, 'data-id': m.id, tabindex: 0, role: 'button' }, seqWorld);
        let d;
        if (m.kind === 'self' || m.from === m.to) d = `M${x1},${yy} h46 v20 h-44`;
        else d = `M${x1 + (x2 > x1 ? 6 : -6)},${yy} H${x2 + (x2 > x1 ? -8 : 8)}`;
        s('path', { class: 'gx-ehit', d }, g);
        paint(g, m.cvar);
        const line = s('path', { class: 'gx-eline', d }, g);
        g._line = line; g._m = m; markSeq(g, false);
        if (m.animated) s('path', { class: 'gx-eflow', d }, g);
        const nb = s('g', { class: 'gx-seq-n', transform: `translate(${Math.min(x1, x2) - 30},${yy})` }, g);
        s('circle', { r: 10 }, nb); const nt = s('text', { y: 4 }, nb); nt.textContent = i + 1;
        const lx = m.kind === 'self' ? x1 + 54 : (x1 + x2) / 2;
        const lt = s('text', { class: 'gx-seq-l', x: lx, y: yy - 8, 'text-anchor': m.kind === 'self' ? 'start' : 'middle' }, g);
        lt.textContent = m.label + (m.repeat ? `  ×${m.repeat}` : '');
        if (m.note) { const nn = s('text', { class: 'gx-seq-note', x: m.kind === 'self' ? x1 + 54 : (x1 + x2) / 2, y: yy + 20, 'text-anchor': m.kind === 'self' ? 'start' : 'middle' }, g); nn.textContent = fitText(m.note, Math.max(Math.abs(x2 - x1) + 60, 260), 11, 400); }
        g._pts = { x1, x2, y: yy };
        g.addEventListener('pointerenter', ev => showTip(`<div class="gx-tip-h"><b>${i + 1}. ${esc(m.label)}</b></div><div class="gx-tip-m"><span>${esc(M.get(m.from).label)} → ${esc(M.get(m.to).label)}</span><span>${esc(m.kind)}</span></div>${m.note ? `<p>${esc(m.note)}</p>` : ''}${m.summary ? `<p>${esc(m.summary)}</p>` : ''}${m.data ? `<p><i>${esc(T.data)}:</i> ${esc(m.data)}</p>` : ''}`, ev));
        g.addEventListener('pointermove', moveTip); g.addEventListener('pointerleave', hideTip);
        g.addEventListener('click', ev => { ev.stopPropagation(); litSeq([m.id]); });
        msgEls.push(g);
      });
      /* una nota a la izquierda del primer participante (o a la derecha del último) amplía el encuadre */
      const bx = Math.min(0, minX - 20), bw = Math.max(W, maxX + 20) - bx;
      S.seq = { f, msgEls, frames: [...gfr.children], bbox: { x: bx, y: 0, w: bw, h: H }, X };
      seqCtl.innerHTML = `<button type="button" class="gx-btn gx-primary" data-sq="play">▶ ${esc(T.play)}</button>${f.summary ? `<span>${esc(f.summary)}</span>` : ''}`;
      seqCtl.querySelector('[data-sq=play]').onclick = playSeq;
    }
    /* puntas de un mensaje: llena (->>), abierta (-)), aspa (-x), ninguna (->) y doble sentido (<<->>) */
    function markSeq(g, lit) {
      const m = g._m, key = lit ? 'lit' : (m.cvar || (MK_COLOR[m.delta] ? m.delta : 'unchanged'));
      const me = markerRef(m.head || 'arrow', key, I + 's'), mst = m.tail ? markerRef(m.tail, key, I + 's') : null;
      if (me) g._line.setAttribute('marker-end', me); else g._line.removeAttribute('marker-end');
      if (mst) g._line.setAttribute('marker-start', mst); else g._line.removeAttribute('marker-start');
    }
    function wrapLines(text, max, size) {
      const words = String(text || '').split(/\s+/).filter(Boolean), out = []; let cur = '';
      words.forEach(w => { const t = cur ? cur + ' ' + w : w; if (!cur || textW(t, size, 400) <= max) cur = t; else { out.push(cur); cur = w; } });
      if (cur) out.push(cur);
      return (out.length ? out : ['']).slice(0, 8).map(l => fitText(l, max, size, 400));
    }
    function litSeq(ids) {
      if (!S.seq) return;
      seqWorld.classList.toggle('gx-dim', !!(ids && ids.length));
      S.seq.msgEls.forEach(g => { const on = !!(ids && ids.includes(g._m.id)); g.classList.toggle('lit', on); markSeq(g, on); });
      (S.seq.frames || []).forEach(fr => fr.classList.toggle('lit', !!(ids && ids.some(id => fr._ids && fr._ids.has(id)))));
      const lit = new Set(); (ids || []).forEach(id => { const m = S.seq.f.messages.find(x => x.id === id); if (m) { lit.add(m.from); lit.add(m.to); } });
      seqWorld.querySelectorAll('.gx-seq-p').forEach(p => p.classList.toggle('lit', lit.has(p.dataset.id)));
    }
    function playSeq() {
      if (S.seqPlay) { stopSeq(); return; }
      let i = 0; const msgs = S.seq.msgEls;
      const b = seqCtl.querySelector('[data-sq=play]'); b.innerHTML = '❚❚ ' + esc(T.pause);
      const tick = () => {
        if (i >= msgs.length) { stopSeq(); return; }
        const g = msgs[i]; litSeq([g._m.id]); pulse(g); i++;
        S.seqPlay = setTimeout(tick, reduce ? 700 : 1100);
      };
      S.seqPlay = setTimeout(tick, 0);
    }
    function stopSeq() { clearTimeout(S.seqPlay); S.seqPlay = null; const b = seqCtl.querySelector('[data-sq=play]'); if (b) b.innerHTML = '▶ ' + esc(T.play); litSeq(null); }
    function pulse(g) {
      if (reduce) return;
      const { x1, x2, y } = g._pts; const self = g._m.kind === 'self' || x1 === x2;
      const dot = s('circle', { class: 'gx-dot', r: 5, cx: x1, cy: y }, g);
      tween(t => {
        if (self) { const a = t * Math.PI; dot.setAttribute('cx', x1 + Math.sin(a) * 46); dot.setAttribute('cy', y + (1 - Math.cos(a)) * 10); }
        else dot.setAttribute('cx', lerp(x1, x2, t));
      }, 700).then(() => dot.remove());
    }

    function showView(v) {
      if (S.view === v && (v === 'graph' || (S.seq && 'flow:' + S.seq.f.id === v))) { syncTabs(); return; }
      stopSeq();
      S.view = v; hideTip();
      host.classList.toggle('gx-flowview', v !== 'graph');
      if (v !== 'graph') {
        const f = G.flows.find(x => 'flow:' + x.id === v); if (!f) return showView('graph');
        renderFlow(f); setSeqCam(camFor(S.seq.bbox, 30, seqSvg));
        panel.classList.remove('on');
      }
      syncTabs();
    }
    function syncTabs() { tabBtns.forEach(b => b.classList.toggle('on', b.dataset.view === S.view)); }

    /* --- recorrido y presentación --- */
    function renderTour() {
      if (!G.steps.length) { tourBox.style.display = 'none'; bPresent.style.display = 'none'; return; }
      const i = S.tour, st = G.steps[i];
      const dots = G.steps.map((x, k) => `<button type="button" class="gx-dotb${k === i ? ' on' : ''}${k < i ? ' done' : ''}" data-step="${k}" aria-label="${esc(T.step)} ${k + 1}: ${esc(x.title || '')}"></button>`).join('');
      tourBox.innerHTML = `<div class="gx-tour-h"><span class="gx-tour-k">${esc((spec.tour && spec.tour.title) || T.tour)}</span>
          <span class="gx-tour-n">${i >= 0 ? `${T.step} ${i + 1} ${T.of} ${G.steps.length}` : `${G.steps.length} ${T.step.toLowerCase()}s`}</span>
          <span class="gx-tour-c"><button type="button" class="gx-btn" data-t="prev" aria-label="${esc(T.prev)}">◀</button><button type="button" class="gx-btn gx-primary" data-t="next" aria-label="${esc(T.next)}">${i < 0 ? '▶ ' + esc(T.tour) : '▶'}</button>${i >= 0 ? `<button type="button" class="gx-btn gx-stop" data-t="stop" title="${esc(T.stop)}">■ ${esc(T.stop)}</button>` : ''}${S.present ? `<button type="button" class="gx-btn" data-t="exit">${esc(T.exitPresent)} ✕</button>` : ''}</span></div>
        ${st ? `<h3>${esc(st.title || '')}</h3><div class="gx-tour-b">${st.body_html || esc(st.body || '')}</div>` : `<div class="gx-tour-b">${esc((spec.tour && spec.tour.summary) || '')}</div>`}
        <div class="gx-dots">${dots}</div>${S.present ? `<div class="gx-kbd">${esc(T.kbd)}</div>` : ''}`;
      tourBox.querySelector('[data-t=prev]').onclick = () => goStep(Math.max(0, S.tour - 1));
      tourBox.querySelector('[data-t=next]').onclick = () => goStep(S.tour + 1);
      const ex = tourBox.querySelector('[data-t=exit]'); if (ex) ex.onclick = () => setPresent(false);
      const sp = tourBox.querySelector('[data-t=stop]'); if (sp) sp.onclick = () => resetView();
      tourBox.querySelectorAll('[data-step]').forEach(b => b.onclick = () => goStep(+b.dataset.step));
      progress.firstChild.style.width = i >= 0 ? ((i + 1) / G.steps.length * 100) + '%' : '0';
    }
    async function goStep(i) {
      if (!G.steps.length) return;
      if (i >= G.steps.length) { if (S.present) setPresent(false); return; }
      S.tour = clamp(i, 0, G.steps.length - 1);
      const tok = ++S.tourTok;
      const st = G.steps[S.tour];
      S.trace = null; hoverSet = null; hideTip();
      renderTour();
      const f = st.focus || {};
      if (st.view && st.view.startsWith('flow:')) {
        showView(st.view);
        litSeq(f.messages || []);
        const rows = (f.messages || []).map(id => S.seq.msgEls.find(g => g._m.id === id)).filter(Boolean);
        if (rows.length) {
          const ys = rows.map(g => g._pts.y), xs = rows.flatMap(g => [g._pts.x1, g._pts.x2]);
          const b = { x: Math.min(...xs) - 140, y: Math.min(...ys) - 110, w: Math.max(...xs) - Math.min(...xs) + 330, h: Math.max(...ys) - Math.min(...ys) + 170 };
          animateCam(camFor(b, 20, seqSvg), 'seq');
        } else animateCam(camFor(S.seq.bbox, 30, seqSvg), 'seq');
        return;
      }
      showView('graph');
      if (st.depth != null) setDepthSet(st.depth);
      (st.expand || []).forEach(id => { S.expanded.add(id); ancestors(M, id).forEach(a => S.expanded.add(a)); });
      (st.collapse || []).forEach(id => S.expanded.delete(id));
      (f.nodes || []).forEach(id => ancestors(M, id).forEach(a => S.expanded.add(a)));
      (f.edges || []).forEach(eid => { const e = G.edges.find(x => x.id === eid); if (e) [e.from, e.to].forEach(x => ancestors(M, x).forEach(a => S.expanded.add(a))); });
      if (st.select) { S.selected = st.select; S.selEdge = null; } else if (!S.present) { S.selected = null; panel.classList.remove('on'); }
      await relayout({ after: () => { if (tok !== S.tourTok) return; setFocusSet(f.nodes, f.edges); if (st.select) renderPanel(); } });
      if (tok !== S.tourTok) return;
      const b = bboxOf(f.nodes, f.edges);
      await animateCam(camFor(b || S.bbox, 50));
    }
    function endTour() { S.tourTok++; S.tour = -1; stepSet = null; hoverSet = null; applyHighlight(); renderTour(); }
    /* Detener: fuera del recorrido y de vuelta al estado con el que se abrió el diagrama */
    function resetView() {
      if (S.present) { S.present = false; host.classList.remove('gx-present'); try { document.fullscreenElement === host && document.exitFullscreen(); } catch (_) { } }
      endTour(); stopSeq();
      S.trace = null; S.selected = null; S.selEdge = null; panel.classList.remove('on');
      if (S.view !== homeView) showView(homeView);
      else if (S.view !== 'graph' && S.seq) animateCam(camFor(S.seq.bbox, 30, seqSvg), 'seq');
      setDepthSet(initial); S.frameBox = null;
      return relayout({ fit: true });
    }
    function setPresent(on) {
      S.present = on; host.classList.toggle('gx-present', on);
      if (on) { try { host.requestFullscreen && host.requestFullscreen().catch(() => { }); } catch (_) { } host.focus(); if (S.tour < 0) goStep(0); }
      else { try { document.fullscreenElement === host && document.exitFullscreen(); } catch (_) { } endTour(); }
      renderTour();
      setTimeout(() => { if (S.view === 'graph') animateCam(camFor(bboxOf((G.steps[S.tour] || {}).focus && G.steps[S.tour].focus.nodes) || S.bbox, 50)); }, 60);
    }
    bPresent.onclick = () => setPresent(!S.present);
    function setExplore(on) {
      S.expanded2 = on; host.classList.toggle('gx-expanded', on);
      bExplore.innerHTML = on ? '✕ ' + esc(T.exitExplore) : '⤢ ' + esc(T.explore);
      document.documentElement.classList.toggle('gx-noscroll', on);
      setTimeout(() => { if (S.view === 'graph') animateCam(camFor(S.bbox)); else animateCam(camFor(S.seq.bbox, 30, seqSvg), 'seq'); }, 60);
    }
    bExplore.onclick = () => setExplore(!S.expanded2);
    const onFs = () => { if (!document.fullscreenElement && S.present && host.classList.contains('gx-fs')) setPresent(false); host.classList.toggle('gx-fs', document.fullscreenElement === host); };
    document.addEventListener('fullscreenchange', onFs);

    host.addEventListener('keydown', ev => {
      if (ev.target.tagName === 'INPUT') return;
      const k = ev.key;
      if ((k === 'ArrowRight' || k === 'PageDown' || (k === ' ' && S.present)) && (S.tour >= 0 || S.present)) { ev.preventDefault(); goStep(S.tour + 1); }
      else if ((k === 'ArrowLeft' || k === 'PageUp') && S.tour >= 0) { ev.preventDefault(); goStep(Math.max(0, S.tour - 1)); }
      else if (k === 'Escape') { if (S.present) setPresent(false); else if (S.expanded2) setExplore(false); else if (S.tour >= 0) resetView(); else clearSelection(); }
      else if (k === '+' || k === '=') { const v = viewSize(activeSvg()); zoomAt(1.2, v.w / 2, v.h / 2, which()); }
      else if (k === '-') { const v = viewSize(activeSvg()); zoomAt(1 / 1.2, v.w / 2, v.h / 2, which()); }
      else if (k === '0') bFit.onclick();
      else if (k === '/') { ev.preventDefault(); searchIn.focus(); }
    });

    let roT = null;
    let lastW = 0;
    const ro = global.ResizeObserver ? new ResizeObserver(() => {
      clearTimeout(roT);
      roT = setTimeout(() => {
        const w0 = stage.getBoundingClientRect().width;
        if (w0 && !lastW && !S.touched) {
          if (S.view !== 'graph' && S.seq) setSeqCam(camFor(S.seq.bbox, 30, seqSvg));
          else if (S.bbox) setCam(camFor(S.bbox));
        }
        lastW = w0; drawMiniView();
      }, 80);
    }) : null;
    if (ro) ro.observe(stage);

    renderTour(); syncTabs();
    const ready = relayout({ fit: true });
    if (homeView !== 'graph') showView(homeView);

    return {
      ready, diffReady, model: G, state: S, setExplore, resetView, focusNode,
      setDirection: d => { S.dir = d === 'down' ? 'down' : 'right'; syncDir(); S.frameBox = null; return relayout({ fit: true }); },
      expandTo: d => { setDepthSet(d); return relayout({ fit: true }); },
      toggle, reveal, select, goStep, showView, setPresent, trace,
      /* deja el host como estaba: sin contenido, sin las clases de estado (una vista solo de secuencia
         ocultaría el grafo del siguiente montaje) y sin el id y los atributos que puso el motor */
      destroy() {
        document.removeEventListener('pointerdown', onDocDown); document.removeEventListener('fullscreenchange', onFs); ro && ro.disconnect();
        host.innerHTML = '';
        [...host.classList].filter(c => c === 'gx' || c.startsWith('gx-') && c !== 'gx-host').forEach(c => host.classList.remove(c));
        if (ownId) host.removeAttribute('id');
        host.removeAttribute('tabindex'); host.style.removeProperty('--gx-h');
        if (host._gx) delete host._gx;
      }
    };
  }

  /* ELK puede venir incrustado en la página o cargarse bajo demanda (bundle «lite»). jsDelivr
     está admitido por la CSP de los artifacts de claude.ai. */
  const ELK_URL = 'https://cdn.jsdelivr.net/npm/elkjs@0.12.0/lib/elk.bundled.js';
  let elkLoading = null;
  function loadELK() {
    if (global.ELK) return Promise.resolve(global.ELK);
    if (elkLoading) return elkLoading;
    elkLoading = new Promise((res, rej) => {
      const sc = document.createElement('script');
      sc.src = (global.GraphX && global.GraphX.elkURL) || ELK_URL;
      sc.async = true; sc.crossOrigin = 'anonymous';
      sc.onload = () => global.ELK ? res(global.ELK) : rej(new Error('GraphX: ELK no se registró'));
      sc.onerror = () => { elkLoading = null; rej(new Error('GraphX: no se pudo cargar ELK desde ' + sc.src)); };
      (document.head || document.documentElement).appendChild(sc);
    });
    return elkLoading;
  }

  /* Monta todos los `[data-gx]` de un contenedor: el spec va en un <script type="application/json"> dentro,
     o el código de Mermaid en un <script type="text/plain" class="gx-mermaid"> (necesita graphx-mermaid.js). */
  function mountAll(root) {
    const out = [];
    (root || document).querySelectorAll('[data-gx]').forEach(el => {
      if (el._gx) return;
      const src = el.querySelector('script.gx-spec'), mmd = src ? null : el.querySelector('script.gx-mermaid');
      if (!src && !mmd) return;
      let spec;
      if (mmd) {
        if (!global.GraphX.fromMermaid) { el.textContent = 'GraphX: falta graphx-mermaid.js para convertir Mermaid'; return; }
        try { const r = global.GraphX.fromMermaid(mmd.textContent, { lang: el.dataset.lang }); spec = r.spec; if (r.warnings.length) console.warn('GraphX · Mermaid:\n  ' + r.warnings.join('\n  ')); }
        catch (e) { el.textContent = 'GraphX: Mermaid no válido — ' + e.message; return; }
      } else { try { spec = JSON.parse(src.textContent); } catch (e) { el.textContent = 'GraphX: JSON inválido — ' + e.message; return; } }
      el._gx = mount(el, spec, { height: el.dataset.height ? +el.dataset.height : null, lang: el.dataset.lang });
      out.push(el._gx);
    });
    return out;
  }

  global.GraphX = Object.assign(global.GraphX || {}, { mount, mountAll, buildModel, resolveLink, safeColor, THEME_KEYS, loadELK, ELK_URL, icons: ICON, version: '1.7.0' });
})(typeof window !== 'undefined' ? window : globalThis);
