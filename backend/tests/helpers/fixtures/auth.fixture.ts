export const AUTH_ORGANIZADOR = 'auth0|organizador-1';
export const AUTH_PARTICIPANTE_1 = 'auth0|participante-1';
export const AUTH_PARTICIPANTE_2 = 'auth0|participante-2';
export const AUTH_OTRO_USUARIO = 'auth0|otro-usuario';
export const AUTH_ADMIN_ROLE = 'admin';

/**
 * Genera el header de autenticación de usuario 'X-User-Id'.
 */
export function authHeader(userId: string = AUTH_ORGANIZADOR): Record<string, string> {
  return { 'X-User-Id': userId };
}

/**
 * Genera el header de rol de usuario 'X-User-Role'.
 */
export function adminHeader(role: string = AUTH_ADMIN_ROLE): Record<string, string> {
  return { 'X-User-Role': role };
}
