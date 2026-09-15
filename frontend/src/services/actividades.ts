import api from './api';
import type { Actividad, CrearActividadPayload, PaginatedResponse, ReglasClimaPayload } from '../types/api';

/** Busca actividades del catálogo público con filtros y paginación. */
export async function searchActividades(params: Record<string, string | number>): Promise<PaginatedResponse<Actividad>> {
  const { data } = await api.get<PaginatedResponse<Actividad>>('/actividades', { params });
  return data;
}

/** Obtiene el detalle completo de una actividad. */
export async function getActividad(id: string): Promise<Actividad> {
  const { data } = await api.get<Actividad>(`/actividades/${encodeURIComponent(id)}`);
  return data;
}

/** Crea una actividad y la deja lista para configurar sus reglas climáticas. */
export async function createActividad(payload: CrearActividadPayload): Promise<Actividad> {
  const { data } = await api.post<Actividad>('/actividades', payload);
  return data;
}

/** Asocia o reemplaza las reglas climáticas de una actividad. */
export async function configureReglas(id: string, rules: ReglasClimaPayload): Promise<Actividad> {
  const { data } = await api.put<Actividad>(`/actividades/${encodeURIComponent(id)}/reglas`, rules);
  return data;
}

/** Inscribe al usuario actual como participante. */
export async function joinActividad(id: string): Promise<Actividad> {
  const { data } = await api.post<Actividad>(`/actividades/${encodeURIComponent(id)}/participantes`);
  return data;
}

/** Retira al usuario actual de la lista de participantes. */
export async function leaveActividad(id: string): Promise<Actividad> {
  const { data } = await api.delete<Actividad>(`/actividades/${encodeURIComponent(id)}/participantes/me`);
  return data;
}