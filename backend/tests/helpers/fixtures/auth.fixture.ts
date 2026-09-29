import { ADMIN_SUB, prewarmedToken } from '../auth/testAuth';

export const AUTH_ORGANIZADOR = 'auth0|organizador-1';
export const AUTH_PARTICIPANTE_1 = 'auth0|participante-1';
export const AUTH_PARTICIPANTE_2 = 'auth0|participante-2';
export const AUTH_OTRO_USUARIO = 'auth0|otro-usuario';
export const AUTH_ADMIN_ROLE = 'admin';

/**
 * Genera el header `Authorization: Bearer <jwt>` con el token de Auth0
 * pre-firmado para el usuario indicado.
 */
export function authHeader(userId: string = AUTH_ORGANIZADOR): Record<string, string> {
  return { Authorization: `Bearer ${prewarmedToken(userId)}` };
}

/**
 * Genera el header `Authorization: Bearer <jwt>` de un usuario con el rol
 * admin (claim de roles incluido en el token).
 */
export function adminHeader(): Record<string, string> {
  return { Authorization: `Bearer ${prewarmedToken(ADMIN_SUB, ['admin'])}` };
}
