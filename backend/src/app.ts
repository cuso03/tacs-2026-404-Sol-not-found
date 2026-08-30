import express from 'express';
import actividadesRoutes from './routes/actividadesRoutes';
import notificacionesRoutes from './routes/notificacionesRoutes';
import swaggerUi from 'swagger-ui-express';
import { openApiDocument } from './openapi';
import { ActividadInMemoryRepository } from './repositories/actividadInMemoryRepository';
import { IWeatherProvider } from './interfaces/services/IWeatherProvider';
import { createActividadesRoutes } from './routes/actividadesRoutes';
import { MockWeatherService } from './services/mockWeatherService';
import { createUsuariosRoutes } from './routes/usuariosRoutes';
import { ActividadesService } from './services/actividadesService';

/** Construye la aplicación HTTP sin abrir un puerto, para uso productivo y tests. */
export function createApp(
  repository = new ActividadInMemoryRepository(),
  weatherProvider: IWeatherProvider = new MockWeatherService(),
) {
  const app = express();
  app.use(express.json({ limit: '100kb' }));

  const actividadesService = new ActividadesService(repository);

  app.use('/api/actividades', createActividadesRoutes(repository, weatherProvider));
  app.use('/api/usuarios', createUsuariosRoutes(actividadesService));


// Iniciamos el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

app.use('/api/actividades', notificacionesRoutes);

  app.get('/openapi.json', (_req, res) => res.json(openApiDocument));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT ?? 3000);
  createApp().listen(port, () => console.log(`Servidor corriendo en http://localhost:${port}`));
}

