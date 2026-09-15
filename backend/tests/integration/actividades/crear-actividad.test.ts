import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../../src/app';
import { ActividadModel } from '../../../src/infrastructure/mongo/actividadModel';
import { createActividadPayload } from '../../helpers/fixtures/actividad.fixture';
import { authHeader, AUTH_ORGANIZADOR } from '../../helpers/fixtures/auth.fixture';

describe('POST /api/actividades', () => {
  const app = createApp();

  it('crea una actividad válida, registra al creador y persiste el documento en MongoDB', async () => {
    const payload = createActividadPayload();

    const response = await request(app)
      .post('/api/actividades')
      .set(authHeader(AUTH_ORGANIZADOR))
      .send(payload);

    // 1. Verificación de contrato HTTP
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      ...payload,
      creadorId: AUTH_ORGANIZADOR,
      participantes: [AUTH_ORGANIZADOR],
      estado: 'PROPUESTA',
    });
    expect(response.body.id).toEqual(expect.any(String));
    expect(response.headers.location).toBe(`/api/actividades/${response.body.id}`);

    // 2. Verificación dual de persistencia en MongoDB
    const persisted = await ActividadModel.findById(response.body.id);
    expect(persisted).not.toBeNull();
    expect(persisted?.titulo).toBe(payload.titulo);
    expect(persisted?.creadorId).toBe(AUTH_ORGANIZADOR);
    expect(persisted?.participantes).toEqual([AUTH_ORGANIZADOR]);
    expect(persisted?.estado).toBe('PROPUESTA');
  });

  it('rechaza un máximo de participantes menor al mínimo y no persiste en MongoDB', async () => {
    const payload = createActividadPayload({ min_participantes: 5, max_participantes: 3 });

    const response = await request(app)
      .post('/api/actividades')
      .set(authHeader(AUTH_ORGANIZADOR))
      .send(payload);

    // 1. Verificación de contrato HTTP
    expect(response.status).toBe(400);

    // 2. Verificación dual: asegurar que ningún documento se insertó
    const totalCount = await ActividadModel.countDocuments();
    expect(totalCount).toBe(0);
  });

  it('acepta y persiste una ubicación por ciudad y país', async () => {
    const payload = createActividadPayload({
      ubicacion: { tipo: 'ciudad', ciudad: 'Buenos Aires', pais: 'AR' },
    });

    const response = await request(app)
      .post('/api/actividades')
      .set(authHeader(AUTH_ORGANIZADOR))
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.ubicacion).toEqual({ tipo: 'ciudad', ciudad: 'Buenos Aires', pais: 'AR' });

    // Verificación dual en DB
    const persisted = await ActividadModel.findById(response.body.id);
    expect(persisted?.ubicacion).toMatchObject({ tipo: 'ciudad', ciudad: 'Buenos Aires', pais: 'AR' });
  });
});
