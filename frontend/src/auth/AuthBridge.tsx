import { useCallback, useEffect, useRef } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { setSessionExpiredHandler, setTokenGetter } from '../services/api';
import { sincronizarPerfil } from '../services/usuarios';

/**
 * Errores que un renewal silencioso no puede resolver: la unica salida es
 * volver a pasar por Auth0.
 */
const ERRORES_IRRECUPERABLES = new Set([
  'login_required',
  'consent_required',
  'interaction_required',
  'missing_refresh_token',
]);

/**
 * Tope de reintentos de re-login por ventana de sesion. sessionStorage
 * sobrevive a la navegacion a Auth0, a diferencia de un ref en memoria, asi
 * que evita ciclar entre login y app si el problema no se resuelve al
 * reautenticar (por ejemplo, un audience mal configurado en el backend).
 */
const MAX_REINTENTOS = 2;
const VENTANA_REINTENTOS_MS = 5 * 60 * 1000;
const CLAVE_REINTENTOS = 'solnotfound:reintentos-relogin';

function requiereReautenticacion(error: unknown): boolean {
  return error instanceof Error && ERRORES_IRRECUPERABLES.has(error.message);
}

function reintentosAgotados(): boolean {
  try {
    const previo = window.sessionStorage.getItem(CLAVE_REINTENTOS);
    if (!previo) return false;
    const registro = JSON.parse(previo) as { ts: number; n: number };
    return Date.now() - registro.ts < VENTANA_REINTENTOS_MS && registro.n >= MAX_REINTENTOS;
  } catch {
    // Sin sessionStorage no hay registro: preferimos reintentar a dejar al
    // usuario sin recuperacion.
    return false;
  }
}

function registrarReintento(): void {
  try {
    const previo = window.sessionStorage.getItem(CLAVE_REINTENTOS);
    const registro = previo ? (JSON.parse(previo) as { ts: number; n: number }) : null;
    const ahora = Date.now();
    const dentroDeVentana = registro !== null && ahora - registro.ts < VENTANA_REINTENTOS_MS;
    window.sessionStorage.setItem(CLAVE_REINTENTOS, JSON.stringify({ ts: ahora, n: dentroDeVentana ? registro.n + 1 : 1 }));
  } catch {
    // Sin sessionStorage el tope no aplica.
  }
}

/**
 * Pega Auth0 con el resto de la app:
 * - registra el getter del access token para que el cliente HTTP lo envíe en
 *   cada request;
 * - devuelve al login cuando la sesión ya no se puede renovar en silencio,
 *   en lugar de dejar requests anónimas que fallan con 401;
 * - tras el primer login, sincroniza el perfil (email/nombre) en el backend
 *   para que quede persistido con su `auth0Id`.
 */
export default function AuthBridge() {
  const { getAccessTokenSilently, isAuthenticated, loginWithRedirect, user } = useAuth0();
  const perfilSincronizadoRef = useRef(false);
  const redirigiendoRef = useRef(false);

  const reautenticar = useCallback(() => {
    if (!isAuthenticated || redirigiendoRef.current) return;
    if (reintentosAgotados()) return;
    redirigiendoRef.current = true;

    // Antes de mandar al usuario a Auth0 le preguntamos al SDK si la sesion se
    // puede renovar en silencio. Si el token sigue vivo y el 401 vino igual, el
    // problema es de configuracion del API y redirigir solo genera un loop.
    getAccessTokenSilently()
      .then(() => {
        redirigiendoRef.current = false;
      })
      .catch((error: unknown) => {
        if (!requiereReautenticacion(error)) {
          redirigiendoRef.current = false;
          return;
        }
        registrarReintento();
        void loginWithRedirect({
          appState: { returnTo: window.location.pathname + window.location.search },
        }).catch(() => {
          redirigiendoRef.current = false;
        });
      });
  }, [getAccessTokenSilently, isAuthenticated, loginWithRedirect]);

  useEffect(() => {
    setSessionExpiredHandler(reautenticar);
    return () => setSessionExpiredHandler(null);
  }, [reautenticar]);

  useEffect(() => {
    setTokenGetter(async () => {
      if (!isAuthenticated) return null;
      try {
        return (await getAccessTokenSilently()) ?? null;
      } catch (error) {
        if (requiereReautenticacion(error)) reautenticar();
        return null;
      }
    });
    return () => setTokenGetter(null);
  }, [getAccessTokenSilently, isAuthenticated, reautenticar]);

  useEffect(() => {
    if (!isAuthenticated || !user?.email || perfilSincronizadoRef.current) return;
    perfilSincronizadoRef.current = true;
    sincronizarPerfil().catch((error: unknown) => {
      perfilSincronizadoRef.current = false;
      console.error('No se pudo sincronizar el perfil de Auth0:', error);
    });
  }, [isAuthenticated, user]);

  return null;
}
