import { createServer, type Server } from 'node:http';
import { generateKeyPairSync, type KeyObject } from 'node:crypto';
import jwt from 'jsonwebtoken';

/**
 * Infraestructura de autenticación para la suite de tests.
 *
 * Genera un par de claves RSA, publica un JWKS en un servidor local y emite
 * tokens firmados que el middleware de Auth0 verifica de forma real (firma,
 * issuer, audience y expiración). Los tokens de los usuarios fixture se
 * pre-firman una sola vez para que `authHeader()` siga siendo síncrono.
 */

export const TEST_AUTH = {
  domain: 'tacs.test',
  issuer: 'https://tacs.test/',
  audience: 'https://tacs-solnotfound/api',
  rolesClaim: 'https://solnotfound.app/roles',
} as const;

export const ADMIN_SUB = 'auth0|admin-1';

/** Usuarios con token pre-firmado. Agregar acá cualquier sub nuevo usado en tests. */
const PREWARMED_SUBS = [
  'auth0|organizador-1',
  'auth0|organizador-2',
  'auth0|participante-1',
  'auth0|participante-2',
  'auth0|otro-usuario',
  'auth0|participante-3',
  ADMIN_SUB,
];

interface AuthState {
  privateKeyPem: string;
  kid: string;
  server: Server;
  tokens: Map<string, string>;
}

let state: AuthState | null = null;

function tokenCacheKey(sub: string, roles: string[]): string {
  return `${sub}|${roles.join(',')}`;
}

export interface SignTokenOptions {
  roles?: string[];
  /** Claims extra que se agregan al payload (p.ej. un claim de roles alternativo). */
  extraClaims?: Record<string, unknown>;
  issuer?: string;
  audience?: string;
  /** Segundos de validez (negativo = token vencido). */
  expiresIn?: number;
  kid?: string;
  privateKeyPem?: string;
}

/** Firma un JWT de prueba con los claims estándar de Auth0. */
export function signToken(sub: string, options: SignTokenOptions = {}): string {
  if (!state) throw new Error('startTestAuth() debe ejecutarse antes de firmar tokens.');
  const {
    roles,
    extraClaims,
    issuer = TEST_AUTH.issuer,
    audience = TEST_AUTH.audience,
    expiresIn = 60 * 60 * 24,
    kid = state.kid,
    privateKeyPem = state.privateKeyPem,
  } = options;

  return jwt.sign(
    {
      ...(roles ? { [TEST_AUTH.rolesClaim]: roles } : {}),
      ...extraClaims,
    },
    privateKeyPem,
    {
      algorithm: 'RS256',
      keyid: kid,
      issuer,
      audience,
      subject: sub,
      expiresIn,
    },
  );
}

/** Token con firma de una clave distinta a la publicada en el JWKS (debe fallar). */
export function signTokenWithUnknownKey(sub: string): string {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return signToken(sub, { privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }) as string, kid: 'test-key-1' });
}

/** Token vencido (debe fallar por exp). */
export function signExpiredToken(sub: string): string {
  return signToken(sub, { expiresIn: -60 });
}

/** Devuelve el token pre-firmado para un sub, o lanza un error explicando cómo agregarlo. */
export function prewarmedToken(sub: string, roles: string[] = []): string {
  if (!state) throw new Error('startTestAuth() debe ejecutarse antes de usar authHeader().');
  const token = state.tokens.get(tokenCacheKey(sub, roles));
  if (!token) {
    throw new Error(
      `No hay token pre-firmado para "${sub}" (roles: [${roles.join(', ')}]). ` +
        'Agregá el sub a PREWARMED_SUBS en tests/helpers/auth/testAuth.ts o firmalo con signToken().',
    );
  }
  return token;
}

function jwkFrom(publicKey: KeyObject, kid: string) {
  return { ...(publicKey.export({ format: 'jwk' }) as Record<string, unknown>), kid, alg: 'RS256', use: 'sig' };
}

/** Levanta el JWKS local, configura las env vars y pre-firma los tokens fixture. */
export async function startTestAuth(): Promise<void> {
  if (state) return;

  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = 'test-key-1';
  const jwk = jwkFrom(publicKey, kid);
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;

  const server = createServer((req, res) => {
    if (req.url?.startsWith('/.well-known/jwks.json')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ keys: [jwk] }));
      return;
    }
    res.writeHead(404).end();
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No se pudo obtener el puerto del JWKS de tests.');
  const jwksUri = `http://127.0.0.1:${address.port}/.well-known/jwks.json`;

  process.env.AUTH0_DOMAIN = TEST_AUTH.domain;
  process.env.AUTH0_AUDIENCE = TEST_AUTH.audience;
  process.env.AUTH0_JWKS_URI = jwksUri;
  process.env.AUTH0_ROLES_CLAIM = TEST_AUTH.rolesClaim;

  state = { privateKeyPem, kid, server, tokens: new Map() };

  for (const sub of PREWARMED_SUBS) {
    state.tokens.set(tokenCacheKey(sub, []), signToken(sub));
  }
  state.tokens.set(tokenCacheKey(ADMIN_SUB, ['admin']), signToken(ADMIN_SUB, { roles: ['admin'] }));
}

export async function stopTestAuth(): Promise<void> {
  if (!state) return;
  await new Promise<void>((resolve) => state!.server.close(() => resolve()));
  state = null;
}
