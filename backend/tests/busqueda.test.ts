import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { ActividadInMemoryRepository } from '../src/repositories/actividadInMemoryRepository';

const basePayload = {
  descripcion: 'Prueba de feature 3',
  fecha_horario: '2026-10-10T14:00:00-03:00',
  min_participantes: 2,
  max_participantes: 10,
};

describe('Feature 3: Búsqueda y Dashboard', () => {
  // Instanciamos un único repositorio y app para compartir el estado entre estos tests
  const repository = new ActividadInMemoryRepository();
  const app = createApp(repository);

  // Pre-poblamos la memoria con dos actividades distintas antes de correr los tests
  beforeAll(async () => {
    await request(app).post('/api/actividades')
      .set('X-User-Id', 'auth0|organizador-1')
      .send({ ...basePayload, titulo: 'Partido en Capital', tipo: 'aire_libre', ubicacion: { tipo: 'ciudad', ciudad: 'Buenos Aires', pais: 'AR' } });

    await request(app).post('/api/actividades')
      .set('X-User-Id', 'auth0|organizador-2')
      .send({ ...basePayload, titulo: 'Torneo techado', tipo: 'techada', ubicacion: { tipo: 'ciudad', ciudad: 'Cordoba', pais: 'AR' } });
  });

  describe('GET /api/actividades (Búsqueda global)', () => {
    it('retorna todas las actividades si no se envían filtros', async () => {
      const response = await request(app).get('/api/actividades');
      expect(response.status).toBe(200);
      expect(response.body.length).toBe(2);
    });

    it('aplica correctamente el filtro por tipo de actividad', async () => {
      const response = await request(app).get('/api/actividades').query({ tipo: 'aire_libre' });
      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].titulo).toBe('Partido en Capital');
    });

    it('aplica correctamente el filtro por ubicación ignorando mayúsculas', async () => {
      const response = await request(app).get('/api/actividades').query({ ubicacion: 'buenos' });
      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].titulo).toBe('Partido en Capital');
    });
  });

  describe('GET /api/usuarios/me/actividades (Dashboard Personal)', () => {
    it('retorna el dashboard mapeado para el usuario solicitado', async () => {
      const response = await request(app).get('/api/usuarios/me/actividades').set('X-User-Id', 'auth0|organizador-1');
      
      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      
      // Verificamos que el DTO del dashboard formatea los campos requeridos
      expect(response.body[0]).toMatchObject({
        titulo: 'Partido en Capital',
        rol: 'organizador',
        estado: 'PROPUESTA',
        votacion_abierta: false
      });
    });

    it('exige autenticación para acceder al dashboard', async () => {
      const response = await request(app).get('/api/usuarios/me/actividades');
      expect(response.status).toBe(401);
    });
  });
});