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

import { RabbitMQNotifier } from './services/notifications/RabbitMQNotifier';
import { NotificationWorker } from './services/notifications/NotificationWorker';
import { TelegramService } from './services/notifications/TelegramService';
import { ActividadEventNotifier } from './services/notifications/ActividadEventNotifier';
import { ClimaMonitorService } from './services/clima/ClimaMonitorService';
import { CronSetup } from './cronJobs/CronSetup';

export function createApp(
  repository = new ActividadInMemoryRepository(),
  weatherProvider: IWeatherProvider = new MockWeatherService(),
  jobQueue: IVotingJobQueue = new InMemoryVotingJobQueue(),
) {
  // 1. Feature 7
  //const rabbitNotifier = new RabbitMQNotifier(); // El orquestador usa la cola
  const baseNotifier = process.env.NODE_ENV === 'test'  // esto es para que los tests no fallen al no tener RabbitMQ corriendo, no usamos la cola y listo en caso de tests
    ? { notify: async () => {} } 
    : new RabbitMQNotifier();
  const telegramService = new TelegramService(); // El worker usa Telegram

  const eventNotifier = new ActividadEventNotifier(baseNotifier);
  const climaMonitor = new ClimaMonitorService(weatherProvider, baseNotifier);

  // 2. Instanciar VotacionService inyectando el Notificador
  const votacionService = new VotacionService(repository, weatherProvider, jobQueue, eventNotifier);

  if (jobQueue instanceof InMemoryVotingJobQueue) {
    jobQueue.setVotacionService(votacionService);
  }

  const actividadesService = new ActividadesService(repository);

  if (process.env.NODE_ENV !== 'test') { // si ejecutamos tests, no usamos ni cron ni nos conectamos con telegram.
    const notificationWorker = new NotificationWorker(telegramService);
    notificationWorker.iniciar();

    // 3. Inicializar Cronjobs en el arranque
    const cronSetup = new CronSetup(climaMonitor, repository);
    cronSetup.iniciarTareasProgramadas();
  }

  const app = express();
  app.use(express.json({ limit: '100kb' }));

  // 4. Configurar Rutas
  app.use('/api/actividades', createActividadesRoutes(repository, actividadesService, votacionService, weatherProvider));
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