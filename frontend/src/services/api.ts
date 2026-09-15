import axios, { AxiosError } from 'axios';

export const CURRENT_USER_ID = import.meta.env.VITE_USER_ID ?? 'auth0|user-1';
export const CURRENT_USER_ROLE = import.meta.env.VITE_USER_ROLE ?? 'admin';

/** Cliente HTTP compartido por todas las pantallas del frontend. */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
    'X-User-Id': CURRENT_USER_ID,
  },
});

/** Convierte errores HTTP y de conectividad en mensajes accionables para la interfaz. */
export function getApiErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    if (!error.response) return 'No pudimos conectar con el backend. Verificá que esté iniciado en el puerto 3000.';
    const payload = error.response.data as { error?: string; message?: string } | undefined;
    return payload?.message ?? payload?.error ?? `La operación falló con estado ${error.response.status}.`;
  }
  return error instanceof Error ? error.message : 'No se pudo completar la operación.';
}

export default api;
