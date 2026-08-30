import { ActividadRepository } from '../interfaces/repositories/actividadRepository';
import { ClimaResponseDto, WeatherForecastDto, climaResponseSchema, weatherForecastSchema } from '../dtos/climaDto';
import { IWeatherProvider } from '../interfaces/services/IWeatherProvider';

/** Resultado de la consulta de clima para una actividad. */
export type ConsultarClimaResult =
  | { status: 'not_found' }
  | { status: 'weather_unavailable' }
  | { status: 'ok'; data: WeatherForecastDto };

function aPlano(nested: ClimaResponseDto): WeatherForecastDto {
  return {
    ubicacion: nested.ubicacion,
    fecha_horario: nested.fecha_horario,
    probabilidad_lluvia: nested.pronostico_actividad.probabilidad_lluvia,
    temperatura: nested.pronostico_actividad.temperatura,
    viento: nested.pronostico_actividad.viento,
    condicion: nested.pronostico_actividad.condicion,
  };
}

/**
 * Consulta de clima para una actividad — verifica que exista y obtiene clima actual y pronóstico.
 * Por ahora la búsqueda es solo por ID de actividad.
 */
export class ClimaService {
  constructor(
    private readonly repository: ActividadRepository,
    private readonly weatherProvider: IWeatherProvider,
  ) {}

  async consultarClima(actividadId: string): Promise<ConsultarClimaResult> {
    const actividad = await this.repository.findById(actividadId);
    if (!actividad) return { status: 'not_found' };

    // Nota futura: validar que quien consulta sea creador o participante de la actividad.
    // Si no tiene acceso, se respondería sin permiso (403 en el controlador).
    // Por ahora la consulta es solo por ID, sin validar usuario.

    try {
      const raw = await this.weatherProvider.getClima(actividad.ubicacion, actividad.fecha_horario);
      const parsedAnidado = climaResponseSchema.safeParse(raw);
      if (!parsedAnidado.success) return { status: 'weather_unavailable' };
      const plano = aPlano(parsedAnidado.data);
      const parsed = weatherForecastSchema.safeParse(plano);
      if (!parsed.success) return { status: 'weather_unavailable' };
      return { status: 'ok', data: parsed.data };
    } catch {
      return { status: 'weather_unavailable' };
    }
  }
}
