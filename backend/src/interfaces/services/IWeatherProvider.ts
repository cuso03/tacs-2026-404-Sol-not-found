import { ClimaResponseDto as ClimaResponse } from '../../dtos/climaDto';
import { Ubicacion } from '../models/actividad';

/**
 * Proveedor de clima — obtiene clima actual y pronóstico según ubicación y fecha de la actividad.
 * Permite usar datos de prueba o un servicio real sin cambiar la lógica de negocio.
 */
export interface IWeatherProvider {
  /** Retorna clima actual y pronóstico para la ubicación y fecha de la actividad. */
  getClima(ubicacion: Ubicacion, fecha_horario: string): Promise<ClimaResponse>;

  /** Retorna pronósticos para un rango de fechas (inclusive), cada entrada es un ClimaResponse por día. */
  getForecastRange(ubicacion: Ubicacion, desde: string, hasta: string): Promise<ClimaResponse[]>;
}
