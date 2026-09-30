/* GraphX · conversor de Mermaid.
 *
 * GraphX.fromMermaid(texto, { lang }) → { spec, type, warnings }
 *   Traduce el código de un diagrama de Mermaid al JSON de GraphX. No depende de Mermaid:
 *   lleva un analizador propio por tipo, así que funciona igual en el navegador, en un
 *   artifact sin red y en Node (el ensamblador lo carga en un vm).
 * GraphX.mountMermaid(host, texto, opts) → instancia de GraphX.mount
 * GraphX.replaceMermaid(raíz, opts) → sustituye `pre.mermaid`, `div.mermaid` y
 *   `code.language-mermaid` por diagramas de GraphX.
 *
 * Tipos: flowchart/graph · sequenceDiagram · classDiagram · stateDiagram(-v2) · erDiagram ·
 * mindmap · gantt · journey · timeline · gitGraph · C4 (Context, Container, Component,
 * Dynamic, Deployment) · architecture-beta · block-beta · requirementDiagram · sankey-beta ·
 * kanban · treemap-beta. Los gráficos de datos (pie, xychart, quadrantChart, radar, packet)
 * no son grafos de piezas y conexiones: se rechazan con un error que lo explica.
 *
 * Qué se conserva: piezas, formas (como icono), textos, subgrafos y anidamientos (niveles
 * plegables), conexiones con su texto y estilo (continua, discontinua, gruesa), colores de
 * classDef/style/linkStyle, enlaces de `click`, notas, y la secuencia de mensajes con sus
 * bloques (loop, alt, opt, par…) como fases. Lo que no tiene equivalente se ignora con un
 * aviso en `warnings`, nunca en silencio.                                                    */
(function (global) {
  'use strict';

  /* ---------- textos generados ---------- */
  const STR = {
    es: {
      untitled: 'Diagrama', converted: t => `Convertido desde Mermaid (${t}).`,
      from: 'Llega desde', to: 'Sale hacia', more: n => `y ${n} más`, contains: n => `Contiene ${n} ${n === 1 ? 'pieza' : 'piezas'}`,
      level: n => `Nivel ${n}`, sends: n => `envía ${n} ${n === 1 ? 'mensaje' : 'mensajes'}`, receives: n => `recibe ${n}`,
      blocks: { loop: 'Bucle', alt: 'Alternativa', else: 'Si no', opt: 'Opcional', par: 'En paralelo', and: 'Y', critical: 'Región crítica', option: 'Opción', break: 'Interrupción', rect: 'Bloque' },
      endOf: b => `Fin de: ${b}`, back: b => `Sigue: ${b}`, bidir: 'En los dos sentidos.', lost: 'Mensaje perdido (✕).', crossEnd: 'Termina en aspa (✕).', circleEnd: 'Termina en círculo (○).', open: 'Enlace sin flecha.',
      link: 'enlace', thick: 'Enlace grueso.', dotted: 'Enlace punteado.', start: 'Inicio', end: 'Fin', attrs: 'Atributos', methods: 'Métodos', members: 'Miembros',
      nAttrs: n => `${n} ${n === 1 ? 'atributo' : 'atributos'}`, nMethods: n => `${n} ${n === 1 ? 'método' : 'métodos'}`,
      rel: { inherit: 'hereda de', realize: 'implementa', compose: 'se compone de', aggregate: 'agrega', assoc: 'se asocia con', depend: 'depende de', link: 'enlace', lollipop: 'interfaz' },
      linked: (a, b) => `${a} y ${b} están enlazadas.`,
      card: { zo: 'cero o un', one: 'exactamente un', zm: 'cero o más', om: 'uno o más' },
      erSentence: (a, ca, b, cb) => `Cada ${a} se relaciona con ${cb} ${b}; cada ${b}, con ${ca} ${a}.`,
      identifying: 'Relación identificativa.', nonIdentifying: 'Relación no identificativa (discontinua).',
      startDate: 'Inicio', endDate: 'Fin', duration: 'Duración', after: 'Después de', status: 'Estado', id: 'Id', score: 'Puntuación', actors: 'Actores',
      gstat: { done: 'Hecha', active: 'En curso', crit: 'Crítica', critDone: 'Crítica · hecha', critActive: 'Crítica · en curso' },
      scoreText: n => `${n}/5 · ${['', 'muy mala', 'mala', 'regular', 'buena', 'muy buena'][n]}`,
      commit: 'Commit', merge: b => `Merge de ${b}`, cherry: id => `Cherry-pick de ${id}`, branch: 'Rama', tag: 'Etiqueta', reverse: 'Commit de reversión.', highlight: 'Commit destacado.',
      techn: 'Tecnología', type: 'Tipo', value: 'Valor', total: 'Total', inflow: 'Entra', outflow: 'Sale', risk: 'Riesgo', verify: 'Verificación', docref: 'Referencia', text: 'Texto',
      priority: 'Prioridad', assigned: 'Asignado', ticket: 'Ticket', events: n => `${n} ${n === 1 ? 'evento' : 'eventos'}`,
      rejected: t => `«${t}» es un gráfico de datos, no un diagrama de piezas y conexiones: GraphX no lo representa. Usa Mermaid (o una librería de gráficos) para este tipo.`,
      unknown: t => `tipo de diagrama de Mermaid no reconocido: «${t}»`, zenuml: 'ZenUML tiene una sintaxis propia que este conversor no lee: escríbelo como sequenceDiagram.', empty: 'el texto de Mermaid está vacío',
      ignored: s => `se ignora «${s}»`, sequence: 'Secuencia', dynamic: 'Secuencia dinámica',
      kinds: {
        step: 'Paso', rounded: 'Paso (redondeado)', terminal: 'Inicio o fin', subroutine: 'Subproceso', datastore: 'Base de datos', circle: 'Conector',
        dcircle: 'Círculo doble', hexagon: 'Preparación', decision: 'Decisión', io: 'Entrada o salida', trapezoid: 'Operación manual', flag: 'Bandera',
        document: 'Documento', cloud: 'Nube', bang: 'Idea destacada', group: 'Grupo', actor: 'Actor', participant: 'Participante', start: 'Inicio', end: 'Fin',
        choice: 'Elección', fork: 'Bifurcación o unión', state: 'Estado', class: 'Clase', table: 'Entidad', idea: 'Idea', job: 'Tarea', milestone: 'Hito',
        event: 'Evento', commit: 'Commit', service: 'Sistema', app: 'Contenedor', module: 'Componente', external: 'Externo', queue: 'Cola', ui: 'Frontera',
        config: 'Control', package: 'Nodo de despliegue', junction: 'Unión', requirement: 'Requisito', element: 'Elemento', flowpoint: 'Nodo', card: 'Tarjeta', other: 'Otro',
        arrow: 'Flecha', triangle: 'Extracción', hourglass: 'Intercalar', delay: 'Espera', text: 'Texto', note: 'Nota', disk: 'Disco', server: 'Servidor', internet: 'Internet'
      }
    },
    en: {
      untitled: 'Diagram', converted: t => `Converted from Mermaid (${t}).`,
      from: 'Comes from', to: 'Goes to', more: n => `and ${n} more`, contains: n => `Contains ${n} ${n === 1 ? 'part' : 'parts'}`,
      level: n => `Level ${n}`, sends: n => `sends ${n} ${n === 1 ? 'message' : 'messages'}`, receives: n => `receives ${n}`,
      blocks: { loop: 'Loop', alt: 'Alternative', else: 'Else', opt: 'Optional', par: 'Parallel', and: 'And at the same time', critical: 'Critical region', option: 'Option', break: 'Break', rect: 'Block' },
      endOf: b => `End of: ${b}`, back: b => `Back to: ${b}`, bidir: 'Both directions.', lost: 'Lost message (✕).', crossEnd: 'Ends in a cross (✕).', circleEnd: 'Ends in a circle (○).', open: 'Link without arrow.',
      link: 'link', thick: 'Thick link.', dotted: 'Dotted link.', start: 'Start', end: 'End', attrs: 'Attributes', methods: 'Methods', members: 'Members',
      nAttrs: n => `${n} ${n === 1 ? 'attribute' : 'attributes'}`, nMethods: n => `${n} ${n === 1 ? 'method' : 'methods'}`,
      rel: { inherit: 'inherits from', realize: 'implements', compose: 'is composed of', aggregate: 'aggregates', assoc: 'is associated with', depend: 'depends on', link: 'link', lollipop: 'interface' },
      linked: (a, b) => `${a} and ${b} are linked.`,
      card: { zo: 'zero or one', one: 'exactly one', zm: 'zero or more', om: 'one or more' },
      erSentence: (a, ca, b, cb) => `Each ${a} relates to ${cb} ${b}; each ${b}, to ${ca} ${a}.`,
      identifying: 'Identifying relationship.', nonIdentifying: 'Non-identifying relationship (dashed).',
      startDate: 'Start', endDate: 'End', duration: 'Duration', after: 'After', status: 'Status', id: 'Id', score: 'Score', actors: 'Actors',
      gstat: { done: 'Done', active: 'Active', crit: 'Critical', critDone: 'Critical · done', critActive: 'Critical · active' },
      scoreText: n => `${n}/5 · ${['', 'very bad', 'bad', 'neutral', 'good', 'very good'][n]}`,
      commit: 'Commit', merge: b => `Merge ${b}`, cherry: id => `Cherry-pick of ${id}`, branch: 'Branch', tag: 'Tag', reverse: 'Revert commit.', highlight: 'Highlighted commit.',
      techn: 'Technology', type: 'Type', value: 'Value', total: 'Total', inflow: 'In', outflow: 'Out', risk: 'Risk', verify: 'Verification', docref: 'Reference', text: 'Text',
      priority: 'Priority', assigned: 'Assigned', ticket: 'Ticket', events: n => `${n} ${n === 1 ? 'event' : 'events'}`,
      rejected: t => `“${t}” is a data chart, not a diagram of parts and connections: GraphX does not draw it. Use Mermaid (or a charting library) for this type.`,
      unknown: t => `unrecognised Mermaid diagram type: “${t}”`, zenuml: 'ZenUML has its own syntax, which this converter does not read: write it as a sequenceDiagram.', empty: 'the Mermaid text is empty',
      ignored: s => `ignoring “${s}”`, sequence: 'Sequence', dynamic: 'Dynamic sequence',
      kinds: {
        step: 'Step', rounded: 'Step (rounded)', terminal: 'Start or end', subroutine: 'Subroutine', datastore: 'Database', circle: 'Connector',
        dcircle: 'Double circle', hexagon: 'Preparation', decision: 'Decision', io: 'Input or output', trapezoid: 'Manual operation', flag: 'Flag',
        document: 'Document', cloud: 'Cloud', bang: 'Highlighted idea', group: 'Group', actor: 'Actor', participant: 'Participant', start: 'Start', end: 'End',
        choice: 'Choice', fork: 'Fork or join', state: 'State', class: 'Class', table: 'Entity', idea: 'Idea', job: 'Task', milestone: 'Milestone',
        event: 'Event', commit: 'Commit', service: 'System', app: 'Container', module: 'Component', external: 'External', queue: 'Queue', ui: 'Boundary',
        config: 'Control', package: 'Deployment node', junction: 'Junction', requirement: 'Requirement', element: 'Element', flowpoint: 'Node', card: 'Card', other: 'Other',
        arrow: 'Arrow', triangle: 'Extract', hourglass: 'Collate', delay: 'Delay', text: 'Text', note: 'Note', disk: 'Disk', server: 'Server', internet: 'Internet'
      }
    }
  };

  /* Iconos de 16×16 para las formas de Mermaid que el motor no trae. Solo comandos de path y
     números (el validador rechaza cualquier otra cosa). Los tipos del motor (datastore, doc,
     class, job, queue…) se usan tal cual. */
  const ICONS = {
    step: 'M2.5 4.5h11v7h-11z',
    rounded: 'M5 4.5h6a2.5 2.5 0 0 1 2.5 2.5v2A2.5 2.5 0 0 1 11 11.5H5A2.5 2.5 0 0 1 2.5 9V7A2.5 2.5 0 0 1 5 4.5z',
    terminal: 'M5.5 4.5h5a3.5 3.5 0 0 1 0 7h-5a3.5 3.5 0 0 1 0-7z',
    subroutine: 'M2.5 4.5h11v7h-11zM4.5 4.5v7M11.5 4.5v7',
    circle: 'M8 3a5 5 0 1 0 0 10A5 5 0 0 0 8 3z',
    dcircle: 'M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM8 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    hexagon: 'M5 3h6l3 5-3 5H5L2 8z',
    decision: 'M8 2l6 6-6 6-6-6z',
    io: 'M5 4h9l-3 8H2z',
    trapezoid: 'M2 4h12l-3 8H5z',
    flag: 'M2.5 4h11v8h-11l3-4z',
    document: 'M4 2h5l3 3v9H4zM9 2v3h3M6 8h4M6 10.5h4',
    cloud: 'M5 12.5a3 3 0 0 1-.4-6 4 4 0 0 1 7.6-1.1 3.1 3.1 0 0 1-.7 7.1z',
    bang: 'M8 1.5l1.6 3.6 3.9-.6-2.3 3.2 2.3 3.2-3.9-.6L8 14l-1.6-3.7-3.9.6 2.3-3.2-2.3-3.2 3.9.6z',
    group: 'M2.5 3.5h11v9h-11zM2.5 6.5h5.5',
    actor: 'M8 2.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM4 13.5c0-2.5 1.8-4.5 4-4.5s4 2 4 4.5',
    participant: 'M3 2.5h10v4H3zM8 6.5v7',
    start: { path: 'M8 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', fill: true },
    end: 'M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
    choice: 'M8 3l5 5-5 5-5-5z',
    fork: { path: 'M2 6.8h12v2.4H2z', fill: true },
    state: 'M5 4h6a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3zM2 7.5h12',
    table: 'M2.5 3.5h11v9h-11zM2.5 6.5h11M6.5 6.5v6',
    idea: 'M6 12.5h4M6.5 14h3M8 2a4 4 0 0 0-2.3 7.3c.5.4.8.9.8 1.5V11h3v-.2c0-.6.3-1.1.8-1.5A4 4 0 0 0 8 2z',
    milestone: { path: 'M8 3l5 5-5 5-5-5z', fill: true },
    event: 'M2.5 4h11v9.5h-11zM2.5 7h11M5.5 2.5v3M10.5 2.5v3',
    commit: 'M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM1.5 8h4M10.5 8h4',
    junction: { path: 'M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z', fill: true },
    requirement: 'M4 2h8v12H4zM6 5h4M6 8h4M6 11h2',
    element: 'M2.5 6.5h11v7h-11zM2.5 6.5L4 3h8l1.5 3.5',
    flowpoint: 'M2.5 5h4v6h-4zM9.5 5h4v6h-4zM6.5 8h3',
    card: 'M3 3h10v10H3zM5.5 6h5M5.5 9h3',
    arrow: 'M2 6h7V3l5 5-5 5v-3H2z',
    triangle: 'M8 2.5l6 10.5H2z',
    hourglass: 'M3 2.5h10L3 13.5h10z',
    delay: 'M2.5 3.5h6.5a4.5 4.5 0 0 1 0 9H2.5z',
    text: 'M3.5 4h9M8 4v8.5',
    note: 'M3 2.5h7.5L13 5v8.5H3zM10.5 2.5V5H13M5.5 8h5M5.5 10.5h3.5',
    disk: 'M2.5 5h11v6h-11zM11 8h.01M4.5 8h4',
    server: 'M3 2.5h10v4H3zM3 9.5h10v4H3zM5.5 4.5h.01M5.5 11.5h.01M8.5 4.5h2M8.5 11.5h2',
    internet: 'M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM2.5 8h11M8 2.5c1.6 1.6 2.3 3.5 2.3 5.5S9.6 11.9 8 13.5M8 2.5C6.4 4.1 5.7 6 5.7 8s.7 3.9 2.3 5.5'
  };
  /* colores de estado (gantt, journey, kanban, requisitos) y de carriles (ramas de git) */
  const C = {
    good: { light: '#1a7f37', dark: '#4ac26b' }, info: { light: '#0969da', dark: '#4493f8' }, bad: { light: '#cf222e', dark: '#ff7b72' },
    warn: { light: '#9a6700', dark: '#d29922' }, soft: { light: '#8250df', dark: '#b083f0' }, gray: { light: '#6e7781', dark: '#8b949e' }
  };
  const PALETTE = [['#0969da', '#4493f8'], ['#1a7f37', '#4ac26b'], ['#bc4c00', '#f0883e'], ['#8250df', '#b083f0'], ['#bf3989', '#f778ba'], ['#1b7c83', '#39c5cf'], ['#9a6700', '#d29922'], ['#cf222e', '#ff7b72']]
    .map(([light, dark]) => ({ light, dark }));
  const REJECT = /^(pie|quadrantChart|xychart(-beta)?|radar(-beta)?|packet(-beta)?|venn(-beta)?)$/;

  class MermaidError extends Error { constructor(msg, line) { super(line ? `línea ${line}: ${msg}` : msg); this.line = line || null; this.name = 'MermaidError'; } }

  /* ---------- utilidades ---------- */
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const ENT = { quot: '"', amp: '&', lt: '<', gt: '>', nbsp: ' ', apos: "'", semi: ';', colon: ':' };
  const unq = s => { s = String(s == null ? '' : s).trim(); return s.length > 1 && ((s[0] === '"' && s.endsWith('"')) || (s[0] === "'" && s.endsWith("'"))) ? s.slice(1, -1) : s; };
  /* texto visible: sin comillas, sin HTML, sin marcas de markdown ni iconos de Font Awesome */
  function clean(s) {
    s = unq(s);
    if (s.length > 1 && s[0] === '`' && s.endsWith('`')) s = s.slice(1, -1);
    /* <br> (y \n escrito) es un salto de línea: las formas y la secuencia lo respetan */
    s = s.replace(/<br\s*\/?>/gi, '\n').replace(/\\n/g, '\n').replace(/<\/?[a-z][^>]*>/gi, '')
      .replace(/#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
      .replace(/[#&](\w+);/g, (m, k) => ENT[k] != null ? ENT[k] : m)
      .replace(/\bfa[bsrlk]?:fa-[\w-]+\s*/g, '')
      .replace(/\*\*(.+?)\*\*|__(.+?)__/g, (_, a, b) => a || b)
      .replace(/(^|[\s(])[*_](\S(?:.*?\S)?)[*_](?=$|[\s).,;:!?])/g, '$1$2');
    return s.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
  }
  const COLOR_RE = /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\([0-9.,%\s/+-]+(deg|turn|rad)?[0-9.,%\s/+-]*\)|[a-z]{3,20})$/i;
  const safeColor = v => typeof v === 'string' && COLOR_RE.test(v.trim()) && !/^(none|transparent|inherit|initial|unset|currentcolor)$/i.test(v.trim()) ? v.trim() : null;
  /* los nombres de color que más se ven en Mermaid, para poder medir su luminancia */
  const NAMED = { aqua: '#00ffff', cyan: '#00ffff', lightblue: '#add8e6', lightgreen: '#90ee90', lightyellow: '#ffffe0', lightgray: '#d3d3d3', lightgrey: '#d3d3d3',
    lightpink: '#ffb6c1', lavender: '#e6e6fa', beige: '#f5f5dc', ivory: '#fffff0', white: '#ffffff', black: '#000000', red: '#ff0000', green: '#008000',
    blue: '#0000ff', yellow: '#ffff00', orange: '#ffa500', purple: '#800080', pink: '#ffc0cb', gray: '#808080', grey: '#808080', teal: '#008080',
    navy: '#000080', olive: '#808000', maroon: '#800000', silver: '#c0c0c0', lime: '#00ff00', fuchsia: '#ff00ff', magenta: '#ff00ff', gold: '#ffd700',
    coral: '#ff7f50', salmon: '#fa8072', tomato: '#ff6347', khaki: '#f0e68c', violet: '#ee82ee', indigo: '#4b0082', brown: '#a52a2a', crimson: '#dc143c' };
  const toHex = c => {
    if (/^#/.test(c)) return c;
    if (NAMED[c.toLowerCase()]) return NAMED[c.toLowerCase()];
    const m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(c);
    return m ? '#' + [m[1], m[2], m[3]].map(x => Math.min(255, +x).toString(16).padStart(2, '0')).join('') : c;
  };
  /* luminancia aproximada de un hex; null si no es hex */
  function lum(hex) {
    let m = /^#([0-9a-f]{3,8})$/i.exec(hex); if (!m) return null;
    let h = m[1]; if (h.length <= 4) h = h.split('').map(c => c + c).join('');
    const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
    return .2126 * r + .7152 * g + .0722 * b;
  }
  const mix = (hex, t) => {
    let h = /^#([0-9a-f]{3,8})$/i.exec(hex)[1]; if (h.length <= 4) h = h.split('').map(c => c + c).join('');
    return '#' + [0, 2, 4].map(i => { const v = parseInt(h.slice(i, i + 2), 16); return Math.round(v + (255 - v) * t).toString(16).padStart(2, '0'); }).join('');
  };
  /* mezcla un hex hacia otro (t = cuánto del segundo) */
  const blend = (hex, to, t) => {
    const p = x => { let h = /^#([0-9a-f]{3,8})$/i.exec(x)[1]; if (h.length <= 4) h = h.split('').map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
    const a = p(hex), b = p(to);
    return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('');
  };
  const darken = (hex, t) => {
    let h = /^#([0-9a-f]{3,8})$/i.exec(hex)[1]; if (h.length <= 4) h = h.split('').map(c => c + c).join('');
    return '#' + [0, 2, 4].map(i => Math.round(parseInt(h.slice(i, i + 2), 16) * (1 - t)).toString(16).padStart(2, '0')).join('');
  };
  /* Un estilo de Mermaid → el color de acento de la pieza. El borde manda sobre el relleno; los
     rellenos pastel se oscurecen para que la barra lateral se vea, y los tonos muy oscuros se
     aclaran en el tema oscuro. */
  function styleColor(st) {
    if (!st) return null;
    let pick = safeColor(st.stroke) || safeColor(st.fill);
    if (!pick) return null;
    pick = toHex(pick);
    const L = lum(pick);
    if (L == null) return pick;
    if (L > .93) return null;
    let light = pick, dark = pick;
    if (L > .72) { light = darken(pick, .45); dark = pick; }
    else if (L < .22) { dark = mix(pick, .55); }
    return light === dark ? light : { light, dark };
  }
  /* `fill` y `color` de un estilo: el relleno tal cual en claro; en oscuro, mezclado hacia el lienzo
     para que no deslumbre. El texto sigue a `color` o, si no lo hay, al contraste con el relleno. */
  function styleFill(st) {
    if (!st) return null;
    const out = {}, CANVAS = '#161b22';
    const f = safeColor(st.fill) ? toHex(safeColor(st.fill)) : null;
    /* un relleno que no es hex (nombre sin tabla, hsl()…): tal cual en los dos temas; el texto, solo si lo dice */
    if (f && !/^#/.test(f)) { out.fill = { light: f, dark: f }; if (safeColor(st.color)) out.text = { light: safeColor(st.color), dark: safeColor(st.color) }; return out; }
    if (f && /^#/.test(f) && lum(f) != null) {
      const dark = blend(f, CANVAS, lum(f) > .5 ? .72 : .38);
      out.fill = { light: f, dark };
      const c = safeColor(st.color) ? toHex(safeColor(st.color)) : null;
      const onDark = lum(dark) < .45 ? '#e6edf3' : '#1f2328';
      const light = c || (lum(f) < .45 ? '#ffffff' : null);
      if (light || c) out.text = { light: light || '#1f2328', dark: c && lum(c) != null && Math.abs(lum(c) - lum(dark)) > .45 ? c : onDark };
    } else if (safeColor(st.color)) { const c = toHex(safeColor(st.color)); out.text = { light: c, dark: lum(c) != null && lum(c) < .45 ? blend(c, '#ffffff', .6) : c }; }
    return out.fill || out.text ? out : null;
  }
  /* aplica un estilo de Mermaid a una pieza: el borde da el acento; el relleno y el texto, los suyos */
  function applyStyle(node, st) {
    const col = styleColor(st); if (col) node.color = col;
    const sf = styleFill(st); if (sf) { if (sf.fill) node.fill = sf.fill; if (sf.text) node.textColor = sf.text; }
  }
  function parseStyle(s) {
    const o = {};
    /* separa por `,` o `;` fuera de paréntesis: `fill:rgb(200,0,0),stroke:#333` */
    let depth = 0, cur = '';
    const push = () => { const i = cur.indexOf(':'); if (i > 0) o[cur.slice(0, i).trim().toLowerCase()] = cur.slice(i + 1).trim(); cur = ''; };
    for (const ch of String(s || '')) { if (ch === '(') depth++; if (ch === ')') depth = Math.max(0, depth - 1); if ((ch === ',' || ch === ';') && !depth) push(); else cur += ch; }
    push();
    return o;
  }
  /* objetos sueltos de Mermaid: `@{ shape: rect, label: "Hola" }` o `{ assigned: 'x' }` */
  function parseObj(s) {
    const o = {}; const re = /([\w-]+)\s*:\s*("([^"]*)"|'([^']*)'|[^,}\n]+)/g; let m;
    while ((m = re.exec(s))) o[m[1]] = m[3] != null ? m[3] : m[4] != null ? m[4] : m[2].trim();
    return o;
  }
  /* separa por comas respetando comillas y paréntesis */
  function splitArgs(s) {
    const out = []; let cur = '', q = null, d = 0;
    for (const c of String(s)) {
      if (q) { if (c === q) q = null; cur += c; continue; }
      if (c === '"' || c === "'") { q = c; cur += c; continue; }
      if (c === '(' || c === '{' || c === '[') d++;
      if (c === ')' || c === '}' || c === ']') d--;
      if (c === ',' && d === 0) { out.push(cur.trim()); cur = ''; } else cur += c;
    }
    if (cur.trim() || out.length) out.push(cur.trim());
    return out;
  }
  const httpURL = u => /^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : null;
  const list = (T, arr, max) => arr.length <= (max || 4) ? arr.join(', ') : arr.slice(0, max || 4).join(', ') + ' ' + T.more(arr.length - (max || 4));

  /* ---------- líneas: frontmatter, directivas, comentarios, accesibilidad ---------- */
  function prep(text) {
    let src = String(text == null ? '' : text).replace(/\r\n?/g, '\n').replace(/\t/g, '    ').replace(/^\uFEFF/, '');
    const meta = { title: null, descr: null, config: '' };
    const fm = /^\s*---\n([\s\S]*?)\n---[ \t]*(\n|$)/.exec(src);
    if (fm) {
      meta.config = fm[1];
      const t = /^title:\s*(.+)$/m.exec(fm[1]); if (t) meta.title = clean(t[1]);
      src = fm[0].replace(/[^\n]/g, '') + src.slice(fm[0].length);
    }
    src = src.replace(/%%\{[\s\S]*?\}%%/g, m => m.replace(/[^\n]/g, ''));
    const lines = []; let inDescr = false, descr = [];
    src.split('\n').forEach((raw, i) => {
      let t = raw;
      /* comentario: `%%` fuera de comillas hasta el final de la línea */
      let q = false; for (let k = 0; k < t.length - 1; k++) { if (t[k] === '"') q = !q; else if (!q && t[k] === '%' && t[k + 1] === '%') { t = t.slice(0, k); break; } }
      const trimmed = t.trim();
      if (inDescr) { if (trimmed === '}') { inDescr = false; meta.descr = descr.join(' ').trim(); } else descr.push(trimmed); return; }
      let m;
      if ((m = /^accTitle\s*:\s*(.*)$/.exec(trimmed))) { meta.accTitle = clean(m[1]); return; }
      if ((m = /^accDescr\s*:\s*(.*)$/.exec(trimmed))) { meta.descr = clean(m[1]); return; }
      if (/^accDescr\s*\{\s*$/.test(trimmed)) { inDescr = true; return; }
      if (!trimmed) return;
      lines.push({ n: i + 1, raw: t.replace(/\s+$/, ''), t: trimmed, indent: t.length - t.replace(/^\s+/, '').length });
    });
    return { lines, meta };
  }
  /* Una sentencia por línea o separada por `;` (fuera de comillas y corchetes). Las comillas
     sin cerrar unen líneas: Mermaid admite textos de varias líneas entre comillas. */
  function statements(lines, split) {
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      let t = lines[i].t; const n = lines[i].n;
      while ((t.match(/"/g) || []).length % 2 && i + 1 < lines.length) t += ' ' + lines[++i].t;
      if (!split) { out.push({ t, n }); continue; }
      let cur = '', q = false, d = 0;
      for (const c of t) {
        if (c === '"') q = !q;
        if (!q && '[({'.includes(c)) d++;
        if (!q && '])}'.includes(c)) d = Math.max(0, d - 1);
        if (c === ';' && !q && d === 0) { if (cur.trim()) out.push({ t: cur.trim(), n }); cur = ''; } else cur += c;
      }
      if (cur.trim()) out.push({ t: cur.trim(), n });
    }
    return out;
  }

  /* ---------- constructor del JSON ---------- */
  function Builder(lang) {
    this.lang = lang; this.T = STR[lang] || STR.es;
    this.map = new Map(); this.used = new Set(); this.nodes = new Map(); this.lanes = new Map(); this.edges = [];
    this.warnings = []; this.kinds = new Set(); this.kindNames = {}; this.statuses = {}; this.flows = []; this.levelNames = null;
  }
  Builder.prototype = {
    warn(msg, line) { this.warnings.push(line ? `línea ${line}: ${msg}` : msg); },
    /* id de Mermaid → id válido para GraphX (^[A-Za-z0-9][A-Za-z0-9._:/-]*$), estable y único */
    id(raw) {
      raw = String(raw);
      if (this.map.has(raw)) return this.map.get(raw);
      let base = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9._:/-]+/g, '-').replace(/^[^A-Za-z0-9]+|-+$/g, '');
      if (!base) base = 'n';
      if (base.length > 48) base = base.slice(0, 48).replace(/-+$/, '');
      let id = base, k = 2; while (this.used.has(id)) id = `${base}-${k++}`;
      this.used.add(id); this.map.set(raw, id); return id;
    },
    fresh(prefix) { let k = this.edges.length + 1, id; do id = `${prefix}${k++}`; while (this.used.has(id)); this.used.add(id); this.map.set('\u0000' + id, id); return id; },
    has(raw) { return this.map.has(String(raw)) && this.nodes.has(this.map.get(String(raw))); },
    get(raw) { return this.nodes.get(this.map.get(String(raw))); },
    node(raw, props) {
      const id = this.id(raw);
      let n = this.nodes.get(id);
      if (!n) { n = { id, label: clean(raw) || id }; this.nodes.set(id, n); }
      for (const k in props || {}) if (props[k] != null && props[k] !== '') n[k] = props[k];
      if (n.kind) this.kinds.add(n.kind);
      return n;
    },
    lane(raw, props) {
      const id = this.id(raw);
      let l = this.lanes.get(id);
      if (!l) { l = { id, label: clean(raw) || id }; this.lanes.set(id, l); }
      Object.assign(l, props || {});
      return l;
    },
    /* padre por anidamiento: gana el contenedor más profundo, nunca se crea un ciclo */
    setParent(childId, parentId) {
      if (!parentId || childId === parentId) return;
      const n = this.nodes.get(childId); if (!n) return;
      const anc = id => { const out = []; let p = this.nodes.get(id) && this.nodes.get(id).parent; while (p && !out.includes(p)) { out.push(p); p = this.nodes.get(p) && this.nodes.get(p).parent; } return out; };
      if (anc(parentId).includes(childId)) return;
      if (!n.parent || anc(parentId).includes(n.parent)) n.parent = parentId;
    },
    edge(from, to, props) {
      const e = Object.assign({ id: this.fresh('e'), from, to }, props || {});
      for (const k in e) if (e[k] == null || e[k] === '') delete e[k];
      this.edges.push(e); return e;
    },
    status(key, label, color) { this.statuses[key] = { label, color }; return key; },
    /* una nota de Mermaid es una pieza propia, unida a lo que anota por una línea sin flecha */
    note(text, target) {
      const nd = this.node('\u0000note' + this.nodes.size, { label: clean(text) || ' ', kind: 'note', shape: 'note' });
      const t = target && this.nodes.get(target);
      if (t && t.parent) this.setParent(nd.id, t.parent);
      if (t) this.edge(nd.id, t.id, { kind: 'async', head: 'none', emphasis: 'muted' });
      return nd;
    },
    finish(type, meta, extra) {
      const T = this.T;
      const nodes = [...this.nodes.values()], lanes = [...this.lanes.values()];
      for (const n of nodes) {
        if (n.parent && !this.nodes.has(n.parent)) delete n.parent;
        if (n.lane && (n.parent || !this.lanes.has(n.lane))) delete n.lane;
      }
      /* una conexión entre una pieza y su propio contenedor no tiene dibujo en GraphX */
      const ancOf = id => { const out = []; let p = this.nodes.get(id) && this.nodes.get(id).parent; while (p && this.nodes.has(p) && !out.includes(p)) { out.push(p); p = this.nodes.get(p).parent; } return out; };
      for (const e of this.edges) if (ancOf(e.from).includes(e.to) || ancOf(e.to).includes(e.from)) this.warn(`la conexión ${e.from} → ${e.to} une una pieza con su propio contenedor: GraphX no la dibuja`);
      /* resumen por defecto: qué es, qué contiene y con qué se conecta */
      const ins = new Map(), outs = new Map(), kids = new Map();
      const lab = id => (this.nodes.get(id) || this.lanes.get(id) || { label: id }).label;
      for (const e of this.edges) {
        if (!ins.has(e.to)) ins.set(e.to, []); ins.get(e.to).push(lab(e.from) + (e.label ? ` («${e.label}»)` : ''));
        if (!outs.has(e.from)) outs.set(e.from, []); outs.get(e.from).push(lab(e.to) + (e.label ? ` («${e.label}»)` : ''));
      }
      for (const n of nodes) if (n.parent) kids.set(n.parent, (kids.get(n.parent) || 0) + 1);
      for (const n of nodes) {
        if (n.summary) continue;
        const parts = [];
        const kn = this.kindNames[n.kind] || T.kinds[n.kind];
        if (kn) parts.push(kn);
        if (n._desc) parts.push(n._desc);
        if (kids.get(n.id)) parts.push(T.contains(kids.get(n.id)));
        if (ins.get(n.id)) parts.push(`${T.from}: ${list(T, ins.get(n.id))}`);
        if (outs.get(n.id)) parts.push(`${T.to}: ${list(T, outs.get(n.id))}`);
        n.summary = parts.join('. ') + '.';
      }
      nodes.forEach(n => Object.keys(n).forEach(k => { if (k[0] === '_') delete n[k]; }));
      /* profundidad: todo abierto salvo en diagramas grandes */
      const depth = n => { let d = n.lane ? 1 : 0, p = n.parent; while (p) { d++; p = this.nodes.get(p).parent; } if (n.parent) { let r = n; while (r.parent) r = this.nodes.get(r.parent); if (r.lane) d++; } return d; };
      const maxDepth = Math.max(0, ...nodes.map(depth));
      const spec = { schema: 'graphx/1', title: meta.title || meta.accTitle || (extra && extra.title) || T.untitled, summary: meta.descr || T.converted(type), lang: this.lang };
      if (this.direction) spec.direction = this.direction;
      spec.initialDepth = nodes.length > 140 ? Math.min(maxDepth, 1) : maxDepth;
      if (this.levelNames) spec.levels = Array.from({ length: maxDepth + 1 }, (_, d) => ({ depth: d, label: this.levelNames[d] || T.level(d + 1) }));
      if (Object.keys(this.statuses).length) spec.statuses = this.statuses;
      const used = new Set(nodes.map(n => n.kind || 'other'));
      const icons = {}; used.forEach(k => { if (ICONS[k]) icons[k] = ICONS[k]; });
      if (Object.keys(icons).length) spec.icons = icons;
      const kinds = {}; used.forEach(k => { const nm = this.kindNames[k] || T.kinds[k]; if (nm) kinds[k] = nm; });
      spec.legend = Object.assign({ kinds }, this.legendEdges && this.legendEdges.length ? { edges: this.legendEdges } : {});
      spec.layout = Object.assign({ cycles: 'dfs', backEdges: 'route' }, this.layout || {});
      if (lanes.length) spec.lanes = lanes.filter(l => nodes.some(n => n.lane === l.id));
      spec.nodes = nodes;
      spec.edges = this.edges;
      if (this.flows.length) spec.flows = this.flows;
      if (this.graphTab === false) spec.graphTab = false;
      if (this.initialView) spec.initialView = this.initialView;
      return spec;
    }
  };

  /* ================= flowchart / graph (también block-beta) ================= */
  const SHAPES = [
    ['(((', ')))', 'dcircle'], ['((', '))', 'circle'], ['([', '])', 'terminal'], ['[[', ']]', 'subroutine'], ['[(', ')]', 'datastore'],
    ['{{', '}}', 'hexagon'], ['[/', ['/]', '\\]'], 'io'], ['[\\', ['\\]', '/]'], 'io-l'], ['<[', ']>', 'arrow-right'], ['(', ')', 'rounded'], ['[', ']', 'rect'],
    ['{', '}', 'decision'], ['>', ']', 'flag']
  ];
  /* el tipo (icono de la leyenda) de cada forma: la mayoría se llaman igual */
  const KIND_OF_SHAPE = { rect: 'step', 'io-l': 'io', 'trapezoid-t': 'trapezoid', 'triangle-down': 'triangle', 'cylinder-h': 'queue', 'arrow-right': 'arrow', 'arrow-left': 'arrow', 'arrow-up': 'arrow', 'arrow-down': 'arrow' };
  const kindOfShape = sh => KIND_OF_SHAPE[sh] || sh;
  /* nombres de forma de la sintaxis nueva `id@{ shape: … }` */
  const NEW_SHAPES = {
    rect: 'rect', proc: 'rect', process: 'rect', rectangle: 'rect', rounded: 'rounded', event: 'rounded', stadium: 'terminal', pill: 'terminal', terminal: 'terminal',
    'fr-rect': 'subroutine', subproc: 'subroutine', subprocess: 'subroutine', subroutine: 'subroutine', 'framed-rectangle': 'subroutine',
    cyl: 'datastore', db: 'datastore', database: 'datastore', cylinder: 'datastore', 'lin-cyl': 'datastore', disk: 'datastore', 'bow-rect': 'datastore', 'stored-data': 'datastore',
    'h-cyl': 'cylinder-h', das: 'cylinder-h', 'horizontal-cylinder': 'cylinder-h',
    circle: 'circle', circ: 'circle', 'sm-circ': 'start', start: 'start', 'small-circle': 'start', 'fr-circ': 'end', stop: 'end', 'dbl-circ': 'dcircle', 'double-circle': 'dcircle', 'cross-circ': 'circle', summary: 'circle',
    diam: 'decision', diamond: 'decision', decision: 'decision', question: 'decision', hex: 'hexagon', hexagon: 'hexagon', prepare: 'hexagon',
    'lean-r': 'io', 'lean-right': 'io', 'in-out': 'io', 'lean-l': 'io-l', 'lean-left': 'io-l', 'out-in': 'io-l', 'trap-b': 'trapezoid', priority: 'trapezoid', trapezoid: 'trapezoid',
    'trap-t': 'trapezoid-t', manual: 'trapezoid-t', 'inv-trapezoid': 'trapezoid-t', 'curv-trap': 'trapezoid-t', display: 'trapezoid-t',
    doc: 'document', document: 'document', docs: 'document', documents: 'document', 'lin-doc': 'document', 'tag-doc': 'document', 'lined-document': 'document', 'st-doc': 'document',
    cloud: 'cloud', bang: 'bang', flag: 'flag', 'paper-tape': 'flag', odd: 'flag', fork: 'fork', join: 'fork', 'notch-rect': 'card', card: 'card',
    'st-rect': 'subroutine', procs: 'subroutine', processes: 'subroutine', 'div-rect': 'rect', 'win-pane': 'rect', 'lin-rect': 'rect', 'tag-rect': 'rect',
    'notch-pent': 'hexagon', 'loop-limit': 'hexagon', tri: 'triangle', extract: 'triangle', 'flip-tri': 'triangle-down', 'manual-file': 'triangle-down',
    hourglass: 'hourglass', collate: 'hourglass', bolt: 'flag', 'com-link': 'flag',
    brace: 'note', comment: 'note', 'brace-r': 'note', braces: 'note', text: 'text', delay: 'delay', 'half-rounded-rectangle': 'delay'
  };

  function Scan(s) { this.s = s; this.p = 0; }
  Scan.prototype = {
    ws() { while (this.p < this.s.length && /\s/.test(this.s[this.p])) this.p++; },
    eof() { this.ws(); return this.p >= this.s.length; },
    rest() { return this.s.slice(this.p); },
    at(str) { return this.s.startsWith(str, this.p); }
  };
  /* id de nodo: hasta un delimitador de forma, de enlace o de clase */
  function readId(sc) {
    const s = sc.s; let i = sc.p;
    if (s[i] === '"') { const j = s.indexOf('"', i + 1); if (j > i) { sc.p = j + 1; return s.slice(i + 1, j); } }
    while (i < s.length) {
      const c = s[i], nx = s[i + 1];
      if (/[\s\[\](){}<>&;|"'=~,]/.test(c)) break;
      if (c === '-' && (nx == null || /[-.=>\s]/.test(nx))) break;
      if (c === '.' && nx === '-') break;
      if (c === ':' || c === '@') break;
      i++;
    }
    const id = s.slice(sc.p, i); sc.p = i; return id;
  }
  /* texto dentro de una forma hasta su cierre (o uno de sus cierres) */
  function readShapeText(sc, closers) {
    const s = sc.s; closers = [].concat(closers);
    let i = sc.p; while (s[i] === ' ') i++;
    if (s[i] === '"') {
      const j = s.indexOf('"', i + 1);
      if (j > 0) {
        let k = j + 1; while (s[k] === ' ') k++;
        const c = closers.find(x => s.startsWith(x, k));
        if (c) { sc.p = k + c.length; return { text: s.slice(i, j + 1), closer: c }; }
      }
    }
    /* sin comillas: el primer cierre, respetando anidamiento del mismo corchete */
    let best = -1, bc = null;
    for (const c of closers) {
      let j = sc.p, depth = 0;
      const open = { ']': '[', ')': '(', '}': '{' }[c] || null;
      for (; j < s.length; j++) {
        if (open && c.length === 1 && s[j] === open) depth++;
        if (s.startsWith(c, j)) { if (depth === 0) break; if (c.length === 1) depth--; }
      }
      if (j < s.length && (best < 0 || j < best)) { best = j; bc = c; }
    }
    if (best < 0) return null;
    const text = s.slice(sc.p, best); sc.p = best + bc.length; return { text, closer: bc };
  }
  function readNode(sc) {
    sc.ws();
    const start = sc.p;
    const raw = readId(sc);
    if (!raw) { sc.p = start; return null; }
    const node = { raw };
    for (const [open, close, shape] of SHAPES) {
      if (!sc.at(open)) continue;
      const save = sc.p; sc.p += open.length;
      const r = readShapeText(sc, close);
      if (!r) { sc.p = save; continue; }
      node.label = r.text; node.shape = shape;
      if (open === '[/' && r.closer === '\\]') node.shape = 'trapezoid';
      if (open === '[\\' && r.closer === '/]') node.shape = 'trapezoid-t';
      /* flecha de block-beta: `id<["texto"]>(right)`; la dirección da la forma */
      if (open === '<[') {
        const m = /^\(\s*(\w+)(?:\s*,\s*\w+)*\s*\)/.exec(sc.rest());
        if (m) { sc.p += m[0].length; const d = { right: 'right', left: 'left', up: 'up', down: 'down', x: 'right', y: 'down' }[m[1].toLowerCase()]; node.shape = 'arrow-' + (d || 'right'); }
      }
      break;
    }
    if (sc.at('@{')) {
      let d = 0, j = sc.p + 1, q = false;
      for (; j < sc.s.length; j++) { const c = sc.s[j]; if (c === '"') q = !q; if (q) continue; if (c === '{') d++; if (c === '}' && --d === 0) break; }
      node.meta = parseObj(sc.s.slice(sc.p + 2, j)); sc.p = j + 1;
    }
    let m = /^:::([\w-]+)/.exec(sc.rest()); if (m) { node.cls = m[1]; sc.p += m[0].length; }
    m = /^:(\d+)/.exec(sc.rest()); if (m) { node.gspan = +m[1]; sc.p += m[0].length; } /* ancho de bloque en block-beta */
    return node;
  }
  function readGroup(sc) {
    const out = []; let n = readNode(sc); if (!n) return null; out.push(n);
    for (;;) { const save = sc.p; sc.ws(); if (sc.at('&')) { sc.p++; n = readNode(sc); if (!n) { sc.p = save; break; } out.push(n); } else { sc.p = save; break; } }
    return out;
  }
  function readLink(sc) {
    sc.ws();
    let rest = sc.rest(), eid = null, m;
    if ((m = /^([A-Za-z0-9_]+)@(?=[-=~<.ox])/.exec(rest))) { eid = m[1]; sc.p += m[0].length; rest = sc.rest(); }
    let tail = '', line, head = '', label = null;
    /* con texto en medio: `-- texto -->`, `== texto ==>`, `-. texto .->` */
    m = /^(<|[xo](?=[-=]))?(--|==|-\.)(?![-=.>~])(?![xo](?:\s|$))\s*(.*?)\s*(-{2,}>|-{3,}|-{2,}[xo]|={2,}>|={3,}|={2,}[xo]|\.-+>|\.-+[xo]|\.-+)/.exec(rest);
    if (m && m[3] && !/^\|/.test(m[3])) {
      tail = m[1] || ''; line = m[2] + m[4]; label = m[3]; sc.p += m[0].length;
    } else {
      m = /^(<|[xo](?=[-=]))?(~{3,}|-{2,}|={2,}|-\.+-)(>|[xo])?/.exec(rest);
      if (!m) return null;
      /* `--x`/`--o` solo son puntas si no empiezan el nombre del nodo siguiente (`--other`) */
      if (m[3] && m[3] !== '>' && /^\w/.test(rest.slice(m[0].length)) && m[2].length > 2) { m = [m[0].slice(0, -1), m[1], m[2], undefined]; }
      tail = m[1] || ''; line = m[2]; head = m[3] || ''; sc.p += m[0].length;
    }
    if (!head) { const last = line[line.length - 1]; if ('>xo'.includes(last)) head = last; }
    sc.ws();
    if (sc.at('|')) { const j = sc.s.indexOf('|', sc.p + 1); if (j > sc.p) { label = sc.s.slice(sc.p + 1, j); sc.p = j + 1; } }
    const style = /~/.test(line) ? 'invisible' : /=/.test(line) ? 'thick' : /\./.test(line) ? 'dotted' : 'solid';
    return { eid, tail, head, style, label: label != null ? clean(label) : null };
  }

  function parseFlowchart(P, b, opts) {
    const T = b.T;
    const head = P.lines[0].t;
    const dir = (/^\S+\s+(\w+)/.exec(head) || [])[1] || 'TD';
    b.direction = /^(LR|RL)$/i.test(dir) ? 'right' : 'down';
    const block = opts.block;
    /* en un flowchart, la arista que vuelve a algo escrito antes es la del bucle (como en dagre) */
    b.layout = { cycles: 'order' };
    const classes = new Map(), nodeClass = new Map(), nodeStyle = new Map(), linkStyles = [];
    const linkIdx = [], edgeById = new Map(), stack = [];
    let thick = 0;
    /* block-beta: cada bloque ocupa su celda en la rejilla de su contenedor (`columns`, `:N`, `space`) */
    const grids = [{ cols: Infinity, r: 0, c: 0 }];
    const place = (n, span) => {
      const g = grids[grids.length - 1];
      if (g.c > 0 && g.c + span > g.cols) { g.r++; g.c = 0; }
      if (n) n.grid = { r: g.r, c: g.c, span };
      g.c += span;
    };
    const declare = (nd) => {
      if (block && /^space$/.test(nd.raw) && nd.label == null) { place(null, nd.gspan || 1); return null; }
      if (nd.meta && edgeById.has(nd.raw) && nd.label == null) {
        const e = edgeById.get(nd.raw);
        if (/^(true|fast|slow)$/i.test(nd.meta.animate || nd.meta.animation || '')) e.animated = true;
        return null;
      }
      const props = {};
      if (nd.label != null) props.label = clean(nd.label) || ' ';
      if (nd.meta && nd.meta.label) props.label = clean(nd.meta.label);
      const shape = nd.meta && nd.meta.shape ? (NEW_SHAPES[nd.meta.shape.toLowerCase()] || 'rect') : nd.shape;
      const n = b.node(nd.raw, props);
      if (shape) { n.shape = shape; n.kind = kindOfShape(shape); b.kinds.add(n.kind); }
      else if (!n.kind) { n.shape = 'rect'; n.kind = 'step'; b.kinds.add('step'); }
      if (nd.cls) nodeClass.set(n.id, (nodeClass.get(n.id) || []).concat(nd.cls));
      if (stack.length) b.setParent(n.id, stack[stack.length - 1]);
      if (block && !n.grid) place(n, nd.gspan || 1);
      return n;
    };
    const addEdge = (a, c, l) => {
      if (l.style === 'invisible' || !a || !c) { linkIdx.push(null); return; }
      const notes = [];
      if (l.tail === '<' && l.head === '>') notes.push(T.bidir);
      if (l.head === 'x' || l.tail === 'x') notes.push(T.crossEnd);
      if (l.head === 'o' || l.tail === 'o') notes.push(T.circleEnd);
      if (!l.head && !l.tail) notes.push(T.open);
      if (l.style === 'thick') { notes.push(T.thick); thick++; }
      if (l.style === 'dotted') notes.push(T.dotted);
      const END = { '>': null, x: 'cross', o: 'circle', '<': 'arrow' };
      const e = b.edge(a.id, c.id, { kind: l.style === 'dotted' ? 'async' : 'call', label: l.label || null, summary: notes.join(' ') || null, _thick: l.style === 'thick' || null,
        head: l.head ? END[l.head] : 'none', tail: l.tail ? END[l.tail] : null });
      linkIdx.push(e);
      if (l.eid) edgeById.set(l.eid, e);
    };
    for (const { t, n } of statements(P.lines.slice(1), true)) {
      let m;
      if ((m = /^subgraph\s+(.+)$/i.exec(t)) || /^block(:[\w-]+)?(:\d+)?$/.test(t) && block) {
        let raw, title;
        if (m) {
          const r = m[1].trim();
          if ((m = /^([^\s\["]+)\s*\[(.*)\]$/.exec(r))) { raw = m[1]; title = m[2]; }
          else if ((m = /^"(.*)"$/.exec(r))) { raw = m[1]; title = m[1]; }
          else { raw = r; title = r; }
        } else {
          m = /^block(?::([\w-]+))?/.exec(t); raw = m[1] || '\u0000block' + b.used.size; title = m[1] || ' ';
        }
        const g = b.node(raw, { label: clean(title) || ' ', kind: 'group' });
        if (stack.length) b.setParent(g.id, stack[stack.length - 1]);
        if (block) { const sp = /:(\d+)$/.exec(t); place(g, sp ? +sp[1] : 1); grids.push({ cols: Infinity, r: 0, c: 0, node: g }); }
        stack.push(g.id); continue;
      }
      if (/^end$/i.test(t)) {
        if (!stack.length) { b.warn(T.ignored(t), n); continue; }
        stack.pop();
        if (block && grids.length > 1) { const g = grids.pop(); if (isFinite(g.cols)) g.node.gridCols = g.cols; }
        continue;
      }
      if ((m = /^columns\s+(\d+)$/i.exec(t)) && block) { grids[grids.length - 1].cols = Math.max(1, +m[1]); continue; }
      if ((m = /^space(?::(\d+))?$/.exec(t)) && block) { place(null, m[1] ? +m[1] : 1); continue; }
      if (/^direction\s+\w+$/i.test(t) || /^columns\s+/i.test(t)) continue;
      if ((m = /^classDef\s+([\w,-]+)\s+(.+)$/.exec(t))) { m[1].split(',').forEach(c => classes.set(c.trim(), parseStyle(m[2]))); continue; }
      if ((m = /^class\s+(.+?)\s+([\w-]+)$/.exec(t))) { m[1].split(',').forEach(r => { const id = b.id(r.trim()); nodeClass.set(id, (nodeClass.get(id) || []).concat(m[2])); }); continue; }
      if ((m = /^style\s+(\S+)\s+(.+)$/.exec(t))) { nodeStyle.set(b.id(m[1]), parseStyle(m[2])); continue; }
      if ((m = /^linkStyle\s+([\d,\s]+|default)\s+(.+)$/.exec(t))) { linkStyles.push([m[1], parseStyle(m[2])]); continue; }
      if ((m = /^click\s+(\S+)\s+(.*)$/.exec(t))) {
        const n2 = b.has(m[1]) ? b.get(m[1]) : b.node(m[1], { kind: 'step' });
        const q = [...m[2].matchAll(/"([^"]*)"/g)].map(x => x[1]);
        const url = httpURL(q[0]) || httpURL((/(?:href\s+)?(\S+)/.exec(m[2]) || [])[1]);
        if (url) (n2.links = n2.links || []).push({ kind: 'url', url, label: clean(q[1] || '') || undefined });
        const tip = url ? q[1] : q[0];
        if (tip) n2._desc = clean(tip);
        continue;
      }
      /* cadena: A --> B & C -- texto --> D. Se analiza entera antes de declarar nada: una línea que
         no se entiende no deja piezas a medias. En block-beta, varios bloques seguidos sin enlace. */
      const sc = new Scan(t), seq = [];
      let g = readGroup(sc), bad = !g;
      if (g) seq.push({ g });
      while (!bad && !sc.eof()) {
        const l = readLink(sc);
        if (!l && !block) { bad = true; break; }
        g = readGroup(sc);
        if (!g) { bad = true; break; }
        seq.push({ l, g });
      }
      if (bad) { b.warn(T.ignored(t.length > 60 ? t.slice(0, 60) + '…' : t), n); continue; }
      let prev = null;
      for (const { l, g: grp } of seq) {
        const cur = grp.map(x => declare(x, n)).filter(Boolean);
        if (l && prev) prev.forEach(a => cur.forEach(c => addEdge(a, c, l)));
        prev = cur;
      }
    }
    /* estilos: classDef/class/:::, style y linkStyle */
    for (const node of b.nodes.values()) {
      let st = null;
      (nodeClass.get(node.id) || []).forEach(c => { if (classes.has(c)) st = Object.assign(st || {}, classes.get(c)); });
      if (nodeStyle.has(node.id)) st = Object.assign(st || {}, nodeStyle.get(node.id));
      applyStyle(node, st);
    }
    for (const [which, st] of linkStyles) {
      const col = safeColor(st.stroke) ? styleColor({ stroke: st.stroke }) : null; if (!col) continue;
      (which === 'default' ? linkIdx : which.split(',').map(i => linkIdx[+i.trim()])).forEach(e => { if (e) e.color = col; });
    }
    /* grueso = énfasis, pero «hero» solo sirve si hay una o dos */
    for (const e of b.edges) { if (e._thick && thick <= 2) e.emphasis = 'hero'; delete e._thick; }
    while (block && grids.length > 1) { const g = grids.pop(); if (isFinite(g.cols)) g.node.gridCols = g.cols; }
    if (block) b.layout = Object.assign({ mode: 'grid' }, isFinite(grids[0].cols) ? { columns: grids[0].cols } : {});
    /* las formas que Mermaid pinta como contenedor vacío (subgrafo sin nada dentro) siguen siendo grupo */
    const used = new Set(b.edges.map(e => e.kind));
    b.legendEdges = [{ label: T.link, style: 'solid' }];
    if (used.has('async')) b.legendEdges.push({ label: T.dotted.replace(/\.$/, ''), style: 'dashed' });
    if (b.edges.some(e => e.emphasis === 'hero')) b.legendEdges.push({ label: T.thick.replace(/\.$/, ''), style: 'hero' });
    if (b.legendEdges.length < 2) b.legendEdges = null;
  }

  /* ================= sequenceDiagram ================= */
  const SEQ_ARROW = /^(.+?)\s*(<<-->>|<<->>|-->>|->>|--x|-x|--\)|-\)|-->|->)\s*([+-]?)\s*([^:]+?)\s*(?::(.*))?$/;
  function parseSequence(P, b) {
    const T = b.T;
    const flow = { id: 'secuencia', title: P.meta.title || T.sequence, participants: [], messages: [] };
    const seen = new Set(), sent = new Map(), recv = new Map();
    const blocks = []; let box = null, title = null;
    const TYPES = { participant: 'participant', actor: 'actor', boundary: 'ui', control: 'config', entity: 'table', database: 'datastore', collections: 'queue', queue: 'queue' };
    /* forma de la cabecera: el actor es una figura; la base de datos, un cilindro; la cola, un tubo */
    const HEAD = { participant: 'rect', actor: 'actor', datastore: 'datastore', queue: 'cylinder-h' };
    const WIDE = 300;
    const part = (raw, props) => {
      raw = raw.trim();
      const n = b.node(raw, props || {});
      if (!n.kind) { n.kind = 'participant'; b.kinds.add('participant'); }
      if (HEAD[n.kind]) n.shape = HEAD[n.kind];
      n.maxWidth = WIDE;
      if (!seen.has(n.id)) { seen.add(n.id); flow.participants.push(n.id); }
      return n;
    };
    /* los mensajes se numeran m1, m2… como antes; marcos, notas y activaciones, r1, r2… */
    let nMsg = 0, nRow = 0;
    const push = m => { m.id = m.from != null ? 'm' + (++nMsg) : 'r' + (++nRow); flow.messages.push(m); return m; };
    for (const { t, n } of statements(P.lines.slice(1), false)) {
      let m;
      if ((m = /^title\s*:?\s*(.+)$/.exec(t))) { title = clean(m[1]); continue; }
      if ((m = /^(create\s+)?(participant|actor)\s+(.+?)(?:\s+as\s+(.+))?$/.exec(t))) {
        m = [m[0], m[2], m[3], m[4], m[1]];
        let raw = m[2], meta = null;
        const at = /^(.+?)@\{(.*)\}$/.exec(raw); if (at) { raw = at[1]; meta = parseObj(at[2].replace(/"(\w+)"\s*:/g, '$1:')); }
        const kind = meta && TYPES[meta.type] ? TYPES[meta.type] : TYPES[m[1]];
        const nd = part(raw, { label: m[3] ? clean(m[3]) : (meta && meta.alias ? clean(meta.alias) : null), kind });
        if (HEAD[kind]) nd.shape = HEAD[kind]; else delete nd.shape;
        b.kinds.add(kind);
        if (box) nd.lane = box.id;
        /* `create`: la cabecera aparece en esa fila, no arriba */
        if (m[4]) push({ kind: 'create', node: nd.id });
        continue;
      }
      if ((m = /^box(?:\s+(.*))?$/.exec(t))) {
        let rest = (m[1] || '').trim(), color = null;
        const cm = /^(rgba?\([^)]*\)|hsla?\([^)]*\)|#[0-9a-f]{3,8}\b|[a-z]+\b)\s*(.*)$/i.exec(rest);
        if (cm && safeColor(cm[1]) && (cm[2] || /^(rgb|hsl|#)/i.test(cm[1]) || /^(aqua|blue|red|green|yellow|orange|purple|pink|gray|grey|lightblue|lightgreen|lightyellow|transparent|white|black|teal|navy|olive|maroon|silver|lime|fuchsia|cyan|magenta)$/i.test(cm[1]))) { color = cm[1]; rest = cm[2]; }
        box = b.lane('\u0000box' + n, { label: clean(rest) || ' ' });
        /* el tono de `box` es un fondo: se usa tal cual, también los pastel (en oscuro, hacia el lienzo) */
        const hex = color && safeColor(color) ? toHex(safeColor(color)) : null;
        if (hex && /^#/.test(hex) && !/^transparent$/i.test(color)) box.color = { light: hex, dark: blend(hex, '#0d1117', .72) };
        blocks.push({ type: 'box' }); continue;
      }
      /* bloques: un marco con su tipo en una pestaña y la condición al lado; `else`/`and`/`option`
         lo parten con una línea discontinua */
      if ((m = /^(loop|alt|opt|par|par_over|critical|break|rect)\b\s*(.*)$/.exec(t))) {
        const type = m[1] === 'par_over' ? 'par' : m[1];
        blocks.push({ type });
        const blk = { kind: 'block', block: type, title: type === 'rect' ? '' : T.blocks[type], label: type === 'rect' ? '' : clean(m[2]) };
        /* el fondo de `rect` es el color que dice, tal cual (en oscuro, hacia el lienzo) */
        if (type === 'rect') { const c = safeColor(m[2].trim()) ? toHex(safeColor(m[2].trim())) : null; if (c && /^#/.test(c)) blk.color = { light: c, dark: blend(c, '#0d1117', .7) }; }
        push(blk);
        continue;
      }
      if ((m = /^(else|and|option)\b\s*(.*)$/.exec(t))) { push({ kind: 'else', title: T.blocks[m[1]], label: clean(m[2]) }); continue; }
      if (/^end$/.test(t)) {
        const bl = blocks.pop();
        if (!bl) { b.warn(T.ignored(t), n); continue; }
        if (bl.type === 'box') { box = null; continue; }
        push({ kind: 'end' });
        continue;
      }
      if ((m = /^note\s+(left of|right of|over)\s+([^:]+?)\s*:\s*(.*)$/i.exec(t))) {
        const over = m[2].split(',').map(p => part(p).id);
        push({ kind: 'note', side: /left/i.test(m[1]) ? 'left' : /right/i.test(m[1]) ? 'right' : 'over', over, label: clean(m[3]) || ' ' });
        continue;
      }
      if ((m = /^links?\s+([^:]+?)\s*:\s*(.*)$/.exec(t))) {
        const nd = part(m[1]); const links = nd.links = nd.links || [];
        if (/^link\b/.test(t)) { const lm = /^(.*?)\s*@\s*(\S+)$/.exec(m[2]); if (lm && httpURL(lm[2])) links.push({ kind: 'url', url: lm[2], label: clean(lm[1]) }); }
        else { try { const o = JSON.parse(m[2]); for (const k in o) if (httpURL(o[k])) links.push({ kind: 'url', url: o[k], label: clean(k) }); } catch (_) { b.warn(T.ignored(t), n); } }
        continue;
      }
      if ((m = /^(activate|deactivate)\s+(.+)$/.exec(t))) { push({ kind: m[1], node: part(m[2]).id }); continue; }
      /* `destroy`: la línea de vida acaba (con un aspa) en el siguiente mensaje que lo toca */
      if ((m = /^destroy\s+(.+)$/.exec(t))) { push({ kind: 'destroy', node: part(m[1]).id }); continue; }
      if (/^(autonumber|properties|details)\b/.test(t)) continue;
      if ((m = SEQ_ARROW.exec(t))) {
        const a = part(m[1]), c = part(m[4]), arrow = m[2];
        const dotted = arrow.startsWith('--') || arrow === '<<-->>';
        const kind = a.id === c.id ? 'self' : dotted ? 'return' : 'sync';
        const notes = [];
        if (/x$/.test(arrow)) notes.push(T.lost);
        if (/^<</.test(arrow)) notes.push(T.bidir);
        const msg = { from: a.id, to: c.id, label: clean(m[5] || '') || '…', kind };
        if (/x$/.test(arrow)) msg.head = 'cross';
        else if (/\)$/.test(arrow)) msg.head = 'open';
        else if (!/>>$/.test(arrow)) msg.head = 'line';
        if (/^<</.test(arrow)) msg.tail = 'arrow';
        /* `A->>+B` activa a B; `B-->>-A` desactiva a quien envía */
        if (m[3] === '+') msg.activate = c.id;
        if (m[3] === '-') msg.deactivate = a.id;
        if (notes.length) msg.summary = notes.join(' ');
        push(msg);
        sent.set(a.id, (sent.get(a.id) || 0) + 1); recv.set(c.id, (recv.get(c.id) || 0) + 1);
        continue;
      }
      b.warn(T.ignored(t), n);
    }
    while (blocks.length) { const bl = blocks.pop(); if (bl.type !== 'box') push({ kind: 'end' }); }
    if (!flow.participants.length) throw new MermaidError('sequenceDiagram sin participantes');
    if (title) flow.title = title;
    for (const id of flow.participants) {
      const nd = b.nodes.get(id);
      nd.summary = `${T.kinds[nd.kind] || ''}${nd.summary ? '. ' + nd.summary : ''}. ${T.sends(sent.get(id) || 0)}, ${T.receives(recv.get(id) || 0)}.`.replace(/^\. /, '');
    }
    if (!flow.messages.some(m => m.from)) throw new MermaidError('sequenceDiagram sin mensajes');
    b.flows.push(flow); b.graphTab = false;
    return { title };
  }

  /* ================= classDiagram ================= */
  const CLASS_NAME = '(`[^`]+`|[\\w$\\u00C0-\\uFFFF]+(?:~[^~]+~)?)';
  const CLASS_REL = new RegExp(`^${CLASS_NAME}\\s*(?:"([^"]*)"\\s*)?(<\\||\\*|o|<|\\(\\))?(--|\\.\\.)(\\|>|\\*|o|>|\\(\\))?\\s*(?:"([^"]*)"\\s*)?${CLASS_NAME}\\s*(?::\\s*(.*))?$`);
  function parseClass(P, b) {
    const T = b.T;
    b.direction = 'down';
    const members = new Map(), annos = new Map(), classes = new Map(), nodeClass = new Map(), nodeStyle = new Map();
    const stack = []; let body = null;
    const cname = s => { s = s.replace(/^`|`$/g, ''); return { raw: s.replace(/~.*$/, ''), label: s.replace(/~([^~]+)~/g, '<$1>') }; };
    const cls = (s, props) => {
      const c = cname(s);
      const n = b.node(c.raw, Object.assign({ kind: 'class' }, props || {}));
      if (!b.nodes.get(n.id)._labelled && c.label !== c.raw) n.label = c.label;
      if (stack.length) b.setParent(n.id, stack[stack.length - 1]);
      if (!members.has(n.id)) members.set(n.id, []);
      return n;
    };
    const addMember = (n, txt) => {
      txt = txt.trim(); if (!txt) return;
      const am = /^<<(.+)>>$/.exec(txt); if (am) { annos.set(n.id, am[1].trim()); return; }
      members.get(n.id).push(txt.replace(/~([^~]+)~/g, '<$1>'));
    };
    for (const { t, n } of statements(P.lines.slice(1), false)) {
      let m;
      if (body) { if (t === '}') { body = null; continue; } addMember(body, t); continue; }
      if ((m = /^direction\s+(\w+)$/.exec(t))) { b.direction = /^(LR|RL)$/i.test(m[1]) ? 'right' : 'down'; continue; }
      if ((m = /^namespace\s+([\w.$-]+)\s*\{?$/.exec(t))) { const g = b.node(m[1], { kind: 'group' }); if (stack.length) b.setParent(g.id, stack[stack.length - 1]); stack.push(g.id); continue; }
      if (t === '}' && stack.length) { stack.pop(); continue; }
      if ((m = new RegExp(`^class\\s+${CLASS_NAME}\\s*(?:\\["([^"]*)"\\])?\\s*(?::::([\\w-]+))?\\s*(\\{)?\\s*(.*?)\\s*(\\})?$`).exec(t))) {
        const nd = cls(m[1], m[2] ? { label: clean(m[2]) } : null);
        if (m[2]) nd._labelled = true;
        if (m[3]) nodeClass.set(nd.id, [m[3]]);
        if (m[4]) { if (m[5]) m[5].split(/;|\n/).forEach(x => addMember(nd, x)); if (!m[6]) body = nd; }
        continue;
      }
      if ((m = /^<<(.+)>>\s*(\S+)$/.exec(t))) { annos.set(cls(m[2]).id, m[1].trim()); continue; }
      if ((m = CLASS_REL.exec(t))) {
        const A = cls(m[1]), B = cls(m[7]);
        const lm = m[3] || '', rm = m[5] || '', dotted = m[4] === '..';
        const mark = lm || rm;
        const kindOf = mk => mk === '<|' || mk === '|>' ? (dotted ? 'realize' : 'inherit') : mk === '*' ? 'compose' : mk === 'o' ? 'aggregate' : mk === '()' ? 'lollipop' : mk ? (dotted ? 'depend' : 'assoc') : 'link';
        const rk = kindOf(mark);
        const MK = x => x === '<|' || x === '|>' ? 'triangle' : x === '*' ? 'diamond' : x === 'o' ? 'odiamond' : x === '()' ? 'lollipop' : x ? 'arrow' : null;
        const aEnd = MK(lm), bEnd = MK(rm), STRUCT = { triangle: 1, diamond: 1, odiamond: 1 };
        /* La estructura se lee de arriba abajo, como en Mermaid: el padre de una herencia y el todo de
           una composición o agregación van primero, con su marca en el origen de la arista. Una
           asociación o dependencia va del extremo sin marca al que la tiene. */
        let from, to;
        if (STRUCT[aEnd]) [from, to] = [A, B];
        else if (STRUCT[bEnd]) [from, to] = [B, A];
        else [from, to] = !lm && rm ? [A, B] : lm && !rm ? [B, A] : [A, B];
        const endOf = X => (X === A ? aEnd : bEnd), cardOf = X => (X === A ? m[2] : m[6]) || null;
        const head = endOf(to) || 'none', tail = endOf(from) || null, headLabel = cardOf(to), tailLabel = cardOf(from);
        const marked = aEnd ? A : B, other = marked === A ? B : A;
        const card = [m[2], m[6]].some(Boolean) ? `${A.label} ${m[2] || '·'} — ${m[6] || '·'} ${B.label}` : null;
        /* sin texto en Mermaid, sin etiqueta en el dibujo: el tipo de relación va en el tooltip */
        const label = clean(m[8] || '') || null;
        const sentence = rk === 'link' ? T.linked(A.label, B.label) : rk === 'compose' || rk === 'aggregate' ? `${marked.label} ${T.rel[rk]} ${other.label}.` : `${other.label} ${T.rel[rk]} ${marked.label}.`;
        const sum = [sentence, card ? card + '.' : ''].filter(Boolean).join(' ');
        b.edge(from.id, to.id, { kind: dotted ? 'async' : (rk === 'inherit' || rk === 'realize' ? 'dependency' : 'call'), label, summary: sum, _rk: rk, head, tail, headLabel, tailLabel });
        continue;
      }
      if ((m = new RegExp(`^${CLASS_NAME}\\s*:\\s*(.+)$`).exec(t))) { addMember(cls(m[1]), m[2]); continue; }
      if ((m = /^note\s+for\s+(\S+)\s+"(.*)"$/.exec(t))) { b.note(m[2], cls(m[1]).id); continue; }
      if ((m = /^note\s+"(.*)"$/.exec(t))) { b.note(m[1]); continue; }
      if ((m = /^classDef\s+([\w,-]+)\s+(.+)$/.exec(t))) { m[1].split(',').forEach(c => classes.set(c.trim(), parseStyle(m[2]))); continue; }
      if ((m = /^cssClass\s+"([^"]+)"\s+([\w-]+)$/.exec(t))) { m[1].split(',').forEach(r => nodeClass.set(b.id(r.trim()), [m[2]])); continue; }
      if ((m = /^style\s+(\S+)\s+(.+)$/.exec(t))) { nodeStyle.set(b.id(m[1]), parseStyle(m[2])); continue; }
      if ((m = /^(?:click\s+(\S+)\s+href|link\s+(\S+))\s+"([^"]+)"(?:\s+"([^"]*)")?/.exec(t))) {
        const nd = cls(m[1] || m[2]); const url = httpURL(m[3]);
        if (url) (nd.links = nd.links || []).push({ kind: 'url', url, label: clean(m[4] || '') || undefined });
        continue;
      }
      if (/^(callback|click)\b/.test(t)) continue;
      if ((m = new RegExp(`^${CLASS_NAME}$`).exec(t))) { cls(m[1]); continue; }
      b.warn(T.ignored(t), n);
    }
    for (const nd of b.nodes.values()) {
      delete nd._labelled;
      if (nd.kind !== 'class') continue;
      const mem = members.get(nd.id) || [];
      if (!mem.length && !annos.get(nd.id)) { nd.shape = 'class'; nd.rows = []; }
      const meth = mem.filter(x => /\(/.test(x)), attrs = mem.filter(x => !/\(/.test(x));
      const anno = annos.get(nd.id);
      if (anno) { nd.subtitle = `«${anno}»`; nd.tags = [anno]; }
      nd._desc = [anno ? `«${anno}»` : '', attrs.length ? T.nAttrs(attrs.length) : '', meth.length ? T.nMethods(meth.length) : ''].filter(Boolean).join(' · ') || null;
      const ul = (h, arr) => arr.length ? `<h4>${esc(h)}</h4><ul class="gx-mmd-members">${arr.map(x => `<li><code>${esc(x)}</code></li>`).join('')}</ul>` : '';
      if (mem.length) nd.details_html = ul(T.attrs, attrs) + ul(T.methods, meth);
      /* la caja UML: un compartimento de atributos y otro de métodos, con su visibilidad */
      const row = (x, section) => {
        let txt = x.trim(), vis = null, st = false, ab = false;
        if (/^[+\-#~]/.test(txt)) { vis = txt[0]; txt = txt.slice(1).trim(); }
        if (/\$\s*$/.test(txt) || /\)\$/.test(txt)) { st = true; txt = txt.replace(/\$(?=\s|$)/, '').trim(); }
        if (/\*\s*$/.test(txt) || /\)\*/.test(txt)) { ab = true; txt = txt.replace(/\*(?=\s|$)/, '').trim(); }
        const mm = section === 'method' ? /^(.*\))\s*(.*)$/.exec(txt) : null;
        const r = { name: mm ? mm[1] : txt, section };
        if (mm && mm[2]) r.type = mm[2];
        if (vis) r.vis = vis; if (st) r.static = true; if (ab) r.abstract = true;
        return r;
      };
      nd.shape = 'class';
      nd.rows = attrs.map(x => row(x, 'attr')).concat(meth.map(x => row(x, 'method')));
      if (anno && /abstract/i.test(anno)) nd.abstract = true;
      let st = null; (nodeClass.get(nd.id) || []).forEach(c => { if (classes.has(c)) st = Object.assign(st || {}, classes.get(c)); });
      if (nodeStyle.has(nd.id)) st = Object.assign(st || {}, nodeStyle.get(nd.id));
      applyStyle(nd, st);
    }
    const rks = new Set(b.edges.map(e => e._rk).filter(Boolean)); b.edges.forEach(e => delete e._rk);
    const LE = { inherit: 'solid', realize: 'dashed', compose: 'solid', aggregate: 'solid', assoc: 'solid', depend: 'dashed', link: 'solid', lollipop: 'solid' };
    b.legendEdges = [...rks].map(k => ({ label: T.rel[k], style: LE[k] }));
    if (b.edges.some(e => e.kind === 'async') && !b.legendEdges.some(x => x.style === 'dashed')) b.legendEdges.push({ label: T.dotted.replace(/\.$/, ''), style: 'dashed' });
  }

  /* ================= stateDiagram ================= */
  function parseState(P, b) {
    b.layout = { cycles: 'order' };
    const T = b.T;
    b.direction = 'down';
    const stack = [], classes = new Map(), nodeClass = new Map(), nodeStyle = new Map();
    let note = null;
    const scope = () => stack[stack.length - 1] || '';
    const state = (raw, props) => {
      raw = raw.trim();
      let cl = null; const cm = /^(.*?):::([\w-]+)$/.exec(raw); if (cm) { raw = cm[1]; cl = cm[2]; }
      let n;
      if (raw === '[*]') return null;
      n = b.node(raw, props || {});
      if (!n.kind) { n.kind = 'state'; b.kinds.add('state'); }
      if (n.kind === 'state') n.shape = 'rounded';
      if (cl) nodeClass.set(n.id, [cl]);
      if (scope()) b.setParent(n.id, scope());
      return n;
    };
    const pseudo = (which) => {
      const sc = scope();
      const n = b.node(`\u0000${which}@${sc}`, { label: which === 'start' ? T.start : T.end, kind: which, shape: which });
      b.kinds.add(which);
      if (sc) b.setParent(n.id, sc);
      return n;
    };
    for (const { t, n } of statements(P.lines.slice(1), false)) {
      let m;
      if (note) { if (/^end note$/i.test(t)) { b.note(note._txt.join(' '), note.id); delete note._txt; note = null; } else note._txt.push(t); continue; }
      if ((m = /^direction\s+(\w+)$/.exec(t))) { if (!stack.length) b.direction = /^(LR|RL)$/i.test(m[1]) ? 'right' : 'down'; continue; }
      if (/^(hide empty description|scale\s)/.test(t) || t === '--') continue;
      if (t === '}') { stack.pop(); continue; }
      if ((m = /^state\s+"([^"]*)"\s+as\s+([\w.-]+)\s*(\{)?$/.exec(t)) || (m = /^state\s+([\w.-]+)\s+as\s+"([^"]*)"\s*(\{)?$/.exec(t))) {
        const [label, raw] = /^state\s+"/.test(t) ? [m[1], m[2]] : [m[2], m[1]];
        const nd = state(raw, { label: clean(label) });
        if (m[3]) { nd.kind = 'group'; delete nd.shape; b.kinds.add('group'); stack.push(nd.id); }
        continue;
      }
      if ((m = /^state\s+([\w.-]+)\s*<<(choice|fork|join)>>$/.exec(t))) { const k = m[2] === 'choice' ? 'choice' : 'fork'; const nd = state(m[1], { kind: k }); nd.kind = k; nd.shape = k; b.kinds.add(k); if (m[2] !== 'choice') nd.label = m[1]; continue; }
      if ((m = /^state\s+([\w.-]+)\s*\{$/.exec(t))) { const nd = state(m[1], { kind: 'group' }); nd.kind = 'group'; delete nd.shape; b.kinds.add('group'); stack.push(nd.id); continue; }
      if ((m = /^state\s+([\w.-]+)$/.exec(t))) { state(m[1]); continue; }
      if ((m = /^note\s+(left|right)\s+of\s+([\w.-]+)\s*:\s*(.*)$/i.exec(t))) { b.note(m[3], state(m[2]).id); continue; }
      if ((m = /^note\s+(left|right)\s+of\s+([\w.-]+)$/i.exec(t))) { note = state(m[2]); note._txt = []; continue; }
      if ((m = /^classDef\s+([\w,-]+)\s+(.+)$/.exec(t))) { m[1].split(',').forEach(c => classes.set(c.trim(), parseStyle(m[2]))); continue; }
      if ((m = /^class\s+(.+?)\s+([\w-]+)$/.exec(t))) { m[1].split(',').forEach(r => nodeClass.set(b.id(r.trim()), [m[2]])); continue; }
      if ((m = /^style\s+(\S+)\s+(.+)$/.exec(t))) { nodeStyle.set(b.id(m[1]), parseStyle(m[2])); continue; }
      if ((m = /^(\[\*\]|[\w.:-]+)\s*-->\s*(\[\*\]|[\w.:-]+)\s*(?::\s*(.*))?$/.exec(t))) {
        const a = m[1] === '[*]' ? pseudo('start') : state(m[1]);
        const c = m[2] === '[*]' ? pseudo('end') : state(m[2]);
        b.edge(a.id, c.id, { kind: 'call', label: clean(m[3] || '') || null });
        continue;
      }
      if ((m = /^([\w.-]+)\s*:\s*(.+)$/.exec(t))) { const nd = state(m[1]); nd._desc = nd._desc ? nd._desc + ' · ' + clean(m[2]) : clean(m[2]); if (!nd.subtitle) nd.subtitle = clean(m[2]); continue; }
      if ((m = /^([\w.-]+)(:::[\w-]+)?$/.exec(t))) { state(t); continue; }
      b.warn(T.ignored(t), n);
    }
    for (const nd of b.nodes.values()) {
      let st = null; (nodeClass.get(nd.id) || []).forEach(c => { if (classes.has(c)) st = Object.assign(st || {}, classes.get(c)); });
      if (nodeStyle.has(nd.id)) st = Object.assign(st || {}, nodeStyle.get(nd.id));
      applyStyle(nd, st);
    }
  }

  /* ================= erDiagram ================= */
  const ER_L = { '|o': 'zo', '||': 'one', '}o': 'zm', '}|': 'om' }, ER_R = { 'o|': 'zo', '||': 'one', 'o{': 'zm', '|{': 'om' };
  const ER_WORDS = { 'zero or one': 'zo', 'one or zero': 'zo', 'exactly one': 'one', 'only one': 'one', '1': 'one', 'zero or more': 'zm', 'zero or many': 'zm', 'many(0)': 'zm', '0+': 'zm', 'one or more': 'om', 'one or many': 'om', 'many(1)': 'om', '1+': 'om' };
  function parseER(P, b) {
    const T = b.T;
    b.direction = 'right';
    const attrs = new Map(); let body = null;
    const ENT = '("[^"]+"|[\\w$\\u00C0-\\uFFFF-]+)(?:\\[("?)([^\\]"]*)\\2\\])?';
    const ent = (raw, alias) => { const n = b.node(unq(raw), { kind: 'table', shape: 'table', label: alias ? clean(alias) : null }); if (!attrs.has(n.id)) attrs.set(n.id, []); return n; };
    const REL = new RegExp(`^${ENT}\\s*(\\|o|\\|\\||\\}o|\\}\\|)(--|\\.\\.)(o\\||\\|\\||o\\{|\\|\\{)\\s*${ENT}\\s*:\\s*(.+)$`);
    const REL_W = new RegExp(`^${ENT}\\s+(.+?)\\s+(to|optionally to)\\s+(.+?)\\s+${ENT}\\s*:\\s*(.+)$`);
    for (const { t, n } of statements(P.lines.slice(1), false)) {
      let m;
      if (body) {
        if (t === '}') { body = null; continue; }
        m = /^(\S+)\s+(\S+)((?:\s+(?:PK|FK|UK)\s*,?)*)\s*(?:"([^"]*)")?$/.exec(t);
        if (m) attrs.get(body.id).push({ type: m[1], name: m[2], keys: m[3].replace(/[\s,]+/g, ' ').trim(), comment: m[4] || '' });
        else b.warn(T.ignored(t), n);
        continue;
      }
      if ((m = /^direction\s+(\w+)$/.exec(t))) { b.direction = /^(TB|TD|BT)$/i.test(m[1]) ? 'down' : 'right'; continue; }
      if ((m = new RegExp(`^${ENT}\\s*\\{\\s*(\\})?$`).exec(t))) { const nd = ent(m[1], m[3]); if (!m[4]) body = nd; continue; }
      let a, c, ca, cb, dotted, label;
      if ((m = REL.exec(t))) { a = ent(m[1], m[3]); c = ent(m[7], m[9]); ca = ER_L[m[4]]; cb = ER_R[m[6]]; dotted = m[5] === '..'; label = m[10]; }
      else if ((m = REL_W.exec(t)) && ER_WORDS[m[4].toLowerCase()] && ER_WORDS[m[6].toLowerCase()]) { a = ent(m[1], m[3]); c = ent(m[7], m[9]); ca = ER_WORDS[m[4].toLowerCase()]; cb = ER_WORDS[m[6].toLowerCase()]; dotted = m[5] !== 'to'; label = m[10]; }
      if (a) {
        const CF = { zo: 'zero-one', one: 'one', zm: 'zero-many', om: 'one-many' };
        b.edge(a.id, c.id, { kind: dotted ? 'async' : 'data', label: clean(label), summary: `${T.erSentence(a.label, T.card[ca], c.label, T.card[cb])} ${dotted ? T.nonIdentifying : T.identifying}`, tail: CF[ca], head: CF[cb] });
        continue;
      }
      if ((m = new RegExp(`^${ENT}$`).exec(t))) { ent(m[1], m[3]); continue; }
      if (/^(classDef|class|style)\s/.test(t)) continue;
      b.warn(T.ignored(t), n);
    }
    for (const nd of b.nodes.values()) {
      const at = attrs.get(nd.id) || [];
      if (!at.length) continue;
      nd._desc = T.nAttrs(at.length) + (at.some(x => /PK/.test(x.keys)) ? ' · PK: ' + at.filter(x => /PK/.test(x.keys)).map(x => x.name).join(', ') : '');
      nd.details_html = `<h4>${esc(T.attrs)}</h4><ul class="gx-mmd-members">${at.map(x => `<li><code>${esc(x.name)}</code> <i>${esc(x.type)}</i>${x.keys ? ` <b>${esc(x.keys)}</b>` : ''}${x.comment ? ` — ${esc(x.comment)}` : ''}</li>`).join('')}</ul>`;
      nd.tags = at.map(x => x.name);
      nd.rows = at.map(x => Object.assign({ name: x.name, type: x.type }, x.keys ? { keys: x.keys.replace(/\s+/g, ',') } : {}, x.comment ? { comment: x.comment } : {}));
    }
    if (b.edges.some(e => e.kind === 'async')) b.legendEdges = [{ label: T.identifying.replace(/\.$/, ''), style: 'solid' }, { label: T.nonIdentifying.replace(/ \(.*$/, '').replace(/\.$/, ''), style: 'dashed' }];
  }

  /* ================= mindmap ================= */
  function mmText(t) {
    t = t.replace(/\s*:::[\w\s-]+$/, '');
    const m = /^([^\s(\[{)]*?)\s*(\(\(|\)\)|\{\{|\(|\[|\))(.*)$/.exec(t);
    const pairs = { '((': ['))', 'circle'], '))': ['((', 'bang'], '{{': ['}}', 'hexagon'], '(': [')', 'rounded'], '[': [']', 'step'], ')': ['(', 'cloud'] };
    if (m && pairs[m[2]] && m[3].endsWith(pairs[m[2]][0])) return { raw: m[1] || null, label: m[3].slice(0, -pairs[m[2]][0].length), kind: pairs[m[2]][1] };
    return { raw: null, label: t, kind: 'idea' };
  }
  /* Por defecto, un árbol con conexiones (el aspecto de un mapa mental); con `nest`, cada rama
     es un contenedor plegable. */
  function parseMindmap(P, b, opts) {
    b.direction = 'right';
    const nest = !!(opts && opts.nest);
    let branchN = 0;
    const idea = b.T.kinds.idea;
    b.kindNames = { circle: idea, rounded: idea, step: idea, cloud: idea, bang: idea, hexagon: idea, idea };
    const stack = [];
    for (const L of P.lines.slice(1)) {
      if (/^::icon\(/.test(L.t) || /^:::/.test(L.t)) continue;
      const x = mmText(L.t);
      while (stack.length && stack[stack.length - 1].indent >= L.indent) stack.pop();
      const nd = b.node(x.raw && !b.has(x.raw) ? x.raw : '\u0000mm' + L.n, { label: clean(x.label) || ' ', kind: x.kind, shape: { idea: 'rounded', step: 'rect' }[x.kind] || x.kind });
      if (stack.length) {
        const up = stack[stack.length - 1];
        /* cada rama que sale de la raíz tiene su color, y lo heredan sus hojas */
        const branch = stack.length === 1 ? PALETTE[(branchN++) % PALETTE.length] : up.color;
        nd.color = branch;
        if (nest) b.setParent(nd.id, up.id); else b.edge(up.id, nd.id, { kind: 'call', head: 'none', curve: true, color: branch });
        stack.push({ indent: L.indent, id: nd.id, color: branch }); continue;
      }
      else if (b.nodes.size > 1) b.warn('mindmap con más de una raíz', L.n);
      
      stack.push({ indent: L.indent, id: nd.id });
    }
    if (!b.nodes.size) throw new MermaidError('mindmap vacío');
    if (!nest) b.layout = { lanes: 'flow' };
  }

  /* ================= gantt ================= */
  const DUR_MS = { ms: 1, s: 1e3, m: 6e4, h: 36e5, d: 864e5, w: 6048e5, M: 2592e6, y: 31536e6 };
  function parseDate(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(String(s).trim());
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)) : null;
  }
  const fmtDate = ms => { const d = new Date(ms).toISOString(); return /T00:00:00/.test(d) ? d.slice(0, 10) : d.slice(0, 16).replace('T', ' '); };
  function parseGantt(P, b) {
    const T = b.T;
    b.direction = 'right';
    b.levelNames = [b.lang === 'en' ? 'Section' : 'Sección', T.kinds.job];
    let section = null, title = null, prev = null;
    const tasks = [], byId = new Map(), links = [], excl = [];
    for (const { t, n } of statements(P.lines.slice(1), false)) {
      let m;
      if ((m = /^title\s+(.+)$/.exec(t))) { title = clean(m[1]); continue; }
      /* `excludes weekends`, días de la semana o fechas: no cuentan en las duraciones en días */
      if ((m = /^excludes\s+(.+)$/.exec(t))) { m[1].toLowerCase().split(/[\s,]+/).filter(Boolean).forEach(x => excl.push(x)); continue; }
      if (/^(dateFormat|axisFormat|tickInterval|includes|todayMarker|weekday|weekend|displayMode|inclusiveEndDates|topAxis)\b/.test(t)) continue;
      if ((m = /^section\s+(.+)$/.exec(t))) { section = b.node('\u0000sec' + n, { label: clean(m[1]), kind: 'group' }); continue; }
      if ((m = /^click\s+(\S+)\s+href\s+"([^"]+)"/.exec(t))) { links.push([m[1], m[2]]); continue; }
      if (/^click\s/.test(t)) continue;
      if ((m = /^(.+?)\s*:\s*(.*)$/.exec(t))) {
        const parts = m[2].split(',').map(x => x.trim()).filter(Boolean);
        const tags = []; while (parts.length && /^(done|active|crit|milestone)$/.test(parts[0])) tags.push(parts.shift());
        let id = null, start = null, end = null;
        if (parts.length >= 3) [id, start, end] = parts; else if (parts.length === 2) { if (/^(after\s|\d{4}-)/.test(parts[0])) [start, end] = parts; else [id, end] = parts; } else [end] = parts;
        const task = { label: clean(m[1]), tags, id, start, end, n, section };
        tasks.push(task); if (id) byId.set(id, task);
        continue;
      }
      b.warn(T.ignored(t), n);
    }
    const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const off = t => { const d = new Date(t), dow = d.getUTCDay(), iso = d.toISOString().slice(0, 10); return excl.includes(iso) || excl.includes(DAYS[dow]) || (excl.includes('weekends') && (dow === 0 || dow === 6)); };
    /* fechas: se calculan si vienen como AAAA-MM-DD; si no, se muestra lo que dice el texto */
    const endOf = task => task._end;
    for (const task of tasks) {
      const deps = task.start && /^after\s/.test(task.start) ? task.start.replace(/^after\s+/, '').split(/\s+/).filter(Boolean) : null;
      let s = null;
      if (deps) { const ends = deps.map(d => byId.get(d)).filter(Boolean).map(endOf).filter(x => x != null); s = ends.length ? Math.max(...ends) : null; }
      else if (task.start) s = parseDate(task.start);
      else if (prev) s = prev._end;
      /* lo que empieza detrás de otra tarea no empieza en un día excluido: pasa al siguiente hábil */
      if (s != null && excl.length && !task.start) { let g = 0; while (off(s) && g++ < 366) s = Date.UTC(new Date(s).getUTCFullYear(), new Date(s).getUTCMonth(), new Date(s).getUTCDate() + 1); }
      else if (s != null && excl.length && deps) { let g = 0; while (off(s) && g++ < 366) s = Date.UTC(new Date(s).getUTCFullYear(), new Date(s).getUTCMonth(), new Date(s).getUTCDate() + 1); }
      let e = null;
      const dm = task.end && /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w|M|y)$/.exec(task.end);
      if (dm && s != null && (dm[2] === 'd' || dm[2] === 'w') && excl.length) {
        /* se avanza día a día y solo cuentan los que no están excluidos (una semana, siete días) */
        let left = parseFloat(dm[1]) * (dm[2] === 'w' ? 7 : 1), t = s, guard = 0;
        while (left > 0 && guard++ < 3660) { if (off(t)) { t += DUR_MS.d; continue; } const step = Math.min(1, left); t += step * DUR_MS.d; left -= step; }
        e = t;
      } else if (dm && s != null) e = s + parseFloat(dm[1]) * DUR_MS[dm[2]];
      else if (task.end && parseDate(task.end) != null) e = parseDate(task.end);
      else if (task.end && /^until\s/.test(task.end)) { const u = byId.get(task.end.replace(/^until\s+/, '').trim()); e = u && u._start != null ? u._start : null; }
      if (task.tags.includes('milestone') && s != null && e == null) e = s;
      task._start = s; task._end = e; task.deps = deps; task.prev = !task.start && prev ? prev : null;
      prev = task;
    }
    const st = task => {
      const d = task.tags.includes('done'), a = task.tags.includes('active'), c = task.tags.includes('crit');
      if (c) return d ? b.status('critDone', T.gstat.critDone, C.warn) : a ? b.status('critActive', T.gstat.critActive, C.bad) : b.status('crit', T.gstat.crit, C.bad);
      if (d) return b.status('done', T.gstat.done, C.good);
      if (a) return b.status('active', T.gstat.active, C.info);
      return null;
    };
    for (const task of tasks) {
      const ms = task.tags.includes('milestone');
      const nd = b.node(task.id || '\u0000task' + task.n, { label: task.label, kind: ms ? 'milestone' : 'job', status: st(task), shape: 'gbar' });
      if (task._start != null) nd.span = Object.assign({ start: fmtDate(task._start), end: fmtDate(task._end != null ? task._end : task._start) }, ms ? { milestone: true } : {}, task.tags.includes('active') ? { live: true } : {});
      task.node = nd;
      if (task.section) b.setParent(nd.id, task.section.id);
      const metrics = [];
      if (task._start != null) metrics.push({ label: T.startDate, value: fmtDate(task._start) });
      else if (task.start) metrics.push({ label: T.startDate, value: task.start });
      if (task._end != null && !ms) metrics.push({ label: T.endDate, value: fmtDate(task._end) });
      if (task.end && !parseDate(task.end) && !ms) metrics.push({ label: T.duration, value: task.end });
      if (task.id) metrics.push({ label: T.id, value: task.id });
      if (metrics.length) nd.metrics = metrics;
      if (task._start != null) nd.subtitle = fmtDate(task._start) + (task._end != null && !ms && task._end !== task._start ? ' → ' + fmtDate(task._end) : '');
    }
    for (const task of tasks) {
      if (task.deps) task.deps.forEach(d => { const src = byId.get(d); if (src) b.edge(src.node.id, task.node.id, { kind: 'dependency', label: null, summary: `${T.after} ${src.label}.` }); else b.warn(`after ${d}: tarea desconocida`, task.n); });
      else if (task.prev) b.edge(task.prev.node.id, task.node.id, { kind: 'dependency', emphasis: 'muted' });
    }
    for (const [id, url] of links) { const tk = byId.get(id); if (tk && httpURL(url)) (tk.node.links = tk.node.links || []).push({ kind: 'url', url }); }
    /* una fila por tarea sobre un eje de fechas común; plegada, la sección es una barra de su principio a su final */
    b.layout = Object.assign({ mode: 'gantt' }, excl.includes('weekends') ? { weekends: true } : {});
    for (const sec of new Set(tasks.map(t => t.section).filter(Boolean))) {
      const own = tasks.filter(t => t.section === sec && t._start != null);
      if (!own.length) continue;
      sec.shape = 'gbar';
      sec.span = { start: fmtDate(Math.min(...own.map(t => t._start))), end: fmtDate(Math.max(...own.map(t => t._end != null ? t._end : t._start))) };
    }
    return { title };
  }

  /* ================= journey ================= */
  function parseJourney(P, b) {
    const T = b.T;
    b.direction = 'right';
    let section = null, title = null, prev = null;
    const SC = { 1: C.bad, 2: C.warn, 3: C.gray, 4: C.info, 5: C.good };
    for (const { t, n } of statements(P.lines.slice(1), false)) {
      let m;
      if ((m = /^title\s+(.+)$/.exec(t))) { title = clean(m[1]); continue; }
      if ((m = /^section\s+(.+)$/.exec(t))) { section = b.node('\u0000sec' + n, { label: clean(m[1]), kind: 'group' }); continue; }
      if ((m = /^(.+?)\s*:\s*(\d+)\s*(?::\s*(.*))?$/.exec(t))) {
        const score = Math.max(1, Math.min(5, +m[2]));
        const actors = (m[3] || '').split(',').map(x => clean(x)).filter(Boolean);
        const nd = b.node('\u0000task' + n, { label: clean(m[1]), kind: 'job', status: b.status('s' + score, T.scoreText(score), SC[score]), shape: 'score', score });
        b.layout = { mode: 'journey' };
        nd.metrics = [{ label: T.score, value: score + '/5' }].concat(actors.length ? [{ label: T.actors, value: actors.join(', ') }] : []);
        if (actors.length) { nd.tags = actors; nd.subtitle = actors.join(', '); }
        if (section) b.setParent(nd.id, section.id);
        if (prev) b.edge(prev.id, nd.id, { kind: 'call' });
        prev = nd; continue;
      }
      b.warn(T.ignored(t), n);
    }
    /* los estados, en orden de puntuación */
    const st = {}; Object.keys(b.statuses).sort().forEach(k => st[k] = b.statuses[k]); b.statuses = st;
    return { title };
  }

  /* ================= timeline ================= */
  function parseTimeline(P, b) {
    const T = b.T;
    b.direction = 'right';
    let section = null, title = null, period = null, prevPeriod = null, events = 0, secN = 0;
    const periods = [];
    const addEvent = (txt, n) => { events++; const ev = b.node('\u0000ev' + events, { label: clean(txt), kind: 'event', shape: 'rounded', color: section ? section.color : null }); b.setParent(ev.id, period.id); };
    for (const { t, n } of statements(P.lines.slice(1), false)) {
      let m;
      if ((m = /^title\s+(.+)$/.exec(t))) { title = clean(m[1]); continue; }
      if ((m = /^section\s+(.+)$/.exec(t))) { section = b.node('\u0000sec' + n, { label: clean(m[1]), kind: 'group', section: true, color: PALETTE[secN++ % PALETTE.length] }); continue; }
      if (/^:/.test(t)) { if (!period) { b.warn(T.ignored(t), n); continue; } t.split(':').map(x => x.trim()).filter(Boolean).forEach(x => addEvent(x, n)); continue; }
      const parts = t.split(/\s:\s|\s:$|^:\s/).map(x => x.trim());
      const segs = t.split(':').map(x => x.trim());
      const pl = segs.length > 1 ? segs : parts;
      period = b.node('\u0000p' + n, { label: clean(pl[0]), kind: 'event', color: section ? section.color : null });
      periods.push(period);
      if (section) b.setParent(period.id, section.id);
      if (prevPeriod) b.edge(prevPeriod.id, period.id, { kind: 'call' });
      prevPeriod = period;
      pl.slice(1).filter(Boolean).forEach(x => addEvent(x, n));
    }
    /* un periodo con eventos es un grupo; sin eventos, una tarjeta */
    const kids = new Map(); for (const nd of b.nodes.values()) if (nd.parent) kids.set(nd.parent, (kids.get(nd.parent) || 0) + 1);
    periods.forEach(p => { if (kids.get(p.id)) { p.kind = 'group'; p._desc = T.events(kids.get(p.id)); } else p.shape = 'rounded'; });
    b.layout = { mode: 'timeline' };
    b.kinds.add('group');
    b.levelNames = b.nodes.size && [...b.nodes.values()].some(x => x.kind === 'group' && !periods.includes(x))
      ? [b.lang === 'en' ? 'Section' : 'Sección', b.lang === 'en' ? 'Period' : 'Periodo', T.kinds.event]
      : [b.lang === 'en' ? 'Period' : 'Periodo', T.kinds.event];
    return { title };
  }

  /* ================= gitGraph ================= */
  function parseGit(P, b) {
    const T = b.T;
    const head = P.lines[0].t;
    b.direction = /\bTB\b|\bBT\b/.test(head) ? 'down' : 'right';
    /* las ramas avanzan en paralelo: sin partición de ELK, que las pondría una detrás de otra */
    b.layout = { lanes: 'flow', inheritLaneColor: true, mode: 'git' };
    const main = (/mainBranchName:\s*['"]?([\w/.-]+)/.exec(P.meta.config) || [])[1] || 'main';
    const branches = new Map(); let cur = main, seq = 0;
    const order = [];
    const branch = (name, from, ord) => {
      const l = b.lane('\u0000branch:' + name, { label: name, color: PALETTE[branches.size % PALETTE.length] });
      branches.set(name, { lane: l, head: from, order: ord != null ? ord : branches.size });
      order.push(name); return branches.get(name);
    };
    branch(main, null, 0);
    const opts = s => { const o = {}; const re = /(\w+)\s*:\s*("([^"]*)"|(\S+))/g; let m; while ((m = re.exec(s))) o[m[1]] = m[3] != null ? m[3] : m[4]; return o; };
    const commit = (o, extraParents, label) => {
      const br = branches.get(cur);
      const id = o.id || `c${++seq}`;
      const merge = (extraParents || []).some(p => p.kind && p.kind.label === 'merge');
      const nd = b.node('\u0000' + id, { label: clean(o.msg || o.message || '') || label || id, kind: 'commit', lane: br.lane.id,
        shape: o.type === 'HIGHLIGHT' ? 'commit-highlight' : o.type === 'REVERSE' ? 'commit-reverse' : merge ? 'commit-merge' : 'commit' });
      if (o.tag) nd.badge = o.tag;
      if (o.id && (o.msg || label)) nd.subtitle = o.id;
      const notes = [];
      if (o.tag) { notes.push({ tone: 'info', text: `${T.tag}: ${o.tag}` }); nd.tags = [o.tag]; nd.subtitle = o.tag; }
      if (o.type === 'REVERSE') notes.push({ tone: 'warn', text: T.reverse });
      if (o.type === 'HIGHLIGHT') { notes.push({ tone: 'good', text: T.highlight }); nd.color = C.warn; }
      if (notes.length) nd.notes = notes;
      nd._desc = `${T.commit} · ${T.branch}: ${cur}`;
      if (br.head) b.edge(br.head, nd.id, { kind: 'call', head: 'none', color: br.lane.color });
      /* un merge o un cherry-pick va del color de la rama de la que viene */
      (extraParents || []).forEach(p => { const from = [...branches.values()].find(x => x.lane.id === (b.nodes.get(p.id) || {}).lane); b.edge(p.id, nd.id, Object.assign({ head: 'none', color: from ? from.lane.color : null }, p.kind)); });
      br.head = nd.id;
      return nd;
    };
    for (const { t, n } of statements(P.lines.slice(1), false)) {
      let m;
      if ((m = /^commit\b\s*(.*)$/.exec(t))) { commit(opts(m[1]), null, null); continue; }
      if ((m = /^branch\s+("?)([^"\s]+)\1\s*(.*)$/.exec(t))) { const o = opts(m[3]); branch(m[2], branches.get(cur).head, o.order != null ? +o.order : null); cur = m[2]; continue; }
      if ((m = /^(?:checkout|switch)\s+("?)([^"\s]+)\1$/.exec(t))) { if (!branches.has(m[2])) { b.warn(`rama desconocida: ${m[2]}`, n); branch(m[2], branches.get(cur).head); } cur = m[2]; continue; }
      if ((m = /^merge\s+("?)([^"\s]+)\1\s*(.*)$/.exec(t))) {
        const src = branches.get(m[2]); if (!src) { b.warn(`rama desconocida: ${m[2]}`, n); continue; }
        commit(opts(m[3]), src.head ? [{ id: src.head, kind: { kind: 'dependency', label: 'merge' } }] : [], T.merge(m[2]));
        continue;
      }
      if ((m = /^cherry-pick\s+(.*)$/.exec(t))) {
        const o = opts(m[1]); const srcId = b.map.get('\u0000' + o.id);
        commit({ tag: o.tag }, srcId ? [{ id: srcId, kind: { kind: 'async', label: 'cherry-pick' } }] : [], T.cherry(o.id || '?'));
        continue;
      }
      b.warn(T.ignored(t), n);
    }
    /* el último commit de cada rama es su HEAD: late */
    for (const br of branches.values()) if (br.head && b.nodes.get(br.head)) b.nodes.get(br.head).head = true;
    /* orden de carriles: `order:` y, si no, el de creación */
    const lanes = [...b.lanes.values()].sort((x, y) => {
      const bx = [...branches.values()].find(v => v.lane === x), by = [...branches.values()].find(v => v.lane === y);
      return bx.order - by.order;
    });
    b.lanes = new Map(lanes.map(l => [l.id, l]));
    b.legendEdges = [{ label: 'commit', style: 'solid' }, { label: 'merge', style: 'solid' }, ...(b.edges.some(e => e.kind === 'async') ? [{ label: 'cherry-pick', style: 'dashed' }] : [])];
  }

  /* ================= C4 ================= */
  function parseC4(P, b, type) {
    const T = b.T;
    b.direction = 'down';
    const stack = []; let title = null;
    const dyn = type === 'C4Dynamic' ? { id: 'dinamica', title: T.dynamic, participants: [], messages: [] } : null;
    const ELEM = /^(Person|System|SystemDb|SystemQueue|Container|ContainerDb|ContainerQueue|Component|ComponentDb|ComponentQueue)(_Ext)?$/;
    const BOUND = /^(Boundary|Enterprise_Boundary|System_Boundary|Container_Boundary|Deployment_Node|Node|Node_L|Node_R)$/;
    const named = args => { const o = {}; const pos = []; args.forEach(a => { const m = /^\$(\w+)\s*=\s*(.*)$/.exec(a); if (m) o[m[1]] = unq(m[2]); else pos.push(unq(a)); }); return { pos, o }; };
    const kindFor = (base, ext) => base === 'Person' ? 'actor' : /Db$/.test(base) ? 'datastore' : /Queue$/.test(base) ? 'queue' : ext ? 'external' : base.startsWith('System') ? 'service' : base.startsWith('Container') ? 'app' : 'module';
    const pending = [];
    for (const { t, n } of statements(P.lines.slice(1), false)) {
      let m;
      if ((m = /^title\s+(.+)$/.exec(t))) { title = clean(m[1]); continue; }
      if (t === '}') { stack.pop(); continue; }
      m = /^(\w+)\s*\((.*)\)\s*(\{)?\s*$/.exec(t);
      if (!m) { if (t !== '{') b.warn(T.ignored(t), n); continue; }
      const fn = m[1], { pos, o } = named(splitArgs(m[2]));
      let em;
      if ((em = ELEM.exec(fn))) {
        const [alias, label, a3, a4] = pos;
        const isC = !/^(Person|System)/.test(em[1]);
        const techn = isC ? a3 : null, descr = isC ? a4 : a3;
        const nd = b.node(alias, { label: clean(label || alias), kind: kindFor(em[1], em[2]), subtitle: techn ? `[${clean(techn)}]` : (em[2] ? T.kinds.external : null) });
        if (descr) nd.summary = clean(descr);
        if (techn) nd.metrics = [{ label: T.techn, value: clean(techn) }];
        if (o.tags) nd.tags = o.tags.split('+');
        if (httpURL(o.link)) nd.links = [{ kind: 'url', url: o.link }];
        /* colores de la notación C4: persona y sistema oscuros, contenedor y componente más claros, externo gris */
        const C4C = { Person: '#08427b', System: '#1168bd', Container: '#2f6fb3', Component: '#4f86c6' };
        const base = em[1].replace(/(Db|Queue)$/, '');
        nd.color = em[2] ? { light: '#737b86', dark: '#5f6772' } : { light: C4C[base] || C4C.System, dark: C4C[base] || C4C.System };
        nd.shape = em[1] === 'Person' ? 'person' : /Db$/.test(em[1]) ? 'c4-db' : /Queue$/.test(em[1]) ? 'c4-queue' : 'c4';
        const C4N = b.lang === 'en' ? { Person: 'Person', System: 'Software System', Container: 'Container', Component: 'Component' } : { Person: 'Persona', System: 'Sistema', Container: 'Contenedor', Component: 'Componente' };
        const tname = C4N[em[1] === 'Person' ? 'Person' : base] || base;
        if (!techn) nd.subtitle = `[${tname}${em[2] ? (b.lang === 'en' ? ', external' : ', externo') : ''}]`;
        else nd.subtitle = `[${tname}: ${clean(techn)}]`;
        if (stack.length) b.setParent(nd.id, stack[stack.length - 1]);
        if (m[3]) stack.push(nd.id);
        continue;
      }
      if (BOUND.test(fn)) {
        const [alias, label, ty, descr] = pos;
        const BN = b.lang === 'en' ? { Enterprise: 'Enterprise', System: 'System', Container: 'Container' } : { Enterprise: 'Empresa', System: 'Sistema', Container: 'Contenedor' };
        const bk = fn.replace(/_Boundary$/, '');
        const nd = b.node(alias, { label: clean(label || alias), kind: fn === 'Deployment_Node' || /^Node/.test(fn) ? 'package' : 'group', subtitle: ty ? `[${clean(ty)}]` : (BN[bk] ? `[${BN[bk]}]` : null) });
        nd.frame = /Boundary/.test(fn) ? 'dashed' : null;
        if (!nd.frame) delete nd.frame;
        if (descr) nd.summary = clean(descr);
        if (stack.length) b.setParent(nd.id, stack[stack.length - 1]);
        if (m[3]) stack.push(nd.id);
        continue;
      }
      if (/^(Bi)?Rel(_(U|Up|D|Down|L|Left|R|Right|Back|Neighbor))?$/.test(fn) || fn === 'RelIndex') {
        const p = fn === 'RelIndex' ? pos.slice(1) : pos;
        const [from, to, label, techn, descr] = p;
        const bi = /^BiRel/.test(fn), back = /_Back$/.test(fn);
        pending.push({ from: back ? to : from, to: back ? from : to, label: clean(label || ''), techn: techn ? clean(techn) : '', descr: descr ? clean(descr) : '', bi, n, idx: fn === 'RelIndex' ? pos[0] : null });
        continue;
      }
      if (/^Update(ElementStyle|RelStyle|LayoutConfig|BoundaryStyle)$|^Add(Element|Rel|Boundary)Tag$/.test(fn)) {
        if (fn === 'UpdateElementStyle' && pos[0]) { const nd = b.has(pos[0]) && b.get(pos[0]); const col = nd && styleColor({ stroke: o.borderColor, fill: o.bgColor }); if (col) nd.color = col; }
        continue;
      }
      b.warn(T.ignored(t), n);
    }
    for (const r of pending) {
      if (!b.has(r.from) || !b.has(r.to)) { b.warn(`Rel(${r.from}, ${r.to}): elemento desconocido`, r.n); continue; }
      const a = b.get(r.from), c = b.get(r.to);
      const label = (r.idx ? r.idx + '. ' : '') + r.label + (r.techn ? ` [${r.techn}]` : '');
      b.edge(a.id, c.id, { tail: r.bi ? 'arrow' : null, kind: /async|event|queue|kafka|amqp/i.test(r.techn) ? 'async' : /http|rest|json|api/i.test(r.techn) ? 'http' : 'call', label, data: r.techn || null, summary: [r.descr, r.bi ? T.bidir : ''].filter(Boolean).join(' ') || null });
      if (dyn) {
        [a.id, c.id].forEach(id => { if (!dyn.participants.includes(id)) dyn.participants.push(id); });
        dyn.messages.push({ id: 'm' + (dyn.messages.length + 1), from: a.id, to: c.id, label: r.label || '…', kind: a.id === c.id ? 'self' : 'sync', note: r.techn || undefined });
      }
    }
    if (dyn && dyn.messages.length) b.flows.push(dyn);
    b.levelNames = null;
    return { title };
  }

  /* ================= architecture-beta ================= */
  function parseArchitecture(P, b) {
    const T = b.T;
    b.direction = 'right';
    const ICON_KIND = { database: 'datastore', disk: 'disk', server: 'server', internet: 'internet', cloud: 'cloud' };
    const kindOf = icon => { if (!icon) return 'service'; const i = icon.toLowerCase(); if (ICON_KIND[i]) return ICON_KIND[i]; if (/db|sql|database|dynamo|rds|mongo|redis|s3|storage|bucket/.test(i)) return 'datastore'; if (/queue|sqs|kafka|sns|rabbit/.test(i)) return 'queue'; if (/lambda|function/.test(i)) return 'function'; return 'service'; };
    const pend = [], edges = [];
    for (const { t, n } of statements(P.lines.slice(1), false)) {
      let m;
      if ((m = /^(group|service)\s+([\w-]+)\s*(?:\(([^)]*)\))?\s*(?:\[([^\]]*)\])?\s*(?:in\s+([\w-]+))?$/.exec(t))) {
        const nd = b.node(m[2], { label: clean(m[4] || m[2]), kind: m[1] === 'group' ? 'group' : kindOf(m[3]) });
        if (m[1] === 'group') { nd.frame = 'dashed'; if (m[3]) { nd.kind = kindOf(m[3]); b.kinds.add(nd.kind); } } else nd.shape = 'tile';
        if (m[3] && m[1] === 'service') nd.subtitle = m[3];
        if (m[5]) pend.push([nd.id, m[5]]);
        continue;
      }
      if ((m = /^junction\s+([\w-]+)(?:\s+in\s+([\w-]+))?$/.exec(t))) { const nd = b.node(m[1], { label: m[1], kind: 'junction', shape: 'junction' }); if (m[2]) pend.push([nd.id, m[2]]); continue; }
      if ((m = /^([\w-]+)(\{group\})?\s*:\s*([LRTB])\s*(<)?-(?:\[([^\]]*)\])?-(>)?\s*([LRTB])\s*:\s*([\w-]+)(\{group\})?$/.exec(t))) {
        if (!b.has(m[1]) || !b.has(m[8])) { b.warn(T.ignored(t), n); continue; }
        edges.push({ m, n }); continue;
      }
      b.warn(T.ignored(t), n);
    }
    pend.forEach(([id, g]) => { if (b.has(g)) b.setParent(id, b.get(g).id); });
    /* `s1{group}` engancha la conexión al grupo que contiene a s1 */
    const end = (raw, grp) => { const nd = b.get(raw); return grp && nd.parent ? nd.parent : nd.id; };
    for (const { m } of edges) {
      const a = end(m[1], m[2]), c = end(m[8], m[9]);
      const bi = m[4] && m[6];
      const [from, to] = m[4] && !m[6] ? [c, a] : [a, c];
      b.edge(from, to, { kind: 'call', label: m[5] ? clean(m[5]) : null, summary: bi ? T.bidir : (!m[4] && !m[6] ? T.open : null), head: !m[4] && !m[6] ? 'none' : null, tail: bi ? 'arrow' : null });
    }
  }

  /* ================= requirementDiagram ================= */
  function parseRequirement(P, b) {
    const T = b.T;
    b.direction = 'down';
    const RT = /^(requirement|functionalRequirement|interfaceRequirement|performanceRequirement|physicalRequirement|designConstraint|element)\s+("[^"]+"|\S+)\s*\{$/;
    const RISK = { low: C.good, medium: C.warn, high: C.bad };
    let cur = null, fields = null;
    const name = s => unq(s.trim());
    for (const { t, n } of statements(P.lines.slice(1), false)) {
      let m;
      if (cur) {
        if (t === '}') {
          const f = fields, isEl = cur.kind === 'element';
          const metrics = [];
          if (f.id) metrics.push({ label: T.id, value: f.id });
          if (isEl && f.type) metrics.push({ label: T.type, value: f.type });
          if (f.risk) metrics.push({ label: T.risk, value: f.risk });
          if (f.verifymethod) metrics.push({ label: T.verify, value: f.verifymethod });
          if (f.docref) metrics.push({ label: T.docref, value: f.docref });
          if (metrics.length) cur.metrics = metrics;
          if (f.text) cur.summary = clean(f.text);
          if (f.id) cur.subtitle = `${cur._rtype}${f.id ? ' · ' + f.id : ''}`;
          cur.shape = 'requirement';
          cur.subtitle = `«${cur._rtype}»`;
          cur.rows = [f.id && { name: T.id, type: f.id }, f.text && { name: clean(f.text) }, isEl && f.type && { name: T.type, type: f.type }, f.risk && { name: T.risk, type: f.risk }, f.verifymethod && { name: T.verify, type: f.verifymethod }, f.docref && { name: T.docref, type: f.docref }].filter(Boolean);
          const risk = (f.risk || '').toLowerCase();
          if (RISK[risk]) cur.status = b.status('risk-' + risk, `${T.risk}: ${risk}`, RISK[risk]);
          delete cur._rtype;
          cur = null; continue;
        }
        if ((m = /^(\w+)\s*:\s*(.*)$/.exec(t))) fields[m[1].toLowerCase()] = unq(m[2]);
        continue;
      }
      if ((m = RT.exec(t))) { cur = b.node(name(m[2]), { kind: m[1] === 'element' ? 'element' : 'requirement' }); cur._rtype = m[1]; fields = {}; continue; }
      if ((m = /^(.+?)\s+-\s+(\w+)\s+->\s+(.+)$/.exec(t)) || (m = /^(.+?)\s+<-\s+(\w+)\s+-\s+(.+)$/.exec(t))) {
        const back = /<-/.test(t);
        const [src, dst] = back ? [m[3], m[1]] : [m[1], m[3]];
        const a = b.node(name(src), {}), c = b.node(name(dst), {});
        if (!a.kind) a.kind = 'element'; if (!c.kind) c.kind = 'requirement';
        b.edge(a.id, c.id, { kind: /traces|derives|copies/.test(m[2]) ? 'async' : 'dependency', label: m[2] });
        continue;
      }
      if (/^(classDef|class|style|direction)\s/.test(t)) continue;
      b.warn(T.ignored(t), n);
    }
  }

  /* ================= sankey-beta ================= */
  function parseSankey(P, b) {
    const T = b.T;
    b.direction = 'right';
    const inflow = new Map(), outflow = new Map();
    const csv = s => { const out = []; let cur = '', q = false; for (let i = 0; i < s.length; i++) { const c = s[i]; if (q) { if (c === '"' && s[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; } else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out.map(x => x.trim()); };
    for (const L of P.lines.slice(1)) {
      const [src, dst, val] = csv(L.t);
      if (!src || !dst || isNaN(parseFloat(val))) { b.warn(T.ignored(L.t), L.n); continue; }
      const col = () => PALETTE[b.nodes.size % PALETTE.length];
      const a = b.has(src) ? b.get(src) : b.node(src, { kind: 'flowpoint', shape: 'sbar', color: col() }), c = b.has(dst) ? b.get(dst) : b.node(dst, { kind: 'flowpoint', shape: 'sbar', color: col() }), v = parseFloat(val);
      b.edge(a.id, c.id, { kind: 'data', label: String(v), data: `${T.value}: ${v}`, weight: v, head: 'none', color: a.color });
      outflow.set(a.id, (outflow.get(a.id) || 0) + v); inflow.set(c.id, (inflow.get(c.id) || 0) + v);
    }
    const fmt = v => Math.round(v * 100) / 100;
    for (const nd of b.nodes.values()) {
      const i = inflow.get(nd.id), o = outflow.get(nd.id);
      nd.metrics = [i != null ? { label: T.inflow, value: String(fmt(i)) } : null, o != null ? { label: T.outflow, value: String(fmt(o)) } : null].filter(Boolean);
      nd.subtitle = String(fmt(Math.max(i || 0, o || 0)));
      nd.value = fmt(Math.max(i || 0, o || 0));
    }
    /* los dos flujos más gruesos, con énfasis */
    /* columnas por profundidad, barras con altura según el valor y cintas apiladas */
    b.layout = { mode: 'sankey' };
  }

  /* ================= kanban ================= */
  function parseKanban(P, b) {
    const T = b.T;
    b.direction = 'right';
    b.layout = { lanes: 'strict' };
    const base = (/ticketBaseUrl:\s*['"]?([^'"\n]+)/.exec(P.meta.config) || [])[1];
    const PR = { 'very high': C.bad, high: C.warn, low: C.info, 'very low': C.gray };
    const body = P.lines.slice(1);
    const colIndent = Math.min(...body.map(l => l.indent));
    let col = null;
    for (const L of body) {
      let t = L.t, meta = null;
      const at = /^(.*?)@\{(.*)\}\s*$/.exec(t); if (at) { t = at[1].trim(); meta = parseObj(at[2]); }
      const m = /^([\w-]*)\s*\[(.*)\]$/.exec(t);
      const raw = m ? (m[1] || null) : null, label = clean(m ? m[2] : t);
      if (L.indent <= colIndent) { col = b.lane(raw || '\u0000col' + L.n, { label }); continue; }
      if (!col) { b.warn(T.ignored(L.t), L.n); continue; }
      const nd = b.node(raw || '\u0000card' + L.n, { label, kind: 'card', lane: col.id, shape: 'ticket' });
      if (meta) {
        const metrics = [];
        if (meta.assigned) { metrics.push({ label: T.assigned, value: meta.assigned }); nd.subtitle = meta.assigned; const words = String(meta.assigned).split(/[\s._-]+/).filter(Boolean); nd.avatar = (words.length > 1 ? words.map(w => Array.from(w)[0]).join('') : Array.from(words[0] || '').slice(0, 2).join('')).slice(0, 4); }
        if (meta.ticket) nd.badge = meta.ticket;
        if (meta.ticket) {
          metrics.push({ label: T.ticket, value: meta.ticket });
          if (base && httpURL(base.replace('#TICKET#', meta.ticket))) nd.links = [{ kind: 'url', url: base.replace('#TICKET#', encodeURIComponent(meta.ticket)), label: meta.ticket }];
        }
        if (meta.priority) {
          metrics.push({ label: T.priority, value: meta.priority });
          const k = meta.priority.toLowerCase(); if (PR[k]) nd.status = b.status('p-' + k.replace(/\s+/g, '-'), `${T.priority}: ${meta.priority}`, PR[k]);
        }
        if (metrics.length) nd.metrics = metrics;
      }
    }
  }

  /* ================= treemap-beta ================= */
  function parseTreemap(P, b) {
    const T = b.T;
    b.direction = 'right';
    const stack = [], value = new Map();
    let branchN = 0;
    for (const L of P.lines.slice(1)) {
      if (/^classDef\s/.test(L.t)) continue;
      const m = /^"([^"]+)"\s*(?::\s*([\d.]+))?\s*(?::::[\w-]+)?$/.exec(L.t);
      if (!m) { b.warn(T.ignored(L.t), L.n); continue; }
      while (stack.length && stack[stack.length - 1].indent >= L.indent) stack.pop();
      const nd = b.node('\u0000tm' + L.n, { label: clean(m[1]), kind: m[2] != null ? 'card' : 'group' });
      if (m[2] != null) { nd.shape = 'block'; nd.value = parseFloat(m[2]); }
      if (stack.length) b.setParent(nd.id, stack[stack.length - 1].id);
      if (m[2] != null) { value.set(nd.id, parseFloat(m[2])); nd.metrics = [{ label: T.value, value: m[2] }]; nd.subtitle = m[2]; }
      /* un tono por rama de primer nivel; lo heredan sus hojas */
      const color = stack.length === 1 ? PALETTE[(branchN++) % PALETTE.length] : stack.length ? stack[stack.length - 1].color : null;
      if (color) nd.color = color;
      stack.push({ indent: L.indent, id: nd.id, color });
    }
    b.layout = { mode: 'treemap' };
    /* suma hacia arriba */
    const nodes = [...b.nodes.values()];
    const sum = id => { const own = value.get(id) || 0; return own + nodes.filter(x => x.parent === id).reduce((a, x) => a + sum(x.id), 0); };
    nodes.filter(x => x.kind === 'group').forEach(g => { const s = sum(g.id); g.metrics = [{ label: T.total, value: String(Math.round(s * 100) / 100) }]; g.subtitle = String(Math.round(s * 100) / 100); });
  }

  /* ---------- entrada ---------- */
  const TYPES = [
    [/^(flowchart|flowchart-elk|graph)\b/, 'flowchart', parseFlowchart],
    [/^sequenceDiagram\b/, 'sequenceDiagram', parseSequence],
    [/^classDiagram(-v2)?\b/, 'classDiagram', parseClass],
    [/^stateDiagram(-v2)?\b/, 'stateDiagram', parseState],
    [/^erDiagram\b/, 'erDiagram', parseER],
    [/^mindmap\b/, 'mindmap', parseMindmap],
    [/^gantt\b/, 'gantt', parseGantt],
    [/^journey\b/, 'journey', parseJourney],
    [/^timeline\b/, 'timeline', parseTimeline],
    [/^gitGraph\b/, 'gitGraph', parseGit],
    [/^C4(Context|Container|Component|Dynamic|Deployment)\b/, 'C4', parseC4],
    [/^architecture(-beta)?\b/, 'architecture', parseArchitecture],
    [/^block(-beta)?\b/, 'block', (P, b) => parseFlowchart(P, b, { block: true })],
    [/^requirementDiagram\b/, 'requirementDiagram', parseRequirement],
    [/^sankey(-beta)?\b/, 'sankey', parseSankey],
    [/^kanban\b/, 'kanban', parseKanban],
    [/^treemap(-beta)?\b/, 'treemap', parseTreemap]
  ];
  function detect(text) {
    const P = prep(text);
    const first = P.lines[0];
    return { P, first, keyword: first ? first.t.split(/[\s:;]/)[0] : null };
  }
  function fromMermaid(text, opts) {
    opts = opts || {};
    const lang = opts.lang === 'en' ? 'en' : 'es';
    const T = STR[lang];
    const { P, first, keyword } = detect(text);
    if (!first) throw new MermaidError(T.empty);
    if (REJECT.test(keyword)) throw new MermaidError(T.rejected(keyword), first.n);
    if (keyword === 'zenuml') throw new MermaidError(T.zenuml, first.n);
    const hit = TYPES.find(([re]) => re.test(first.t));
    if (!hit) throw new MermaidError(T.unknown(keyword), first.n);
    const [, type, parse] = hit;
    const b = new Builder(lang);
    const sub = type === 'C4' ? first.t.split(/\s/)[0] : type;
    const extra = parse(P, b, type === 'C4' ? sub : opts) || {};
    if (!b.nodes.size) throw new MermaidError(`${sub}: no hay ninguna pieza que dibujar`);
    const spec = b.finish(sub, P.meta, extra);
    if (opts.title) spec.title = opts.title;
    return { spec, type: sub, warnings: b.warnings };
  }

  /* ---------- montaje en páginas ---------- */
  function mountMermaid(host, text, opts) {
    const r = fromMermaid(text, opts);
    if (r.warnings.length && global.console) console.warn('GraphX · Mermaid:\n  ' + r.warnings.join('\n  '));
    return global.GraphX.mount(host, r.spec, opts || {});
  }
  /* Sustituye los bloques de Mermaid de una página por diagramas de GraphX. Un bloque que no se
     puede convertir se queda como estaba (y el motivo va a la consola). */
  function replaceMermaid(root, opts) {
    opts = opts || {};
    const out = [];
    (root || document).querySelectorAll('pre.mermaid, div.mermaid, code.language-mermaid').forEach(el => {
      const target = el.tagName === 'CODE' && el.parentElement && el.parentElement.tagName === 'PRE' ? el.parentElement : el;
      if (target._gxMermaid) return;
      const text = el.textContent;
      let r; try { r = fromMermaid(text, opts); } catch (e) { if (global.console) console.warn('GraphX · Mermaid: ' + e.message); return; }
      const host = document.createElement('div');
      host.className = 'gx-host'; host.setAttribute('data-gx', '');
      target.replaceWith(host); host._gxMermaid = text;
      host._gx = global.GraphX.mount(host, r.spec, { height: opts.height || null, lang: opts.lang });
      out.push(host._gx);
    });
    return out;
  }

  global.GraphX = Object.assign(global.GraphX || {}, { fromMermaid, mountMermaid, replaceMermaid, MermaidError, mermaidTypes: TYPES.map(x => x[1]) });
})(typeof window !== 'undefined' ? window : globalThis);
