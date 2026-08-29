import { Actividad } from '../domain/models/actividad';
import { IWeatherProvider } from '../interfaces/services/weather/IWeatherProvider';
import { INotifier } from '../interfaces/services/notifications/INotifier';
import { ClimaEvaluatorService } from '../services/clima/ClimaEvaluatorService';
import { EstadisticasStore } from '../utils/EstadisticasStore';

export class ClimaMonitorService {
  private weatherProvider: IWeatherProvider;
  private notifier: INotifier;
  private evaluator: ClimaEvaluatorService;
  private statsStore: EstadisticasStore;

  constructor(
    weatherProvider: IWeatherProvider,
    notifier: INotifier,
    evaluator: ClimaEvaluatorService
  ) {
    this.weatherProvider = weatherProvider;
    this.notifier = notifier;
    this.evaluator = evaluator;
    this.statsStore = EstadisticasStore.getInstance();
  }

  /**
   * Este método sería llamado periódicamente por un CronJob real (ej. node-cron)
   * por cada actividad que esté en estado 'PROPUESTA' o 'CONFIRMADA'.
   */
  async checkActividadWeather(actividad: Actividad): Promise<void> {
    try {
      // 1. Consultamos el clima
      const pronostico = await this.weatherProvider.getForecast(actividad.ubicacion, actividad.fecha_horario);
      
      // Feature 8: Incrementamos métrica de consultas al servicio de pronóstico
      this.statsStore.incrementar('consultas_clima');

      // 2. Evaluamos contra las reglas del organizador
      const climaFavorable = this.evaluator.evaluarCondiciones(pronostico, actividad.reglas_clima);

      // 3. Reaccionamos al resultado
      if (!climaFavorable) {
        // Acá tu compañero de la Feature 6 pasaría el estado a EN_VOTACION.
        // Como tu responsabilidad es notificar, disparamos la alerta[cite: 2]:
        const mensaje = `ALERTA: El pronóstico para "${actividad.titulo}" no cumple las condiciones (Condición: ${pronostico.condicion}). Se abrirá una votación para reprogramar.`;
        
        await this.notifier.notify(actividad.participantes, mensaje);
        this.statsStore.incrementar('alertas_mal_clima');
      }

    } catch (error) {
      console.error(`Error monitoreando actividad ${actividad.id}:`, error);
    }
  }
}