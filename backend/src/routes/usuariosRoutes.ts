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
  
  // 3. Registramos la ruta nueva
  router.post('/sync', requireAuthenticatedUser, controller.syncPerfil);

  return router;
}