import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { renderWithProviders } from './renderWithProviders';

const { logoutMock, auth0, accessToken } = vi.hoisted(() => ({
  logoutMock: vi.fn(),
  auth0: { sub: 'auth0|123', name: 'Ana Pérez', email: 'ana@example.com' },
  accessToken: { token: '' },
}));

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({
    user: auth0,
    isAuthenticated: true,
    logout: logoutMock,
    getAccessTokenSilently: vi.fn(async () => accessToken.token),
  }),
}));

vi.mock('../src/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  getApiErrorMessage: () => 'Error',
}));

import Layout from '../src/components/Layout';

/** Fabrica un JWT con el claim de roles en el payload (solo la forma, no la firma). */
function tokenConRoles(roles: string[]): string {
  const payload = window.btoa(JSON.stringify({ 'https://solnotfound.app/roles': roles }));
  return `encabezado.${payload}.firma`;
}

describe('Sesión de usuario en la interfaz', () => {
  beforeEach(() => { accessToken.token = ''; });
  afterEach(() => { cleanup(); logoutMock.mockReset(); });

  it('muestra el nombre del usuario autenticado en el header', async () => {
    renderWithProviders(<MemoryRouter><Layout /></MemoryRouter>);

    const usuario = await screen.findByTestId('usuario-autenticado');
    expect(usuario.textContent).toBe('Ana Pérez');
    expect(screen.getByText('Sesión iniciada con Auth0')).toBeTruthy();
    expect(screen.queryByText('Usuario demo')).toBeNull();
  });

  it('cierra la sesión con Auth0 al presionar Salir', async () => {
    renderWithProviders(<MemoryRouter><Layout /></MemoryRouter>);

    await userEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));

    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(logoutMock).toHaveBeenCalledWith({ logoutParams: { returnTo: window.location.origin } });
  });

  it('muestra la pestaña de administración solo con el rol admin en el token', async () => {
    accessToken.token = tokenConRoles(['admin']);
    renderWithProviders(<MemoryRouter><Layout /></MemoryRouter>);

    expect((await screen.findAllByRole('link', { name: /Administración/ })).length).toBeGreaterThan(0);
  });

  it('oculta la pestaña de administración sin el rol admin', async () => {
    accessToken.token = tokenConRoles(['participante']);
    renderWithProviders(<MemoryRouter><Layout /></MemoryRouter>);

    await waitFor(() => expect(screen.queryAllByRole('link', { name: /Administración/ })).toHaveLength(0));
  });

  it('oculta la pestaña de administración si el token no trae roles', async () => {
    accessToken.token = `encabezado.${window.btoa(JSON.stringify({ sub: 'x' }))}.firma`;
    renderWithProviders(<MemoryRouter><Layout /></MemoryRouter>);

    await waitFor(() => expect(screen.queryAllByRole('link', { name: /Administración/ })).toHaveLength(0));
  });
});
