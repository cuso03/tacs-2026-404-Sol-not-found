import { ActividadRepository } from '../interfaces/repositories/actividadRepository';
import { ClimaResponseDto, climaResponseSchema } from '../dtos/climaDto';
import { IWeatherProvider } from '../interfaces/services/IWeatherProvider';

/** Resultado de la consulta de clima para una actividad. */
export type ConsultarClimaResult =
  | { status: 'not_found' }
  | { status: 'weather_unavailable' }
  | { status: 'ok'; data: ClimaResponseDto };

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

    try {
      const raw = await this.weatherProvider.getClima(actividad.ubicacion, actividad.fecha_horario);
      const parsed = climaResponseSchema.safeParse(raw);
      if (!parsed.success) return { status: 'weather_unavailable' };
      return { status: 'ok', data: parsed.data };
    } catch {
      return { status: 'weather_unavailable' };
    }
  }
}
