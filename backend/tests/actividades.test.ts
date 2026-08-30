import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { openApiDocument } from '../src/openapi';
import { ActividadInMemoryRepository } from '../src/repositories/actividadInMemoryRepository';

const validPayload = { titulo: 'Caminata urbana', descripcion: 'Recorrido guiado por el centro', tipo: 'aire_libre', ubicacion: { tipo: 'coordenadas', latitud: -34.6037, longitud: -58.3816, direccion: 'Plaza de Mayo' }, fecha_horario: '2026-09-10T14:00:00-03:00', min_participantes: 4, max_participantes: 12 };
const validRules = { probabilidad_lluvia_max: 40, temperatura_min: 12, temperatura_max: 28, viento_max: 35, horas_anticipacion: 24, dias_max_reprogramacion: 3, rango_horario: { horario_min: '10:00', horario_max: '20:00' } };

describe('POST /api/actividades', () => {
  it('crea una actividad válida, registra al creador y delega el id al repositorio', async () => {
    const repository = new ActividadInMemoryRepository();
    const response = await request(createApp(repository)).post('/api/actividades').set('X-User-Id', 'auth0|organizador-1').send(validPayload);
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ ...validPayload, creadorId: 'auth0|organizador-1', participantes: ['auth0|organizador-1'] });
    expect(response.body.id).toEqual(expect.any(String));
    await expect(repository.findById(response.body.id)).resolves.toMatchObject({ titulo: validPayload.titulo });
  });

  it('rechaza un máximo de participantes menor al mínimo', async () => {
    const response = await request(createApp()).post('/api/actividades').set('X-User-Id', 'auth0|organizador-1').send({ ...validPayload, max_participantes: 3 });
    expect(response.status).toBe(400);
  });

  it('acepta una ubicación por ciudad y país', async () => {
    const response = await request(createApp()).post('/api/actividades').set('X-User-Id', 'auth0|organizador-1').send({ ...validPayload, ubicacion: { tipo: 'ciudad', ciudad: 'Buenos Aires', pais: 'AR' } });
    expect(response.status).toBe(201);
  });
});

describe('POST /api/actividades/:id/participantes', () => {
  async function createActivity(maxParticipantes = 3) {
    const repository = new ActividadInMemoryRepository();
    const app = createApp(repository);
    const created = await request(app).post('/api/actividades').set('X-User-Id', 'auth0|organizador-1').send({
      ...validPayload,
      min_participantes: 1,
      max_participantes: maxParticipantes,
    });
    return { app, repository, id: created.body.id };
  }

  it('inscribe al usuario, permite ocupar el último cupo y persiste el cambio', async () => {
    const { app, repository, id } = await createActivity(2);
    const response = await request(app).post(`/api/actividades/${id}/participantes`).set('X-User-Id', 'auth0|participante-1');

    expect(response.status).toBe(201);
    expect(response.body.participantes).toEqual(['auth0|organizador-1', 'auth0|participante-1']);
    await expect(repository.findById(id)).resolves.toMatchObject({ participantes: response.body.participantes });
  });

  it('rechaza una inscripción duplicada sin modificar los participantes', async () => {
    const { app, repository, id } = await createActivity();
    await request(app).post(`/api/actividades/${id}/participantes`).set('X-User-Id', 'auth0|participante-1');
    const response = await request(app).post(`/api/actividades/${id}/participantes`).set('X-User-Id', 'auth0|participante-1');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('ALREADY_PARTICIPATING');
    await expect(repository.findById(id)).resolves.toMatchObject({ participantes: ['auth0|organizador-1', 'auth0|participante-1'] });
  });

  it('rechaza una inscripción sin cupo y conserva la actividad', async () => {
    const { app, repository, id } = await createActivity(1);
    const response = await request(app).post(`/api/actividades/${id}/participantes`).set('X-User-Id', 'auth0|participante-1');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('ACTIVITY_FULL');
    await expect(repository.findById(id)).resolves.toMatchObject({ participantes: ['auth0|organizador-1'] });
  });

  it('responde 404 si la actividad no existe', async () => {
    const response = await request(createApp()).post('/api/actividades/id-inexistente/participantes').set('X-User-Id', 'auth0|participante-1');
    expect(response.status).toBe(404);
    expect(response.body.error).toBe('ACTIVITY_NOT_FOUND');
  });

  it('exige la identidad del usuario', async () => {
    const { app, repository, id } = await createActivity();
    const response = await request(app).post(`/api/actividades/${id}/participantes`);

    expect(response.status).toBe(401);
    await expect(repository.findById(id)).resolves.toMatchObject({ participantes: ['auth0|organizador-1'] });
  });
});

describe('DELETE /api/actividades/:id/participantes/me', () => {
  async function createActivity() {
    const repository = new ActividadInMemoryRepository();
    const app = createApp(repository);
    const created = await request(app).post('/api/actividades').set('X-User-Id', 'auth0|organizador-1').send({
      ...validPayload,
      min_participantes: 1,
      max_participantes: 2,
    });
    return { app, repository, id: created.body.id };
  }

  it('da de baja solo al usuario autenticado y libera el cupo', async () => {
    const { app, repository, id } = await createActivity();
    await request(app).post(`/api/actividades/${id}/participantes`).set('X-User-Id', 'auth0|participante-1');
    const removed = await request(app).delete(`/api/actividades/${id}/participantes/me`).set('X-User-Id', 'auth0|participante-1');
    const replacement = await request(app).post(`/api/actividades/${id}/participantes`).set('X-User-Id', 'auth0|participante-2');

    expect(removed.status).toBe(200);
    expect(removed.body.participantes).toEqual(['auth0|organizador-1']);
    expect(replacement.status).toBe(201);
    await expect(repository.findById(id)).resolves.toMatchObject({ participantes: ['auth0|organizador-1', 'auth0|participante-2'] });
  });

  it('rechaza la baja de un usuario no inscripto', async () => {
    const { app, repository, id } = await createActivity();
    const response = await request(app).delete(`/api/actividades/${id}/participantes/me`).set('X-User-Id', 'auth0|participante-1');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('NOT_PARTICIPATING');
    await expect(repository.findById(id)).resolves.toMatchObject({ participantes: ['auth0|organizador-1'] });
  });

  it('impide que el organizador se dé de baja', async () => {
    const { app, repository, id } = await createActivity();
    const response = await request(app).delete(`/api/actividades/${id}/participantes/me`).set('X-User-Id', 'auth0|organizador-1');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('ORGANIZER_CANNOT_LEAVE');
    await expect(repository.findById(id)).resolves.toMatchObject({ participantes: ['auth0|organizador-1'] });
  });

  it('responde 404 si la actividad no existe', async () => {
    const response = await request(createApp()).delete('/api/actividades/id-inexistente/participantes/me').set('X-User-Id', 'auth0|participante-1');
    expect(response.status).toBe(404);
    expect(response.body.error).toBe('ACTIVITY_NOT_FOUND');
  });

  it('exige la identidad del usuario', async () => {
    const { app, repository, id } = await createActivity();
    await request(app).post(`/api/actividades/${id}/participantes`).set('X-User-Id', 'auth0|participante-1');
    const response = await request(app).delete(`/api/actividades/${id}/participantes/me`);

    expect(response.status).toBe(401);
    await expect(repository.findById(id)).resolves.toMatchObject({ participantes: ['auth0|organizador-1', 'auth0|participante-1'] });
  });
});

describe('ActividadInMemoryRepository', () => {
  it('no expone por referencia el array de participantes almacenado', async () => {
    const repository = new ActividadInMemoryRepository();
    const app = createApp(repository);
    const created = await request(app).post('/api/actividades').set('X-User-Id', 'auth0|organizador-1').send(validPayload);
    const actividad = await repository.findById(created.body.id);

    actividad!.participantes.push('auth0|externo');

    await expect(repository.findById(created.body.id)).resolves.toMatchObject({ participantes: ['auth0|organizador-1'] });
  });
});

describe('OpenAPI de participantes', () => {
  it('documenta rutas, autenticación, respuestas y participantes de la actividad', () => {
    const paths = openApiDocument.paths;
    const add = paths['/api/actividades/{id}/participantes'].post;
    const remove = paths['/api/actividades/{id}/participantes/me'].delete;
    const actividad = openApiDocument.components.schemas.Actividad;

    expect(add.parameters).toContainEqual(expect.objectContaining({ name: 'X-User-Id', required: true }));
    expect(Object.keys(add.responses)).toEqual(expect.arrayContaining(['201', '400', '401', '404']));
    expect(remove.parameters).toContainEqual(expect.objectContaining({ name: 'X-User-Id', required: true }));
    expect(Object.keys(remove.responses)).toEqual(expect.arrayContaining(['200', '400', '401', '404']));
    expect(actividad.required).toContain('participantes');
    expect(actividad.properties.participantes).toMatchObject({ type: 'array', uniqueItems: true, items: { type: 'string' } });
  });
});

describe('POST /api/actividades/:id/reglas', () => {
  async function createActivity() {
    const app = createApp();
    const created = await request(app).post('/api/actividades').set('X-User-Id', 'auth0|organizador-1').send(validPayload);
    return { app, id: created.body.id };
  }

  it('vincula reglas válidas cuando quien las define es el organizador', async () => {
    const { app, id } = await createActivity();
    const response = await request(app).post(`/api/actividades/${id}/reglas`).set('X-User-Id', 'auth0|organizador-1').send(validRules);
    expect(response.status).toBe(200);
    expect(response.body.reglasClima).toEqual(validRules);
  });

  it('rechaza rangos climáticos y horarios inválidos', async () => {
    const { app, id } = await createActivity();
    const response = await request(app).post(`/api/actividades/${id}/reglas`).set('X-User-Id', 'auth0|organizador-1').send({ ...validRules, temperatura_max: 10, rango_horario: { horario_min: '20:00', horario_max: '10:00' } });
    expect(response.status).toBe(400);
  });

  it('informa 404 si la actividad no existe', async () => {
    const response = await request(createApp()).post('/api/actividades/id-inexistente/reglas').set('X-User-Id', 'auth0|organizador-1').send(validRules);
    expect(response.status).toBe(404);
  });

  it('impide configurar reglas a un usuario que no es el organizador', async () => {
    const { app, id } = await createActivity();
    const response = await request(app).post(`/api/actividades/${id}/reglas`).set('X-User-Id', 'auth0|otro-usuario').send(validRules);
    expect(response.status).toBe(403);
  });
});
