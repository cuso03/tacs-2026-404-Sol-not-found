import { Actividad } from '../../interfaces/models/actividad';
import { IWeatherProvider } from '../../interfaces/services/IWeatherProvider';
import { INotifier } from '../../interfaces/services/notifications/INotifier';
import { pronosticoEsAdecuado } from '../../domain/clima';
import { IEstadisticasStore } from "../../utils/IEstadisticasStore";
import { VotacionService } from '../votacionService';
import { NotificacionMongoRepository } from '../../repositories/notificacionMongoRepository';

export class ClimaMonitorService {
  constructor(
    private weatherProvider: IWeatherProvider,
    private notifier: INotifier,
    private statsStore: IEstadisticasStore,
    private votacionService?: VotacionService,
    private notificacionRepo?: NotificacionMongoRepository
  ) {}

  async checkActividadWeather(actividad: Actividad): Promise<void> {
    try {
      if (!actividad.reglasClima || !['PROPUESTA', 'CONFIRMADA', 'REPROGRAMADA'].includes(actividad.estado)) return;

      const horasHastaLaActividad = (new Date(actividad.fecha_horario).getTime() - Date.now()) / (1000 * 60 * 60);
      if (horasHastaLaActividad <= 0) return;
      if (horasHastaLaActividad > actividad.reglasClima.horas_anticipacion) return;

      // Respetar el proveedor preferido por el creador de la actividad (User Story 2)
      const pronostico = await this.weatherProvider.getClima(
        actividad.ubicacion,
        actividad.fecha_horario,
        actividad.creadorId,
      );

      await this.statsStore.incrementar('consultas_clima');

      const climaFavorable = pronosticoEsAdecuado(pronostico.pronostico_actividad, actividad.reglasClima);

      if (!climaFavorable) {
        let votacionAbierta = false;
        if (this.votacionService) {
          const result = await this.votacionService.abrirVotacion(actividad.id, actividad.creadorId, {
            duracion_horas: Math.min(actividad.reglasClima.horas_anticipacion, 168),
          });
          if (result.status === 'already_voting') return;
          votacionAbierta = result.status === 'opened';
        }

        const mensaje = `ALERTA: El pronóstico para "${actividad.titulo}" no cumple las condiciones (Condición: ${pronostico.pronostico_actividad.condicion}). ${votacionAbierta ? 'Se abrió una votación para reprogramar.' : 'No se abrió una votación: no hay alternativas disponibles.'}`;

        // Guardamos la auditoría en MongoDB antes de mandar el mensaje
        if (this.notificacionRepo) {
          await this.notificacionRepo.registrar(actividad.id!, 'ALERTA', mensaje, actividad.participantes);
        }

        await this.notifier.notify(actividad.participantes, mensaje);
        await this.statsStore.incrementar('alertas_mal_clima');
      }

    } catch (error) {
      console.error(`Error monitoreando actividad ${actividad.id}:`, error);
    }
  }
}
