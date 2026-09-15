import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));
vi.mock('../src/services/api', () => ({ default: { get: getMock }, getApiErrorMessage: () => 'Error' }));

import Dashboard from '../src/pages/Dashboard';

describe('Dashboard', () => {
  afterEach(() => { cleanup(); getMock.mockReset(); });

  it('muestra rol, estado y votación abierta del usuario', async () => {
    getMock.mockResolvedValue({ data: { data: [{ id: 'actividad-1', titulo: 'Caminata urbana', fecha_horario: '2026-10-20T18:30:00.000Z', rol: 'organizador', estado: 'EN_VOTACION', votacion_abierta: true }], meta: { total: 1, page: 1, limit: 10, totalPages: 1 } } });
    render(<MemoryRouter initialEntries={['/dashboard']}><Routes><Route element={<Outlet context={{ refreshVersion: 0 }} />}><Route path="dashboard" element={<Dashboard />} /></Route></Routes></MemoryRouter>);
    expect(await screen.findByText('Caminata urbana')).toBeTruthy();
    expect(screen.getByText('Organizador')).toBeTruthy();
    expect(screen.getByText('Votación abierta')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Caminata urbana/ }).getAttribute('href')).toBe('/actividades/actividad-1');
  });
});
