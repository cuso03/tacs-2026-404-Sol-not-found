import request from 'supertest';
import { afterAll, expect, it, vi } from 'vitest';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { InMemoryMetricExporter, PeriodicExportingMetricReader, AggregationTemporality } from '@opentelemetry/sdk-metrics';

const exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
const reader = new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 60_000 });
const spans: { name: string; status: { code: number }; attributes: object }[] = [];
const sdk = new NodeSDK({
  metricReader: reader,
  traceExporter: {
    export(batch, callback) { spans.push(...batch); callback({ code: 0 }); },
    shutdown: async () => {},
  },
});
sdk.start();
afterAll(async () => { vi.restoreAllMocks(); await sdk.shutdown(); });

it('separates HTTP outcomes from completed searches and exports bounded attributes', async () => {
  // As in production, initialize the SDK before creating instruments.
  const { createApp } = await import('../src/app');
  const { ActividadMongoRepository } = await import('../src/repositories/actividadMongoRepository');
  const app = createApp();
  expect((await request(app).get('/api/actividades?ubicacion=private-location')).status).toBe(200);
  expect((await request(app).get('/api/actividades?limit=0')).status).toBe(400);
  vi.spyOn(ActividadMongoRepository.prototype, 'findAll').mockRejectedValueOnce(new Error('private-database-detail'));
  expect((await request(app).get('/api/actividades')).status).toBe(500);

  await reader.forceFlush();
  const metrics = exporter.getMetrics().flatMap(r => r.scopeMetrics.flatMap(s => s.metrics));
  const counter = (name: string) => metrics.find(m => m.descriptor.name === name)!;
  expect(counter('search.completed').dataPoints.map(p => p.value)).toEqual([1]);
  expect(counter('search.http.requests').dataPoints.map(p => p.value).sort()).toEqual([1, 2]);
  expect(counter('search.db.duration').dataPoints).toHaveLength(2);
  expect(JSON.stringify(metrics)).not.toContain('private-location');
  expect(JSON.stringify(metrics)).not.toContain('private-database-detail');
  await sdk.shutdown();
  expect(spans.filter(s => s.name === 'actividades.buscar')).toHaveLength(2);
  expect(spans.some(s => s.name === 'actividades.buscar' && s.status.code === 2)).toBe(true);
  expect(JSON.stringify(spans.map(s => s.attributes))).not.toContain('private-database-detail');
});
