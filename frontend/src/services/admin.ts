import api from './api';
import type { Estadisticas, TelemetriaClima } from '../types/api';

/** Devuelve las métricas acumuladas de la plataforma (acceso de administración). */
export async function getEstadisticas(): Promise<Estadisticas> {
  const { data } = await api.get<Estadisticas>('/admin/estadisticas');
  return data;
}

/** Devuelve la telemetría en vivo del estado de proveedores de clima y circuit breaker. */
export async function getTelemetriaClima(): Promise<TelemetriaClima> {
  const { data } = await api.get<TelemetriaClima>('/admin/estadisticas/clima');
  return data;
}
