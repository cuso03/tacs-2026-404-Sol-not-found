import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../../src/app';
import { adminHeader, authHeader, AUTH_ORGANIZADOR } from '../../helpers/fixtures/auth.fixture';
import { seedEstadisticas } from '../../helpers/fixtures/estadisticas.fixture';

describe('GET /api/admin/estadisticas', () => {
  const app = createApp();

  it('rechaza con 403 si la petición no incluye el header de rol admin', async () => {
    const response = await request(app)
      .get('/api/admin/estadisticas')
      .set(authHeader(AUTH_ORGANIZADOR));

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'Requiere rol admin' });
  });

  it('rechaza con 403 si la petición no incluye ningún header de autenticación', async () => {
    const response = await request(app).get('/api/admin/estadisticas');

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'Requiere rol admin' });
  });

  it('retorna 200 con un objeto vacío cuando no hay métricas registradas en MongoDB', async () => {
    const response = await request(app)
      .get('/api/admin/estadisticas')
      .set(adminHeader());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({});
  });

  it('retorna 200 con el diccionario de métricas persistidas en base de datos', async () => {
    await seedEstadisticas({
      Actividad_Creada: 5,
      consultas_clima: 10,
      alertas_mal_clima: 2,
    });

    const response = await request(app)
      .get('/api/admin/estadisticas')
      .set(adminHeader());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      Actividad_Creada: 5,
      consultas_clima: 10,
      alertas_mal_clima: 2,
    });
  });
});
