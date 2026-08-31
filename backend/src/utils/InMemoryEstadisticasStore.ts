import { IEstadisticasStore } from './IEstadisticasStore';

/**
 * Implementación en memoria de IEstadisticasStore. Cambiar despues por persistencia en MongoDB
 */
export class InMemoryEstadisticasStore implements IEstadisticasStore {
    private contadores: Record<string, number> = {};

    public async incrementar(metrica: string, cantidad: number = 1): Promise<void> {
        if (!this.contadores[metrica]) {
            this.contadores[metrica] = 0;
        }
        this.contadores[metrica] += cantidad;
    }

    public async obtener(): Promise<Record<string, number>> {
        // Se devuelve una copia para que quien consuma el objeto no pueda mutar
        // el estado interno del repositorio directamente.
        return { ...this.contadores };
    }

    public async reset(): Promise<void> {
        this.contadores = {};
    }
}
