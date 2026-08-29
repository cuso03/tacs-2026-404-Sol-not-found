import { ReglasClima } from '../../domain/models/reglasClima';
import { WeatherForecast } from '../../interfaces/services/weather/IWeatherProvider';
export class ClimaEvaluatorService {
  /**
   * Compara el pronóstico con las reglas.
   * Retorna true si el clima es ACEPTABLE, false si es DESFAVORABLE.
   */
  evaluarCondiciones(pronostico: WeatherForecast, reglas?: ReglasClima): boolean {
    // Si el organizador no definió reglas de clima, se asume que cualquier condición es aceptable
    if (!reglas) {
      return true;
    }

    // Evaluación de probabilidad de lluvia
    if (pronostico.probabilidad_lluvia > reglas.probabilidad_lluvia_max) {
      return false;
    }

    // Evaluación de viento
    if (pronostico.viento > reglas.viento_max) {
      return false;
    }

    // Evaluación de rangos de temperatura
    if (pronostico.temperatura < reglas.temperatura_min || pronostico.temperatura > reglas.temperatura_max) {
      return false;
    }

    return true; 
  }
}