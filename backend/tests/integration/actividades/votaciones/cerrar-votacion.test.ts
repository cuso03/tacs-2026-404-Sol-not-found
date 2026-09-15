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
    it('cierra manualmente la votación como organizador, reprograma la actividad y actualiza MongoDB', async () => {
      const { actividadId, votacionId, alternativas } = await seedActividadConVotacion({
        min_participantes: 2,
      });
      const alt1 = alternativas[0];

      // Ambos participantes votan la alternativa 1 para alcanzar quórum
      await request(app)
        .post(`/api/actividades/${actividadId}/votaciones/${votacionId}/alternativas/${alt1.id}/votar`)
        .set(authHeader(AUTH_ORGANIZADOR))
        .send({});
      await request(app)
        .post(`/api/actividades/${actividadId}/votaciones/${votacionId}/alternativas/${alt1.id}/votar`)
        .set(authHeader(AUTH_PARTICIPANTE_1))
        .send({});

      const response = await request(app)
        .delete(`/api/actividades/${actividadId}/votaciones/${votacionId}`)
        .set(authHeader(AUTH_ORGANIZADOR));

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
        .post(`/api/actividades/${actividadId}/votaciones/${votacionId}/alternativas/${alt1.id}/votar`)
        .set(authHeader(AUTH_ORGANIZADOR))
        .send({});
      await request(app)
        .post(`/api/actividades/${actividadId}/votaciones/${votacionId}/alternativas/${alt1.id}/votar`)
        .set(authHeader(AUTH_PARTICIPANTE_1))
        .send({});
      await request(app)
        .post(`/api/actividades/${actividadId}/votaciones/${votacionId}/alternativas/${alt2.id}/votar`)
        .set(authHeader(AUTH_PARTICIPANTE_2))
        .send({});

      const response = await request(app)
        .delete(`/api/actividades/${actividadId}/votaciones/${votacionId}`)
        .set(authHeader(AUTH_ORGANIZADOR));

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
        .delete(`/api/actividades/${actividadId}/votaciones/${votacionId}`)
        .set(authHeader(AUTH_ORGANIZADOR));

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
        .post(`/api/actividades/${actividadId}/votaciones/${votacionId}/alternativas/${alt1.id}/votar`)
        .set(authHeader(AUTH_ORGANIZADOR))
        .send({});
      await request(app)
        .post(`/api/actividades/${actividadId}/votaciones/${votacionId}/alternativas/${alt1.id}/votar`)
        .set(authHeader(AUTH_PARTICIPANTE_1))
        .send({});
      await request(app)
        .post(`/api/actividades/${actividadId}/votaciones/${votacionId}/alternativas/${alt2.id}/votar`)
        .set(authHeader(AUTH_PARTICIPANTE_2))
        .send({});
      await request(app)
        .post(`/api/actividades/${actividadId}/votaciones/${votacionId}/alternativas/${alt2.id}/votar`)
        .set(authHeader('auth0|participante-3'))
        .send({});

      const response = await request(app)
        .delete(`/api/actividades/${actividadId}/votaciones/${votacionId}`)
        .set(authHeader(AUTH_ORGANIZADOR));

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
        .post(`/api/actividades/${actividadId}/votaciones/${votacionId}/alternativas/${alt1.id}/votar`)
        .set(authHeader(AUTH_ORGANIZADOR))
        .send({});
      await request(app)
        .post(`/api/actividades/${actividadId}/votaciones/${votacionId}/alternativas/${alt1.id}/votar`)
        .set(authHeader(AUTH_PARTICIPANTE_1))
        .send({});
      await request(app)
        .post(`/api/actividades/${actividadId}/votaciones/${votacionId}/alternativas/${alt1.id}/votar`)
        .set(authHeader(AUTH_PARTICIPANTE_2))
        .send({});

      const response = await request(app)
        .delete(`/api/actividades/${actividadId}/votaciones/${votacionId}`)
        .set(authHeader(AUTH_ORGANIZADOR));

      expect(response.status).toBe(200);
      expect(response.body.estado).toBe('REPROGRAMADA');
      expect(response.body.fecha_horario).toBe(alt1.fecha_horario);

      const doc = await ActividadModel.findById(actividadId);
      expect(doc?.estado).toBe('REPROGRAMADA');
      expect(doc?.fecha_horario).toBe(alt1.fecha_horario);
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
