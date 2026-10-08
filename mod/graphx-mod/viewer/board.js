/* El tablero del mod graphx convertido en un JSON de GraphX. Lo comparten el visor del navegador y el
 * servidor (que lo monta sin navegador, en jsdom, para el terminal, el escritorio y las capturas): todos
 * tienen que pintar exactamente lo mismo. Necesita `GraphX` (con el conversor de Mermaid y el de árboles).
 *
 * El tablero: { source, patches, title, lang, direction, fx, data, signs, banner, guide, view }.
 *   source  { kind: 'spec' | 'mermaid' | 'paths' | 'tree-text', … }
 *   patches [{ add, update, remove, set }]  cambios acumulados sobre la fuente
 *   fx      un preset, un objeto o false: manda sobre el `fx` del JSON
 *   data    { nodes: { id: {…} }, edges: { id: {…} } }  datos en vivo acumulados (setData) */
(function (root) {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = o => JSON.parse(JSON.stringify(o));
  /* el idioma de la interfaz que dice el tablero (los hooks siempre lo ponen); sin él, inglés */
  const langOf = b => (b && (b.lang === 'es' || b.lang === 'en') ? b.lang : 'en');
  const trIn = lang => (es, en) => (lang === 'es' ? es : en);
  /* Markdown mínimo y seguro: párrafos, listas con «- », **negrita**, *cursiva*, `código` y enlaces http(s) */
  function md(src) {
    const inline = s => esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, t, u) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`);
    return String(src || '').trim().split(/\n{2,}/).map(block => {
      const lines = block.split('\n');
      if (lines.every(l => /^\s*[-*•]\s+/.test(l))) return '<ul>' + lines.map(l => '<li>' + inline(l.replace(/^\s*[-*•]\s+/, '')) + '</li>').join('') + '</ul>';
      return '<p>' + lines.map(inline).join('<br>') + '</p>';
    }).join('');
  }
  function applyPatch(spec, p, warnings, lang) {
    const tr = trIn(lang);
    spec.nodes = spec.nodes || []; spec.edges = spec.edges || [];
    if (p.set && typeof p.set === 'object') for (const [k, v] of Object.entries(p.set)) if (k !== 'nodes' && k !== 'edges') spec[k] = v;
    const add = p.add || {};
    if (add.lanes) { spec.lanes = spec.lanes || []; for (const l of add.lanes) { const i = spec.lanes.findIndex(x => x.id === l.id); if (i >= 0) spec.lanes[i] = Object.assign({}, spec.lanes[i], l); else spec.lanes.push(l); } }
    for (const n of add.nodes || []) { const i = spec.nodes.findIndex(x => x.id === n.id); if (i >= 0) spec.nodes[i] = Object.assign({}, spec.nodes[i], n); else spec.nodes.push(n); }
    for (const e of add.edges || []) {
      const ed = Object.assign({}, e);
      if (!ed.id) { let base = `${ed.from}->${ed.to}`, id = base, k = 2; while (spec.edges.some(x => x.id === id)) id = base + ':' + k++; ed.id = id; }
      const i = spec.edges.findIndex(x => x.id === ed.id); if (i >= 0) spec.edges[i] = Object.assign({}, spec.edges[i], ed); else spec.edges.push(ed);
    }
    for (const f of add.flows || []) { spec.flows = spec.flows || []; const i = spec.flows.findIndex(x => x.id === f.id); if (i >= 0) spec.flows[i] = f; else spec.flows.push(f); }
    for (const u of p.update || []) {
      const n = spec.nodes.find(x => x.id === u.id) || spec.edges.find(x => x.id === u.id) || (spec.lanes || []).find(x => x.id === u.id);
      if (n) Object.assign(n, u); else warnings.push(tr(`parche: no hay ninguna pieza ni arista «${u.id}» que actualizar`, `patch: there is no node or edge «${u.id}» to update`));
    }
    if (p.remove && p.remove.length) {
      const gone = new Set(p.remove);
      let grew = true;
      while (grew) { grew = false; for (const n of spec.nodes) if (!gone.has(n.id) && n.parent && gone.has(n.parent)) { gone.add(n.id); grew = true; } }
      spec.nodes = spec.nodes.filter(n => !gone.has(n.id));
      spec.edges = spec.edges.filter(e => !gone.has(e.id) && !gone.has(e.from) && !gone.has(e.to));
      if (spec.lanes) spec.lanes = spec.lanes.filter(l => !gone.has(l.id));
    }
  }
  /* los datos en vivo acumulados (los de setData) se funden en la fuente: así los ve cualquier montaje */
  function applyData(spec, data) {
    if (!data) return;
    const byId = new Map((spec.nodes || []).map(n => [n.id, n]));
    for (const [id, v] of Object.entries(data.nodes || {})) { const n = byId.get(id); if (n && v && typeof v === 'object') Object.assign(n, v); }
    const eById = new Map((spec.edges || []).map(e => [e.id, e]));
    for (const [id, v] of Object.entries(data.edges || {})) { const e = eById.get(id); if (e && v && typeof v === 'object') Object.assign(e, v); }
  }
  function buildSpec(b) {
    const warnings = [];
    const lang = langOf(b), tr = trIn(lang);
    const src = b.source || { kind: 'spec', spec: { nodes: [] } };
    let spec, type = 'graphx';
    if (src.kind === 'mermaid') {
      if (!root.GraphX.fromMermaid) throw new Error(tr('El bundle de GraphX no trae el conversor de Mermaid', 'The GraphX bundle has no Mermaid converter'));
      const r = root.GraphX.fromMermaid(src.text, { lang });
      spec = r.spec; type = 'mermaid:' + r.type; (r.warnings || []).forEach(w => warnings.push('mermaid: ' + w));
    } else if (src.kind === 'paths') {
      spec = root.GraphX.tree.fromPaths(src.entries || [], Object.assign({ lang }, src.options || {})); type = 'tree';
    } else if (src.kind === 'tree-text') {
      spec = root.GraphX.tree.fromTreeText(src.text || '', Object.assign({ lang }, src.options || {})); type = 'tree';
    } else spec = clone(src.spec || {});
    for (const p of b.patches || []) applyPatch(spec, p, warnings, lang);
    applyData(spec, b.data);
    if (b.title) spec.title = b.title;
    if (b.lang && !spec.lang) spec.lang = b.lang;
    if (b.fx !== undefined && b.fx !== null) {
      if (b.fx === false || b.fx === 'off') spec.fx = false;
      else if (typeof b.fx === 'string') spec.fx = Object.assign({}, typeof spec.fx === 'object' && spec.fx ? spec.fx : {}, { preset: b.fx });
      else if (typeof b.fx === 'object') spec.fx = Object.assign({}, typeof spec.fx === 'object' && spec.fx ? spec.fx : {}, b.fx);
    }
    const ids = new Set((spec.nodes || []).map(n => n.id)), eids = new Set((spec.edges || []).map(e => e.id));
    const steps = (b.guide && b.guide.steps) || [];
    if (steps.length) {
      spec.tour = {
        title: (b.guide && b.guide.title) || tr('Recorrido', 'Tour'),
        steps: steps.map((s, i) => {
          const miss = (s.nodes || []).filter(id => !ids.has(id));
          if (miss.length) warnings.push(tr(`paso ${i + 1}: piezas desconocidas ${miss.join(', ')}`, `step ${i + 1}: unknown nodes ${miss.join(', ')}`));
          const st = { title: s.title || tr(`Paso ${i + 1}`, `Step ${i + 1}`), body_html: md(s.body || ''), focus: { nodes: (s.nodes || []).filter(id => ids.has(id)), edges: (s.edges || []).filter(id => eids.has(id)) } };
          if (s.expand) st.expand = s.expand.filter(id => ids.has(id));
          if (s.depth != null) st.depth = s.depth;
          if (s.select && ids.has(s.select)) st.select = s.select;
          if (s.view) st.view = s.view;
          return st;
        })
      };
    }
    return { spec, warnings, type };
  }
  /* lo que obliga a montar de nuevo: el grafo, el recorrido y los efectos; la cartelería, la vista y los datos
     en vivo no (los datos se aplican con setData sobre lo montado) */
  const structKey = b => JSON.stringify([b.source, b.patches, b.title, b.lang, b.fx, b.guide && b.guide.title, b.guide && b.guide.steps]);

  const plain = s => String(s || '').replace(/\*\*|`|\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  root.GXBoard = { md, plain, esc, applyPatch, applyData, buildSpec, structKey, langOf };
})(typeof window !== 'undefined' ? window : globalThis);
