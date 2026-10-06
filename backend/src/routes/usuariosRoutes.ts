import { Router } from 'express';
import { createUsuariosController } from '../controllers/usuariosController';
import { requireAuthenticatedUser } from '../middleware/authenticatedUser';
import { ActividadesService } from '../services/actividadesService';
import { UsuarioMongoRepository } from '../repositories/usuarioMongoRepository';

export function createUsuariosRoutes(
  service: ActividadesService, 
  usuarioRepo: UsuarioMongoRepository // 1. Recibimos el repo
): Router {
  const router = Router();
  
  // 2. Se lo pasamos al controlador
  const controller = createUsuariosController(service, usuarioRepo);

  router.get('/me/actividades', requireAuthenticatedUser, controller.getDashboard);
  // PATCH (no GET): el upsert escribe, y un GET debe ser seguro.
  router.patch('/me', requireAuthenticatedUser, controller.syncPerfil);

  return router;
}