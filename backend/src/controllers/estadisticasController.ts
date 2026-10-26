import { Request, Response } from 'express';
import { EstadisticasStoreService } from '../services/estadisticasStoreService';
import { ResilientWeatherRouter } from '../services/clima/ResilientWeatherRouter';

export function estadisticasController(
  service: EstadisticasStoreService,
  weatherRouter?: ResilientWeatherRouter,
) {
  async function getEstadisticas(_req: Request, res: Response): Promise<void> {
    try {
      const result = await service.devolverEstadisticas();
      res.status(200).json(result);
    } catch (err) {
      res.status(500).send('Ocurrio un error al intentar obtener estadisticas, error: ' + err);
    }
  }

  async function getClimaEstadisticas(_req: Request, res: Response): Promise<void> {
    try {
      const metrics = await service.devolverEstadisticas();

      const hits = metrics['legacy_cache_hits'] ?? 0;
      const misses = metrics['legacy_cache_misses'] ?? 0;
      const totalCacheRequests = hits + misses;
      const hitRatioPct = totalCacheRequests > 0 ? Math.round((hits / totalCacheRequests) * 1000) / 10 : 0;

      let legacyHealthStatus: 'OK' | 'DEGRADED' | 'OUTAGE' = 'OK';
      let circuitBreakerState: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
      let circuitBreakerFailures = 0;
      let lastFailureTime: number | null = null;

      if (weatherRouter?.legacyProvider) {
        try {
          const health = await weatherRouter.legacyProvider.checkHealth();
          legacyHealthStatus = health.status;
        } catch {
          legacyHealthStatus = 'OUTAGE';
        }

        const cbMetrics = weatherRouter.legacyProvider.circuitBreaker.getMetrics();
        circuitBreakerState = cbMetrics.state;
        circuitBreakerFailures = cbMetrics.consecutiveFailures;
        lastFailureTime = cbMetrics.lastFailureTime || null;
      }

      res.status(200).json({
        proveedores: {
          default: {
            nombre: 'Visual Crossing',
            estado: 'OK',
          },
          legacy: {
            nombre: 'Humedad, Datos y Pronósticos S.A. (tacs-bin)',
            estado: legacyHealthStatus,
            circuitBreaker: {
              estado: circuitBreakerState,
              fallosConsecutivos: circuitBreakerFailures,
              ultimoFallo: lastFailureTime ? new Date(lastFailureTime).toISOString() : null,
            },
            cache: {
              hits,
              misses,
              hitRatioPct,
            },
            metricas: {
              consultasTotales: metrics['legacy_requests_total'] ?? 0,
              consultasExitosas: metrics['legacy_requests_success'] ?? 0,
              consultasFallidas: metrics['legacy_requests_failed'] ?? 0,
              fallbacksEjecutados: metrics['legacy_fallbacks_total'] ?? 0,
              erroresTimeout: metrics['legacy_errors_timeout'] ?? 0,
              erroresValidacion: metrics['legacy_errors_validation'] ?? 0,
              erroresCircuitOpen: metrics['legacy_errors_circuit_open'] ?? 0,
            },
          },
        },
      });
    } catch (err) {
      res.status(500).json({ error: 'Error al obtener telemetría de clima: ' + err });
    }
  }

  return { getEstadisticas, getClimaEstadisticas };
}
