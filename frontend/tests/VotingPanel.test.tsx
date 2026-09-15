import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    const onChange = vi.fn();
    postMock.mockResolvedValue({ data: { ...activityFixture, estado: 'EN_VOTACION', votaciones: [openVoting] } });
    render(<VotingPanel activity={activityFixture} onActivityChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir votación' }));
    expect(postMock).toHaveBeenCalledWith('/actividades/actividad-1/votaciones', { duracion_horas: 24 });
    expect(onChange).toHaveBeenCalled();
  });

  it('registra el voto y actualiza los resultados parciales', async () => {
    const votingActivity = { ...activityFixture, estado: 'EN_VOTACION' as const, votaciones: [openVoting] };
    const voted = { ...openVoting, votos: { 'auth0|organizador': 'alternativa-1' } };
    getMock.mockResolvedValue({ data: { ...resultsFixture, votacion: voted, conteo: { 'alternativa-1': 1, 'alternativa-2': 0 }, totalVotos: 1 } });
    putMock.mockResolvedValue({ data: voted });
    render(<VotingPanel activity={votingActivity} onActivityChange={vi.fn()} />);
    await userEvent.click(screen.getAllByRole('button', { name: 'Votar' })[0]);
    expect(putMock).toHaveBeenCalledWith('/actividades/actividad-1/votaciones/votacion-1/votos/me', { alternativa_id: 'alternativa-1' });
    expect(await screen.findByText('Tu voto fue registrado. Podés cambiarlo mientras la votación siga abierta.')).toBeTruthy();
  });

  it('permite al organizador cerrar y resolver la votación', async () => {
    const onChange = vi.fn();
    const votingActivity = { ...activityFixture, estado: 'EN_VOTACION' as const, votaciones: [openVoting] };
    getMock.mockResolvedValue({ data: resultsFixture });
    patchMock.mockResolvedValue({ data: { ...votingActivity, estado: 'CANCELADA', votaciones: [{ ...openVoting, estado: 'CERRADA' }] } });
    render(<VotingPanel activity={votingActivity} onActivityChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar y resolver' }));
    await waitFor(() => expect(patchMock).toHaveBeenCalledWith('/actividades/actividad-1/votaciones/votacion-1', { estado: 'CERRADA' }));
    expect(onChange).toHaveBeenCalled();
  });
});
