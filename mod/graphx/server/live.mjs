#!/usr/bin/env node
/* Servidor del mod graphx: solo la biblioteca estándar de Node (más jsdom empaquetado para el motor).
 *
 *   node live.mjs --token <secreto> [--port 0] [--root <carpeta del mod>]
 *
 * Escucha en 127.0.0.1 y escribe una línea JSON en stdout cuando está listo:
 *   {"ready":true,"url":"http://localhost:PUERTO/?t=…","port":PUERTO,"engine":true,"rsvg":true}
 *
 * Rutas (todas menos /, /viewer/*, /vendor/* y /health exigen el token):
 *   POST /state           el mod publica el tablero { rev, board }; el motor lo vuelve a pintar
 *   GET  /scene           la escena del terminal (grafo, secuencia o árbol, con sus datos de efectos)
 *   POST /ui              lo que la persona hace en el panel { open | close | depth | dir | search | view | owners | reset }
 *   GET  /detail?id=      el detalle de una pieza o arista (bloques, vecindad, enlaces…)
 *   GET  /svg?theme=      el SVG autocontenido de lo pintado (escritorio, editor, móvil)
 *   GET  /png?theme=&width=   PNG (rsvg-convert): { file, w, h, bytes } y lo deja en un fichero temporal
 *   GET  /png.b64?theme=  el mismo PNG en base64 (para que Claude lo vea)
 *   POST /convert         { mermaid } → { spec, type, warnings, annotations }  ·  { spec, flow? } → { mermaid }
 *   GET  /export          el tablero actual como Mermaid con sus anotaciones
 *   GET  /events          SSE para el visor del navegador; POST /snapshot y POST /ui-event, lo que cuenta el visor
 *   GET  /inbox           el mod recoge lo que ha pasado (pintados, pasos, preguntas)
 *
 * El proceso termina solo cuando su padre (Claude Code) desaparece. */
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { createEngine } from './engine.mjs';
import { decodePng, halfBlocks, parseColor } from './svgout.mjs';
import { annotations, toMermaid, overlay } from './mermaid-out.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const TOKEN = opt('--token', '');
const ROOT = path.resolve(opt('--root', path.dirname(path.dirname(fileURLToPath(import.meta.url)))));
const PORT = +opt('--port', 0);
const MAX_BODY = 24 << 20;
if (!TOKEN || TOKEN.length < 16) { console.error('graphx: falta --token (16 caracteres o más)'); process.exit(2); }

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json; charset=utf-8', '.ico': 'image/x-icon' };
const STATIC = { '/viewer/': path.join(ROOT, 'viewer'), '/vendor/': path.join(ROOT, 'viewer', 'vendor') };
/* la versión del código del servidor: si el mod se recarga con otro, los hooks lo reinician */
const CODE_FILES = ['server/live.mjs', 'server/engine.mjs', 'server/svgout.mjs', 'server/mermaid-out.mjs', 'viewer/board.js'];
const CODE_VERSION = CODE_FILES.map(f => { try { return Math.round(fs.statSync(path.join(ROOT, f)).mtimeMs); } catch (_) { return 0; } }).join('-');
const VIEWER_VERSION = ['index.html', 'viewer.js', 'viewer.css', 'board.js'].map(f => { try { return fs.statSync(path.join(ROOT, 'viewer', f)).mtimeMs.toFixed(0); } catch (_) { return '0'; } }).join('-');

let state = { rev: 0, board: null };
let snap = null;                 /* la última captura del navegador */
let tmpDir = null;
const inbox = [];

/* ---------- el motor ---------- */
let engine = null, engineError = null;
try { engine = createEngine(ROOT); if (!engine) engineError = 'falta server/vendor/jsdom.cjs o el bundle: ejecuta `node mod/build.mjs`'; }
catch (err) { engineError = String(err && err.message || err); }
const ui = { open: new Set(), close: new Set(), depth: undefined, dir: undefined, search: '', view: undefined, owners: undefined };
let scene = null, sceneSeq = 0, rendering = Promise.resolve(), pending = false;
const cache = new Map();         /* svg y png por (seq, tema, ancho) */
function render() {
  if (!engine) return Promise.resolve();
  if (pending) return rendering;
  pending = true;
  rendering = rendering.then(async () => {
    pending = false;
    try {
      const r = await engine.render(state.board, state.rev, ui);
      scene = r.scene; sceneSeq++; cache.clear();
      scene.seq = sceneSeq;
      if (r.report) inbox.push(Object.assign({ at: Date.now() }, r.report));
    } catch (err) { scene = { v: 1, rev: state.rev, kind: 'error', error: String(err && err.message || err) }; sceneSeq++; scene.seq = sceneSeq; }
  });
  return rendering;
}
const sceneOut = () => scene || { v: 1, seq: sceneSeq, kind: 'empty', error: engineError || undefined };

const clients = new Set();
const send = (res, code, body, type = 'application/json; charset=utf-8', extra = {}) => {
  res.writeHead(code, Object.assign({ 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }, extra));
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const readBody = req => new Promise((ok, ko) => {
  const parts = []; let n = 0;
  req.on('data', c => { n += c.length; if (n > MAX_BODY) { ko(new Error('demasiado grande')); req.destroy(); } else parts.push(c); });
  req.on('end', () => ok(Buffer.concat(parts).toString('utf8')));
  req.on('error', ko);
});
const authed = (u, req) => u.searchParams.get('t') === TOKEN || req.headers['x-graphx-token'] === TOKEN;
const broadcast = () => { const msg = `event: state\ndata: ${JSON.stringify(state)}\n\n`; for (const c of clients) c.write(msg); };
function serveStatic(res, file, base) {
  const real = path.resolve(file);
  if (!real.startsWith(base + path.sep)) return send(res, 403, { error: 'fuera del visor' });
  fs.readFile(real, (err, buf) => { if (err) return send(res, 404, { error: 'no existe' }); send(res, 200, buf, TYPES[path.extname(real)] || 'application/octet-stream'); });
}

async function svgOf(theme, opts = {}) {
  await rendering;
  const k = `svg:${sceneSeq}:${theme}:${opts.maxChars || ''}`;
  if (!cache.has(k)) cache.set(k, engine ? engine.svg(theme, opts) : null);
  return cache.get(k);
}
async function pngOf(theme, width) {
  await rendering;
  const k = `png:${sceneSeq}:${theme}:${width || ''}`;
  if (!cache.has(k)) {
    const p = (async () => {
      const buf = engine ? await engine.png(theme, width ? { width } : { zoom: 1 }) : null;
      if (!buf) return null;
      let file = null;
      if (tmpDir) {
        file = path.join(tmpDir, `scene-${sceneSeq}-${theme}-${width || 0}-${Date.now()}.png`);
        fs.writeFileSync(file, buf);
        /* solo las últimas: el terminal relee la imagen cuando cambia la ruta */
        const files = fs.readdirSync(tmpDir).filter(f => f.startsWith('scene-')).map(f => path.join(tmpDir, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
        files.slice(8).forEach(f => fs.rmSync(f, { force: true }));
      }
      const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
      return { buf, file, w, h };
    })().catch(err => { process.stderr.write('png: ' + (err && err.message) + '\n'); return null; });
    cache.set(k, p);
  }
  return cache.get(k);
}
function specNow() {
  try { return engine ? engine.spec() : null; } catch (_) { return null; }
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  const p = u.pathname;
  try {
    if (req.method === 'GET' && p === '/health') return send(res, 200, { ok: true, code: CODE_VERSION, rev: state.rev, viewers: clients.size, engine: !!engine, rsvg: !!(engine && engine.rsvg) });
    if (req.method === 'GET' && (p === '/' || p === '/index.html')) return serveStatic(res, path.join(ROOT, 'viewer', 'index.html'), path.join(ROOT, 'viewer'));
    for (const [pre, dir] of Object.entries(STATIC)) if (req.method === 'GET' && p.startsWith(pre)) return serveStatic(res, path.join(dir, decodeURIComponent(p.slice(pre.length))), dir);
    if (req.method === 'GET' && p === '/favicon.ico') return send(res, 204, '');
    if (!authed(u, req)) return send(res, 401, { error: 'token' });

    if (req.method === 'GET' && p === '/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', connection: 'keep-alive' });
      res.write(`retry: 1500\nevent: hello\ndata: ${JSON.stringify({ version: VIEWER_VERSION })}\n\n`);
      res.write(`event: state\ndata: ${JSON.stringify(state)}\n\n`);
      clients.add(res);
      const ping = setInterval(() => res.write(': ping\n\n'), 20000);
      req.on('close', () => { clearInterval(ping); clients.delete(res); });
      return;
    }
    if (req.method === 'POST' && p === '/state') {
      const body = JSON.parse(await readBody(req));
      /* dos herramientas a la vez pueden llegar en otro orden: una revisión vieja no pisa a una nueva */
      if (+body.rev && +body.rev < state.rev) return send(res, 200, { ok: true, stale: true, rev: state.rev, viewers: clients.size, seq: sceneSeq });
      state = { rev: +body.rev || state.rev + 1, board: body.board ?? null };
      broadcast();
      await render();
      return send(res, 200, { ok: true, rev: state.rev, viewers: clients.size, seq: sceneSeq });
    }
    if (req.method === 'GET' && p === '/scene') { await rendering; return send(res, 200, sceneOut()); }
    if (req.method === 'POST' && p === '/ui') {
      const b = JSON.parse(await readBody(req) || '{}');
      if (typeof b.open === 'string') { ui.open.add(b.open); ui.close.delete(b.open); }
      if (typeof b.close === 'string') { ui.close.add(b.close); ui.open.delete(b.close); }
      if (typeof b.depth === 'number') { ui.depth = b.depth; ui.open.clear(); ui.close.clear(); }
      if (b.dir === 'right' || b.dir === 'down') ui.dir = b.dir;
      if (typeof b.search === 'string') ui.search = b.search;
      if (typeof b.view === 'string') ui.view = b.view;
      if (Array.isArray(b.owners) || b.owners === null) ui.owners = b.owners || [];
      if (b.reset) { ui.open.clear(); ui.close.clear(); ui.depth = undefined; ui.search = ''; ui.owners = []; }
      await render();
      return send(res, 200, sceneOut());
    }
    if (req.method === 'GET' && p === '/detail') { await rendering; return send(res, 200, (engine && engine.detail(u.searchParams.get('id') || '')) || { error: 'no existe' }); }
    if (req.method === 'GET' && p === '/svg') {
      const s = await svgOf(u.searchParams.get('theme') === 'dark' ? 'dark' : 'light', { maxChars: +u.searchParams.get('max') || 131072 });
      return s ? send(res, 200, s) : send(res, 404, { error: engineError || 'nada pintado' });
    }
    if (req.method === 'GET' && (p === '/png' || p === '/png.b64')) {
      const r = await pngOf(u.searchParams.get('theme') === 'dark' ? 'dark' : 'light', +u.searchParams.get('width') || 0);
      if (!r) return send(res, 404, { error: engine && !engine.rsvg ? 'sin rsvg-convert' : engineError || 'nada pintado' });
      if (p === '/png.b64') return send(res, 200, { b64: r.buf.toString('base64'), w: r.w, h: r.h, file: r.file });
      return send(res, 200, { file: r.file, w: r.w, h: r.h, bytes: r.buf.length });
    }
    /* la foto del motor en medios bloques, para un Raster: cols × rows celdas, el diagrama entero encajado */
    if (req.method === 'GET' && p === '/raster') {
      const theme = u.searchParams.get('theme') === 'dark' ? 'dark' : 'light';
      const cols = Math.max(8, Math.min(512, +u.searchParams.get('cols') || 100)), rows = Math.max(4, Math.min(256, +u.searchParams.get('rows') || 30));
      const k = `raster:${sceneSeq}:${theme}:${cols}x${rows}`;
      if (!cache.has(k)) cache.set(k, (async () => {
        const r = await pngOf(theme, Math.min(2400, cols * 4));
        if (!r) return null;
        const img = decodePng(r.buf);
        /* el diagrama con su proporción: una celda es el doble de alta que de ancha, dos píxeles por celda */
        const aspect = img.w / img.h;
        let c = cols, r2 = Math.round(cols / aspect / 2);
        if (r2 > rows) { r2 = rows; c = Math.max(8, Math.min(cols, Math.round(rows * 2 * aspect))); }
        r2 = Math.max(2, r2);
        const bg = (parseColor(theme === 'dark' ? '#0d1117' : '#ffffff') || [13, 17, 23]).slice(0, 3);
        return { cells: halfBlocks(img, c, r2, bg), cols: c, rows: r2 };
      })().catch(err => { process.stderr.write('raster: ' + err.message + '\n'); return null; }));
      const v = await cache.get(k);
      return v ? send(res, 200, v) : send(res, 404, { error: 'sin imagen' });
    }
    if (req.method === 'POST' && p === '/convert') {
      const b = JSON.parse(await readBody(req) || '{}');
      if (typeof b.mermaid === 'string') {
        const ann = annotations(b.mermaid);
        if (!engine) return send(res, 200, { error: engineError, annotations: ann });
        const r = engine.convert(b.mermaid, b.lang);
        return send(res, 200, Object.assign({ annotations: ann }, r));
      }
      if (b.spec && typeof b.spec === 'object') return send(res, 200, toMermaid(b.spec, { flow: b.flow }));
      return send(res, 400, { error: 'pasa mermaid o spec' });
    }
    if (req.method === 'POST' && p === '/inline') {
      const b = JSON.parse(await readBody(req) || '{}');
      if (!engine) return send(res, 200, { error: engineError });
      /* en la cola del motor: no se cruza con el pintado del lienzo */
      let out;
      rendering = rendering.then(async () => { try { out = await engine.inline(b.mermaid, b.theme === 'dark' ? 'dark' : 'light'); } catch (err) { out = { error: String(err && err.message || err) }; } });
      await rendering;
      return send(res, 200, out);
    }
    if (req.method === 'GET' && p === '/export') {
      await rendering;
      const board = state.board;
      const spec = (engine && board && engine.specOf(board)) || specNow();
      if (!spec || !board) return send(res, 404, { error: 'el lienzo está vacío' });
      const flow = u.searchParams.get('flow') || undefined;
      /* un Mermaid de partida se conserva tal cual (su tipo, su layout) con lo añadido después como `%% @gx` */
      if (board.source && board.source.kind === 'mermaid' && !flow && u.searchParams.get('regen') !== '1') {
        const extra = { nodes: Object.assign({}, board.data && board.data.nodes, board.data && board.data.edges), root: {} };
        for (const pt of board.patches || []) for (const up of pt.update || []) extra.nodes[up.id] = Object.assign({}, extra.nodes[up.id], up, { id: undefined });
        if (board.fx !== undefined && board.fx !== null) extra.root.fx = board.fx;
        const structural = (board.patches || []).some(pt => pt.add || pt.remove || pt.set);
        if (!structural) return send(res, 200, { text: overlay(board.source.text, extra), type: 'mermaid (original + %% @gx)', lossy: [] });
      }
      return send(res, 200, toMermaid(spec, { flow }));
    }
    if (req.method === 'POST' && p === '/snapshot') {
      const body = JSON.parse(await readBody(req));
      const m = /^data:image\/png;base64,(.+)$/.exec(body.png || '');
      snap = { rev: +body.rev || 0, svg: String(body.svg || ''), png: m ? Buffer.from(m[1], 'base64') : null, w: +body.w || 0, h: +body.h || 0, at: Date.now() };
      return send(res, 200, { ok: true });
    }
    if (req.method === 'GET' && p === '/snapshot.b64') return snap && snap.png ? send(res, 200, snap.png.toString('base64'), 'text/plain; charset=utf-8') : send(res, 404, { error: 'sin captura' });
    if (req.method === 'POST' && (p === '/ui-event' || p === '/ui-viewer')) {
      const body = JSON.parse(await readBody(req));
      if (body && typeof body.type === 'string') inbox.push(Object.assign({ at: Date.now() }, body));
      if (inbox.length > 200) inbox.splice(0, inbox.length - 200);
      return send(res, 200, { ok: true });
    }
    if (req.method === 'POST' && p === '/quit') { send(res, 200, { ok: true }); setTimeout(() => process.exit(0), 50); return; }
    if (req.method === 'GET' && p === '/inbox') return send(res, 200, { events: inbox.splice(0), viewers: clients.size, seq: sceneSeq, engineError, snapshot: snap ? { rev: snap.rev, at: snap.at, w: snap.w, h: snap.h } : null });
    send(res, 404, { error: 'ruta' });
  } catch (err) {
    send(res, 400, { error: String(err && err.message || err) });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  const port = server.address().port;
  try { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `graphx-${port}-`)); } catch (_) { tmpDir = null; }
  process.stdout.write(JSON.stringify({ ready: true, port, url: `http://localhost:${port}/?t=${TOKEN}`, engine: !!engine, rsvg: !!(engine && engine.rsvg), engineError }) + '\n');
});
server.on('error', err => { console.error('graphx:', err.message); process.exit(1); });

/* sin padre no hay quien publique: el servidor se va con la sesión aunque nadie lo mate */
const parent = process.ppid;
setInterval(() => { try { process.kill(parent, 0); } catch (_) { process.exit(0); } if (process.ppid !== parent) process.exit(0); }, 2000).unref();
const cleanup = () => { if (tmpDir) try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) { } };
process.on('exit', cleanup);
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
