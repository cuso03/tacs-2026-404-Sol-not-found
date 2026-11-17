import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import { parse as parseEnv } from 'dotenv';
import { runLoad } from './load.mjs';
import { startBrowserServer, probeBrowser } from './browser.mjs';
import { writeReport } from './report.mjs';
import { createClientTelemetry } from './client-telemetry.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const { values } = parseArgs({ options: {
  quick: { type: 'boolean', default: false }, headed: { type: 'boolean', default: false },
  users: { type: 'string' }, duration: { type: 'string' }, warmup: { type: 'string' },
  data: { type: 'string' }, pause: { type: 'string', default: '250' },
  'skip-start': { type: 'boolean', default: false },
  help: { type: 'boolean', default: false },
} });
if (values.help) {
  console.log('npm run observability:run -- [--headed] [--quick] [--users 2,10,30] [--duration 120] [--warmup 30] [--data 2000] [--pause 250] [--skip-start]');
  process.exit(0);
}
const integer = (value, min, max, name) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw Error(`${name} debe ser entero entre ${min} y ${max}`);
  return n;
};
const config = {
  users: (values.users ?? (values.quick ? '1,3' : '2,10,30')).split(',').map(v => integer(v, 1, 100, 'users')),
  durationSeconds: integer(values.duration ?? (values.quick ? 8 : 120), 5, 3600, 'duration'),
  warmupSeconds: integer(values.warmup ?? (values.quick ? 3 : 30), 1, 600, 'warmup'),
  count: integer(values.data ?? (values.quick ? 60 : 2000), 12, 100_000, 'data'),
  pauseMs: integer(values.pause, 0, 60_000, 'pause'),
  backendPort: 3002, browserPort: 5180, telemetryDrainSeconds: 15,
};
if (config.users.length < 2 || config.users.some((n, i) => i && n <= config.users[i - 1])) throw Error('Usá al menos dos niveles de usuarios, en orden creciente.');
const backendUrl = `http://127.0.0.1:${config.backendPort}`;
const browserUrl = `http://127.0.0.1:${config.browserPort}/__observability.html`;
const collectorUrl = 'http://127.0.0.1:4318';
const prometheusUrl = 'http://127.0.0.1:9090';
const jaegerUrl = 'http://127.0.0.1:16686';
const grafanaUrl = 'http://127.0.0.1:3001';
const service = 'sol-backend-pruebas';
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const directory = path.join(root, 'observability-results', runId);
await mkdir(directory, { recursive: true });
const controller = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { console.log('\nInterrumpiendo y guardando resultados parciales…'); controller.abort(); });
const report = { runId, quick: values.quick, status: 'running', config, machine: {
  platform: `${os.platform()} ${os.release()}`, cpus: os.cpus().length,
  cpuModel: os.cpus()[0]?.model, totalMemoryGiB: os.totalmem() / 1024 ** 3, node: process.version,
}, scenarios: [], browser: [], traces: [] };
const children = [], logs = [];
let browser, server, connection, clientTelemetry, databaseCreated = false;

async function command(executable, args, options = {}) {
  const child = spawn(executable, args, { cwd: root, stdio: 'inherit', ...options });
  const [code] = await once(child, 'exit');
  if (code !== 0) throw Error(`${executable} ${args.join(' ')} terminó con código ${code}`);
}
async function capture(executable, args) {
  const child = spawn(executable, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '', errors = '';
  child.stdout.on('data', b => output += b); child.stderr.on('data', b => errors += b);
  const [code] = await once(child, 'exit');
  if (code !== 0) throw Error(`${executable}: ${errors}`);
  return output;
}
async function json(url) {
  const r = await fetch(url, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]) });
  if (!r.ok) throw Error(`HTTP ${r.status}: ${new URL(url).pathname}`);
  return r.json();
}
async function until(check, description, seconds = 40) {
  let last;
  for (let i = 0; i < seconds; i++) {
    controller.signal.throwIfAborted();
    try { const result = await check(); if (result) return result; } catch (e) { last = e; }
    await sleep(1000, undefined, { signal: controller.signal });
  }
  throw Error(`No se pudo verificar ${description}: ${last?.message ?? 'tiempo agotado'}`);
}
async function ensureFree(port) {
  const socket = net.createServer();
  await new Promise((resolve, reject) => { socket.once('error', () => reject(Error(`El puerto de pruebas ${port} está ocupado. Cerrá otra ejecución del runner.`))); socket.listen(port, '127.0.0.1', resolve); });
  await new Promise(resolve => socket.close(resolve));
}
async function delay(seconds) { await sleep(seconds * 1000, undefined, { signal: controller.signal }); }
const queries = {
  requestsPerSecond: `sum(rate(search_http_requests_total{service_name="${service}"}[1m]))`,
  errorPercent: `100 * sum(rate(search_http_requests_total{service_name="${service}",outcome="error"}[1m])) / sum(rate(search_http_requests_total{service_name="${service}"}[1m]))`,
  httpP95Seconds: `histogram_quantile(0.95, sum by (le) (rate(search_http_duration_seconds_bucket{service_name="${service}"}[1m])))`,
  completedPerSecond: `sum(rate(search_completed_total{service_name="${service}"}[1m]))`,
  dbP95Seconds: `histogram_quantile(0.95, sum by (le,operation) (rate(search_db_duration_seconds_bucket{service_name="${service}"}[1m])))`,
  clientErrorPercent: `100 * sum(rate(load_http_requests_total{target_service_name="${service}",phase="load",outcome!="success"}[1m])) / sum(rate(load_http_requests_total{target_service_name="${service}",phase="load"}[1m]))`,
  clientTimeoutsPerSecond: `sum(rate(load_http_requests_total{target_service_name="${service}",phase="load",outcome="timeout"}[1m]))`,
  clientP95Seconds: `histogram_quantile(0.95, sum by (le) (rate(load_http_duration_seconds_bucket{target_service_name="${service}",phase="load"}[1m])))`,
};
async function saveMetrics(stage) {
  const raw = {};
  for (const [name, query] of Object.entries(queries)) raw[name] = await json(`${prometheusUrl}/api/v1/query_range?${new URLSearchParams({ query, start: String(stage.start / 1000), end: String(stage.observationEnd / 1000), step: '5' })}`);
  await writeFile(path.join(directory, `${stage.name}-prometheus.json`), JSON.stringify({ queries, start: stage.start, end: stage.observationEnd, raw }, null, 2));
  return Object.values(raw).every(r => r.data?.result?.some(series => series.values?.some(([, value]) => Number.isFinite(Number(value)))));
}
async function verifyTrace(id, label, { frontend = false, error = false } = {}) {
  const url = `${jaegerUrl}/trace/${id}`;
  const result = { id, label, url, verified: false };
  try {
    const trace = await until(async () => {
      const t = (await json(`${jaegerUrl}/api/traces/${id}`)).data?.[0];
      if (!t) return null;
      const names = t.spans.map(s => s.operationName);
      const services = Object.values(t.processes).map(p => p.serviceName);
      if (!services.includes(service)) return null;
      if (frontend && !services.includes('sol-frontend-pruebas')) return null;
      if (error) {
        if (!t.spans.some(s => s.tags.some(tag => tag.key === 'error' && tag.value === true))) return null;
      } else if (!['actividades.buscar', 'actividades.db.count', 'actividades.db.find'].every(n => names.includes(n))) return null;
      const ids = new Set(t.spans.map(s => s.spanID));
      if (frontend && !t.spans.every(s => s.references.every(ref => ids.has(ref.spanID)))) return null;
      return t;
    }, `traza ${id}`, 20);
    result.verified = true; result.spans = trace.spans.length;
    result.databaseMs = trace.spans.filter(s => s.operationName.startsWith('actividades.db.')).reduce((sum, s) => sum + s.duration / 1000, 0);
    result.businessMs = trace.spans.find(s => s.operationName === 'actividades.buscar')?.duration / 1000 || null;
    await writeFile(path.join(directory, `trace-${id}.json`), JSON.stringify(trace, null, 2));
  } catch (e) { result.error = e.message; }
  report.traces.push(result);
  return result.verified;
}
async function saveDashboard(stage) {
  const page = await browser.newPage({ viewport: { width: 1500, height: 2000 } });
  try {
    await page.goto(stage.grafanaUrl, { waitUntil: 'domcontentloaded' });
    await page.getByText('Solicitudes por segundo', { exact: true }).first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(directory, `${stage.name}-grafana.png`), fullPage: true });
  } finally { await page.close(); }
}
try {
  console.log(`\nResultados: ${directory}\nModo: ${values.quick ? 'verificación corta' : 'experimento completo'}; niveles: ${config.users.join(', ')}; ${config.durationSeconds}s por nivel.\n`);
  await ensureFree(config.backendPort); await ensureFree(config.browserPort);
  if (!values['skip-start']) await command('docker', ['compose', 'up', '-d', 'mongo', 'rabbitmq', 'redis', 'otel-collector', 'prometheus', 'grafana', 'jaeger']);
  await until(() => json(`${grafanaUrl}/api/health`), 'Grafana');
  await until(() => json(`${jaegerUrl}/api/services`), 'Jaeger');
  const requireBackend = createRequire(path.join(root, 'backend/package.json'));
  const mongoose = requireBackend('mongoose');
  const readEnv = async p => existsSync(p) ? parseEnv(await readFile(p)) : {};
  const env = { ...await readEnv(path.join(root, 'backend/.env')), ...await readEnv(path.join(root, '.env')), ...process.env };
  const mongo = new URL(process.env.OBS_MONGODB_URI ?? `mongodb://${encodeURIComponent(env.MONGO_USER || 'root')}:${encodeURIComponent(env.MONGO_PASSWORD || 'root')}@127.0.0.1:27018/solnotfound?authSource=admin`);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(mongo.hostname)) throw Error('El experimento solo admite MongoDB local.');
  mongo.pathname = `/sol_observability_${runId.replace(/\W/g, '_')}`;
  connection = await mongoose.createConnection(mongo.href, { serverSelectionTimeoutMS: 15_000 }).asPromise();
  console.log(`[Datos] Creando ${config.count} actividades en una base exclusiva del experimento…`);
  const date = new Date(Date.now() + 7 * 86400_000).toISOString();
  const docs = Array.from({ length: config.count }, (_, i) => ({
    titulo: `Observabilidad ${String(i).padStart(5, '0')}`, descripcion: 'Actividad sintética del experimento local.',
    tipo: ['aire_libre', 'techada', 'mixta'][i % 3],
    ubicacion: { tipo: 'ciudad', ciudad: i % 2 ? 'Cordoba' : 'Buenos Aires', pais: 'AR' },
    fecha_horario: date, min_participantes: 2, max_participantes: 20,
    creadorId: 'observability-synthetic', creadaEn: new Date(0).toISOString(), estado: 'PROPUESTA',
    participantes: ['observability-synthetic'], votaciones: [],
  }));
  report.dataset = { count: docs.length, sha256: createHash('sha256').update(JSON.stringify(docs)).digest('hex'), activityDate: date };
  databaseCreated = true;
  await connection.collection('actividades').insertMany(docs);
  // Same indexes that the real Mongoose schema creates.
  await connection.collection('actividades').createIndex({ tipo: 1, fecha_horario: 1 });
  await connection.collection('actividades').createIndex({ creadorId: 1 });
  await connection.collection('actividades').createIndex({ participantes: 1 });
  const log = createWriteStream(path.join(directory, 'backend.log')); logs.push(log);
  const backend = spawn(process.execPath, [requireBackend.resolve('tsx/cli'), '--require', './src/observability/register.cjs', 'src/app.ts'], {
    cwd: path.join(root, 'backend'), detached: true,
    env: { ...process.env, NODE_ENV: 'test', PORT: String(config.backendPort), MONGODB_URI: mongo.href,
      OTEL_ENABLED: 'true', OTEL_SERVICE_NAME: service, OTEL_EXPORTER_OTLP_ENDPOINT: collectorUrl,
      OTEL_TRACES_SAMPLER: 'parentbased_always_on', CORS_ORIGINS: `http://127.0.0.1:${config.browserPort}` },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(backend); backend.stdout.pipe(log); backend.stderr.pipe(log);
  await until(async () => {
    if (backend.exitCode != null) throw Error('El backend terminó; revisar backend.log');
    return (await json(`${backendUrl}/api/actividades?limit=9`)).meta.total === config.count;
  }, 'backend aislado');
  server = await startBrowserServer({ root, port: config.browserPort, backendUrl, collectorUrl });
  if (!existsSync(process.env.OBS_CHROMIUM_PATH || chromium.executablePath())) {
    console.log('[Navegador] Instalando Chromium para Playwright…');
    await command(process.execPath, [fileURLToPath(new URL('../../node_modules/playwright/cli.js', import.meta.url)), 'install', 'chromium']);
  }
  browser = await chromium.launch({ headless: !values.headed, ...(process.env.OBS_CHROMIUM_PATH ? { executablePath: process.env.OBS_CHROMIUM_PATH } : {}) });
  report.machine.browser = browser.version();
  const ids = (await capture('docker', ['compose', 'ps', '-q'])).trim().split(/\s+/).filter(Boolean);
  const inspect = ids.length ? JSON.parse(await capture('docker', ['inspect', ...ids])) : [];
  const containers = inspect.map(c => ({ name: c.Name, image: c.Config.Image, memoryLimitBytes: c.HostConfig.Memory, nanoCpus: c.HostConfig.NanoCpus, cpuQuota: c.HostConfig.CpuQuota, cpuPeriod: c.HostConfig.CpuPeriod, cpuset: c.HostConfig.CpusetCpus }));
  await writeFile(path.join(directory, 'environment.json'), JSON.stringify({ machine: report.machine, config, dataset: report.dataset, containers, mongoHost: mongo.host, mongoCompatibilityOption: env.MONGO_GLIBC_TUNABLES || null, sampling: '1/10 HTTP load; all browser requests' }, null, 2));
  console.log('[Frontend] Probando resultados y filtros en Chromium…');
  const valid = await probeBrowser({ browser, url: browserUrl, name: 'frontend-correcto', directory }); report.browser.push(valid);
  if (!valid.ok) throw Error(`Prueba del frontend fallida: ${valid.error}`);
  if (!await verifyTrace(valid.traceIds.at(-1), 'Frontend correcto', { frontend: true })) throw Error('No llegó la traza completa del frontend.');
  console.log('[Frontend] Probando error real HTTP 400 y su presentación…');
  const invalid = await probeBrowser({ browser, url: browserUrl, name: 'frontend-error', directory, fail: true }); report.browser.push(invalid);
  if (!invalid.ok || !await verifyTrace(invalid.traceIds.at(-1), 'Frontend con error de validación', { frontend: true, error: true })) throw Error('No se verificó el recorrido fallido.');
  console.log(`[Calentamiento] 1 usuario durante ${config.warmupSeconds}s…`);
  clientTelemetry = createClientTelemetry({ collectorUrl, targetService: service });
  clientTelemetry.prepare({ users: 1, phase: 'warmup' });
  // Pre-export zero counters for all configured levels before their first samples.
  for (const users of config.users) clientTelemetry.prepare({ users, phase: 'load' });
  await clientTelemetry.forceFlush();
  await runLoad({ url: `${backendUrl}/api/actividades?limit=9&tipo=aire_libre`, users: 1, durationSeconds: config.warmupSeconds, pauseMs: config.pauseMs, signal: controller.signal, onSample: sample => clientTelemetry.record(sample, { users: 1, phase: 'warmup' }) });
  await delay(config.telemetryDrainSeconds);
  for (const [index, users] of config.users.entries()) {
    controller.signal.throwIfAborted();
    const name = `escenario-${index + 1}-${users}-usuarios`;
    console.log(`\n[${name}] ${users} usuarios durante ${config.durationSeconds}s. Abriendo también el frontend…`);
    const probe = probeBrowser({ browser, url: browserUrl, name, directory });
    const load = await runLoad({ url: `${backendUrl}/api/actividades?limit=9&tipo=aire_libre`, users, durationSeconds: config.durationSeconds, pauseMs: config.pauseMs, signal: controller.signal, onSample: sample => clientTelemetry.record(sample, { users, phase: 'load' }), onProgress: count => console.log(`  ${count} solicitudes completadas…`) });
    await clientTelemetry.forceFlush();
    const ui = await probe; report.browser.push(ui);
    const { samples, ...stage } = load;
    stage.name = name; stage.browser = ui;
    stage.representativeTraceIds = samples.filter(s => s.traceId).sort((a, b) => b.durationMs - a.durationMs).slice(0, 2).map(s => s.traceId);
    report.scenarios.push(stage);
    await writeFile(path.join(directory, `${name}-requests.json`), JSON.stringify(samples));
    console.log(`  ${stage.requests} solicitudes; ${stage.requestsPerSecond.toFixed(1)} req/s; p95 ${stage.p95Ms?.toFixed(1)} ms; errores ${stage.errorPercent?.toFixed(1)}%.`);
    console.log('  Esperando exportación y recolección de telemetría…');
    await delay(config.telemetryDrainSeconds);
    stage.observationEnd = Date.now();
    stage.grafanaUrl = `${grafanaUrl}/d/sol-search?${new URLSearchParams({ from: String(stage.start), to: String(stage.observationEnd), 'var-service': service })}`;
    stage.metricsVerified = await saveMetrics(stage);
    for (const id of stage.representativeTraceIds) await verifyTrace(id, `${name}: solicitud lenta muestreada`);
    if (ui.ok) await verifyTrace(ui.traceIds.at(-1), `${name}: frontend durante carga`, { frontend: true });
    await saveDashboard(stage);
    await writeReport(directory, report);
    if (!ui.ok) throw Error(`La pantalla falló durante ${name}: ${ui.error}`);
  }
  report.status = report.scenarios.every(s => s.metricsVerified) && report.traces.every(t => t.verified) ? 'completed' : 'completed-with-missing-telemetry';
  if (report.status !== 'completed') process.exitCode = 1;
} catch (error) {
  report.status = controller.signal.aborted ? 'interrupted' : 'failed';
  report.error = error.message.replace(/mongodb(?:\+srv)?:\/\/[^\s]+/g, '[MongoDB URI]');
  console.error(`\n${report.error}`); process.exitCode = 1;
} finally {
  await clientTelemetry?.shutdown().catch(error => console.error('No se pudo completar la exportación de métricas del cliente:', error.message));
  await browser?.close().catch(() => {});
  await server?.close().catch(() => {});
  for (const child of children) {
    if (child.exitCode === null) {
      try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already exited */ }
      await Promise.race([once(child, 'exit'), sleep(5000)]);
      if (child.exitCode === null) { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already exited */ } }
    }
  }
  for (const log of logs) log.end();
  if (connection) {
    if (databaseCreated) await connection.dropDatabase().catch(() => {});
    await connection.close().catch(() => {});
  }
  const csv = ['scenario,timestamp,user,duration_ms,status,ok,failure,trace_id'];
  for (const stage of report.scenarios) {
    const samples = JSON.parse(await readFile(path.join(directory, `${stage.name}-requests.json`), 'utf8'));
    for (const s of samples) csv.push([stage.name, s.timestamp, s.user, s.durationMs.toFixed(3), s.status, s.ok, s.failure ?? '', s.traceId ?? ''].join(','));
  }
  await writeFile(path.join(directory, 'requests.csv'), csv.join('\n') + '\n');
  await writeReport(directory, report);
  await writeFile(path.join(root, 'observability-results/latest.json'), JSON.stringify({ directory, report: path.join(directory, 'report.html'), status: report.status }, null, 2));
  console.log(`\nEstado: ${report.status}\nAbrí el reporte: ${path.join(directory, 'report.html')}\nLa base sintética y los procesos de prueba se limpian; la aplicación habitual y la infraestructura permanecen disponibles.`);
}
