import { Queue, Worker, Job } from 'bullmq';
import { IVotingJobQueue } from '../../interfaces/services/votingJobQueue';

/** Implementación productiva de la cola de votaciones usando BullMQ + Redis. */
export class BullMQVotingJobQueue implements IVotingJobQueue {
  private readonly queue: Queue;

  constructor(connection: any) {
    this.queue = new Queue('votaciones', {
      connection,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
      },
    });
  }

  async programarCierreVotacion(actividadId: string, votacionId: string, cierraEn: Date): Promise<void> {
    const delay = Math.max(cierraEn.getTime() - Date.now(), 0);
    await this.queue.add(
      'cerrar-votacion',
      { actividadId, votacionId },
      {
        delay,
        jobId: `cerrar-${votacionId}`,
      },
    );
  }
}

/** Worker que procesa los trabajos de cierre de votación. */
export function createVotingWorker(
  cerrarVotacion: (actividadId: string, votacionId: string) => Promise<void>,
  connection: any,
): Worker {
  return new Worker(
    'votaciones',
    async (job: Job<{ actividadId: string; votacionId: string }>) => {
      if (job.name === 'cerrar-votacion') {
        await cerrarVotacion(job.data.actividadId, job.data.votacionId);
      }
    },
    { connection },
  );
}
