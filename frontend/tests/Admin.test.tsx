import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from './renderWithProviders';

const { getMock, postMock } = vi.hoisted(() => ({ getMock: vi.fn(), postMock: vi.fn() }));
vi.mock('../src/services/api', () => ({
  default: { get: getMock, post: postMock },
  CURRENT_USER_ROLE: 'admin',
  getApiErrorMessage: () => 'Error',
}));

import Admin from '../src/pages/Admin';

describe('Admin', () => {
  beforeEach(() => { getMock.mockReset(); postMock.mockReset(); });
  afterEach(cleanup);

  it('muestra métricas y permite simular el monitoreo', async () => {
    getMock.mockResolvedValue({ data: { Actividad_Creada: 5, consultas_clima: 10 } });
    postMock.mockResolvedValue({ data: { mensaje: 'Monitoreo simulado ejecutado.', actividadEvaluada: 'Partido de Fútbol 5' } });
    renderWithProviders(<Admin />);
    expect(await screen.findByText('Actividad creada')).toBeTruthy();
    expect(screen.getByText('10')).toBeTruthy();
    expect(getMock).toHaveBeenCalledWith('/admin/estadisticas', expect.objectContaining({ headers: { 'X-User-Role': 'admin' } }));
    await userEvent.click(screen.getByRole('button', { name: 'Ejecutar simulación' }));
    expect(postMock).toHaveBeenCalledWith('/notificaciones/simular-inicio');
    expect(await screen.findByText('Partido de Fútbol 5')).toBeTruthy();
  });
});