import { WeatherError } from './weatherError';
import { Ubicacion } from '../interfaces/models/actividad';
import { PronosticoHora } from '../interfaces/models/pronostico';
import { ClimaResponseDto } from '../dtos/climaDto';
import { IWeatherProvider } from '../interfaces/services/IWeatherProvider';

interface Forecast {
  timezone: string;
  current?: { time: number; temperature_2m: number; relative_humidity_2m: number; wind_speed_10m: number; weather_code: number };
  hourly: { time: number[]; temperature_2m: number[]; precipitation_probability: number[]; wind_speed_10m: number[]; weather_code: number[] };
}
interface Coordinates { latitude: number; longitude: number }
interface City extends Coordinates { country: string; country_code: string }

/** Pronóstico real: temperaturas en °C, viento en km/h y fechas con offset explícito. */
export class OpenMeteoAdapter implements IWeatherProvider {
  private readonly forecasts = new Map<string, { data: Forecast; expires: number }>();
  private readonly pendingForecasts = new Map<string, Promise<Forecast>>();
  private retryAt = 0;
  private readonly cities = new Map<string, Coordinates>();

  async getClima(ubicacion: Ubicacion, fecha_horario: string): Promise<ClimaResponseDto> {
    const target = new Date(fecha_horario).getTime();
    if (!Number.isFinite(target) || target < Date.now()) throw new WeatherError('WEATHER_DATE_UNAVAILABLE', 'La fecha no tiene pronóstico futuro disponible');
    const data = await this.forecast(ubicacion);
    const index = data.hourly.time.findIndex(time => target >= time * 1000 && target < (time + 3600) * 1000);
    if (index < 0) throw new WeatherError('WEATHER_DATE_UNAVAILABLE', 'Pronóstico no disponible: Open-Meteo cubre hasta 16 días');
    if (!data.current) throw new WeatherError('WEATHER_INVALID_RESPONSE', 'Falta el clima actual');
    const current = data.current;
    const hour = this.hour(data, index);
    if (![current.temperature_2m, current.relative_humidity_2m, current.wind_speed_10m, current.weather_code, data.hourly.weather_code[index]].every(v => typeof v === 'number' && Number.isFinite(v))) {
      throw new WeatherError('WEATHER_INVALID_RESPONSE', 'Open-Meteo devolvió datos incompletos');
    }
    return {
      ubicacion: ubicacion.tipo === 'ciudad' ? `${ubicacion.ciudad}, ${ubicacion.pais}` : ubicacion.direccion ?? `${ubicacion.latitud}, ${ubicacion.longitud}`,
      fecha_horario,
      clima_actual: { temperatura: current.temperature_2m, humedad: current.relative_humidity_2m, viento: current.wind_speed_10m, condicion: this.condition(current.weather_code) },
      pronostico_actividad: { temperatura: hour.temperatura, viento: hour.viento, probabilidad_lluvia: hour.probabilidad_lluvia, condicion: this.condition(data.hourly.weather_code[index]) },
    };
  }

  async obtenerPronostico(ubicacion: Ubicacion, fechaDesde: string, dias: number): Promise<PronosticoHora[]> {
    const start = new Date(fechaDesde).getTime();
    if (!Number.isFinite(start) || !Number.isInteger(dias) || dias <= 0) throw new Error('Rango de pronóstico inválido');
    const end = start + dias * 86400000;
    const data = await this.forecast(ubicacion);
    return data.hourly.time.flatMap((time, index) => {
      if (time * 1000 < Math.max(start, Date.now()) || time * 1000 >= end) return [];
      try { return [this.hour(data, index)]; } catch { return []; }
    });
  }

  private hour(data: Forecast, index: number): PronosticoHora {
    const temperatura = data.hourly.temperature_2m[index];
    const viento = data.hourly.wind_speed_10m[index];
    const probabilidad_lluvia = data.hourly.precipitation_probability[index];
    if (![temperatura, viento, probabilidad_lluvia].every(v => typeof v === 'number' && Number.isFinite(v))) throw new WeatherError('WEATHER_INVALID_RESPONSE', 'Pronóstico incompleto');
    return { fecha: this.localISO(data.hourly.time[index], data.timezone), temperatura, viento, probabilidad_lluvia };
  }

  /** Conserva la hora local del lugar para evaluar las franjas, incluso al cambiar el horario de verano. */
  private localISO(seconds: number, timeZone: string): string {
    const date = new Date(seconds * 1000);
    const parts = new Intl.DateTimeFormat('sv-SE', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date);
    const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
    const local = `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}`;
    const offset = Math.round((Date.parse(`${local}Z`) - date.getTime()) / 60000);
    const abs = Math.abs(offset);
    return `${local}${offset >= 0 ? '+' : '-'}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
  }

  private async forecast(ubicacion: Ubicacion): Promise<Forecast> {
    const coords = await this.coordinates(ubicacion);
    const params = new URLSearchParams({ latitude: String(coords.latitude), longitude: String(coords.longitude), timezone: 'auto', timeformat: 'unixtime', forecast_days: '16', wind_speed_unit: 'kmh', temperature_unit: 'celsius', current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code', hourly: 'temperature_2m,precipitation_probability,wind_speed_10m,weather_code' });
    const url = `https://api.open-meteo.com/v1/forecast?${params}`;
    const cached = this.forecasts.get(url);
    if (cached && cached.expires > Date.now()) return cached.data;
    const pending = this.pendingForecasts.get(url);
    if (pending) return pending;
    const request = this.loadForecast(url);
    this.pendingForecasts.set(url, request);
    try { return await request; }
    finally { this.pendingForecasts.delete(url); }
  }

  private async loadForecast(url: string): Promise<Forecast> {
    const data = await this.request<Forecast>(url);
    if (!data.hourly?.time?.length || !data.timezone || !data.current ||
        !['temperature_2m', 'precipitation_probability', 'wind_speed_10m', 'weather_code'].every(key => Array.isArray(data.hourly[key as keyof Forecast['hourly']]))) {
      throw new WeatherError('WEATHER_INVALID_RESPONSE', 'Open-Meteo devolvió pronóstico incompleto');
    }
    // Caché acotada por proceso; las consultas de clima y reprogramación la comparten.
    for (const [key, value] of this.forecasts) if (value.expires <= Date.now()) this.forecasts.delete(key);
    if (this.forecasts.size >= 100) this.forecasts.delete(this.forecasts.keys().next().value!);
    this.forecasts.set(url, { data, expires: Date.now() + 10 * 60 * 1000 });
    return data;
  }

  private async coordinates(ubicacion: Ubicacion): Promise<Coordinates> {
    if (ubicacion.tipo === 'coordenadas') return { latitude: ubicacion.latitud, longitude: ubicacion.longitud };
    const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    const key = `${normalize(ubicacion.ciudad)}|${normalize(ubicacion.pais)}`;
    const cached = this.cities.get(key);
    if (cached) return cached;
    const params = new URLSearchParams({ name: ubicacion.ciudad, count: '100', language: 'es', format: 'json' });
    const data = await this.request<{ results?: City[] }>(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
    const city = data.results?.find(c => normalize(c.country) === normalize(ubicacion.pais) || normalize(c.country_code) === normalize(ubicacion.pais));
    if (!city) throw new WeatherError('WEATHER_LOCATION_NOT_FOUND', `No se encontró ${ubicacion.ciudad} en ${ubicacion.pais}`);
    this.cities.set(key, city);
    return city;
  }

  private async request<T>(url: string): Promise<T> {
    if (Date.now() < this.retryAt) throw new WeatherError('WEATHER_RATE_LIMITED', 'Pausa de consultas por límite del proveedor', 429);
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (response.status === 429) {
      const retryAfter = response.headers?.get('retry-after');
      const delay = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000
        : retryAfter ? Date.parse(retryAfter) - Date.now() : NaN;
      this.retryAt = Date.now() + (Number.isFinite(delay) && delay > 0 ? delay : 60000);
    }
    if (!response.ok) {
      throw new WeatherError(response.status === 429 ? 'WEATHER_RATE_LIMITED' : 'WEATHER_PROVIDER_UNAVAILABLE', `Open-Meteo HTTP ${response.status}`, response.status);
    }
    try { return await response.json() as T; }
    catch { throw new WeatherError('WEATHER_INVALID_RESPONSE', 'Open-Meteo devolvió JSON inválido'); }
  }

  private condition(code: number): ClimaResponseDto['clima_actual']['condicion'] {
    if (code === 0) return 'SOLEADO';
    if ([1, 2].includes(code)) return 'PARCIALMENTE_NUBLADO';
    if ([95, 96, 99].includes(code)) return 'TORMENTA';
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'LLUVIA';
    return 'NUBLADO';
  }
}
