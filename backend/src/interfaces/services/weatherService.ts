import { Ubicacion } from '../models/actividad';
import { PronosticoHora } from '../models/pronostico';

/**
 * Interfaz del proveedor climático.
 * Se puede cambiar de implementación sin tocar la capa de dominio.
 */
export interface WeatherService {
  /**
   * Obtiene el pronóstico hora a hora para los días solicitados.
   * @param ubicacion Ubicación de la actividad.
   * @param fechaDesde Fecha de inicio del pronóstico (inclusive, ISO 8601).
   * @param dias Cantidad de días a pronosticar a partir de fechaDesde.
   * @returns Array plano de pronósticos por hora, ordenados cronológicamente.
   *          Si un día no tiene pronóstico disponible, simplemente no incluye entradas para ese día.
   */
  obtenerPronostico(ubicacion: Ubicacion, fechaDesde: string, dias: number): Promise<PronosticoHora[]>;
}
