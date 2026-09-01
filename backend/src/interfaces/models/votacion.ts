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
}
