export interface WeatherForecast {
  ubicacion: string;
  fecha_horario: string;
  probabilidad_lluvia: number;
  temperatura: number;
  viento: number;
  condicion: string;
}

export interface IWeatherProvider {
  getForecast(ubicacion: string, fecha_horario: string): Promise<WeatherForecast>;
}