import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { ActividadInMemoryRepository } from '../src/repositories/actividadInMemoryRepository';

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

async function createActivityWithRules(app: ReturnType<typeof createApp>, userId = 'auth0|organizador-1') {
  const created = await request(app).post('/api/actividades').set('X-User-Id', userId).send(validPayload);
  const id = created.body.id;
  await request(app).post(`/api/actividades/${id}/reglas`).set('X-User-Id', userId).send(validRules);
  return id;
}

describe('GET /api/actividades/:id/fechas-disponibles', () => {
  it('retorna fechas con pronóstico adecuado', async () => {
    const repository = new ActividadInMemoryRepository();
    const app = createApp(repository);
    const id = await createActivityWithRules(app);

    const response = await request(app).get(`/api/actividades/${id}/fechas-disponibles`).set('X-User-Id', 'auth0|user-1');
    expect(response.status).toBe(200);
    expect(response.body.fechas).toBeInstanceOf(Array);
    expect(response.body.fechas.length).toBeGreaterThan(0);
  });

  it('retorna 404 si la actividad no existe', async () => {
    const response = await request(createApp()).get('/api/actividades/id-inexistente/fechas-disponibles').set('X-User-Id', 'auth0|user-1');
    expect(response.status).toBe(404);
  });

  it('retorna 400 si la actividad no tiene reglas', async () => {
    const app = createApp();
    const created = await request(app).post('/api/actividades').set('X-User-Id', 'auth0|organizador-1').send(validPayload);
    const response = await request(app).get(`/api/actividades/${created.body.id}/fechas-disponibles`).set('X-User-Id', 'auth0|user-1');
    expect(response.status).toBe(400);
  });
});

describe('POST /api/actividades/:id/votaciones', () => {
  it('abre votación manual con alternativas provistas', async () => {
    const app = createApp();
    const id = await createActivityWithRules(app);

    const response = await request(app)
      .post(`/api/actividades/${id}/votaciones`)
      .set('X-User-Id', 'auth0|organizador-1')
      .send({
        alternativas: [
          { fecha_horario: '2026-09-12T14:00:00-03:00' },
          { fecha_horario: '2026-09-13T14:00:00-03:00' },
        ],
        duracion_horas: 24,
      });

    expect(response.status).toBe(201);
    expect(response.body.estado).toBe('en_votacion');
    expect(response.body.votaciones).toHaveLength(1);
    expect(response.body.votaciones[0].automatica).toBe(false);
    expect(response.body.votaciones[0].alternativas).toHaveLength(2);
  });

  it('abre votación automática cuando no se proveen alternativas', async () => {
    const app = createApp();
    const id = await createActivityWithRules(app);

    const response = await request(app)
      .post(`/api/actividades/${id}/votaciones`)
      .set('X-User-Id', 'auth0|organizador-1')
      .send({ duracion_horas: 24 });

    expect(response.status).toBe(201);
    expect(response.body.estado).toBe('en_votacion');
    expect(response.body.votaciones[0].automatica).toBe(true);
    expect(response.body.votaciones[0].alternativas.length).toBeGreaterThan(0);
  });

  it('usa duración por defecto de 24h cuando no se especifica', async () => {
    const app = createApp();
    const id = await createActivityWithRules(app);

    const response = await request(app)
      .post(`/api/actividades/${id}/votaciones`)
      .set('X-User-Id', 'auth0|organizador-1')
      .send({ alternativas: [{ fecha_horario: '2026-09-12T14:00:00-03:00' }] });

    expect(response.status).toBe(201);
    const votacion = response.body.votaciones[0];
    const diff = new Date(votacion.cierraEn).getTime() - new Date(votacion.abiertaEn).getTime();
    expect(diff).toBe(24 * 60 * 60 * 1000);
  });

  it('rechaza si el usuario no es el organizador', async () => {
    const app = createApp();
    const id = await createActivityWithRules(app);

    const response = await request(app)
      .post(`/api/actividades/${id}/votaciones`)
      .set('X-User-Id', 'auth0|otro-usuario')
      .send({ alternativas: [{ fecha_horario: '2026-09-12T14:00:00-03:00' }] });

    expect(response.status).toBe(403);
  });

  it('rechaza si ya hay una votación activa', async () => {
    const app = createApp();
    const id = await createActivityWithRules(app);

    await request(app)
      .post(`/api/actividades/${id}/votaciones`)
      .set('X-User-Id', 'auth0|organizador-1')
      .send({ alternativas: [{ fecha_horario: '2026-09-12T14:00:00-03:00' }] });

    const response = await request(app)
      .post(`/api/actividades/${id}/votaciones`)
      .set('X-User-Id', 'auth0|organizador-1')
      .send({ alternativas: [{ fecha_horario: '2026-09-13T14:00:00-03:00' }] });

    expect(response.status).toBe(409);
  });

  it('retorna 404 si la actividad no existe', async () => {
    const response = await request(createApp())
      .post('/api/actividades/id-inexistente/votaciones')
      .set('X-User-Id', 'auth0|organizador-1')
      .send({ alternativas: [{ fecha_horario: '2026-09-12T14:00:00-03:00' }] });
    expect(response.status).toBe(404);
  });
});

describe('POST /api/actividades/:id/votaciones/:votacionId/alternativas/:alternativaId/votar', () => {
  async function setupWithVoting() {
    const repository = new ActividadInMemoryRepository();
    const app = createApp(repository);
    const id = await createActivityWithRules(app);

    await request(app)
      .post(`/api/actividades/${id}/votaciones`)
      .set('X-User-Id', 'auth0|organizador-1')
      .send({ alternativas: [{ fecha_horario: '2026-09-12T14:00:00-03:00' }, { fecha_horario: '2026-09-13T14:00:00-03:00' }] });

    const actividad = await repository.findById(id);
    const votacion = actividad!.votaciones[0];

    await repository.update({ ...actividad!, participantes: ['auth0|user-1', 'auth0|user-2'] });

    return { repository, app, id, votacion };
  }

  it('registra un voto válido', async () => {
    const { app, id, votacion } = await setupWithVoting();
    const altId = votacion.alternativas[0].id;

    const response = await request(app)
      .post(`/api/actividades/${id}/votaciones/${votacion.id}/alternativas/${altId}/votar`)
      .set('X-User-Id', 'auth0|user-1')
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.votos['auth0|user-1']).toBe(altId);
  });

  it('sobreescribe un voto anterior del mismo usuario', async () => {
    const { app, id, votacion } = await setupWithVoting();
    const alt1 = votacion.alternativas[0].id;
    const alt2 = votacion.alternativas[1].id;

    await request(app).post(`/api/actividades/${id}/votaciones/${votacion.id}/alternativas/${alt1}/votar`).set('X-User-Id', 'auth0|user-1').send({});
    const response = await request(app).post(`/api/actividades/${id}/votaciones/${votacion.id}/alternativas/${alt2}/votar`).set('X-User-Id', 'auth0|user-1').send({});

    expect(response.status).toBe(200);
    expect(response.body.votos['auth0|user-1']).toBe(alt2);
  });

  it('rechaza voto de usuario no participante', async () => {
    const { app, id, votacion } = await setupWithVoting();
    const altId = votacion.alternativas[0].id;

    const response = await request(app)
      .post(`/api/actividades/${id}/votaciones/${votacion.id}/alternativas/${altId}/votar`)
      .set('X-User-Id', 'auth0|no-participante')
      .send({});

    expect(response.status).toBe(403);
  });

  it('rechaza alternativa inexistente', async () => {
    const { app, id, votacion } = await setupWithVoting();

    const response = await request(app)
      .post(`/api/actividades/${id}/votaciones/${votacion.id}/alternativas/alt-inexistente/votar`)
      .set('X-User-Id', 'auth0|user-1')
      .send({});

    expect(response.status).toBe(400);
  });

  it('retorna 404 si la actividad no existe', async () => {
    const response = await request(createApp())
      .post('/api/actividades/id-inexistente/votaciones/fake-votacion/alternativas/alt-id/votar')
      .set('X-User-Id', 'auth0|user-1')
      .send({});
    expect(response.status).toBe(404);
  });
});

describe('GET /api/actividades/:id/votaciones/:votacionId', () => {
  it('retorna resultados parciales con conteo de votos', async () => {
    const repository = new ActividadInMemoryRepository();
    const app = createApp(repository);
    const id = await createActivityWithRules(app);

    await request(app)
      .post(`/api/actividades/${id}/votaciones`)
      .set('X-User-Id', 'auth0|organizador-1')
      .send({ alternativas: [{ fecha_horario: '2026-09-12T14:00:00-03:00' }, { fecha_horario: '2026-09-13T14:00:00-03:00' }] });

    const actividad = await repository.findById(id);
    const votacion = actividad!.votaciones[0];
    const alt1 = votacion.alternativas[0].id;

    await repository.update({ ...actividad!, participantes: ['auth0|user-1', 'auth0|user-2'] });
    await request(app).post(`/api/actividades/${id}/votaciones/${votacion.id}/alternativas/${alt1}/votar`).set('X-User-Id', 'auth0|user-1').send({});
    await request(app).post(`/api/actividades/${id}/votaciones/${votacion.id}/alternativas/${alt1}/votar`).set('X-User-Id', 'auth0|user-2').send({});

    const response = await request(app).get(`/api/actividades/${id}/votaciones/${votacion.id}`).set('X-User-Id', 'auth0|user-1');
    expect(response.status).toBe(200);
    expect(response.body.conteo[alt1]).toBe(2);
    expect(response.body.totalVotos).toBe(2);
  });

  it('retorna 404 si la votación no existe', async () => {
    const app = createApp();
    const created = await request(app).post('/api/actividades').set('X-User-Id', 'auth0|organizador-1').send(validPayload);

    const response = await request(app).get(`/api/actividades/${created.body.id}/votaciones/votacion-inexistente`).set('X-User-Id', 'auth0|user-1');
    expect(response.status).toBe(404);
  });
});
