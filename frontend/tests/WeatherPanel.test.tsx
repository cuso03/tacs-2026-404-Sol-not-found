import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { activityFixture, weatherFixture } from './fixtures';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));
vi.mock('../src/services/api', () => ({ default: { get: getMock }, getApiErrorMessage: () => 'Error' }));

import WeatherPanel from '../src/components/WeatherPanel';

describe('WeatherPanel', () => {
  afterEach(() => { cleanup(); getMock.mockReset(); });

  it('muestra clima actual, pronóstico y evaluación de reglas', async () => {
    getMock.mockResolvedValue({ data: weatherFixture });
    render(<WeatherPanel activity={activityFixture} />);
    expect(await screen.findByText('Soleado')).toBeTruthy();
    expect(screen.getByText('Parcialmente nublado')).toBeTruthy();
    expect(screen.getByText('Pronóstico dentro de las reglas')).toBeTruthy();
    expect(getMock).toHaveBeenCalledWith('/actividades/actividad-1/clima', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });
});
