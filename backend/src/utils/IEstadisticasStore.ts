export interface IEstadisticasStore {
  /**
   * Incrementa el contador asociado a una métrica.
   * @param metrica Nombre de la métrica a incrementar (ej: "actividad_creada").
   * @param cantidad Cantidad a sumar. Por defecto 1.
   */
  incrementar(metrica: string, cantidad?: number): Promise<void>;

  /**
   * Devuelve una copia del estado actual de todas las métricas registradas.
   * Se devuelve una copia (no la referencia interna) para evitar mutaciones
   * accidentales desde fuera del repositorio.
   */
  obtener(): Promise<Record<string, number>>;

  /**
   * Reinicia todos los contadores a cero. Pensado principalmente para uso en tests,
   * de forma que cada test pueda partir de un estado limpio sin depender de un
   * singleton compartido entre corridas.
   */
  reset(): Promise<void>;
}
