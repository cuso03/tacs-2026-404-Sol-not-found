import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import api, { setSessionExpiredHandler, setTokenGetter } from '../src/services/api';

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
    setSessionExpiredHandler(null);
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

describe('Deteccion de sesion vencida', () => {
  afterEach(() => {
    setTokenGetter(null);
    setSessionExpiredHandler(null);
    api.defaults.adapter = originalAdapter;
  });

  function fallarCon(respuesta: { status: number } | null) {
    api.defaults.adapter = async (config) =>
      Promise.reject(
        Object.assign(new Error('Request failed'), { response: respuesta ? { ...respuesta, data: {}, config } : undefined }),
      );
  }

  it('avisa al handler registrado cuando el backend responde 401', async () => {
    const handler = vi.fn();
    setSessionExpiredHandler(handler);
    fallarCon({ status: 401 });

    await expect(api.get('/usuarios/me/actividades')).rejects.toBeDefined();

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('no avisa cuando el backend esta caido (error de red, sin respuesta)', async () => {
    // Es el caso que pregunta el usuario: sin `response` no hay 401, asi que el
    // login no se re-dispara y la SPA no entra en loop.
    const handler = vi.fn();
    setSessionExpiredHandler(handler);
    fallarCon(null);

    await expect(api.get('/usuarios/me/actividades')).rejects.toBeDefined();

    expect(handler).not.toHaveBeenCalled();
  });

  it('no avisa ante otros errores HTTP', async () => {
    const handler = vi.fn();
    setSessionExpiredHandler(handler);
    fallarCon({ status: 500 });

    await expect(api.get('/usuarios/me/actividades')).rejects.toBeDefined();

    expect(handler).not.toHaveBeenCalled();
  });
});
