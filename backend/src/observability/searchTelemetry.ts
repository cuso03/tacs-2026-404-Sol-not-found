import { metrics, trace, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import type { RequestHandler } from 'express';

const meter = metrics.getMeter('sol-search');
const tracer = trace.getTracer('sol-search');
const requests = meter.createCounter('search.http.requests', { unit: '{request}' });
const seconds = { unit: 's', advice: { explicitBucketBoundaries: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 15, 20, 30, 60] } };
const duration = meter.createHistogram('search.http.duration', seconds);
const completed = meter.createCounter('search.completed', { unit: '{search}' });
const dbDuration = meter.createHistogram('search.db.duration', seconds);

/** Applied only to GET /api/actividades, including rejected filters and 5xx. */
export const searchHttpMetrics: RequestHandler = (_req, res, next) => {
  const start = performance.now();
  const span = trace.getActiveSpan();
  res.once('finish', () => {
    const attributes = {
      'http.request.method': 'GET', 'http.route': '/api/actividades',
      outcome: res.statusCode < 400 ? 'success' : 'error',
    };
    requests.add(1, attributes);
    duration.record((performance.now() - start) / 1000, attributes);
    if (res.statusCode >= 400) {
      span?.setStatus({ code: SpanStatusCode.ERROR });
      span?.setAttribute('error.type', res.statusCode < 500 ? 'validation' : 'internal');
    }
  });
  next();
};

export async function traceSearch<T>(operation: () => Promise<T>): Promise<T> {
  return tracer.startActiveSpan('actividades.buscar', async (span) => {
    try {
      const result = await operation();
      completed.add(1, { operation: 'search' });
      return result;
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.setAttribute('error.type', 'search_failed');
      // Avoid exception messages containing filters, database URLs or credentials.
      throw error;
    } finally {
      span.end();
    }
  });
}

/** Timer includes the complete awaited driver operation, including failures. */
export async function traceSearchDb<T>(operation: 'count' | 'find', query: () => Promise<T>): Promise<T> {
  return tracer.startActiveSpan(`actividades.db.${operation}`, { kind: SpanKind.CLIENT, attributes: {
    'db.system.name': 'mongodb', 'db.collection.name': 'actividades', 'db.operation.name': operation,
  } }, async (span) => {
    const start = performance.now();
    let outcome = 'success';
    try {
      return await query();
    } catch (error) {
      outcome = 'error';
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.setAttribute('error.type', 'database_failed');
      throw error;
    } finally {
      dbDuration.record((performance.now() - start) / 1000, { operation, outcome });
      span.end();
    }
  });
}
