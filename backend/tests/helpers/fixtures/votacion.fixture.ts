import { seedActividad, SeedActividadOptions } from './actividad.fixture';
import { createReglasPayload } from './regla.fixture';
import { ActividadDocument } from '../../../src/infrastructure/mongo/actividadModel';
import { AUTH_ORGANIZADOR, AUTH_PARTICIPANTE_1, AUTH_PARTICIPANTE_2 } from './auth.fixture';

export interface SeedVotacionOptions extends SeedActividadOptions {
  duracionHoras?: number;
  automatica?: boolean;
  alternativas?: Array<{ fecha_horario: string }>;
  votos?: Record<string, string>;
}

export interface AlternativaSeeded {
  id: string;
  fecha_horario: string;
}

export interface ActividadConVotacionSeeded {
  actividad: ActividadDocument;
  actividadId: string;
  votacionId: string;
  alternativas: AlternativaSeeded[];
}

/**
 * Inserta directamente una actividad en estado EN_VOTACION con reglas climáticas y votación activa.
 */
export async function seedActividadConVotacion(
  options: SeedVotacionOptions = {}
): Promise<ActividadConVotacionSeeded> {
  const ahora = new Date();
  const duracionHoras = options.duracionHoras ?? 24;
  const cierraEn = new Date(ahora.getTime() + duracionHoras * 3600 * 1000).toISOString();

  const alternativasInput = options.alternativas ?? [
    { fecha_horario: '2026-09-12T14:00:00-03:00' },
    { fecha_horario: '2026-09-13T14:00:00-03:00' },
  ];

  const votacionData = {
    abiertaEn: ahora.toISOString(),
    cierraEn,
    duracionHoras,
    automatica: options.automatica ?? false,
    alternativas: alternativasInput,
    votos: options.votos ?? {},
  };

  const participantes = options.participantes ?? [
    options.creadorId ?? AUTH_ORGANIZADOR,
    AUTH_PARTICIPANTE_1,
    AUTH_PARTICIPANTE_2,
  ];

  const actividad = await seedActividad({
    ...options,
    estado: options.estado ?? 'EN_VOTACION',
    participantes,
    reglasClima: options.reglasClima ?? createReglasPayload(),
    votaciones: [votacionData],
  });

  const votacionDoc = actividad.votaciones[0] as any;
  const votacionId = votacionDoc._id.toString();
  const alternativas: AlternativaSeeded[] = votacionDoc.alternativas.map((alt: any) => ({
    id: alt._id.toString(),
    fecha_horario: alt.fecha_horario,
  }));

  return {
    actividad,
    actividadId: actividad._id.toString(),
    votacionId,
    alternativas,
  };
}
