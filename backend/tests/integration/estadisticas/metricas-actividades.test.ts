import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../../src/app';
import { EstadisticaModel } from '../../../src/infrastructure/mongo/estadisticasModel';
import { createActividadPayload } from '../../helpers/fixtures/actividad.fixture';
import { seedActividadConVotacion } from '../../helpers/fixtures/votacion.fixture';
import {
  adminHeader,
  authHeader,
  AUTH_ORGANIZADOR,
  AUTH_PARTICIPANTE_1,
} from '../../helpers/fixtures/auth.fixture';

describe('Métricas de Ciclo de Vida de Actividades', () => {
  const app = createApp();

  describe('Métrica: Actividad_Creada', () => {
    it('incrementa en 1 al crear una actividad válida y persiste en MongoDB', async () => {
      const payload = createActividadPayload();

      const createRes = await request(app)
        .post('/api/actividades')
        .set(authHeader(AUTH_ORGANIZADOR))
        .send(payload);
      expect(createRes.status).toBe(201);

      // 1. Verificación vía endpoint de estadísticas
      const statsRes = await request(app)
        .get('/api/admin/estadisticas')
        .set(adminHeader());

      expect(statsRes.status).toBe(200);
      expect(statsRes.body.Actividad_Creada).toBe(1);

      // 2. Verificación dual directa en base de datos
      const doc = await EstadisticaModel.findOne({ metrica: 'Actividad_Creada' });
      expect(doc?.cantidad).toBe(1);
    });

    it('acumula correctamente al crear múltiples actividades por distintos organizadores', async () => {
      await request(app).post('/api/actividades').set(authHeader(AUTH_ORGANIZADOR)).send(createActividadPayload());
      await request(app).post('/api/actividades').set(authHeader(AUTH_ORGANIZADOR)).send(createActividadPayload());
      await request(app).post('/api/actividades').set(authHeader('auth0|organizador-2')).send(createActividadPayload());

      const response = await request(app)
        .get('/api/admin/estadisticas')
        .set(adminHeader());

      expect(response.status).toBe(200);
      expect(response.body.Actividad_Creada).toBe(3);
    });

    it('no incrementa Actividad_Creada cuando la solicitud falla por validación (400)', async () => {
      const response = await request(app)
        .post('/api/actividades')
        .set(authHeader(AUTH_ORGANIZADOR))
        .send(createActividadPayload({ min_participantes: 10, max_participantes: 2 }));

      expect(response.status).toBe(400);

      const statsRes = await request(app)
        .get('/api/admin/estadisticas')
        .set(adminHeader());

      expect(statsRes.body.Actividad_Creada).toBeUndefined();
    });
  });

  describe('Métrica: Actividad_Reprogramada', () => {
    it('incrementa Actividad_Reprogramada cuando la votación alcanza quórum y se reprograma', async () => {
      const { actividadId, votacionId, alternativas } = await seedActividadConVotacion({
        min_participantes: 2,
        participantes: [AUTH_ORGANIZADOR, AUTH_PARTICIPANTE_1],
      });
      const altId = alternativas[0].id;

      await request(app)
        .post(`/api/actividades/${actividadId}/votaciones/${votacionId}/alternativas/${altId}/votar`)
        .set(authHeader(AUTH_ORGANIZADOR))
        .send({});

      await request(app)
        .post(`/api/actividades/${actividadId}/votaciones/${votacionId}/alternativas/${altId}/votar`)
        .set(authHeader(AUTH_PARTICIPANTE_1))
        .send({});

      const cerrarRes = await request(app)
        .delete(`/api/actividades/${actividadId}/votaciones/${votacionId}`)
        .set(authHeader(AUTH_ORGANIZADOR));

      expect(cerrarRes.status).toBe(200);
      expect(cerrarRes.body.estado).toBe('REPROGRAMADA');

      const statsRes = await request(app)
        .get('/api/admin/estadisticas')
        .set(adminHeader());

      expect(statsRes.status).toBe(200);
      expect(statsRes.body.Actividad_Reprogramada).toBe(1);

      // Verificación dual en DB
      const doc = await EstadisticaModel.findOne({ metrica: 'Actividad_Reprogramada' });
      expect(doc?.cantidad).toBe(1);
    });

    it('no incrementa Actividad_Reprogramada al cancelar votación por falta de quórum', async () => {
      const { actividadId, votacionId } = await seedActividadConVotacion({
        min_participantes: 2,
        participantes: [AUTH_ORGANIZADOR],
      });

      const cerrarRes = await request(app)
        .delete(`/api/actividades/${actividadId}/votaciones/${votacionId}`)
        .set(authHeader(AUTH_ORGANIZADOR));

      expect(cerrarRes.status).toBe(200);
      expect(cerrarRes.body.estado).toBe('CANCELADA');

      const statsRes = await request(app)
        .get('/api/admin/estadisticas')
        .set(adminHeader());

      expect(statsRes.body.Actividad_Reprogramada).toBeUndefined();
    });

    it('acumula Actividad_Reprogramada en reprogramaciones sucesivas', async () => {
      for (let i = 0; i < 3; i++) {
        const { actividadId, votacionId, alternativas } = await seedActividadConVotacion({
          min_participantes: 2,
          participantes: [AUTH_ORGANIZADOR, AUTH_PARTICIPANTE_1],
        });
        const altId = alternativas[0].id;

        await request(app)
          .post(`/api/actividades/${actividadId}/votaciones/${votacionId}/alternativas/${altId}/votar`)
          .set(authHeader(AUTH_ORGANIZADOR))
          .send({});

        await request(app)
          .post(`/api/actividades/${actividadId}/votaciones/${votacionId}/alternativas/${altId}/votar`)
          .set(authHeader(AUTH_PARTICIPANTE_1))
          .send({});

        await request(app)
          .delete(`/api/actividades/${actividadId}/votaciones/${votacionId}`)
          .set(authHeader(AUTH_ORGANIZADOR));
      }

      const statsRes = await request(app)
        .get('/api/admin/estadisticas')
        .set(adminHeader());

      expect(statsRes.body.Actividad_Reprogramada).toBe(3);
    });
  });

  describe('Métrica: Actividad_Cancelada', () => {
    it('incrementa Actividad_Cancelada al cancelar votación por falta de quórum', async () => {
      const { actividadId, votacionId } = await seedActividadConVotacion({
        min_participantes: 2,
        participantes: [AUTH_ORGANIZADOR],
      });

      const cerrarRes = await request(app)
        .delete(`/api/actividades/${actividadId}/votaciones/${votacionId}`)
        .set(authHeader(AUTH_ORGANIZADOR));

      expect(cerrarRes.status).toBe(200);
      expect(cerrarRes.body.estado).toBe('CANCELADA');

      const statsRes = await request(app)
        .get('/api/admin/estadisticas')
        .set(adminHeader());

      expect(statsRes.status).toBe(200);
      expect(statsRes.body.Actividad_Cancelada).toBe(1);

      // Verificación dual en DB
      const doc = await EstadisticaModel.findOne({ metrica: 'Actividad_Cancelada' });
      expect(doc?.cantidad).toBe(1);
    });

    it('no incrementa Actividad_Cancelada si la votación alcanza quórum y se reprograma', async () => {
      const { actividadId, votacionId, alternativas } = await seedActividadConVotacion({
        min_participantes: 2,
        participantes: [AUTH_ORGANIZADOR, AUTH_PARTICIPANTE_1],
      });
      const altId = alternativas[0].id;

      await request(app)
        .post(`/api/actividades/${actividadId}/votaciones/${votacionId}/alternativas/${altId}/votar`)
        .set(authHeader(AUTH_ORGANIZADOR))
        .send({});

      await request(app)
        .post(`/api/actividades/${actividadId}/votaciones/${votacionId}/alternativas/${altId}/votar`)
        .set(authHeader(AUTH_PARTICIPANTE_1))
        .send({});

      const cerrarRes = await request(app)
        .delete(`/api/actividades/${actividadId}/votaciones/${votacionId}`)
        .set(authHeader(AUTH_ORGANIZADOR));

      expect(cerrarRes.status).toBe(200);
      expect(cerrarRes.body.estado).toBe('REPROGRAMADA');

      const statsRes = await request(app)
        .get('/api/admin/estadisticas')
        .set(adminHeader());

      expect(statsRes.body.Actividad_Cancelada).toBeUndefined();
    });

    it('acumula Actividad_Cancelada en cancelaciones sucesivas', async () => {
      for (let i = 0; i < 3; i++) {
        const { actividadId, votacionId } = await seedActividadConVotacion({
          min_participantes: 2,
          participantes: [AUTH_ORGANIZADOR],
        });

        await request(app)
          .delete(`/api/actividades/${actividadId}/votaciones/${votacionId}`)
          .set(authHeader(AUTH_ORGANIZADOR));
      }

      const statsRes = await request(app)
        .get('/api/admin/estadisticas')
        .set(adminHeader());

      expect(statsRes.body.Actividad_Cancelada).toBe(3);
    });
  });
});
