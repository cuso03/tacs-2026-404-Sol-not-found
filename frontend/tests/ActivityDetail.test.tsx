import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { renderWithProviders } from './renderWithProviders';
import { activityFixture } from './fixtures';

const { getMock, postMock, deleteMock, putMock } = vi.hoisted(() => ({ getMock: vi.fn(), postMock: vi.fn(), deleteMock: vi.fn(), putMock: vi.fn() }));

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({
    user: { sub: 'auth0|user-1', email: 'user1@example.com', name: 'User Uno' },
    isAuthenticated: true,
    getAccessTokenSilently: vi.fn(async () => 'token'),
    logout: vi.fn(),
  }),
}));

vi.mock('../src/services/api', () => ({
  default: { get: getMock, post: postMock, delete: deleteMock, put: putMock },
  getApiErrorMessage: (error: unknown) => error instanceof Error ? error.message : 'Error',
}));
vi.mock('../src/components/LocationPicker', () => ({ default: () => <div>Selector de ubicación</div> }));
vi.mock('../src/components/WeatherPanel', () => ({ default: () => <div>Panel de clima</div> }));
vi.mock('../src/components/VotingPanel', () => ({ default: () => <div>Panel de votación</div> }));

import ActivityDetail from '../src/pages/ActivityDetail';

function renderDetail() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/actividades/actividad-1']}>
      <Routes>
        <Route path="/actividades/:id" element={<ActivityDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ActivityDetail - participantes', () => {
  beforeEach(() => { getMock.mockReset(); postMock.mockReset(); deleteMock.mockReset(); putMock.mockReset(); });
  afterEach(cleanup);

  it('permite sumarse si hay cupo y actualiza la actividad', async () => {
    let current = activityFixture;
    getMock.mockImplementation(async () => ({ data: current }));
    postMock.mockImplementation(async () => {
      current = { ...activityFixture, participantes: [...activityFixture.participantes, 'auth0|user-1'] };
      return { data: current };
    });
    renderDetail();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Sumarme' }));
    expect(postMock).toHaveBeenCalledWith('/actividades/actividad-1/participantes');
    const feedback = await screen.findByRole('status');
    expect(feedback.className).toContain('text-emerald-800');
    expect(feedback.className).not.toContain('text-rose-800');
    expect(await screen.findByRole('button', { name: 'Bajarme' })).toBeTruthy();
  });

  it('permite liberar el cupo propio', async () => {
    let current = { ...activityFixture, participantes: [...activityFixture.participantes, 'auth0|user-1'] };
    getMock.mockImplementation(async () => ({ data: current }));
    deleteMock.mockImplementation(async () => {
      current = activityFixture;
      return { data: current };
    });
    renderDetail();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Bajarme' }));
    expect(deleteMock).toHaveBeenCalledWith('/actividades/actividad-1/participantes/me');
    expect(await screen.findByRole('button', { name: 'Sumarme' })).toBeTruthy();
  });

  it('deshabilita la inscripción cuando no quedan cupos', async () => {
    getMock.mockResolvedValue({ data: { ...activityFixture, max_participantes: 1 } });
    renderDetail();
    const button = await screen.findByRole('button', { name: 'Sin cupos' });
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(postMock).not.toHaveBeenCalled();
  });

  it('presenta el error del backend si la inscripción es rechazada', async () => {
    getMock.mockResolvedValue({ data: activityFixture });
    postMock.mockRejectedValue(new Error('El usuario ya participa en la actividad.'));
    renderDetail();
    await userEvent.click(await screen.findByRole('button', { name: 'Sumarme' }));
    expect(await screen.findByText('El usuario ya participa en la actividad.')).toBeTruthy();
  });

  it('muestra un estado de error cuando la actividad no existe', async () => {
    getMock.mockRejectedValue(new Error('La actividad no existe.'));
    renderDetail();
    expect(await screen.findByText('La actividad no existe.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
  });

  it('no ofrece controles de inscripción al organizador', async () => {
    getMock.mockResolvedValue({ data: { ...activityFixture, creadorId: 'auth0|user-1', participantes: ['auth0|user-1'] } });
    renderDetail();
    expect(await screen.findByText('Sos el organizador')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sumarme' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Bajarme' })).toBeNull();
  });
  it('permite modificar los datos desde el detalle del organizador', async () => {
    let current = { ...activityFixture, creadorId: 'auth0|user-1', participantes: ['auth0|user-1'] };
    getMock.mockImplementation(async () => ({ data: current }));
    putMock.mockImplementation(async (_url, payload) => { current = { ...current, ...payload }; return { data: current }; });
    renderDetail();
    await userEvent.click(await screen.findByRole('button', { name: 'Modificar actividad' }));
    const title = screen.getByLabelText('Título');
    await userEvent.clear(title);
    await userEvent.type(title, 'Nuevo título');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByRole('heading', { name: 'Nuevo título' })).toBeTruthy();
    expect(putMock).toHaveBeenCalledWith('/actividades/actividad-1', expect.objectContaining({ titulo: 'Nuevo título', ubicacion: activityFixture.ubicacion }));
  });

  it('pide confirmar antes de eliminar la actividad', async () => {
    getMock.mockResolvedValue({ data: { ...activityFixture, creadorId: 'auth0|user-1' } });
    deleteMock.mockResolvedValue({});
    renderDetail();
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar actividad' }));
    expect(deleteMock).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar eliminación' }));
    expect(deleteMock).toHaveBeenCalledWith('/actividades/actividad-1');
  });

});