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
    private notificacionRepo?: NotificacionMongoRepository // Añadido aquí
  ) {}

  async checkActividadWeather(actividad: Actividad): Promise<void> {
    try {
      if (!actividad.reglasClima) return;

      const horasHastaLaActividad = (new Date(actividad.fecha_horario).getTime() - Date.now()) / (1000 * 60 * 60);
      if (horasHastaLaActividad > actividad.reglasClima.horas_anticipacion) return;

      const pronostico = await this.weatherProvider.getClima(actividad.ubicacion, actividad.fecha_horario);
      await this.statsStore.incrementar('consultas_clima');

      const climaFavorable = pronosticoEsAdecuado(pronostico.pronostico_actividad, actividad.reglasClima);

      if (!climaFavorable) {
        if (this.votacionService) {
          await this.votacionService.abrirVotacion(actividad.id, actividad.creadorId, {
            duracion_horas: Math.min(actividad.reglasClima.horas_anticipacion, 168),
          });
        }

        const mensaje = `ALERTA: El pronóstico para "${actividad.titulo}" no cumple las condiciones (Condición: ${pronostico.pronostico_actividad.condicion}). Se abrió una votación para reprogramar.`;

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