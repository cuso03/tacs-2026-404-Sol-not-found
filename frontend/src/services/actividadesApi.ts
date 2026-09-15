import type { Actividad, CrearActividadPayload, ReglasClimaPayload } from '../types/actividad';

const apiBaseUrl = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

/** Error HTTP con un mensaje apto para mostrar en el formulario. */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Ejecuta una llamada JSON y normaliza los errores de la API. */
async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
  });
  const body = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new ApiError(body.error ?? 'No se pudo completar la operación.', response.status);
  return body as T;
}

/** Crea una actividad vinculada al usuario autenticado/simulado. */
export function crearActividad(payload: CrearActividadPayload, userId: string): Promise<Actividad> {
  return requestJson('/api/actividades', { method: 'POST', headers: { 'X-User-Id': userId }, body: JSON.stringify(payload) });
}

/** Configura las reglas de clima y reprogramación de una actividad creada. */
export function configurarReglas(actividadId: string, payload: ReglasClimaPayload, userId: string): Promise<Actividad> {
  return requestJson(`/api/actividades/${encodeURIComponent(actividadId)}/reglas`, { method: 'PUT', headers: { 'X-User-Id': userId }, body: JSON.stringify(payload) });
}
