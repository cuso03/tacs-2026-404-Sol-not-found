import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../src/app';
import { ActividadModel, toActividad } from '../../../src/infrastructure/mongo/actividadModel';
import { ActividadMongoRepository } from '../../../src/repositories/actividadMongoRepository';
import { EstadisticasMongoStore } from '../../../src/repositories/estadisticasMongoStore';
import { MockWeatherService } from '../../../src/services/mockWeatherService';
import { VotacionService } from '../../../src/services/votacionService';
import { ActividadEventNotifier } from '../../../src/services/notifications/ActividadEventNotifier';
import { ClimaMonitorService } from '../../../src/services/clima/ClimaMonitorService';
import { NotificacionMongoRepository } from '../../../src/repositories/notificacionMongoRepository';
import { createActividadPayload, seedActividad } from '../../helpers/fixtures/actividad.fixture';
import { seedActividadConVotacion } from '../../helpers/fixtures/votacion.fixture';
import { createReglasPayload } from '../../helpers/fixtures/regla.fixture';
import { authHeader, AUTH_ORGANIZADOR, AUTH_PARTICIPANTE_1, adminHeader } from '../../helpers/fixtures/auth.fixture';

const future = () => new Date(Date.now() + 86400000).toISOString();
const weather = new MockWeatherService();
const app = createApp(weather);

describe('Correcciones de actividades', () => {
  it('excluye pasadas, canceladas y finalizadas antes de paginar, incluso con filtro pasado', async () => {
    await seedActividad({ fecha_horario: new Date(Date.now() - 1000).toISOString() });
    await seedActividad({ fecha_horario: future(), estado: 'CANCELADA' });
    await seedActividad({ fecha_horario: future(), estado: 'FINALIZADA' });
    const visible = await seedActividad({ fecha_horario: future() });
    const response = await request(app).get('/api/actividades').query({ fecha_desde: '2000-01-01T00:00:00Z', limit: 1 });
    expect(response.body.meta.total).toBe(1);
    expect(response.body.data[0].id).toBe(visible.id);
  });

  it('anula el voto al salir y no lo recupera al reinscribirse', async () => {
    const { actividadId, votacionId, alternativas } = await seedActividadConVotacion();
    const url = `/api/actividades/${actividadId}`;
    await request(app).put(`${url}/votaciones/${votacionId}/votos/me`).set(authHeader(AUTH_PARTICIPANTE_1)).send({ alternativa_id: alternativas[0].id }).expect(200);
    await request(app).delete(`${url}/participantes/me`).set(authHeader(AUTH_PARTICIPANTE_1)).expect(200);
    await request(app).post(`${url}/participantes`).set(authHeader(AUTH_PARTICIPANTE_1)).expect(201);
    const result = await request(app).get(`${url}/votaciones/${votacionId}`).set(authHeader(AUTH_ORGANIZADOR));
    expect(result.body.totalVotos).toBe(0);
    expect(result.body.votacion.votos).toEqual({});
  });

  it('permite editar y eliminar solo al organizador y registra las métricas', async () => {
    const activity = await seedActividad({ fecha_horario: future() });
    const url = `/api/actividades/${activity.id}`;
    const payload = createActividadPayload({ titulo: 'Título corregido', fecha_horario: future() });
    await request(app).put(url).send(payload).expect(401);
    await request(app).put(url).set(authHeader(AUTH_PARTICIPANTE_1)).send(payload).expect(403);
    await request(app).delete(url).set(authHeader(AUTH_PARTICIPANTE_1)).expect(403);
    const edited = await request(app).put(url).set(authHeader(AUTH_ORGANIZADOR)).send(payload).expect(200);
    expect(edited.body.titulo).toBe(payload.titulo);
    expect(edited.body.participantes).toEqual([AUTH_ORGANIZADOR]);
    await request(app).delete(url).set(authHeader(AUTH_ORGANIZADOR)).expect(204);
    await request(app).get(url).set(authHeader(AUTH_ORGANIZADOR)).expect(404);
    const stats = await request(app).get('/api/admin/estadisticas').set(adminHeader());
    expect(stats.body).toMatchObject({ Actividad_Modificada: 1, Actividad_Eliminada: 1 });
  });

  it('rechaza reducir cupos ocupados y cierra la votación pendiente al editar', async () => {
    const { actividadId, votacionId } = await seedActividadConVotacion();
    const url = `/api/actividades/${actividadId}`;
    await request(app).put(url).set(authHeader(AUTH_ORGANIZADOR)).send(createActividadPayload({ min_participantes: 1, max_participantes: 1 })).expect(409);
    const response = await request(app).put(url).set(authHeader(AUTH_ORGANIZADOR)).send(createActividadPayload({ fecha_horario: future() })).expect(200);
    expect(response.body.estado).toBe('PROPUESTA');
    expect(response.body.votaciones[0].estado).toBe('CERRADA');
    await request(app).patch(`${url}/votaciones/${votacionId}`).set(authHeader(AUTH_ORGANIZADOR)).send({ estado: 'CERRADA' }).expect(409);
  });

  it('no crea ni programa votaciones sin alternativas', async () => {
    const emptyWeather = { getClima: weather.getClima.bind(weather), obtenerPronostico: async () => [] };
    const programarCierreVotacion = vi.fn();
    const emptyApp = createApp(emptyWeather, { programarCierreVotacion });
    const activity = await seedActividad({ reglasClima: createReglasPayload() });
    await request(emptyApp).post(`/api/actividades/${activity.id}/votaciones`).set(authHeader(AUTH_ORGANIZADOR)).send({}).expect(409);
    expect(programarCierreVotacion).not.toHaveBeenCalled();
    const stored = await ActividadModel.findById(activity.id);
    expect(stored?.estado).toBe('PROPUESTA');
    expect(stored?.votaciones).toHaveLength(0);
  });

  it('el cierre programado usa el id persistido y actualiza las estadísticas una sola vez', async () => {
    const programarCierreVotacion = vi.fn();
    const scheduledApp = createApp(weather, { programarCierreVotacion });
    const activity = await seedActividad({ reglasClima: createReglasPayload() });
    const opened = await request(scheduledApp).post(`/api/actividades/${activity.id}/votaciones`).set(authHeader(AUTH_ORGANIZADOR)).send({ alternativas: [{ fecha_horario: future() }] }).expect(201);
    const voting = opened.body.votaciones[0];
    expect(programarCierreVotacion.mock.calls[0][1]).toBe(voting.id);
    const store = new EstadisticasMongoStore();
    const service = new VotacionService(new ActividadMongoRepository(), weather, { programarCierreVotacion }, new ActividadEventNotifier({ notify: async () => {} }, new NotificacionMongoRepository()), store);
    await service.cerrarVotacion(activity.id, voting.id);
    await service.cerrarVotacion(activity.id, voting.id);
    expect((await ActividadModel.findById(activity.id))?.estado).toBe('CANCELADA');
    expect((await store.obtener()).Actividad_Cancelada).toBe(1);
  });

  it('conserva la estadística aunque falle la notificación posterior al cierre', async () => {
    const { actividadId, votacionId } = await seedActividadConVotacion();
    const store = new EstadisticasMongoStore();
    const service = new VotacionService(new ActividadMongoRepository(), weather, { programarCierreVotacion: async () => {} }, new ActividadEventNotifier({ notify: async () => { throw new Error('cola caída'); } }, new NotificacionMongoRepository()), store);
    await expect(service.cerrarVotacion(actividadId, votacionId)).rejects.toThrow('cola caída');
    expect((await store.obtener()).Actividad_Cancelada).toBe(1);
  });

  it('no monitorea actividades pasadas ni anuncia una votación que no abrió', async () => {
    const activity = toActividad(await seedActividad({ fecha_horario: new Date(Date.now() - 1000).toISOString(), reglasClima: createReglasPayload() }));
    const getClima = vi.fn(weather.getClima.bind(weather));
    const notify = vi.fn();
    const store = new EstadisticasMongoStore();
    const badWeather = { getClima, obtenerPronostico: async () => [] };
    const service = new VotacionService(new ActividadMongoRepository(), badWeather, { programarCierreVotacion: async () => {} }, new ActividadEventNotifier({ notify }, new NotificacionMongoRepository()), store);
    const monitor = new ClimaMonitorService(badWeather, { notify }, store, service);
    await monitor.checkActividadWeather(activity);
    expect(getClima).not.toHaveBeenCalled();
    const upcoming = { ...activity, fecha_horario: new Date(Date.now() + 3600000).toISOString(), reglasClima: createReglasPayload({ temperatura_max: -90, temperatura_min: -100 }) };
    await monitor.checkActividadWeather(upcoming);
    expect(notify.mock.calls[0][1]).toContain('No se abrió una votación');
    expect(notify.mock.calls[0][1]).not.toContain('Se abrió una votación');
  });
});
