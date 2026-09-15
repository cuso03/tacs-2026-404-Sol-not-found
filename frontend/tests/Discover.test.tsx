import { cleanup, render, screen } from '@testing-library/react';
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
});
