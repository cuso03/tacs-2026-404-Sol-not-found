import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from './renderWithProviders';
import { activityFixture, weatherFixture } from './fixtures';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));
vi.mock('../src/services/api', () => ({ default: { get: getMock }, getApiErrorMessage: () => 'Error' }));

import WeatherPanel from '../src/components/WeatherPanel';

describe('WeatherPanel', () => {
  afterEach(() => { cleanup(); getMock.mockReset(); });

  it('muestra clima actual, pronóstico y evaluación de reglas', async () => {
    getMock.mockResolvedValue({ data: weatherFixture });
    renderWithProviders(<WeatherPanel activity={activityFixture} />);
    expect(await screen.findByText('Soleado')).toBeTruthy();
    expect(screen.getByText('Parcialmente nublado')).toBeTruthy();
    expect(screen.getByText('Pronóstico dentro de las reglas')).toBeTruthy();
    expect(getMock).toHaveBeenCalledWith('/actividades/actividad-1/clima');
  });
});