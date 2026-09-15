import { Ubicacion } from '../models/actividad';
import { PronosticoHora } from '../models/pronostico';
import { ClimaResponseDto } from '../../dtos/climaDto';

/**
 * Proveedor climático unificado.
 * Expone tanto pronóstico horario (para lógica de votación/reprogramación)
 * como consulta de clima puntual (para consulta del usuario).
 */
export interface IWeatherProvider {
  /**
   * Retorna clima actual y pronóstico para la ubicación y fecha de la actividad.
   */
  getClima(ubicacion: Ubicacion, fecha_horario: string): Promise<ClimaResponseDto>;

  /**
   * Obtiene el pronóstico hora a hora para los días solicitados.
   * @param ubicacion Ubicación de la actividad.
   * @param fechaDesde Fecha de inicio del pronóstico (inclusive, ISO 8601).
   * @param dias Cantidad de días a pronosticar a partir de fechaDesde.
   */
  obtenerPronostico(ubicacion: Ubicacion, fechaDesde: string, dias: number): Promise<PronosticoHora[]>;
}
