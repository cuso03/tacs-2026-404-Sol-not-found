import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../../src/app';
import { seedActividad } from '../../helpers/fixtures/actividad.fixture';
import { createReglasPayload } from '../../helpers/fixtures/regla.fixture';
import { authHeader, AUTH_ORGANIZADOR } from '../../helpers/fixtures/auth.fixture';

describe('GET /api/actividades/:id/fechas-disponibles', () => {
  const app = createApp();

  it('retorna fechas con pronóstico adecuado para una actividad con reglas configuradas', async () => {
    const actividad = await seedActividad({
      reglasClima: createReglasPayload(),
    });
    const id = actividad._id.toString();

    const response = await request(app)
      .get(`/api/actividades/${id}/fechas-disponibles`)
      .set(authHeader(AUTH_ORGANIZADOR));

    expect(response.status).toBe(200);
    expect(response.body.fechas).toBeInstanceOf(Array);
    expect(response.body.fechas.length).toBeGreaterThan(0);
  });

  it('retorna 404 si la actividad no existe en base de datos', async () => {
    const fakeId = '66db614fef5a153200000000';
    const response = await request(app)
      .get(`/api/actividades/${fakeId}/fechas-disponibles`)
      .set(authHeader(AUTH_ORGANIZADOR));

    expect(response.status).toBe(404);
  });

  it('retorna 400 si la actividad no tiene reglas climáticas configuradas', async () => {
    const actividad = await seedActividad({
      reglasClima: undefined,
    });
    const id = actividad._id.toString();

    const response = await request(app)
      .get(`/api/actividades/${id}/fechas-disponibles`)
      .set(authHeader(AUTH_ORGANIZADOR));

    expect(response.status).toBe(400);
  });
});
