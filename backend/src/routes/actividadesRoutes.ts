import { Router } from 'express';
import { createActividadesController } from '../interfaces/controllers/actividadesController';
import { requireAuthenticatedUser } from '../middleware/authenticatedUser';
import { ActividadRepository } from '../interfaces/repositories/actividadRepository';
import { ActividadesService } from '../services/actividadesService';

/** Registra las rutas de actividades usando el repositorio indicado. */
export function createActividadesRoutes(repository: ActividadRepository): Router {
  const router = Router();
  const controller = createActividadesController(new ActividadesService(repository));

  router.get('/', controller.getActividades);
  router.post('/', requireAuthenticatedUser, controller.create);
  router.post('/:id/reglas', requireAuthenticatedUser, controller.configureRules);

  return router;
}
