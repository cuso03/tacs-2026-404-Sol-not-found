import { Router } from 'express';
import { createUsuariosController } from '../controllers/usuariosController';
import { requireAuthenticatedUser } from '../middleware/authenticatedUser';
import { ActividadesService } from '../services/actividadesService';
import { UsuarioMongoRepository } from '../repositories/usuarioMongoRepository';

export function createUsuariosRoutes(
  service: ActividadesService, 
  usuarioRepo: UsuarioMongoRepository
): Router {
  const router = Router();
  const controller = createUsuariosController(service, usuarioRepo);

  router.get('/me/actividades', requireAuthenticatedUser, controller.getDashboard);
  router.patch('/me', requireAuthenticatedUser, controller.syncPerfil);
  router.get('/me/preferencias', requireAuthenticatedUser, controller.getPreferencias);
  router.patch('/me/preferencias', requireAuthenticatedUser, controller.actualizarPreferencia);

  return router;
}
