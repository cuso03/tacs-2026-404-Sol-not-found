import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CreateActivityModal from '../src/components/CreateActivityModal';

const activityResponse = {
  id: 'actividad-1', titulo: 'Caminata urbana', descripcion: 'Recorrido por el centro', tipo: 'aire_libre',
  ubicacion: { tipo: 'coordenadas', latitud: -34.6037, longitud: -58.3816 }, fecha_horario: '2026-10-20T18:30:00.000Z',
  min_participantes: 2, max_participantes: 10, creadorId: 'auth0|frontend-demo', creadaEn: '2026-09-15T10:00:00.000Z',
};

function jsonResponse(body: unknown, status: number): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe('CreateActivityModal', () => {
  const fetchMock = vi.fn();

  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); fetchMock.mockReset(); });

  async function fillActivityStep() {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Título'), 'Caminata urbana');
    await user.type(screen.getByLabelText('Descripción'), 'Recorrido por el centro');
    fireEvent.change(screen.getByLabelText('Fecha y hora'), { target: { value: '2026-10-20T18:30' } });
    fireEvent.change(screen.getByLabelText('Latitud'), { target: { value: '-34.6037' } });
    fireEvent.change(screen.getByLabelText('Longitud'), { target: { value: '-58.3816' } });
    return user;
  }

  it('valida los cupos de la actividad antes de avanzar', async () => {
    render(<CreateActivityModal isOpen onClose={vi.fn()} />);
    const user = await fillActivityStep();
    await user.clear(screen.getByLabelText('Máximo de participantes'));
    await user.type(screen.getByLabelText('Máximo de participantes'), '1');
    await user.click(screen.getByRole('button', { name: 'Continuar a reglas →' }));
    expect(screen.getByText('El cupo máximo debe ser mayor o igual al mínimo.')).toBeTruthy();
  });

  it('crea la actividad y configura sus reglas con los contratos del backend', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(activityResponse, 201))
      .mockResolvedValueOnce(jsonResponse({ ...activityResponse, reglasClima: {} }, 200));
    render(<CreateActivityModal isOpen onClose={vi.fn()} />);
    const user = await fillActivityStep();
    await user.click(screen.getByRole('button', { name: 'Continuar a reglas →' }));
    await user.click(screen.getByRole('button', { name: 'Crear actividad' }));

    expect(await screen.findByText('Actividad lista')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/actividades');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/actividades/actividad-1/reglas');
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'PUT' });
  });

  it('no persiste si el rango de temperaturas es inválido', async () => {
    render(<CreateActivityModal isOpen onClose={vi.fn()} />);
    const user = await fillActivityStep();
    await user.click(screen.getByRole('button', { name: 'Continuar a reglas →' }));
    fireEvent.change(screen.getByLabelText('Temperatura mínima (°C)'), { target: { value: '35' } });
    fireEvent.change(screen.getByLabelText('Temperatura máxima (°C)'), { target: { value: '20' } });
    await user.click(screen.getByRole('button', { name: 'Crear actividad' }));
    expect(await screen.findByText('La temperatura máxima debe ser mayor o igual a la mínima.')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
