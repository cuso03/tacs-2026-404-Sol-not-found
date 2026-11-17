// Preload before Express/MongoDB: automatic instrumentation must patch modules first.
require('dotenv/config');

if (process.env.OTEL_ENABLED === 'true') {
  const { NodeSDK } = require('@opentelemetry/sdk-node');
  const { resourceFromAttributes } = require('@opentelemetry/resources');
  const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
  const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');
  const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
  const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
  const sdk = new NodeSDK({
    autoDetectResources: false,
    resource: resourceFromAttributes({ 'service.name': process.env.OTEL_SERVICE_NAME || 'sol-backend' }),
    traceExporter: new OTLPTraceExporter(),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter(), exportIntervalMillis: 5000,
    }),
    instrumentations: [
      new HttpInstrumentation({
        ignoreIncomingRequestHook: (req) => req.method !== 'GET' || req.url?.split('?')[0].replace(/\/$/, '') !== '/api/actividades',
        ignoreOutgoingRequestHook: () => true,
        // Do not export free-text filters or credentials from the request URL.
        requestHook: (span) => {
          span.setAttribute('http.url', '/api/actividades');
          span.setAttribute('url.full', '/api/actividades');
          span.setAttribute('http.target', '/api/actividades');
        },
      }),
    ],
  });
  sdk.start();
  process.once('SIGTERM', () => sdk.shutdown().finally(() => process.exit(0)));
  process.once('SIGINT', () => sdk.shutdown().finally(() => process.exit(0)));
}
