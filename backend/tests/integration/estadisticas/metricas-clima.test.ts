import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../../src/app';
import { toActividad } from '../../../src/infrastructure/mongo/actividadModel';
import { EstadisticasMongoStore } from '../../../src/repositories/estadisticasMongoStore';
import { ClimaMonitorService } from '../../../src/services/clima/ClimaMonitorService';
import { MockWeatherService } from '../../../src/services/mockWeatherService';
import { seedActividad } from '../../helpers/fixtures/actividad.fixture';
import { createReglasPayload } from '../../helpers/fixtures/regla.fixture';
import { adminHeader } from '../../helpers/fixtures/auth.fixture';
import { createBadWeatherProvider } from '../../helpers/fixtures/estadisticas.fixture';

describe('Métricas de Monitoreo de Clima', () => {
  it('incrementa consultas_clima al evaluar el pronóstico de una actividad', async () => {
    const weatherProvider = new MockWeatherService();
    const app = createApp(weatherProvider);
    const store = new EstadisticasMongoStore();

    const actividadDoc = await seedActividad({
      reglasClima: createReglasPayload(),
    });
    const actividad = toActividad(actividadDoc);

    const monitor = new ClimaMonitorService(weatherProvider, { notify: async () => {} }, store);

    await monitor.checkActividadWeather(actividad);
    await monitor.checkActividadWeather(actividad);

    const response = await request(app)
      .get('/api/admin/estadisticas')
      .set(adminHeader());

    expect(response.status).toBe(200);
    expect(response.body.consultas_clima).toBe(2);
  });

  it('incrementa alertas_mal_clima y consultas_clima cuando el pronóstico es desfavorable', async () => {
    const badWeather = createBadWeatherProvider();
    const app = createApp(badWeather);
    const store = new EstadisticasMongoStore();

    const actividadDoc = await seedActividad({
      reglasClima: createReglasPayload({ probabilidad_lluvia_max: 20 }),
    });
    const actividad = toActividad(actividadDoc);

    const monitor = new ClimaMonitorService(badWeather, { notify: async () => {} }, store);

    await monitor.checkActividadWeather(actividad);

    const response = await request(app)
      .get('/api/admin/estadisticas')
      .set(adminHeader());

    expect(response.status).toBe(200);
    expect(response.body.consultas_clima).toBe(1);
    expect(response.body.alertas_mal_clima).toBe(1);
  });
});
