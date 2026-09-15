import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../../../src/app';
import { ActividadModel } from '../../../../src/infrastructure/mongo/actividadModel';
import { seedActividadConVotacion } from '../../../helpers/fixtures/votacion.fixture';
import {
  authHeader,
  AUTH_ORGANIZADOR,
  AUTH_PARTICIPANTE_1,
  AUTH_PARTICIPANTE_2,
} from '../../../helpers/fixtures/auth.fixture';

describe('Resultados y Cierre de Votaciones', () => {
  const app = createApp();

  describe('GET /api/actividades/:id/votaciones/:votacionId', () => {
    it('retorna resultados parciales con conteo de votos correcto', async () => {
      const { actividadId, votacionId, alternativas } = await seedActividadConVotacion();
      const alt1 = alternativas[0].id;

      // Voto 1
      await request(app)
        .put(`/api/actividades/${actividadId}/votaciones/${votacionId}/votos/me`)
        .set(authHeader(AUTH_PARTICIPANTE_1))
        .send({ alternativa_id: alt1 });

      // Voto 2
      await request(app)
        .put(`/api/actividades/${actividadId}/votaciones/${votacionId}/votos/me`)
        .set(authHeader(AUTH_PARTICIPANTE_2))
        .send({ alternativa_id: alt1 });

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

  describe('PATCH /api/actividades/:id/votaciones/:votacionId', () => {
    it('cierra manualmente la votación como organizador, reprograma la actividad y actualiza MongoDB', async () => {
      const { actividadId, votacionId, alternativas } = await seedActividadConVotacion({
        min_participantes: 2,
      });
      const alt1 = alternativas[0];

      // Ambos participantes votan la alternativa 1 para alcanzar quórum
      await request(app)
        .put(`/api/actividades/${actividadId}/votaciones/${votacionId}/votos/me`)
        .set(authHeader(AUTH_ORGANIZADOR))
        .send({ alternativa_id: alt1.id });
      await request(app)
        .put(`/api/actividades/${actividadId}/votaciones/${votacionId}/votos/me`)
        .set(authHeader(AUTH_PARTICIPANTE_1))
        .send({ alternativa_id: alt1.id });

      const response = await request(app)
        .patch(`/api/actividades/${actividadId}/votaciones/${votacionId}`)
        .set(authHeader(AUTH_ORGANIZADOR))
        .send({ estado: 'CERRADA' });

      // 1. Verificación del contrato HTTP
      expect(response.status).toBe(200);
      expect(response.body.estado).toBe('REPROGRAMADA');
      expect(response.body.fecha_horario).toBe(alt1.fecha_horario);

      // 2. Verificación dual de persistencia en MongoDB
      const doc = await ActividadModel.findById(actividadId);
      expect(doc).not.toBeNull();
      expect(doc?.estado).toBe('REPROGRAMADA');
      expect(doc?.fecha_horario).toBe(alt1.fecha_horario);
    });

    it('cancela la votación si la alternativa ganadora no alcanza el quórum (votos repartidos)', async () => {
      const { actividad, actividadId, votacionId, alternativas } = await seedActividadConVotacion({
        min_participantes: 3,
      });
      const fechaOriginal = actividad.fecha_horario;
      const alt1 = alternativas[0];
      const alt2 = alternativas[1];

      // Reparto 2-1: la ganadora (alt1) obtiene 2 votos con mínimo 3
      await request(app)
        .put(`/api/actividades/${actividadId}/votaciones/${votacionId}/votos/me`)
        .set(authHeader(AUTH_ORGANIZADOR))
        .send({ alternativa_id: alt1.id });
      await request(app)
        .put(`/api/actividades/${actividadId}/votaciones/${votacionId}/votos/me`)
        .set(authHeader(AUTH_PARTICIPANTE_1))
        .send({ alternativa_id: alt1.id });
      await request(app)
        .put(`/api/actividades/${actividadId}/votaciones/${votacionId}/votos/me`)
        .set(authHeader(AUTH_PARTICIPANTE_2))
        .send({ alternativa_id: alt2.id });

      const response = await request(app)
        .patch(`/api/actividades/${actividadId}/votaciones/${votacionId}`)
        .set(authHeader(AUTH_ORGANIZADOR))
        .send({ estado: 'CERRADA' });

      // 1. Verificación del contrato HTTP
      expect(response.status).toBe(200);
      expect(response.body.estado).toBe('CANCELADA');
      expect(response.body.fecha_horario).toBe(fechaOriginal);

      // 2. Verificación dual de persistencia en MongoDB
      const doc = await ActividadModel.findById(actividadId);
      expect(doc?.estado).toBe('CANCELADA');
      expect(doc?.fecha_horario).toBe(fechaOriginal);
    });

    it('cancela la votación si nadie emite un voto (falta de quórum)', async () => {
      const { actividad, actividadId, votacionId } = await seedActividadConVotacion({
        min_participantes: 2,
      });
      const fechaOriginal = actividad.fecha_horario;

      const response = await request(app)
        .patch(`/api/actividades/${actividadId}/votaciones/${votacionId}`)
        .set(authHeader(AUTH_ORGANIZADOR))
        .send({ estado: 'CERRADA' });

      expect(response.status).toBe(200);
      expect(response.body.estado).toBe('CANCELADA');
      expect(response.body.fecha_horario).toBe(fechaOriginal);

      const doc = await ActividadModel.findById(actividadId);
      expect(doc?.estado).toBe('CANCELADA');
      expect(doc?.fecha_horario).toBe(fechaOriginal);
    });

    it('cancela la votación si la ganadora queda alcanzada pero hay empate en el máximo', async () => {
      const { actividad, actividadId, votacionId, alternativas } = await seedActividadConVotacion({
        min_participantes: 2,
        participantes: [AUTH_ORGANIZADOR, AUTH_PARTICIPANTE_1, AUTH_PARTICIPANTE_2, 'auth0|participante-3'],
      });
      const fechaOriginal = actividad.fecha_horario;
      const alt1 = alternativas[0];
      const alt2 = alternativas[1];

      // Reparto 2-2: ambas alternativas alcanzan el quórum pero no hay ganadora única
      await request(app)
        .put(`/api/actividades/${actividadId}/votaciones/${votacionId}/votos/me`)
        .set(authHeader(AUTH_ORGANIZADOR))
        .send({ alternativa_id: alt1.id });
      await request(app)
        .put(`/api/actividades/${actividadId}/votaciones/${votacionId}/votos/me`)
        .set(authHeader(AUTH_PARTICIPANTE_1))
        .send({ alternativa_id: alt1.id });
      await request(app)
        .put(`/api/actividades/${actividadId}/votaciones/${votacionId}/votos/me`)
        .set(authHeader(AUTH_PARTICIPANTE_2))
        .send({ alternativa_id: alt2.id });
      await request(app)
        .put(`/api/actividades/${actividadId}/votaciones/${votacionId}/votos/me`)
        .set(authHeader('auth0|participante-3'))
        .send({ alternativa_id: alt2.id });

      const response = await request(app)
        .patch(`/api/actividades/${actividadId}/votaciones/${votacionId}`)
        .set(authHeader(AUTH_ORGANIZADOR))
        .send({ estado: 'CERRADA' });

      expect(response.status).toBe(200);
      expect(response.body.estado).toBe('CANCELADA');
      expect(response.body.fecha_horario).toBe(fechaOriginal);

      const doc = await ActividadModel.findById(actividadId);
      expect(doc?.estado).toBe('CANCELADA');
      expect(doc?.fecha_horario).toBe(fechaOriginal);
    });

    it('confirma la reprogramación cuando la alternativa ganadora alcanza el quórum', async () => {
      const { actividadId, votacionId, alternativas } = await seedActividadConVotacion({
        min_participantes: 3,
      });
      const alt1 = alternativas[0];

      // Los tres participantes votan la misma alternativa: quórum alcanzado por la ganadora
      await request(app)
        .put(`/api/actividades/${actividadId}/votaciones/${votacionId}/votos/me`)
        .set(authHeader(AUTH_ORGANIZADOR))
        .send({ alternativa_id: alt1.id });
      await request(app)
        .put(`/api/actividades/${actividadId}/votaciones/${votacionId}/votos/me`)
        .set(authHeader(AUTH_PARTICIPANTE_1))
        .send({ alternativa_id: alt1.id });
      await request(app)
        .put(`/api/actividades/${actividadId}/votaciones/${votacionId}/votos/me`)
        .set(authHeader(AUTH_PARTICIPANTE_2))
        .send({ alternativa_id: alt1.id });

      const response = await request(app)
        .patch(`/api/actividades/${actividadId}/votaciones/${votacionId}`)
        .set(authHeader(AUTH_ORGANIZADOR))
        .send({ estado: 'CERRADA' });

      expect(response.status).toBe(200);
      expect(response.body.estado).toBe('REPROGRAMADA');
      expect(response.body.fecha_horario).toBe(alt1.fecha_horario);

      const doc = await ActividadModel.findById(actividadId);
      expect(doc?.estado).toBe('REPROGRAMADA');
      expect(doc?.fecha_horario).toBe(alt1.fecha_horario);
    });

    it('preserva el historial: la votación queda CERRADA y sigue accesible por GET', async () => {
      const { actividadId, votacionId } = await seedActividadConVotacion({
        min_participantes: 2,
        participantes: [AUTH_ORGANIZADOR],
      });

      const cerrarRes = await request(app)
        .patch(`/api/actividades/${actividadId}/votaciones/${votacionId}`)
        .set(authHeader(AUTH_ORGANIZADOR))
        .send({ estado: 'CERRADA' });
      expect(cerrarRes.status).toBe(200);

      const historial = await request(app)
        .get(`/api/actividades/${actividadId}/votaciones/${votacionId}`)
        .set(authHeader(AUTH_ORGANIZADOR));

      expect(historial.status).toBe(200);
      expect(historial.body.votacion.estado).toBe('CERRADA');
      expect(typeof historial.body.votacion.cerradaEn).toBe('string');
    });

    it('rechaza si el estado objetivo no es CERRADA', async () => {
      const { actividadId, votacionId } = await seedActividadConVotacion();

      const response = await request(app)
        .patch(`/api/actividades/${actividadId}/votaciones/${votacionId}`)
        .set(authHeader(AUTH_ORGANIZADOR))
        .send({ estado: 'ABIERTA' });

      expect(response.status).toBe(400);
    });

    it('rechaza si el body viene incompleto', async () => {
      const { actividadId, votacionId } = await seedActividadConVotacion();

      const response = await request(app)
        .patch(`/api/actividades/${actividadId}/votaciones/${votacionId}`)
        .set(authHeader(AUTH_ORGANIZADOR))
        .send({});

      expect(response.status).toBe(400);
    });

    it('rechaza si el usuario que intenta cerrar no es el organizador', async () => {
      const { actividadId, votacionId } = await seedActividadConVotacion();

      const response = await request(app)
        .patch(`/api/actividades/${actividadId}/votaciones/${votacionId}`)
        .set(authHeader(AUTH_PARTICIPANTE_1))
        .send({ estado: 'CERRADA' });

      expect(response.status).toBe(403);

      // Verificación dual en MongoDB: la actividad sigue en votación
      const doc = await ActividadModel.findById(actividadId);
      expect(doc?.estado).toBe('EN_VOTACION');
    });

    it('retorna 404 si la actividad no existe', async () => {
      const fakeId = '66db614fef5a153200000000';
      const response = await request(app)
        .patch(`/api/actividades/${fakeId}/votaciones/fake-votacion`)
        .set(authHeader(AUTH_ORGANIZADOR))
        .send({ estado: 'CERRADA' });

      expect(response.status).toBe(404);
    });

    it('retorna 404 si la votación no existe', async () => {
      const { actividadId } = await seedActividadConVotacion();
      const fakeVotacionId = '66db614fef5a153200000000';

      const response = await request(app)
        .patch(`/api/actividades/${actividadId}/votaciones/${fakeVotacionId}`)
        .set(authHeader(AUTH_ORGANIZADOR))
        .send({ estado: 'CERRADA' });

      expect(response.status).toBe(404);
    });

    it('retorna 409 si la votación ya está cerrada', async () => {
      const { actividadId, votacionId } = await seedActividadConVotacion();

      // Primer cierre
      await request(app)
        .patch(`/api/actividades/${actividadId}/votaciones/${votacionId}`)
        .set(authHeader(AUTH_ORGANIZADOR))
        .send({ estado: 'CERRADA' });

      // Segundo intento de cierre sobre la misma votación
      const response = await request(app)
        .patch(`/api/actividades/${actividadId}/votaciones/${votacionId}`)
        .set(authHeader(AUTH_ORGANIZADOR))
        .send({ estado: 'CERRADA' });

      expect(response.status).toBe(409);
    });
  });
});
