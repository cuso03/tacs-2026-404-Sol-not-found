import axios, { AxiosError } from 'axios';

/** Cliente HTTP compartido por todas las pantallas del frontend. */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

type TokenGetter = () => Promise<string | null>;

let tokenGetter: TokenGetter | null = null;

/**
 * Registra la fuente del access token de Auth0. Lo hace AuthBridge una vez
 * que el provider está montado; sin getter, las requests salen sin token.
 */
export function setTokenGetter(getter: TokenGetter | null): void {
  tokenGetter = getter;
}

/** Inyecta `Authorization: Bearer <token>` en cada request saliente. */
api.interceptors.request.use(async (config) => {
  if (tokenGetter) {
    const token = await tokenGetter().catch(() => null);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

/** Convierte errores HTTP y de conectividad en mensajes accionables para la interfaz. */
export function getApiErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    if (!error.response) return 'No pudimos conectar con el backend. Verificá que esté iniciado en el puerto 3000.';
    if (error.response.status === 401) return 'Tu sesión expiró o no estás autenticado. Iniciá sesión nuevamente.';
    const payload = error.response.data as { error?: string; message?: string } | undefined;
    return payload?.message ?? payload?.error ?? `La operación falló con estado ${error.response.status}.`;
  }
  return error instanceof Error ? error.message : 'No se pudo completar la operación.';
}

export default api;
