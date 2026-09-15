import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../../src/app';
import { ActividadModel } from '../../../src/infrastructure/mongo/actividadModel';
import { seedActividad } from '../../helpers/fixtures/actividad.fixture';
import { createReglasPayload } from '../../helpers/fixtures/regla.fixture';
import { authHeader, AUTH_ORGANIZADOR, AUTH_OTRO_USUARIO } from '../../helpers/fixtures/auth.fixture';

describe('PUT /api/actividades/:id/reglas', () => {
  const app = createApp();

  it('vincula reglas válidas cuando quien las define es el organizador y persiste en DB', async () => {
    const actividad = await seedActividad();
    const id = actividad._id.toString();
    const reglasPayload = createReglasPayload();

    const response = await request(app)
      .put(`/api/actividades/${id}/reglas`)
      .set(authHeader(AUTH_ORGANIZADOR))
      .send(reglasPayload);

    // 1. Verificación HTTP
    expect(response.status).toBe(200);
    expect(response.body.reglasClima).toEqual(reglasPayload);

    // 2. Verificación dual en base de datos
    const persisted = await ActividadModel.findById(id);
    expect(persisted?.reglasClima).toBeDefined();
    expect(persisted?.reglasClima?.probabilidad_lluvia_max).toBe(reglasPayload.probabilidad_lluvia_max);
    expect(persisted?.reglasClima?.temperatura_min).toBe(reglasPayload.temperatura_min);
    expect(persisted?.reglasClima?.temperatura_max).toBe(reglasPayload.temperatura_max);
    expect(persisted?.reglasClima?.rango_horario?.horario_min).toBe(reglasPayload.rango_horario.horario_min);
  });

  it('repetir el mismo PUT conserva una única configuración en DB', async () => {
    const actividad = await seedActividad();
    const id = actividad._id.toString();
    const reglasPayload = createReglasPayload();

    const url = `/api/actividades/${id}/reglas`;

    await request(app).put(url).set(authHeader(AUTH_ORGANIZADOR)).send(reglasPayload);
    const repetido = await request(app).put(url).set(authHeader(AUTH_ORGANIZADOR)).send(reglasPayload);

    expect(repetido.status).toBe(200);
    expect(repetido.body.reglasClima).toEqual(reglasPayload);

    const persisted = await ActividadModel.findById(id);
    expect(persisted?.toObject().reglasClima).toEqual(reglasPayload);
  });

  it('rechaza rangos climáticos y horarios inválidos y no altera el documento en DB', async () => {
    const actividad = await seedActividad();
    const id = actividad._id.toString();
    const reglasInvalidas = createReglasPayload({
      temperatura_min: 30,
      temperatura_max: 10,
      rango_horario: { horario_min: '20:00', horario_max: '10:00' },
    });

    const response = await request(app)
      .put(`/api/actividades/${id}/reglas`)
      .set(authHeader(AUTH_ORGANIZADOR))
      .send(reglasInvalidas);

    expect(response.status).toBe(400);

    // Verificación dual: asegurar que reglasClima sigue undefined en DB
    const persisted = await ActividadModel.findById(id);
    expect(persisted?.reglasClima).toBeUndefined();
  });

  it('informa 404 si la actividad no existe en DB', async () => {
    const fakeId = '66db614fef5a153200000000';
    const response = await request(app)
      .put(`/api/actividades/${fakeId}/reglas`)
      .set(authHeader(AUTH_ORGANIZADOR))
      .send(createReglasPayload());

    expect(response.status).toBe(404);
  });

  it('impide configurar reglas a un usuario que no es el organizador', async () => {
    const actividad = await seedActividad();
    const id = actividad._id.toString();

    const response = await request(app)
      .put(`/api/actividades/${id}/reglas`)
      .set(authHeader(AUTH_OTRO_USUARIO))
      .send(createReglasPayload());

    expect(response.status).toBe(403);

    // Verificación dual
    const persisted = await ActividadModel.findById(id);
    expect(persisted?.reglasClima).toBeUndefined();
  });
});
