import { afterEach, describe, expect, it, vi } from 'vitest';
import { VisualCrossingAdapter } from '../src/utils/visualCrossingAdapter';

const location = { tipo: 'coordenadas' as const, latitud: -34.6, longitud: -58.4 };
const time = () => Math.ceil(Date.now() / 3600000) * 3600 + 86400;
function data(epoch: number) {
  return { timezone: 'America/Argentina/Buenos_Aires', currentConditions: { datetimeEpoch: epoch, temp: 20, windspeed: 36, humidity: 75, icon: 'partly-cloudy-day' }, days: [{ hours: [{ datetimeEpoch: epoch, temp: 18, windspeed: 24, precipprob: 80, icon: 'rain' }] }] };
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Visual Crossing', () => {
  it('adapta clima real y alternativas horarias con unidades métricas y offset local', async () => {
    const epoch = time();
    const fetchMock = vi.fn(async (_url: string) => ({ ok: true, json: async () => data(epoch) }));
    vi.stubGlobal('fetch', fetchMock);
    const adapter = new VisualCrossingAdapter('test-key');
    const weather = await adapter.getClima(location, new Date(epoch * 1000 + 1800000).toISOString());
    expect(weather.clima_actual).toEqual({ temperatura: 20, viento: 36, humedad: 75, condicion: 'PARCIALMENTE_NUBLADO' });
    expect(weather.pronostico_actividad).toEqual({ temperatura: 18, viento: 24, probabilidad_lluvia: 80, condicion: 'LLUVIA' });
    const hours = await adapter.obtenerPronostico(location, new Date().toISOString(), 365);
    expect(hours).toHaveLength(1);
    expect(hours[0].fecha).toMatch(/-03:00$/);
    expect(Date.parse(hours[0].fecha)).toBe(epoch * 1000);
    expect(hours[0].viento).toBe(24);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.hostname).toBe('weather.visualcrossing.com');
    expect(url.searchParams.get('unitGroup')).toBe('metric');
    expect(url.searchParams.get('include')).toBe('current,days,hours');
    expect(url.searchParams.get('key')).toBe('test-key');
  });

  it('comparte solicitudes concurrentes y renueva la caché al vencer', async () => {
    const now = Date.now();
    const epoch = time();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => data(epoch) }));
    vi.stubGlobal('fetch', fetchMock);
    const adapter = new VisualCrossingAdapter('test-key');
    const date = new Date(epoch * 1000).toISOString();
    await Promise.all([adapter.getClima(location, date), adapter.getClima(location, date)]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    clock.mockReturnValue(now + 600001);
    await adapter.getClima(location, date);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('no transforma datos incompletos en ceros ni inventa pronósticos fuera de rango', async () => {
    const epoch = time();
    const body = data(epoch);
    body.days[0].hours[0].precipprob = null as unknown as number;
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => body })));
    const adapter = new VisualCrossingAdapter('test-key');
    await expect(adapter.getClima(location, new Date(epoch * 1000).toISOString())).rejects.toMatchObject({ code: 'WEATHER_INVALID_RESPONSE' });
    expect(await adapter.obtenerPronostico(location, new Date().toISOString(), 3)).toEqual([]);
    await expect(adapter.getClima(location, new Date(Date.now() + 30 * 86400000).toISOString())).rejects.toMatchObject({ code: 'WEATHER_DATE_UNAVAILABLE' });
  });

  it.each([401, 403, 429, 500])('clasifica HTTP %s sin filtrar la API key', async status => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status })));
    const adapter = new VisualCrossingAdapter('secret-test-key');
    await expect(adapter.getClima(location, new Date(time() * 1000).toISOString())).rejects.toMatchObject({ code: status === 429 ? 'WEATHER_RATE_LIMITED' : status === 500 ? 'WEATHER_PROVIDER_UNAVAILABLE' : 'WEATHER_CONFIGURATION_ERROR', upstreamStatus: status });
  });

  it('pausa ante 429 y respeta Retry-After', async () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    const epoch = time();
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false, status: 429, headers: new Headers({ 'retry-after': '120' }) }).mockResolvedValue({ ok: true, json: async () => data(epoch) });
    vi.stubGlobal('fetch', fetchMock);
    const adapter = new VisualCrossingAdapter('test-key');
    const date = new Date(epoch * 1000).toISOString();
    await expect(adapter.getClima(location, date)).rejects.toMatchObject({ code: 'WEATHER_RATE_LIMITED' });
    clock.mockReturnValue(now + 60000);
    await expect(adapter.getClima(location, date)).rejects.toMatchObject({ code: 'WEATHER_RATE_LIMITED' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    clock.mockReturnValue(now + 120001);
    await adapter.getClima(location, date);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('requiere clave y sanea los errores de red', async () => {
    const fetchMock = vi.fn(async () => { throw new Error('URL con key=secret-test-key'); });
    vi.stubGlobal('fetch', fetchMock);
    await expect(new VisualCrossingAdapter('').getClima(location, new Date(time() * 1000).toISOString())).rejects.toMatchObject({ code: 'WEATHER_CONFIGURATION_ERROR' });
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(new VisualCrossingAdapter('secret-test-key').getClima(location, new Date(time() * 1000).toISOString())).rejects.toThrow('No se pudo conectar con Visual Crossing');
  });
});
