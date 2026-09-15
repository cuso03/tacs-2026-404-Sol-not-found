import api from './api';
import type { ActividadResumenUsuario, PaginatedResponse } from '../types/api';

export interface MisActividadesParams {
  page: number;
  limit: number;
}

/** Devuelve las actividades creadas o integradas por el usuario autenticado. */
export async function getMisActividades(params: MisActividadesParams): Promise<PaginatedResponse<ActividadResumenUsuario>> {
  const { data } = await api.get<PaginatedResponse<ActividadResumenUsuario>>('/usuarios/me/actividades', { params });
  return data;
}