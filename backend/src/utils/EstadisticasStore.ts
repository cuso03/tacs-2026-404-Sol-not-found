// Singleton para almacenar estadísticas de métricas
export class EstadisticasStore {
  private static instance: EstadisticasStore;
  private contadores: Record<string, number> = {};

  private constructor() {}

  public static getInstance(): EstadisticasStore {
    if (!EstadisticasStore.instance) {
      EstadisticasStore.instance = new EstadisticasStore();
    }
    return EstadisticasStore.instance;
  }

  public incrementar(metrica: string, cantidad: number = 1): void {
    if (!this.contadores[metrica]) {
      this.contadores[metrica] = 0;
    }
    this.contadores[metrica] += cantidad;
    console.log(`[EstadisticasStore] Métrica '${metrica}' incrementada a ${this.contadores[metrica]}`);
  }

  public getEstadisticas(): Record<string, number> {
    return this.contadores;
  }
}