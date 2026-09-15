import api from './api';
import type { ClimaActividad } from '../types/api';

/** Consulta el clima actual y el pronóstico para el horario de una actividad. */
export async function getClimaActividad(activityId: string): Promise<ClimaActividad> {
  const { data } = await api.get<ClimaActividad>(`/actividades/${encodeURIComponent(activityId)}/clima`);
  return data;
}