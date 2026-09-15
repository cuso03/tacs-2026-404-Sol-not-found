import express from 'express';
import cors from 'cors';
import notificacionesRoutes from './routes/notificacionesRoutes';
import swaggerUi from 'swagger-ui-express';
import { openApiDocument } from './openapi';
import { ActividadMongoRepository } from './repositories/actividadMongoRepository';
import { ActividadInMemoryRepository } from './repositories/actividadInMemoryRepository';
import { connectToMongo } from './infrastructure/mongo/connection';
import { IWeatherProvider } from './interfaces/services/IWeatherProvider';
import { createActividadesRoutes } from './routes/actividadesRoutes';
import { VotacionService } from './services/votacionService';
import { MockWeatherService } from './services/mockWeatherService';
import { OpenWeatherAdapter } from './utils/openWeatherAdapter';
import { InMemoryVotingJobQueue } from './services/inMemoryVotingJobQueue';
import { IVotingJobQueue } from './interfaces/services/votingJobQueue';
import { Redis } from 'ioredis';
import { BullMQVotingJobQueue, createVotingWorker } from './infrastructure/bullmq/votingJobQueue';
import { createUsuariosRoutes } from './routes/usuariosRoutes';
import { ActividadesService } from './services/actividadesService';
import { createEstadisticasRouter } from "./routes/estadisticasRoutes";
import { EstadisticasStoreService } from "./services/estadisticasStoreService";
import { errorHandler } from "./middleware/errorHandler";
import { EstadisticasMongoStore } from './repositories/estadisticasMongoStore';
import { RabbitMQNotifier } from './services/notifications/RabbitMQNotifier';
import { NotificationWorker } from './services/notifications/NotificationWorker';
import { TelegramService } from './services/notifications/TelegramService';
import { ActividadEventNotifier } from './services/notifications/ActividadEventNotifier';
import { ClimaMonitorService } from './services/clima/ClimaMonitorService';
import { CronSetup } from './cronJobs/CronSetup';
import { ActividadRepository } from './interfaces/repositories/actividadRepository';
import { IEstadisticasStore } from './utils/IEstadisticasStore';
import { NotificacionMongoRepository } from './repositories/notificacionMongoRepository';
import { UsuarioMongoRepository } from './repositories/usuarioMongoRepository';

function createJobQueue(): IVotingJobQueue {
  const useBullMq = process.env.USE_BULLMQ === 'true' && process.env.NODE_ENV !== 'test';
  if (useBullMq) {
    const connection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
    return new BullMQVotingJobQueue(connection);
  }
  return new InMemoryVotingJobQueue();
}

export function createApp(
  weatherProvider: IWeatherProvider = process.env.WEATHER_PROVIDER === 'OPENWEATHER'
    ? new OpenWeatherAdapter()
    : new MockWeatherService(),
  jobQueue: IVotingJobQueue = createJobQueue(),
  estadisticas: IEstadisticasStore = new EstadisticasMongoStore(),
) {
  // 1. Feature 7
  //const rabbitNotifier = new RabbitMQNotifier(); // El orquestador usa la cola
  const baseNotifier = process.env.NODE_ENV === 'test'  // esto es para que los tests no fallen al no tener RabbitMQ corriendo, no usamos la cola y listo en caso de tests
    ? { notify: async () => {} }
    : new RabbitMQNotifier();
  const telegramService = new TelegramService(); // El worker usa Telegram

  const actividadesRepository = new ActividadMongoRepository();
  const notificacionRepo = new NotificacionMongoRepository();
  const usuarioRepo = new UsuarioMongoRepository();

  const eventNotifier = new ActividadEventNotifier(baseNotifier, notificacionRepo);
  // 2. Instanciar VotacionService inyectando el Notificador
  const votacionService = new VotacionService(actividadesRepository, weatherProvider, jobQueue, eventNotifier, estadisticas);
  const climaMonitor = new ClimaMonitorService(weatherProvider, baseNotifier, estadisticas, votacionService, notificacionRepo);

  if (jobQueue instanceof InMemoryVotingJobQueue) {
    jobQueue.setVotacionService(votacionService);
  }

  const actividadesService = new ActividadesService(actividadesRepository, estadisticas);
  const estadisticasStoreService = new EstadisticasStoreService(estadisticas)

  if (process.env.NODE_ENV !== 'test') { // si ejecutamos tests, no usamos ni cron ni nos conectamos con telegram.
    const notificationWorker = new NotificationWorker(telegramService);
    notificationWorker.iniciar();

    if (process.env.USE_BULLMQ === 'true') {
      const redisConnection = new Redis(process.env.REDIS_URL ?? 'redis://redis:6379');
      createVotingWorker(
        (actividadId, votacionId) => votacionService.cerrarVotacion(actividadId, votacionId),
        redisConnection,
      );
    }

    // 3. Inicializar Cronjobs en el arranque
    const cronSetup = new CronSetup(climaMonitor, actividadesRepository);
    cronSetup.iniciarTareasProgramadas();
  }

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '100kb' }));

  // 4. Configurar Rutas
  app.use('/api/actividades', createActividadesRoutes(actividadesRepository, actividadesService, votacionService, weatherProvider));
  app.use('/api/usuarios', createUsuariosRoutes(actividadesService, usuarioRepo));
  app.use('/api/notificaciones', notificacionesRoutes);
  app.use('/api/admin/estadisticas', createEstadisticasRouter(estadisticasStoreService))

  app.get('/openapi.json', (_req, res) => res.json(openApiDocument));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

  // 5. Manejo centralizado de errores: siempre al final, después de las rutas.
  app.use(errorHandler);
  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT ?? 3000);
  const start = async () => {
    await connectToMongo();
    createApp().listen(port, () => console.log(`Servidor corriendo en http://localhost:${port}`));
  };
  start().catch((error) => {
    console.error('No se pudo iniciar la aplicación:', error);
    process.exit(1);
  });
}
