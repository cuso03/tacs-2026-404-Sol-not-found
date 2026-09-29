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

export interface PerfilAuth0 {
  email: string;
  nombre?: string;
}

/**
 * Crea o actualiza el perfil del usuario autenticado en el backend usando su
 * `sub` de Auth0 (upsert idempotente). Se invoca tras el primer login.
 */
export async function sincronizarPerfil(perfil: PerfilAuth0): Promise<void> {
  await api.post('/usuarios/sync', perfil);
}