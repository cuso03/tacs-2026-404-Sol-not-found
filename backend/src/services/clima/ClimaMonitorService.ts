import { Actividad } from '../../interfaces/models/actividad';
import { IWeatherProvider } from '../../interfaces/services/IWeatherProvider';
import { INotifier } from '../../interfaces/services/notifications/INotifier';
import { pronosticoEsAdecuado } from '../../domain/clima';
import {IEstadisticasStore} from "../../utils/IEstadisticasStore";

export class ClimaMonitorService {
  private weatherProvider: IWeatherProvider;
  private notifier: INotifier;
  private statsStore: IEstadisticasStore;

  constructor(
    weatherProvider: IWeatherProvider,
    notifier: INotifier,
    statsStore: IEstadisticasStore,
  ) {
    this.weatherProvider = weatherProvider;
    this.notifier = notifier;
    this.statsStore = statsStore;
  }

  async checkActividadWeather(actividad: Actividad): Promise<void> {
    try {
      const pronostico = await this.weatherProvider.getClima(actividad.ubicacion, actividad.fecha_horario);

      await this.statsStore.incrementar('consultas_clima');

      const climaFavorable = !actividad.reglasClima || pronosticoEsAdecuado(pronostico.pronostico_actividad, actividad.reglasClima);

      if (!climaFavorable) {
        const mensaje = `ALERTA: El pronóstico para "${actividad.titulo}" no cumple las condiciones (Condición: ${pronostico.pronostico_actividad.condicion}). Se abrirá una votación para reprogramar.`;

        await this.notifier.notify(actividad.participantes, mensaje);
        await this.statsStore.incrementar('alertas_mal_clima');
      }

    } catch (error) {
      console.error(`Error monitoreando actividad ${actividad.id}:`, error);
    }
  }
}
