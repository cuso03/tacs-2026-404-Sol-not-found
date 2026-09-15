import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../../src/app';
import { EstadisticasMongoStore } from '../../../src/repositories/estadisticasMongoStore';
import { EstadisticaModel } from '../../../src/infrastructure/mongo/estadisticasModel';
import { adminHeader } from '../../helpers/fixtures/auth.fixture';

describe('Persistencia de Estadísticas en MongoDB', () => {
  const app = createApp();
  const store = new EstadisticasMongoStore();

  it('persiste incrementos directos y los expone vía API administrativa', async () => {
    await store.incrementar('visitas_totales', 10);
    await store.incrementar('visitas_totales', 5);

    const response = await request(app)
      .get('/api/admin/estadisticas')
      .set(adminHeader());

    expect(response.status).toBe(200);
    expect(response.body.visitas_totales).toBe(15);

    // Verificación dual en base de datos
    const persisted = await EstadisticaModel.findOne({ metrica: 'visitas_totales' });
    expect(persisted?.cantidad).toBe(15);
  });

  it('obtener() retorna un diccionario plano con todas las métricas persistidas', async () => {
    await store.incrementar('metrica_a', 3);
    await store.incrementar('metrica_b', 7);

    const metricas = await store.obtener();

    expect(metricas).toEqual({
      metrica_a: 3,
      metrica_b: 7,
    });
  });

  it('reset() limpia idempotentemente todas las estadísticas en MongoDB', async () => {
    await store.incrementar('temporal', 42);
    expect(await EstadisticaModel.countDocuments()).toBe(1);

    await store.reset();

    const despues = await request(app)
      .get('/api/admin/estadisticas')
      .set(adminHeader());

    expect(despues.status).toBe(200);
    expect(despues.body).toEqual({});
    expect(await EstadisticaModel.countDocuments()).toBe(0);
  });
});
