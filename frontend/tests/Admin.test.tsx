import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from './renderWithProviders';

const { getMock, postMock } = vi.hoisted(() => ({ getMock: vi.fn(), postMock: vi.fn() }));
vi.mock('../src/services/api', () => ({
  default: { get: getMock, post: postMock },
  getApiErrorMessage: () => 'Error',
}));

import Admin from '../src/pages/Admin';

describe('Admin', () => {
  beforeEach(() => { getMock.mockReset(); postMock.mockReset(); });
  afterEach(cleanup);

  it('muestra métricas sin ofrecer simulaciones', async () => {
    getMock.mockResolvedValue({ data: { Actividad_Creada: 5, consultas_clima: 10 } });
    postMock.mockResolvedValue({ data: { mensaje: 'Monitoreo simulado ejecutado.', actividadEvaluada: 'Partido de Fútbol 5' } });
    renderWithProviders(<Admin />);
    expect(await screen.findByText('Actividad creada')).toBeTruthy();
    expect(screen.getByText('10')).toBeTruthy();
    expect(getMock).toHaveBeenCalledWith('/admin/estadisticas');
    expect(screen.queryByRole('button', { name: 'Ejecutar simulación' })).toBeNull();
    expect(postMock).not.toHaveBeenCalled();
  });
});
