import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { ActividadInMemoryRepository } from '../src/repositories/actividadInMemoryRepository';
import { IWeatherProvider } from '../src/interfaces/services/IWeatherProvider';
import { MockWeatherService } from '../src/services/mockWeatherService';

const validPayloadCoordenadas = {
  titulo: 'Caminata urbana',
  descripcion: 'Recorrido guiado por el centro',
  tipo: 'aire_libre' as const,
  ubicacion: { tipo: 'coordenadas' as const, latitud: -34.6037, longitud: -58.3816, direccion: 'Plaza de Mayo' },
  fecha_horario: '2026-09-05T13:00:00-03:00',
  min_participantes: 4,
  max_participantes: 12,
};

const validPayloadCiudad = {
  ...validPayloadCoordenadas,
  ubicacion: { tipo: 'ciudad' as const, ciudad: 'Buenos Aires', pais: 'AR' },
};

describe('GET /api/actividades/:id/clima', () => {
  async function createActividadConClima(payload: typeof validPayloadCoordenadas | typeof validPayloadCiudad = validPayloadCoordenadas) {
    const app = createApp();
    const created = await request(app).post('/api/actividades').set('X-User-Id', 'auth0|organizador-1').send(payload);
    return { app, id: created.body.id as string, created };
  }

  it('retorna 404 si la actividad no existe', async () => {
    const response = await request(createApp()).get('/api/actividades/id-inexistente/clima');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Actividad no encontrada' });
  });

  it('retorna formato esperado con ubicacion, fecha_horario, clima_actual y pronostico_actividad', async () => {
    const { app, id, created } = await createActividadConClima(validPayloadCoordenadas);
    expect(created.status).toBe(201);

    const response = await request(app).get(`/api/actividades/${id}/clima`);
    expect(response.status).toBe(200);
    // El formato debe incluir esos cuatro campos
    expect(response.body).toHaveProperty('ubicacion');
    expect(response.body).toHaveProperty('fecha_horario');
    expect(response.body).toHaveProperty('clima_actual');
    expect(response.body).toHaveProperty('pronostico_actividad');
    expect(response.body.clima_actual).toMatchObject({
      temperatura: expect.any(Number),
      condicion: expect.stringMatching(/^(SOLEADO|NUBLADO|PARCIALMENTE_NUBLADO|LLUVIA|TORMENTA)$/),
      viento: expect.any(Number),
      humedad: expect.any(Number),
    });
    expect(response.body.pronostico_actividad).toMatchObject({
      probabilidad_lluvia: expect.any(Number),
      temperatura: expect.any(Number),
      viento: expect.any(Number),
      condicion: expect.stringMatching(/^(SOLEADO|NUBLADO|PARCIALMENTE_NUBLADO|LLUVIA|TORMENTA)$/),
    });
    expect(response.body.pronostico_actividad.probabilidad_lluvia).toBeGreaterThanOrEqual(0);
    expect(response.body.pronostico_actividad.probabilidad_lluvia).toBeLessThanOrEqual(100);
    // la ubicación se entrega como texto
    expect(typeof response.body.ubicacion).toBe('string');
    // el pronóstico no incluye humedad, solo probabilidad de lluvia
    expect(response.body.pronostico_actividad).not.toHaveProperty('humedad');
  });

  it('retorna clima para ubicación por ciudad', async () => {
    const { app, id, created } = await createActividadConClima(validPayloadCiudad);
    expect(created.status).toBe(201);
    const response = await request(app).get(`/api/actividades/${id}/clima`);
    expect(response.status).toBe(200);
    expect(response.body.ubicacion).toContain('Buenos Aires');
  });

  it('es determinístico: misma actividad retorna mismo clima', async () => {
    const repository = new ActividadInMemoryRepository();
    const app = createApp(repository);
    const created = await request(app).post('/api/actividades').set('X-User-Id', 'auth0|organizador-1').send(validPayloadCoordenadas);
    const id = created.body.id as string;
    const primerLlamado = await request(app).get(`/api/actividades/${id}/clima`);
    const segundoLlamado = await request(app).get(`/api/actividades/${id}/clima`);
    expect(primerLlamado.body).toEqual(segundoLlamado.body);
  });

  it('usa el proveedor configurado y no requiere autenticación', async () => {
    let fueInvocado = false;
    const fakeProvider: IWeatherProvider = {
      getClima: async (ubicacion, fecha_horario) => {
        fueInvocado = true;
        return {
          ubicacion: 'Buenos Aires',
          fecha_horario,
          clima_actual: { temperatura: 18, condicion: 'NUBLADO', viento: 14, humedad: 62 },
          pronostico_actividad: { probabilidad_lluvia: 70, temperatura: 16, viento: 22, condicion: 'LLUVIA' },
        };
      },
    };
    const repository = new ActividadInMemoryRepository();
    const app = createApp(repository, fakeProvider);
    const created = await request(app).post('/api/actividades').set('X-User-Id', 'auth0|organizador-1').send(validPayloadCoordenadas);
    const response = await request(app).get(`/api/actividades/${created.body.id}/clima`);
    expect(response.status).toBe(200);
    expect(fueInvocado).toBe(true);
    expect(response.body.clima_actual.temperatura).toBe(18);
    // Sin usuario debe funcionar igual (consulta solo por ID)
    const responseSinAuth = await request(app).get(`/api/actividades/${created.body.id}/clima`);
    expect(responseSinAuth.status).toBe(200);
  });
});

describe('MockWeatherService', () => {
  it('retorna el mismo clima para la misma ubicación y fecha (determinístico)', async () => {
    const service = new MockWeatherService();
    const ubicacionBuenosAires = { tipo: 'ciudad' as const, ciudad: 'Buenos Aires', pais: 'AR' };
    const fechaActividad = '2026-09-05T13:00:00-03:00';
    const primerLlamado = await service.getClima(ubicacionBuenosAires, fechaActividad);
    const segundoLlamado = await service.getClima(ubicacionBuenosAires, fechaActividad);
    expect(primerLlamado).toEqual(segundoLlamado);
  });

  it('genera pronósticos distintos según ubicación y fecha', async () => {
    const service = new MockWeatherService();
    const ubicacionBuenosAires = { tipo: 'ciudad' as const, ciudad: 'Buenos Aires', pais: 'AR' };
    const ubicacionCordoba = { tipo: 'ciudad' as const, ciudad: 'Cordoba', pais: 'AR' };
    const fechaActividad = '2026-09-05T13:00:00-03:00';
    const fechaDiaSiguiente = '2026-09-06T13:00:00-03:00';

    const climaBuenosAires = await service.getClima(ubicacionBuenosAires, fechaActividad);
    const climaCordobaMismaFecha = await service.getClima(ubicacionCordoba, fechaActividad);
    const climaBuenosAiresDiaSiguiente = await service.getClima(ubicacionBuenosAires, fechaDiaSiguiente);

    expect(climaBuenosAires).not.toEqual(climaCordobaMismaFecha);
    expect(climaBuenosAires).not.toEqual(climaBuenosAiresDiaSiguiente);
    expect(climaBuenosAires).toMatchObject({ ubicacion: expect.any(String), fecha_horario: expect.any(String) });
  });
});
