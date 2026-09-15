import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from './renderWithProviders';
import { toDateTimeLocal } from '../src/lib/formatters';
import { activityFixture, openVoting, resultsFixture } from './fixtures';

const { getMock, postMock, putMock, patchMock } = vi.hoisted(() => ({ getMock: vi.fn(), postMock: vi.fn(), putMock: vi.fn(), patchMock: vi.fn() }));
vi.mock('../src/services/api', () => ({
  default: { get: getMock, post: postMock, put: putMock, patch: patchMock },
  CURRENT_USER_ID: 'auth0|organizador',
  getApiErrorMessage: (error: unknown) => error instanceof Error ? error.message : 'Error',
}));

import VotingPanel from '../src/components/VotingPanel';

describe('VotingPanel', () => {
  beforeEach(() => { getMock.mockReset(); postMock.mockReset(); putMock.mockReset(); patchMock.mockReset(); });
  afterEach(cleanup);

  it('abre una votación automática como organizador', async () => {
    postMock.mockResolvedValue({ data: { ...activityFixture, estado: 'EN_VOTACION', votaciones: [openVoting] } });
    renderWithProviders(<VotingPanel activity={activityFixture} />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir votación' }));
    await waitFor(() => expect(postMock).toHaveBeenCalledWith('/actividades/actividad-1/votaciones', { duracion_horas: 24 }));
    expect(await screen.findByText('La votación quedó abierta para todas las personas inscriptas.')).toBeTruthy();
  });

  it('registra el voto y actualiza los resultados parciales', async () => {
    const votingActivity = { ...activityFixture, estado: 'EN_VOTACION' as const, votaciones: [openVoting] };
    const voted = { ...openVoting, votos: { 'auth0|organizador': 'alternativa-1' } };
    getMock.mockResolvedValue({ data: { ...resultsFixture, votacion: voted, conteo: { 'alternativa-1': 1, 'alternativa-2': 0 }, totalVotos: 1 } });
    putMock.mockResolvedValue({ data: voted });
    renderWithProviders(<VotingPanel activity={votingActivity} />);
    await userEvent.click(screen.getAllByRole('button', { name: 'Votar' })[0]);
    await waitFor(() => expect(putMock).toHaveBeenCalledWith('/actividades/actividad-1/votaciones/votacion-1/votos/me', { alternativa_id: 'alternativa-1' }));
    expect(await screen.findByText('Tu voto fue registrado. Podés cambiarlo mientras la votación siga abierta.')).toBeTruthy();
  });

  it('permite al organizador cerrar y resolver la votación', async () => {
    const votingActivity = { ...activityFixture, estado: 'EN_VOTACION' as const, votaciones: [openVoting] };
    getMock.mockResolvedValue({ data: resultsFixture });
    patchMock.mockResolvedValue({ data: { ...votingActivity, estado: 'CANCELADA', votaciones: [{ ...openVoting, estado: 'CERRADA' }] } });
    renderWithProviders(<VotingPanel activity={votingActivity} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar y resolver' }));
    await waitFor(() => expect(patchMock).toHaveBeenCalledWith('/actividades/actividad-1/votaciones/votacion-1', { estado: 'CERRADA' }));
    expect(await screen.findByText('La votación se cerró y la actividad fue cancelada por falta de una alternativa ganadora con quórum.')).toBeTruthy();
  });

  it('abre una votación con alternativas manuales', async () => {
    postMock.mockResolvedValue({ data: { ...activityFixture, estado: 'EN_VOTACION', votaciones: [openVoting] } });
    renderWithProviders(<VotingPanel activity={activityFixture} />);

    await userEvent.click(screen.getByRole('button', { name: /Manual/ }));
    const selectedDate = '2026-10-21T18:30';
    fireEvent.change(screen.getByLabelText('Alternativa 1'), { target: { value: selectedDate } });
    await userEvent.click(screen.getByRole('button', { name: 'Abrir votación' }));

    await waitFor(() => expect(postMock).toHaveBeenCalledWith('/actividades/actividad-1/votaciones', {
      duracion_horas: 24,
      alternativas: [{ fecha_horario: new Date(selectedDate).toISOString() }],
    }));
  });

  it('carga sugerencias climáticas editables para la votación', async () => {
    const suggestedDate = '2026-10-21T18:30:00.000Z';
    getMock.mockResolvedValue({ data: { fechas: [suggestedDate] } });
    renderWithProviders(<VotingPanel activity={activityFixture} />);

    await userEvent.click(screen.getByRole('button', { name: /Manual/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Sugerir por clima' }));

    await waitFor(() => expect(getMock).toHaveBeenCalledWith('/actividades/actividad-1/fechas-disponibles'));
    expect((await screen.findByLabelText('Alternativa 1') as HTMLInputElement).value).toBe(toDateTimeLocal(suggestedDate));
    expect(screen.getByText(/Cargamos las alternativas con pronóstico favorable/)).toBeTruthy();
  });

  it('oculta acciones de organización y voto a un usuario ajeno', async () => {
    const votingActivity = {
      ...activityFixture,
      creadorId: 'auth0|otro-organizador',
      participantes: ['auth0|otro-organizador'],
      estado: 'EN_VOTACION' as const,
      votaciones: [openVoting],
    };
    getMock.mockResolvedValue({ data: resultsFixture });
    renderWithProviders(<VotingPanel activity={votingActivity} />);

    expect(await screen.findByText('Tenés que estar inscripto en la actividad para votar.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Abrir votación' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cerrar y resolver' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Votar' })).toBeNull();
  });
});