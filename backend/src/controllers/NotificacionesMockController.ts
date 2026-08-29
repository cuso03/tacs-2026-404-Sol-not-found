import { Request, Response } from 'express';
import { ClimaMonitorService } from '../cronJobs/ClimaMonitorService';
import { MockWeatherService } from '../services/weather/MockWeatherService';
import { MockTelegramService } from '../services/notifications/MockTelegramService';
import { ClimaEvaluatorService } from '../services/clima/ClimaEvaluatorService';
import { Actividad } from '../domain/models/actividad';

export class NotificacionesMockController {
  
  public async simularMonitoreo(req: Request, res: Response): Promise<void> {
    try {
      const weatherService = new MockWeatherService();
      const notifierService = new MockTelegramService();
      const evaluatorService = new ClimaEvaluatorService();
      
      const monitor = new ClimaMonitorService(weatherService, notifierService, evaluatorService);

      const actividadMock: Actividad = {
        id: 'uuid-1234',
        titulo: 'Partido de Futbol 5',
        tipo: 'AIRE_LIBRE',
        ubicacion: 'Buenos Aires',
        fecha_horario: '2026-10-15T19:00:00Z',
        min_participantes: 10,
        max_participantes: 10,
        creadorId: 'user-admin',
        estado: 'CONFIRMADA',
        participantes: ['user-1', 'user-2', 'user-3'],
        reglas_clima: {
          probabilidad_lluvia_max: 20, 
          temperatura_min: 10,
          temperatura_max: 30,
          viento_max: 15, 
          horas_anticipacion: 24,
          dias_max_reprogramacion: 3,
          rango_horario: { horario_min: '18:00', horario_max: '23:00' }
        }
      };

      await monitor.checkActividadWeather(actividadMock);

      res.status(200).json({
        mensaje: 'Monitoreo simulado ejecutado. Revisa la consola de Docker para ver las notificaciones.',
        actividadEvaluada: actividadMock.titulo
      });
    } catch (error) {
      res.status(500).json({ error: 'Error al ejecutar la simulación' });
    }
  }
}