import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../src/services/api';

const { sincronizarPerfilMock, getAccessTokenSilentlyMock, loginWithRedirectMock, estado } = vi.hoisted(() => ({
  sincronizarPerfilMock: vi.fn(async () => undefined),
  getAccessTokenSilentlyMock: vi.fn(async (): Promise<string> => 'token'),
  loginWithRedirectMock: vi.fn(async (): Promise<void> => undefined),
  estado: {
    isAuthenticated: true,
    user: { sub: 'auth0|999', email: 'ana@example.com', name: 'Ana' } as { sub: string; email: string; name: string } | undefined,
  },
}));

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({
    user: estado.user,
    isAuthenticated: estado.isAuthenticated,
    getAccessTokenSilently: getAccessTokenSilentlyMock,
    loginWithRedirect: loginWithRedirectMock,
  }),
}));

vi.mock('../src/services/usuarios', () => ({ sincronizarPerfil: sincronizarPerfilMock }));

import AuthBridge from '../src/auth/AuthBridge';

const originalAdapter = api.defaults.adapter;

/** Adapter que siempre responde 401, como lo haría un backend que rechaza el token. */
function responder401() {
  api.defaults.adapter = async (config) =>
    Promise.reject(Object.assign(new Error('Unauthorized'), { response: { status: 401, data: {}, config } }));
}

describe('AuthBridge — sincronización de perfil (RF-10)', () => {
  beforeEach(() => {
    sincronizarPerfilMock.mockClear();
    estado.isAuthenticated = true;
    estado.user = { sub: 'auth0|999', email: 'ana@example.com', name: 'Ana' };
  });
  afterEach(cleanup);

  it('sincroniza el perfil una sola vez tras iniciar sesión', async () => {
    const { rerender } = render(<AuthBridge />);

    await waitFor(() => expect(sincronizarPerfilMock).toHaveBeenCalledTimes(1));
    expect(sincronizarPerfilMock).toHaveBeenCalledWith({ email: 'ana@example.com', nombre: 'Ana' });

    // Auth0 re-emite un objeto de usuario nuevo; el guard debe evitar re-sincronizar.
    estado.user = { ...estado.user! };
    rerender(<AuthBridge />);
    rerender(<AuthBridge />);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(sincronizarPerfilMock).toHaveBeenCalledTimes(1);
  });

  it('no sincroniza si no hay sesión', async () => {
    estado.isAuthenticated = false;
    estado.user = undefined;

    render(<AuthBridge />);

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(sincronizarPerfilMock).not.toHaveBeenCalled();
  });

  it('reintenta si la sincronización falla', async () => {
    sincronizarPerfilMock.mockRejectedValueOnce(new Error('503'));

    const { rerender } = render(<AuthBridge />);

    await waitFor(() => expect(sincronizarPerfilMock).toHaveBeenCalledTimes(1));
    estado.user = { ...estado.user! };
    rerender(<AuthBridge />);
    await waitFor(() => expect(sincronizarPerfilMock).toHaveBeenCalledTimes(2));
    expect(sincronizarPerfilMock).toHaveBeenLastCalledWith({ email: 'ana@example.com', nombre: 'Ana' });
  });
});

describe('AuthBridge — recuperación de sesión (RF-7)', () => {
  beforeEach(() => {
    sincronizarPerfilMock.mockClear();
    getAccessTokenSilentlyMock.mockReset();
    getAccessTokenSilentlyMock.mockResolvedValue('token');
    loginWithRedirectMock.mockClear();
    window.sessionStorage.clear();
    estado.isAuthenticated = true;
    estado.user = { sub: 'auth0|999', email: 'ana@example.com', name: 'Ana' };
    responder401();
  });

  afterEach(() => {
    cleanup();
    api.defaults.adapter = originalAdapter;
  });

  it('vuelve a autenticar cuando la sesión ya no se puede renovar', async () => {
    getAccessTokenSilentlyMock.mockRejectedValue(new Error('login_required'));

    render(<AuthBridge />);
    await expect(api.get('/usuarios/me/actividades')).rejects.toBeDefined();

    await waitFor(() => expect(loginWithRedirectMock).toHaveBeenCalledTimes(1));
  });

  it('no redirige cuando el token sigue válido: el 401 viene de la configuración del API', async () => {
    // El SDK renueva el token sin problema, asi que el 401 no es una sesion vencida:
    // redirigir al login solo produciria un loop infinito.
    render(<AuthBridge />);
    await expect(api.get('/usuarios/me/actividades')).rejects.toBeDefined();

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(loginWithRedirectMock).not.toHaveBeenCalled();
  });

  it('no cicla aunque el re-login no resuelva el problema', async () => {
    getAccessTokenSilentlyMock.mockRejectedValue(new Error('login_required'));

    for (let intento = 1; intento <= 2; intento += 1) {
      render(<AuthBridge />);
      await expect(api.get('/usuarios/me/actividades')).rejects.toBeDefined();
      await waitFor(() => expect(loginWithRedirectMock).toHaveBeenCalledTimes(intento));
      cleanup(); // simula la vuelta de Auth0: el ref se reinicia, sessionStorage no
    }

    render(<AuthBridge />);
    await expect(api.get('/usuarios/me/actividades')).rejects.toBeDefined();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(loginWithRedirectMock).toHaveBeenCalledTimes(2);
  });
});
