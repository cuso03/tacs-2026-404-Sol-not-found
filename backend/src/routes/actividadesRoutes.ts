import { Router } from 'express';
import { createActividadesController } from '../interfaces/controllers/actividadesController';
import { createVotacionesController } from '../interfaces/controllers/votacionesController';
import { requireAuthenticatedUser } from '../middleware/authenticatedUser';
import { ActividadRepository } from '../interfaces/repositories/actividadRepository';
import { ActividadesService } from '../services/actividadesService';
import { VotacionService } from '../services/votacionService';

/** Registra las rutas de actividades usando el repositorio indicado. */
export function createActividadesRoutes(
  repository: ActividadRepository,
  votacionService: VotacionService,
): Router {
  const router = Router();
  const controller = createActividadesController(new ActividadesService(repository));
  const votacionController = createVotacionesController(votacionService);

  router.get('/', controller.getActividades);
  router.post('/', requireAuthenticatedUser, controller.create);
  router.post('/:id/reglas', requireAuthenticatedUser, controller.configureRules);

  router.get('/:id/fechas-disponibles', requireAuthenticatedUser, votacionController.getFechasDisponibles);
  router.post('/:id/votaciones', requireAuthenticatedUser, votacionController.abrirVotacion);
  router.post('/:id/votaciones/:votacionId/alternativas/:alternativaId/votar', requireAuthenticatedUser, votacionController.votar);
  router.get('/:id/votaciones/:votacionId', requireAuthenticatedUser, votacionController.getResultados);

  return router;
}
