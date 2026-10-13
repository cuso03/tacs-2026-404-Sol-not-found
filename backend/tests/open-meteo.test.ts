import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenMeteoAdapter } from '../src/utils/openMeteoAdapter';

const location = { tipo: 'coordenadas' as const, latitud: -34.6, longitud: -58.4 };
function response(time: number) {
  return { timezone: 'America/Argentina/Buenos_Aires', current: { time, temperature_2m: 20, relative_humidity_2m: 70, wind_speed_10m: 36, weather_code: 0 }, hourly: { time: [time], temperature_2m: [20], precipitation_probability: [10], wind_speed_10m: [36], weather_code: [0] } };
}
afterEach(() => vi.unstubAllGlobals());

describe('Open-Meteo real adapter', () => {
  it('consulta el proveedor real sin key y conserva km/h y hora local con offset', async () => {
    const time = Math.ceil(Date.now() / 3600000) * 3600 + 86400;
    const fetchMock = vi.fn(async (_url: string) => ({ ok: true, json: async () => response(time) }));
    vi.stubGlobal('fetch', fetchMock);
    const adapter = new OpenMeteoAdapter();
    const forecast = await adapter.obtenerPronostico(location, new Date().toISOString(), 365);
    expect(forecast).toHaveLength(1);
    expect(forecast[0].viento).toBe(36);
    expect(forecast[0].fecha).toMatch(/-03:00$/);
    expect(Date.parse(forecast[0].fecha)).toBe(time * 1000);
    const weather = await adapter.getClima(location, new Date(time * 1000 + 1800000).toISOString());
    expect(weather.pronostico_actividad.viento).toBe(36);
    const url = new URL(fetchMock.mock.calls[0][0] as unknown as string);
    expect(url.hostname).toBe('api.open-meteo.com');
    expect(url.searchParams.get('forecast_days')).toBe('16');
    expect(url.searchParams.get('wind_speed_unit')).toBe('kmh');
  });

  it('no inventa clima fuera del horizonte ni con respuestas incompletas', async () => {
    const time = Math.ceil(Date.now() / 3600000) * 3600 + 3600;
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => response(time) })));
    const adapter = new OpenMeteoAdapter();
    await expect(adapter.getClima(location, new Date(Date.now() + 30 * 86400000).toISOString())).rejects.toThrow('Pronóstico no disponible');
    const incomplete = response(time);
    incomplete.hourly.temperature_2m = [];
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => incomplete })));
    await expect(adapter.getClima(location, new Date(time * 1000).toISOString())).rejects.toThrow('incompleto');
  });

  it('propaga errores del proveedor sin recurrir al mock', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 429 })));
    await expect(new OpenMeteoAdapter().obtenerPronostico(location, new Date().toISOString(), 3)).rejects.toThrow('429');
  });

  it('resuelve país por código y no usa una ciudad de otro país', async () => {
    const time = Math.ceil(Date.now() / 3600000) * 3600 + 3600;
    const fetchMock = vi.fn(async (url: string) => ({ ok: true, json: async () => url.includes('geocoding') ? { results: [{ country: 'Argentina', country_code: 'AR', latitude: -34.6, longitude: -58.4 }] } : response(time) }));
    vi.stubGlobal('fetch', fetchMock);
    const adapter = new OpenMeteoAdapter();
    await adapter.obtenerPronostico({ tipo: 'ciudad', ciudad: 'Buenos Aires', pais: 'AR' }, new Date().toISOString(), 3);
    await expect(adapter.obtenerPronostico({ tipo: 'ciudad', ciudad: 'Buenos Aires', pais: 'US' }, new Date().toISOString(), 3)).rejects.toThrow('No se encontró');
  });
});
