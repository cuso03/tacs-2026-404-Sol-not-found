import cron from 'node-cron';
import { ClimaMonitorService } from '../services/clima/ClimaMonitorService';
import { ActividadRepository } from '../interfaces/repositories/actividadRepository';

export class CronSetup {
  constructor(
    private monitorService: ClimaMonitorService,
    private repository: ActividadRepository
  ) {}

  // cada hora
  public iniciarTareasProgramadas(): void {
    cron.schedule('* * * * *', async () => {
      console.log('\n[CronJob] Iniciando evaluación periódica de clima...');
      
      const { data: todasLasActividades } = await this.repository.findAll({ page: 1, limit: 10000 });
      
      const actividadesAEvaluar = todasLasActividades.filter(
        (a) => a.estado === 'PROPUESTA' || a.estado === 'CONFIRMADA'
      );

      for (const actividad of actividadesAEvaluar) {
        await this.monitorService.checkActividadWeather(actividad);
      }
      
      console.log('[CronJob] Evaluación periódica finalizada.\n');
    });

    console.log('[CronSetup] Tareas programadas (CronJobs) inicializadas correctamente.');
  }
}