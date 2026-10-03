/* GraphX · árboles de ficheros.
 *
 * Convierte una lista de rutas en el JSON de GraphX: una carpeta por directorio y un fichero por
 * ruta, con el layout `tree` (sangrado como el comando `tree`, o en columnas). Las carpetas se
 * pliegan y se despliegan como en un explorador, cada tarjeta abre su detalle y el diagrama se
 * puede filtrar por rutas: los resultados de una búsqueda o los ficheros cambiados de un diff.
 *
 *   GraphX.tree.fromPaths(entries, opts)   → spec
 *   GraphX.tree.fromTreeText(text, opts)   → spec   (la salida del comando `tree`)
 *   GraphX.tree.fromGit({ files, numstat, nameStatus }, opts) → spec
 *   GraphX.tree.parseTree(text)            → entries
 *
 * Una entrada es una ruta ('src/a.js') o un objeto { path, size, lines, additions, deletions,
 * status ('A' | 'M' | 'D' | 'R'), from (ruta anterior de un renombrado), summary, metrics, links }.
 * Opciones: { title, summary, lang: 'es' | 'en', root: nombre de la carpeta raíz (false: sin raíz),
 * compact: true (une las cadenas de carpetas con un solo hijo, como GitHub), focus: 'changes' |
 * [rutas] | null, prune: true, direction: 'down' | 'right', initialDepth, links: { repo, sha } }.
 * Funciones puras: no tocan el DOM y valen en Node.                                              */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GraphX = Object.assign(root.GraphX || {}, { tree: api });
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  /* un color por extensión: tonos medios que se leen sobre el tema claro y sobre el oscuro */
  const EXT = {
    js: '#e5c000', mjs: '#e5c000', cjs: '#e5c000', jsx: '#e5c000', ts: '#3178c6', tsx: '#3178c6', mts: '#3178c6', cts: '#3178c6',
    css: '#7c4dff', scss: '#c6538c', sass: '#c6538c', less: '#5b6abf', html: '#e34c26', htm: '#e34c26', vue: '#41b883', svelte: '#ff3e00',
    md: '#5b7083', mdx: '#5b7083', txt: '#8c959f', rst: '#5b7083', json: '#0f9d8a', jsonc: '#0f9d8a', yml: '#cb4b8b', yaml: '#cb4b8b', toml: '#9c4221', xml: '#0060ac',
    py: '#3572a5', rb: '#cc342d', go: '#00add8', rs: '#c4703a', java: '#b07219', kt: '#a97bff', kts: '#a97bff', swift: '#f05138', scala: '#c22d40',
    c: '#6b7280', h: '#6b7280', cc: '#f34b7d', cpp: '#f34b7d', hpp: '#f34b7d', cs: '#178600', php: '#4f5d95', ex: '#6e4a7e', exs: '#6e4a7e', erl: '#b83998',
    sh: '#4eaa25', bash: '#4eaa25', zsh: '#4eaa25', fish: '#4eaa25', ps1: '#012456', sql: '#e38c00', graphql: '#e10098', gql: '#e10098', proto: '#5a6fd6',
    svg: '#d946ef', png: '#a855f7', jpg: '#a855f7', jpeg: '#a855f7', gif: '#a855f7', webp: '#a855f7', ico: '#a855f7', pdf: '#b91c1c',
    lock: '#94a3b8', env: '#94a3b8', ini: '#94a3b8', cfg: '#94a3b8', conf: '#94a3b8', mmd: '#ff3670', dockerfile: '#384d54', makefile: '#427819'
  };
  const SPECIAL = { makefile: 'MK', dockerfile: 'DKR', license: 'LIC', readme: 'DOC', changelog: 'DOC', gemfile: 'RB', rakefile: 'RB', procfile: 'CFG' };
  const STR = {
    es: { root: 'repo', files: 'ficheros', file: 'fichero', dirs: 'carpetas', dir: 'carpeta', size: 'Tamaño', lines: 'Líneas', status: 'Estado', before: 'Antes',
      changed: 'cambiados', folder: 'Carpeta', fileK: 'Fichero', st: { A: 'nuevo', M: 'modificado', D: 'eliminado', R: 'renombrado' }, changes: 'Cambios', tree: 'Árbol de ficheros' },
    en: { root: 'repo', files: 'files', file: 'file', dirs: 'folders', dir: 'folder', size: 'Size', lines: 'Lines', status: 'Status', before: 'Before',
      changed: 'changed', folder: 'Folder', fileK: 'File', st: { A: 'added', M: 'modified', D: 'deleted', R: 'renamed' }, changes: 'Changes', tree: 'File tree' }
  };
  const DELTA = { A: 'added', M: 'modified', D: 'removed', R: 'modified', C: 'added', T: 'modified', U: 'modified' };

  const extOf = name => {
    const low = String(name).toLowerCase();
    if (EXT[low]) return low;
    const i = low.lastIndexOf('.');
    return i > 0 ? low.slice(i + 1) : (i === 0 ? low.slice(1) : '');
  };
  const badgeOf = name => {
    const low = String(name).toLowerCase(), base = low.replace(/\.[^.]*$/, '');
    if (SPECIAL[base] && (low === base || /^(md|txt|rst)$/.test(extOf(low)))) return SPECIAL[base];
    if (low.startsWith('.')) return 'CFG';
    const e = extOf(low);
    return e ? e.slice(0, 4).toUpperCase() : '';
  };
  const fmtSize = (b, lang) => {
    if (b == null) return '';
    const u = ['B', 'KB', 'MB', 'GB']; let i = 0, v = b;
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    const t = i ? (v >= 10 ? Math.round(v) : v.toFixed(1)) : v;
    return (lang === 'en' ? String(t) : String(t).replace('.', ',')) + ' ' + u[i];
  };
  const fmtInt = (v, lang) => (v == null ? '' : Number(v).toLocaleString(lang === 'en' ? 'en-US' : 'es-ES'));
  /* ids válidos para GraphX: letras, números y . _ : / -; el resto se escapa */
  const safeId = (prefix, path) => prefix + ':' + (String(path).replace(/[^A-Za-z0-9._/-]/g, c => '-' + c.charCodeAt(0).toString(16)) || '_');
  const norm = p => String(p).trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+/g, '/').replace(/\/$/, '');

  function fromPaths(entries, opts) {
    opts = opts || {};
    const lang = opts.lang === 'en' ? 'en' : 'es', L = STR[lang];
    /* 1 · un árbol en memoria: directorios con sus hijos, ficheros con sus datos */
    const rootName = opts.root === false ? null : (opts.root || L.root);
    const mkDir = (name, path) => ({ dir: true, name, path, kids: new Map() });
    const top = mkDir(rootName || '', '');
    /* una ruta repetida (el listado y luego su cambio) se funde en una sola entrada */
    const seen = new Map();
    (entries || []).forEach(e => {
      const o = typeof e === 'string' ? { path: e } : Object.assign({}, e);
      const p = norm(o.path || ''); if (!p) return;
      if (seen.has(p)) { const prev = seen.get(p); Object.keys(o).forEach(k => { if (o[k] != null && k !== 'path') prev[k] = o[k]; }); return; }
      seen.set(p, o);
      const parts = p.split('/');
      let cur = top;
      parts.forEach((seg, i) => {
        const sub = parts.slice(0, i + 1).join('/'), last = i === parts.length - 1;
        if (last && !o.dir) { cur.kids.set('f/' + seg, Object.assign(o, { dir: false, name: seg, path: sub })); return; }
        if (!cur.kids.has('d/' + seg)) cur.kids.set('d/' + seg, mkDir(seg, sub));
        cur = cur.kids.get('d/' + seg);
      });
    });
    /* 2 · cadenas de carpetas con un solo hijo carpeta → una sola («src/main/java», como GitHub) */
    if (opts.compact !== false) {
      const squash = d => {
        d.kids.forEach(k => { if (k.dir) squash(k); });
        if (d === top) return;
        while (d.kids.size === 1) {
          const only = [...d.kids.values()][0];
          if (!only.dir) break;
          d.name = d.name + '/' + only.name; d.path = only.path; d.kids = only.kids;
        }
      };
      squash(top);
    }
    /* 3 · nodos: carpetas primero, luego ficheros; por nombre, con los números en orden natural */
    const cmp = (a, b) => (b.dir - a.dir) || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    const nodes = [], ids = new Set();
    /* safeId escapa «:», así que «:2» no choca con ninguna ruta */
    const uniq = id => { let k = id, i = 2; while (ids.has(k)) k = id + ':' + i++; ids.add(k); return k; };
    const changedAll = [];
    const blob = (path) => (opts.links && opts.links.repo && opts.links.sha ? `https://github.com/${opts.links.repo}/blob/${opts.links.sha}/${path}` : null);
    const build = (d, parent) => {
      let files = 0, dirs = 0, size = 0, lines = 0, hasSize = false, hasLines = false;
      const exts = new Map(), changed = [];
      const id = d === top && !rootName ? null : uniq(safeId('d', d.path || '.'));
      const node = id ? { id, label: d === top ? rootName : d.name, kind: 'folder', shape: 'folder', openShape: 'folder-open', path: d.path || '.', parent: parent || undefined } : null;
      if (node) nodes.push(node);
      [...d.kids.values()].sort(cmp).forEach(k => {
        if (k.dir) {
          const r = build(k, id); dirs += 1 + r.dirs; files += r.files;
          if (r.size != null) { size += r.size; hasSize = true; } if (r.lines != null) { lines += r.lines; hasLines = true; }
          r.exts.forEach((v, e) => exts.set(e, (exts.get(e) || 0) + v)); changed.push(...r.changed);
          return;
        }
        files++;
        const ext = extOf(k.name), st = k.status ? String(k.status).charAt(0).toUpperCase() : null;
        const delta = k.delta || (st && DELTA[st]) || (k.additions || k.deletions ? 'modified' : 'unchanged');
        exts.set(ext, (exts.get(ext) || 0) + 1);
        if (k.size != null) { size += k.size; hasSize = true; } if (k.lines != null) { lines += k.lines; hasLines = true; }
        const metrics = [];
        if (k.size != null) metrics.push({ label: L.size, value: fmtSize(k.size, lang) });
        if (k.lines != null) metrics.push({ label: L.lines, value: fmtInt(k.lines, lang) });
        if (st && L.st[st]) metrics.push({ label: L.status, value: L.st[st] });
        if (k.from) metrics.push({ label: L.before, value: k.from });
        (Array.isArray(k.metrics) ? k.metrics : Object.entries(k.meta || {}).map(([label, value]) => ({ label, value: String(value) }))).forEach(m => metrics.push(m));
        const sub = [k.size != null ? fmtSize(k.size, lang) : '', k.lines != null ? `${fmtInt(k.lines, lang)} ${lang === 'en' ? 'lines' : 'líneas'}` : ''].filter(Boolean).join(' · ');
        const f = {
          id: uniq(safeId('f', k.path)), label: k.name, kind: 'file', shape: 'file', path: k.path, parent: id || undefined,
          ext, badge: badgeOf(k.name), extColor: EXT[ext] || EXT[k.name.toLowerCase()] || undefined, delta,
          summary: k.summary || undefined, subtitle: k.subtitle || sub || undefined, metrics: metrics.length ? metrics : undefined, links: k.links
        };
        if (st === 'R') f.renamed = true;
        if (delta !== 'unchanged' || k.additions != null) {
          f.files = [{ path: k.path, additions: k.additions || 0, deletions: k.deletions || 0 }];
          const u = blob(k.path); if (u && delta !== 'removed') f.files[0].url = u;
        }
        if (delta !== 'unchanged') changed.push({ name: k.name, path: k.path, additions: k.additions || 0, deletions: k.deletions || 0, delta, id: f.id });
        nodes.push(f);
      });
      if (node) {
        const ex = [...exts.entries()].sort((a, b) => b[1] - a[1]);
        const head = ex.slice(0, 5).map(([e, n]) => ({ ext: e || '·', n, color: EXT[e] || '#8c959f' }));
        const rest = ex.slice(5).reduce((s, [, n]) => s + n, 0);
        if (rest) head.push({ ext: '…', n: rest, color: '#8c959f' });
        const top5 = changed.slice().sort((a, b) => (b.additions + b.deletions) - (a.additions + a.deletions));
        node.tree = { files, dirs, exts: head, changed: top5.slice(0, 5).map(c => ({ name: c.path.slice((d.path ? d.path.length + 1 : 0)), path: c.path, additions: c.additions, deletions: c.deletions, delta: c.delta })), more: Math.max(0, changed.length - 5) || undefined };
        const metrics = [{ label: L.files.charAt(0).toUpperCase() + L.files.slice(1), value: fmtInt(files, lang) }];
        if (dirs) metrics.push({ label: L.dirs.charAt(0).toUpperCase() + L.dirs.slice(1), value: fmtInt(dirs, lang) });
        if (hasSize) metrics.push({ label: L.size, value: fmtSize(size, lang) });
        if (hasLines) metrics.push({ label: L.lines, value: fmtInt(lines, lang) });
        if (changed.length) metrics.push({ label: L.changes, value: `${changed.length} ${L.changed}` });
        node.metrics = metrics;
        node.summary = `${fmtInt(files, lang)} ${files === 1 ? L.file : L.files}${dirs ? ` · ${fmtInt(dirs, lang)} ${dirs === 1 ? L.dir : L.dirs}` : ''}`;
      }
      if (d === top) changedAll.push(...changed);
      return { files, dirs, size: hasSize ? size : null, lines: hasLines ? lines : null, exts, changed };
    };
    build(top, null);
    nodes.forEach(n => { Object.keys(n).forEach(k => n[k] === undefined && delete n[k]); });
    /* 4 · el spec: layout de árbol, una raíz abierta y, si hay cambios, el filtro de cambios listo */
    const spec = {
      title: opts.title || L.tree, lang, direction: opts.direction === 'right' ? 'right' : 'down',
      layout: { mode: 'tree' }, initialDepth: opts.initialDepth != null ? opts.initialDepth : (rootName ? 1 : 0),
      legend: { kinds: { folder: L.folder, file: L.fileK } }, nodes, edges: []
    };
    if (opts.summary) spec.summary = opts.summary;
    if (opts.links) spec.links = opts.links;
    const focus = opts.focus === undefined ? (changedAll.length ? 'changes' : null) : opts.focus;
    if (focus === 'changes' && changedAll.length) spec.focus = { delta: ['added', 'modified', 'removed'], label: L.changes, key: 'changes', prune: opts.prune };
    else if (Array.isArray(focus) && focus.length) spec.focus = { paths: focus.map(norm), label: opts.focusLabel || '', prune: opts.prune };
    if (spec.focus && spec.focus.prune === undefined) delete spec.focus.prune;
    if (opts.filters) spec.filters = opts.filters;
    return spec;
  }

  /* La salida de `tree` (también `tree -s`, `-h`, `-F`, `--charset ascii`): la profundidad sale de
     la columna en la que empieza el nombre; una línea seguida de otras más hondas es una carpeta. */
  function parseTree(text) {
    const rows = [];
    String(text || '').split(/\r?\n/).forEach(line => {
      if (!line.trim() || /^\s*\d+ director(y|ies)(, \d+ files?)?\s*$/i.test(line)) return;
      const m = /^((?:(?:│|\|)\s{2,3}|\s{4})*)(?:├──|└──|\|--|`--|\+--|\\--)\s?(.*)$/.exec(line);
      let depth, name;
      if (m) { depth = Math.round(m[1].replace(/│|\|/g, ' ').length / 4) + 1; name = m[2]; }
      else if (!rows.length) { rows.push({ depth: 0, name: line.trim(), root: true }); return; }
      else return;
      let size = null;
      const sm = /^\[\s*([\d.]+)\s*([KMGT]?)i?B?\s*\]\s+(.*)$/i.exec(name);
      if (sm) { size = Math.round(parseFloat(sm[1]) * ({ '': 1, K: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4 })[sm[2].toUpperCase()]); name = sm[3]; }
      name = name.replace(/\s+->\s+.*$/, '');
      const dirMark = /\/$/.test(name); name = name.replace(/[/*=@|]$/, '');
      rows.push({ depth, name, size, dirMark });
    });
    const out = [], stack = [];
    const root = rows[0] && rows[0].root ? rows.shift() : null;
    rows.forEach((r, i) => {
      stack.length = r.depth - 1; stack[r.depth - 1] = r.name;
      const path = stack.slice(0, r.depth).join('/');
      const next = rows[i + 1], isDir = r.dirMark || (next && next.depth > r.depth);
      if (isDir) { if (!(next && next.depth > r.depth)) out.push({ path, dir: true }); }
      else out.push(r.size != null ? { path, size: r.size } : { path });
    });
    return { entries: out, root: root && root.name !== '.' ? root.name.replace(/\/$/, '') : null };
  }
  function fromTreeText(text, opts) {
    const r = parseTree(text);
    return fromPaths(r.entries, Object.assign({ root: r.root || undefined }, opts || {}));
  }

  /* git: `ls-files` da el árbol; `diff --numstat` las líneas; `diff --name-status` el tipo de cambio
     (los borrados no están en ls-files: se añaden desde el diff) */
  function fromGit(src, opts) {
    src = src || {};
    const lines = v => (Array.isArray(v) ? v : String(v || '').split(/\r?\n/)).map(l => l.replace(/\r$/, '')).filter(Boolean);
    const byPath = new Map();
    const get = p => { p = norm(p); if (!byPath.has(p)) byPath.set(p, { path: p }); return byPath.get(p); };
    lines(src.files).forEach(p => get(p));
    /* numstat de un renombrado: «a	d	src/{old => new}/x.js» o «a	d	old => new» */
    const renamed = p => {
      const m = /^(.*)\{(.*) => (.*)\}(.*)$/.exec(p);
      if (m) return { from: norm(m[1] + m[2] + m[4]), to: norm(m[1] + m[3] + m[4]) };
      const k = /^(.*) => (.*)$/.exec(p);
      return k ? { from: norm(k[1]), to: norm(k[2]) } : null;
    };
    lines(src.numstat).forEach(l => {
      const [a, d, ...rest] = l.split('\t'); const p = rest.join('\t'); if (!p) return;
      const rn = renamed(p), e = get(rn ? rn.to : p);
      e.additions = a === '-' ? 0 : +a || 0; e.deletions = d === '-' ? 0 : +d || 0;
      if (rn) { e.from = rn.from; e.status = e.status || 'R'; }
    });
    lines(src.nameStatus).forEach(l => {
      const [st, a, b] = l.split('\t'); if (!st || !a) return;
      const k = st.charAt(0).toUpperCase();
      if ((k === 'R' || k === 'C') && b) { const e = get(b); e.status = k; e.from = norm(a); byPath.delete(norm(a)); }
      else get(a).status = k;
    });
    (src.extra || []).forEach(x => Object.assign(get(x.path), x));
    return fromPaths([...byPath.values()], opts);
  }

  return { fromPaths, fromTreeText, fromGit, parseTree, extColor: e => EXT[String(e).toLowerCase()] || null, EXT };
});
