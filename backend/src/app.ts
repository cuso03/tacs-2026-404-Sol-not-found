import express from 'express';
import notificacionesRoutes from './routes/notificacionesRoutes';
import swaggerUi from 'swagger-ui-express';
import { openApiDocument } from './openapi';
import { ActividadInMemoryRepository } from './repositories/actividadInMemoryRepository';
import { IWeatherProvider } from './interfaces/services/IWeatherProvider';
import { createActividadesRoutes } from './routes/actividadesRoutes';
import { VotacionService } from './services/votacionService';
import { MockWeatherService } from './services/mockWeatherService';
import { InMemoryVotingJobQueue } from './services/inMemoryVotingJobQueue';
import { IVotingJobQueue } from './interfaces/services/votingJobQueue';
import { createUsuariosRoutes } from './routes/usuariosRoutes';
import { ActividadesService } from './services/actividadesService';

// Importaciones de la Feature 7
import { MockTelegramService } from './services/notifications/MockTelegramService';
import { ActividadEventNotifier } from './services/notifications/ActividadEventNotifier';
import { ClimaMonitorService } from './services/clima/ClimaMonitorService';
import { CronSetup } from './cronJobs/CronSetup';

export function createApp(
  repository = new ActividadInMemoryRepository(),
  weatherProvider: IWeatherProvider = new MockWeatherService(),
  jobQueue: IVotingJobQueue = new InMemoryVotingJobQueue(),
) {
  // 1. Instanciar Servicios de Notificación y Clima (Feature 7)
  const notifierService = new MockTelegramService();
  const eventNotifier = new ActividadEventNotifier(notifierService);
  const climaMonitor = new ClimaMonitorService(weatherProvider, notifierService);

  // 2. Instanciar VotacionService inyectando el Notificador
  const votacionService = new VotacionService(repository, weatherProvider, jobQueue, eventNotifier);

  if (jobQueue instanceof InMemoryVotingJobQueue) {
    jobQueue.setVotacionService(votacionService);
  }

  const actividadesService = new ActividadesService(repository);

  // 3. Inicializar Cronjobs en el arranque
  const cronSetup = new CronSetup(climaMonitor, repository);
  cronSetup.iniciarTareasProgramadas();

  const app = express();
  app.use(express.json({ limit: '100kb' }));

  // 4. Configurar Rutas
  app.use('/api/actividades', createActividadesRoutes(repository, actividadesService, votacionService, weatherProvider));
  app.use('/api/usuarios', createUsuariosRoutes(actividadesService));
  
  // Se corrigió el duplicado: notificacionesRoutes contiene tu endpoint mock
  app.use('/api/actividades', notificacionesRoutes);

  app.get('/openapi.json', (_req, res) => res.json(openApiDocument));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT ?? 3000);
  createApp().listen(port, () => console.log(`Servidor corriendo en http://localhost:${port}`));
}