import api from './api';
import type { ActividadResumenUsuario, PaginatedResponse, ProveedorClima } from '../types/api';

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
 * desde el access token verificado.
 */
export async function sincronizarPerfil(): Promise<MiPerfil> {
  const { data } = await api.patch<MiPerfil>('/usuarios/me');
  return data;
}

export interface PreferenciasUsuario {
  sub: string;
  proveedorClima: ProveedorClima;
}

export async function getPreferencias(): Promise<PreferenciasUsuario> {
  const { data } = await api.get<PreferenciasUsuario>('/usuarios/me/preferencias');
  return data;
}

export async function actualizarPreferenciaClima(proveedorClima: ProveedorClima): Promise<PreferenciasUsuario> {
  const { data } = await api.patch<PreferenciasUsuario>('/usuarios/me/preferencias', { proveedorClima });
  return data;
}
