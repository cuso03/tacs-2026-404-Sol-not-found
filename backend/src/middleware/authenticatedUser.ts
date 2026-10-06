import { NextFunction, Request, Response } from 'express';
import jwt, { type Algorithm, type JwtPayload } from 'jsonwebtoken';
import jwksClient, { type JwksClient } from 'jwks-rsa';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      auth?: JwtPayload;
    }
  }
}

const ALGORITHMS: Algorithm[] = ['RS256'];

function rolesClaim(): string {
  // `||` y no `??`: una cadena vacía (env en docker) debe caer al default.
  return process.env.AUTH0_ROLES_CLAIM?.trim() || 'https://solnotfound.app/roles';
}

/** URI del JWKS: override explícito o derivado del dominio de Auth0. */
function jwksUri(): string {
  const explicit = process.env.AUTH0_JWKS_URI?.trim();
  if (explicit) return explicit;
  const domain = process.env.AUTH0_DOMAIN?.trim();
  if (!domain) throw new Error('Falta configurar AUTH0_DOMAIN (o AUTH0_JWKS_URI) para verificar tokens.');
  return `https://${domain}/.well-known/jwks.json`;
}

function issuer(): string {
  const domain = process.env.AUTH0_DOMAIN?.trim();
  if (!domain) throw new Error('Falta configurar AUTH0_DOMAIN para verificar tokens.');
  return `https://${domain}/`;
}

function audience(): string {
  const value = process.env.AUTH0_AUDIENCE?.trim();
  if (!value) throw new Error('Falta configurar AUTH0_AUDIENCE para verificar tokens.');
  return value;
}

let jwks: JwksClient | null = null;
let jwksSource = '';

function getJwksClient(): JwksClient {
  const uri = jwksUri();
  if (!jwks || uri !== jwksSource) {
    jwks = jwksClient({
      jwksUri: uri,
      cache: true,
      cacheMaxAge: 10 * 60 * 1000,
      rateLimit: true,
      jwksRequestsPerMinute: 10,
    });
    jwksSource = uri;
  }
  return jwks;
}

async function signingKey(header: jwt.JwtHeader): Promise<string> {
  const key = await getJwksClient().getSigningKey(header.kid ?? null);
  return key.getPublicKey();
}

function verifyToken(token: string, expectedIssuer: string, expectedAudience: string): Promise<JwtPayload> {
  return new Promise((resolve, reject) => {
    jwt.verify(token, (header, callback) => {
      signingKey(header)
        .then((publicKey) => callback(null, publicKey))
        .catch((err: unknown) => callback(err as Error));
    }, { issuer: expectedIssuer, audience: expectedAudience, algorithms: ALGORITHMS }, (err, decoded) => {
      if (err) { reject(err); return; }
      resolve(decoded as JwtPayload);
    });
  });
}

/**
 * Valida el JWT de Auth0 enviado como `Authorization: Bearer <token>`
 * (firma vía JWKS, issuer, audience y expiración) y expone el `sub` como
 * identidad de la request en `req.userId`.
 */
export async function requireAuthenticatedUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  // La configuración faltante debe explotar como 500 (error handler), no como 401.
  const expectedIssuer = issuer();
  const expectedAudience = audience();

  const header = req.header('authorization')?.trim() ?? '';
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) {
    res.status(401).json({ error: 'Se requiere un token de acceso en el header Authorization (Bearer).' });
    return;
  }

  try {
    const payload = await verifyToken(match[1], expectedIssuer, expectedAudience);
    if (!payload.sub) {
      res.status(401).json({ error: 'Token sin subject (sub).' });
      return;
    }
    req.auth = payload;
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido, expirado o firmado por otra autoridad.' });
  }
}

/**
 * Exige el rol admin dentro del claim de roles del token ya verificado.
 * El rol nunca se acepta desde un header del cliente.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!rolesDelToken(req.auth).includes('admin')) {
    res.status(403).json({ error: 'Requiere rol admin' });
    return;
  }
  next();
}

/** Roles del claim configurado, leídos de un payload ya verificado. */
export function rolesDelToken(payload: JwtPayload | undefined): string[] {
  const claim = payload?.[rolesClaim()];
  if (!Array.isArray(claim)) return [];
  return claim.filter((rol): rol is string => typeof rol === 'string');
}
