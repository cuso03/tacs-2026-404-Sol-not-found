import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../../src/app';
import { seedActividad } from '../../helpers/fixtures/actividad.fixture';
import { authHeader, AUTH_ORGANIZADOR, AUTH_PARTICIPANTE_1 } from '../../helpers/fixtures/auth.fixture';

describe('GET /api/actividades/:id', () => {
  const app = createApp();

  it('recupera una actividad con cupo lleno que no figura en la búsqueda', async () => {
    const actividad = await seedActividad({
      min_participantes: 1,
      max_participantes: 1,
      participantes: [AUTH_ORGANIZADOR],
    });
    const id = actividad._id.toString();

    // La búsqueda excluye las actividades llenas
    const busqueda = await request(app).get('/api/actividades').set(authHeader(AUTH_ORGANIZADOR));
    expect(busqueda.status).toBe(200);
    expect(busqueda.body.data.some((a: any) => a.id === id)).toBe(false);

    // Pero se recupera directamente por id
    const response = await request(app)
      .get(`/api/actividades/${id}`)
      .set(authHeader(AUTH_PARTICIPANTE_1));

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(id);
    expect(response.body.titulo).toBe(actividad.titulo);
    expect(response.body.estado).toBe('PROPUESTA');
  });

  it('retorna 404 si la actividad no existe', async () => {
    const fakeId = '66db614fef5a153200000000';
    const response = await request(app)
      .get(`/api/actividades/${fakeId}`)
      .set(authHeader(AUTH_ORGANIZADOR));

    expect(response.status).toBe(404);
  });

  it('exige autenticación', async () => {
    const actividad = await seedActividad();
    const response = await request(app).get(`/api/actividades/${actividad._id.toString()}`);

    expect(response.status).toBe(401);
  });
});