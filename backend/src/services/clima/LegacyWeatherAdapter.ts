import { Ubicacion } from '../../interfaces/models/actividad';
import { PronosticoHora } from '../../interfaces/models/pronostico';
import { ClimaResponseDto } from '../../dtos/climaDto';
import { IWeatherProvider } from '../../interfaces/services/IWeatherProvider';
import { WeatherError } from '../../utils/weatherError';
import { CircuitBreaker, CircuitBreakerOpenError } from './CircuitBreaker';
import { TokenBucketRateLimiter, UserRateLimiter } from './RateLimiter';
import { IEstadisticasStore } from '../../utils/IEstadisticasStore';
import { z } from 'zod';

export interface LegacyWeatherOptions {
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  maxRetries?: number;
  circuitBreaker?: CircuitBreaker;
  rateLimiter?: TokenBucketRateLimiter;
  userRateLimiter?: UserRateLimiter;
  statsStore?: IEstadisticasStore;
  cacheTtlMs?: number;
  maxCacheSize?: number;
}

const legacyForecastResultSchema = z.object({
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

const legacyRpcResponseSchema = z.object({
  id: z.union([z.string(), z.number()]),
  status: z.string().optional(),
  result: legacyForecastResultSchema.optional(),
  error: z.object({
    code: z.number().optional(),
    message: z.string().optional(),
  }).optional(),
});

type LegacyForecastResult = z.infer<typeof legacyForecastResultSchema>;

interface CachedForecast {
  data: LegacyForecastResult;
  expiresAt: number;
}

export class LegacyWeatherAdapter implements IWeatherProvider {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly cacheTtlMs: number;
  private readonly maxCacheSize: number;
  private readonly maxCityCoordsSize = 100;
  public readonly circuitBreaker: CircuitBreaker;
  public readonly rateLimiter: TokenBucketRateLimiter;
  public readonly userRateLimiter?: UserRateLimiter;
  private readonly statsStore?: IEstadisticasStore;

  // Colecciones acotadas con límite máximo y expulsión para prevenir memory leaks
  private readonly cache = new Map<string, CachedForecast>();
  private readonly cityCoords = new Map<string, { lat: number; lon: number }>();

  constructor(options: LegacyWeatherOptions = {}) {
    this.baseUrl = options.baseUrl ?? (process.env.LEGACY_WEATHER_URL?.trim() || 'http://localhost:8080');
    this.token = options.token ?? (process.env.LEGACY_WEATHER_TOKEN?.trim() || '');
    this.timeoutMs = options.timeoutMs ?? 3000;
    this.maxRetries = options.maxRetries ?? 2;
    this.cacheTtlMs = options.cacheTtlMs ?? 10 * 60 * 1000; // 10 minutos
    this.maxCacheSize = options.maxCacheSize ?? 200; // Máximo 200 pronósticos en memoria
    this.statsStore = options.statsStore;

    this.circuitBreaker = options.circuitBreaker ?? new CircuitBreaker({
      name: 'LegacyWeatherCircuitBreaker',
      failureThreshold: 5,
      resetTimeoutMs: 30000,
      halfOpenSuccessThreshold: 2,
    });

    this.rateLimiter = options.rateLimiter ?? new TokenBucketRateLimiter({
      tokensPerInterval: 10,
      intervalMs: 1000,
      maxTokens: 10,
    });

    this.userRateLimiter = options.userRateLimiter;
  }

  public async getClima(ubicacion: Ubicacion, fecha_horario: string, userId?: string): Promise<ClimaResponseDto> {
    const target = Date.parse(fecha_horario);
    if (!Number.isFinite(target)) {
      throw new WeatherError('WEATHER_DATE_UNAVAILABLE', 'Fecha u horario inválido');
    }

    const coords = await this.resolveCoordinates(ubicacion);
    const nowIso = new Date().toISOString();

    // 1. Clima actual (timestamp actual)
    const currentRaw = await this.getForecast(coords.lat, coords.lon, nowIso, userId);
    // 2. Pronóstico para la fecha de la actividad
    const targetRaw = await this.getForecast(coords.lat, coords.lon, fecha_horario, userId);

    const ubicacionStr = ubicacion.tipo === 'ciudad'
      ? `${ubicacion.ciudad}, ${ubicacion.pais}`
      : ubicacion.direccion ?? `${ubicacion.latitud}, ${ubicacion.longitud}`;

    return {
      ubicacion: ubicacionStr,
      fecha_horario,
      clima_actual: {
        temperatura: currentRaw.temperature_c,
        humedad: currentRaw.humidity_pct,
        viento: currentRaw.wind_kph,
        condicion: this.mapCondition(currentRaw.condition),
      },
      pronostico_actividad: {
        temperatura: targetRaw.temperature_c,
        viento: targetRaw.wind_kph,
        probabilidad_lluvia: targetRaw.precipitation_probability_pct,
        condicion: this.mapCondition(targetRaw.condition),
      },
    };
  }

  public async obtenerPronostico(ubicacion: Ubicacion, fechaDesde: string, dias: number, userId?: string): Promise<PronosticoHora[]> {
    const start = Date.parse(fechaDesde);
    if (!Number.isFinite(start) || !Number.isInteger(dias) || dias <= 0) {
      throw new WeatherError('WEATHER_DATE_UNAVAILABLE', 'Rango de pronóstico inválido');
    }

    const coords = await this.resolveCoordinates(ubicacion);
    const now = Date.now();

    // Acotar el horizonte máximo a 16 días para prevenir generación de arreglos infinitos en memoria
    const maxHorizonDays = Math.min(dias, 16);
    const end = start + maxHorizonDays * 86400000;

    // Generar franjas horarias a consultar
    const timestamps: string[] = [];
    let current = Math.max(start, now);
    current = Math.floor(current / 3600000) * 3600000;

    while (current < end) {
      timestamps.push(new Date(current).toISOString());
      current += 3600000; // cada 1 hora
    }

    // Bounded concurrency para no sobrecargar el upstream
    const concurrency = 4;
    const results: PronosticoHora[] = [];

    for (let i = 0; i < timestamps.length; i += concurrency) {
      const batch = timestamps.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(async (ts) => {
          const forecast = await this.getForecast(coords.lat, coords.lon, ts, userId);
          return {
            fecha: ts,
            temperatura: forecast.temperature_c,
            viento: forecast.wind_kph,
            probabilidad_lluvia: forecast.precipitation_probability_pct,
          };
        }),
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Realiza la consulta protegida con Caché, Circuit Breaker, Rate Limiter, Retries y Timeouts.
   */
  public async getForecast(lat: number, lon: number, timestamp: string, userId?: string): Promise<LegacyForecastResult> {
    if (userId && this.userRateLimiter) {
      const allowed = await this.userRateLimiter.consume(userId, 500);
      if (!allowed) {
        throw new WeatherError('WEATHER_RATE_LIMITED', `Límite de tasa por usuario excedido para ${userId}`);
      }
    }

    const roundedHour = this.roundToHourIso(timestamp);
    const cacheKey = `${lat.toFixed(3)}_${lon.toFixed(3)}_${roundedHour}`;

    // 1. Revisar Caché
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      if (this.statsStore) {
        await this.statsStore.incrementar('legacy_cache_hits').catch(() => {});
      }
      return cached.data;
    }

    if (this.statsStore) {
      await this.statsStore.incrementar('legacy_cache_misses').catch(() => {});
    }

    // 2. Ejecutar a través de Circuit Breaker
    const result = await this.circuitBreaker.execute(async () => {
      return await this.executeWithRetries(lat, lon, timestamp);
    });

    // 3. Guardar en Caché con expulsión controlada (previene memory leaks)
    this.cleanExpiredCache();
    while (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      if (!oldestKey) break;
      this.cache.delete(oldestKey);
    }
    this.cache.set(cacheKey, {
      data: result,
      expiresAt: Date.now() + this.cacheTtlMs,
    });

    return result;
  }

  private async executeWithRetries(lat: number, lon: number, timestamp: string): Promise<LegacyForecastResult> {
    let attempt = 0;
    while (true) {
      attempt++;
      try {
        // Rate Limiter
        await this.rateLimiter.acquire(1, 4000);
        return await this.callRpc(lat, lon, timestamp);
      } catch (error) {
        const isTransient = this.isTransientError(error);
        if (attempt > this.maxRetries || !isTransient) {
          if (this.statsStore) {
            await this.statsStore.incrementar('legacy_requests_failed').catch(() => {});
            if (error instanceof WeatherError && error.code === 'WEATHER_TIMEOUT') {
              await this.statsStore.incrementar('legacy_errors_timeout').catch(() => {});
            } else if (error instanceof WeatherError && error.code === 'WEATHER_INVALID_RESPONSE') {
              await this.statsStore.incrementar('legacy_errors_validation').catch(() => {});
            }
          }
          throw error;
        }

        // Backoff exponencial con Jitter
        const baseDelay = 150;
        const maxDelay = 1200;
        const expDelay = Math.min(maxDelay, baseDelay * Math.pow(2, attempt - 1));
        const jitter = Math.random() * expDelay;
        const delay = Math.round(expDelay / 2 + jitter / 2);
        await new Promise((res) => setTimeout(res, delay));
      }
    }
  }

  private async callRpc(lat: number, lon: number, timestamp: string): Promise<LegacyForecastResult> {
    const requestId = `req-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
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
    try {
      json = await response.json();
    } catch {
      throw new WeatherError('WEATHER_INVALID_RESPONSE', 'El servicio legacy devolvió un cuerpo no parseable como JSON');
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

  private isTransientError(error: unknown): boolean {
    if (error instanceof CircuitBreakerOpenError) return false;
    if (error instanceof WeatherError) {
      if (error.code === 'WEATHER_TIMEOUT') return true;
      if (error.code === 'WEATHER_PROVIDER_UNAVAILABLE') return true;
      if (error.upstreamStatus && error.upstreamStatus >= 500) return true;
    }
    return false;
  }

  private mapCondition(cond: string): ClimaResponseDto['clima_actual']['condicion'] {
    const c = cond.trim().toLowerCase();
    if (c.includes('clear') || c.includes('sol') || c.includes('sunny')) return 'SOLEADO';
    if (c.includes('partly') || c.includes('parcial')) return 'PARCIALMENTE_NUBLADO';
    if (c.includes('thunder') || c.includes('storm') || c.includes('tormenta')) return 'TORMENTA';
    if (c.includes('rain') || c.includes('lluvia') || c.includes('drizzle') || c.includes('snow')) return 'LLUVIA';
    return 'NUBLADO';
  }

  private async resolveCoordinates(ubicacion: Ubicacion): Promise<{ lat: number; lon: number }> {
    if (ubicacion.tipo === 'coordenadas') {
      return { lat: ubicacion.latitud, lon: ubicacion.longitud };
    }

    const key = `${ubicacion.ciudad.toLowerCase()}|${ubicacion.pais.toLowerCase()}`;
    const cached = this.cityCoords.get(key);
    if (cached) return cached;

    const defaults: Record<string, { lat: number; lon: number }> = {
      'buenos aires|argentina': { lat: -34.6037, lon: -58.3816 },
      'cordoba|argentina': { lat: -31.4201, lon: -64.1888 },
      'rosario|argentina': { lat: -32.9468, lon: -60.6393 },
      'mendoza|argentina': { lat: -32.8895, lon: -68.8458 },
    };

    if (defaults[key]) {
      this.cacheCityCoords(key, defaults[key]);
      return defaults[key];
    }

    try {
      const params = new URLSearchParams({ name: ubicacion.ciudad, count: '1', language: 'es', format: 'json' });
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json() as { results?: Array<{ latitude: number; longitude: number }> };
        if (data.results && data.results.length > 0) {
          const coords = { lat: data.results[0].latitude, lon: data.results[0].longitude };
          this.cacheCityCoords(key, coords);
          return coords;
        }
      }
    } catch {
      // ignore
    }

    const fallbackCoords = { lat: -34.6037, lon: -58.3816 };
    this.cacheCityCoords(key, fallbackCoords);
    return fallbackCoords;
  }

  private cacheCityCoords(key: string, coords: { lat: number; lon: number }): void {
    while (this.cityCoords.size >= this.maxCityCoordsSize) {
      const oldestKey = this.cityCoords.keys().next().value;
      if (!oldestKey) break;
      this.cityCoords.delete(oldestKey);
    }
    this.cityCoords.set(key, coords);
  }

  private roundToHourIso(timestamp: string): string {
    const d = new Date(timestamp);
    d.setMinutes(0, 0, 0);
    return d.toISOString();
  }

  private cleanExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (value.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }

  public clearCache(): void {
    this.cache.clear();
  }

  public getCacheSize(): number {
    return this.cache.size;
  }
}
