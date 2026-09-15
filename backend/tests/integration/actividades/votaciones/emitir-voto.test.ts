import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../../../src/app';
import { ActividadModel } from '../../../../src/infrastructure/mongo/actividadModel';
import { seedActividadConVotacion } from '../../../helpers/fixtures/votacion.fixture';
import {
  authHeader,
  AUTH_PARTICIPANTE_1,
  AUTH_OTRO_USUARIO,
} from '../../../helpers/fixtures/auth.fixture';

describe('PUT /api/actividades/:id/votaciones/:votacionId/votos/me', () => {
  const app = createApp();

  it('registra un voto válido y persiste el mapa de votos en MongoDB', async () => {
    const { actividadId, votacionId, alternativas } = await seedActividadConVotacion();
    const targetAltId = alternativas[0].id;

    const response = await request(app)
      .put(`/api/actividades/${actividadId}/votaciones/${votacionId}/votos/me`)
      .set(authHeader(AUTH_PARTICIPANTE_1))
      .send({ alternativa_id: targetAltId });

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

  it('repetir el mismo PUT conserva un único voto del usuario', async () => {
    const { actividadId, votacionId, alternativas } = await seedActividadConVotacion();
    const alt1 = alternativas[0].id;

    const url = `/api/actividades/${actividadId}/votaciones/${votacionId}/votos/me`;

    // Primer PUT
    const primera = await request(app)
      .put(url)
      .set(authHeader(AUTH_PARTICIPANTE_1))
      .send({ alternativa_id: alt1 });
    expect(primera.status).toBe(200);

    // Mismo PUT repetido
    const segunda = await request(app)
      .put(url)
      .set(authHeader(AUTH_PARTICIPANTE_1))
      .send({ alternativa_id: alt1 });
    expect(segunda.status).toBe(200);

    // Verificación dual: sigue existiendo un único voto con el mismo valor
    expect(segunda.body.votos[AUTH_PARTICIPANTE_1]).toBe(alt1);
    expect(Object.keys(segunda.body.votos)).toHaveLength(1);

    const doc = await ActividadModel.findById(actividadId);
    const votacionDoc = doc!.votaciones.find((v: any) => v._id.toString() === votacionId);
    const votos = votacionDoc!.votos instanceof Map
      ? Object.fromEntries(votacionDoc!.votos)
      : votacionDoc!.votos;

    expect(Object.keys(votos)).toHaveLength(1);
    expect(votos[AUTH_PARTICIPANTE_1]).toBe(alt1);
  });

  it('reemplaza un voto anterior del mismo usuario en la respuesta y en MongoDB', async () => {
    const { actividadId, votacionId, alternativas } = await seedActividadConVotacion();
    const alt1 = alternativas[0].id;
    const alt2 = alternativas[1].id;

    // Primer voto
    await request(app)
      .put(`/api/actividades/${actividadId}/votaciones/${votacionId}/votos/me`)
      .set(authHeader(AUTH_PARTICIPANTE_1))
      .send({ alternativa_id: alt1 });

    // Reemplazo de voto
    const response = await request(app)
      .put(`/api/actividades/${actividadId}/votaciones/${votacionId}/votos/me`)
      .set(authHeader(AUTH_PARTICIPANTE_1))
      .send({ alternativa_id: alt2 });

    expect(response.status).toBe(200);
    expect(response.body.votos[AUTH_PARTICIPANTE_1]).toBe(alt2);

    // Verificación dual en MongoDB: sólo debe figurar la alternativa más reciente
    const doc = await ActividadModel.findById(actividadId);
    const votacionDoc = doc!.votaciones.find((v: any) => v._id.toString() === votacionId);
    const votos = votacionDoc!.votos instanceof Map
      ? Object.fromEntries(votacionDoc!.votos)
      : votacionDoc!.votos;

    expect(Object.keys(votos)).toHaveLength(1);
    expect(votos[AUTH_PARTICIPANTE_1]).toBe(alt2);
  });

  it('rechaza un body sin alternativa_id', async () => {
    const { actividadId, votacionId } = await seedActividadConVotacion();

    const response = await request(app)
      .put(`/api/actividades/${actividadId}/votaciones/${votacionId}/votos/me`)
      .set(authHeader(AUTH_PARTICIPANTE_1))
      .send({});

    expect(response.status).toBe(400);
  });

  it('rechaza el voto de un usuario no participante y no muta la base de datos', async () => {
    const { actividadId, votacionId, alternativas } = await seedActividadConVotacion();
    const altId = alternativas[0].id;

    const response = await request(app)
      .put(`/api/actividades/${actividadId}/votaciones/${votacionId}/votos/me`)
      .set(authHeader(AUTH_OTRO_USUARIO))
      .send({ alternativa_id: altId });

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
      .put(`/api/actividades/${actividadId}/votaciones/${votacionId}/votos/me`)
      .set(authHeader(AUTH_PARTICIPANTE_1))
      .send({ alternativa_id: fakeAltId });

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
      .put(`/api/actividades/${fakeId}/votaciones/vot-1/votos/me`)
      .set(authHeader(AUTH_PARTICIPANTE_1))
      .send({ alternativa_id: 'alt-1' });

    expect(response.status).toBe(404);
  });
});