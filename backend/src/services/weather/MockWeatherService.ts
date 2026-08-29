import { IWeatherProvider, WeatherForecast } from '../../interfaces/services/weather/IWeatherProvider';

export class MockWeatherService implements IWeatherProvider {
  async getForecast(ubicacion: string, fecha_horario: string): Promise<WeatherForecast> {
    // Simulamos un retraso de red de 500ms para emular asincronismo real
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Retornamos el payload de respuesta de IWeatherProvider exigido por los criterios de aceptación
    return {
      ubicacion,
      fecha_horario,
      probabilidad_lluvia: 70,
      temperatura: 16,
      viento: 22,
      condicion: 'LLUVIA'
    };
  }
}