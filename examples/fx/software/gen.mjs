/* El checkout de una tienda: mapa de servicios con equipos, latencias, caudales, un día de actividad
 * (TSV generado aquí, como saldría de una consulta) y paneles ricos.
 *   node examples/fx/software/gen.mjs   →  examples/fx/software.json
 * La tabla va en formato ancho: una fila por hora y una columna por serie, `<id>.<campo>`. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/* curva de un día de comercio: valle de madrugada, pico a mediodía y otro por la noche */
const day = h => .18 + .55 * Math.exp(-((h - 13) ** 2) / 10) + .62 * Math.exp(-((h - 21) ** 2) / 6);
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const jit = (v, k) => v * (1 + (rnd() - .5) * k);
const hours = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);
const incident = h => h >= 13 && h < 15, deploy = h => h >= 9;
const cols = ['time', 'gateway.heat', 'catalogo.heat', 'checkout.heat', 'pagos.heat', 'antifraude.heat', 'stock.heat', 'postgres.heat', 'redis.heat',
  'e-web-gw', 'e-app-gw', 'e-gw-cat', 'e-gw-co', 'e-co-pay', 'e-pay-af', 'e-co-stk', 'e-pay-kf', 'e-kf-mail',
  'k-pedidos.value', 'k-budget.value', 'pagos.progress', 'pagos.spark', 'checkout.spark', 'event'];
const rows = hours.map((t, h) => {
  const f = day(h), inc = incident(h);
  const web = jit(900 * f, .1), app = jit(640 * f, .1);
  const r = {
    time: t,
    'gateway.heat': jit(32 + 30 * f, .15), 'catalogo.heat': jit(40 + 25 * f, .2), 'checkout.heat': jit(inc ? 240 : 90 + 80 * f, .15),
    'pagos.heat': jit(inc ? 420 : 150 + 120 * f, .12), 'antifraude.heat': jit(inc ? 780 : 120 + 160 * f, .12), 'stock.heat': jit(35 + 20 * f, .2),
    'postgres.heat': jit(8 + 14 * f + (inc ? 10 : 0), .2), 'redis.heat': jit(2 + 2 * f, .3),
    'e-web-gw': web, 'e-app-gw': app, 'e-gw-cat': jit((web + app) * .55, .1), 'e-gw-co': jit((web + app) * .2, .1),
    'e-co-pay': jit((web + app) * .12 * (inc ? .6 : 1), .1), 'e-pay-af': jit((web + app) * .12 * (inc ? .6 : 1), .1), 'e-co-stk': jit((web + app) * .2, .1),
    'e-pay-kf': jit((web + app) * .11 * (inc ? .6 : 1), .1), 'e-kf-mail': jit((web + app) * .11 * (inc ? .6 : 1), .1),
    'k-pedidos.value': jit(820 * f * (inc ? .7 : 1), .06), 'k-budget.value': Math.max(5, 92 - h * 1.4 - (h >= 13 ? 26 : 0) - (h >= 15 ? 4 : 0)),
    'pagos.progress': deploy(h) ? Math.min(1, .1 + (h - 9) * .12) : 1, 'pagos.spark': jit(inc ? 420 : 150 + 120 * f, .1), 'checkout.spark': jit(110 * f + 20, .1),
    event: h === 9 ? 'Despliegue de Pagos 4.2 (canario)' : ''
  };
  return cols.map(c => (typeof r[c] === 'number' ? (Math.round(r[c] * (c.includes('progress') ? 100 : 1)) / (c.includes('progress') ? 100 : 1)) : r[c] || '')).join('\t');
});
const tsv = [cols.join('\t'), ...rows].join('\n');

const latDay = hours.map((_, h) => Math.round(150 + 120 * day(h) + (incident(h) ? 270 : 0)));
const spec = {
  title: 'Checkout de la tienda, un día de tráfico',
  summary: 'Servicios, equipos y dependencias del checkout. La línea de tiempo reproduce un día real: el pico de mediodía, el despliegue de Pagos a las 09:00 y el incidente de Antifraude de las 13:00.',
  lang: 'es', direction: 'right', initialDepth: 1,
  fx: { particles: true, play: true, heat: { label: 'Latencia p95', unit: 'ms', domain: [0, 600], scheme: 'traffic' }, spotlight: true, glow: true, entrance: 'cascade' },
  owners: {
    web: { label: 'Equipo Web', short: 'WEB', contact: '#web-squad' },
    checkout: { label: 'Equipo Checkout', short: 'CO', contact: '#checkout' },
    pagos: { label: 'Equipo Pagos', short: 'PG', contact: '#pagos-oncall', url: 'https://example.com/equipos/pagos' },
    plataforma: { label: 'Plataforma', short: 'PL', contact: '#platform' },
    datos: { label: 'Datos', short: 'DT', contact: '#data-eng' }
  },
  levels: [{ depth: 0, label: 'Capa' }, { depth: 1, label: 'Servicio' }],
  legend: { kinds: { ui: 'interfaz', mobile: 'app', route: 'pasarela', lock: 'identidad', search: 'búsqueda', cart: 'comercio', card: 'cobros', shield: 'riesgo', service: 'servicio', mail: 'mensajería', datastore: 'base de datos', cache: 'caché', queue: 'cola de eventos', gauge: 'indicador', other: 'otro' } },
  lanes: [
    { id: 'clientes', label: 'Clientes', subtitle: 'web y apps', owner: 'web' },
    { id: 'borde', label: 'Borde', subtitle: 'entrada y sesión', owner: 'plataforma' },
    { id: 'dominio', label: 'Dominio', subtitle: 'la lógica del checkout' },
    { id: 'datos', label: 'Datos', subtitle: 'estado y eventos', owner: 'datos' },
    { id: 'panel', label: 'Indicadores', subtitle: 'lo que vigila la guardia' }
  ],
  nodes: [
    { id: 'web', lane: 'clientes', label: 'Tienda web', kind: 'ui', summary: 'La web en Next.js. Sirve el catálogo y el checkout.' },
    { id: 'app', lane: 'clientes', label: 'App móvil', kind: 'mobile', summary: 'La app de iOS y Android.' },
    { id: 'gateway', lane: 'borde', label: 'API Gateway', kind: 'route', summary: 'Termina TLS, limita por cliente y enruta.',
      blocks: [
        { type: 'quote', text: 'Ninguna petición llega a un servicio sin pasar por aquí: límites, autenticación y trazas en un solo sitio.', by: 'ADR-014 · Una sola puerta de entrada' },
        { type: 'kv', items: [['Instancias', '6 × c6g.large'], ['Límite por cliente', '50 req/s'], ['Timeout', '8 s'], ['Repositorio', '`platform/gateway`']] }
      ] },
    { id: 'auth', lane: 'borde', label: 'Sesión y OAuth', kind: 'lock', summary: 'Valida tokens y sesiones.' },
    { id: 'catalogo', lane: 'dominio', label: 'Catálogo', kind: 'search', owner: 'web', summary: 'Productos, precios y búsqueda.' },
    { id: 'checkout', lane: 'dominio', label: 'Checkout', kind: 'cart', owner: 'checkout', summary: 'Orquesta la compra: reserva stock, cobra y confirma.',
      blocks: [
        { type: 'steps', title: 'La saga de una compra', items: [{ label: 'Reservar stock', state: 'done' }, { label: 'Cobrar', state: 'active' }, { label: 'Confirmar el pedido', state: 'todo' }, { label: 'Enviar la confirmación', state: 'todo' }] },
        { type: 'bars', title: 'Endpoints más lentos (p95)', unit: 'ms', items: [{ label: 'POST /orders', value: 212 }, { label: 'POST /payments', value: 188 }, { label: 'GET /cart', value: 64 }, { label: 'PUT /cart/items', value: 41 }] },
        { type: 'donut', label: 'Errores por tipo (24 h)', parts: [{ label: 'Timeout de Pagos', value: 61 }, { label: 'Sin stock', value: 27 }, { label: 'Validación', value: 12 }] },
        { type: 'kv', items: [['Lenguaje', 'Kotlin · Spring'], ['Guardia', '@ana.ruiz'], ['SLO', '99,9 % · p95 < 300 ms'], ['Repositorio', '`checkout/api`']] }
      ] },
    { id: 'pagos', lane: 'dominio', label: 'Pagos', kind: 'card', owner: 'pagos', unit: 'ms', summary: 'Cobra con el proveedor de tarjetas y emite el evento de pago.',
      blocks: [
        { type: 'callout', tone: 'warn', title: 'Despliegue en curso', text: 'La versión **4.2** está en canario. Si el p95 pasa de 400 ms, el rollback es automático.' },
        { type: 'stats', items: [{ label: 'p95', value: 268, unit: 'ms', change: 12, good: 'down', spark: latDay.slice(-12) }, { label: 'Errores', value: '0,8', unit: '%', change: -0.3, good: 'down' }, { label: 'Cobros/min', value: 412, change: 6.1 }] },
        { type: 'chart', title: 'Latencia p95 en el día', kind: 'area', unit: 'ms', labels: hours, series: [{ label: 'p95', values: latDay }, { label: 'Objetivo', values: hours.map(() => 300), color: '#cf222e' }] },
        { type: 'table', title: 'Objetivos de servicio', columns: ['SLO', 'Objetivo', 'Ahora'], rows: [['Disponibilidad', '99,95 %', { v: '99,97 %', tone: 'good' }], ['Latencia p95', '300 ms', { v: '268 ms', tone: 'good' }], ['Cobros fallidos', '< 1 %', { v: '0,8 %', tone: 'warn' }]] },
        { type: 'code', lang: 'sh', title: 'Rollback manual', code: '# vuelve a la versión estable\nkubectl -n pagos rollout undo deploy/pagos-api\nkubectl -n pagos rollout status deploy/pagos-api --timeout=120s' },
        { type: 'checklist', title: 'Runbook: el proveedor no responde', items: [{ text: 'Comprobar el estado del proveedor', done: true }, { text: 'Activar el proveedor de respaldo', done: true }, { text: 'Avisar en #incidentes', done: false }, { text: 'Abrir el postmortem', done: false }] },
        { type: 'timeline', title: 'Últimos cambios', items: [{ time: '09:00', label: 'Despliegue 4.2 al 10 % (canario)', tone: 'info' }, { time: '11:30', label: 'Canario al 40 %', tone: 'info' }, { time: '13:05', label: 'Latencia por encima del objetivo', tone: 'crit' }, { time: '15:00', label: 'Rollback del modelo de Antifraude', tone: 'good' }] }
      ] },
    { id: 'antifraude', lane: 'dominio', label: 'Antifraude', kind: 'shield', owner: 'pagos', summary: 'Puntúa cada pago con el modelo de riesgo.',
      blocks: [{ type: 'callout', tone: 'crit', title: 'Punto caliente', text: 'El modelo v7 tarda el doble con carritos de más de 20 líneas.' }, { type: 'badges', items: [{ label: 'modelo v7', tone: 'warn' }, { label: 'GPU', tone: 'neutral' }, { label: 'p99 1,1 s', tone: 'crit' }] }] },
    { id: 'stock', lane: 'dominio', label: 'Stock', kind: 'service', owner: 'checkout', summary: 'Reserva y libera unidades por almacén.' },
    { id: 'notif', lane: 'dominio', label: 'Notificaciones', kind: 'mail', owner: 'web', summary: 'Envía el correo y el push de confirmación.' },
    { id: 'postgres', lane: 'datos', label: 'PostgreSQL', kind: 'datastore', summary: 'Pedidos, pagos y stock. Primaria y dos réplicas.',
      blocks: [
        { type: 'gauge', label: 'CPU de la primaria', value: 62, unit: '%', thresholds: [70, 85] },
        { type: 'heatstrip', title: 'Carga por hora, última semana', scheme: 'heat', unit: '%', labels: hours, rows: ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'].map((d, k) => ({ label: d, values: hours.map((_, h) => Math.round(20 + 70 * day(h) * (k > 4 ? .7 : 1) + (k === 3 && h === 13 ? 20 : 0))) })) },
        { type: 'kv', items: [['Versión', '16.4'], ['Tamaño', '1,8 TB'], ['Conexiones', '420 / 800'], ['Réplicas', '2 (lag 40 ms)']] }
      ] },
    { id: 'redis', lane: 'datos', label: 'Redis', kind: 'cache', summary: 'Sesiones, carritos y catálogo caliente.' },
    { id: 'kafka', lane: 'datos', label: 'Kafka', kind: 'queue', summary: 'El bus de eventos del checkout.',
      blocks: [{ type: 'chart', title: 'Mensajes por topic (miles/h)', kind: 'stack', labels: hours.filter((_, h) => h % 3 === 0), series: [{ label: 'pago.completado', values: hours.filter((_, h) => h % 3 === 0).map((_, k) => Math.round(30 + 60 * day(k * 3))) }, { label: 'pedido.creado', values: hours.filter((_, h) => h % 3 === 0).map((_, k) => Math.round(40 + 70 * day(k * 3))) }, { label: 'stock.reservado', values: hours.filter((_, h) => h % 3 === 0).map((_, k) => Math.round(35 + 65 * day(k * 3))) }] }] },
    { id: 'k-pedidos', lane: 'panel', label: 'Pedidos por hora', shape: 'kpi', kind: 'cart', value: 820, change: 4.2, summary: 'Pedidos confirmados en la última hora.' },
    { id: 'k-budget', lane: 'panel', label: 'Presupuesto de error', shape: 'gauge', kind: 'gauge', value: 64, unit: '%', thresholds: [40, 20], good: 'high', summary: 'Lo que queda del presupuesto de error del mes.' },
    { id: 'k-metodo', lane: 'panel', label: 'Pagos por método', shape: 'donut', kind: 'card', parts: [{ label: 'Tarjeta', value: 61 }, { label: 'Bizum', value: 22 }, { label: 'PayPal', value: 12 }, { label: 'Transferencia', value: 5 }], summary: 'Reparto de los cobros de hoy.' }
  ],
  edges: [
    { id: 'e-web-gw', from: 'web', to: 'gateway', kind: 'http', rate: 600 },
    { id: 'e-app-gw', from: 'app', to: 'gateway', kind: 'http', rate: 420 },
    { id: 'e-gw-auth', from: 'gateway', to: 'auth', kind: 'rpc', rate: 900 },
    { id: 'e-gw-cat', from: 'gateway', to: 'catalogo', kind: 'http', rate: 560 },
    { id: 'e-gw-co', from: 'gateway', to: 'checkout', kind: 'http', rate: 200, emphasis: 'hero', label: 'POST /orders' },
    { id: 'e-co-pay', from: 'checkout', to: 'pagos', kind: 'rpc', rate: 120, emphasis: 'hero', label: 'cobrar' },
    { id: 'e-pay-af', from: 'pagos', to: 'antifraude', kind: 'rpc', rate: 120, label: 'puntuar' },
    { id: 'e-co-stk', from: 'checkout', to: 'stock', kind: 'rpc', rate: 200, label: 'reservar' },
    { id: 'e-pay-kf', from: 'pagos', to: 'kafka', kind: 'event', rate: 110, label: 'pago.completado' },
    { id: 'e-kf-mail', from: 'kafka', to: 'notif', kind: 'event', rate: 110 },
    { id: 'e-cat-rd', from: 'catalogo', to: 'redis', kind: 'data', rate: 500 },
    { id: 'e-auth-rd', from: 'auth', to: 'redis', kind: 'data', rate: 800 },
    { id: 'e-co-pg', from: 'checkout', to: 'postgres', kind: 'data', rate: 200 },
    { id: 'e-pay-pg', from: 'pagos', to: 'postgres', kind: 'data', rate: 120 },
    { id: 'e-stk-pg', from: 'stock', to: 'postgres', kind: 'data', rate: 200 }
  ],
  timeline: {
    label: 'Martes 6 de octubre · una fila por hora',
    data: tsv, window: 12, step: 1100, start: 'end',
    events: [{ time: '13:00', label: 'Antifraude supera los 700 ms', tone: 'crit', nodes: ['antifraude'] }, { time: '15:00', label: 'Rollback del modelo', tone: 'good', nodes: ['antifraude'] }]
  },
  flows: [{
    id: 'pago', title: 'Un pago', summary: 'De «Pagar» a la confirmación.',
    participants: ['web', 'gateway', 'checkout', 'pagos', 'antifraude', 'kafka'],
    messages: [
      { from: 'web', to: 'gateway', label: 'POST /orders' }, { from: 'gateway', to: 'checkout', label: 'crear pedido' },
      { from: 'checkout', to: 'pagos', label: 'cobrar 42,90 €' }, { from: 'pagos', to: 'antifraude', label: 'puntuar' },
      { from: 'antifraude', to: 'pagos', label: 'riesgo 0,12', kind: 'return' }, { from: 'pagos', to: 'kafka', label: 'pago.completado', kind: 'async' },
      { from: 'pagos', to: 'checkout', label: 'cobrado', kind: 'return' }, { from: 'checkout', to: 'web', label: '201 Created', kind: 'return' }
    ]
  }],
  tour: { title: 'El incidente de las 13:00', steps: [
    { title: 'El camino de una compra', body_html: '<p>La pasarela manda cada compra a <b>Checkout</b>, que reserva stock y pide el cobro a <b>Pagos</b>.</p>', focus: { nodes: ['gateway', 'checkout', 'stock', 'pagos'], edges: ['e-gw-co', 'e-co-stk', 'e-co-pay'] } },
    { title: 'Antifraude se atasca', body_html: '<p>A mediodía el modelo de riesgo tarda más de 700 ms y arrastra a Pagos. Pulsa <b>✺ Impacto</b> en su panel para ver hasta dónde llega.</p>', focus: { nodes: ['pagos', 'antifraude'], edges: ['e-pay-af'] }, select: 'antifraude' },
    { title: 'El evento sigue saliendo', body_html: '<p>Los pagos que sí se cobran salen por <b>Kafka</b> y llegan a Notificaciones con normalidad.</p>', focus: { nodes: ['pagos', 'kafka', 'notif'], edges: ['e-pay-kf', 'e-kf-mail'] } }
  ] }
};
fs.writeFileSync(path.join(HERE, '..', 'software.json'), JSON.stringify(spec, null, 2) + '\n');
console.log(`✓ software.json · ${spec.nodes.length} piezas · ${hours.length} filas × ${cols.length - 2} series`);
