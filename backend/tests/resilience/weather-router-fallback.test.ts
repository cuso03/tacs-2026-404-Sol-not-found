import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResilientWeatherRouter } from '../../src/services/clima/ResilientWeatherRouter';
import { IWeatherProvider } from '../../src/interfaces/services/IWeatherProvider';
import { LegacyWeatherAdapter } from '../../src/services/clima/LegacyWeatherAdapter';
import { UsuarioMongoRepository } from '../../src/repositories/usuarioMongoRepository';
import { InMemoryEstadisticasStore } from '../../src/utils/InMemoryEstadisticasStore';
import { WeatherError } from '../../src/utils/weatherError';
import { Ubicacion } from '../../src/interfaces/models/actividad';

describe('ResilientWeatherRouter & Fallback (User Stories 1, 2, 3)', () => {
  let stats: InMemoryEstadisticasStore;
  let mockDefaultProvider: IWeatherProvider;
  let mockLegacyProvider: Partial<LegacyWeatherAdapter>;
  let mockUsuarioRepo: Partial<UsuarioMongoRepository>;

  const sampleUbicacion: Ubicacion = {
    tipo: 'coordenadas',
    latitud: -34.6037,
    longitud: -58.3816,
  };

  const defaultClimaResult = {
    ubicacion: '-34.6037, -58.3816',
    fecha_horario: '2026-11-14T18:00:00Z',
    clima_actual: { temperatura: 22, humedad: 55, viento: 10, condicion: 'SOLEADO' as const },
    pronostico_actividad: { temperatura: 23, viento: 12, probabilidad_lluvia: 5, condicion: 'SOLEADO' as const },
  };

  const legacyClimaResult = {
    ubicacion: '-34.6037, -58.3816',
    fecha_horario: '2026-11-14T18:00:00Z',
    clima_actual: { temperatura: 27, humedad: 65, viento: 18, condicion: 'PARCIALMENTE_NUBLADO' as const },
    pronostico_actividad: { temperatura: 28, viento: 20, probabilidad_lluvia: 15, condicion: 'PARCIALMENTE_NUBLADO' as const },
  };

  beforeEach(() => {
    stats = new InMemoryEstadisticasStore();
    mockDefaultProvider = {
      getClima: vi.fn().mockResolvedValue(defaultClimaResult),
      obtenerPronostico: vi.fn().mockResolvedValue([]),
    };
    mockLegacyProvider = {
      getClima: vi.fn().mockResolvedValue(legacyClimaResult),
      obtenerPronostico: vi.fn().mockResolvedValue([]),
    };
    mockUsuarioRepo = {
      obtenerProveedorClima: vi.fn().mockResolvedValue('default'),
    };
  });

  it('consulta el proveedor por defecto cuando el usuario no tiene preferencia o tiene "default"', async () => {
    const router = new ResilientWeatherRouter(
      mockDefaultProvider,
      mockLegacyProvider as LegacyWeatherAdapter,
      mockUsuarioRepo as UsuarioMongoRepository,
      stats,
    );

    const result = await router.getClimaForUser(sampleUbicacion, '2026-11-14T18:00:00Z', 'user-default');

    expect(result.proveedor).toBe('default');
    expect(result.fallback).toBe(false);
    expect(result.clima_actual.temperatura).toBe(22);
    expect(mockDefaultProvider.getClima).toHaveBeenCalled();
    expect(mockLegacyProvider.getClima).not.toHaveBeenCalled();
  });

  it('consulta el proveedor legacy cuando el usuario eligió "legacy"', async () => {
    (mockUsuarioRepo.obtenerProveedorClima as any).mockResolvedValue('legacy');

    const router = new ResilientWeatherRouter(
      mockDefaultProvider,
      mockLegacyProvider as LegacyWeatherAdapter,
      mockUsuarioRepo as UsuarioMongoRepository,
      stats,
    );

    const result = await router.getClimaForUser(sampleUbicacion, '2026-11-14T18:00:00Z', 'user-legacy');

    expect(result.proveedor).toBe('legacy');
    expect(result.fallback).toBe(false);
    expect(result.clima_actual.temperatura).toBe(27);
    expect(mockLegacyProvider.getClima).toHaveBeenCalled();
    expect(mockDefaultProvider.getClima).not.toHaveBeenCalled();
  });

  it('aplica FALLBACK transparente al proveedor default si el legacy falla (User Story 3)', async () => {
    (mockUsuarioRepo.obtenerProveedorClima as any).mockResolvedValue('legacy');
    (mockLegacyProvider.getClima as any).mockRejectedValue(new WeatherError('WEATHER_PROVIDER_UNAVAILABLE', 'Legacy caído'));

    const router = new ResilientWeatherRouter(
      mockDefaultProvider,
      mockLegacyProvider as LegacyWeatherAdapter,
      mockUsuarioRepo as UsuarioMongoRepository,
      stats,
    );

    const result = await router.getClimaForUser(sampleUbicacion, '2026-11-14T18:00:00Z', 'user-legacy');

    // La respuesta mantiene disponibilidad entregando los datos de respaldo
    expect(result.proveedor).toBe('legacy');
    expect(result.fallback).toBe(true);
    expect(result.clima_actual.temperatura).toBe(22); // Datos del default provider
    expect(mockDefaultProvider.getClima).toHaveBeenCalled();

    const metrics = await stats.obtener();
    expect(metrics['legacy_fallbacks_total']).toBe(1);
  });
});
