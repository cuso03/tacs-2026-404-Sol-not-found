import { ActividadModel, ActividadDocument } from '../../../src/infrastructure/mongo/actividadModel';
import { DatosCreacionActividad, EstadoActividad, ReglasClima, TipoActividad, Ubicacion } from '../../../src/interfaces/models/actividad';
import { AUTH_ORGANIZADOR } from './auth.fixture';

export const DEFAULT_ACTIVIDAD_PAYLOAD: DatosCreacionActividad = {
  titulo: 'Caminata urbana',
  descripcion: 'Recorrido guiado por el centro',
  tipo: 'aire_libre',
  ubicacion: {
    tipo: 'coordenadas',
    latitud: -34.6037,
    longitud: -58.3816,
    direccion: 'Plaza de Mayo',
  },
  fecha_horario: '2026-09-10T14:00:00-03:00',
  min_participantes: 2,
  max_participantes: 12,
};

/**
 * Genera el payload necesario para el endpoint POST /api/actividades.
 */
export function createActividadPayload(overrides: Partial<DatosCreacionActividad> = {}): DatosCreacionActividad {
  return {
    ...DEFAULT_ACTIVIDAD_PAYLOAD,
    ...overrides,
    ...(overrides.ubicacion ? { ubicacion: overrides.ubicacion } : {}),
  };
}

export interface SeedActividadOptions {
  titulo?: string;
  descripcion?: string;
  tipo?: TipoActividad;
  ubicacion?: Ubicacion;
  fecha_horario?: string;
  min_participantes?: number;
  max_participantes?: number;
  creadorId?: string;
  creadaEn?: string;
  estado?: EstadoActividad;
  participantes?: string[];
  reglasClima?: ReglasClima;
  votaciones?: any[];
}

/**
 * Inserta directamente una actividad en MongoDB vía Mongoose para preparar el estado inicial del test.
 */
export async function seedActividad(overrides: SeedActividadOptions = {}): Promise<ActividadDocument> {
  const creadorId = overrides.creadorId ?? AUTH_ORGANIZADOR;

  return ActividadModel.create({
    titulo: overrides.titulo ?? DEFAULT_ACTIVIDAD_PAYLOAD.titulo,
    descripcion: overrides.descripcion ?? DEFAULT_ACTIVIDAD_PAYLOAD.descripcion,
    tipo: overrides.tipo ?? DEFAULT_ACTIVIDAD_PAYLOAD.tipo,
    ubicacion: overrides.ubicacion ?? DEFAULT_ACTIVIDAD_PAYLOAD.ubicacion,
    fecha_horario: overrides.fecha_horario ?? DEFAULT_ACTIVIDAD_PAYLOAD.fecha_horario,
    min_participantes: overrides.min_participantes ?? DEFAULT_ACTIVIDAD_PAYLOAD.min_participantes,
    max_participantes: overrides.max_participantes ?? DEFAULT_ACTIVIDAD_PAYLOAD.max_participantes,
    creadorId,
    creadaEn: overrides.creadaEn ?? new Date().toISOString(),
    estado: overrides.estado ?? 'PROPUESTA',
    participantes: overrides.participantes ?? [creadorId],
    reglasClima: overrides.reglasClima,
    votaciones: overrides.votaciones ?? [],
  });
}
