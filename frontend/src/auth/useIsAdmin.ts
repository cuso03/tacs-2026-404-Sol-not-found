import { useEffect, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

// Mismo claim que aplica el Action de Auth0 y lee el backend.
const ROLES_CLAIM = 'https://solnotfound.app/roles';

function decodeJwtPayload(token: string | undefined): Record<string, unknown> | null {
  try {
    const base64 = token?.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
    if (!base64) return null;
    return JSON.parse(atob(base64)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Indica si el access token de Auth0 incluye el rol `admin` en su claim de
 * roles. Es solo para la interfaz (ocultar la pestaña de administración); la
 * autorización real la aplica el backend con el mismo claim.
 */
export default function useIsAdmin(): boolean {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    let vigente = true;
    getAccessTokenSilently()
      .then((token) => {
        if (!vigente) return;
        const roles = decodeJwtPayload(token)?.[ROLES_CLAIM];
        setIsAdmin(Array.isArray(roles) && roles.includes('admin'));
      })
      .catch(() => {
        if (vigente) setIsAdmin(false);
      });
    return () => {
      vigente = false;
    };
  }, [isAuthenticated, getAccessTokenSilently]);

  return isAdmin;
}
