import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { ActividadInMemoryRepository } from '../src/repositories/actividadInMemoryRepository';

const validPayload = { titulo: 'Caminata urbana', descripcion: 'Recorrido guiado por el centro', tipo: 'aire_libre', ubicacion: { tipo: 'coordenadas', latitud: -34.6037, longitud: -58.3816, direccion: 'Plaza de Mayo' }, fecha_horario: '2026-09-10T14:00:00-03:00', min_participantes: 4, max_participantes: 12 };
const validRules = { probabilidad_lluvia_max: 40, temperatura_min: 12, temperatura_max: 28, viento_max: 35, horas_anticipacion: 24, dias_max_reprogramacion: 3, rango_horario: { horario_min: '10:00', horario_max: '20:00' } };

describe('POST /api/actividades', () => {
  it('crea una actividad válida, registra al creador y delega el id al repositorio', async () => {
    const repository = new ActividadInMemoryRepository();
    const response = await request(createApp(repository)).post('/api/actividades').set('X-User-Id', 'auth0|organizador-1').send(validPayload);
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ ...validPayload, creadorId: 'auth0|organizador-1' });
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
