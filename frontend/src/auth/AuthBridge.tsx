import { useEffect, useRef } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { setTokenGetter } from '../services/api';
import { sincronizarPerfil } from '../services/usuarios';

/**
 * Pega Auth0 con el resto de la app:
 * - registra el getter del access token para que el cliente HTTP lo envíe en
 *   cada request;
 * - tras el primer login, sincroniza el perfil (email/nombre) en el backend
 *   para que quede persistido con su `auth0Id`.
 */
export default function AuthBridge() {
  const { getAccessTokenSilently, isAuthenticated, user } = useAuth0();
  const perfilSincronizadoRef = useRef(false);

  useEffect(() => {
    setTokenGetter(async () => {
      if (!isAuthenticated) return null;
      const token = await getAccessTokenSilently().catch(() => null);
      return token ?? null;
    });
    return () => setTokenGetter(null);
  }, [getAccessTokenSilently, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !user?.email || perfilSincronizadoRef.current) return;
    perfilSincronizadoRef.current = true;
    sincronizarPerfil({ email: user.email, nombre: user.name }).catch((error: unknown) => {
      perfilSincronizadoRef.current = false;
      console.error('No se pudo sincronizar el perfil de Auth0:', error);
    });
  }, [isAuthenticated, user]);

  return null;
}
