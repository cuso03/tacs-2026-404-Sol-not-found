import express from 'express';
import actividadesRoutes from './routes/actividadesRoutes';
import notificacionesRoutes from './routes/notificacionesRoutes';
import swaggerUi from 'swagger-ui-express';
import { openApiDocument } from './openapi';
import { ActividadInMemoryRepository } from './repositories/actividadInMemoryRepository';
import { IWeatherProvider } from './interfaces/services/IWeatherProvider';
import { createActividadesRoutes } from './routes/actividadesRoutes';
import { VotacionService } from './services/votacionService';
import { MockWeatherService } from './services/mockWeatherService';
import { InMemoryVotingJobQueue } from './services/inMemoryVotingJobQueue';
import { WeatherService } from './interfaces/services/weatherService';
import { IVotingJobQueue } from './interfaces/services/votingJobQueue';
import { createUsuariosRoutes } from './routes/usuariosRoutes';
import { ActividadesService } from './services/actividadesService';

/** Construye la aplicación HTTP sin abrir un puerto, para uso productivo y tests. */
export function createApp(
  repository = new ActividadInMemoryRepository(),
  weatherService: WeatherService = new MockWeatherService(),
  jobQueue: IVotingJobQueue = new InMemoryVotingJobQueue(),
) {
  const votacionService = new VotacionService(repository, weatherService, jobQueue);

  if (jobQueue instanceof InMemoryVotingJobQueue) {
    jobQueue.setVotacionService(votacionService);
  }

  const app = express();
  app.use(express.json({ limit: '100kb' }));

  const actividadesService = new ActividadesService(repository);

  app.use('/api/actividades', createActividadesRoutes(repository, votacionService, weatherService));
  app.use('/api/usuarios', createUsuariosRoutes(actividadesService));
  app.use('/api/actividades', notificacionesRoutes);

  app.get('/openapi.json', (_req, res) => res.json(openApiDocument));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT ?? 3000);
  createApp().listen(port, () => console.log(`Servidor corriendo en http://localhost:${port}`));
}
