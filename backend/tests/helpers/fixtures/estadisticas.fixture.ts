import { EstadisticaModel } from '../../../src/infrastructure/mongo/estadisticasModel';
import { IWeatherProvider } from '../../../src/interfaces/services/IWeatherProvider';

/**
 * Inserta métricas directamente en MongoDB para preparar el estado inicial del test.
 */
export async function seedEstadisticas(metricas: Record<string, number>): Promise<void> {
  await Promise.all(
    Object.entries(metricas).map(([metrica, cantidad]) =>
      EstadisticaModel.findOneAndUpdate(
        { metrica },
        { $set: { cantidad } },
        { upsert: true, returnDocument: 'after' }
      )
    )
  );
}

/**
 * Genera un mock de IWeatherProvider que siempre devuelve condiciones climáticas adversas (tormenta).
 */
export function createBadWeatherProvider(): IWeatherProvider {
  return {
    getClima: async (_ubicacion: unknown, fecha_horario: string) => ({
      ubicacion: 'Plaza de Mayo',
      fecha_horario,
      clima_actual: { temperatura: 5, condicion: 'TORMENTA', viento: 80, humedad: 95 },
      pronostico_actividad: { probabilidad_lluvia: 95, temperatura: 5, viento: 80, condicion: 'TORMENTA' },
    }),
    obtenerPronostico: async () => [],
  } as unknown as IWeatherProvider;
}
