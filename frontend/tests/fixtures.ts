import type { Actividad, ClimaActividad, ResultadosVotacion, Votacion } from '../src/types/api';

export const openVoting: Votacion = {
  id: 'votacion-1',
  abiertaEn: '2026-09-15T12:00:00.000Z',
  cierraEn: '2026-09-16T12:00:00.000Z',
  duracionHoras: 24,
  automatica: true,
  alternativas: [
    { id: 'alternativa-1', fecha_horario: '2026-10-21T18:30:00.000Z' },
    { id: 'alternativa-2', fecha_horario: '2026-10-22T18:30:00.000Z' },
  ],
  votos: {},
  estado: 'ABIERTA',
};

export const activityFixture: Actividad = {
  id: 'actividad-1',
  titulo: 'Caminata urbana',
  descripcion: 'Recorrido por el centro y sus plazas.',
  tipo: 'aire_libre',
  ubicacion: { tipo: 'coordenadas', latitud: -34.6037, longitud: -58.3816, direccion: 'Plaza de Mayo, Buenos Aires' },
  fecha_horario: '2026-10-20T18:30:00.000Z',
  min_participantes: 2,
  max_participantes: 10,
  creadorId: 'auth0|organizador',
  creadaEn: '2026-09-15T10:00:00.000Z',
  estado: 'PROPUESTA',
  participantes: ['auth0|organizador'],
  reglasClima: {
    probabilidad_lluvia_max: 40,
    temperatura_min: 10,
    temperatura_max: 30,
    viento_max: 35,
    horas_anticipacion: 24,
    dias_max_reprogramacion: 3,
    rango_horario: { horario_min: '10:00', horario_max: '20:00' },
  },
  votaciones: [],
};

export const weatherFixture: ClimaActividad = {
  ubicacion: 'Plaza de Mayo, Buenos Aires',
  fecha_horario: activityFixture.fecha_horario,
  clima_actual: { temperatura: 22, condicion: 'SOLEADO', viento: 10, humedad: 55 },
  pronostico_actividad: { probabilidad_lluvia: 20, temperatura: 19, viento: 12, condicion: 'PARCIALMENTE_NUBLADO' },
};

export const resultsFixture: ResultadosVotacion = {
  votacion: openVoting,
  conteo: { 'alternativa-1': 0, 'alternativa-2': 0 },
  totalVotos: 0,
};
