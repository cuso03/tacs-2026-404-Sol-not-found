import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { openApiDocument } from './openapi';
import { ActividadInMemoryRepository } from './repositories/actividadInMemoryRepository';
import { createActividadesRoutes } from './routes/actividadesRoutes';

/** Construye la aplicación HTTP sin abrir un puerto, para uso productivo y tests. */
export function createApp(repository = new ActividadInMemoryRepository()) {
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.use('/api/actividades', createActividadesRoutes(repository));
  app.get('/openapi.json', (_req, res) => res.json(openApiDocument));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT ?? 3000);
  createApp().listen(port, () => console.log(`Servidor corriendo en http://localhost:${port}`));
}
