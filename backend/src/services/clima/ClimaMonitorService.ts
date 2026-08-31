import { Actividad } from '../../interfaces/models/actividad';
import { IWeatherProvider } from '../../interfaces/services/IWeatherProvider';
import { INotifier } from '../../interfaces/services/notifications/INotifier';
import { pronosticoEsAdecuado } from '../../domain/clima';
import { EstadisticasStore } from '../../utils/EstadisticasStore';

export class ClimaMonitorService {
  private weatherProvider: IWeatherProvider;
  private notifier: INotifier;
  private statsStore: EstadisticasStore;

  constructor(
    weatherProvider: IWeatherProvider,
    notifier: INotifier,
  ) {
    this.weatherProvider = weatherProvider;
    this.notifier = notifier;
    this.statsStore = EstadisticasStore.getInstance();
  }

  async checkActividadWeather(actividad: Actividad): Promise<void> {
    try {
      const pronostico = await this.weatherProvider.getClima(actividad.ubicacion, actividad.fecha_horario);

      this.statsStore.incrementar('consultas_clima');

      const climaFavorable = !actividad.reglasClima || pronosticoEsAdecuado(pronostico.pronostico_actividad, actividad.reglasClima);

      if (!climaFavorable) {
        const mensaje = `ALERTA: El pronóstico para "${actividad.titulo}" no cumple las condiciones (Condición: ${pronostico.pronostico_actividad.condicion}). Se abrirá una votación para reprogramar.`;

        await this.notifier.notify(actividad.participantes, mensaje);
        this.statsStore.incrementar('alertas_mal_clima');
      }

    } catch (error) {
      console.error(`Error monitoreando actividad ${actividad.id}:`, error);
    }
  }
}
