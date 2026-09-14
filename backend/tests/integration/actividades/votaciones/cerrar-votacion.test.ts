import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../../../src/app';
import { ActividadModel } from '../../../../src/infrastructure/mongo/actividadModel';
import { seedActividadConVotacion } from '../../../helpers/fixtures/votacion.fixture';
import { ActividadMongoRepository } from '../../../../src/repositories/actividadMongoRepository';
import {
  authHeader,
  AUTH_ORGANIZADOR,
  AUTH_PARTICIPANTE_1,
  AUTH_PARTICIPANTE_2,
} from '../../../helpers/fixtures/auth.fixture';

describe('Resultados y Cierre de Votaciones', () => {
  const app = createApp(new ActividadMongoRepository());

  describe('GET /api/actividades/:id/votaciones/:votacionId', () => {
    it('retorna resultados parciales con conteo de votos correcto', async () => {
      const { actividadId, votacionId, alternativas } = await seedActividadConVotacion();
      const alt1 = alternativas[0].id;

      // Voto 1
      await request(app)
        .post(`/api/actividades/${actividadId}/votaciones/${votacionId}/alternativas/${alt1}/votar`)
        .set(authHeader(AUTH_PARTICIPANTE_1))
        .send({});

      // Voto 2
      await request(app)
        .post(`/api/actividades/${actividadId}/votaciones/${votacionId}/alternativas/${alt1}/votar`)
        .set(authHeader(AUTH_PARTICIPANTE_2))
        .send({});

      const response = await request(app)
        .get(`/api/actividades/${actividadId}/votaciones/${votacionId}`)
        .set(authHeader(AUTH_PARTICIPANTE_1));

      expect(response.status).toBe(200);
      expect(response.body.conteo[alt1]).toBe(2);
      expect(response.body.totalVotos).toBe(2);
    });

    it('retorna 404 si la votación no existe', async () => {
      const { actividadId } = await seedActividadConVotacion();
      const fakeVotacionId = '66db614fef5a153200000000';

      const response = await request(app)
        .get(`/api/actividades/${actividadId}/votaciones/${fakeVotacionId}`)
        .set(authHeader(AUTH_PARTICIPANTE_1));

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/actividades/:id/votaciones/:votacionId', () => {
    it('cierra manualmente la votación como organizador y actualiza el estado en MongoDB', async () => {
      const { actividadId, votacionId, alternativas } = await seedActividadConVotacion({
        min_participantes: 2,
      });
      const alt1 = alternativas[0].id;

      // Ambos participantes votan la alternativa 1 para alcanzar quórum
      await request(app)
        .post(`/api/actividades/${actividadId}/votaciones/${votacionId}/alternativas/${alt1}/votar`)
        .set(authHeader(AUTH_ORGANIZADOR))
        .send({});
      await request(app)
        .post(`/api/actividades/${actividadId}/votaciones/${votacionId}/alternativas/${alt1}/votar`)
        .set(authHeader(AUTH_PARTICIPANTE_1))
        .send({});

      const response = await request(app)
        .delete(`/api/actividades/${actividadId}/votaciones/${votacionId}`)
        .set(authHeader(AUTH_ORGANIZADOR));

      // 1. Verificación del contrato HTTP
      expect(response.status).toBe(200);
      expect(response.body.estado).toBe('CONFIRMADA');

      // 2. Verificación dual de persistencia en MongoDB
      const doc = await ActividadModel.findById(actividadId);
      expect(doc).not.toBeNull();
      expect(doc?.estado).toBe('CONFIRMADA');
    });

    it('rechaza si el usuario que intenta cerrar no es el organizador', async () => {
      const { actividadId, votacionId } = await seedActividadConVotacion();

      const response = await request(app)
        .delete(`/api/actividades/${actividadId}/votaciones/${votacionId}`)
        .set(authHeader(AUTH_PARTICIPANTE_1));

      expect(response.status).toBe(403);

      // Verificación dual en MongoDB: la actividad sigue en votación
      const doc = await ActividadModel.findById(actividadId);
      expect(doc?.estado).toBe('EN_VOTACION');
    });

    it('retorna 404 si la actividad no existe', async () => {
      const fakeId = '66db614fef5a153200000000';
      const response = await request(app)
        .delete(`/api/actividades/${fakeId}/votaciones/fake-votacion`)
        .set(authHeader(AUTH_ORGANIZADOR));

      expect(response.status).toBe(404);
    });

    it('retorna 404 si la votación no existe', async () => {
      const { actividadId } = await seedActividadConVotacion();
      const fakeVotacionId = '66db614fef5a153200000000';

      const response = await request(app)
        .delete(`/api/actividades/${actividadId}/votaciones/${fakeVotacionId}`)
        .set(authHeader(AUTH_ORGANIZADOR));

      expect(response.status).toBe(404);
    });

    it('retorna 409 si la votación ya está cerrada', async () => {
      const { actividadId, votacionId } = await seedActividadConVotacion();

      // Primer cierre
      await request(app)
        .delete(`/api/actividades/${actividadId}/votaciones/${votacionId}`)
        .set(authHeader(AUTH_ORGANIZADOR));

      // Segundo intento de cierre sobre la misma votación
      const response = await request(app)
        .delete(`/api/actividades/${actividadId}/votaciones/${votacionId}`)
        .set(authHeader(AUTH_ORGANIZADOR));

      expect(response.status).toBe(409);
    });
  });
});
