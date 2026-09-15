import { Ubicacion } from '../interfaces/models/actividad';
import { PronosticoHora } from '../interfaces/models/pronostico';
import { ClimaResponseDto } from '../dtos/climaDto';
import { IWeatherProvider } from '../interfaces/services/IWeatherProvider';

const normalizarUbicacion = (ubicacion: Ubicacion): string =>
  ubicacion.tipo === 'ciudad' ? `${ubicacion.ciudad}, ${ubicacion.pais}` : (ubicacion.direccion ?? `${ubicacion.latitud},${ubicacion.longitud}`);

const CLIMAS: ReadonlyArray<Omit<ClimaResponseDto, 'ubicacion' | 'fecha_horario'>> = [
  {
    clima_actual: { temperatura: 22, condicion: 'SOLEADO', viento: 10, humedad: 55 },
    pronostico_actividad: { probabilidad_lluvia: 10, temperatura: 24, viento: 12, condicion: 'SOLEADO' },
  },
  {
    clima_actual: { temperatura: 18, condicion: 'NUBLADO', viento: 14, humedad: 70 },
    pronostico_actividad: { probabilidad_lluvia: 40, temperatura: 17, viento: 18, condicion: 'NUBLADO' },
  },
  {
    clima_actual: { temperatura: 25, condicion: 'PARCIALMENTE_NUBLADO', viento: 8, humedad: 45 },
    pronostico_actividad: { probabilidad_lluvia: 20, temperatura: 26, viento: 10, condicion: 'PARCIALMENTE_NUBLADO' },
  },
  {
    clima_actual: { temperatura: 16, condicion: 'LLUVIA', viento: 25, humedad: 85 },
    pronostico_actividad: { probabilidad_lluvia: 90, temperatura: 15, viento: 30, condicion: 'LLUVIA' },
  },
  {
    clima_actual: { temperatura: 20, condicion: 'TORMENTA', viento: 35, humedad: 90 },
    pronostico_actividad: { probabilidad_lluvia: 95, temperatura: 19, viento: 40, condicion: 'TORMENTA' },
  },
] as const;

const elegirIndice = (ubicacionStr: string, fecha_horario: string): number => {
  const raw = `${ubicacionStr}|${fecha_horario}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  return hash % CLIMAS.length;
};

/**
 * Proveedor de clima de prueba con respuestas predefinidas.
 * Elige una de 5 combinaciones de forma determinística según ubicación y fecha.
 * Entrega el formato esperado por el cliente y mantiene resultados repetibles para pruebas.
 */
export class MockWeatherService implements IWeatherProvider {
  constructor(private readonly forcedIndex?: number) {}

  async getClima(ubicacion: Ubicacion, fecha_horario: string): Promise<ClimaResponseDto> {
    const ubicacionStr = normalizarUbicacion(ubicacion);
    const idx = this.forcedIndex ?? elegirIndice(ubicacionStr, fecha_horario);
    const base = CLIMAS[idx]!;

    return {
      ubicacion: ubicacionStr,
      fecha_horario,
      ...base,
    };
  }

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
