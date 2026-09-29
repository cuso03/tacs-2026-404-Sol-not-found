import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { afterEach, describe, expect, it } from 'vitest';
import api, { setTokenGetter } from '../src/services/api';

type Adapter = (config: InternalAxiosRequestConfig) => Promise<AxiosResponse>;

const originalAdapter = api.defaults.adapter;
let requests: InternalAxiosRequestConfig[] = [];

function instalarAdapter() {
  requests = [];
  const adapter: Adapter = async (config) => {
    requests.push(config);
    return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
  };
  api.defaults.adapter = adapter;
}

function headerDe(index: number, nombre: string): unknown {
  const headers = requests[index].headers as unknown as Record<string, unknown> & { get: (name: string) => unknown };
  return headers[nombre] ?? headers.get(nombre);
}

describe('Token de Auth0 en las requests', () => {
  afterEach(() => {
    setTokenGetter(null);
    api.defaults.adapter = originalAdapter;
  });

  it('agrega Authorization: Bearer cuando hay getter con token (RF-7)', async () => {
    instalarAdapter();
    setTokenGetter(async () => 'token-de-prueba');

    await api.get('/usuarios/me/actividades');

    expect(requests).toHaveLength(1);
    expect(headerDe(0, 'Authorization')).toBe('Bearer token-de-prueba');
  });

  it('no agrega Authorization si el getter no devuelve token', async () => {
    instalarAdapter();
    setTokenGetter(async () => null);

    await api.get('/usuarios/me/actividades');

    expect(headerDe(0, 'Authorization')).toBeUndefined();
  });

  it('no agrega Authorization si no hay getter registrado', async () => {
    instalarAdapter();

    await api.get('/usuarios/me/actividades');

    expect(headerDe(0, 'Authorization')).toBeUndefined();
  });
});
