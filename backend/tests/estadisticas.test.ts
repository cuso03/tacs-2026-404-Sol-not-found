import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { ActividadInMemoryRepository } from '../src/repositories/actividadInMemoryRepository';
import { InMemoryEstadisticasStore } from '../src/utils/InMemoryEstadisticasStore';

// ─── Payloads reutilizables ────────────────────────────────────────────────────

const validPayload = {
  titulo: 'Caminata urbana',
  descripcion: 'Recorrido guiado por el centro',
  tipo: 'aire_libre',
  ubicacion: { tipo: 'coordenadas', latitud: -34.6037, longitud: -58.3816, direccion: 'Plaza de Mayo' },
  fecha_horario: '2026-09-10T14:00:00-03:00',
  min_participantes: 2,
  max_participantes: 12,
};

const validRules = {
  probabilidad_lluvia_max: 40,
  temperatura_min: 12,
  temperatura_max: 28,
  viento_max: 35,
  horas_anticipacion: 24,
  dias_max_reprogramacion: 3,
  rango_horario: { horario_min: '10:00', horario_max: '20:00' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Crea una actividad con reglas y devuelve su id. */
async function crearActividadConReglas(app: ReturnType<typeof createApp>, userId = 'auth0|organizador-1') {
  const created = await request(app)
    .post('/api/actividades')
    .set('X-User-Id', userId)
    .send(validPayload);
  const id = created.body.id as string;
  await request(app).post(`/api/actividades/${id}/reglas`).set('X-User-Id', userId).send(validRules);
  return id;
}

/** Abre una votación con dos alternativas manuales. */
async function abrirVotacion(app: ReturnType<typeof createApp>, id: string, userId = 'auth0|organizador-1') {
  return request(app)
    .post(`/api/actividades/${id}/votaciones`)
    .set('X-User-Id', userId)
    .send({
      alternativas: [
        { fecha_horario: '2026-09-12T14:00:00-03:00' },
        { fecha_horario: '2026-09-13T14:00:00-03:00' },
      ],
      duracion_horas: 24,
    });
}

// ─── Suite: acceso al endpoint ─────────────────────────────────────────────────

describe('GET /api/admin/estadisticas — acceso', () => {
  it('responde 403 si no se envía el header X-User-Role: admin', async () => {
    const response = await request(createApp()).get('/api/admin/estadisticas');
    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Requiere rol admin');
  });

  it('responde 200 con un objeto JSON cuando el rol es admin', async () => {
    const response = await request(createApp())
      .get('/api/admin/estadisticas')
      .set('X-User-Role', 'admin');
    expect(response.status).toBe(200);
    expect(response.body).toBeTypeOf('object');
  });

  it('devuelve un objeto vacío cuando no se realizó ninguna acción', async () => {
    const estadisticas = new InMemoryEstadisticasStore();
    const response = await request(createApp(undefined, undefined, undefined, estadisticas))
      .get('/api/admin/estadisticas')
      .set('X-User-Role', 'admin');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({});
  });
});

// ─── Suite: estadística de actividades creadas ────────────────────────────────

describe('GET /api/admin/estadisticas — Actividad_Creada', () => {
  it('incrementa en 1 al crear una actividad', async () => {
    const estadisticas = new InMemoryEstadisticasStore();
    const app = createApp(new ActividadInMemoryRepository(), undefined, undefined, estadisticas);

    await request(app).post('/api/actividades').set('X-User-Id', 'auth0|organizador-1').send(validPayload);

    const response = await request(app).get('/api/admin/estadisticas').set('X-User-Role', 'admin');
    expect(response.status).toBe(200);
    expect(response.body.Actividad_Creada).toBe(1);
  });

  it('acumula correctamente al crear múltiples actividades', async () => {
    const estadisticas = new InMemoryEstadisticasStore();
    const app = createApp(new ActividadInMemoryRepository(), undefined, undefined, estadisticas);

    await request(app).post('/api/actividades').set('X-User-Id', 'auth0|organizador-1').send(validPayload);
    await request(app).post('/api/actividades').set('X-User-Id', 'auth0|organizador-1').send(validPayload);
    await request(app).post('/api/actividades').set('X-User-Id', 'auth0|organizador-2').send(validPayload);

    const response = await request(app).get('/api/admin/estadisticas').set('X-User-Role', 'admin');
    expect(response.body.Actividad_Creada).toBe(3);
  });

  it('no modifica Actividad_Creada cuando la solicitud es inválida (400)', async () => {
    const estadisticas = new InMemoryEstadisticasStore();
    const app = createApp(new ActividadInMemoryRepository(), undefined, undefined, estadisticas);

    // Payload inválido: max_participantes < min_participantes
    await request(app)
      .post('/api/actividades')
      .set('X-User-Id', 'auth0|organizador-1')
      .send({ ...validPayload, max_participantes: 1, min_participantes: 5 });

    const response = await request(app).get('/api/admin/estadisticas').set('X-User-Role', 'admin');
    expect(response.body.Actividad_Creada).toBeUndefined();
  });
});

// ─── Suite: estadística de consultas de clima ────────────────────────────────

describe('GET /api/admin/estadisticas — consultas_clima', () => {
  it('incrementa consultas_clima al invocar checkActividadWeather en ClimaMonitorService', async () => {
    const { ClimaMonitorService } = await import('../src/services/clima/ClimaMonitorService');
    const { MockWeatherService } = await import('../src/services/mockWeatherService');

    const estadisticas = new InMemoryEstadisticasStore();
    const repository = new ActividadInMemoryRepository();
    const weatherProvider = new MockWeatherService();
    const app = createApp(repository, weatherProvider, undefined, estadisticas);

    // Crear actividad para tener un objeto Actividad válido
    const created = await request(app)
      .post('/api/actividades')
      .set('X-User-Id', 'auth0|organizador-1')
      .send(validPayload);
    const actividad = await repository.findById(created.body.id as string);

    // Simular el monitor de clima (que en producción se ejecuta mediante cron)
    const monitor = new ClimaMonitorService(
      weatherProvider,
      { notify: async () => {} },
      estadisticas,
    );
    await monitor.checkActividadWeather(actividad!);
    await monitor.checkActividadWeather(actividad!);

    const response = await request(app).get('/api/admin/estadisticas').set('X-User-Role', 'admin');
    expect(response.status).toBe(200);
    expect(response.body.consultas_clima).toBe(2);
  });

  it('incrementa alertas_mal_clima cuando el pronóstico no cumple las reglas', async () => {
    const { ClimaMonitorService } = await import('../src/services/clima/ClimaMonitorService');

    const estadisticas = new InMemoryEstadisticasStore();
    const repository = new ActividadInMemoryRepository();

    // Proveedor que siempre devuelve condición de tormenta (excede todas las reglas)
    const badWeather = {
      getClima: async (_ubicacion: unknown, fecha_horario: string) => ({
        ubicacion: 'Plaza de Mayo',
        fecha_horario,
        clima_actual: { temperatura: 5, condicion: 'TORMENTA', viento: 80, humedad: 95 },
        pronostico_actividad: { probabilidad_lluvia: 95, temperatura: 5, viento: 80, condicion: 'TORMENTA' },
      }),
      obtenerPronostico: async () => [],
    } as any;

    const app = createApp(repository, badWeather, undefined, estadisticas);
    const created = await request(app)
      .post('/api/actividades')
      .set('X-User-Id', 'auth0|organizador-1')
      .send(validPayload);
    await request(app)
      .post(`/api/actividades/${created.body.id}/reglas`)
      .set('X-User-Id', 'auth0|organizador-1')
      .send(validRules);
    const actividad = await repository.findById(created.body.id as string);

    const monitor = new ClimaMonitorService(badWeather, { notify: async () => {} }, estadisticas);
    await monitor.checkActividadWeather(actividad!);

    const response = await request(app).get('/api/admin/estadisticas').set('X-User-Role', 'admin');
    expect(response.body.consultas_clima).toBe(1);
    expect(response.body.alertas_mal_clima).toBe(1);
  });
});

// ─── Suite: estadística de reprogramación ────────────────────────────────────

describe('GET /api/admin/estadisticas — Actividad_Reprogramada', () => {
  it('incrementa Actividad_Reprogramada al cerrar una votación sin quórum', async () => {
    const estadisticas = new InMemoryEstadisticasStore();
    const repository = new ActividadInMemoryRepository();
    const app = createApp(repository, undefined, undefined, estadisticas);

    // Crear actividad (min_participantes=2) y abrir votación
    const id = await crearActividadConReglas(app);
    const votacionRes = await abrirVotacion(app, id);
    expect(votacionRes.status).toBe(201);

    const actividad = await repository.findById(id);
    const votacion = actividad!.votaciones[0];

    // Solo hay 1 participante (el organizador), no hay votos → no alcanza mínimo de 2 → CANCELADA
    const cerrarRes = await request(app)
      .delete(`/api/actividades/${id}/votaciones/${votacion.id}`)
      .set('X-User-Id', 'auth0|organizador-1');
    expect(cerrarRes.status).toBe(200);
    expect(cerrarRes.body.estado).toBe('CANCELADA');

    const response = await request(app).get('/api/admin/estadisticas').set('X-User-Role', 'admin');
    expect(response.status).toBe(200);
    expect(response.body.Actividad_Reprogramada).toBe(1);
  });

  it('no incrementa Actividad_Reprogramada cuando la votación tiene quórum y hay ganadora', async () => {
    const estadisticas = new InMemoryEstadisticasStore();
    const repository = new ActividadInMemoryRepository();
    const app = createApp(repository, undefined, undefined, estadisticas);

    const id = await crearActividadConReglas(app);
    await abrirVotacion(app, id);

    const actividad = await repository.findById(id);
    const votacion = actividad!.votaciones[0];
    const altId = votacion.alternativas[0].id;

    // Agregar segundo participante para alcanzar quórum (min=2) y votar
    await repository.update({ ...actividad!, participantes: ['auth0|organizador-1', 'auth0|user-2'] });
    await request(app)
      .post(`/api/actividades/${id}/votaciones/${votacion.id}/alternativas/${altId}/votar`)
      .set('X-User-Id', 'auth0|organizador-1')
      .send({});
    await request(app)
      .post(`/api/actividades/${id}/votaciones/${votacion.id}/alternativas/${altId}/votar`)
      .set('X-User-Id', 'auth0|user-2')
      .send({});

    const cerrarRes = await request(app)
      .delete(`/api/actividades/${id}/votaciones/${votacion.id}`)
      .set('X-User-Id', 'auth0|organizador-1');
    expect(cerrarRes.status).toBe(200);
    expect(cerrarRes.body.estado).toBe('CONFIRMADA');

    const response = await request(app).get('/api/admin/estadisticas').set('X-User-Role', 'admin');
    expect(response.body.Actividad_Reprogramada).toBeUndefined();
  });

  it('acumula Actividad_Reprogramada en múltiples cierres sin quórum', async () => {
    const estadisticas = new InMemoryEstadisticasStore();

    for (let i = 0; i < 3; i++) {
      const repository = new ActividadInMemoryRepository();
      const appLocal = createApp(repository, undefined, undefined, estadisticas);
      const id = await crearActividadConReglas(appLocal);
      await abrirVotacion(appLocal, id);
      const actividad = await repository.findById(id);
      const votacion = actividad!.votaciones[0];
      await request(appLocal)
        .delete(`/api/actividades/${id}/votaciones/${votacion.id}`)
        .set('X-User-Id', 'auth0|organizador-1');
    }

    // Verificar el total con cualquier app que comparta el mismo store
    const app = createApp(new ActividadInMemoryRepository(), undefined, undefined, estadisticas);
    const response = await request(app).get('/api/admin/estadisticas').set('X-User-Role', 'admin');
    expect(response.body.Actividad_Reprogramada).toBe(3);
  });
});

// ─── Suite: aislamiento entre tests ──────────────────────────────────────────

describe('GET /api/admin/estadisticas — aislamiento', () => {
  it('cada InMemoryEstadisticasStore es independiente: distintas instancias no se afectan', async () => {
    const stats1 = new InMemoryEstadisticasStore();
    const stats2 = new InMemoryEstadisticasStore();
    const app1 = createApp(new ActividadInMemoryRepository(), undefined, undefined, stats1);
    const app2 = createApp(new ActividadInMemoryRepository(), undefined, undefined, stats2);

    await request(app1).post('/api/actividades').set('X-User-Id', 'auth0|u1').send(validPayload);
    await request(app1).post('/api/actividades').set('X-User-Id', 'auth0|u1').send(validPayload);

    const res1 = await request(app1).get('/api/admin/estadisticas').set('X-User-Role', 'admin');
    const res2 = await request(app2).get('/api/admin/estadisticas').set('X-User-Role', 'admin');

    expect(res1.body.Actividad_Creada).toBe(2);
    expect(res2.body.Actividad_Creada).toBeUndefined();
  });

  it('reset() limpia todos los contadores', async () => {
    const estadisticas = new InMemoryEstadisticasStore();
    const app = createApp(new ActividadInMemoryRepository(), undefined, undefined, estadisticas);

    await request(app).post('/api/actividades').set('X-User-Id', 'auth0|u1').send(validPayload);
    const antesDel = await request(app).get('/api/admin/estadisticas').set('X-User-Role', 'admin');
    expect(antesDel.body.Actividad_Creada).toBe(1);

    await estadisticas.reset();

    const despuesDel = await request(app).get('/api/admin/estadisticas').set('X-User-Role', 'admin');
    expect(despuesDel.body).toEqual({});
  });
});
