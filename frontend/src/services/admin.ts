import api from './api';
import type { Estadisticas } from '../types/api';

/** Devuelve las métricas acumuladas de la plataforma (acceso de administración). */
export async function getEstadisticas(): Promise<Estadisticas> {
  const { data } = await api.get<Estadisticas>('/admin/estadisticas');
  return data;
}
