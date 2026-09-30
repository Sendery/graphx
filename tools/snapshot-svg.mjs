/* Resuelve los tokens CSS (tema claro u oscuro) y rasteriza el snapshot con rsvg-convert. */
import fs from 'fs'; import { execFileSync } from 'child_process';
const [, , inp, out, theme = 'light'] = process.argv;
/* sin comentarios: el SVG es XML, y un comentario con `<kind>` o `&` dentro del <style> lo invalida
   (ademas, un comentario delante de una regla .has-c se colaba en su selector) */
const css = fs.readFileSync(new URL('../graphx.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const tok = {};
const grab = block => block.replace(/--([\w-]+)\s*:\s*([^;]+);/g, (_, k, v) => { tok[k] = v.trim(); });
for (const m of css.matchAll(/(^|\n)\.gx \{([\s\S]*?)\n\}/g)) grab(m[2]);
if (theme === 'dark') for (const m of css.matchAll(/:root\[data-theme="dark"\] \.gx \{([^}]*)\}/g)) grab(m[1]);
const res = v => { for (let i = 0; i < 6; i++) v = v.replace(/var\(--([\w-]+)(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/g, (_, k, fb) => tok[k] || (fb || '').trim()); return mixAll(v); };
/* color-mix(in srgb, A p%, B) resuelto de verdad, como hace el navegador */
function parseC(c) {
  c = c.trim();
  let m = c.match(/^#([0-9a-f]{3,8})$/i);
  if (m) { let h = m[1]; if (h.length <= 4) h = [...h].map(x => x + x).join(''); return [0, 2, 4, 6].map(i => i < h.length ? parseInt(h.slice(i, i + 2), 16) : 255).map((x, i) => i === 3 ? x / 255 : x); }
  m = c.match(/^rgba?\(([^)]+)\)$/i);
  if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] == null ? 1 : p[3]]; }
  if (c === 'transparent') return [0, 0, 0, 0];
  return null;
}
function mixAll(v) {
  let prev;
  do {
    prev = v;
    v = v.replace(/color-mix\(in srgb,\s*([^,()]+(?:\([^()]*\))?)\s+(\d+)%,\s*([^()]+(?:\([^()]*\))?)\)/g, (all, A, p, B) => {
      const a = parseC(A), b = parseC(B); if (!a || !b) return A.trim();
      const t = +p / 100, al = a[3] * t + b[3] * (1 - t);
      const ch = i => al ? Math.round((a[i] * a[3] * t + b[i] * b[3] * (1 - t)) / al) : 0;
      return `rgba(${ch(0)},${ch(1)},${ch(2)},${+al.toFixed(3)})`;
    });
  } while (v !== prev);
  return v;
}
let rules = css.replace(/@media[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '').replace(/:root\[data-theme="dark"\] \.gx \{[^}]*\}/g, '').replace(/(^|\n)\.gx \{[\s\S]*?\n\}/g, '');
rules = res(rules).replace(/animation:[^;]+;/g, '').replace(/filter:\s*drop-shadow[^;]+;/g, '');
let svg = fs.readFileSync(inp, 'utf8');
/* colores por elemento: rsvg no entiende variables CSS, así que cada --gx-c se convierte en una
   clase y las reglas .has-c se duplican con el color ya resuelto */
const themeAttr = (svg.match(/data-gx-theme="([^"]*)"/) || [])[1] || '';
const inst = themeAttr.replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
const block = theme === 'dark' ? (inst.match(/:root\[data-theme="dark"\][^{]*\{([^}]*)\}/) || [])[1] : (inst.match(/^[^{]*\{([^}]*)\}/) || [])[1];
(block || '').split(';').forEach(d => { const m = d.match(/--gx-([\w-]+):(.+)/); if (m) tok[m[1]] = m[2].trim(); });
const hasC = [...css.matchAll(/([^{}]*\.has-c[^{}]*)\{([^}]*)\}/g)];
let extra = '';
svg = svg.replace(/style="--gx-c: var\(--gx-(u\d+)\);?"/g, (_, u) => `class-c="${u}"`).replace(/class="([^"]*)"([^>]*?)class-c="(u\d+)"/g, '$2class="$1 hc-$3"');
svg = svg.replace(/class-c="(u\d+)"([^>]*?)class="([^"]*)"/g, '$2class="$3 hc-$1"');
for (const u of new Set([...svg.matchAll(/hc-(u\d+)/g)].map(m => m[1]))) {
  const col = tok[u]; if (!col) continue;
  for (const [, sel, body] of hasC) extra += sel.split(',').map(x => x.replace(/\.has-c/g, '.hc-' + u).trim()).join(',') + '{' + body.replace(/var\(--gx-c\)/g, col) + '}';
}
/* variables en atributos style (puntas de arista, rellenos calculados): también se resuelven */
svg = svg.replace(/style="([^"]*var\(--[^"]*)"/g, (m, st) => `style="${res(st.replace(/&quot;/g, '"'))}"`);
const bg = res('var(--gx-canvas)');
svg = svg.replace(/<svg([^>]*)>/, (m, a) => `<svg${a}><style><![CDATA[text{font-family:Helvetica,Arial,sans-serif}${(rules + res(extra)).replace(/]]>/g, ']] >')}]]></style><rect x="-5000" y="-5000" width="20000" height="20000" fill="${bg}"/>`);
fs.writeFileSync(inp.replace('.svg', `.${theme}.resolved.svg`), svg);
execFileSync('rsvg-convert', ['-z', '0.9', '-o', out, inp.replace('.svg', `.${theme}.resolved.svg`)]);
console.log('png →', out);
