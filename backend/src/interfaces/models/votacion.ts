/** Estados posibles de una votación a lo largo de su ciclo de vida. */
export const ESTADOS_VOTACION = ['ABIERTA', 'CERRADA'] as const;
export type EstadoVotacion = typeof ESTADOS_VOTACION[number];

/** Alternativa de fecha y horario dentro de una votación de reprogramación. */
export interface Alternativa {
  id: string;
  /** Fecha y hora en formato ISO 8601 con offset. */
  fecha_horario: string;
}

/** Votación embebida dentro de una actividad para reprogramación. */
export interface Votacion {
  id: string;
  /** Momento en que se abrió la votación (ISO 8601). */
  abiertaEn: string;
  /** Momento en que se cerrará la votación (ISO 8601). */
  cierraEn: string;
  /** Duración en horas que permanecerá abierta. */
  duracionHoras: number;
  /** Indica si las alternativas fueron generadas automáticamente por el sistema. */
  automatica: boolean;
  /** Opciones de fecha/horario entre las cuales votan los participantes. */
  alternativas: Alternativa[];
  /** Mapa de userId → alternativaId. Sobreescribe si el usuario cambia su voto. */
  votos: Record<string, string>;
  /** Estado actual de la votación en su ciclo de vida. */
  estado: EstadoVotacion;
  /** Momento en que se cerró la votación (ISO 8601). Presente si estado === 'CERRADA'. */
  cerradaEn?: string;
}
