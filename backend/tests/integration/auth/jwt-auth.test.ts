import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../../src/app';
import { adminHeader, authHeader, AUTH_ORGANIZADOR } from '../../helpers/fixtures/auth.fixture';
import { signExpiredToken, signToken, signTokenWithUnknownKey } from '../../helpers/auth/testAuth';

const PROTECTED_ROUTE = '/api/usuarios/me/actividades';

describe('Autenticación con JWT de Auth0', () => {
  const app = createApp();

  it('RF-1: responde 401 si no se envía token', async () => {
    const response = await request(app).get(PROTECTED_ROUTE);

    expect(response.status).toBe(401);
  });

  it('RF-1: responde 401 si el header no usa el esquema Bearer', async () => {
    const response = await request(app).get(PROTECTED_ROUTE).set('Authorization', `Basic ${signToken(AUTH_ORGANIZADOR)}`);

    expect(response.status).toBe(401);
  });

  it('RF-2: responde 401 si el token está firmado por una clave desconocida', async () => {
    const response = await request(app)
      .get(PROTECTED_ROUTE)
      .set('Authorization', `Bearer ${signTokenWithUnknownKey(AUTH_ORGANIZADOR)}`);

    expect(response.status).toBe(401);
  });

  it('RF-2: responde 401 si el token está vencido', async () => {
    const response = await request(app)
      .get(PROTECTED_ROUTE)
      .set('Authorization', `Bearer ${signExpiredToken(AUTH_ORGANIZADOR)}`);

    expect(response.status).toBe(401);
  });

  it('RF-2: responde 401 si el issuer no corresponde al dominio configurado', async () => {
    const token = signToken(AUTH_ORGANIZADOR, { issuer: 'https://otro-dominio.ejemplo/' });
    const response = await request(app).get(PROTECTED_ROUTE).set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
  });

  it('RF-2: responde 401 si el audience no corresponde al configurado', async () => {
    const token = signToken(AUTH_ORGANIZADOR, { audience: 'https://otra-api.ejemplo' });
    const response = await request(app).get(PROTECTED_ROUTE).set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
  });

  it('RF-2: responde 401 si el token es un string manipulado', async () => {
    const token = `${signToken(AUTH_ORGANIZADOR)}x`;
    const response = await request(app).get(PROTECTED_ROUTE).set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
  });

  it('RF-3: responde 200 con un token válido y usa su sub como identidad', async () => {
    const creacion = await request(app)
      .post('/api/actividades')
      .set(authHeader(AUTH_ORGANIZADOR))
      .send({
        titulo: 'Partido con token',
        descripcion: 'Creado tras validar el JWT',
        tipo: 'aire_libre',
        ubicacion: { tipo: 'coordenadas', latitud: -34.6, longitud: -58.4, direccion: 'Plaza' },
        fecha_horario: '2026-10-10T14:00:00-03:00',
        min_participantes: 2,
        max_participantes: 10,
      });
    expect(creacion.status).toBe(201);

    const dashboard = await request(app).get('/api/usuarios/me/actividades').set(authHeader(AUTH_ORGANIZADOR));
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data).toHaveLength(1);
    expect(dashboard.body.data[0].titulo).toBe('Partido con token');

    const deOtroUsuario = await request(app).get('/api/usuarios/me/actividades').set(authHeader('auth0|participante-1'));
    expect(deOtroUsuario.status).toBe(200);
    expect(deOtroUsuario.body.data).toHaveLength(0);
  });

  it('RF-4: responde 200 en rutas admin cuando el token trae el claim de roles admin', async () => {
    const response = await request(app).get('/api/admin/estadisticas').set(adminHeader());

    expect(response.status).toBe(200);
  });

  it('RF-5: responde 403 en rutas admin con token válido sin el rol admin', async () => {
    const response = await request(app).get('/api/admin/estadisticas').set(authHeader(AUTH_ORGANIZADOR));

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'Requiere rol admin' });
  });

  it('RF-6: ignora los headers legacy X-User-Id y X-User-Role', async () => {
    const sinToken = await request(app)
      .get(PROTECTED_ROUTE)
      .set('X-User-Id', AUTH_ORGANIZADOR);
    expect(sinToken.status).toBe(401);

    const soloRol = await request(app)
      .get('/api/admin/estadisticas')
      .set('X-User-Role', 'admin');
    expect(soloRol.status).toBe(401);

    const tokenSinRolMasHeaderDeRol = await request(app)
      .get('/api/admin/estadisticas')
      .set(authHeader(AUTH_ORGANIZADOR))
      .set('X-User-Role', 'admin');
    expect(tokenSinRolMasHeaderDeRol.status).toBe(403);
  });

  it('lee el nombre del claim de roles desde AUTH0_ROLES_CLAIM', async () => {
    const previous = process.env.AUTH0_ROLES_CLAIM;
    process.env.AUTH0_ROLES_CLAIM = 'https://otro-claim/roles';
    try {
      const token = signToken(AUTH_ORGANIZADOR, { extraClaims: { 'https://otro-claim/roles': ['admin'] } });
      const conClaimConfigurado = await request(app)
        .get('/api/admin/estadisticas')
        .set('Authorization', `Bearer ${token}`);
      expect(conClaimConfigurado.status).toBe(200);

      const conClaimDeSiempre = await request(app).get('/api/admin/estadisticas').set(adminHeader());
      expect(conClaimDeSiempre.status).toBe(403);
    } finally {
      if (previous === undefined) delete process.env.AUTH0_ROLES_CLAIM;
      else process.env.AUTH0_ROLES_CLAIM = previous;
    }
  });
});
