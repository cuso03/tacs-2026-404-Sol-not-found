/** Interfaz para la cola de trabajos diferidos de cierre de votaciones. */
export interface IVotingJobQueue {
  /**
   * Programa el cierre automático de una votación.
   * @param actividadId ID de la actividad.
   * @param votacionId ID de la votación.
   * @param cierraEn Momento en que debe ejecutarse el cierre.
   */
  programarCierreVotacion(actividadId: string, votacionId: string, cierraEn: Date): Promise<void>;
}
