import cron from 'node-cron';
import { ClimaMonitorService } from '../services/clima/ClimaMonitorService';
import { Actividad } from '../domain/models/actividad';

export class CronSetup {
  private monitorService: ClimaMonitorService;

  constructor(monitorService: ClimaMonitorService) {
    this.monitorService = monitorService;
  }

  public iniciarTareasProgramadas(actividadesEnMemoria: Actividad[]): void {
    // Configura el cron para que se ejecute cada 1 hora (minuto 0 de cada hora)
    cron.schedule('0 * * * *', async () => {
      console.log('\n[CronJob] Iniciando evaluación periódica de clima...');
      
      // Filtramos solo las actividades que están pendientes de realizarse
      const actividadesAEvaluar = actividadesEnMemoria.filter(
        (a) => a.estado === 'PROPUESTA' || a.estado === 'CONFIRMADA'
      );

      for (const actividad of actividadesAEvaluar) {
        // Acá reutilizamos el motor que ya validamos que funciona
        await this.monitorService.checkActividadWeather(actividad);
      }
      
      console.log('[CronJob] Evaluación periódica finalizada.\n');
    });

    console.log('[CronSetup] Tareas programadas (CronJobs) inicializadas correctamente.');
  }
}