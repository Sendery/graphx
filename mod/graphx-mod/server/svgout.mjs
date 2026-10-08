/* Lo pintado por GraphX, fuera de la página: los tokens de color de cada tema, el SVG autocontenido y el PNG.
 *
 *   tokensFor(window, host, theme)   los tokens --gx-* resueltos a colores (#rrggbb) para ese tema y la piel
 *                                    que lleve el host: la paleta con la que el terminal pinta
 *   standaloneSVG(window, host, svg, { theme, flat, maxChars, interactive })
 *                                    el SVG con sus estilos podados (solo las reglas que tocan algo de lo
 *                                    pintado), los tokens del tema y, si no es `flat`, sus animaciones (CSS y
 *                                    SMIL: las partículas); `flat` lo deja todo resuelto para rsvg-convert
 *   rasterize(svg, { width })        PNG con rsvg-convert (si está en el PATH)
 *
 * La resolución de variables y de color-mix es la de tools/snapshot-svg.mjs, sobre las reglas podadas. */
import { execFileSync, execFile } from 'child_process';

/* ---------- color ---------- */
export function parseColor(c) {
  c = String(c || '').trim();
  let m = c.match(/^#([0-9a-f]{3,8})$/i);
  if (m) { let h = m[1]; if (h.length <= 4) h = [...h].map(x => x + x).join(''); return [0, 2, 4, 6].map(i => (i < h.length ? parseInt(h.slice(i, i + 2), 16) : 255)).map((x, i) => (i === 3 ? x / 255 : x)); }
  m = c.match(/^rgba?\(([^)]+)\)$/i);
  if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(v => (v.endsWith('%') ? parseFloat(v) / 100 : Number(v))); return [p[0], p[1], p[2], p[3] == null ? 1 : p[3]]; }
  m = c.match(/^hsla?\(([^)]+)\)$/i);
  if (m) {
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(v => parseFloat(v));
    const h = ((p[0] % 360) + 360) % 360 / 360, s = p[1] / 100, l = p[2] / 100;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, pp = 2 * l - q;
    const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? pp + (q - pp) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? pp + (q - pp) * (2 / 3 - t) * 6 : pp; };
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255, p[3] == null ? 1 : p[3]];
  }
  const NAMED = { transparent: [0, 0, 0, 0], white: [255, 255, 255, 1], black: [0, 0, 0, 1], red: [255, 0, 0, 1], green: [0, 128, 0, 1], blue: [0, 0, 255, 1], gray: [128, 128, 128, 1], grey: [128, 128, 128, 1], orange: [255, 165, 0, 1], yellow: [255, 255, 0, 1], purple: [128, 0, 128, 1], currentcolor: null };
  return NAMED[c.toLowerCase()] || null;
}
export const toHex = rgb => '#' + rgb.slice(0, 3).map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
/* un color con transparencia, aplanado sobre un fondo */
export function flatten(c, bg) {
  const a = parseColor(c), b = parseColor(bg) || [255, 255, 255, 1];
  if (!a) return null;
  const t = a[3] == null ? 1 : a[3];
  return toHex([0, 1, 2].map(i => a[i] * t + b[i] * (1 - t)));
}
function mixAll(v) {
  let prev;
  do {
    prev = v;
    v = v.replace(/color-mix\(in (?:srgb|oklab|oklch|lab|hsl),\s*([^,()]+(?:\([^()]*\))?)\s*(\d*\.?\d+)?%?,\s*([^()%]+?(?:\([^()]*\))?)\s*(\d*\.?\d+)?%?\)/g, (all, A, p, B, q) => {
      const a = parseColor(A), b = parseColor(B); if (!a || !b) return A.trim();
      const t = p != null ? +p / 100 : q != null ? 1 - +q / 100 : 0.5, al = a[3] * t + b[3] * (1 - t);
      const ch = i => (al ? Math.round((a[i] * a[3] * t + b[i] * b[3] * (1 - t)) / al) : 0);
      return `rgba(${ch(0)},${ch(1)},${ch(2)},${+al.toFixed(3)})`;
    });
  } while (v !== prev);
  return v;
}
const resolveWith = tok => v => {
  for (let i = 0; i < 8; i++) {
    const n = v.replace(/var\(--([\w-]+)(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/g, (_, k, fb) => (tok[k] != null ? tok[k] : (fb || '').trim()));
    if (n === v) break; v = n;
  }
  return mixAll(v);
};

/* ---------- CSS ---------- */
/* reglas de primer nivel (y las de dentro de @media / @supports), con su contexto */
function parseRules(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  const walk = (src, media) => {
    let i = 0;
    while (i < src.length) {
      const open = src.indexOf('{', i); if (open < 0) break;
      const head = src.slice(i, open).trim();
      let depth = 1, j = open + 1;
      while (j < src.length && depth) { if (src[j] === '{') depth++; else if (src[j] === '}') depth--; j++; }
      const body = src.slice(open + 1, j - 1);
      if (head.startsWith('@media') || head.startsWith('@supports')) walk(body, head);
      else if (head.startsWith('@keyframes') || head.startsWith('@-webkit-keyframes')) out.push({ kf: head.replace(/^@(-webkit-)?keyframes\s+/, '').trim(), text: `${head}{${body}}`, media });
      else if (head.startsWith('@')) { /* @font-face, @import…: fuera */ }
      else out.push({ sel: head, body: body.trim(), media });
      i = j;
    }
  };
  walk(css, null);
  return out;
}
const docCSS = w => [...w.document.querySelectorAll('style')].map(s => s.textContent).join('\n');
const mediaOk = (media, theme) => !media || (/prefers-color-scheme:\s*dark/.test(media) ? theme === 'dark' : /prefers-color-scheme:\s*light/.test(media) ? theme !== 'dark' : /@supports/.test(media));
const THEME_ROOT = /:root(\[data-theme(="(dark|light)")?\])?/g;
function themeSel(sel, theme) {
  /* `:root[data-theme="dark"] .gx …` solo vale en oscuro; `:root[data-theme] …`, `:root …`, en los dos */
  const m = /:root\[data-theme="(dark|light)"\]/.exec(sel);
  if (m && m[1] !== theme) return null;
  return sel.replace(THEME_ROOT, '').trim();
}

/* la especificidad de un selector (ids, clases/atributos/pseudoclases, elementos), como la cascada de CSS */
function specificity(sel) {
  const s = sel.replace(/::?[\w-]+\(([^)]*)\)/g, (m, inner) => (/^:not|^:is|^:where/.test(m) ? ' ' + inner : ' x')).replace(/::[\w-]+/g, ' a');
  const ids = (s.match(/#[\w-]+/g) || []).length;
  const cls = (s.match(/\.[\w-]+|\[[^\]]+\]|:[\w-]+/g) || []).length;
  const els = (s.replace(/#[\w-]+|\.[\w-]+|\[[^\]]+\]|:[\w-]+/g, ' ').match(/(^|[\s>+~])[a-zA-Z][\w-]*/g) || []).length;
  return ids * 10000 + cls * 100 + els;
}
/* los tokens --gx-* que valen para el host en ese tema, por especificidad y después por orden (la cascada de CSS) */
function cascade(rules, host, theme) {
  const hits = [];
  rules.forEach((r, order) => {
    if (!r.sel || !mediaOk(r.media, theme) || !/--gx-[\w-]+\s*:/.test(r.body)) return;
    let best = -1;
    for (const raw of r.sel.split(',')) {
      const s = themeSel(raw.trim(), theme);
      if (s == null) continue;
      let ok = !s;
      if (!ok) { try { ok = host.matches(s); } catch (_) { ok = false; } }
      if (ok) best = Math.max(best, specificity(raw.trim()));
    }
    if (best >= 0) hits.push({ r, spec: best, order });
  });
  hits.sort((a, b) => a.spec - b.spec || a.order - b.order);
  const raw = {};
  for (const { r } of hits) r.body.replace(/--(gx-[\w-]+)\s*:\s*([^;]+);?/g, (_, k, v) => { raw[k] = v.trim(); });
  return raw;
}
export function tokensFor(w, host, theme) {
  const rules = parseRules(docCSS(w));
  const raw = cascade(rules, host, theme);
  /* las del propio host (colores de la instancia: --gx-u0…) */
  const inst = host.getAttribute('style') || '';
  inst.replace(/--(gx-[\w-]+)\s*:\s*([^;]+);?/g, (_, k, v) => { raw[k] = v.trim(); });
  for (const st of host.querySelectorAll(':scope > style')) st.textContent.replace(/--(gx-[\w-]+)\s*:\s*([^;]+);?/g, (_, k, v) => { if (theme === 'dark' || !/dark/.test(st.textContent.slice(0, st.textContent.indexOf(k)))) raw[k] = v.trim(); });
  const res = resolveWith(raw);
  const canvas = flatten(res(raw['gx-canvas'] || (theme === 'dark' ? '#0d1117' : '#ffffff')), theme === 'dark' ? '#0d1117' : '#ffffff') || (theme === 'dark' ? '#0d1117' : '#ffffff');
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    const val = res(v);
    if (!parseColor(val)) continue;
    out[k.replace(/^gx-/, '')] = flatten(val, canvas);
  }
  out.canvas = canvas;
  return out;
}

/* la caja del contenido de un SVG (para la secuencia, que no tiene bbox en el estado) */
function contentBox(world) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x, y) => { if (!Number.isFinite(x) || !Number.isFinite(y)) return; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  const off = el => { let x = 0, y = 0; for (let c = el.parentNode; c && c !== world.parentNode; c = c.parentNode) { const t = c.getAttribute && c.getAttribute('transform'); const m = t && /translate\(\s*([-\d.e]+)[ ,]+([-\d.e]+)/.exec(t); if (m && c !== world) { x += +m[1]; y += +m[2]; } } return [x, y]; };
  for (const el of world.querySelectorAll('rect, text, path, circle, line')) {
    if (el.closest('defs')) continue;
    const [ox, oy] = off(el);
    const t = el.tagName.toLowerCase();
    if (t === 'rect') { const x = +el.getAttribute('x') || 0, y = +el.getAttribute('y') || 0; add(x + ox, y + oy); add(x + ox + (+el.getAttribute('width') || 0), y + oy + (+el.getAttribute('height') || 0)); }
    else if (t === 'text') { const x = +el.getAttribute('x') || 0, y = +el.getAttribute('y') || 0; add(x + ox, y + oy - 12); add(x + ox + el.textContent.length * 7, y + oy + 4); }
    else if (t === 'circle') { const r = +el.getAttribute('r') || 0; add(ox + (+el.getAttribute('cx') || 0) - r, oy + (+el.getAttribute('cy') || 0) - r); add(ox + (+el.getAttribute('cx') || 0) + r, oy + (+el.getAttribute('cy') || 0) + r); }
    else if (t === 'path') { const n = (el.getAttribute('d') || '').match(/-?\d*\.?\d+/g); if (n && /^\s*M/.test(el.getAttribute('d'))) for (let i = 0; i + 1 < n.length; i += 2) { const a = +n[i], b = +n[i + 1]; if (Math.abs(a) < 1e5 && Math.abs(b) < 1e5) add(a + ox, b + oy); } }
  }
  if (!Number.isFinite(x0)) return { x: 0, y: 0, w: 100, h: 100 };
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

const DYNAMIC = /:(hover|focus|focus-visible|focus-within|active|visited|target)\b|::?(before|after|placeholder|selection)\b/g;
function selectorHits(root, sel) {
  const s = sel.replace(DYNAMIC, '').replace(/:not\(\s*\)/g, '').trim();
  if (!s) return false;
  try { return root.matches(s) || !!root.querySelector(s); } catch (_) { return false; }
}

export function standaloneSVG(w, host, src, opts = {}) {
  const theme = opts.theme === 'dark' ? 'dark' : 'light';
  const flat = !!opts.flat;
  const maxChars = opts.maxChars == null ? 131072 : opts.maxChars;
  const clone = src.cloneNode(true);
  const world = clone.querySelector('.gx-world');
  let box;
  if (opts.bbox) box = { x: opts.bbox.x, y: opts.bbox.y, w: opts.bbox.w, h: opts.bbox.h };
  if (world) { world.setAttribute('transform', ''); if (!box) box = contentBox(world); }
  if (!box) box = { x: 0, y: 0, w: 800, h: 600 };
  const pad = 16;
  const vb = [box.x - pad, box.y - pad, box.w + 2 * pad, box.h + 2 * pad].map(v => Math.round(v * 10) / 10);
  /* fuera lo que solo sirve para el ratón en la página */
  clone.querySelectorAll('.gx-ehit, .gx-shhit, .gx-mini, .gx-tip').forEach(el => el.remove());
  clone.querySelectorAll('[tabindex], [role]').forEach(el => { el.removeAttribute('tabindex'); el.removeAttribute('role'); });
  if (flat) clone.querySelectorAll('.gx-pt, animate, animateMotion, animateTransform, set').forEach(el => el.remove());
  const cls = [...host.classList].concat((clone.getAttribute('class') || '').split(/\s+/)).filter(Boolean);
  clone.setAttribute('class', [...new Set(cls)].join(' '));
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('viewBox', vb.join(' '));
  clone.setAttribute('width', String(Math.round(vb[2])));
  clone.setAttribute('height', String(Math.round(vb[3])));
  clone.setAttribute('data-theme', theme);
  clone.removeAttribute('style');

  /* reglas podadas: las que tocan algo de lo pintado */
  const tok = {};
  const tokens = tokensFor(w, host, theme);
  /* también los tokens que no son colores (anchos, radios, sombras): los necesitan las reglas */
  const rules = parseRules(docCSS(w));
  Object.assign(tok, cascade(rules, host, theme));
  for (const [k, v] of Object.entries(tokens)) tok['gx-' + k] = v;
  /* los colores por elemento de la instancia (--gx-u0…): en el <style> del host */
  const instCSS = [...host.querySelectorAll(':scope > style')].map(s => s.textContent).join('\n');
  for (const r of parseRules(instCSS)) {
    const s = r.sel ? themeSel(r.sel, theme) : null;
    if (s == null && r.sel) continue;
    if (!mediaOk(r.media, theme)) continue;
    (r.body || '').replace(/--(gx-[\w-]+)\s*:\s*([^;]+);?/g, (_, k, v) => { tok[k] = v.trim(); });
  }
  const res = resolveWith(tok);
  const kept = [];
  const usedAnim = new Set();
  for (const r of rules) {
    if (r.kf || !r.sel || !mediaOk(r.media, theme) || /prefers-reduced-motion/.test(r.media || '')) continue;
    let body = r.body.replace(/--gx-[\w-]+\s*:[^;]+;?/g, '').trim();
    if (!body) continue;
    const sels = r.sel.split(',').map(s => themeSel(s.trim(), theme)).filter(s => s != null && s && !/\.gx-(bar|stage|panel|tour|tl|legend|mini|tip|search|zoom|tools|views|btn)\b/.test(s) && !/^(html|body)\b/.test(s));
    const hit = sels.filter(s => selectorHits(clone, s));
    if (!hit.length) continue;
    if (flat) body = body.replace(/(^|;)\s*(animation|transition)[\w-]*\s*:[^;]+/g, '$1').replace(/filter:\s*drop-shadow[^;]+;?/g, '');
    else body.replace(/animation(?:-name)?\s*:\s*([^;]+)/g, (_, v) => { v.split(/[\s,]+/).forEach(n => usedAnim.add(n)); });
    if (!body.replace(/;/g, '').trim()) continue;
    kept.push({ sel: hit.join(','), body });
  }
  const kfs = flat ? [] : rules.filter(r => r.kf && usedAnim.has(r.kf) && !/prefers-reduced-motion/.test(r.media || '')).map(r => r.text);

  let css;
  if (flat) {
    /* rsvg no entiende variables: cada --gx-c/-f/-tc de un elemento pasa a una clase y sus reglas se duplican */
    const VARS = { c: ['has-c', 'hc'], f: ['has-f', 'hf'], tc: ['has-t', 'ht'], h: ['has-h', 'hh'] };
    const pairs = new Map();
    for (const el of clone.querySelectorAll('[style*="--gx-"]')) {
      const add = [];
      const rest = el.getAttribute('style').replace(/--gx-(c|f|tc|h)\s*:\s*([^;]+);?/g, (m, k, v) => {
        const val = res(v.trim());
        const name = `${VARS[k][1]}-${Math.abs(hash(val)).toString(36)}`;
        pairs.set(name, { k, val });
        add.push(name);
        return '';
      }).trim();
      if (add.length) el.setAttribute('class', ((el.getAttribute('class') || '') + ' ' + add.join(' ')).trim());
      if (rest) el.setAttribute('style', res(rest)); else el.removeAttribute('style');
    }
    let extra = '';
    for (const [name, { k, val }] of pairs) {
      const has = new RegExp(`\\.${VARS[k][0]}\\b`), hasAll = new RegExp(`\\.${VARS[k][0]}\\b`, 'g');
      for (const r of kept) {
        const sel = r.sel.split(',').filter(s => has.test(s)).map(s => s.replace(hasAll, `.${name}`)).join(',');
        if (sel) extra += `${sel}{${r.body.replace(new RegExp(`var\\(--gx-${k}(,[^)]*)?\\)`, 'g'), val)}}`;
      }
    }
    for (const el of clone.querySelectorAll('[style*="var("]')) el.setAttribute('style', res(el.getAttribute('style')));
    for (const el of clone.querySelectorAll('[fill*="var("], [stroke*="var("]')) { for (const a of ['fill', 'stroke']) { const v = el.getAttribute(a); if (v && v.includes('var(')) el.setAttribute(a, res(v)); } }
    css = kept.map(r => `${r.sel}{${res(r.body)}}`).join('') + res(extra);
  } else {
    const root = Object.entries(tok).filter(([k]) => k.startsWith('gx-')).map(([k, v]) => `--${k}:${v}`).join(';');
    css = `svg{${root}}` + kept.map(r => `${r.sel}{${r.body}}`).join('') + kfs.join('');
  }
  css = `text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}` + css;
  const bg = tokens.canvas;
  const styleEl = w.document.createElementNS('http://www.w3.org/2000/svg', 'style');
  styleEl.textContent = css.replace(/]]>/g, ']] >');
  const bgEl = w.document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bgEl.setAttribute('x', String(vb[0])); bgEl.setAttribute('y', String(vb[1])); bgEl.setAttribute('width', String(vb[2])); bgEl.setAttribute('height', String(vb[3])); bgEl.setAttribute('fill', bg);
  clone.insertBefore(bgEl, clone.firstChild);
  clone.insertBefore(styleEl, clone.firstChild);
  let out = clone.outerHTML;
  /* más corto: números con un decimal */
  out = out.replace(/(\d+\.\d)\d+/g, '$1');
  let trimmed = [];
  if (out.length > maxChars && !flat) {
    /* sin partículas ni animaciones, si no cabe */
    clone.querySelectorAll('.gx-pt, animate, animateMotion, animateTransform, set').forEach(el => el.remove());
    out = clone.outerHTML.replace(/(\d+\.\d)\d+/g, '$1'); trimmed.push('animaciones');
  }
  if (out.length > maxChars) {
    clone.querySelectorAll('title, desc').forEach(el => el.remove());
    out = clone.outerHTML.replace(/(\d+\.\d)\d+/g, '$1').replace(/(\d+)\.\d/g, '$1'); trimmed.push('tooltips');
  }
  return { svg: out, chars: out.length, fits: out.length <= maxChars, trimmed, w: Math.round(vb[2]), h: Math.round(vb[3]), bg };
}
function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

/* ---------- PNG ---------- */
let rsvgOk = null;
export function hasRsvg() {
  if (rsvgOk != null) return rsvgOk;
  try { execFileSync('rsvg-convert', ['--version'], { stdio: 'ignore', timeout: 4000 }); rsvgOk = true; } catch (_) { rsvgOk = false; }
  return rsvgOk;
}
export function rasterize(svg, opts = {}) {
  return new Promise((resolve, reject) => {
    const args = ['-f', 'png'];
    if (opts.width) args.push('-w', String(Math.round(opts.width)));
    else args.push('-z', String(opts.zoom || 1));
    const p = execFile('rsvg-convert', args, { encoding: 'buffer', maxBuffer: 64 << 20, timeout: 20000 }, (err, stdout) => (err ? reject(err) : resolve(stdout)));
    p.stdin.end(svg);
  });
}

/* ---------- PNG → píxeles (lo que saca rsvg-convert: RGBA de 8 bits, sin entrelazado) ---------- */
import zlib from 'zlib';
export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('no es un PNG');
  let off = 8, w = 0, h = 0, depth = 8, ctype = 6;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString('ascii', off + 4, off + 8), data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; ctype = data[9]; if (data[12]) throw new Error('PNG entrelazado'); }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (depth !== 8 || (ctype !== 6 && ctype !== 2)) throw new Error(`PNG de ${depth} bits y tipo ${ctype}`);
  const bpp = ctype === 6 ? 4 : 3, stride = w * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? line[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      line[i] = v & 255;
    }
    for (let x = 0; x < w; x++) { const s = x * bpp, d = (y * w + x) * 4; out[d] = line[s]; out[d + 1] = line[s + 1]; out[d + 2] = line[s + 2]; out[d + 3] = bpp === 4 ? line[s + 3] : 255; }
    prev = line;
  }
  return { w, h, rgba: out };
}
/* píxeles → las celdas de un Raster: medio bloque ▀ con la tinta arriba y el fondo abajo (dos píxeles por celda) */
export function halfBlocks(img, cols, rows, bg = [13, 17, 23]) {
  const words = new Uint32Array(cols * rows * 3);
  const px = (x, y) => {
    /* la media del recuadro que cae en ese píxel de destino */
    const x0 = Math.floor((x * img.w) / cols), x1 = Math.max(x0 + 1, Math.floor(((x + 1) * img.w) / cols));
    const y0 = Math.floor((y * img.h) / (rows * 2)), y1 = Math.max(y0 + 1, Math.floor(((y + 1) * img.h) / (rows * 2)));
    /* la media y el píxel que más se aparta del fondo: las líneas finas y el texto no se pierden al reducir */
    let r = 0, g = 0, b = 0, n = 0, best = -1, sr = 0, sg = 0, sb = 0;
    for (let yy = y0; yy < Math.min(y1, img.h); yy++) for (let xx = x0; xx < Math.min(x1, img.w); xx++) {
      const i = (yy * img.w + xx) * 4, a = img.rgba[i + 3] / 255;
      const pr = img.rgba[i] * a + bg[0] * (1 - a), pg = img.rgba[i + 1] * a + bg[1] * (1 - a), pb = img.rgba[i + 2] * a + bg[2] * (1 - a);
      r += pr; g += pg; b += pb; n++;
      const d = Math.abs(pr - bg[0]) + Math.abs(pg - bg[1]) + Math.abs(pb - bg[2]);
      if (d > best) { best = d; sr = pr; sg = pg; sb = pb; }
    }
    if (!n) return (bg[0] << 16) | (bg[1] << 8) | bg[2];
    const k = 0.65;
    return (Math.round(r / n * (1 - k) + sr * k) << 16) | (Math.round(g / n * (1 - k) + sg * k) << 8) | Math.round(b / n * (1 - k) + sb * k);
  };
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const i = (y * cols + x) * 3;
    words[i] = 0x2580; words[i + 1] = px(x, y * 2); words[i + 2] = px(x, y * 2 + 1);
  }
  return Buffer.from(words.buffer).toString('base64');
}
