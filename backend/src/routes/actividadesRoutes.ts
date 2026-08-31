import { Router } from 'express';
import { createActividadesController } from '../interfaces/controllers/actividadesController';
import { createVotacionesController } from '../interfaces/controllers/votacionesController';
import { createClimaController } from '../interfaces/controllers/climaController';
import { requireAuthenticatedUser } from '../middleware/authenticatedUser';
import { ActividadRepository } from '../interfaces/repositories/actividadRepository';
import { IWeatherProvider } from '../interfaces/services/IWeatherProvider';
import { ActividadesService } from '../services/actividadesService';
import { VotacionService } from '../services/votacionService';
import { ClimaService } from '../services/climaService';
import { MockWeatherService } from '../services/mockWeatherService';

/** Registra las rutas de actividades usando el servicio y proveedor de clima indicados. */
export function createActividadesRoutes(
  repository: ActividadRepository,
  actividadesService: ActividadesService,
  votacionService: VotacionService,
  weatherProvider: IWeatherProvider = new MockWeatherService(),
): Router {
  const router = Router();
  const controller = createActividadesController(actividadesService);
  const votacionController = createVotacionesController(votacionService);
  const climaController = createClimaController(new ClimaService(repository, weatherProvider));

  router.get('/', controller.search);
  router.post('/', requireAuthenticatedUser, controller.create);
  router.post('/:id/reglas', requireAuthenticatedUser, controller.configureRules);
  router.get('/:id/clima', climaController.getClima);
  router.post('/:id/participantes', requireAuthenticatedUser, controller.addParticipant);
  router.delete('/:id/participantes/me', requireAuthenticatedUser, controller.removeParticipant);

  router.get('/:id/fechas-disponibles', requireAuthenticatedUser, votacionController.getFechasDisponibles);
  router.post('/:id/votaciones', requireAuthenticatedUser, votacionController.abrirVotacion);
  router.post('/:id/votaciones/:votacionId/alternativas/:alternativaId/votar', requireAuthenticatedUser, votacionController.votar);
  router.get('/:id/votaciones/:votacionId', requireAuthenticatedUser, votacionController.getResultados);
  router.delete('/:id/votaciones/:votacionId', requireAuthenticatedUser, votacionController.cerrarVotacion);

  return router;
}
