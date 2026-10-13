export type WeatherErrorCode = 'WEATHER_DATE_UNAVAILABLE' | 'WEATHER_LOCATION_NOT_FOUND' | 'WEATHER_RATE_LIMITED' | 'WEATHER_TIMEOUT' | 'WEATHER_INVALID_RESPONSE' | 'WEATHER_PROVIDER_UNAVAILABLE';

export class WeatherError extends Error {
  constructor(public readonly code: WeatherErrorCode, message: string, public readonly upstreamStatus?: number) {
    super(message);
    this.name = 'WeatherError';
  }
}

export const weatherErrorMessages: Record<WeatherErrorCode, string> = {
  WEATHER_DATE_UNAVAILABLE: 'No hay pronóstico disponible para esa fecha. Consultá una fecha futura dentro de los próximos 16 días.',
  WEATHER_LOCATION_NOT_FOUND: 'No se pudo encontrar la ubicación para consultar el clima. Revisá la ciudad y el país o elegí un punto en el mapa.',
  WEATHER_RATE_LIMITED: 'El proveedor de clima alcanzó temporalmente su límite de consultas. Intentá nuevamente más tarde.',
  WEATHER_TIMEOUT: 'El proveedor de clima tardó demasiado en responder. Intentá nuevamente.',
  WEATHER_INVALID_RESPONSE: 'El proveedor devolvió datos de clima incompletos o inválidos. Intentá nuevamente más tarde.',
  WEATHER_PROVIDER_UNAVAILABLE: 'No pudimos conectar con el proveedor de clima. Intentá nuevamente más tarde.',
};
