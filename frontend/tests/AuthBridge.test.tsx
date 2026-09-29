import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { sincronizarPerfilMock, estado } = vi.hoisted(() => ({
  sincronizarPerfilMock: vi.fn(async () => undefined),
  estado: {
    isAuthenticated: true,
    user: { sub: 'auth0|999', email: 'ana@example.com', name: 'Ana' } as { sub: string; email: string; name: string } | undefined,
  },
}));

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({
    user: estado.user,
    isAuthenticated: estado.isAuthenticated,
    getAccessTokenSilently: vi.fn(async () => 'token'),
  }),
}));

vi.mock('../src/services/usuarios', () => ({ sincronizarPerfil: sincronizarPerfilMock }));

import AuthBridge from '../src/auth/AuthBridge';

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
