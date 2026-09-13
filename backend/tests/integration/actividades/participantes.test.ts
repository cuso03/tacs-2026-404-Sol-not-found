import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../../src/app';
import { ActividadModel } from '../../../src/infrastructure/mongo/actividadModel';
import { seedActividad } from '../../helpers/fixtures/actividad.fixture';
import {
  authHeader,
  AUTH_ORGANIZADOR,
  AUTH_PARTICIPANTE_1,
  AUTH_PARTICIPANTE_2,
  AUTH_OTRO_USUARIO,
} from '../../helpers/fixtures/auth.fixture';

describe('Gestión de Participantes en Actividades', () => {
  const app = createApp();

  describe('POST /api/actividades/:id/participantes', () => {
    it('inscribe al usuario, permite ocupar el último cupo y persiste el cambio en MongoDB', async () => {
      const actividad = await seedActividad({
        min_participantes: 1,
        max_participantes: 2,
        participantes: [AUTH_ORGANIZADOR],
      });
      const id = actividad._id.toString();

      const response = await request(app)
        .post(`/api/actividades/${id}/participantes`)
        .set(authHeader(AUTH_PARTICIPANTE_1));

      // 1. Verificación del contrato HTTP
      expect(response.status).toBe(201);
      expect(response.body.participantes).toEqual([AUTH_ORGANIZADOR, AUTH_PARTICIPANTE_1]);

      // 2. Verificación dual de persistencia en MongoDB
      const doc = await ActividadModel.findById(id);
      expect(doc).not.toBeNull();
      expect(doc?.participantes).toEqual([AUTH_ORGANIZADOR, AUTH_PARTICIPANTE_1]);
    });

    it('rechaza una inscripción duplicada sin modificar los participantes en MongoDB', async () => {
      const actividad = await seedActividad({
        min_participantes: 1,
        max_participantes: 3,
        participantes: [AUTH_ORGANIZADOR, AUTH_PARTICIPANTE_1],
      });
      const id = actividad._id.toString();

      const response = await request(app)
        .post(`/api/actividades/${id}/participantes`)
        .set(authHeader(AUTH_PARTICIPANTE_1));

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('ALREADY_PARTICIPATING');

      // Verificación dual en base de datos: el array no fue modificado
      const doc = await ActividadModel.findById(id);
      expect(doc?.participantes).toEqual([AUTH_ORGANIZADOR, AUTH_PARTICIPANTE_1]);
    });

    it('rechaza una inscripción sin cupo y conserva el estado en MongoDB', async () => {
      const actividad = await seedActividad({
        min_participantes: 1,
        max_participantes: 1,
        participantes: [AUTH_ORGANIZADOR],
      });
      const id = actividad._id.toString();

      const response = await request(app)
        .post(`/api/actividades/${id}/participantes`)
        .set(authHeader(AUTH_PARTICIPANTE_1));

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('ACTIVITY_FULL');

      // Verificación dual en base de datos
      const doc = await ActividadModel.findById(id);
      expect(doc?.participantes).toEqual([AUTH_ORGANIZADOR]);
    });

    it('responde 404 si la actividad no existe en MongoDB', async () => {
      const fakeId = '66db614fef5a153200000000';
      const response = await request(app)
        .post(`/api/actividades/${fakeId}/participantes`)
        .set(authHeader(AUTH_PARTICIPANTE_1));

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('ACTIVITY_NOT_FOUND');
    });

    it('exige la identidad del usuario y no modifica el documento en DB', async () => {
      const actividad = await seedActividad({
        min_participantes: 1,
        max_participantes: 3,
        participantes: [AUTH_ORGANIZADOR],
      });
      const id = actividad._id.toString();

      const response = await request(app).post(`/api/actividades/${id}/participantes`);

      expect(response.status).toBe(401);

      // Verificación dual en base de datos
      const doc = await ActividadModel.findById(id);
      expect(doc?.participantes).toEqual([AUTH_ORGANIZADOR]);
    });
  });

  describe('DELETE /api/actividades/:id/participantes/me', () => {
    it('da de baja solo al usuario autenticado, libera el cupo y persiste en MongoDB', async () => {
      const actividad = await seedActividad({
        min_participantes: 1,
        max_participantes: 2,
        participantes: [AUTH_ORGANIZADOR, AUTH_PARTICIPANTE_1],
      });
      const id = actividad._id.toString();

      // 1. Participante 1 se da de baja
      const removed = await request(app)
        .delete(`/api/actividades/${id}/participantes/me`)
        .set(authHeader(AUTH_PARTICIPANTE_1));

      expect(removed.status).toBe(200);
      expect(removed.body.participantes).toEqual([AUTH_ORGANIZADOR]);

      // Verificación dual en DB
      let doc = await ActividadModel.findById(id);
      expect(doc?.participantes).toEqual([AUTH_ORGANIZADOR]);

      // 2. Un nuevo participante aprovecha el cupo liberado
      const replacement = await request(app)
        .post(`/api/actividades/${id}/participantes`)
        .set(authHeader(AUTH_PARTICIPANTE_2));

      expect(replacement.status).toBe(201);
      expect(replacement.body.participantes).toEqual([AUTH_ORGANIZADOR, AUTH_PARTICIPANTE_2]);

      // Verificación dual en DB del nuevo participante
      doc = await ActividadModel.findById(id);
      expect(doc?.participantes).toEqual([AUTH_ORGANIZADOR, AUTH_PARTICIPANTE_2]);
    });

    it('rechaza la baja de un usuario no inscripto sin alterar la DB', async () => {
      const actividad = await seedActividad({
        min_participantes: 1,
        max_participantes: 3,
        participantes: [AUTH_ORGANIZADOR],
      });
      const id = actividad._id.toString();

      const response = await request(app)
        .delete(`/api/actividades/${id}/participantes/me`)
        .set(authHeader(AUTH_OTRO_USUARIO));

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('NOT_PARTICIPATING');

      // Verificación dual en DB
      const doc = await ActividadModel.findById(id);
      expect(doc?.participantes).toEqual([AUTH_ORGANIZADOR]);
    });

    it('impide que el organizador se dé de baja', async () => {
      const actividad = await seedActividad({
        min_participantes: 1,
        max_participantes: 3,
        participantes: [AUTH_ORGANIZADOR],
      });
      const id = actividad._id.toString();

      const response = await request(app)
        .delete(`/api/actividades/${id}/participantes/me`)
        .set(authHeader(AUTH_ORGANIZADOR));

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('ORGANIZER_CANNOT_LEAVE');

      // Verificación dual en DB
      const doc = await ActividadModel.findById(id);
      expect(doc?.participantes).toEqual([AUTH_ORGANIZADOR]);
    });

    it('responde 404 si la actividad no existe en MongoDB', async () => {
      const fakeId = '66db614fef5a153200000000';
      const response = await request(app)
        .delete(`/api/actividades/${fakeId}/participantes/me`)
        .set(authHeader(AUTH_PARTICIPANTE_1));

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('ACTIVITY_NOT_FOUND');
    });

    it('exige autenticación y no modifica los participantes en base de datos', async () => {
      const actividad = await seedActividad({
        min_participantes: 1,
        max_participantes: 3,
        participantes: [AUTH_ORGANIZADOR, AUTH_PARTICIPANTE_1],
      });
      const id = actividad._id.toString();

      const response = await request(app).delete(`/api/actividades/${id}/participantes/me`);

      expect(response.status).toBe(401);

      // Verificación dual en DB
      const doc = await ActividadModel.findById(id);
      expect(doc?.participantes).toEqual([AUTH_ORGANIZADOR, AUTH_PARTICIPANTE_1]);
    });
  });
});
