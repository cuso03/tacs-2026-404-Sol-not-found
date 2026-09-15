import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { postMock, putMock } = vi.hoisted(() => ({ postMock: vi.fn(), putMock: vi.fn() }));

vi.mock('../src/services/api', () => ({
  default: { post: postMock, put: putMock },
  getApiErrorMessage: (error: unknown) => error instanceof Error ? error.message : 'Error',
}));

vi.mock('../src/components/LocationPicker', () => ({
  default: ({ onChange }: { onChange: (location: { latitud: number; longitud: number; direccion: string }) => void }) => (
    <button type="button" onClick={() => onChange({ latitud: -34.6037, longitud: -58.3816, direccion: 'Plaza de Mayo, Buenos Aires' })}>
      Seleccionar ubicación de prueba
    </button>
  ),
}));

import CreateActivityModal from '../src/components/CreateActivityModal';

const activityResponse = {
  id: 'actividad-1',
  titulo: 'Caminata urbana',
  descripcion: 'Recorrido por el centro',
  tipo: 'aire_libre',
  ubicacion: { tipo: 'coordenadas', latitud: -34.6037, longitud: -58.3816, direccion: 'Plaza de Mayo, Buenos Aires' },
  fecha_horario: '2026-10-20T18:30:00.000Z',
  min_participantes: 2,
  max_participantes: 10,
  creadorId: 'auth0|user-1',
  creadaEn: '2026-09-15T10:00:00.000Z',
  estado: 'PROPUESTA',
  participantes: ['auth0|user-1'],
};

describe('CreateActivityModal', () => {
  beforeEach(() => {
    postMock.mockReset();
    putMock.mockReset();
  });
  afterEach(cleanup);

  async function fillActivityStep() {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Título'), 'Caminata urbana');
    await user.type(screen.getByLabelText('Descripción'), 'Recorrido por el centro');
    fireEvent.change(screen.getByLabelText('Fecha y hora'), { target: { value: '2026-10-20T18:30' } });
    await user.click(screen.getByRole('button', { name: 'Seleccionar ubicación de prueba' }));
    return user;
  }

  it('valida los cupos de la actividad antes de avanzar', async () => {
    render(<CreateActivityModal isOpen onClose={vi.fn()} />);
    const user = await fillActivityStep();
    await user.clear(screen.getByLabelText('Máximo de participantes'));
    await user.type(screen.getByLabelText('Máximo de participantes'), '1');
    await user.click(screen.getByRole('button', { name: 'Continuar a reglas' }));
    expect(screen.getByText('El cupo máximo debe ser mayor o igual al mínimo.')).toBeTruthy();
  });

  it('crea la actividad con coordenadas del mapa y configura sus reglas', async () => {
    postMock.mockResolvedValue({ data: activityResponse });
    putMock.mockResolvedValue({ data: { ...activityResponse, reglasClima: {} } });
    render(<CreateActivityModal isOpen onClose={vi.fn()} />);
    const user = await fillActivityStep();
    await user.click(screen.getByRole('button', { name: 'Continuar a reglas' }));
    const submitButton = screen.getByRole('button', { name: 'Crear actividad' });
    fireEvent.submit(submitButton.closest('form')!);

    expect(await screen.findByText('Actividad lista')).toBeTruthy();
    expect(postMock).toHaveBeenCalledWith('/actividades', expect.objectContaining({
      ubicacion: {
        tipo: 'coordenadas',
        latitud: -34.6037,
        longitud: -58.3816,
        direccion: 'Plaza de Mayo, Buenos Aires',
      },
    }));
    expect(putMock).toHaveBeenCalledWith('/actividades/actividad-1/reglas', expect.objectContaining({ horas_anticipacion: 24 }));
  });

  const invalidRuleCases: Array<{ name: string; changes: Array<[string, string]>; message: string }> = [
    { name: 'lluvia fuera de rango', changes: [['Lluvia máxima (%)', '-1']], message: 'La probabilidad de lluvia debe estar entre 0 y 100%.' },
    { name: 'temperaturas invertidas', changes: [['Temperatura mínima (°C)', '35'], ['Temperatura máxima (°C)', '20']], message: 'La temperatura máxima debe ser mayor o igual a la mínima.' },
    { name: 'viento negativo', changes: [['Viento máximo (km/h)', '-1']], message: 'Viento, anticipación y reprogramación deben tener valores válidos.' },
    { name: 'anticipación nula', changes: [['Avisar con anticipación (h)', '0']], message: 'Viento, anticipación y reprogramación deben tener valores válidos.' },
    { name: 'reprogramación nula', changes: [['Reprogramar hasta (días)', '0']], message: 'Viento, anticipación y reprogramación deben tener valores válidos.' },
    { name: 'horarios invertidos', changes: [['Horario desde', '21:00'], ['Horario hasta', '20:00']], message: 'El horario máximo debe ser posterior al mínimo.' },
  ];

  it.each(invalidRuleCases)('no persiste con $name', async ({ changes, message }) => {
    render(<CreateActivityModal isOpen onClose={vi.fn()} />);
    const user = await fillActivityStep();
    await user.click(screen.getByRole('button', { name: 'Continuar a reglas' }));
    for (const [label, value] of changes) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    const submitButton = screen.getByRole('button', { name: 'Crear actividad' });
    fireEvent.submit(submitButton.closest('form')!);
    expect(await screen.findByText(message)).toBeTruthy();
    expect(postMock).not.toHaveBeenCalled();
  });
});
