import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { activityFixture } from './fixtures';

const { getMock, postMock, deleteMock } = vi.hoisted(() => ({ getMock: vi.fn(), postMock: vi.fn(), deleteMock: vi.fn() }));

vi.mock('../src/services/api', () => ({
  default: { get: getMock, post: postMock, delete: deleteMock },
  CURRENT_USER_ID: 'auth0|user-1',
  getApiErrorMessage: (error: unknown) => error instanceof Error ? error.message : 'Error',
}));
vi.mock('../src/components/WeatherPanel', () => ({ default: () => <div>Panel de clima</div> }));
vi.mock('../src/components/VotingPanel', () => ({ default: () => <div>Panel de votación</div> }));

import ActivityDetail from '../src/pages/ActivityDetail';

function renderDetail() {
  return render(<MemoryRouter initialEntries={['/actividades/actividad-1']}><Routes><Route path="/actividades/:id" element={<ActivityDetail />} /></Routes></MemoryRouter>);
}

describe('ActivityDetail - participantes', () => {
  beforeEach(() => { getMock.mockReset(); postMock.mockReset(); deleteMock.mockReset(); });
  afterEach(cleanup);

  it('permite sumarse si hay cupo y actualiza la actividad', async () => {
    getMock.mockResolvedValue({ data: activityFixture });
    postMock.mockResolvedValue({ data: { ...activityFixture, participantes: [...activityFixture.participantes, 'auth0|user-1'] } });
    renderDetail();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Sumarme' }));
    expect(postMock).toHaveBeenCalledWith('/actividades/actividad-1/participantes');
    expect(await screen.findByRole('button', { name: 'Bajarme' })).toBeTruthy();
  });

  it('permite liberar el cupo propio', async () => {
    const joined = { ...activityFixture, participantes: [...activityFixture.participantes, 'auth0|user-1'] };
    getMock.mockResolvedValue({ data: joined });
    deleteMock.mockResolvedValue({ data: activityFixture });
    renderDetail();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Bajarme' }));
    expect(deleteMock).toHaveBeenCalledWith('/actividades/actividad-1/participantes/me');
    expect(await screen.findByRole('button', { name: 'Sumarme' })).toBeTruthy();
  });
});
