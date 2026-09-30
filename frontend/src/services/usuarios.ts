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

export interface MiPerfil {
  sub: string;
  email: string | null;
  nombre: string | null;
  roles: string[];
}

/**
 * Sincroniza el perfil del usuario autenticado (upsert). El backend lo resuelve
 * desde el access token verificado, asi que no se envia email ni nombre: no hay
 * nada que el navegador pueda falsear. Se invoca tras el primer login.
 */
export async function sincronizarPerfil(): Promise<MiPerfil> {
  const { data } = await api.patch<MiPerfil>('/usuarios/me');
  return data;
}