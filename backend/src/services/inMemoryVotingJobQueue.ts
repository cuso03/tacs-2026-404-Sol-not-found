import { IVotingJobQueue } from '../interfaces/services/votingJobQueue';
import { VotacionService } from './votacionService';

/** Trabajo pendiente en la cola. */
interface PendingJob {
  actividadId: string;
  votacionId: string;
  cierraEn: Date;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Implementación en memoria de la cola de votaciones para tests.
 * Programa el cierre con setTimeout (no persiste entre reinicios).
 */
export class InMemoryVotingJobQueue implements IVotingJobQueue {
  private readonly jobs = new Map<string, PendingJob>();
  private votacionService: VotacionService | null = null;

  /** Asocia el servicio de votaciones para ejecutar el cierre programado. */
  setVotacionService(service: VotacionService): void {
    this.votacionService = service;
  }

  async programarCierreVotacion(actividadId: string, votacionId: string, cierraEn: Date): Promise<void> {
    const delay = cierraEn.getTime() - Date.now();
    const timer = setTimeout(() => {
      this.votacionService?.cerrarVotacion(actividadId, votacionId);
      this.jobs.delete(votacionId);
    }, Math.max(delay, 0));

    this.jobs.set(votacionId, { actividadId, votacionId, cierraEn, timer });
  }

  /** Ejecuta inmediatamente todos los trabajos pendientes (para tests). */
  async ejecutarJobsPendientes(): Promise<void> {
    for (const [id, job] of this.jobs) {
      clearTimeout(job.timer);
      await this.votacionService?.cerrarVotacion(job.actividadId, job.votacionId);
      this.jobs.delete(id);
    }
  }

  /** Retorna la cantidad de trabajos pendientes. */
  get pendientes(): number {
    return this.jobs.size;
  }
}
