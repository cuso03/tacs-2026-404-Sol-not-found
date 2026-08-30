import { Ubicacion } from '../interfaces/models/actividad';
import { PronosticoHora } from '../interfaces/models/pronostico';
import { WeatherService } from '../interfaces/services/weatherService';

/**
 * Implementación mock del servicio climático para desarrollo y pruebas.
 * Genera pronósticos "buenos" por defecto para facilitar el testing.
 */
export class MockWeatherService implements WeatherService {
  async obtenerPronostico(_ubicacion: Ubicacion, fechaDesde: string, dias: number): Promise<PronosticoHora[]> {
    const pronosticos: PronosticoHora[] = [];
    const inicio = new Date(fechaDesde);

    for (let dia = 0; dia < dias; dia++) {
      const fechaDia = new Date(inicio);
      fechaDia.setDate(fechaDia.getDate() + dia + 1);

      for (let hora = 8; hora <= 20; hora++) {
        const fechaHora = new Date(fechaDia);
        fechaHora.setHours(hora, 0, 0, 0);

        pronosticos.push({
          fecha: fechaHora.toISOString(),
          probabilidad_lluvia: 10,
          temperatura: 22,
          viento: 15,
        });
      }
    }

    return pronosticos;
  }
}
