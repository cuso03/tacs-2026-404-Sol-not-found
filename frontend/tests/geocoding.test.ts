import { afterEach, describe, expect, it, vi } from 'vitest';
import { geocodeAddress } from '../src/services/geocoding';

describe('geocodeAddress', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('convierte el primer resultado del buscador en coordenadas exactas', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ lat: '-34.6083', lon: '-58.4337', display_name: 'Plaza Irlanda, Buenos Aires, Argentina' }],
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(geocodeAddress('Plaza Irlanda, Buenos Aires')).resolves.toEqual({
      latitud: -34.6083,
      longitud: -58.4337,
      direccion: 'Plaza Irlanda, Buenos Aires, Argentina',
    });
    const requestedUrl = new URL(fetchMock.mock.calls[0][0]);
    expect(requestedUrl.searchParams.get('q')).toBe('Plaza Irlanda, Buenos Aires');
    expect(requestedUrl.searchParams.get('limit')).toBe('1');
  });

  it('rechaza búsquedas demasiado cortas sin consultar el servicio externo', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(geocodeAddress(' x ')).rejects.toThrow('Ingresá al menos 3 caracteres');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
