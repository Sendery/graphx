/* GraphX · componentes de React.
 *
 * Las formas de GraphX (graphx-shapes.js) son funciones puras que devuelven un árbol SVG. Este
 * módulo convierte ese árbol en elementos de React, así que una forma se ve igual en el motor y en
 * una aplicación de React: mismas clases, mismos tokens, mismos efectos.
 *
 *   <GraphX spec={spec} />  o  <GraphX mermaid={texto} />   el diagrama entero (monta el motor)
 *   <GraphXShape node={{ label, shape: 'decision' }} />       una forma suelta
 *   <GraphXScope>…</GraphXScope>                              tokens de color para formas sueltas
 *   Shapes.Decision, Shapes.Table…                            un componente por forma
 *
 * Necesita React (16.8+) y graphx-shapes.js. `GraphX` necesita además el motor (graphx.js) y, para
 * `mermaid`, graphx-mermaid.js. Sin JSX: funciona cargado desde un <script> o desde un bundler.     */
(function (root, factory) {
  const gx = () => root.GraphX || {};
  if (typeof module === 'object' && module.exports) module.exports = factory(require('react'), gx);
  else {
    /* en un bundler con ESM, react/index.mjs llama a la fábrica con su React */
    root.GraphXReactFactory = factory;
    if (root.React) root.GraphXReact = factory(root.React, gx);
  }
})(typeof window !== 'undefined' ? window : globalThis, function (React, getGX) {
  'use strict';
  const h = React.createElement;
  const { useEffect, useMemo, useRef } = React;
  /* la última versión de un valor, sin que cambiarla dispare un efecto (callbacks de GraphX) */
  function useLatest(v) { const r = useRef(v); r.current = v; return r; }

  /* atributos del árbol → props de React: class → className, text-anchor → textAnchor, style → objeto */
  const camel = k => (/^(data|aria)-/.test(k) ? k : k.replace(/-([a-z])/g, (_, c) => c.toUpperCase()));
  function styleObj(str) {
    const o = {};
    String(str).split(';').forEach(d => { const i = d.indexOf(':'); if (i > 0) o[d.slice(0, i).trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = d.slice(i + 1).trim(); });
    return o;
  }
  function props(attrs, key) {
    const p = { key };
    for (const k in attrs) {
      if (k === 'class') p.className = attrs[k];
      else if (k === 'style') p.style = styleObj(attrs[k]);
      else p[camel(k)] = attrs[k];
    }
    return p;
  }
  /* el icono de una pieza: el mismo dibujo que el motor (fondo redondeado y trazo de 16×16) */
  function glyphEl(a, key, icons) {
    const d = icons[a.kind] || icons.other || '';
    if (a.bare) return h('path', { key, d, className: 'gx-glyph-ic gx-bigic', transform: `translate(${a.x},${a.y}) scale(${a.size / 16})` });
    return h('g', { key, className: 'gx-glyph', transform: `translate(${a.x},${a.y})` },
      h('rect', { width: a.size, height: a.size, rx: a.size * .28, className: 'gx-glyph-bg' }),
      h('path', { d, className: 'gx-glyph-ic', transform: `translate(5,5) scale(${(a.size - 10) / 16})` }));
  }
  function toReact(node, key, icons) {
    if (node.tag === 'glyph') return glyphEl(node.attrs, key, icons);
    const kids = node.children.map((c, i) => toReact(c, i, icons));
    if (node.text != null) kids.push(node.text);
    return h(node.tag, props(node.attrs, key), ...kids);
  }

  /* medir texto en el navegador (canvas) para que el tamaño coincida con el del motor */
  let ctx2d = null;
  function textW(text, size, weight, mono) {
    if (ctx2d === null) { try { ctx2d = document.createElement('canvas').getContext('2d') || false; } catch (_) { ctx2d = false; } }
    if (!ctx2d) return null;
    ctx2d.font = `${weight || 400} ${size}px ${mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'system-ui, -apple-system, "Segoe UI", sans-serif'}`;
    return ctx2d.measureText(String(text)).width;
  }

  /* Una forma suelta. `state`: 'lit' (iluminada) o 'sel' (seleccionada); `color`: el de la pieza;
     `delta`: added | modified | removed. El resto de la pieza (`rows`, `span`, `score`…) va en `node`. */
  function GraphXShape(p) {
    const GX = getGX(), S = GX.shapes;
    const node = Object.assign({ kind: 'other', label: '' }, p.node, p.shape ? { shape: p.shape } : null);
    const ctx = useMemo(() => {
      const est = S && S.estW;
      return { textW: (t, sz, w, m) => { const v = textW(t, sz, w, m); return v == null ? est(t, sz, w, m) : v; }, dir: p.dir || 'right', span: p.span || null, maxValue: p.maxValue || 1, now: p.now != null ? p.now : Date.now() };
    }, [p.dir, p.span, p.maxValue, p.now, S]);
    if (!S || !S.has(node.shape)) return null;
    const lay = S.measure(node, ctx);
    const w = p.width || lay.w, hh = p.height || lay.h;
    const tree = S.render(node, w, hh, ctx, lay);
    const icons = p.icons || GX.icons || {};
    const cls = ['gx-node', 'gx-leaf', 'gx-shape', 'fam-' + tree.family, 'sh-' + node.shape, 'd-' + (p.delta || node.delta || 'unchanged'), p.state || '', p.color ? 'has-c' : '', p.className || ''].filter(Boolean).join(' ');
    const pad = p.pad != null ? p.pad : 6;
    const g = h('g', { className: cls, style: p.color ? { '--gx-c': p.color } : undefined, transform: `translate(${pad},${pad})`, onClick: p.onClick, tabIndex: p.onClick ? 0 : undefined, role: p.onClick ? 'button' : undefined, 'aria-label': node.label },
      tree.children.map((c, i) => toReact(c, i, icons)));
    if (p.asGroup) return g;
    return h('svg', { className: 'gx-svg gx-shape-svg', width: w + pad * 2, height: hh + pad * 2, viewBox: `0 0 ${w + pad * 2} ${hh + pad * 2}`, role: 'img', 'aria-label': node.label }, g);
  }

  /* los tokens de color de GraphX (claro y oscuro) para formas fuera de un diagrama */
  function GraphXScope(p) {
    return h('div', { className: 'gx gx-scope' + (p.className ? ' ' + p.className : ''), style: p.style }, p.children);
  }

  /* El diagrama entero: monta el motor en un div y lo destruye al desmontar o al cambiar la
     entrada. Los errores de conversión de Mermaid llegan por `onError`. */
  function GraphX(p) {
    const ref = useRef(null);
    const { spec, mermaid, lang, height } = p;
    const cb = useLatest({ onReady: p.onReady, onError: p.onError, onWarnings: p.onWarnings });
    /* un spec escrito en línea es un objeto nuevo en cada render: se compara por contenido para no
       volver a montar el motor si no ha cambiado */
    const specKey = useMemo(() => (spec == null ? null : JSON.stringify(spec)), [spec]);
    useEffect(() => {
      const { onReady, onError, onWarnings } = cb.current;
      const GX = getGX(), host = ref.current;
      if (!host || !GX.mount) return undefined;
      let inst = null;
      try {
        let s = spec;
        if (mermaid != null) {
          if (!GX.fromMermaid) throw new Error('GraphX: falta graphx-mermaid.js para convertir Mermaid');
          const r = GX.fromMermaid(mermaid, { lang });
          s = r.spec;
          if (r.warnings.length && onWarnings) onWarnings(r.warnings);
        }
        if (!s) return undefined;
        inst = GX.mount(host, s, { lang, height });
        if (onReady) onReady(inst);
      } catch (e) { if (onError) onError(e); else if (typeof console !== 'undefined') console.error(e); }
      return () => { if (inst) inst.destroy(); };
    }, [specKey, mermaid, lang, height]);
    return h('div', { ref, className: 'gx-host' + (p.className ? ' ' + p.className : ''), style: p.style });
  }

  /* un componente por forma: <Shapes.Decision node={{ label: '¿Stock?' }} /> */
  const pascal = n => n.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase());
  const Shapes = {};
  const S0 = getGX().shapes;
  (S0 ? S0.names : []).forEach(name => {
    const C = p => h(GraphXShape, Object.assign({}, p, { shape: name }));
    C.displayName = 'GraphX.' + pascal(name);
    Shapes[pascal(name)] = C;
  });

  return { GraphX, GraphXShape, GraphXScope, Shapes, toReact };
});
