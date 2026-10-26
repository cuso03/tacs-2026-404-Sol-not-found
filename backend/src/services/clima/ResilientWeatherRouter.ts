import { Ubicacion } from '../../interfaces/models/actividad';
import { PronosticoHora } from '../../interfaces/models/pronostico';
import { ClimaResponseDto } from '../../dtos/climaDto';
import { IWeatherProvider } from '../../interfaces/services/IWeatherProvider';
import { LegacyWeatherAdapter } from './LegacyWeatherAdapter';
import { UsuarioMongoRepository } from '../../repositories/usuarioMongoRepository';
import { IEstadisticasStore } from '../../utils/IEstadisticasStore';
import { CircuitBreakerOpenError } from './CircuitBreaker';

export interface ResilientClimaResult extends ClimaResponseDto {
  proveedor: 'default' | 'legacy';
  fallback?: boolean;
}

export class ResilientWeatherRouter implements IWeatherProvider {
  constructor(
    public readonly defaultProvider: IWeatherProvider,
    public readonly legacyProvider: LegacyWeatherAdapter,
    private readonly usuarioRepo?: UsuarioMongoRepository,
    private readonly statsStore?: IEstadisticasStore,
  ) {}

  /**
   * Implementación de la interfaz unificada IWeatherProvider.
   * Utiliza el proveedor default por defecto, o el legacy si no hay usuario especificado.
   */
  public async getClima(ubicacion: Ubicacion, fecha_horario: string): Promise<ClimaResponseDto> {
    const res = await this.getClimaForUser(ubicacion, fecha_horario);
    return res;
  }

  public async obtenerPronostico(ubicacion: Ubicacion, fechaDesde: string, dias: number): Promise<PronosticoHora[]> {
    return this.obtenerPronosticoForUser(ubicacion, fechaDesde, dias);
  }

  /**
   * Consulta el clima considerando la preferencia del usuario especificado.
   * Si el usuario eligió 'legacy', consulta el servicio legacy con protección de resiliencia.
   * Si el legacy falla o su Circuit Breaker está abierto, aplica Fallback automático a Visual Crossing.
   */
  public async getClimaForUser(
    ubicacion: Ubicacion,
    fecha_horario: string,
    userId?: string,
    forcedProvider?: 'default' | 'legacy',
  ): Promise<ResilientClimaResult> {
    const targetProvider = forcedProvider ?? (await this.resolveProviderForUser(userId));

    if (targetProvider === 'legacy') {
      try {
        const legacyData = await this.legacyProvider.getClima(ubicacion, fecha_horario);
        return {
          ...legacyData,
          proveedor: 'legacy',
          fallback: false,
        };
      } catch (legacyError) {
        // Registrar fallback y causas
        if (this.statsStore) {
          await this.statsStore.incrementar('legacy_fallbacks_total').catch(() => {});
          if (legacyError instanceof CircuitBreakerOpenError) {
            await this.statsStore.incrementar('legacy_errors_circuit_open').catch(() => {});
          }
        }

        console.warn('[ResilientWeatherRouter] Fallo proveedor legacy. Activando Fallback a proveedor por defecto:', {
          userId,
          reason: legacyError instanceof Error ? legacyError.message : String(legacyError),
        });

        // Fallback al proveedor por defecto (Visual Crossing)
        const fallbackData = await this.defaultProvider.getClima(ubicacion, fecha_horario);
        return {
          ...fallbackData,
          proveedor: 'legacy',
          fallback: true,
        };
      }
    }

    // Proveedor por defecto
    const defaultData = await this.defaultProvider.getClima(ubicacion, fecha_horario);
    return {
      ...defaultData,
      proveedor: 'default',
      fallback: false,
    };
  }

  /**
   * Obtiene pronóstico horario considerando la preferencia del usuario con fallback.
   */
  public async obtenerPronosticoForUser(
    ubicacion: Ubicacion,
    fechaDesde: string,
    dias: number,
    userId?: string,
    forcedProvider?: 'default' | 'legacy',
  ): Promise<PronosticoHora[]> {
    const targetProvider = forcedProvider ?? (await this.resolveProviderForUser(userId));

    if (targetProvider === 'legacy') {
      try {
        return await this.legacyProvider.obtenerPronostico(ubicacion, fechaDesde, dias);
      } catch (legacyError) {
        if (this.statsStore) {
          await this.statsStore.incrementar('legacy_fallbacks_total').catch(() => {});
        }
        console.warn('[ResilientWeatherRouter] Fallo en pronóstico legacy. Aplicando fallback a proveedor por defecto:', legacyError);
        return await this.defaultProvider.obtenerPronostico(ubicacion, fechaDesde, dias);
      }
    }

    return await this.defaultProvider.obtenerPronostico(ubicacion, fechaDesde, dias);
  }

  private async resolveProviderForUser(userId?: string): Promise<'default' | 'legacy'> {
    if (!userId || !this.usuarioRepo) return 'default';
    try {
      return await this.usuarioRepo.obtenerProveedorClima(userId);
    } catch {
      return 'default';
    }
  }
}
