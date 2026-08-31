/** Pronóstico para una hora específica. */
export interface PronosticoHora {
  /** Fecha y hora en formato ISO 8601 con offset. */
  fecha: string;
  /** Probabilidad de lluvia (0-100). */
  probabilidad_lluvia: number;
  /** Temperatura en grados Celsius. */
  temperatura: number;
  /** Velocidad del viento. */
  viento: number;
}
