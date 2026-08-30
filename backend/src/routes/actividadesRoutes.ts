import { Router } from 'express';
import { createActividadesController } from '../interfaces/controllers/actividadesController';
import { createClimaController } from '../interfaces/controllers/climaController';
import { requireAuthenticatedUser } from '../middleware/authenticatedUser';
import { ActividadRepository } from '../interfaces/repositories/actividadRepository';
import { IWeatherProvider } from '../interfaces/services/IWeatherProvider';
import { ActividadesService } from '../services/actividadesService';
import { ClimaService } from '../services/climaService';
import { MockWeatherService } from '../services/mockWeatherService';

/** Registra las rutas de actividades usando el repositorio y proveedor de clima indicados. */
export function createActividadesRoutes(
  repository: ActividadRepository,
  weatherProvider: IWeatherProvider = new MockWeatherService(),
): Router {
  const router = Router();
  const controller = createActividadesController(new ActividadesService(repository));
  const climaController = createClimaController(new ClimaService(repository, weatherProvider));

  router.get('/', controller.getActividades);
  router.post('/', requireAuthenticatedUser, controller.create);
  router.post('/:id/reglas', requireAuthenticatedUser, controller.configureRules);
  router.get('/:id/clima', climaController.getClima);

  return router;
}
