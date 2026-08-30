import { Router } from 'express';
import { createUsuariosController } from '../interfaces/controllers/usuariosController';
import { requireAuthenticatedUser } from '../middleware/authenticatedUser';
import { ActividadesService } from '../services/actividadesService';

export function createUsuariosRoutes(service: ActividadesService): Router {
  const router = Router();
  const controller = createUsuariosController(service);

  router.get('/me/actividades', requireAuthenticatedUser, controller.getDashboard);

  return router;
}