import type { EstadoActividad, TipoActividad, Ubicacion } from '../types/api';

export const activityTypeLabels: Record<TipoActividad, string> = {
  aire_libre: 'Aire libre',
  techada: 'Techada',
  mixta: 'Mixta',
};

export const activityStatusLabels: Record<EstadoActividad, string> = {
  PROPUESTA: 'Propuesta',
  EN_VOTACION: 'En votación',
  CONFIRMADA: 'Confirmada',
  REPROGRAMADA: 'Reprogramada',
  CANCELADA: 'Cancelada',
  FINALIZADA: 'Finalizada',
};

/** Presenta una fecha ISO usando la zona horaria del navegador. */
export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value));
}

/** Presenta cualquiera de las variantes de ubicación aceptadas por la API. */
export function formatLocation(location: Ubicacion): string {
  return location.tipo === 'ciudad'
    ? `${location.ciudad}, ${location.pais}`
    : location.direccion ?? `${location.latitud.toFixed(5)}, ${location.longitud.toFixed(5)}`;
}

/** Convierte una fecha ISO al formato requerido por datetime-local. */
export function toDateTimeLocal(value: string): string {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/** Convierte nombres técnicos de métricas en títulos legibles. */
export function formatMetricName(value: string): string {
  const normalized = value.replace(/[_-]+/g, ' ').trim().toLocaleLowerCase('es');
  return normalized.charAt(0).toLocaleUpperCase('es') + normalized.slice(1);
}
