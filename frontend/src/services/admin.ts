import api, { CURRENT_USER_ROLE } from './api';
import type { Estadisticas, SimulacionMonitoreoResponse } from '../types/api';

/** Devuelve las métricas acumuladas de la plataforma (acceso de administración). */
export async function getEstadisticas(): Promise<Estadisticas> {
  const { data } = await api.get<Estadisticas>('/admin/estadisticas', { headers: { 'X-User-Role': CURRENT_USER_ROLE } });
  return data;
}

/** Ejecuta el escenario mock del monitoreo climático y de notificaciones. */
export async function simularMonitoreo(): Promise<SimulacionMonitoreoResponse> {
  const { data } = await api.post<SimulacionMonitoreoResponse>('/notificaciones/simular-inicio');
  return data;
}