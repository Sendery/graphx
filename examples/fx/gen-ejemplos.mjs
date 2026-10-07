/* Ejemplos de graphx-fx generados con datos sintéticos coherentes:
 *   node examples/fx/gen-ejemplos.mjs
 * → pipeline-datos.json + datos/pipeline.csv (formato largo) + datos/pipeline-eventos.tsv
 *   (la tabla se lleva al diagrama con tools/timeline.mjs, como se haría con la salida de una consulta)
 * → postmortem.json   un incidente minuto a minuto, con recorrido, impacto y acciones
 * → kubernetes.json   un clúster: namespaces → deployments → pods, CPU como calor, rollouts y equipos  */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../..');
let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const jit = (v, k) => v * (1 + (rnd() - .5) * k);
const write = (f, o) => fs.writeFileSync(path.join(HERE, f), typeof o === 'string' ? o : JSON.stringify(o, null, 2) + '\n');
const r1 = v => Math.round(v * 10) / 10;

/* ---------- 1 · pipeline de datos: la carga nocturna, cada 10 minutos de 02:00 a 06:00 ---------- */
{
  const times = Array.from({ length: 25 }, (_, i) => { const m = 120 + i * 10; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; });
  const rows = ['time,id,field,value'];
  times.forEach((t, i) => {
    const ramp = Math.min(1, i / 4), tail = i > 18 ? Math.max(.15, 1 - (i - 18) / 6) : 1, slow = i >= 9 && i <= 12;
    const base = 4200 * ramp * tail;
    const put = (id, field, v) => rows.push(`${t},${id},${field},${typeof v === 'number' ? r1(v) : v}`);
    put('crm-cdc', 'rate', jit(base * .35, .15)); put('erp-cdc', 'rate', jit(base * .25, .15)); put('web-ev', 'rate', jit(base * .4, .2));
    put('ing-clean', 'rate', jit(base * (slow ? .55 : 1), .1)); put('clean-dedup', 'rate', jit(base * (slow ? .5 : .96), .1)); put('dedup-enrich', 'rate', jit(base * (slow ? .5 : .94), .1));
    put('enrich-silver', 'rate', jit(base * (slow ? .48 : .93), .1)); put('silver-gold', 'rate', jit(base * .6 * (slow ? .4 : 1), .1));
    put('gold-bi', 'rate', jit(400 * tail * ramp, .2)); put('gold-ml', 'rate', jit(260 * tail * ramp, .2));
    put('kafka', 'heat', jit(2 + 3 * ramp, .3)); put('limpieza', 'heat', jit(slow ? 34 : 6 + 4 * ramp, .2)); put('dedup', 'heat', jit(slow ? 28 : 5 + 3 * ramp, .2));
    put('enriquecido', 'heat', jit(slow ? 46 : 8 + 6 * ramp, .2)); put('silver', 'heat', jit(slow ? 22 : 4, .3)); put('gold', 'heat', jit(slow ? 52 : 10, .2));
    put('gold', 'progress', Math.min(1, i / 22)); put('k-filas', 'value', Math.round(base * 600 * (i + 1) / 1e6 * 100) / 100); put('k-frescura', 'value', slow ? jit(58, .1) : jit(18 + i * .4, .1));
    put('limpieza', 'spark', jit(base * (slow ? .55 : 1), .1));
    if (slow) put('limpieza', 'alert', 'warn'); else put('limpieza', 'alert', '-');
  });
  fs.mkdirSync(path.join(HERE, 'datos'), { recursive: true });
  write('datos/pipeline.csv', rows.join('\n') + '\n');
  write('datos/pipeline-eventos.tsv', 'time\tlabel\ttone\tnodes\n02:00\tEmpieza la carga nocturna\tinfo\tcrm,erp,web\n03:30\tLa limpieza se atasca con un lote corrupto del ERP\twarn\tlimpieza\n04:00\tSe descarta el lote y se reintenta\tgood\tlimpieza,dedup\n05:40\tGold listo para los cuadros de mando\tgood\tgold\n');
  const spec = {
    title: 'La carga nocturna de datos',
    summary: 'Del CRM, el ERP y la analítica web al lakehouse y a los cuadros de mando. La línea de tiempo sale de un CSV en formato largo (time · id · field · value), cargado con tools/timeline.mjs.',
    lang: 'es', direction: 'right', initialDepth: 1,
    fx: { particles: true, heat: { label: 'Retraso', unit: 'min', domain: [0, 60], scheme: 'heat' }, play: true, glow: true, spotlight: true },
    owners: { 'data-eng': { label: 'Ingeniería de datos', short: 'DE', contact: '#data-eng' }, analytics: { label: 'Analítica', short: 'AN', contact: '#analytics' }, ml: { label: 'Machine learning', short: 'ML', contact: '#ml-platform' } },
    lanes: [
      { id: 'origenes', label: 'Orígenes', subtitle: 'sistemas de negocio' }, { id: 'ingesta', label: 'Ingesta', subtitle: 'captura de cambios', owner: 'data-eng' },
      { id: 'proceso', label: 'Procesado', subtitle: 'Spark, cada 10 min', owner: 'data-eng' }, { id: 'lake', label: 'Lakehouse', subtitle: 'bronze · silver · gold', owner: 'data-eng' },
      { id: 'consumo', label: 'Consumo', subtitle: 'quien usa los datos' }, { id: 'kpis', label: 'La carga', subtitle: 'cifras de esta noche' }
    ],
    nodes: [
      { id: 'crm', lane: 'origenes', label: 'CRM', kind: 'user', summary: 'Clientes y oportunidades (Salesforce).' },
      { id: 'erp', lane: 'origenes', label: 'ERP', kind: 'card', summary: 'Pedidos, facturas y stock (SAP).' },
      { id: 'web', lane: 'origenes', label: 'Analítica web', kind: 'chart', summary: 'Eventos de navegación y compra.' },
      { id: 'kafka', lane: 'ingesta', label: 'Kafka Connect', kind: 'queue', summary: 'Captura de cambios (CDC) de cada origen.' },
      { id: 'limpieza', lane: 'proceso', label: 'Limpieza', kind: 'function', summary: 'Tipos, nulos y formatos. Aquí se descartan las filas inválidas.',
        blocks: [{ type: 'table', title: 'Controles de calidad', columns: ['Control', 'Filas', 'Resultado'], rows: [['Fecha válida', 1203400, { v: 'ok', tone: 'good' }], ['Importe ≥ 0', 1203380, { v: '20 fuera', tone: 'warn' }], ['Cliente existe', 1201950, { v: '1 450 huérfanas', tone: 'crit' }]] },
          { type: 'callout', tone: 'warn', title: 'Lote corrupto del ERP', text: 'A las 03:30 llegó un lote con fechas en otro formato; se descartó y se reintentó a las 04:00.' }] },
      { id: 'dedup', lane: 'proceso', label: 'Deduplicado', kind: 'function', summary: 'Una fila por clave de negocio y versión.' },
      { id: 'enriquecido', lane: 'proceso', label: 'Enriquecimiento', kind: 'cpu', summary: 'Añade región, segmento y tipo de cambio.',
        blocks: [{ type: 'code', lang: 'py', title: 'El paso de Spark', code: '# une los pedidos con la tabla de clientes\npedidos = spark.table("silver.pedidos")\nclientes = spark.table("silver.clientes")\nout = pedidos.join(clientes, "cliente_id", "left")\nout.write.mode("append").saveAsTable("gold.pedidos")' }] },
      { id: 'silver', lane: 'lake', label: 'Silver', kind: 'datastore', summary: 'Tablas limpias y deduplicadas (Delta).' },
      { id: 'gold', lane: 'lake', label: 'Gold', kind: 'datastore', summary: 'Tablas de negocio listas para consumir. El backfill avanza con la carga.',
        blocks: [{ type: 'stats', items: [{ label: 'Tablas', value: 42 }, { label: 'Filas hoy', value: 8400000 }, { label: 'Tamaño', value: '1,2', unit: 'TB' }] }, { type: 'kv', items: [['Formato', 'Delta Lake'], ['Retención', '400 días'], ['Particionado', 'por día'], ['Esquema', '`gold.*`']] }] },
      { id: 'bi', lane: 'consumo', label: 'Cuadros de mando', kind: 'chart', owner: 'analytics', summary: 'Looker: ventas, márgenes y stock.' },
      { id: 'ml', lane: 'consumo', label: 'Modelos de ML', kind: 'cpu', owner: 'ml', summary: 'Previsión de demanda y riesgo de impago.' },
      { id: 'k-filas', lane: 'kpis', label: 'Millones de filas cargadas', shape: 'kpi', kind: 'datastore', value: 0, decimals: 1, summary: 'Filas cargadas en gold esta noche.' },
      { id: 'k-frescura', lane: 'kpis', label: 'Frescura de gold (min)', shape: 'gauge', kind: 'gauge', value: 20, min: 0, max: 90, unit: 'min', thresholds: [45, 60], summary: 'Minutos desde el último dato en gold; el SLA es 60.' },
      { id: 'k-origen', lane: 'kpis', label: 'Filas por origen', shape: 'donut', kind: 'other', parts: [{ label: 'Web', value: 40 }, { label: 'CRM', value: 35 }, { label: 'ERP', value: 25 }], summary: 'De dónde viene lo que se carga.' }
    ],
    edges: [
      { id: 'crm-cdc', from: 'crm', to: 'kafka', kind: 'event', rate: 1000 }, { id: 'erp-cdc', from: 'erp', to: 'kafka', kind: 'event', rate: 800 }, { id: 'web-ev', from: 'web', to: 'kafka', kind: 'event', rate: 1400 },
      { id: 'ing-clean', from: 'kafka', to: 'limpieza', kind: 'data', rate: 3200, emphasis: 'hero' }, { id: 'clean-dedup', from: 'limpieza', to: 'dedup', kind: 'data', rate: 3100 },
      { id: 'dedup-enrich', from: 'dedup', to: 'enriquecido', kind: 'data', rate: 3000 }, { id: 'enrich-silver', from: 'enriquecido', to: 'silver', kind: 'data', rate: 3000 },
      { id: 'silver-gold', from: 'silver', to: 'gold', kind: 'data', rate: 1800 }, { id: 'gold-bi', from: 'bi', to: 'gold', kind: 'data', rate: 400, label: 'consultas' }, { id: 'gold-ml', from: 'ml', to: 'gold', kind: 'data', rate: 260 }
    ],
    timeline: { label: 'Noche del 6 al 7 de octubre · cada 10 minutos', step: 800, window: 10, start: 'end' }
  };
  write('pipeline-datos.json', spec);
  execFileSync(process.execPath, [path.join(ROOT, 'tools/timeline.mjs'), path.join(HERE, 'pipeline-datos.json'), path.join(HERE, 'datos/pipeline.csv'), '--events', path.join(HERE, 'datos/pipeline-eventos.tsv')], { stdio: 'inherit' });
}

/* ---------- 2 · postmortem: la caída del inicio de sesión, cada 2 minutos de 10:36 a 11:28 ---------- */
{
  const T = Array.from({ length: 27 }, (_, i) => { const m = 36 + i * 2; return `${10 + Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; });
  const phase = i => (i < 3 ? 'ok' : i < 9 ? 'falla' : i < 12 ? 'rollback' : i < 16 ? 'redis' : i < 21 ? 'recupera' : 'ok');
  const cols = ['time', 'gateway.heat', 'auth.heat', 'redis.heat', 'users-db.heat', 'sms.heat', 'e-web-gw', 'e-app-gw', 'e-gw-auth', 'e-auth-redis', 'e-auth-db', 'e-auth-sms', 'k-logins.value', 'k-error.value', 'auth.alert', 'redis.alert'];
  const rows = T.map((t, i) => {
    const p = phase(i), bad = p === 'falla' || p === 'rollback', sl = p === 'redis';
    const v = {
      'gateway.heat': jit(bad ? 380 : sl ? 220 : 40, .1), 'auth.heat': jit(bad ? 1900 : sl ? 900 : p === 'recupera' ? 260 : 60, .1), 'redis.heat': jit(bad ? 140 : sl ? 480 : 3, .15),
      'users-db.heat': jit(bad ? 90 : 12, .2), 'sms.heat': jit(bad ? 600 : 180, .15),
      'e-web-gw': jit(bad ? 2600 : 1800, .08), 'e-app-gw': jit(bad ? 1900 : 1300, .08), 'e-gw-auth': jit(bad ? 4200 : 1700, .08), 'e-auth-redis': jit(bad ? 300 : sl ? 900 : 1600, .1),
      'e-auth-db': jit(bad ? 2400 : 300, .1), 'e-auth-sms': jit(bad ? 40 : 120, .2),
      'k-logins.value': Math.round(jit(bad ? 140 : sl ? 520 : p === 'recupera' ? 980 : 1240, .05)), 'k-error.value': r1(jit(bad ? 64 : sl ? 22 : p === 'recupera' ? 4 : .4, .1)),
      'auth.alert': bad ? 'crit' : sl ? 'warn' : '-', 'redis.alert': sl ? 'crit' : '-'
    };
    return [t, ...cols.slice(1).map(c => (typeof v[c] === 'number' ? (c === 'k-error.value' ? r1(v[c]) : Math.round(v[c])) : v[c]))].join('\t');
  });
  const tsv = [cols.join('\t'), ...rows].join('\n');
  const spec = {
    title: 'Postmortem: la caída del inicio de sesión del 2 de octubre',
    summary: 'Durante 34 minutos, el 70 % de los inicios de sesión falló. El recorrido cuenta qué pasó; la línea de tiempo, minuto a minuto, lo enseña.',
    lang: 'es', direction: 'right', initialDepth: 1,
    fx: { particles: true, heat: { label: 'Latencia p95', unit: 'ms', domain: [0, 2000], scheme: 'traffic' }, spotlight: true, glow: true, play: true },
    legend: { kinds: { ui: 'interfaz', mobile: 'app', route: 'pasarela', lock: 'identidad', cache: 'caché', datastore: 'base de datos', external: 'tercero', test: 'mejoras', user: 'usuarios', gauge: 'indicador' } },
    owners: { identidad: { label: 'Equipo Identidad', short: 'ID', contact: '#identity-oncall' }, plataforma: { label: 'Plataforma', short: 'PL', contact: '#platform' }, web: { label: 'Equipo Web', short: 'WB' } },
    lanes: [{ id: 'clientes', label: 'Clientes', owner: 'web' }, { id: 'borde', label: 'Borde', owner: 'plataforma' }, { id: 'identidad', label: 'Identidad', owner: 'identidad' }, { id: 'datos', label: 'Datos', owner: 'plataforma' }, { id: 'terceros', label: 'Terceros' }, { id: 'impacto', label: 'Impacto' }],
    nodes: [
      { id: 'web', lane: 'clientes', label: 'Web', kind: 'ui', summary: 'El formulario de inicio de sesión.' },
      { id: 'app', lane: 'clientes', label: 'App', kind: 'mobile', summary: 'iOS y Android.' },
      { id: 'gateway', lane: 'borde', label: 'API Gateway', kind: 'route', summary: 'Enruta /login al servicio de identidad.' },
      { id: 'auth', lane: 'identidad', label: 'Servicio de identidad', kind: 'lock', summary: 'Valida credenciales, crea la sesión y pide el segundo factor.',
        blocks: [{ type: 'callout', tone: 'crit', title: 'Causa raíz', text: 'La versión **5.4** quitó la caché de sesiones por error: cada login consultaba la base de datos y agotó el pool de conexiones.' },
          { type: 'timeline', title: 'Cronología', items: [{ time: '10:40', label: 'Se despliega auth 5.4', tone: 'info' }, { time: '10:42', label: 'Primeros errores 503 en /login', tone: 'crit' }, { time: '10:47', label: 'Salta la alerta; se avisa a la guardia', tone: 'warn' }, { time: '10:56', label: 'Rollback a la 5.3', tone: 'info' }, { time: '11:02', label: 'Redis se satura con la avalancha de reintentos', tone: 'crit' }, { time: '11:08', label: 'Failover de Redis a la réplica', tone: 'warn' }, { time: '11:16', label: 'La tasa de error baja del 5 %', tone: 'good' }] },
          { type: 'quote', text: 'El rollback arregló la causa, pero no la avalancha: los clientes reintentaban sin esperar.', by: 'Revisión del incidente' }] },
      { id: 'redis', lane: 'datos', label: 'Redis de sesiones', kind: 'cache', summary: 'Sesiones y límites de intentos.' },
      { id: 'users-db', lane: 'datos', label: 'Base de usuarios', kind: 'datastore', summary: 'PostgreSQL con las credenciales.',
        blocks: [{ type: 'chart', kind: 'area', title: 'Conexiones en uso', unit: 'conexiones', labels: T.filter((_, i) => i % 3 === 0), series: [{ label: 'en uso', values: T.filter((_, i) => i % 3 === 0).map((_, k) => [80, 400, 400, 390, 120, 90, 80, 75, 70][k] || 70) }, { label: 'máximo', values: T.filter((_, i) => i % 3 === 0).map(() => 400), color: '#cf222e' }] }] },
      { id: 'sms', lane: 'terceros', label: 'Proveedor de SMS', kind: 'external', summary: 'El segundo factor por SMS.' },
      { id: 'k-logins', lane: 'impacto', label: 'Inicios de sesión por minuto', shape: 'kpi', kind: 'user', value: 1240, summary: 'Logins correctos por minuto.' },
      { id: 'k-error', lane: 'impacto', label: 'Tasa de error', shape: 'gauge', kind: 'gauge', value: 0.4, min: 0, max: 100, unit: '%', decimals: 1, thresholds: [5, 20], summary: 'Porcentaje de intentos que fallan.' },
      { id: 'acciones', lane: 'impacto', label: 'Acciones del postmortem', kind: 'test', summary: 'Lo que se hace para que no vuelva a pasar.',
        blocks: [{ type: 'checklist', items: [{ text: 'Prueba de carga del login en la CI', done: true }, { text: 'Reintentos con espera exponencial en web y app', done: true }, { text: 'Alerta por pool de conexiones al 80 %', done: false }, { text: 'Canario automático para auth', done: false }] }, { type: 'stats', items: [{ label: 'Duración', value: 34, unit: 'min' }, { label: 'Logins fallidos', value: 41200 }, { label: 'Tickets', value: 312 }] }] }
    ],
    edges: [
      { id: 'e-web-gw', from: 'web', to: 'gateway', kind: 'http', rate: 1800 }, { id: 'e-app-gw', from: 'app', to: 'gateway', kind: 'http', rate: 1300 },
      { id: 'e-gw-auth', from: 'gateway', to: 'auth', kind: 'http', rate: 1700, emphasis: 'hero', label: 'POST /login' },
      { id: 'e-auth-redis', from: 'auth', to: 'redis', kind: 'data', rate: 1600, label: 'sesiones' }, { id: 'e-auth-db', from: 'auth', to: 'users-db', kind: 'data', rate: 300, label: 'credenciales' },
      { id: 'e-auth-sms', from: 'auth', to: 'sms', kind: 'http', rate: 120, label: '2FA' }
    ],
    timeline: { label: '2 de octubre · cada 2 minutos', data: tsv, step: 900, window: 12, start: 'start',
      events: [{ time: '10:40', label: 'Despliegue de auth 5.4', tone: 'info', nodes: ['auth'] }, { time: '10:42', label: 'Primeros 503 en /login', tone: 'crit', nodes: ['auth', 'gateway'] }, { time: '10:56', label: 'Rollback a la 5.3', tone: 'warn', nodes: ['auth'] }, { time: '11:02', label: 'Redis saturado por los reintentos', tone: 'crit', nodes: ['redis'] }, { time: '11:08', label: 'Failover de Redis', tone: 'warn', nodes: ['redis'] }, { time: '11:16', label: 'Error por debajo del 5 %', tone: 'good', nodes: ['auth'] }] },
    tour: { title: 'Qué pasó', steps: [
      { title: 'El camino de un login', body_html: '<p>La web y la app llaman a la pasarela, que manda cada <code>POST /login</code> al servicio de identidad. Este mira la sesión en Redis y las credenciales en la base de usuarios.</p>', focus: { nodes: ['web', 'app', 'gateway', 'auth'], edges: ['e-web-gw', 'e-app-gw', 'e-gw-auth'] } },
      { title: '10:42 · el pool se agota', body_html: '<p>La versión 5.4 dejó de usar la caché: cada login va a la base de datos y el pool de 400 conexiones se llena en dos minutos.</p>', focus: { nodes: ['auth', 'users-db'], edges: ['e-auth-db'] }, select: 'users-db' },
      { title: 'Hasta dónde llega', body_html: '<p>Pulsa <b>✺ Impacto</b> en el servicio de identidad: todo lo que necesita iniciar sesión cae con él.</p>', focus: { nodes: ['auth'] }, select: 'auth' },
      { title: '11:02 · la avalancha', body_html: '<p>Tras el rollback, los clientes reintentan sin esperar y saturan Redis. El failover a la réplica lo resuelve a las 11:08.</p>', focus: { nodes: ['auth', 'redis'], edges: ['e-auth-redis'] } },
      { title: 'Lo que cambia', body_html: '<p>Prueba de carga en la CI, reintentos con espera exponencial, alerta del pool y canario automático.</p>', focus: { nodes: ['acciones'] }, select: 'acciones' }
    ] }
  };
  write('postmortem.json', spec);
}

/* ---------- 3 · kubernetes: namespaces → deployments → pods ---------- */
{
  const pod = (dep, i, cpu, extra) => Object.assign({ id: `${dep}-${i}`, parent: dep, label: `${dep}-7f9c${i}`, kind: 'cpu', heat: cpu, summary: `Pod ${i + 1} de ${dep}.` }, extra || {});
  const dep = (id, ns, label, pods, extra) => [Object.assign({ id, lane: ns, label, kind: 'package', summary: `Deployment ${label}.` }, extra || {}), ...pods];
  const nodes = [
    ...dep('ingress', 'ns-ingress', 'ingress-nginx', [pod('ingress', 0, 34), pod('ingress', 1, 38)], { blocks: [{ type: 'kv', items: [['Réplicas', '2'], ['Imagen', '`nginx-ingress:1.11`'], ['Clase', 'nginx'], ['TLS', 'cert-manager']] }] }),
    ...dep('checkout', 'ns-tienda', 'checkout', [pod('checkout', 0, 62), pod('checkout', 1, 58), pod('checkout', 2, 71)], { progress: 0.66, subtitle: 'rollout 2/3',
      blocks: [{ type: 'steps', title: 'Rollout de la v3.9', items: [{ label: 'Pod 1 actualizado', state: 'done' }, { label: 'Pod 2 actualizado', state: 'done' }, { label: 'Pod 3 actualizando', state: 'active' }] },
        { type: 'code', lang: 'yaml', title: 'Recursos', code: 'resources:\n  requests: { cpu: 500m, memory: 512Mi }\n  limits:   { cpu: "1",  memory: 1Gi }\nstrategy:\n  rollingUpdate: { maxSurge: 1, maxUnavailable: 0 }' }] }),
    ...dep('catalogo', 'ns-tienda', 'catalogo', [pod('catalogo', 0, 22), pod('catalogo', 1, 25)]),
    ...dep('pagos', 'ns-pagos', 'pagos-api', [pod('pagos', 0, 48), pod('pagos', 1, 92, { alert: 'crit', summary: 'CrashLoopBackOff: 14 reinicios en la última hora (OOMKilled).' })], { alert: 'warn',
      blocks: [{ type: 'callout', tone: 'crit', title: 'Un pod en CrashLoopBackOff', text: 'El pod 2 se queda sin memoria (OOMKilled) al procesar lotes grandes.' }, { type: 'bars', title: 'Reinicios por pod (24 h)', items: [{ label: 'pagos-7f9c0', value: 0 }, { label: 'pagos-7f9c1', value: 14 }] }] }),
    ...dep('prometheus', 'ns-obs', 'prometheus', [pod('prometheus', 0, 44)]),
    ...dep('grafana', 'ns-obs', 'grafana', [pod('grafana', 0, 12)]),
    { id: 'k-cpu', lane: 'ns-capacidad', label: 'CPU del clúster', shape: 'gauge', kind: 'cpu', value: 64, unit: '%', thresholds: [70, 85], summary: 'Uso medio de CPU de los 6 nodos.' },
    { id: 'k-pods', lane: 'ns-capacidad', label: 'Pods por estado', shape: 'donut', kind: 'package', parts: [{ label: 'Running', value: 41 }, { label: 'Pending', value: 3 }, { label: 'CrashLoop', value: 1, color: '#cf222e' }], summary: 'Estado de los pods del clúster.' },
    { id: 'k-restarts', lane: 'ns-capacidad', label: 'Reinicios por hora', shape: 'kpi', kind: 'bug', value: 14, change: 250, good: 'down', spark: [1, 0, 2, 1, 3, 6, 9, 14], summary: 'Reinicios de contenedores en la última hora.' }
  ];
  const spec = {
    title: 'Clúster de producción',
    summary: 'Namespaces, deployments y pods. El calor es el uso de CPU de cada pod; un contenedor plegado enseña el máximo de los suyos. Abre el nivel «Pod» para verlos.',
    lang: 'es', direction: 'right', initialDepth: 1,
    levels: [{ depth: 0, label: 'Namespace' }, { depth: 1, label: 'Deployment' }, { depth: 2, label: 'Pod' }],
    fx: { heat: { label: 'CPU', unit: '%', domain: [0, 100], scheme: 'traffic' }, particles: true, glow: true, spotlight: true },
    owners: { plataforma: { label: 'Plataforma', short: 'PL', contact: '#platform' }, tienda: { label: 'Equipo Tienda', short: 'TI' }, pagos: { label: 'Equipo Pagos', short: 'PG' } },
    lanes: [{ id: 'ns-ingress', label: 'ingress', subtitle: 'namespace', owner: 'plataforma' }, { id: 'ns-tienda', label: 'tienda', subtitle: 'namespace', owner: 'tienda' }, { id: 'ns-pagos', label: 'pagos', subtitle: 'namespace', owner: 'pagos' }, { id: 'ns-obs', label: 'observabilidad', subtitle: 'namespace', owner: 'plataforma' }, { id: 'ns-capacidad', label: 'capacidad', subtitle: 'el clúster' }],
    nodes,
    edges: [
      { id: 'k1', from: 'ingress', to: 'checkout', kind: 'http', rate: 900 }, { id: 'k2', from: 'ingress', to: 'catalogo', kind: 'http', rate: 1600 },
      { id: 'k3', from: 'checkout', to: 'pagos', kind: 'rpc', rate: 300, emphasis: 'hero' }, { id: 'k4', from: 'prometheus', to: 'checkout', kind: 'http', rate: 40, label: 'scrape' },
      { id: 'k5', from: 'prometheus', to: 'pagos', kind: 'http', rate: 40 }, { id: 'k6', from: 'grafana', to: 'prometheus', kind: 'http', rate: 20 }
    ]
  };
  write('kubernetes.json', spec);
}
console.log('✓ pipeline-datos.json · postmortem.json · kubernetes.json');
