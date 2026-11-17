import axios from 'axios';
import { context, trace, SpanStatusCode } from '@opentelemetry/api';
import { WebTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-web';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request';
import api from './api';
import type { Actividad, PaginatedResponse } from '../types/api';

let initialized = false;

function initialize() {
  if (initialized) return;
  const base = new URL(api.defaults.baseURL ?? '/api', window.location.origin);
  const searchUrl = `${base.href.replace(/\/$/, '')}/actividades`;
  const escaped = searchUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const relative = new URL(searchUrl).pathname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const searchPattern = new RegExp(`^${escaped}/?(?:\\?.*)?$`);
  const provider = new WebTracerProvider({
    resource: resourceFromAttributes({ 'service.name': import.meta.env.VITE_OTEL_SERVICE_NAME || 'sol-frontend' }),
    spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({
      url: new URL(import.meta.env.VITE_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://localhost:4318/v1/traces', window.location.origin).href,
    }))],
  });
  provider.register();
  registerInstrumentations({
    tracerProvider: provider,
    instrumentations: [new XMLHttpRequestInstrumentation({
      ignoreUrls: [new RegExp(`^(?!(?:${escaped}|${relative})/?(?:\\?|$))`)],
      propagateTraceHeaderCorsUrls: [searchPattern],
      clearTimingResources: true,
      applyCustomAttributesOnSpan: (span, xhr) => {
        // Keep the route, never free-text location filters or query strings.
        span.setAttribute('http.url', searchUrl);
        span.setAttribute('url.full', searchUrl);
        if (xhr.status === 0 || xhr.status >= 400) span.setStatus({ code: SpanStatusCode.ERROR });
      },
    })],
  });
  initialized = true;
}

/** A business span ends when parsed results are ready for React Query. */
export async function tracedSearch(params: Record<string, string | number>): Promise<PaginatedResponse<Actividad>> {
  if (import.meta.env.VITE_OTEL_ENABLED !== 'true') {
    return (await api.get<PaginatedResponse<Actividad>>('/actividades', { params })).data;
  }
  initialize();
  const span = trace.getTracer('sol-search-ui').startSpan('actividades.buscar.ui');
  const parent = trace.setSpan(context.active(), span);
  try {
    const { data } = await api.get<PaginatedResponse<Actividad>>('/actividades', {
      params,
      // Activate at dispatch, after Axios's asynchronous Auth0 interceptor.
      // XHR auto-instrumentation then creates the HTTP child and injects traceparent.
      adapter: (config) => context.with(parent, () => axios.getAdapter(api.defaults.adapter)(config)),
    });
    return data;
  } catch (error) {
    span.setStatus({ code: SpanStatusCode.ERROR });
    span.setAttribute('error.type', 'search_failed');
    throw error;
  } finally {
    span.end();
  }
}
