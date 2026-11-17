import { createRequire } from 'node:module';

// Reuse the project's pinned OpenTelemetry SDK; do not install another SDK version.
const requireBackend = createRequire(new URL('../../backend/package.json', import.meta.url));
const { MeterProvider, PeriodicExportingMetricReader } = requireBackend('@opentelemetry/sdk-metrics');
const { resourceFromAttributes } = requireBackend('@opentelemetry/resources');
const { OTLPMetricExporter } = requireBackend('@opentelemetry/exporter-metrics-otlp-http');

export const outcomes = ['success', 'timeout', 'http_error', 'invalid_response', 'network_error', 'aborted'];

export function clientOutcome(sample) {
  if (sample.ok) return 'success';
  if (sample.failure === 'timeout') return 'timeout';
  if (sample.failure === 'aborted') return 'aborted';
  if (sample.status && sample.status !== 200) return 'http_error';
  if (sample.failure === 'unexpected_response') return 'invalid_response';
  return 'network_error';
}

export function createClientTelemetry({ collectorUrl, targetService, reader } = {}) {
  const provider = new MeterProvider({
    resource: resourceFromAttributes({
      'service.name': 'sol-load-generator', 'target.service.name': targetService,
    }),
    readers: [reader ?? new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: new URL('/v1/metrics', collectorUrl).href }),
      exportIntervalMillis: 5000,
    })],
  });
  const meter = provider.getMeter('sol-load-client');
  const requests = meter.createCounter('load.http.requests', { unit: '{request}', description: 'Completed client attempts, including timeouts and response validation failures.' });
  const duration = meter.createHistogram('load.http.duration', {
    unit: 's', advice: { explicitBucketBoundaries: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 15, 20, 30, 60] },
  });
  return {
    prepare({ users, phase }) {
      // Zero series means "observed zero"; an absent generator remains No data.
      for (const outcome of outcomes) requests.add(0, { users, phase, outcome });
    },
    record(sample, { users, phase }) {
      const attributes = { users, phase, outcome: clientOutcome(sample) };
      requests.add(1, attributes);
      duration.record(sample.durationMs / 1000, attributes);
    },
    forceFlush: () => provider.forceFlush(),
    shutdown: () => provider.shutdown(),
  };
}
