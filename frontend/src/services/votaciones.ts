import api from './api';
import type { Actividad, ResultadosVotacion, Votacion } from '../types/api';

export interface AbrirVotacionPayload {
  duracion_horas: number;
  alternativas?: Array<{ fecha_horario: string }>;
}

/** Obtiene los resultados parciales y el estado de una votación. */
export async function getResultadosVotacion(activityId: string, votingId: string): Promise<ResultadosVotacion> {
  const { data } = await api.get<ResultadosVotacion>(`/actividades/${encodeURIComponent(activityId)}/votaciones/${encodeURIComponent(votingId)}`);
  return data;
}

/** Devuelve los horarios disponibles sugeridos por clima para manual/automático. */
export async function getFechasDisponibles(activityId: string): Promise<{ fechas: string[] }> {
  const { data } = await api.get<{ fechas: string[] }>(`/actividades/${encodeURIComponent(activityId)}/fechas-disponibles`);
  return data;
}

/** Abre una votación (con alternativas climáticas o manuales). */
export async function abrirVotacion(activityId: string, payload: AbrirVotacionPayload): Promise<Actividad> {
  const { data } = await api.post<Actividad>(`/actividades/${encodeURIComponent(activityId)}/votaciones`, payload);
  return data;
}

/** Registra el voto del usuario actual en una alternativa. */
export async function votar(activityId: string, votingId: string, alternativaId: string): Promise<Votacion> {
  const { data } = await api.put<Votacion>(`/actividades/${encodeURIComponent(activityId)}/votaciones/${encodeURIComponent(votingId)}/votos/me`, { alternativa_id: alternativaId });
  return data;
}

/** Cierra una votación y resuelve la reprogramación o cancelación. */
export async function cerrarVotacion(activityId: string, votingId: string): Promise<Actividad> {
  const { data } = await api.patch<Actividad>(`/actividades/${encodeURIComponent(activityId)}/votaciones/${encodeURIComponent(votingId)}`, { estado: 'CERRADA' });
  return data;
}