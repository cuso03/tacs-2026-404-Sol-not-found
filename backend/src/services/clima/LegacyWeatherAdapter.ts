import { Ubicacion } from '../../interfaces/models/actividad';
import { PronosticoHora } from '../../interfaces/models/pronostico';
import { ClimaResponseDto } from '../../dtos/climaDto';
import { IWeatherProvider } from '../../interfaces/services/IWeatherProvider';
import { WeatherError } from '../../utils/weatherError';
import { CircuitBreaker, CircuitBreakerOpenError } from './CircuitBreaker';
import { TokenBucketRateLimiter, UserRateLimiter } from './RateLimiter';
import { IEstadisticasStore } from '../../utils/IEstadisticasStore';
import { LRUCache } from 'lru-cache';
import {
  ILegacyWeatherHttpClient,
  LegacyWeatherHttpClient,
  LegacyForecastResult,
  legacyForecastResultSchema,
  legacyRpcResponseSchema,
} from './LegacyWeatherHttpClient';

export {
  ILegacyWeatherHttpClient,
  LegacyWeatherHttpClient,
  LegacyForecastResult,
  legacyForecastResultSchema,
  legacyRpcResponseSchema,
};

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
  httpClient?: ILegacyWeatherHttpClient;
}

export class LegacyWeatherAdapter implements IWeatherProvider {
  public readonly httpClient: ILegacyWeatherHttpClient;
  private readonly maxRetries: number;
  private readonly cacheTtlMs: number;
  private readonly maxCacheSize: number;
  private readonly maxCityCoordsSize = 100;
  public readonly circuitBreaker: CircuitBreaker;
  public readonly rateLimiter: TokenBucketRateLimiter;
  public readonly userRateLimiter?: UserRateLimiter;
  private readonly statsStore?: IEstadisticasStore;

  // Cachés gestionadas por lru-cache (estándar de la industria) para prevención estricta de memory leaks
  private readonly cache: LRUCache<string, LegacyForecastResult>;
  private readonly cityCoords: LRUCache<string, { lat: number; lon: number }>;

  constructor(options: LegacyWeatherOptions = {}) {
    this.httpClient = options.httpClient ?? new LegacyWeatherHttpClient({
      baseUrl: options.baseUrl,
      token: options.token,
      timeoutMs: options.timeoutMs,
      statsStore: options.statsStore,
    });

    this.maxRetries = options.maxRetries ?? 2;
    this.cacheTtlMs = options.cacheTtlMs ?? 10 * 60 * 1000; // 10 minutos
    this.maxCacheSize = options.maxCacheSize ?? 200; // Máximo 200 pronósticos en memoria
    this.statsStore = options.statsStore;

    this.cache = new LRUCache<string, LegacyForecastResult>({
      max: this.maxCacheSize,
      ttl: this.cacheTtlMs,
    });

    this.cityCoords = new LRUCache<string, { lat: number; lon: number }>({
      max: this.maxCityCoordsSize,
    });

    this.circuitBreaker = options.circuitBreaker ?? new CircuitBreaker({
      name: 'LegacyWeatherCircuitBreaker',
      failureThreshold: 5,
      resetTimeoutMs: 30000,
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
   * Realiza la consulta protegida con LRUCache, Circuit Breaker (Opossum), Rate Limiter (Bottleneck), Retries y Timeouts.
   */
  public async getForecast(lat: number, lon: number, timestamp: string, userId?: string): Promise<LegacyForecastResult> {
    if (userId && this.userRateLimiter) {
      const allowed = this.userRateLimiter.check(userId);
      if (!allowed) {
        throw new WeatherError('WEATHER_RATE_LIMITED', `Límite de tasa por usuario excedido para ${userId}`);
      }
    }

    const roundedHour = this.roundToHourIso(timestamp);
    const cacheKey = `${lat.toFixed(3)}_${lon.toFixed(3)}_${roundedHour}`;

    // 1. Revisar Caché (lru-cache)
    const cached = this.cache.get(cacheKey);
    if (cached) {
      if (this.statsStore) {
        await this.statsStore.incrementar('legacy_cache_hits').catch(() => {});
      }
      return cached;
    }

    if (this.statsStore) {
      await this.statsStore.incrementar('legacy_cache_misses').catch(() => {});
    }

    // 2. Ejecutar a través de Circuit Breaker (Opossum)
    const result = await this.circuitBreaker.execute(async () => {
      return await this.executeWithRetries(lat, lon, timestamp);
    });

    // 3. Guardar en Caché LRU (desalojo automático y límites garantizados)
    this.cache.set(cacheKey, result);

    return result;
  }

  private async executeWithRetries(lat: number, lon: number, timestamp: string): Promise<LegacyForecastResult> {
    let attempt = 0;
    while (true) {
      attempt++;
      try {
        // Rate Limiter
        await this.rateLimiter.acquire(1, 4000);
        return await this.httpClient.fetchForecast(lat, lon, timestamp);
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

  public async checkHealth(): Promise<{ status: 'OK' | 'DEGRADED' | 'OUTAGE'; ready: boolean; live: boolean }> {
    return await this.httpClient.checkHealth();
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
      this.cityCoords.set(key, defaults[key]);
      return defaults[key];
    }

    try {
      const params = new URLSearchParams({ name: ubicacion.ciudad, count: '1', language: 'es', format: 'json' });
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json() as { results?: Array<{ latitude: number; longitude: number }> };
        if (data.results && data.results.length > 0) {
          const coords = { lat: data.results[0].latitude, lon: data.results[0].longitude };
          this.cityCoords.set(key, coords);
          return coords;
        }
      }
    } catch {
      // ignore
    }

    const fallbackCoords = { lat: -34.6037, lon: -58.3816 };
    this.cityCoords.set(key, fallbackCoords);
    return fallbackCoords;
  }

  private roundToHourIso(timestamp: string): string {
    const d = new Date(timestamp);
    d.setMinutes(0, 0, 0);
    return d.toISOString();
  }

  public clearCache(): void {
    this.cache.clear();
  }

  public getCacheSize(): number {
    return this.cache.size;
  }
}
