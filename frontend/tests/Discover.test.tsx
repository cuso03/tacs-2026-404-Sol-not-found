import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { activityFixture } from './fixtures';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));
vi.mock('../src/services/api', () => ({ default: { get: getMock }, getApiErrorMessage: () => 'Error' }));

import Discover from '../src/pages/Discover';

describe('Discover', () => {
  afterEach(() => { cleanup(); getMock.mockReset(); });

  it('consulta y presenta actividades navegables', async () => {
    getMock.mockResolvedValue({ data: { data: [activityFixture], meta: { total: 1, page: 1, limit: 9, totalPages: 1 } } });
    render(<MemoryRouter><Routes><Route element={<Outlet context={{ refreshVersion: 0 }} />}><Route index element={<Discover />} /></Route></Routes></MemoryRouter>);
    expect(await screen.findByText('Caminata urbana')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Ver actividad/ }).getAttribute('href')).toBe('/actividades/actividad-1');
    expect(getMock).toHaveBeenCalledWith('/actividades', expect.objectContaining({ params: { page: 1, limit: 9 } }));
  });

  it('envía los filtros de tipo, ubicación y fecha al backend', async () => {
    getMock.mockResolvedValue({ data: { data: [activityFixture], meta: { total: 1, page: 1, limit: 9, totalPages: 1 } } });
    render(<MemoryRouter><Routes><Route element={<Outlet context={{ refreshVersion: 0 }} />}><Route index element={<Discover />} /></Route></Routes></MemoryRouter>);

    await screen.findByText('Caminata urbana');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Ubicación'), 'Buenos Aires');
    await user.selectOptions(screen.getByLabelText('Tipo'), 'aire_libre');
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-01' } });

    await waitFor(() => expect(getMock).toHaveBeenCalledWith('/actividades', expect.objectContaining({
      params: {
        page: 1,
        limit: 9,
        ubicacion: 'Buenos Aires',
        tipo: 'aire_libre',
        fecha_desde: new Date('2026-10-01T00:00:00').toISOString(),
      },
    })));
  });

  it('solicita la página siguiente conservando la paginación de la API', async () => {
    getMock.mockResolvedValue({ data: { data: [activityFixture], meta: { total: 12, page: 1, limit: 9, totalPages: 2 } } });
    render(<MemoryRouter><Routes><Route element={<Outlet context={{ refreshVersion: 0 }} />}><Route index element={<Discover />} /></Route></Routes></MemoryRouter>);

    await screen.findByText('Caminata urbana');
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    await waitFor(() => expect(getMock).toHaveBeenCalledWith('/actividades', expect.objectContaining({ params: { page: 2, limit: 9 } })));
  });
});
