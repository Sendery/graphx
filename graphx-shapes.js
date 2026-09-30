/* GraphX · formas.
 *
 * Las piezas de GraphX son tarjetas. Este módulo añade las formas que Mermaid sabe dibujar y
 * una tarjeta no: rombos, círculos, cilindros, hexágonos, notas, tablas de entidades y clases,
 * barras de gantt, commits, iconos de arquitectura, personas de C4…
 *
 * Cada forma es una función pura: dada la pieza (`node`), su tamaño y un contexto (medir texto,
 * orientación, rango de fechas), devuelve un árbol SVG descriptivo `{ tag, attrs, children, text }`.
 * No toca el DOM. El motor lo convierte en nodos SVG y el paquete de React en elementos de React,
 * así una forma se escribe una sola vez y se ve igual en los dos sitios.
 *
 * El contorno de cada forma lleva la clase `gx-card`: los efectos del motor (hover, iluminado,
 * selección, color de pieza `has-c`, deltas) funcionan igual que en una tarjeta.
 *
 *   GraphX.shapes.has(name)                       → bool
 *   GraphX.shapes.measure(node, ctx)              → { w, h, ... }  (tamaño para el layout)
 *   GraphX.shapes.render(node, w, h, ctx, lay)    → árbol SVG
 *   GraphX.shapes.names                           → lista de formas                                   */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GraphX = Object.assign(root.GraphX || {}, { shapes: api });
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  /* ---------- texto ---------- */
  /* estimador de ancho (el mismo que usa el motor cuando no hay canvas) */
  function estW(text, size, weight, mono) {
    if (mono) return String(text).length * size * .62;
    let w = 0; for (const ch of String(text)) w += /[A-ZÁÉÍÓÚÑ#@MW]/.test(ch) ? .7 : /[\s.,:;'|il]/.test(ch) ? .3 : /[0-9]/.test(ch) ? .56 : .54;
    return w * size * (weight >= 600 ? 1.05 : 1);
  }
  const tw = (ctx, t, size, weight, mono) => (ctx.textW || estW)(t, size, weight, mono);
  function fit(ctx, text, max, size, weight, mono) {
    text = String(text == null ? '' : text);
    if (tw(ctx, text, size, weight, mono) <= max) return text;
    let lo = 0, hi = text.length;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (tw(ctx, text.slice(0, m) + '…', size, weight, mono) <= max) lo = m; else hi = m - 1; }
    return text.slice(0, lo).trimEnd() + '…';
  }
  /* reparte un texto en como mucho `maxLines` líneas de `max` px; la última se recorta con … */
  function wrap(ctx, text, max, size, weight, maxLines, mono) {
    const lines = [];
    /* cada salto de línea escrito (<br> en Mermaid) empieza una línea nueva */
    String(text == null ? '' : text).split('\n').forEach(par => {
      const words = par.split(/\s+/).filter(Boolean); let cur = '';
      for (const w of words) {
        const t = cur ? cur + ' ' + w : w;
        if (!cur || tw(ctx, t, size, weight, mono) <= max) cur = t; else { lines.push(cur); cur = w; }
      }
      if (cur) lines.push(cur);
    });
    if (!lines.length) return [''];
    if (lines.length > maxLines) { const head = lines.slice(0, maxLines - 1); head.push(lines.slice(maxLines - 1).join(' ')); lines.length = 0; lines.push(...head); }
    return lines.map(l => fit(ctx, l, max, size, weight, mono));
  }
  const widest = (ctx, lines, size, weight, mono) => Math.max(0, ...lines.map(l => tw(ctx, l, size, weight, mono)));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const r1 = v => Math.round(v * 10) / 10;

  /* ---------- árbol ---------- */
  const E = (tag, attrs, children, text) => ({ tag, attrs: attrs || {}, children: children || [], text: text == null ? undefined : String(text) });
  const P = (d, cls, extra) => E('path', Object.assign({ d, class: cls }, extra || {}));
  const T = (x, y, text, cls, anchor, extra) => E('text', Object.assign({ x: r1(x), y: r1(y), class: cls, 'text-anchor': anchor || 'middle' }, extra || {}), null, text);
  /* un bloque de líneas centrado en (cx, cy): título en negrita y, debajo, el subtítulo */
  function textBlock(cx, cy, lines, sub, opt) {
    opt = opt || {};
    const lh = opt.lh || 17, total = lines.length * lh + (sub ? 15 : 0);
    let y = cy - total / 2 + 12.5;
    const out = lines.map(l => { const t = T(cx, y, l, opt.cls || 'gx-t', opt.anchor); y += lh; return t; });
    if (sub) out.push(T(cx, y - 2, sub, opt.subCls || 'gx-st', opt.anchor));
    return out;
  }

  /* ---------- geometría ---------- */
  /* rectángulo redondeado en (x, y) */
  const rectD = (w, h, r, x, y) => {
    x = x || 0; y = y || 0; r = Math.min(r, w / 2, h / 2);
    if (!r) return `M${x},${y}H${x + w}V${y + h}H${x}Z`;
    return `M${x + r},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}V${y + h - r}A${r},${r} 0 0 1 ${x + w - r},${y + h}H${x + r}A${r},${r} 0 0 1 ${x},${y + h - r}V${y + r}A${r},${r} 0 0 1 ${x + r},${y}Z`;
  };
  const circleD = (cx, cy, r) => `M${cx - r},${cy}A${r},${r} 0 1 1 ${cx + r},${cy}A${r},${r} 0 1 1 ${cx - r},${cy}Z`;
  const poly = pts => 'M' + pts.map(p => `${r1(p[0])},${r1(p[1])}`).join('L') + 'Z';
  /* nube: arcos hacia fuera entre puntos de una elipse */
  function cloudD(w, h) {
    const n = 11, cx = w / 2, cy = h / 2, rx = w / 2 - 7, ry = h / 2 - 6, pts = [];
    for (let i = 0; i < n; i++) { const a = Math.PI * 2 * i / n - Math.PI / 2; pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
    let d = `M${r1(pts[0][0])},${r1(pts[0][1])}`;
    for (let i = 1; i <= n; i++) { const p = pts[i % n], q = pts[i - 1], r = Math.hypot(p[0] - q[0], p[1] - q[1]) * .62; d += `A${r1(r)},${r1(r)} 0 0 1 ${r1(p[0])},${r1(p[1])}`; }
    return d + 'Z';
  }
  function bangD(w, h) {
    const n = 16, cx = w / 2, cy = h / 2, pts = [];
    for (let i = 0; i < n * 2; i++) { const a = Math.PI * i / n, k = i % 2 ? .74 : 1; pts.push([cx + (w / 2) * k * Math.cos(a), cy + (h / 2) * k * Math.sin(a)]); }
    return poly(pts);
  }

  /* ---------- formas con el texto en el centro (flowchart, mindmap, bloques) ---------- */
  /* `fit(tw, th)` da el tamaño a partir del texto; `outline(w, h)` el contorno; `box(w, h)` la zona
     donde va el texto; `lines` las líneas secundarias del dibujo (los lados de una subrutina…). */
  function flow(o) {
    return {
      family: 'flow',
      measure(n, ctx) {
        const maxW = Math.max(o.maxW || 170, n.maxWidth || 0);
        const lines = wrap(ctx, n.label, maxW, 13, 600, Math.max(o.maxLines || 2, String(n.label || '').split('\n').length));
        const sub = n.subtitle ? fit(ctx, n.subtitle, maxW, 11, 400, true) : '';
        const w0 = Math.max(widest(ctx, lines, 13, 600), sub ? tw(ctx, sub, 11, 400, true) : 0, 24);
        const h0 = lines.length * 17 + (sub ? 15 : 0);
        const z = o.fit(w0, h0, ctx);
        return { w: Math.round(z.w), h: Math.round(z.h), lines, sub };
      },
      render(n, w, h, ctx, lay) {
        const b = o.box ? o.box(w, h) : { x: 0, y: 0, w, h };
        const kids = [P(o.outline(w, h, ctx), 'gx-card' + (o.ghost ? ' ghost' : ''))];
        if (o.lines) kids.push(P(o.lines(w, h), 'gx-shl'));
        kids.push(...textBlock(b.x + b.w / 2, b.y + b.h / 2, lay.lines, lay.sub));
        return { children: kids, chrome: { x: b.x + b.w / 2 + 34, y: b.y + b.h - 8 } };
      }
    };
  }
  /* vértices de las formas poligonales: el contorno y el casco (donde se anclan las aristas) salen de aquí */
  const PTS = {
    hexagon: (w, h) => { const k = h * .28; return [[k, 0], [w - k, 0], [w, h / 2], [w - k, h], [k, h], [0, h / 2]]; },
    decision: (w, h) => [[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]],
    io: (w, h) => [[16, 0], [w, 0], [w - 16, h], [0, h]],
    'io-l': (w, h) => [[0, 0], [w - 16, 0], [w, h], [16, h]],
    trapezoid: (w, h) => [[16, 0], [w - 16, 0], [w, h], [0, h]],
    'trapezoid-t': (w, h) => [[0, 0], [w, 0], [w - 16, h], [16, h]],
    flag: (w, h) => [[0, 0], [w, 0], [w, h], [0, h], [17, h / 2]],
    triangle: (w, h) => [[w / 2, 0], [w, h], [0, h]],
    'triangle-down': (w, h) => [[0, 0], [w, 0], [w / 2, h]],
    'arrow-right': (w, h) => [[0, h * .2], [w - h * .5, h * .2], [w - h * .5, 0], [w, h / 2], [w - h * .5, h], [w - h * .5, h * .8], [0, h * .8]],
    'arrow-left': (w, h) => [[w, h * .2], [h * .5, h * .2], [h * .5, 0], [0, h / 2], [h * .5, h], [h * .5, h * .8], [w, h * .8]],
    'arrow-up': (w, h) => [[w * .2, h], [w * .2, w * .5], [0, w * .5], [w / 2, 0], [w, w * .5], [w * .8, w * .5], [w * .8, h]],
    'arrow-down': (w, h) => [[w * .2, 0], [w * .2, h - w * .5], [0, h - w * .5], [w / 2, h], [w, h - w * .5], [w * .8, h - w * .5], [w * .8, 0]],
    choice: (w, h) => [[w / 2, 1], [w - 1, h / 2], [w / 2, h - 1], [1, h / 2]]
  };
  const pad = (w0, h0, px, py, minW, maxW, minH) => ({ w: clamp(w0 + px, minW || 96, maxW || 260), h: Math.max(minH || 46, h0 + py) });

  const SHAPES = {
    rect: flow({ fit: (w, h) => pad(w, h, 36, 26), outline: (w, h) => rectD(w, h, 5) }),
    rounded: flow({ fit: (w, h) => pad(w, h, 38, 26), outline: (w, h) => rectD(w, h, 15) }),
    terminal: flow({ fit: (w, h) => { const hh = Math.max(46, h + 24); return { w: clamp(w + hh * .9 + 10, 96, 280), h: hh }; }, outline: (w, h) => rectD(w, h, h / 2) }),
    subroutine: flow({ fit: (w, h) => pad(w, h, 56, 26), outline: (w, h) => rectD(w, h, 3), lines: (w, h) => `M10,0V${h}M${w - 10},0V${h}` }),
    datastore: flow({
      fit: (w, h) => pad(w, h, 38, 42, 96, 240, 62),
      outline: (w, h) => `M0,8A${w / 2},8 0 0 1 ${w},8V${h - 8}A${w / 2},8 0 0 1 0,${h - 8}Z`,
      lines: w => `M0,8A${w / 2},8 0 0 0 ${w},8`,
      box: (w, h) => ({ x: 0, y: 12, w, h: h - 16 })
    }),
    'cylinder-h': flow({
      fit: (w, h) => pad(w, h, 52, 26),
      outline: (w, h) => `M10,0H${w - 10}A10,${h / 2} 0 0 1 ${w - 10},${h}H10A10,${h / 2} 0 0 1 10,0Z`,
      lines: (w, h) => `M${w - 10},0A10,${h / 2} 0 0 0 ${w - 10},${h}`,
      box: (w, h) => ({ x: 8, y: 0, w: w - 28, h })
    }),
    circle: flow({ maxW: 118, maxLines: 3, fit: (w, h) => { const d = clamp(Math.max(w, h * 1.25) + 30, 58, 176); return { w: d, h: d }; }, outline: (w) => circleD(w / 2, w / 2, w / 2) }),
    dcircle: flow({ maxW: 110, maxLines: 3, fit: (w, h) => { const d = clamp(Math.max(w, h * 1.25) + 40, 64, 184); return { w: d, h: d }; }, outline: (w) => circleD(w / 2, w / 2, w / 2), lines: (w) => circleD(w / 2, w / 2, w / 2 - 5) }),
    hexagon: flow({ fit: (w, h) => { const hh = Math.max(46, h + 26); return { w: clamp(w + hh * .56 + 26, 110, 290), h: hh }; }, outline: (w, h) => poly(PTS.hexagon(w, h)) }),
    decision: flow({
      maxW: 142,
      fit: (w, h) => { const W = clamp(w * 1.55 + 46, 104, 290); return { w: W, h: clamp(Math.max(h * 1.6 + 38, W * .5), 72, 160) }; },
      outline: (w, h) => poly(PTS.decision(w, h)),
      box: (w, h) => ({ x: w * .2, y: h * .2, w: w * .6, h: h * .6 })
    }),
    io: flow({ fit: (w, h) => pad(w, h, 64, 26, 110, 290), outline: (w, h) => poly(PTS.io(w, h)) }),
    'io-l': flow({ fit: (w, h) => pad(w, h, 64, 26, 110, 290), outline: (w, h) => poly(PTS['io-l'](w, h)) }),
    trapezoid: flow({ fit: (w, h) => pad(w, h, 64, 26, 110, 290), outline: (w, h) => poly(PTS.trapezoid(w, h)) }),
    'trapezoid-t': flow({ fit: (w, h) => pad(w, h, 64, 26, 110, 290), outline: (w, h) => poly(PTS['trapezoid-t'](w, h)) }),
    flag: flow({ fit: (w, h) => pad(w, h, 52, 26), outline: (w, h) => poly(PTS.flag(w, h)), box: (w, h) => ({ x: 14, y: 0, w: w - 14, h }) }),
    document: flow({ fit: (w, h) => pad(w, h, 38, 38, 96, 260, 58), outline: (w, h) => `M0,0H${w}V${h - 10}C${w * .75},${h - 23} ${w * .25},${h + 3} 0,${h - 10}Z`, box: (w, h) => ({ x: 0, y: 0, w, h: h - 10 }) }),
    cloud: flow({ fit: (w, h) => pad(w, h, 66, 44, 120, 300, 70), outline: (w, h) => cloudD(w, h), box: (w, h) => ({ x: w * .15, y: h * .15, w: w * .7, h: h * .7 }) }),
    bang: flow({ fit: (w, h) => pad(w, h, 78, 56, 130, 300, 84), outline: (w, h) => bangD(w, h), box: (w, h) => ({ x: w * .2, y: h * .2, w: w * .6, h: h * .6 }) }),
    triangle: flow({ maxW: 130, fit: (w, h) => { const W = clamp(w * 1.7 + 50, 110, 280); return { w: W, h: Math.max(h + W * .34, 70) }; }, outline: (w, h) => poly(PTS.triangle(w, h)), box: (w, h) => ({ x: w * .2, y: h * .42, w: w * .6, h: h * .55 }) }),
    'triangle-down': flow({ maxW: 130, fit: (w, h) => { const W = clamp(w * 1.7 + 50, 110, 280); return { w: W, h: Math.max(h + W * .34, 70) }; }, outline: (w, h) => poly(PTS['triangle-down'](w, h)), box: (w, h) => ({ x: w * .2, y: h * .04, w: w * .6, h: h * .55 }) }),
    hourglass: flow({ maxW: 120, fit: (w, h) => { const W = clamp(w + 50, 90, 220); return { w: W, h: Math.max(h + 44, 70) }; }, outline: (w, h) => poly([[0, 0], [w, 0], [0, h], [w, h]]), box: (w, h) => ({ x: 0, y: h * .3, w, h: h * .4 }) }),
    delay: flow({ fit: (w, h) => pad(w, h, 50, 26), outline: (w, h) => `M0,0H${w - h / 2}A${h / 2},${h / 2} 0 0 1 ${w - h / 2},${h}H0Z`, box: (w, h) => ({ x: 0, y: 0, w: w - h * .3, h }) }),
    card: flow({ fit: (w, h) => pad(w, h, 40, 26), outline: (w, h) => poly([[15, 0], [w, 0], [w, h], [0, h], [0, 15]]) }),
    text: flow({ fit: (w, h) => pad(w, h, 16, 12, 40, 280, 30), outline: (w, h) => rectD(w, h, 6), ghost: true }),
    'arrow-right': flow({ fit: (w, h) => { const hh = Math.max(54, h + 32); return { w: clamp(w + hh * .5 + 36, 110, 300), h: hh }; }, outline: (w, h) => poly(PTS['arrow-right'](w, h)), box: (w, h) => ({ x: 4, y: 0, w: w - h * .5, h }) }),
    'arrow-left': flow({ fit: (w, h) => { const hh = Math.max(54, h + 32); return { w: clamp(w + hh * .5 + 36, 110, 300), h: hh }; }, outline: (w, h) => poly(PTS['arrow-left'](w, h)), box: (w, h) => ({ x: h * .5, y: 0, w: w - h * .5 - 4, h }) }),
    'arrow-up': flow({ maxW: 110, fit: (w, h) => { const W = clamp(w + 44, 100, 220); return { w: W, h: Math.max(h + W * .5 + 24, 96) }; }, outline: (w, h) => poly(PTS['arrow-up'](w, h)), box: (w, h) => ({ x: w * .2, y: w * .45, w: w * .6, h: h - w * .45 }) }),
    'arrow-down': flow({ maxW: 110, fit: (w, h) => { const W = clamp(w + 44, 100, 220); return { w: W, h: Math.max(h + W * .5 + 24, 96) }; }, outline: (w, h) => poly(PTS['arrow-down'](w, h)), box: (w, h) => ({ x: w * .2, y: 0, w: w * .6, h: h - w * .45 }) })
  };

  /* ---------- nota ---------- */
  SHAPES.note = {
    family: 'note',
    measure(n, ctx) {
      const lines = wrap(ctx, n.label, 196, 12, 400, 6);
      const w = clamp(widest(ctx, lines, 12, 400) + 34, 120, 230);
      return { w: Math.round(w), h: lines.length * 16 + 24, lines };
    },
    render(n, w, h, ctx, lay) {
      const kids = [P(poly([[0, 0], [w - 14, 0], [w, 14], [w, h], [0, h]]), 'gx-card'), P(`M${w - 14},0V14H${w}`, 'gx-shl')];
      lay.lines.forEach((l, i) => kids.push(T(12, 20 + i * 16, l, 'gx-nt', 'start')));
      return { children: kids, chrome: { x: w - 8, y: h - 9 } };
    }
  };

  /* ---------- puntos y marcas: inicio, fin, uniones, commits ---------- */
  function dotBox(w, h, body, extra) {
    return { children: [E('rect', { class: 'gx-shhit', width: w, height: h })].concat(body, extra || []), chrome: null };
  }
  SHAPES.start = { family: 'dot', measure: () => ({ w: 26, h: 26 }), render: (n, w, h) => dotBox(w, h, [P(circleD(w / 2, h / 2, 9), 'gx-card gx-shfill')]) };
  SHAPES.end = { family: 'dot', measure: () => ({ w: 28, h: 28 }), render: (n, w, h) => dotBox(w, h, [P(circleD(w / 2, h / 2, 12), 'gx-card gx-shring'), P(circleD(w / 2, h / 2, 6.5), 'gx-shfill2')]) };
  SHAPES.junction = { family: 'dot', measure: () => ({ w: 16, h: 16 }), render: (n, w, h) => dotBox(w, h, [P(circleD(w / 2, h / 2, 5.5), 'gx-card gx-shfill')]) };
  SHAPES.choice = { family: 'dot', measure: () => ({ w: 34, h: 34 }), render: (n, w, h) => dotBox(w, h, [P(poly(PTS.choice(w, h)), 'gx-card')]) };
  /* barra de bifurcación: perpendicular al sentido del diagrama */
  SHAPES.fork = {
    family: 'dot',
    measure: (n, ctx) => ctx.dir === 'down' ? { w: 84, h: 12 } : { w: 12, h: 72 },
    render: (n, w, h) => dotBox(w, h, [P(rectD(w, h, 3), 'gx-card gx-shfill')])
  };
  /* commits de gitGraph: el punto va en el centro (ahí llegan las aristas), la etiqueta debajo y
     el tag encima. Los de fusión son un anillo; los destacados, un cuadrado; los de reversión, una cruz. */
  function commitShape(variant) {
    return {
      family: 'dot',
      measure(n, ctx) {
        const label = fit(ctx, n.label, 150, 11, 500), tag = n.badge ? fit(ctx, n.badge, 120, 10, 700) : '';
        return { w: Math.round(Math.max(34, tw(ctx, label, 11, 500) + 8, tag ? tw(ctx, tag, 10, 700) + 18 : 0)), h: 66, label, tag };
      },
      render(n, w, h, ctx, lay) {
        const cx = w / 2, cy = h / 2, body = [];
        if (variant === 'highlight') body.push(P(rectD(20, 20, 3, cx - 10, cy - 10), 'gx-card gx-shfill'));
        else if (variant === 'merge') body.push(P(circleD(cx, cy, 10.5), 'gx-card gx-shring gx-shthick'));
        else body.push(P(circleD(cx, cy, 10), 'gx-card gx-shfill'));
        if (variant === 'reverse') body.push(P(`M${cx - 4.5},${cy - 4.5}L${cx + 4.5},${cy + 4.5}M${cx + 4.5},${cy - 4.5}L${cx - 4.5},${cy + 4.5}`, 'gx-shx'));
        if (n.head) body.push(P(circleD(cx, cy, 15), 'gx-pulse'));
        const extra = [T(cx, cy + 27, lay.label, 'gx-dl')];
        if (lay.tag) {
          const tw0 = tw(ctx, lay.tag, 10, 700) + 12;
          extra.push(E('g', { class: 'gx-tag', transform: `translate(${r1(cx - tw0 / 2)},${cy - 32})` }, [
            P(`M0,0H${tw0}V15H${tw0 / 2 + 4}L${tw0 / 2},19L${tw0 / 2 - 4},15H0Z`, 'gx-tagbg'), T(tw0 / 2, 11, lay.tag, 'gx-tagt')]));
        }
        return dotBox(w, h, body, extra);
      }
    };
  }
  SHAPES.commit = commitShape('normal');
  SHAPES['commit-merge'] = commitShape('merge');
  SHAPES['commit-highlight'] = commitShape('highlight');
  SHAPES['commit-reverse'] = commitShape('reverse');

  /* ---------- tablas: entidades de ER, clases UML y requisitos ---------- */
  const MAX_ROWS = 14, ROW = 21;
  const VIS = { '+': 'pub', '-': 'priv', '#': 'prot', '~': 'pkg' };
  function tableShape(kind) {
    return {
      family: 'table',
      measure(n, ctx) {
        const rows = (n.rows || []).slice(0, MAX_ROWS);
        const more = Math.max(0, (n.rows || []).length - MAX_ROWS);
        const anno = kind === 'class' || kind === 'requirement' ? (n.subtitle || '') : '';
        const headH = anno ? 44 : 36;
        const keyW = kind === 'table' && rows.some(r => r.keys) ? 34 : 0;
        const visW = kind === 'class' && rows.some(r => r.vis) ? 14 : 0;
        const mono = kind === 'class';
        let rowW = 0;
        rows.forEach(r => { rowW = Math.max(rowW, keyW + visW + tw(ctx, r.name, 12, 500, mono) + (r.comment ? tw(ctx, r.comment, 11, 400) + 12 : 0) + (r.type ? tw(ctx, r.type, 11, 400, true) + 22 : 0)); });
        const headW = tw(ctx, n.label, 13, 700) + (kind === 'table' ? 52 : 28);
        const w = clamp(Math.max(rowW + 28, headW, anno ? tw(ctx, anno, 10.5, 500) + 24 : 0), kind === 'table' && !rows.length ? 120 : 170, 380);
        const sections = kind === 'class' ? 2 : 1;
        const body = rows.length ? rows.length * ROW + (more ? ROW : 0) + 8 + (kind === 'class' && rows.some(r => r.section === 'method') && rows.some(r => r.section !== 'method') ? 7 : 0) : (sections === 2 ? 26 : kind === 'table' ? 0 : 10);
        return { w: Math.round(w), h: headH + body, rows, more, headH, keyW, visW, anno, mono };
      },
      render(n, w, h, ctx, lay) {
        const H = lay.headH, empty = kind === 'table' && !lay.rows.length;
        const kids = [P(rectD(w, h, 9), 'gx-card'), P(empty ? rectD(w, h, 9) : `M0,${H}V9A9,9 0 0 1 9,0H${w - 9}A9,9 0 0 1 ${w},9V${H}Z`, 'gx-shhead')];
        if (!empty) kids.push(P(`M0,${H}H${w}`, 'gx-shl'));
        if (kind === 'table') {
          kids.push(E('glyph', { kind: n.kind || 'table', x: 10, y: 8, size: 21 }));
          kids.push(T(40, 23, fit(ctx, n.label, w - 52, 13, 700), 'gx-t gx-tht', 'start'));
        } else {
          if (lay.anno) kids.push(T(w / 2, 16, fit(ctx, lay.anno, w - 20, 10.5, 500), 'gx-tha'));
          kids.push(T(w / 2, lay.anno ? 34 : 23, fit(ctx, n.label, w - 24, 13, 700), 'gx-t gx-tht' + (n.abstract ? ' gx-abs' : '')));
        }
        let y = H + 4; let prevSec = null;
        lay.rows.forEach((r, i) => {
          if (kind === 'class' && prevSec && r.section !== prevSec) { kids.push(P(`M0,${y + 2}H${w}`, 'gx-shl')); y += 7; }
          prevSec = r.section;
          const row = [E('rect', { class: 'gx-row' + (i % 2 ? ' alt' : ''), x: 1, y, width: w - 2, height: ROW })];
          let x = 12;
          if (lay.keyW) { if (r.keys) { const kw = tw(ctx, r.keys, 9, 700) + 8; row.push(E('rect', { class: 'gx-key k-' + String(r.keys).split(/[\s,]+/)[0].toLowerCase(), x, y: y + 4, width: kw, height: 13, rx: 3 }), T(x + kw / 2, y + 14, r.keys, 'gx-keyt')); } x += lay.keyW; }
          if (lay.visW) { if (r.vis) row.push(T(x + 3, y + 15, r.vis, 'gx-vis v-' + (VIS[r.vis] || 'pkg'))); x += lay.visW; }
          const typeW = r.type ? Math.min(tw(ctx, r.type, 11, 400, true), (w - x) * .45) : 0;
          const room = w - x - 14 - (typeW ? typeW + 10 : 0), nameTxt = fit(ctx, r.name, room, 12, 500, lay.mono);
          row.push(T(x, y + 15, nameTxt, 'gx-rn' + (r.static ? ' gx-static' : '') + (r.abstract ? ' gx-abs' : '') + (lay.mono ? ' mono' : ''), 'start'));
          if (r.comment) { const nx = x + tw(ctx, nameTxt, 12, 500, lay.mono) + 8, left = room - (nx - x); if (left > 24) row.push(T(nx, y + 15, fit(ctx, r.comment, left, 11, 400), 'gx-rc', 'start')); }
          if (r.type) row.push(T(w - 12, y + 15, fit(ctx, r.type, typeW, 11, 400, true), 'gx-rt', 'end'));
          kids.push(E('g', { class: 'gx-trow' }, row));
          y += ROW;
        });
        if (lay.more) kids.push(T(w / 2, y + 15, '+' + lay.more, 'gx-rt'));
        if (kind === 'class' && !lay.rows.length) kids.push(P(`M0,${H + 13}H${w}`, 'gx-shl'));
        return { children: kids, chrome: { x: w - 10, y: 18 } };
      }
    };
  }
  SHAPES.table = tableShape('table');
  SHAPES.class = tableShape('class');
  SHAPES.requirement = tableShape('requirement');

  /* ---------- iconos: servicios de arquitectura y actores ---------- */
  /* una baldosa con el icono grande; la etiqueta, debajo */
  SHAPES.tile = {
    family: 'tile',
    measure(n, ctx) { const label = fit(ctx, n.label, 150, 12, 600); return { w: Math.round(Math.max(68, tw(ctx, label, 12, 600) + 12)), h: 68, label }; },
    render(n, w, h, ctx, lay) {
      const x = w / 2 - 30;
      return {
        children: [E('rect', { class: 'gx-shhit', width: w, height: h + 24 }), P(rectD(60, 60, 16, x, 4), 'gx-card'),
          E('glyph', { kind: n.kind || 'service', x: x + 12, y: 16, size: 36, bare: true }), T(w / 2, h + 16, lay.label, 'gx-tl gx-halo')],
        chrome: { x: x + 66, y: 10 }
      };
    }
  };
  SHAPES.actor = {
    family: 'tile',
    measure(n, ctx) { const label = fit(ctx, n.label, 160, 12, 600); return { w: Math.round(Math.max(70, tw(ctx, label, 12, 600) + 16)), h: 90, label }; },
    render(n, w, h, ctx, lay) {
      const c = w / 2;
      return {
        children: [E('rect', { class: 'gx-shhit', width: w, height: h }),
          P(`${circleD(c, 15, 10)}M${c},25V50M${c - 17},34H${c + 17}M${c},50L${c - 13},68M${c},50L${c + 13},68`, 'gx-card gx-fig'),
          T(c, 84, lay.label, 'gx-tl')],
        chrome: null
      };
    }
  };

  /* ---------- C4: cajas rellenas con nombre, tipo y descripción ---------- */
  function c4Shape(variant) {
    return {
      family: 'c4',
      measure(n, ctx) {
        const w = 226;
        const desc = n.summary ? wrap(ctx, n.summary, w - 30, 11.5, 400, 3) : [];
        const top = variant === 'person' ? 34 : variant === 'db' ? 14 : 0;
        return { w, h: top + 50 + desc.length * 15 + (desc.length ? 8 : 0), desc, top, name: fit(ctx, n.label, w - 30, 13.5, 700), sub: n.subtitle ? fit(ctx, n.subtitle, w - 30, 10.5, 500) : '' };
      },
      render(n, w, h, ctx, lay) {
        const t = lay.top;
        let outline;
        /* persona: la cabeza entera encima del cuerpo, separada por un hueco (sin borde que la cruce) */
        if (variant === 'person') outline = circleD(w / 2, 17, 15) + rectD(w, h - 36, 12, 0, 36);
        else if (variant === 'db') outline = `M0,10A${w / 2},10 0 0 1 ${w},10V${h - 10}A${w / 2},10 0 0 1 0,${h - 10}Z`;
        else if (variant === 'queue') outline = `M12,0H${w - 12}A12,${h / 2} 0 0 1 ${w - 12},${h}H12A12,${h / 2} 0 0 1 12,0Z`;
        else outline = rectD(w, h, 9);
        const kids = [P(outline, 'gx-card')];
        if (variant === 'db') kids.push(P(`M0,10A${w / 2},10 0 0 0 ${w},10`, 'gx-shl'));
        if (variant === 'queue') kids.push(P(`M${w - 12},0A12,${h / 2} 0 0 0 ${w - 12},${h}`, 'gx-shl'));
        let y = t + 24;
        kids.push(T(w / 2, y, lay.name, 'gx-c4n')); y += 16;
        if (lay.sub) { kids.push(T(w / 2, y, lay.sub, 'gx-c4s')); }
        y += 18;
        lay.desc.forEach(l => { kids.push(T(w / 2, y, l, 'gx-c4d')); y += 15; });
        return { children: kids, chrome: { x: w - 10, y: h - 10 } };
      }
    };
  }
  SHAPES.person = c4Shape('person');
  SHAPES.c4 = c4Shape('box');
  SHAPES['c4-db'] = c4Shape('db');
  SHAPES['c4-queue'] = c4Shape('queue');

  /* ---------- tarjetas con extras: gantt, journey, kanban, sankey, treemap ---------- */
  /* la misma tarjeta del motor (barra de acento, icono, título y subtítulo) con algo debajo */
  function cardBase(n, w, h, ctx, lay, opt) {
    opt = opt || {};
    const kids = [P(rectD(w, h, 10), 'gx-card')];
    if (!opt.noAccent) kids.push(E('rect', { class: 'gx-accent', x: 7, y: 12, width: 3, height: Math.max(h - 24, 4), rx: 1.5 }));
    kids.push(E('glyph', { kind: n.kind || 'other', x: 17, y: 17, size: 28 }));
    kids.push(T(55, 26, lay.l1, 'gx-t', 'start'));
    if (lay.l2) kids.push(T(55, 42, lay.l2, 'gx-t', 'start'));
    if (lay.sub) kids.push(T(55, lay.l2 ? 58 : 42, lay.sub, 'gx-st', 'start'));
    return kids;
  }
  function cardMeasure(n, ctx, w, extraH) {
    const lines = wrap(ctx, n.label, w - 70, 13, 600, 2);
    const sub = n.subtitle ? fit(ctx, n.subtitle, w - 66, 11, 400, true) : '';
    return { w, h: (lines.length > 1 ? 80 : 64) + extraH, l1: lines[0], l2: lines[1] || '', sub };
  }
  const ms = v => { if (v == null) return null; if (typeof v === 'number') return v; const t = Date.parse(String(v).length === 10 ? v + 'T00:00:00Z' : String(v).replace(' ', 'T') + (/Z|[+-]\d\d:?\d\d$/.test(v) ? '' : 'Z')); return isNaN(t) ? null : t; };
  SHAPES.bar = {
    family: 'card',
    /* ancho fijo: las pistas de todas las tareas quedan alineadas y leen como un gantt */
    measure: (n, ctx) => cardMeasure(n, ctx, 244, 14),
    render(n, w, h, ctx, lay) {
      const kids = cardBase(n, w, h, ctx, lay);
      const x0 = 55, x1 = w - 14, y = h - 17, span = ctx.span, s0 = ms(n.span && n.span.start), s1 = ms(n.span && n.span.end);
      kids.push(E('rect', { class: 'gx-bar-track', x: x0, y, width: x1 - x0, height: 6, rx: 3 }));
      if (span && s0 != null && span.max > span.min) {
        const f = v => x0 + (x1 - x0) * clamp((v - span.min) / (span.max - span.min), 0, 1);
        const a = f(s0), b = f(s1 != null ? s1 : s0);
        if (n.span.milestone || b - a < .5) kids.push(P(poly([[a, y - 3], [a + 6, y + 3], [a, y + 9], [a - 6, y + 3]]), 'gx-bar-ms'));
        else {
          kids.push(E('rect', { class: 'gx-bar-fill', x: r1(a), y, width: r1(Math.max(b - a, 4)), height: 6, rx: 3 }));
          if (n.span.live) kids.push(P(`M${r1(a + 2)},${y + 3}H${r1(Math.max(b - 2, a + 3))}`, 'gx-bar-live'));
        }
        if (ctx.now != null && ctx.now >= span.min && ctx.now <= span.max) { const xn = f(ctx.now); kids.push(P(`M${r1(xn)},${y - 5}V${y + 11}`, 'gx-bar-today')); }
      }
      return { children: kids, chrome: { x: w - 8, y: 18 } };
    }
  };
  SHAPES.score = {
    family: 'card',
    measure: (n, ctx) => cardMeasure(n, ctx, 212, 12),
    render(n, w, h, ctx, lay) {
      const kids = cardBase(n, w, h, ctx, lay), sc = clamp(Math.round(n.score || 0), 0, 5);
      for (let i = 0; i < 5; i++) kids.push(P(circleD(59 + i * 13, h - 15, 4.2), 'gx-pip' + (i < sc ? ' on' : '')));
      return { children: kids, chrome: { x: w - 8, y: h - 10 } };
    }
  };
  SHAPES.ticket = {
    family: 'card',
    measure(n, ctx) { const m = cardMeasure(n, ctx, 212, 16); m.badge = n.badge ? fit(ctx, n.badge, 90, 10, 600, true) : ''; return m; },
    render(n, w, h, ctx, lay) {
      const kids = cardBase(n, w, h, ctx, lay, { noAccent: true });
      /* franja de prioridad: los 4 px de arriba de la tarjeta, siguiendo sus esquinas */
      kids.splice(1, 0, P(`M2,4A10,10 0 0 1 10,0H${w - 10}A10,10 0 0 1 ${w - 2},4Z`, 'gx-tk-stripe'));
      if (lay.badge) { const bw = tw(ctx, lay.badge, 10, 600, true) + 12; kids.push(E('rect', { class: 'gx-tk-badge', x: 55, y: h - 24, width: bw, height: 15, rx: 4 }), T(55 + bw / 2, h - 13, lay.badge, 'gx-tk-bt')); }
      if (n.avatar) { kids.push(P(circleD(w - 20, h - 18, 10), 'gx-tk-av'), T(w - 20, h - 14.5, String(n.avatar).slice(0, 2).toUpperCase(), 'gx-tk-avt')); }
      return { children: kids, chrome: { x: w - (n.avatar ? 36 : 8), y: h - 10 } };
    }
  };
  SHAPES.flowbar = {
    family: 'card',
    measure: (n, ctx) => cardMeasure(n, ctx, 200, 0),
    render(n, w, h, ctx, lay) {
      const kids = cardBase(n, w, h, ctx, lay, { noAccent: true }), max = ctx.maxValue || 1, f = clamp((n.value || 0) / max, 0, 1);
      const bh = h - 20, fh = Math.max(4, bh * f);
      kids.push(E('rect', { class: 'gx-lvl-track', x: 6, y: 10, width: 5, height: bh, rx: 2.5 }), E('rect', { class: 'gx-lvl', x: 6, y: r1(10 + bh - fh), width: 5, height: r1(fh), rx: 2.5 }));
      return { children: kids, chrome: { x: w - 8, y: h - 10 } };
    }
  };
  /* hoja de treemap: el área crece con el valor */
  SHAPES.block = {
    family: 'card',
    measure(n, ctx) {
      const f = Math.sqrt(clamp((n.value || 0) / (ctx.maxValue || 1), 0, 1));
      const w = Math.round(132 + 150 * f), h = Math.round(64 + 76 * f);
      return { w, h, l1: fit(ctx, n.label, w - 24, 13, 600), f, val: n.subtitle || (n.value != null ? String(n.value) : '') };
    },
    render(n, w, h, ctx, lay) {
      /* el layout (treemap) decide el tamaño: el texto se ajusta a él y se calla si no cabe */
      const r = Math.min(10, w / 2, h / 2), fs = clamp(Math.min(14 + lay.f * 12, h * .38, w * .3), 10, 26);
      const kids = [P(rectD(w, h, r), 'gx-card'), E('rect', { class: 'gx-blk', x: 1, y: 1, width: Math.max(w - 2, 0), height: Math.max(h - 2, 0), rx: Math.max(r - 1, 0), style: `opacity:${r1(.1 + lay.f * .22)}` })];
      if (w >= 44 && h >= 30) kids.push(T(Math.min(12, w * .15), Math.min(24, h * .55), fit(ctx, n.label, w - Math.min(24, w * .3), 13, 600), 'gx-t', 'start'));
      if (w >= 40 && h >= 52 && lay.val) kids.push(T(w - Math.min(12, w * .15), h - 10, fit(ctx, lay.val, w - 16, fs, 700), 'gx-bignum', 'end', { style: `font-size:${r1(fs)}px` }));
      return { children: kids, chrome: w >= 60 && h >= 40 ? { x: w - 8, y: 18 } : null };
    }
  };

  /* ---------- barras de los layouts de gantt y sankey (su tamaño lo pone el layout) ---------- */
  /* barra de gantt: tan larga como su tarea; la etiqueta dentro si cabe, si no a la derecha; el hito, un rombo */
  SHAPES.gbar = {
    family: 'bar',
    measure(n, ctx) { const label = fit(ctx, n.label, 240, 12, 600); return { w: Math.round(tw(ctx, label, 12, 600) + 28), h: 24, label }; },
    render(n, w, h, ctx, lay) {
      const lw = tw(ctx, lay.label, 12, 600), kids = [];
      if (n.span && n.span.milestone) {
        kids.push(P(poly(PTS.decision(w, h)), 'gx-card gx-gbms'), T(w + 8, h / 2 + 4, lay.label, 'gx-gbt out', 'start'));
        return { children: kids, chrome: { x: w + lw + 52, y: h / 2 } };
      }
      const inside = lw + 16 <= w;
      kids.push(P(rectD(w, h, Math.min(6, h / 2)), 'gx-card'));
      /* en curso: una franja que avanza por el borde de abajo, sin tapar la etiqueta */
      if (n.span && n.span.live) kids.push(P(`M5,${h - 3}H${Math.max(w - 5, 6)}`, 'gx-bar-live gx-gbar-live'));
      kids.push(T(inside ? 9 : w + 8, h / 2 + 4, lay.label, 'gx-gbt' + (inside ? '' : ' out'), 'start'));
      return { children: kids, chrome: { x: inside ? w - 4 : w + lw + 52, y: h / 2 } };
    }
  };
  /* barra de sankey: fina, alta según el valor; la etiqueta, al lado (a la izquierda en la última columna) */
  SHAPES.sbar = {
    family: 'bar',
    measure(n, ctx) { return { w: 16, h: 40, label: fit(ctx, n.label, 200, 12, 600), sub: n.subtitle ? fit(ctx, n.subtitle, 160, 11, 400, true) : '' }; },
    render(n, w, h, ctx, lay) {
      const left = n.labelSide === 'left', x = left ? -9 : w + 9, a = left ? 'end' : 'start';
      const kids = [P(rectD(w, h, 3), 'gx-card gx-sbar'), T(x, h / 2 + (lay.sub ? -2 : 4), lay.label, 'gx-t', a)];
      if (lay.sub) kids.push(T(x, h / 2 + 13, lay.sub, 'gx-st', a));
      return { children: kids, chrome: null };
    }
  };

  /* ---------- API ---------- */
  const names = Object.keys(SHAPES);
  function measure(n, ctx) { const sh = SHAPES[n.shape]; return sh ? sh.measure(n, ctx || {}) : null; }
  function render(n, w, h, ctx, lay) {
    const sh = SHAPES[n.shape]; if (!sh) return null;
    ctx = ctx || {}; lay = lay || sh.measure(n, ctx);
    const out = sh.render(n, w, h, ctx, lay);
    return { family: sh.family, children: out.children, chrome: out.chrome };
  }
  /* Casco de una forma: dónde deben acabar las aristas. ELK las lleva hasta la caja; el motor las
     recorta contra esto para que toquen el rombo, el círculo o el punto, no el aire de alrededor.
     Las formas rectangulares no lo necesitan (su caja es su contorno). */
  const ell = (cx, cy, rx, ry) => ({ ellipse: [cx, cy, rx, ry] });
  const HULLS = {
    circle: (w, h) => ell(w / 2, h / 2, w / 2, h / 2), dcircle: (w, h) => ell(w / 2, h / 2, w / 2, h / 2),
    cloud: (w, h) => ell(w / 2, h / 2, w / 2 - 5, h / 2 - 4), bang: (w, h) => ell(w / 2, h / 2, w * .43, h * .43),
    start: (w, h) => ell(w / 2, h / 2, 9, 9), end: (w, h) => ell(w / 2, h / 2, 12, 12), junction: (w, h) => ell(w / 2, h / 2, 5.5, 5.5),
    commit: (w, h) => ell(w / 2, h / 2, 10, 10), 'commit-merge': (w, h) => ell(w / 2, h / 2, 12, 12), 'commit-highlight': (w, h) => ({ poly: [[w / 2 - 10, h / 2 - 10], [w / 2 + 10, h / 2 - 10], [w / 2 + 10, h / 2 + 10], [w / 2 - 10, h / 2 + 10]] }), 'commit-reverse': (w, h) => ell(w / 2, h / 2, 10, 10),
    tile: w => ({ poly: [[w / 2 - 30, 4], [w / 2 + 30, 4], [w / 2 + 30, 64], [w / 2 - 30, 64]] }),
    hourglass: (w, h) => ({ poly: [[w / 2 - 1, h / 2 - 1], [w / 2 + 1, h / 2 - 1], [w / 2 + 1, h / 2 + 1], [w / 2 - 1, h / 2 + 1]] }),
    actor: w => ({ poly: [[w / 2 - 19, 3], [w / 2 + 19, 3], [w / 2 + 19, 70], [w / 2 - 19, 70]] })
  };
  Object.keys(PTS).forEach(k => { if (!HULLS[k]) HULLS[k] = (w, h) => ({ poly: PTS[k](w, h) }); });
  function hull(n, w, h) { const f = HULLS[n && n.shape]; return f ? f(w, h) : null; }
  /* primer corte de la recta que va de `a` a `b` (y más allá) con el casco, en coordenadas del casco */
  function inHull(hl, p) {
    if (hl.ellipse) { const [cx, cy, rx, ry] = hl.ellipse; return ((p.x - cx) / rx) ** 2 + ((p.y - cy) / ry) ** 2 < 1; }
    let c = false; const q = hl.poly;
    for (let i = 0, j = q.length - 1; i < q.length; j = i++) if ((q[i][1] > p.y) !== (q[j][1] > p.y) && p.x < (q[j][0] - q[i][0]) * (p.y - q[i][1]) / (q[j][1] - q[i][1]) + q[i][0]) c = !c;
    return c;
  }
  function hit(hl, a, b) {
    /* desde dentro no hay «primera entrada»: se deja el punto como está */
    if (inHull(hl, a)) return null;
    const dx = b.x - a.x, dy = b.y - a.y; let best = Infinity;
    if (hl.ellipse) {
      const [cx, cy, rx, ry] = hl.ellipse, ox = (a.x - cx) / rx, oy = (a.y - cy) / ry, ex = dx / rx, ey = dy / ry;
      const A = ex * ex + ey * ey, B = 2 * (ox * ex + oy * ey), Cc = ox * ox + oy * oy - 1, D = B * B - 4 * A * Cc;
      if (A > 0 && D >= 0 && Cc > 0) { const t = (-B - Math.sqrt(D)) / (2 * A); if (t > 1e-6) best = t; }
    } else if (hl.poly) {
      const pts = hl.poly;
      for (let i = 0; i < pts.length; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length], sx = x2 - x1, sy = y2 - y1, den = dx * sy - dy * sx;
        if (Math.abs(den) < 1e-9) continue;
        const t = ((x1 - a.x) * sy - (y1 - a.y) * sx) / den, u = ((x1 - a.x) * dy - (y1 - a.y) * dx) / den;
        if (t > 1e-6 && u >= -1e-6 && u <= 1 + 1e-6 && t < best) best = t;
      }
    }
    return best === Infinity ? null : { x: a.x + dx * best, y: a.y + dy * best };
  }

  /* contorno solo (lo usa el motor para las copias apiladas de una pieza con hijos plegados) */
  function outlineOf(tree) { const c = tree.children.find(k => /\bgx-card\b/.test(k.attrs.class || '')); return c && c.tag === 'path' ? c.attrs.d : null; }

  /* ---------- marcadores de arista ---------- */
  /* Puntas para los dos extremos de una arista, en una caja de 20×20 que apunta a la derecha
     (x=20 es el extremo). `solid` se rellena con el color de la línea; `hollow`, con el lienzo;
     `line`, solo trazo (patas de gallo de ER). */
  const MARKERS = {
    arrow: { d: 'M2,4 L20,10 L2,16 z', fill: 'solid', w: 20 },
    triangle: { d: 'M1,2 L19,10 L1,18 z', fill: 'hollow', w: 20 },
    diamond: { d: 'M1,10 L10,4 L19,10 L10,16 z', fill: 'solid', w: 20 },
    odiamond: { d: 'M1,10 L10,4 L19,10 L10,16 z', fill: 'hollow', w: 20 },
    circle: { d: 'M5,10 a5,5 0 1 0 10,0 a5,5 0 1 0 -10,0', fill: 'hollow', w: 16 },
    cross: { d: 'M6,5 L16,15 M16,5 L6,15', fill: 'line', w: 18 },
    one: { d: 'M13,3 V17 M17,3 V17 M0,10 H20', fill: 'line', w: 20 },
    'zero-one': { d: 'M16,3 V17 M3,10 a4,4 0 1 0 8,0 a4,4 0 1 0 -8,0 M11,10 H20', fill: 'line-hollow', w: 20 },
    'one-many': { d: 'M9,3 V17 M11,10 L20,3 M11,10 L20,17 M0,10 H20', fill: 'line', w: 20 },
    'zero-many': { d: 'M1,10 a4,4 0 1 0 8,0 a4,4 0 1 0 -8,0 M9,10 L20,3 M9,10 L20,17 M9,10 H20', fill: 'line-hollow', w: 20 },
    lollipop: { d: 'M4,10 a6,6 0 1 0 12,0 a6,6 0 1 0 -12,0', fill: 'hollow', w: 16 },
    open: { d: 'M4,4 L19,10 L4,16', fill: 'line', w: 20 }
  };

  return { has: n => !!SHAPES[n], names, measure, render, outlineOf, hull, hit, markers: MARKERS, wrap, fit, estW, families: names.reduce((o, k) => (o[k] = SHAPES[k].family, o), {}) };
});
