import axios, { AxiosError } from 'axios';

const currentUserId = import.meta.env.VITE_USER_ID ?? 'auth0|user-1';

/** Cliente HTTP compartido por todas las pantallas del frontend. */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
    'X-User-Id': currentUserId,
  },
});

/** Convierte errores de Axios y de red en un mensaje apto para la interfaz. */
export function getApiErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const payload = error.response?.data as { error?: string; message?: string } | undefined;
    return payload?.message ?? payload?.error ?? 'No se pudo completar la operación.';
  }
  return error instanceof Error ? error.message : 'No se pudo completar la operación.';
}

export default api;
