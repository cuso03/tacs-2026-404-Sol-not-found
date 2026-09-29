import { Auth0Provider } from '@auth0/auth0-react';
import type { ReactNode } from 'react';

const domain = import.meta.env.VITE_AUTH0_DOMAIN as string | undefined;
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID as string | undefined;
const audience = import.meta.env.VITE_AUTH0_AUDIENCE as string | undefined;

function ConfigFaltante() {
  return (
    <div className="mx-auto max-w-xl px-6 py-16 text-center">
      <h1 className="text-xl font-bold text-slate-900">Falta configurar Auth0</h1>
      <p className="mt-3 text-sm text-slate-600">
        Definí las variables <code className="rounded bg-slate-100 px-1">VITE_AUTH0_DOMAIN</code>,{' '}
        <code className="rounded bg-slate-100 px-1">VITE_AUTH0_CLIENT_ID</code> y{' '}
        <code className="rounded bg-slate-100 px-1">VITE_AUTH0_AUDIENCE</code> en el entorno de build.
        Los pasos para crear la aplicación en el dashboard de Auth0 están en el README del proyecto.
      </p>
    </div>
  );
}

/**
 * Envuelve la app con el Auth0Provider. Sin la configuración mínima muestra
 * instrucciones en pantalla en lugar de romper en runtime.
 */
export default function AppAuth0Provider({ children }: { children: ReactNode }) {
  if (!domain || !clientId) return <ConfigFaltante />;

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      cacheLocation="localstorage"
      authorizationParams={{
        redirect_uri: window.location.origin,
        ...(audience ? { audience } : {}),
      }}
    >
      {children}
    </Auth0Provider>
  );
}
