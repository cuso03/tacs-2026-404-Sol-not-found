import { Ubicacion } from '../interfaces/models/actividad';
import { PronosticoHora } from '../interfaces/models/pronostico';
import { ClimaResponseDto } from '../dtos/climaDto';
import { IWeatherProvider } from '../interfaces/services/IWeatherProvider';
import { WeatherError } from './weatherError';

interface Conditions {
  datetimeEpoch: number;
  temp: number | null;
  windspeed: number | null;
  humidity?: number | null;
  precipprob?: number | null;
  icon: string;
}
interface Timeline {
  timezone: string;
  currentConditions: Conditions;
  days: Array<{ hours: Conditions[] }>;
}

/** Proveedor real con cuota por API key; la clave permanece exclusivamente en el backend. */
export class VisualCrossingAdapter implements IWeatherProvider {
  private readonly cache = new Map<string, { data: Timeline; expires: number }>();
  private readonly pending = new Map<string, Promise<Timeline>>();
  private retryAt = 0;

  constructor(private readonly apiKey = process.env.VISUAL_CROSSING_API_KEY?.trim() ?? '') {}

  async getClima(ubicacion: Ubicacion, fecha_horario: string): Promise<ClimaResponseDto> {
    const target = Date.parse(fecha_horario);
    if (!Number.isFinite(target) || target < Date.now()) throw new WeatherError('WEATHER_DATE_UNAVAILABLE', 'Fecha sin pronóstico futuro');
    const data = await this.timeline(ubicacion);
    const hour = data.days.flatMap(day => day.hours).find(h => target >= h.datetimeEpoch * 1000 && target < (h.datetimeEpoch + 3600) * 1000);
    if (!hour) throw new WeatherError('WEATHER_DATE_UNAVAILABLE', 'Fecha fuera del pronóstico de 15 días');
    const forecast = this.forecastHour(hour, data.timezone);
    const current = data.currentConditions;
    return {
      ubicacion: ubicacion.tipo === 'ciudad' ? `${ubicacion.ciudad}, ${ubicacion.pais}` : ubicacion.direccion ?? `${ubicacion.latitud}, ${ubicacion.longitud}`,
      fecha_horario,
      clima_actual: { temperatura: this.number(current.temp), viento: this.number(current.windspeed, 0), humedad: this.number(current.humidity, 0, 100), condicion: this.condition(current.icon) },
      pronostico_actividad: { temperatura: forecast.temperatura, viento: forecast.viento, probabilidad_lluvia: forecast.probabilidad_lluvia, condicion: this.condition(hour.icon) },
    };
  }

  async obtenerPronostico(ubicacion: Ubicacion, fechaDesde: string, dias: number): Promise<PronosticoHora[]> {
    const start = Date.parse(fechaDesde);
    if (!Number.isFinite(start) || !Number.isInteger(dias) || dias <= 0) throw new WeatherError('WEATHER_DATE_UNAVAILABLE', 'Rango inválido');
    const data = await this.timeline(ubicacion);
    return data.days.flatMap(day => day.hours).flatMap(hour => {
      const instant = hour.datetimeEpoch * 1000;
      if (!Number.isFinite(instant) || instant < Math.max(start, Date.now()) || instant >= start + dias * 86400000) return [];
      try { return [this.forecastHour(hour, data.timezone)]; } catch { return []; }
    });
  }

  private forecastHour(hour: Conditions, timeZone: string): PronosticoHora {
    return { fecha: this.localISO(hour.datetimeEpoch, timeZone), temperatura: this.number(hour.temp), viento: this.number(hour.windspeed, 0), probabilidad_lluvia: this.number(hour.precipprob, 0, 100) };
  }

  private number(value: unknown, min = -Infinity, max = Infinity): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new WeatherError('WEATHER_INVALID_RESPONSE', 'Datos meteorológicos incompletos o inválidos');
    return value;
  }

  private condition(icon: string): ClimaResponseDto['clima_actual']['condicion'] {
    if (typeof icon !== 'string' || !icon) throw new WeatherError('WEATHER_INVALID_RESPONSE', 'Falta la condición climática');
    if (icon.includes('thunder')) return 'TORMENTA';
    if (icon.includes('rain') || icon.includes('showers')) return 'LLUVIA';
    if (icon.startsWith('clear')) return 'SOLEADO';
    if (icon.startsWith('partly-cloudy')) return 'PARCIALMENTE_NUBLADO';
    return 'NUBLADO';
  }

  private localISO(seconds: number, timeZone: string): string {
    const date = new Date(this.number(seconds) * 1000);
    const parts = new Intl.DateTimeFormat('sv-SE', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date);
    const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
    const local = `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}`;
    const offset = Math.round((Date.parse(`${local}Z`) - date.getTime()) / 60000);
    const abs = Math.abs(offset);
    return `${local}${offset >= 0 ? '+' : '-'}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
  }

  private async timeline(ubicacion: Ubicacion): Promise<Timeline> {
    if (!this.apiKey) throw new WeatherError('WEATHER_CONFIGURATION_ERROR', 'Falta VISUAL_CROSSING_API_KEY');
    const location = ubicacion.tipo === 'coordenadas' ? `${ubicacion.latitud},${ubicacion.longitud}` : `${ubicacion.ciudad.trim()}, ${ubicacion.pais.trim()}`;
    const cached = this.cache.get(location);
    if (cached && cached.expires > Date.now()) return cached.data;
    const existing = this.pending.get(location);
    if (existing) return existing;
    const request = this.load(location);
    this.pending.set(location, request);
    try { return await request; } finally { this.pending.delete(location); }
  }

  private async load(location: string): Promise<Timeline> {
    if (Date.now() < this.retryAt) throw new WeatherError('WEATHER_RATE_LIMITED', 'Pausa por límite del proveedor', 429);
    const params = new URLSearchParams({ key: this.apiKey, unitGroup: 'metric', include: 'current,days,hours', contentType: 'json', iconSet: 'icons2' });
    try {
      const response = await fetch(`https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${encodeURIComponent(location)}?${params}`, { signal: AbortSignal.timeout(10000) });
      if (response.status === 429) {
        const value = response.headers?.get('retry-after');
        const delay = value && /^\d+$/.test(value) ? Number(value) * 1000 : value ? Date.parse(value) - Date.now() : NaN;
        this.retryAt = Date.now() + (Number.isFinite(delay) && delay > 0 ? delay : 60000);
        throw new WeatherError('WEATHER_RATE_LIMITED', 'Visual Crossing HTTP 429', 429);
      }
      if (response.status === 401 || response.status === 403) throw new WeatherError('WEATHER_CONFIGURATION_ERROR', 'Visual Crossing rechazó las credenciales o permisos', response.status);
      if (!response.ok) throw new WeatherError('WEATHER_PROVIDER_UNAVAILABLE', `Visual Crossing HTTP ${response.status}`, response.status);
      let data: Timeline;
      try { data = await response.json() as Timeline; }
      catch { throw new WeatherError('WEATHER_INVALID_RESPONSE', 'Visual Crossing devolvió JSON inválido'); }
      if (!data?.currentConditions || !Array.isArray(data.days) || !data.days.length || !data.days.every(day => Array.isArray(day.hours)) || typeof data.timezone !== 'string') throw new WeatherError('WEATHER_INVALID_RESPONSE', 'Faltan datos de Visual Crossing');
      try { new Intl.DateTimeFormat('en', { timeZone: data.timezone }).format(); }
      catch { throw new WeatherError('WEATHER_INVALID_RESPONSE', 'Zona horaria inválida'); }
      this.number(data.currentConditions.temp);
      this.number(data.currentConditions.windspeed, 0);
      this.number(data.currentConditions.humidity, 0, 100);
      this.condition(data.currentConditions.icon);
      for (const [key, value] of this.cache) if (value.expires <= Date.now()) this.cache.delete(key);
      if (this.cache.size >= 100) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(location, { data, expires: Date.now() + 600000 });
      return data;
    } catch (error) {
      if (error instanceof WeatherError) throw error;
      if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)) throw new WeatherError('WEATHER_TIMEOUT', 'Visual Crossing no respondió a tiempo');
      // No propagar excepciones que puedan contener la URL con la clave.
      throw new WeatherError('WEATHER_PROVIDER_UNAVAILABLE', 'No se pudo conectar con Visual Crossing');
    }
  }
}
