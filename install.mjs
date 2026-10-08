#!/usr/bin/env node
/* Instala GraphX en Claude Code, con casillas para elegir qué:
 *
 *   [x] la skill graphx            ~/.claude/skills/graphx            /graphx: diagramas en lenguaje normal
 *   [x] el mod para el terminal    ~/.claude/skills/graphx-mod        /graphx-mod y las herramientas mcp__graphx-mod__*
 *   [x] el mod para la app de escritorio  lo mismo + la ruta de node fijada (la app, abierta desde el Dock, no hereda el
 *                                  PATH de la shell y no encontraría node) y la comprobación de rsvg-convert
 *
 *   node install.mjs                         interactivo (↑ ↓ mover · espacio marcar · a todo · ⏎ instalar · q salir)
 *   node install.mjs --skill --terminal      sin preguntar, solo eso (también --desktop, --all)
 *   node install.mjs --uninstall [--all …]   quita lo marcado
 *   opciones: --yes (acepta lo preseleccionado sin preguntar) · --dry-run · --lang es|en · --help
 *
 * Se instala en $CLAUDE_CONFIG_DIR o en ~/.claude: Claude Code carga los plugins de skills/<nombre>/ en la siguiente
 * sesión (graphx-mod@skills-dir), en el terminal y en la app de escritorio, que usan la misma configuración. Hace falta
 * node ≥ 18; el mod se monta con mod/build.mjs (que necesita dist/ y node_modules/jsdom: los prepara si faltan). */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const has = f => args.includes(f);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const HOME = os.homedir();
const CLAUDE = process.env.CLAUDE_CONFIG_DIR ? path.resolve(process.env.CLAUDE_CONFIG_DIR) : path.join(HOME, '.claude');
const SKILLS = path.join(CLAUDE, 'skills');
const SKILL_DST = path.join(SKILLS, 'graphx');
const MOD_DST = path.join(SKILLS, 'graphx-mod');
const DRY = has('--dry-run');
const UNINSTALL = has('--uninstall');

/* ---------- idioma: --lang, el de Claude Code, la configuración regional; inglés si nada lo dice ---------- */
function langOf(v) {
  const s = String(v ?? '').trim().toLowerCase();
  if (/^(es|spa)([_.@-]|$)|spanish|español|espanol|castellano/.test(s)) return 'es';
  if (/^en([_.@-]|$)|english|inglés|ingles/.test(s)) return 'en';
  return null;
}
function claudeLanguage() {
  try { return JSON.parse(fs.readFileSync(path.join(CLAUDE, 'settings.json'), 'utf8')).language; } catch { return null; }
}
const LANG = langOf(opt('--lang')) ?? langOf(claudeLanguage()) ?? langOf(process.env.LC_ALL) ?? langOf(process.env.LC_MESSAGES) ?? langOf(process.env.LANG) ?? 'en';
const tr = (es, en) => (LANG === 'es' ? es : en);

/* ---------- colores (sin ellos si no hay terminal o NO_COLOR) ---------- */
const TTY = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (TTY ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = s => c('1', s), dim = s => c('2', s), green = s => c('32', s), red = s => c('31', s), yellow = s => c('33', s), cyan = s => c('36', s);
const ok = s => console.log(`${green('✓')} ${s}`), warn = s => console.log(`${yellow('⚠')} ${s}`), fail = s => console.log(`${red('✗')} ${s}`), info = s => console.log(`${dim('·')} ${s}`);

/* ---------- lo que se puede instalar ---------- */
const desktopApp = (() => {
  if (process.platform === 'darwin') return fs.existsSync('/Applications/Claude.app') || fs.existsSync(path.join(HOME, 'Applications', 'Claude.app')) || fs.existsSync(path.join(HOME, 'Library', 'Application Support', 'Claude'));
  if (process.platform === 'win32') return !!process.env.APPDATA && fs.existsSync(path.join(process.env.APPDATA, 'Claude'));
  return fs.existsSync(path.join(HOME, '.config', 'Claude'));
})();
const ITEMS = [
  {
    id: 'skill', flag: '--skill',
    label: tr('Skill graphx', 'graphx skill'),
    hint: tr(`/graphx: Claude dibuja y explica con diagramas cuando se lo pides · ${tilde(SKILL_DST)}`, `/graphx: Claude draws and explains with diagrams when you ask · ${tilde(SKILL_DST)}`),
    on: true, installed: () => fs.existsSync(path.join(SKILL_DST, 'SKILL.md')),
  },
  {
    id: 'terminal', flag: '--terminal',
    label: tr('Mod para el terminal (Claude Code CLI)', 'Mod for the terminal (Claude Code CLI)'),
    hint: tr(`/graphx-mod: el lienzo en caracteres, el navegador y las herramientas mcp__graphx-mod__* · ${tilde(MOD_DST)}`, `/graphx-mod: the character canvas, the browser and the mcp__graphx-mod__* tools · ${tilde(MOD_DST)}`),
    on: true, installed: () => fs.existsSync(path.join(MOD_DST, '.claude-plugin', 'plugin.json')),
  },
  {
    id: 'desktop', flag: '--desktop',
    label: tr('Mod para la app de escritorio (Claude Desktop)', 'Mod for the desktop app (Claude Desktop)'),
    hint: desktopApp
      ? tr('el mismo mod, con la ruta de node fijada: la app abierta desde el Dock no ve el PATH de la shell', 'the same mod, with the node path pinned: an app opened from the Dock does not see the shell PATH')
      : tr('no se ha encontrado la app de escritorio en esta máquina', 'the desktop app was not found on this machine'),
    on: desktopApp, installed: () => fs.existsSync(path.join(MOD_DST, 'node-path')),
  },
];
function tilde(p) { return p.startsWith(HOME) ? '~' + p.slice(HOME.length) : p; }

if (has('--help') || has('-h')) {
  console.log(tr(
`Instala GraphX en Claude Code (${tilde(CLAUDE)}).

  node install.mjs                       elige con casillas (↑ ↓ · espacio · a · ⏎ · q)
  node install.mjs --skill --terminal    sin preguntar: skill, mod del terminal, --desktop mod del escritorio, --all todo
  node install.mjs --uninstall [--all]   quita lo elegido
  --yes  acepta lo preseleccionado · --dry-run  enseña lo que haría · --lang es|en`,
`Installs GraphX into Claude Code (${tilde(CLAUDE)}).

  node install.mjs                       pick with checkboxes (↑ ↓ · space · a · ⏎ · q)
  node install.mjs --skill --terminal    no questions: skill, terminal mod, --desktop desktop mod, --all everything
  node install.mjs --uninstall [--all]   removes what you pick
  --yes  accept the preselection · --dry-run  show what it would do · --lang es|en`));
  process.exit(0);
}

/* ---------- las casillas ---------- */
function checkboxes(title, items) {
  return new Promise(resolve => {
    const state = items.map(i => i.on);
    let cur = 0, lines = 0;
    const out = process.stdout, inp = process.stdin;
    const draw = () => {
      if (lines) out.write(`\x1b[${lines}A\x1b[0J`);
      const rows = [bold(title), dim(tr('  ↑ ↓ mover · espacio marcar · a todo · ⏎ aceptar · q salir', '  ↑ ↓ move · space toggle · a all · ⏎ confirm · q quit')), ''];
      items.forEach((it, i) => {
        const box = state[i] ? green('[x]') : '[ ]';
        const ptr = i === cur ? cyan('❯') : ' ';
        const tag = it.installed() ? dim(tr(' (instalado)', ' (installed)')) : '';
        rows.push(`${ptr} ${box} ${i === cur ? bold(it.label) : it.label}${tag}`);
        rows.push(`      ${dim(it.hint)}`);
      });
      rows.push('');
      /* una fila por línea: si el terminal la partiera, el redibujado no sabría cuántas subir */
      const w = Math.max(20, (out.columns || 80) - 1);
      const fitRow = r => { const plain = r.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, ''); return [...plain].length <= w ? r : [...plain].slice(0, w - 1).join('') + '…'; };
      out.write(rows.map(fitRow).join('\n') + '\n');
      lines = rows.length;
    };
    const done = v => { inp.setRawMode(false); inp.pause(); inp.removeListener('data', onKey); out.write('\x1b[?25h'); resolve(v); };
    const onKey = buf => {
      const k = buf.toString();
      if (k === '\x03' || k === 'q' || k === '\x1b') return done(null);
      if (k === '\r' || k === '\n') return done(items.filter((_, i) => state[i]).map(i => i.id));
      if (k === '\x1b[A' || k === 'k') cur = (cur + items.length - 1) % items.length;
      else if (k === '\x1b[B' || k === 'j' || k === '\t') cur = (cur + 1) % items.length;
      else if (k === ' ') state[cur] = !state[cur];
      else if (k === 'a') { const all = state.every(Boolean); state.fill(!all); }
      draw();
    };
    out.write('\x1b[?25l');
    inp.setRawMode(true); inp.resume(); inp.on('data', onKey);
    draw();
  });
}

/* ---------- pasos ---------- */
function run(cmd, argv, opts = {}) {
  if (DRY) { info(`${tr('haría', 'would run')}: ${cmd} ${argv.join(' ')}`); return true; }
  const r = spawnSync(cmd, argv, { cwd: ROOT, stdio: opts.quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0 && opts.quiet) process.stderr.write(String(r.stderr ?? ''));
  return r.status === 0;
}
function copyDir(src, dst) {
  if (DRY) { info(`${tr('copiaría', 'would copy')} ${path.relative(ROOT, src)} → ${tilde(dst)}`); return; }
  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.cpSync(src, dst, { recursive: true });
}
function remove(p, what) {
  if (!fs.existsSync(p)) { info(tr(`${what}: no estaba instalado`, `${what}: was not installed`)); return; }
  if (DRY) { info(`${tr('borraría', 'would remove')} ${tilde(p)}`); return; }
  fs.rmSync(p, { recursive: true, force: true });
  ok(tr(`${what}: quitado de ${tilde(p)}`, `${what}: removed from ${tilde(p)}`));
}
const which = bin => { try { return execFileSync(process.platform === 'win32' ? 'where' : 'which', [bin], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n')[0].trim() || null; } catch { return null; } };

function installSkill() {
  const src = path.join(ROOT, 'skills', 'graphx');
  if (fs.existsSync(path.join(SKILL_DST, '.claude-plugin'))) warn(tr(`${tilde(SKILL_DST)} era un plugin: se sustituye por la skill`, `${tilde(SKILL_DST)} was a plugin: replacing it with the skill`));
  copyDir(src, SKILL_DST);
  ok(tr(`skill graphx en ${tilde(SKILL_DST)}`, `graphx skill in ${tilde(SKILL_DST)}`));
}

function prepareMod() {
  /* el bundle del motor (dist/) y jsdom (node_modules) son lo que mod/build.mjs copia y empaqueta */
  if (!fs.existsSync(path.join(ROOT, 'node_modules', 'jsdom', 'package.json'))) {
    info(tr('falta node_modules: npm install…', 'node_modules missing: npm install…'));
    if (!run('npm', ['install', '--no-audit', '--no-fund'])) { fail(tr('npm install ha fallado', 'npm install failed')); return false; }
  }
  if (!fs.existsSync(path.join(ROOT, 'dist', 'graphx.bundle.min.js'))) {
    info(tr('falta dist/: node tools/build-dist.mjs…', 'dist/ missing: node tools/build-dist.mjs…'));
    if (!run(process.execPath, [path.join('tools', 'build-dist.mjs')])) { fail(tr('no se ha podido generar dist/', 'could not build dist/')); return false; }
  }
  return true;
}
function installMod(desktop) {
  if (!prepareMod()) return false;
  if (!run(process.execPath, [path.join('mod', 'build.mjs'), '--to', MOD_DST], { quiet: true })) { fail(tr('mod/build.mjs ha fallado', 'mod/build.mjs failed')); return false; }
  ok(tr(`mod graphx-mod en ${tilde(MOD_DST)}`, `graphx-mod mod in ${tilde(MOD_DST)}`));
  if (desktop) {
    /* la app de escritorio arranca con el PATH mínimo del sistema: el servidor del mod usará este node */
    if (!DRY) fs.writeFileSync(path.join(MOD_DST, 'node-path'), process.execPath + '\n');
    ok(tr(`app de escritorio: node fijado en ${tilde(process.execPath)}`, `desktop app: node pinned to ${tilde(process.execPath)}`));
    if (!desktopApp) warn(tr('no se ha encontrado la app de escritorio: el mod la usará cuando la instales', 'the desktop app was not found: the mod will use it once you install it'));
  }
  if (!which('rsvg-convert')) warn(tr('sin rsvg-convert no hay imagen del motor ni capturas (macOS: brew install librsvg · Debian/Ubuntu: apt install librsvg2-bin)', 'without rsvg-convert there is no engine image or screenshots (macOS: brew install librsvg · Debian/Ubuntu: apt install librsvg2-bin)'));
  return true;
}

/* ---------- el plan ---------- */
const major = Number(process.versions.node.split('.')[0]);
if (major < 18) { fail(tr(`hace falta node ≥ 18 (este es ${process.version})`, `node ≥ 18 is required (this is ${process.version})`)); process.exit(1); }

let picked;
const flagged = ITEMS.filter(i => has(i.flag) || has('--all')).map(i => i.id);
if (flagged.length) picked = flagged;
else if (has('--yes') || !process.stdin.isTTY) {
  if (!process.stdin.isTTY && !has('--yes')) { fail(tr('sin terminal interactivo: elige con --skill, --terminal, --desktop o --all (o --yes)', 'no interactive terminal: choose with --skill, --terminal, --desktop or --all (or --yes)')); process.exit(2); }
  picked = UNINSTALL ? ITEMS.filter(i => i.installed()).map(i => i.id) : ITEMS.filter(i => i.on).map(i => i.id);
} else {
  if (UNINSTALL) ITEMS.forEach(i => { i.on = i.installed(); });
  picked = await checkboxes(UNINSTALL ? tr('GraphX · ¿qué quito?', 'GraphX · what should I remove?') : tr(`GraphX · ¿qué instalo en ${tilde(CLAUDE)}?`, `GraphX · what should I install into ${tilde(CLAUDE)}?`), ITEMS);
  if (!picked) { console.log(tr('Cancelado.', 'Cancelled.')); process.exit(0); }
}
if (!picked.length) { console.log(tr('Nada marcado: no hago nada.', 'Nothing selected: nothing to do.')); process.exit(0); }

const want = id => picked.includes(id);
let good = true;
if (UNINSTALL) {
  if (want('skill')) remove(SKILL_DST, tr('skill graphx', 'graphx skill'));
  if (want('terminal')) remove(MOD_DST, 'graphx-mod');
  else if (want('desktop')) remove(path.join(MOD_DST, 'node-path'), tr('node fijado para el escritorio', 'node pinned for the desktop'));
} else {
  if (want('skill')) installSkill();
  if (want('terminal') || want('desktop')) good = installMod(want('desktop'));
  console.log('');
  if (good) {
    console.log(bold(tr('Listo. En una sesión nueva de Claude Code:', 'Done. In a new Claude Code session:')));
    if (want('skill')) console.log(`  ${cyan('/graphx help')}      ${tr('la ayuda de la skill · /graphx <lo que quieres dibujar>', 'the skill help · /graphx <what you want drawn>')}`);
    if (want('terminal') || want('desktop')) console.log(`  ${cyan('/graphx-mod help')}  ${tr('los comandos y teclas del lienzo · /graphx-mod demo software', 'canvas commands and keys · /graphx-mod demo software')}`);
    if (want('desktop')) console.log(`  ${dim(tr('Reinicia la app de escritorio para que cargue el mod.', 'Restart the desktop app so it loads the mod.'))}`);
    if ((want('terminal') || want('desktop')) && !want('skill') && !ITEMS[0].installed()) console.log(`  ${dim(tr('Sin la skill, Claude usa el lienzo por las descripciones de sus herramientas; con ella, mejor.', 'Without the skill Claude uses the canvas from its tool descriptions; it does better with it.'))}`);
  }
}
process.exit(good ? 0 : 1);
