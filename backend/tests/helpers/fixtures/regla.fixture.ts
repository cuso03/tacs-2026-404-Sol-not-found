import { ReglasClima } from '../../../src/interfaces/models/actividad';

export const DEFAULT_REGLAS_CLIMA: ReglasClima = {
  probabilidad_lluvia_max: 40,
  temperatura_min: 12,
  temperatura_max: 28,
  viento_max: 35,
  horas_anticipacion: 24,
  dias_max_reprogramacion: 3,
  rango_horario: {
    horario_min: '10:00',
    horario_max: '20:00',
  },
};

/**
 * Genera un payload de reglas climáticas válido combinando defaults con overrides.
 */
export function createReglasPayload(overrides: Partial<ReglasClima> = {}): ReglasClima {
  return {
    ...DEFAULT_REGLAS_CLIMA,
    ...overrides,
    rango_horario: {
      ...DEFAULT_REGLAS_CLIMA.rango_horario,
      ...(overrides.rango_horario ?? {}),
    },
  };
}
