import { WeatherError, WeatherErrorCode, weatherErrorMessages } from '../utils/weatherError';
import { ActividadRepository } from '../interfaces/repositories/actividadRepository';
import { ClimaResponseDto, climaResponseSchema } from '../dtos/climaDto';
import { IWeatherProvider } from '../interfaces/services/IWeatherProvider';

/** Resultado de la consulta de clima para una actividad. */
export type ConsultarClimaResult =
  | { status: 'not_found' }
  | { status: 'weather_unavailable'; code: WeatherErrorCode; message: string }
  | { status: 'ok'; data: ClimaResponseDto };

/**
 * Consulta de clima para una actividad — verifica que exista y obtiene clima actual y pronóstico.
 */
export class ClimaService {
  constructor(
    private readonly repository: ActividadRepository,
    private readonly weatherProvider: IWeatherProvider,
  ) {}

  async consultarClima(actividadId: string, userId?: string): Promise<ConsultarClimaResult> {
    const actividad = await this.repository.findById(actividadId);
    if (!actividad) return { status: 'not_found' };

    try {
      // Priorizar el usuario consultante, o el creador de la actividad (User Story 2)
      const targetUser = userId || actividad.creadorId;

      const raw = await this.weatherProvider.getClima(
        actividad.ubicacion,
        actividad.fecha_horario,
        targetUser,
      );

      const parsed = climaResponseSchema.safeParse(raw);
      if (!parsed.success) {
        throw new WeatherError('WEATHER_INVALID_RESPONSE', 'La respuesta no cumple el contrato de clima');
      }
      return { status: 'ok', data: parsed.data };
    } catch (error) {
      const code: WeatherErrorCode = error instanceof WeatherError ? error.code
        : error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name) ? 'WEATHER_TIMEOUT'
        : 'WEATHER_PROVIDER_UNAVAILABLE';
      const cause = error instanceof Error ? error.cause as { code?: string } | undefined : undefined;
      console.error('[ClimaService] Consulta fallida', {
        actividadId, code,
        upstreamStatus: error instanceof WeatherError ? error.upstreamStatus : undefined,
        errorType: error instanceof Error ? error.name : 'UnknownError',
        networkCode: cause?.code,
      });
      return { status: 'weather_unavailable', code, message: weatherErrorMessages[code] };
    }
  }
}
