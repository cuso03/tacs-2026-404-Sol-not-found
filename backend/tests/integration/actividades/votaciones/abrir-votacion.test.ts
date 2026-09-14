import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../../../src/app';
import { ActividadModel } from '../../../../src/infrastructure/mongo/actividadModel';
import { seedActividad } from '../../../helpers/fixtures/actividad.fixture';
import { createReglasPayload } from '../../../helpers/fixtures/regla.fixture';
import { authHeader, AUTH_ORGANIZADOR, AUTH_OTRO_USUARIO } from '../../../helpers/fixtures/auth.fixture';
import { ActividadMongoRepository } from '../../../../src/repositories/actividadMongoRepository';

describe('POST /api/actividades/:id/votaciones', () => {
  const app = createApp(new ActividadMongoRepository());

  it('abre votación manual con alternativas provistas y actualiza el estado en MongoDB', async () => {
    const actividad = await seedActividad({
      reglasClima: createReglasPayload(),
    });
    const id = actividad._id.toString();

    const response = await request(app)
      .post(`/api/actividades/${id}/votaciones`)
      .set(authHeader(AUTH_ORGANIZADOR))
      .send({
        alternativas: [
          { fecha_horario: '2026-09-12T14:00:00-03:00' },
          { fecha_horario: '2026-09-13T14:00:00-03:00' },
        ],
        duracion_horas: 24,
      });

    // 1. Verificación HTTP
    expect(response.status).toBe(201);
    expect(response.body.estado).toBe('EN_VOTACION');
    expect(response.body.votaciones).toHaveLength(1);
    expect(response.body.votaciones[0].automatica).toBe(false);
    expect(response.body.votaciones[0].alternativas).toHaveLength(2);

    // 2. Verificación dual de persistencia en MongoDB
    const doc = await ActividadModel.findById(id);
    expect(doc).not.toBeNull();
    expect(doc?.estado).toBe('EN_VOTACION');
    expect(doc?.votaciones).toHaveLength(1);
    expect(doc?.votaciones[0].automatica).toBe(false);
    expect(doc?.votaciones[0].alternativas).toHaveLength(2);
  });

  it('abre votación automática cuando no se proveen alternativas y persiste en DB', async () => {
    const actividad = await seedActividad({
      reglasClima: createReglasPayload(),
    });
    const id = actividad._id.toString();

    const response = await request(app)
      .post(`/api/actividades/${id}/votaciones`)
      .set(authHeader(AUTH_ORGANIZADOR))
      .send({ duracion_horas: 24 });

    expect(response.status).toBe(201);
    expect(response.body.estado).toBe('EN_VOTACION');
    expect(response.body.votaciones[0].automatica).toBe(true);
    expect(response.body.votaciones[0].alternativas.length).toBeGreaterThan(0);

    // Verificación dual en DB
    const doc = await ActividadModel.findById(id);
    expect(doc?.estado).toBe('EN_VOTACION');
    expect(doc?.votaciones[0].automatica).toBe(true);
    expect(doc?.votaciones[0].alternativas.length).toBeGreaterThan(0);
  });

  it('usa duración por defecto de 24h cuando no se especifica y persiste timestamps correctos', async () => {
    const actividad = await seedActividad({
      reglasClima: createReglasPayload(),
    });
    const id = actividad._id.toString();

    const response = await request(app)
      .post(`/api/actividades/${id}/votaciones`)
      .set(authHeader(AUTH_ORGANIZADOR))
      .send({ alternativas: [{ fecha_horario: '2026-09-12T14:00:00-03:00' }] });

    expect(response.status).toBe(201);

    // Verificación dual de tiempos en MongoDB
    const doc = await ActividadModel.findById(id);
    const votacion = doc!.votaciones[0];
    const diff = new Date(votacion.cierraEn).getTime() - new Date(votacion.abiertaEn).getTime();
    expect(diff).toBe(24 * 60 * 60 * 1000);
  });

  it('rechaza si el usuario no es el organizador y no muta la actividad en DB', async () => {
    const actividad = await seedActividad({
      reglasClima: createReglasPayload(),
    });
    const id = actividad._id.toString();

    const response = await request(app)
      .post(`/api/actividades/${id}/votaciones`)
      .set(authHeader(AUTH_OTRO_USUARIO))
      .send({ alternativas: [{ fecha_horario: '2026-09-12T14:00:00-03:00' }] });

    expect(response.status).toBe(403);

    // Verificación dual en DB
    const doc = await ActividadModel.findById(id);
    expect(doc?.estado).toBe('PROPUESTA');
    expect(doc?.votaciones).toHaveLength(0);
  });

  it('rechaza si ya hay una votación activa', async () => {
    const actividad = await seedActividad({
      reglasClima: createReglasPayload(),
    });
    const id = actividad._id.toString();

    await request(app)
      .post(`/api/actividades/${id}/votaciones`)
      .set(authHeader(AUTH_ORGANIZADOR))
      .send({ alternativas: [{ fecha_horario: '2026-09-12T14:00:00-03:00' }] });

    const response = await request(app)
      .post(`/api/actividades/${id}/votaciones`)
      .set(authHeader(AUTH_ORGANIZADOR))
      .send({ alternativas: [{ fecha_horario: '2026-09-13T14:00:00-03:00' }] });

    expect(response.status).toBe(409);
  });

  it('retorna 404 si la actividad no existe en MongoDB', async () => {
    const fakeId = '66db614fef5a153200000000';
    const response = await request(app)
      .post(`/api/actividades/${fakeId}/votaciones`)
      .set(authHeader(AUTH_ORGANIZADOR))
      .send({ alternativas: [{ fecha_horario: '2026-09-12T14:00:00-03:00' }] });

    expect(response.status).toBe(404);
  });
});
