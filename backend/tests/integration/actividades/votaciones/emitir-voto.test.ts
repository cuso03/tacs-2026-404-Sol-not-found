import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../../../src/app';
import { ActividadModel } from '../../../../src/infrastructure/mongo/actividadModel';
import { seedActividadConVotacion } from '../../../helpers/fixtures/votacion.fixture';
import { ActividadMongoRepository } from '../../../../src/repositories/actividadMongoRepository';
import {
  authHeader,
  AUTH_PARTICIPANTE_1,
  AUTH_OTRO_USUARIO,
} from '../../../helpers/fixtures/auth.fixture';

describe('POST /api/actividades/:id/votaciones/:votacionId/alternativas/:alternativaId/votar', () => {
  const app = createApp(new ActividadMongoRepository());

  it('registra un voto válido y persiste el mapa de votos en MongoDB', async () => {
    const { actividadId, votacionId, alternativas } = await seedActividadConVotacion();
    const targetAltId = alternativas[0].id;

    const response = await request(app)
      .post(`/api/actividades/${actividadId}/votaciones/${votacionId}/alternativas/${targetAltId}/votar`)
      .set(authHeader(AUTH_PARTICIPANTE_1))
      .send({});

    // 1. Verificación del contrato HTTP
    expect(response.status).toBe(200);
    expect(response.body.votos[AUTH_PARTICIPANTE_1]).toBe(targetAltId);

    // 2. Verificación dual de persistencia en MongoDB
    const doc = await ActividadModel.findById(actividadId);
    expect(doc).not.toBeNull();
    const votacionDoc = doc!.votaciones.find((v: any) => v._id.toString() === votacionId);
    expect(votacionDoc).toBeDefined();

    const votos = votacionDoc!.votos instanceof Map
      ? Object.fromEntries(votacionDoc!.votos)
      : votacionDoc!.votos;

    expect(votos[AUTH_PARTICIPANTE_1]).toBe(targetAltId);
  });

  it('sobreescribe un voto anterior del mismo usuario en la respuesta y en MongoDB', async () => {
    const { actividadId, votacionId, alternativas } = await seedActividadConVotacion();
    const alt1 = alternativas[0].id;
    const alt2 = alternativas[1].id;

    // Primer voto
    await request(app)
      .post(`/api/actividades/${actividadId}/votaciones/${votacionId}/alternativas/${alt1}/votar`)
      .set(authHeader(AUTH_PARTICIPANTE_1))
      .send({});

    // Sobreescritura de voto
    const response = await request(app)
      .post(`/api/actividades/${actividadId}/votaciones/${votacionId}/alternativas/${alt2}/votar`)
      .set(authHeader(AUTH_PARTICIPANTE_1))
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.votos[AUTH_PARTICIPANTE_1]).toBe(alt2);

    // Verificación dual en MongoDB: sólo debe figurar la alternativa más reciente
    const doc = await ActividadModel.findById(actividadId);
    const votacionDoc = doc!.votaciones.find((v: any) => v._id.toString() === votacionId);
    const votos = votacionDoc!.votos instanceof Map
      ? Object.fromEntries(votacionDoc!.votos)
      : votacionDoc!.votos;

    expect(votos[AUTH_PARTICIPANTE_1]).toBe(alt2);
  });

  it('rechaza el voto de un usuario no participante y no muta la base de datos', async () => {
    const { actividadId, votacionId, alternativas } = await seedActividadConVotacion();
    const altId = alternativas[0].id;

    const response = await request(app)
      .post(`/api/actividades/${actividadId}/votaciones/${votacionId}/alternativas/${altId}/votar`)
      .set(authHeader(AUTH_OTRO_USUARIO))
      .send({});

    expect(response.status).toBe(403);

    // Verificación dual en MongoDB: no debe haberse registrado ningún voto
    const doc = await ActividadModel.findById(actividadId);
    const votacionDoc = doc!.votaciones.find((v: any) => v._id.toString() === votacionId);
    const votos = votacionDoc!.votos instanceof Map
      ? Object.fromEntries(votacionDoc!.votos)
      : votacionDoc!.votos;

    expect(votos[AUTH_OTRO_USUARIO]).toBeUndefined();
  });

  it('rechaza una alternativa inexistente y mantiene el estado intacto en MongoDB', async () => {
    const { actividadId, votacionId } = await seedActividadConVotacion();
    const fakeAltId = '66db614fef5a153200000000';

    const response = await request(app)
      .post(`/api/actividades/${actividadId}/votaciones/${votacionId}/alternativas/${fakeAltId}/votar`)
      .set(authHeader(AUTH_PARTICIPANTE_1))
      .send({});

    expect(response.status).toBe(400);

    // Verificación dual en MongoDB
    const doc = await ActividadModel.findById(actividadId);
    const votacionDoc = doc!.votaciones.find((v: any) => v._id.toString() === votacionId);
    const votos = votacionDoc!.votos instanceof Map
      ? Object.fromEntries(votacionDoc!.votos)
      : votacionDoc!.votos;

    expect(Object.keys(votos)).toHaveLength(0);
  });

  it('retorna 404 si la actividad no existe', async () => {
    const fakeId = '66db614fef5a153200000000';
    const response = await request(app)
      .post(`/api/actividades/${fakeId}/votaciones/vot-1/alternativas/alt-1/votar`)
      .set(authHeader(AUTH_PARTICIPANTE_1))
      .send({});

    expect(response.status).toBe(404);
  });
});
