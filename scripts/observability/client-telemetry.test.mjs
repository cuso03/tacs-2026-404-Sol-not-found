import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { createClientTelemetry, clientOutcome } from './client-telemetry.mjs';
import { runLoad } from './load.mjs';

const requireBackend = createRequire(new URL('../../backend/package.json', import.meta.url));
const { InMemoryMetricExporter, PeriodicExportingMetricReader, AggregationTemporality } = requireBackend('@opentelemetry/sdk-metrics');

test('a deadline failure is distinct from HTTP, validation, network and cancellation failures', () => {
  assert.equal(clientOutcome({ ok: true }), 'success');
  assert.equal(clientOutcome({ ok: false, status: 0, failure: 'timeout' }), 'timeout');
  // A timeout while reading a body can have already received HTTP 200 headers.
  assert.equal(clientOutcome({ ok: false, status: 200, failure: 'timeout' }), 'timeout');
  assert.equal(clientOutcome({ ok: false, status: 503, failure: 'http_error' }), 'http_error');
  assert.equal(clientOutcome({ ok: false, status: 200, failure: 'unexpected_response' }), 'invalid_response');
  assert.equal(clientOutcome({ ok: false, status: 0, failure: 'network_or_abort' }), 'network_error');
  assert.equal(clientOutcome({ ok: false, status: 0, failure: 'aborted' }), 'aborted');
});

test('real client deadline failures increment OTel timeout counters and duration histogram', async () => {
  const exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
  const reader = new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 60_000 });
  const telemetry = createClientTelemetry({ targetService: 'sol-backend-pruebas', reader });
  const attributes = { users: 1, phase: 'load' };
  telemetry.prepare(attributes);
  const server = createServer((_req, res) => setTimeout(() => {
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ data: [{}], meta: { total: 1 } }));
  }, 200));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const load = await runLoad({ url: `http://127.0.0.1:${server.address().port}`, users: 1, durationSeconds: 0.15, pauseMs: 0, requestTimeoutMs: 30, signal: new AbortController().signal, onSample: sample => telemetry.record(sample, attributes) });
    assert.ok(load.errors > 0);
    assert.ok(load.samples.every(sample => sample.failure === 'timeout'));
    await telemetry.forceFlush();
    const metrics = exporter.getMetrics().flatMap(r => r.scopeMetrics.flatMap(s => s.metrics));
    const counter = metrics.find(m => m.descriptor.name === 'load.http.requests');
    const timeout = counter.dataPoints.find(p => p.attributes.outcome === 'timeout');
    assert.equal(timeout.value, load.errors);
    assert.equal(counter.dataPoints.find(p => p.attributes.outcome === 'success').value, 0);
    const histogram = metrics.find(m => m.descriptor.name === 'load.http.duration');
    assert.equal(histogram.dataPoints[0].value.count, load.requests);
    assert.ok(histogram.dataPoints[0].value.sum > 0);
    assert.ok(metrics.every(m => m.dataPoints.every(p => !('traceId' in p.attributes))));
  } finally {
    await telemetry.shutdown();
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
});
