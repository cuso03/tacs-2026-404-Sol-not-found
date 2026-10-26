import { Router } from 'express';
import { EstadisticasStoreService } from '../services/estadisticasStoreService';
import { requireAdmin, requireAuthenticatedUser } from '../middleware/authenticatedUser';
import { estadisticasController } from '../controllers/estadisticasController';
import { ResilientWeatherRouter } from '../services/clima/ResilientWeatherRouter';

export function createEstadisticasRouter(
  service: EstadisticasStoreService,
  weatherRouter?: ResilientWeatherRouter,
): Router {
  const router = Router();
  const controller = estadisticasController(service, weatherRouter);

  router.get('/', requireAuthenticatedUser, requireAdmin, controller.getEstadisticas);
  router.get('/clima', requireAuthenticatedUser, requireAdmin, controller.getClimaEstadisticas);

  return router;
}
