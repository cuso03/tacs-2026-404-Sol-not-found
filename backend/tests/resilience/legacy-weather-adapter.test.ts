import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LegacyWeatherAdapter } from '../../src/services/clima/LegacyWeatherAdapter';
import { WeatherError } from '../../src/utils/weatherError';
import { CircuitBreakerOpenError } from '../../src/services/clima/CircuitBreaker';
import { InMemoryEstadisticasStore } from '../../src/utils/InMemoryEstadisticasStore';

describe('LegacyWeatherAdapter (Resilience Unit Tests)', () => {
  let stats: InMemoryEstadisticasStore;
  const originalFetch = global.fetch;

  beforeEach(() => {
    stats = new InMemoryEstadisticasStore();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  const mockForecastSuccess = {
    id: 'req-1',
    status: 'OK',
    result: {
      location: { lat: -34.6, lon: -58.38 },
      timestamp: '2026-11-14T18:00:00Z',
      condition: 'partly cloudy',
      temperature_c: 24.5,
      feels_like_c: 25.0,
      humidity_pct: 60,
      precipitation_probability_pct: 10,
      precipitation_mm: 0,
      wind_kph: 15.0,
      wind_direction: 'NE',
    },
  };

  it('procesa correctamente una respuesta exitosa del RPC legacy', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockForecastSuccess,
    } as unknown as Response);

    const adapter = new LegacyWeatherAdapter({
      baseUrl: 'http://legacy:8080',
      statsStore: stats,
    });

    const result = await adapter.getClima(
      { tipo: 'coordenadas', latitud: -34.6037, longitud: -58.3816 },
      '2026-11-14T18:00:00Z',
    );

    expect(result.clima_actual.temperatura).toBe(24.5);
    expect(result.clima_actual.condicion).toBe('PARCIALMENTE_NUBLADO');
    expect(result.clima_actual.humedad).toBe(60);
    expect(result.pronostico_actividad.probabilidad_lluvia).toBe(10);

    const metrics = await stats.obtener();
    expect(metrics['legacy_requests_total']).toBeGreaterThanOrEqual(1);
    expect(metrics['legacy_requests_success']).toBeGreaterThanOrEqual(1);
  });

  it('utiliza la caché en memoria y evita llamadas repetidas para la misma hora', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockForecastSuccess,
    } as unknown as Response);
    global.fetch = fetchMock;

    const adapter = new LegacyWeatherAdapter({ statsStore: stats });

    // Primera llamada
    await adapter.getForecast(-34.6037, -58.3816, '2026-11-14T18:20:00Z');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Segunda llamada dentro de la misma hora
    await adapter.getForecast(-34.6037, -58.3816, '2026-11-14T18:45:00Z');
    expect(fetchMock).toHaveBeenCalledTimes(1); // Sigue siendo 1 llamada HTTP

    const metrics = await stats.obtener();
    expect(metrics['legacy_cache_hits']).toBe(1);
    expect(metrics['legacy_cache_misses']).toBe(1);
  });

  it('limita el tamaño máximo de la caché en memoria para prevenir memory leaks', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockForecastSuccess,
    } as unknown as Response);

    const maxCacheSize = 5;
    const adapter = new LegacyWeatherAdapter({ maxCacheSize, statsStore: stats });

    // Insertamos 15 pronósticos de horas distintas
    for (let i = 0; i < 15; i++) {
      const ts = `2026-11-14T${String(i).padStart(2, '0')}:00:00Z`;
      await adapter.getForecast(-34.6037, -58.3816, ts);
    }

    // El tamaño de la caché debe ser exactamente <= maxCacheSize
    expect(adapter.getCacheSize()).toBeLessThanOrEqual(maxCacheSize);
  });

  it('aplica reintentos con backoff cuando el servicio responde con 500 transitorio', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return { ok: false, status: 503 } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => mockForecastSuccess,
      } as Response;
    });

    const adapter = new LegacyWeatherAdapter({ maxRetries: 2, statsStore: stats });
    const res = await adapter.getForecast(-34.6037, -58.3816, '2026-11-14T18:00:00Z');

    expect(res.temperature_c).toBe(24.5);
    expect(callCount).toBe(2);
  });

  it('rechaza respuestas con datos no válidos o temperaturas anómalas (validación de contrato)', async () => {
    const malformedData = {
      id: 'req-1',
      status: 'OK',
      result: {
        condition: 'sunny',
        temperature_c: 999, // Temperatura absurda (inválida según schema -60..60)
        humidity_pct: 50,
        precipitation_probability_pct: 0,
        wind_kph: 10,
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => malformedData,
    } as unknown as Response);

    const adapter = new LegacyWeatherAdapter({ maxRetries: 0, statsStore: stats });

    await expect(adapter.getForecast(-34.6037, -58.3816, '2026-11-14T18:00:00Z')).rejects.toThrow(WeatherError);
  });

  it('abre el Circuit Breaker tras fallos consecutivos y bloquea llamadas', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    } as unknown as Response);

    const adapter = new LegacyWeatherAdapter({
      maxRetries: 0,
      statsStore: stats,
    });
    // Forzamos umbral de 3 en el circuit breaker
    adapter.circuitBreaker['failureThreshold'] = 3;

    // 3 fallos consecutivos
    for (let i = 0; i < 3; i++) {
      await expect(adapter.getForecast(-34.6037, -58.3816, `2026-11-14T${10 + i}:00:00Z`)).rejects.toThrow();
    }

    expect(adapter.circuitBreaker.getState()).toBe('OPEN');

    // La siguiente llamada debe fallar por CircuitBreakerOpenError sin hacer fetch
    const fetchCallsBefore = (global.fetch as any).mock.calls.length;
    await expect(adapter.getForecast(-34.6037, -58.3816, '2026-11-14T20:00:00Z')).rejects.toThrow(CircuitBreakerOpenError);
    expect((global.fetch as any).mock.calls.length).toBe(fetchCallsBefore);
  });

  it('reporta correctamente el estado de salud mediante /healthz y /readyz', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/healthz')) return { ok: true, status: 200 } as Response;
      if (url.includes('/readyz')) return { ok: false, status: 503 } as Response; // simulando degradación
      return { ok: true, status: 200 } as Response;
    });

    const adapter = new LegacyWeatherAdapter();
    const health = await adapter.checkHealth();

    expect(health.live).toBe(true);
    expect(health.ready).toBe(false);
    expect(health.status).toBe('DEGRADED');
  });
});
