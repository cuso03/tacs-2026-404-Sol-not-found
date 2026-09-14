import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../../src/app';
import { InMemoryEstadisticasStore } from '../../../src/utils/InMemoryEstadisticasStore';
import { ClimaMonitorService } from '../../../src/services/clima/ClimaMonitorService';
import { MockWeatherService } from '../../../src/services/mockWeatherService';
import { createActividadPayload, seedActividad } from '../../helpers/fixtures/actividad.fixture';
import { createReglasPayload } from '../../helpers/fixtures/regla.fixture';
import { seedActividadConVotacion } from '../../helpers/fixtures/votacion.fixture';
import { ActividadMongoRepository } from '../../../src/repositories/actividadMongoRepository';
import {
  authHeader,
  adminHeader,
  AUTH_ORGANIZADOR,
  AUTH_PARTICIPANTE_1,
  AUTH_PARTICIPANTE_2,
} from '../../helpers/fixtures/auth.fixture';

describe('GET /api/admin/estadisticas', () => {
  describe('Control de acceso y estado inicial', () => {
    it('responde 403 si no se envía el header X-User-Role: admin', async () => {
      const response = await request(createApp(new ActividadMongoRepository())).get('/api/admin/estadisticas');
      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Requiere rol admin');
    });

    it('responde 200 con un objeto JSON cuando el rol es admin', async () => {
      const response = await request(createApp(new ActividadMongoRepository()))
        .get('/api/admin/estadisticas')
        .set(adminHeader());

      expect(response.status).toBe(200);
      expect(response.body).toBeTypeOf('object');
    });

    it('devuelve un objeto vacío cuando no se realizó ninguna acción', async () => {
      const estadisticas = new InMemoryEstadisticasStore();
      const app = createApp(new ActividadMongoRepository(), undefined, undefined, estadisticas);

      const response = await request(app)
        .get('/api/admin/estadisticas')
        .set(adminHeader());

      expect(response.status).toBe(200);
      expect(response.body).toEqual({});
    });
  });

  describe('Métrica: Actividad_Creada', () => {
    it('incrementa en 1 al crear una actividad', async () => {
      const estadisticas = new InMemoryEstadisticasStore();
      const app = createApp(new ActividadMongoRepository(), undefined, undefined, estadisticas);

      await request(app)
        .post('/api/actividades')
        .set(authHeader(AUTH_ORGANIZADOR))
        .send(createActividadPayload());

      const response = await request(app)
        .get('/api/admin/estadisticas')
        .set(adminHeader());

      expect(response.status).toBe(200);
      expect(response.body.Actividad_Creada).toBe(1);
    });

    it('acumula correctamente al crear múltiples actividades', async () => {
      const estadisticas = new InMemoryEstadisticasStore();
      const app = createApp(new ActividadMongoRepository(), undefined, undefined, estadisticas);

      await request(app).post('/api/actividades').set(authHeader(AUTH_ORGANIZADOR)).send(createActividadPayload());
      await request(app).post('/api/actividades').set(authHeader(AUTH_ORGANIZADOR)).send(createActividadPayload());
      await request(app).post('/api/actividades').set(authHeader('auth0|organizador-2')).send(createActividadPayload());

      const response = await request(app).get('/api/admin/estadisticas').set(adminHeader());
      expect(response.body.Actividad_Creada).toBe(3);
    });

    it('no modifica Actividad_Creada cuando la solicitud es inválida (400)', async () => {
      const estadisticas = new InMemoryEstadisticasStore();
      const app = createApp(new ActividadMongoRepository(), undefined, undefined, estadisticas);

      await request(app)
        .post('/api/actividades')
        .set(authHeader(AUTH_ORGANIZADOR))
        .send(createActividadPayload({ min_participantes: 10, max_participantes: 2 }));

      const response = await request(app).get('/api/admin/estadisticas').set(adminHeader());
      expect(response.body.Actividad_Creada).toBeUndefined();
    });
  });

  describe('Métricas de monitoreo de clima', () => {
    it('incrementa consultas_clima al invocar checkActividadWeather en ClimaMonitorService', async () => {
      const estadisticas = new InMemoryEstadisticasStore();
      const weatherProvider = new MockWeatherService();
      const app = createApp(undefined, weatherProvider, undefined, estadisticas);

      const actividadDoc = await seedActividad();
      const actividad = (await app.get('repository') ?? {
        id: actividadDoc._id.toString(),
        titulo: actividadDoc.titulo,
        tipo: actividadDoc.tipo,
        ubicacion: actividadDoc.ubicacion,
        fecha_horario: actividadDoc.fecha_horario,
        creadorId: actividadDoc.creadorId,
        creadaEn: actividadDoc.creadaEn,
        estado: actividadDoc.estado,
        participantes: actividadDoc.participantes,
        votaciones: [],
        reglasClima: createReglasPayload(),
      }) as any;

      const monitor = new ClimaMonitorService(
        weatherProvider,
        { notify: async () => {} },
        estadisticas
      );

      await monitor.checkActividadWeather(actividad);
      await monitor.checkActividadWeather(actividad);

      const response = await request(app).get('/api/admin/estadisticas').set(adminHeader());
      expect(response.status).toBe(200);
      expect(response.body.consultas_clima).toBe(2);
    });

    it('incrementa alertas_mal_clima cuando el pronóstico no cumple las reglas', async () => {
      const estadisticas = new InMemoryEstadisticasStore();
      const badWeather = {
        getClima: async (_ubicacion: unknown, fecha_horario: string) => ({
          ubicacion: 'Plaza de Mayo',
          fecha_horario,
          clima_actual: { temperatura: 5, condicion: 'TORMENTA', viento: 80, humedad: 95 },
          pronostico_actividad: { probabilidad_lluvia: 95, temperatura: 5, viento: 80, condicion: 'TORMENTA' },
        }),
        obtenerPronostico: async () => [],
      } as any;

      const app = createApp(undefined, badWeather, undefined, estadisticas);
      const actividadDoc = await seedActividad({
        reglasClima: createReglasPayload(),
      });

      const actividad = {
        id: actividadDoc._id.toString(),
        titulo: actividadDoc.titulo,
        descripcion: actividadDoc.descripcion,
        tipo: actividadDoc.tipo,
        ubicacion: actividadDoc.ubicacion,
        fecha_horario: actividadDoc.fecha_horario,
        min_participantes: actividadDoc.min_participantes,
        max_participantes: actividadDoc.max_participantes,
        creadorId: actividadDoc.creadorId,
        creadaEn: actividadDoc.creadaEn,
        estado: actividadDoc.estado,
        participantes: actividadDoc.participantes,
        votaciones: [],
        reglasClima: createReglasPayload(),
      } as any;

      const monitor = new ClimaMonitorService(badWeather, { notify: async () => {} }, estadisticas);
      await monitor.checkActividadWeather(actividad);

      const response = await request(app).get('/api/admin/estadisticas').set(adminHeader());
      expect(response.body.consultas_clima).toBe(1);
      expect(response.body.alertas_mal_clima).toBe(1);
    });
  });

  describe('Métrica: Actividad_Reprogramada', () => {
    it('incrementa Actividad_Reprogramada al cerrar una votación sin quórum', async () => {
      const estadisticas = new InMemoryEstadisticasStore();
      const app = createApp(new ActividadMongoRepository(), undefined, undefined, estadisticas);

      // Actividad con mínimo 2 participantes, pero solo está el organizador y no hay votos
      const { actividadId, votacionId } = await seedActividadConVotacion({
        min_participantes: 2,
        participantes: [AUTH_ORGANIZADOR],
      });

      const cerrarRes = await request(app)
        .delete(`/api/actividades/${actividadId}/votaciones/${votacionId}`)
        .set(authHeader(AUTH_ORGANIZADOR));

      expect(cerrarRes.status).toBe(200);
      expect(cerrarRes.body.estado).toBe('CANCELADA');

      const response = await request(app).get('/api/admin/estadisticas').set(adminHeader());
      expect(response.status).toBe(200);
      expect(response.body.Actividad_Reprogramada).toBe(1);
    });

    it('no incrementa Actividad_Reprogramada cuando la votación tiene quórum y hay ganadora', async () => {
      const estadisticas = new InMemoryEstadisticasStore();
      const app = createApp(new ActividadMongoRepository(), undefined, undefined, estadisticas);

      const { actividadId, votacionId, alternativas } = await seedActividadConVotacion({
        min_participantes: 2,
        participantes: [AUTH_ORGANIZADOR, AUTH_PARTICIPANTE_1],
      });
      const altId = alternativas[0].id;

      // Ambos participantes votan para dar quórum y mayoría a altId
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
      expect(cerrarRes.body.estado).toBe('CONFIRMADA');

      const response = await request(app).get('/api/admin/estadisticas').set(adminHeader());
      expect(response.body.Actividad_Reprogramada).toBeUndefined();
    });

    it('acumula Actividad_Reprogramada en múltiples cierres sin quórum', async () => {
      const estadisticas = new InMemoryEstadisticasStore();
      const app = createApp(new ActividadMongoRepository(), undefined, undefined, estadisticas);

      for (let i = 0; i < 3; i++) {
        const { actividadId, votacionId } = await seedActividadConVotacion({
          min_participantes: 2,
          participantes: [AUTH_ORGANIZADOR],
        });

        await request(app)
          .delete(`/api/actividades/${actividadId}/votaciones/${votacionId}`)
          .set(authHeader(AUTH_ORGANIZADOR));
      }

      const response = await request(app).get('/api/admin/estadisticas').set(adminHeader());
      expect(response.body.Actividad_Reprogramada).toBe(3);
    });
  });

  describe('Aislamiento e idempotencia de contadores', () => {
    it('cada InMemoryEstadisticasStore es independiente entre instancias', async () => {
      const stats1 = new InMemoryEstadisticasStore();
      const stats2 = new InMemoryEstadisticasStore();
      const app1 = createApp(undefined, undefined, undefined, stats1);
      const app2 = createApp(undefined, undefined, undefined, stats2);

      await request(app1).post('/api/actividades').set(authHeader('auth0|u1')).send(createActividadPayload());
      await request(app1).post('/api/actividades').set(authHeader('auth0|u1')).send(createActividadPayload());

      const res1 = await request(app1).get('/api/admin/estadisticas').set(adminHeader());
      const res2 = await request(app2).get('/api/admin/estadisticas').set(adminHeader());

      expect(res1.body.Actividad_Creada).toBe(2);
      expect(res2.body.Actividad_Creada).toBeUndefined();
    });

    it('reset() limpia todos los contadores de forma idempotente', async () => {
      const estadisticas = new InMemoryEstadisticasStore();
      const app = createApp(new ActividadMongoRepository(), undefined, undefined, estadisticas);

      await request(app).post('/api/actividades').set(authHeader('auth0|u1')).send(createActividadPayload());
      const antes = await request(app).get('/api/admin/estadisticas').set(adminHeader());
      expect(antes.body.Actividad_Creada).toBe(1);

      await estadisticas.reset();

      const despues = await request(app).get('/api/admin/estadisticas').set(adminHeader());
      expect(despues.body).toEqual({});
    });
  });
});
