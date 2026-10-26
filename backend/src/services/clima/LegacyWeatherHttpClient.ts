import { z } from 'zod';
import { randomUUID } from 'crypto';
import { WeatherError } from '../../utils/weatherError';
import { IEstadisticasStore } from '../../utils/IEstadisticasStore';

export const legacyForecastResultSchema = z.object({
  condition: z.string().min(1),
  temperature_c: z.number().finite().min(-60).max(60),
  feels_like_c: z.number().finite().optional(),
  humidity_pct: z.number().finite().min(0).max(100),
  precipitation_probability_pct: z.number().finite().min(0).max(100),
  precipitation_mm: z.number().finite().min(0).optional(),
  wind_kph: z.number().finite().min(0),
  wind_direction: z.string().optional(),
  timestamp: z.string().optional(),
  location: z.object({
    lat: z.number().finite(),
    lon: z.number().finite(),
  }).optional(),
});

export const legacyRpcResponseSchema = z.object({
  id: z.union([z.string(), z.number()]),
  status: z.string().optional(),
  result: legacyForecastResultSchema.optional(),
  error: z.object({
    code: z.number().optional(),
    message: z.string().optional(),
  }).optional(),
});

export type LegacyForecastResult = z.infer<typeof legacyForecastResultSchema>;

export interface LegacyWeatherHttpClientOptions {
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  statsStore?: IEstadisticasStore;
}

export interface ILegacyWeatherHttpClient {
  fetchForecast(lat: number, lon: number, timestamp: string): Promise<LegacyForecastResult>;
  checkHealth(): Promise<{ status: 'OK' | 'DEGRADED' | 'OUTAGE'; ready: boolean; live: boolean }>;
}

/**
 * Cliente HTTP de bajo nivel para interactuar con el servicio JSON-RPC del proveedor legacy.
 * Se encarga exclusivamente de la comunicación HTTP, headers, timeouts, serialización y validación Zod.
 */
export class LegacyWeatherHttpClient implements ILegacyWeatherHttpClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly statsStore?: IEstadisticasStore;

  constructor(options: LegacyWeatherHttpClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? (process.env.LEGACY_WEATHER_URL?.trim() || 'http://localhost:8080');
    this.token = options.token ?? (process.env.LEGACY_WEATHER_TOKEN?.trim() || process.env.SESSION_TOKEN?.trim() || '');
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.statsStore = options.statsStore;
  }

  public async fetchForecast(lat: number, lon: number, timestamp: string): Promise<LegacyForecastResult> {
    const requestId = randomUUID();
    const url = `${this.baseUrl.replace(/\/$/, '')}/rpc`;

    const body = JSON.stringify({
      id: requestId,
      method: 'weather.forecast',
      params: {
        location: { lat, lon },
        timestamp,
      },
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      if (this.statsStore) {
        await this.statsStore.incrementar('legacy_requests_total').catch(() => {});
      }
      response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });
    } catch (err: unknown) {
      if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
        throw new WeatherError('WEATHER_TIMEOUT', `El servicio legacy no respondió en ${this.timeoutMs}ms`, 504);
      }
      throw new WeatherError('WEATHER_PROVIDER_UNAVAILABLE', `Fallo de conexión hacia servicio legacy: ${err instanceof Error ? err.message : String(err)}`, 503);
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 401 || response.status === 403) {
      throw new WeatherError('WEATHER_CONFIGURATION_ERROR', 'El servicio legacy rechazó la autenticación (Bearer token institucional inválido o expirado)', response.status);
    }

    if (response.status >= 500) {
      throw new WeatherError('WEATHER_PROVIDER_UNAVAILABLE', `Servicio legacy devolvió HTTP ${response.status}`, response.status);
    }

    if (!response.ok) {
      throw new WeatherError('WEATHER_PROVIDER_UNAVAILABLE', `Servicio legacy respondió con HTTP ${response.status}`, response.status);
    }

    let json: unknown;
    if (typeof response.text === 'function') {
      const text = await response.text();
      try {
        json = JSON.parse(text);
      } catch {
        // Intentar sanitizar por si el motor de caos del binario inyectó '=' en lugar de ':'
        try {
          const sanitized = text.replace(/"(\w+)"\s*=\s*/g, '"$1": ');
          json = JSON.parse(sanitized);
        } catch {
          throw new WeatherError('WEATHER_INVALID_RESPONSE', `El servicio legacy devolvió un cuerpo no parseable como JSON: ${text.slice(0, 200)}`);
        }
      }
    } else {
      json = await response.json();
    }

    // Validación estricta con Zod
    const parsed = legacyRpcResponseSchema.safeParse(json);
    if (!parsed.success || !parsed.data.result) {
      throw new WeatherError('WEATHER_INVALID_RESPONSE', `La respuesta del servicio legacy no cumple el contrato esperado: ${parsed.error?.message ?? 'sin result'}`);
    }

    if (this.statsStore) {
      await this.statsStore.incrementar('legacy_requests_success').catch(() => {});
    }

    return parsed.data.result;
  }

  public async checkHealth(): Promise<{ status: 'OK' | 'DEGRADED' | 'OUTAGE'; ready: boolean; live: boolean }> {
    const livenessUrl = `${this.baseUrl.replace(/\/$/, '')}/healthz`;
    const readinessUrl = `${this.baseUrl.replace(/\/$/, '')}/readyz`;

    let live = false;
    let ready = false;

    try {
      const resLive = await fetch(livenessUrl, { signal: AbortSignal.timeout(2000) });
      live = resLive.ok;
    } catch {
      live = false;
    }

    if (!live) {
      return { status: 'OUTAGE', ready: false, live: false };
    }

    try {
      const resReady = await fetch(readinessUrl, { signal: AbortSignal.timeout(2000) });
      ready = resReady.ok;
    } catch {
      ready = false;
    }

    const status = ready ? 'OK' : 'DEGRADED';
    return { status, ready, live };
  }
}
