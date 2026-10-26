import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { InMemoryEstadisticasStore } from '../../src/utils/InMemoryEstadisticasStore';
import { LegacyWeatherAdapter } from '../../src/services/clima/LegacyWeatherAdapter';
import { ResilientWeatherRouter } from '../../src/services/clima/ResilientWeatherRouter';
import { IWeatherProvider } from '../../src/interfaces/services/IWeatherProvider';
import { authHeader, AUTH_ORGANIZADOR } from '../helpers/fixtures/auth.fixture';

/**
 * Load test simulado con usuarios que tienen configurado el proveedor legacy.
 * Evalúa dos escenarios obligatorios:
 *  1. Con el servicio legacy funcionando (saludable).
 *  2. Con el servicio legacy caído (simulado con caída/outage).
 * Verifica que en ambos escenarios la disponibilidad de la plataforma sea del 100%.
 */
describe('Pruebas de Carga — Disponibilidad bajo estrés (Load Test)', () => {
  let statsStore: InMemoryEstadisticasStore;
  let defaultProvider: IWeatherProvider;
  const originalFetch = global.fetch;

  const mockForecast = {
    id: 'req-load',
    status: 'OK',
    result: {
      location: { lat: -34.6, lon: -58.38 },
      timestamp: '2026-11-20T18:00:00Z',
      condition: 'partly cloudy',
      temperature_c: 26.0,
      feels_like_c: 27.5,
      humidity_pct: 62,
      precipitation_probability_pct: 12,
      precipitation_mm: 0,
      wind_kph: 14.0,
      wind_direction: 'E',
    },
  };

  const defaultClimaMock = {
    ubicacion: 'Buenos Aires, Argentina',
    fecha_horario: '2026-11-20T18:00:00Z',
    clima_actual: { temperatura: 23, humedad: 50, viento: 10, condicion: 'SOLEADO' as const },
    pronostico_actividad: { temperatura: 24, viento: 12, probabilidad_lluvia: 0, condicion: 'SOLEADO' as const },
  };

  beforeEach(() => {
    statsStore = new InMemoryEstadisticasStore();
    defaultProvider = {
      getClima: vi.fn().mockResolvedValue(defaultClimaMock),
      obtenerPronostico: vi.fn().mockResolvedValue([]),
    };
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('Escenario 1: Servicio legacy ACTIVO y respondiendo — 50 peticiones concurrentes', async () => {
    // Stub del servicio legacy retornando 200 OK
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockForecast,
    } as unknown as Response);

    const legacyAdapter = new LegacyWeatherAdapter({ statsStore });
    const router = new ResilientWeatherRouter(
      defaultProvider,
      legacyAdapter,
      {
        obtenerProveedorClima: async () => 'legacy',
      } as any,
      statsStore,
    );

    const app = createApp(router, undefined, statsStore);

    // Creamos la actividad a través de la API
    const created = await request(app)
      .post('/api/actividades')
      .set(authHeader(AUTH_ORGANIZADOR))
      .send({
        titulo: 'Torneo de Pádel',
        descripcion: 'Carga de prueba',
        tipo: 'aire_libre',
        ubicacion: { tipo: 'coordenadas', latitud: -34.6037, longitud: -58.3816 },
        fecha_horario: '2026-11-20T18:00:00Z',
        min_participantes: 2,
        max_participantes: 8,
      });

    expect(created.status).toBe(201);
    const actividadId = created.body.id;

    const CONCURRENCY = 50;
    const start = Date.now();

    const promises = Array.from({ length: CONCURRENCY }, () => {
      return request(app)
        .get(`/api/actividades/${actividadId}/clima`)
        .set(authHeader(AUTH_ORGANIZADOR));
    });

    const responses = await Promise.all(promises);
    const durationMs = Date.now() - start;

    // Verificaciones: 100% de respuestas exitosas (200 OK)
    const successCount = responses.filter((r) => r.status === 200).length;
    expect(successCount).toBe(CONCURRENCY);

    // La primera petición puebla la caché, el resto consume de caché
    const metrics = await statsStore.obtener();
    expect(metrics['legacy_cache_hits']).toBeGreaterThanOrEqual(CONCURRENCY - 5);
    expect(legacyAdapter.circuitBreaker.getState()).toBe('CLOSED');

    console.log(`[Load Test - Escenario 1] ${CONCURRENCY} peticiones en ${durationMs}ms: 100% éxito, ${metrics['legacy_cache_hits']} cache hits.`);
  });

  it('Escenario 2: Servicio legacy CAÍDO (Outage) — 50 peticiones concurrentes con Fallback', async () => {
    // Stub del servicio legacy simulando caída (503 Service Unavailable)
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    } as unknown as Response);

    const legacyAdapter = new LegacyWeatherAdapter({
      maxRetries: 1,
      statsStore,
      circuitBreaker: undefined,
    });

    // Simulamos que el usuario tiene 'legacy' configurado
    const router = new ResilientWeatherRouter(
      defaultProvider,
      legacyAdapter,
      {
        obtenerProveedorClima: async () => 'legacy',
      } as any,
      statsStore,
    );

    const app = createApp(router, undefined, statsStore);

    const created = await request(app)
      .post('/api/actividades')
      .set(authHeader(AUTH_ORGANIZADOR))
      .send({
        titulo: 'Fútbol 5',
        descripcion: 'Prueba de fallback bajo caída',
        tipo: 'aire_libre',
        ubicacion: { tipo: 'coordenadas', latitud: -34.6037, longitud: -58.3816 },
        fecha_horario: '2026-11-20T18:00:00Z',
        min_participantes: 2,
        max_participantes: 10,
      });

    expect(created.status).toBe(201);
    const actividadId = created.body.id;

    const CONCURRENCY = 50;
    const start = Date.now();

    const promises = Array.from({ length: CONCURRENCY }, () => {
      return request(app)
        .get(`/api/actividades/${actividadId}/clima`)
        .set(authHeader(AUTH_ORGANIZADOR));
    });

    const responses = await Promise.all(promises);
    const durationMs = Date.now() - start;

    // Verificaciones: NINGÚN error 500/503 hacia el cliente final: disponibilidad del 100%
    const successCount = responses.filter((r) => r.status === 200).length;
    expect(successCount).toBe(CONCURRENCY);

    // Todas las respuestas tienen fallback activado
    for (const res of responses) {
      expect(res.body.fallback).toBe(true);
      expect(res.body.proveedor).toBe('legacy');
      expect(res.body.clima_actual.temperatura).toBe(23); // provisto por defaultProvider
    }

    // El Circuit Breaker se disparó a OPEN
    expect(legacyAdapter.circuitBreaker.getState()).toBe('OPEN');

    const metrics = await statsStore.obtener();
    expect(metrics['legacy_fallbacks_total']).toBe(CONCURRENCY);

    console.log(`[Load Test - Escenario 2] ${CONCURRENCY} peticiones en ${durationMs}ms: 100% atendidas vía Fallback, Circuit Breaker OPEN.`);
  });
});
