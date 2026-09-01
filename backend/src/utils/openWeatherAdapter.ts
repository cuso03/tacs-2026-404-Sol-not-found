import "dotenv/config";

import { Ubicacion } from "../interfaces/models/actividad";
import { PronosticoHora } from "../interfaces/models/pronostico";
import {
  ClimaResponseDto,
  ClimaActualDto,
  PronosticoActividadDto,
} from "../dtos/climaDto";
import { IWeatherProvider } from "../interfaces/services/IWeatherProvider";

/**
 * ============================================================
 * TIPOS DE RESPUESTA DE OPENWEATHER
 * ============================================================
 */

/**
 * Respuesta del endpoint de Geocoding.
 */
interface OpenWeatherGeocodingResponse {
  name: string;
  lat: number;
  lon: number;
  country: string;
  state?: string;
}

/**
 * Condición meteorológica de OpenWeather.
 */
interface OpenWeatherWeather {
  id: number;
  main: string;
  description: string;
  icon: string;
}

/**
 * Datos del clima actual.
 *
 * Endpoint:
 * /data/2.5/weather
 */
interface OpenWeatherCurrentResponse {
  dt: number;

  main: {
    temp: number;
    humidity: number;
  };

  wind: {
    speed: number;
  };

  weather: OpenWeatherWeather[];
}

/**
 * Elemento del pronóstico.
 *
 * Endpoint:
 * /data/2.5/forecast
 *
 * OpenWeather devuelve aproximadamente
 * un pronóstico cada 3 horas.
 */
interface OpenWeatherForecastItem {
  dt: number;

  main: {
    temp: number;
    humidity: number;
  };

  pop: number;

  wind: {
    speed: number;
  };

  weather: OpenWeatherWeather[];
}

/**
 * Respuesta completa del endpoint de forecast.
 */
interface OpenWeatherForecastResponse {
  list: OpenWeatherForecastItem[];

  city: {
    name: string;
    timezone: number;
  };
}

/**
 * ============================================================
 * ADAPTER
 * ============================================================
 */

/**
 * Adapter de OpenWeather.
 *
 * Implementa IWeatherProvider.
 *
 * Este adapter funciona como proveedor alternativo/backup
 * de Open-Meteo.
 *
 * La aplicación no debería conocer:
 *
 * - URLs de OpenWeather
 * - API keys
 * - nombres de campos externos
 * - códigos meteorológicos de OpenWeather
 * - unidades específicas de OpenWeather
 */
export class OpenWeatherAdapter
  implements IWeatherProvider
{
  /**
   * API key de OpenWeather.
   */
  private readonly apiKey: string;

  /**
   * Endpoint para clima actual.
   */
  private readonly currentUrl =
    "https://api.openweathermap.org/data/2.5/weather";

  /**
   * Endpoint para pronóstico.
   *
   * IMPORTANTE:
   *
   * No utilizamos One Call 3.0 porque tu API key
   * no tiene acceso a ese servicio.
   */
  private readonly forecastUrl =
    "https://api.openweathermap.org/data/2.5/forecast";

  /**
   * Endpoint para geocoding.
   */
  private readonly geocodingUrl =
    "https://api.openweathermap.org/geo/1.0/direct";

  /**
   * Cache simple de coordenadas.
   */
  private readonly cacheGeocoding =
    new Map<
      string,
      {
        latitud: number;
        longitud: number;
      }
    >();

  /**
   * Carga la API key desde .env.
   */
  constructor() {
    const apiKey =
      process.env.OPENWEATHER_API_KEY;

    if (
      !apiKey ||
      apiKey.trim() === ""
    ) {
      throw new Error(
        "Falta la variable de entorno OPENWEATHER_API_KEY",
      );
    }

    this.apiKey = apiKey;
  }

  /**
   * ==========================================================
   * GET CLIMA
   * ==========================================================
   *
   * Obtiene:
   *
   * - clima actual
   * - pronóstico para la actividad
   */
  async getClima(
    ubicacion: Ubicacion,
    fecha_horario: string,
  ): Promise<ClimaResponseDto> {
    const fechaActividad =
      new Date(fecha_horario);

    if (
      Number.isNaN(
        fechaActividad.getTime(),
      )
    ) {
      throw new Error(
        `Fecha inválida: ${fecha_horario}`,
      );
    }

    /**
     * Obtenemos coordenadas.
     */
    const coordenadas =
      await this.obtenerCoordenadas(
        ubicacion,
      );

    /**
     * Consultamos clima actual.
     */
    const climaActualResponse =
      await this.consultarClimaActual(
        coordenadas.latitud,
        coordenadas.longitud,
      );

    /**
     * Consultamos forecast.
     */
    const forecast =
      await this.consultarPronostico(
        coordenadas.latitud,
        coordenadas.longitud,
      );

    /**
     * Buscamos el pronóstico más cercano
     * a la fecha de la actividad.
     */
    const pronosticoHora =
      this.buscarPronosticoMasCercano(
        forecast.list,
        fechaActividad,
      );

    /**
     * Mapeamos clima actual.
     */
    const climaActual =
      this.mapearClimaActual(
        climaActualResponse,
      );

    /**
     * Mapeamos pronóstico.
     */
    const pronosticoActividad =
      this.mapearPronosticoActividad(
        pronosticoHora,
      );

    return {
      ubicacion:
        this.obtenerNombreUbicacion(
          ubicacion,
        ),

      fecha_horario,

      clima_actual:
        climaActual,

      pronostico_actividad:
        pronosticoActividad,
    };
  }

  /**
   * ==========================================================
   * OBTENER PRONÓSTICO
   * ==========================================================
   */
  async obtenerPronostico(
    ubicacion: Ubicacion,
    fechaDesde: string,
    dias: number,
  ): Promise<PronosticoHora[]> {
    if (dias <= 0) {
      return [];
    }

    const fechaInicio =
      new Date(fechaDesde);

    if (
      Number.isNaN(
        fechaInicio.getTime(),
      )
    ) {
      throw new Error(
        `Fecha inválida: ${fechaDesde}`,
      );
    }

    /**
     * Coordenadas.
     */
    const coordenadas =
      await this.obtenerCoordenadas(
        ubicacion,
      );

    /**
     * Forecast.
     */
    const forecast =
      await this.consultarPronostico(
        coordenadas.latitud,
        coordenadas.longitud,
      );

    /**
     * Fecha final.
     */
    const fechaFin =
      new Date(fechaInicio);

    fechaFin.setDate(
      fechaFin.getDate() + dias,
    );

    /**
     * OpenWeather devuelve puntos cada ~3 horas.
     *
     * Filtramos únicamente los puntos
     * que pertenecen al rango solicitado.
     */
    return forecast.list
      .filter((hora) => {
        const fechaHora =
          new Date(hora.dt * 1000);

        return (
          fechaHora >= fechaInicio &&
          fechaHora < fechaFin
        );
      })
      .map((hora) =>
        this.mapearPronosticoHora(
          hora,
        ),
      );
  }

  /**
   * ==========================================================
   * COORDENADAS
   * ==========================================================
   */
  private async obtenerCoordenadas(
    ubicacion: Ubicacion,
  ): Promise<{
    latitud: number;
    longitud: number;
  }> {
    /**
     * Si ya tenemos coordenadas,
     * no necesitamos geocoding.
     */
    if (
      ubicacion.tipo ===
      "coordenadas"
    ) {
      return {
        latitud: ubicacion.latitud,
        longitud: ubicacion.longitud,
      };
    }

    /**
     * Si tenemos ciudad,
     * usamos Geocoding.
     */
    return this.geocodificarCiudad(
      ubicacion.ciudad,
      ubicacion.pais,
    );
  }

  /**
   * ==========================================================
   * GEOCODING
   * ==========================================================
   */
  private async geocodificarCiudad(
    ciudad: string,
    pais: string,
  ): Promise<{
    latitud: number;
    longitud: number;
  }> {
    const cacheKey =
      `${ciudad.trim().toLowerCase()},` +
      `${pais.trim().toLowerCase()}`;

    /**
     * Primero buscamos en cache.
     */
    const coordenadasCacheadas =
      this.cacheGeocoding.get(
        cacheKey,
      );

    if (coordenadasCacheadas) {
      return coordenadasCacheadas;
    }

    /**
     * Construimos URL.
     */
    const url =
      new URL(this.geocodingUrl);

    url.searchParams.set(
      "q",
      `${ciudad},${pais}`,
    );

    url.searchParams.set(
      "limit",
      "1",
    );

    url.searchParams.set(
      "appid",
      this.apiKey,
    );

    /**
     * Request.
     */
    const response =
      await fetch(
        url.toString(),
      );

    if (!response.ok) {
      throw new Error(
        `Error en Geocoding de OpenWeather: ` +
        `${response.status} ${response.statusText}`,
      );
    }

    const data =
      (await response.json()) as
        OpenWeatherGeocodingResponse[];

    /**
     * No encontramos ciudad.
     */
    if (
      !data ||
      data.length === 0
    ) {
      throw new Error(
        `No se encontraron coordenadas para ` +
        `${ciudad}, ${pais}`,
      );
    }

    const resultado = {
      latitud: data[0].lat,
      longitud: data[0].lon,
    };

    /**
     * Guardamos en cache.
     */
    this.cacheGeocoding.set(
      cacheKey,
      resultado,
    );

    return resultado;
  }

  /**
   * ==========================================================
   * CLIMA ACTUAL
   * ==========================================================
   */
  private async consultarClimaActual(
    latitud: number,
    longitud: number,
  ): Promise<OpenWeatherCurrentResponse> {
    const url =
      new URL(this.currentUrl);

    url.searchParams.set(
      "lat",
      latitud.toString(),
    );

    url.searchParams.set(
      "lon",
      longitud.toString(),
    );

    url.searchParams.set(
      "appid",
      this.apiKey,
    );

    /**
     * Temperatura en Celsius.
     */
    url.searchParams.set(
      "units",
      "metric",
    );

    /**
     * Descripción en español.
     */
    url.searchParams.set(
      "lang",
      "es",
    );

    const response =
      await fetch(
        url.toString(),
      );

    if (!response.ok) {
      throw new Error(
        `Error consultando clima actual de OpenWeather: ` +
        `${response.status} ${response.statusText}`,
      );
    }

    return (await response.json()) as
      OpenWeatherCurrentResponse;
  }

  /**
   * ==========================================================
   * PRONÓSTICO
   * ==========================================================
   */
  private async consultarPronostico(
    latitud: number,
    longitud: number,
  ): Promise<OpenWeatherForecastResponse> {
    const url =
      new URL(this.forecastUrl);

    url.searchParams.set(
      "lat",
      latitud.toString(),
    );

    url.searchParams.set(
      "lon",
      longitud.toString(),
    );

    url.searchParams.set(
      "appid",
      this.apiKey,
    );

    /**
     * Temperatura en Celsius.
     */
    url.searchParams.set(
      "units",
      "metric",
    );

    /**
     * Español.
     */
    url.searchParams.set(
      "lang",
      "es",
    );

    const response =
      await fetch(
        url.toString(),
      );

    if (!response.ok) {
      throw new Error(
        `Error consultando pronóstico de OpenWeather: ` +
        `${response.status} ${response.statusText}`,
      );
    }

    return (await response.json()) as
      OpenWeatherForecastResponse;
  }

  /**
   * ==========================================================
   * BUSCAR PRONÓSTICO MÁS CERCANO
   * ==========================================================
   */
  private buscarPronosticoMasCercano(
    pronosticos:
      OpenWeatherForecastItem[],
    fechaObjetivo: Date,
  ): OpenWeatherForecastItem {
    if (
      pronosticos.length === 0
    ) {
      throw new Error(
        "OpenWeather no devolvió pronóstico.",
      );
    }

    let pronosticoMasCercano =
      pronosticos[0];

    let diferenciaMinima =
      Math.abs(
        pronosticos[0].dt * 1000 -
          fechaObjetivo.getTime(),
      );

    for (
      const pronostico of pronosticos
    ) {
      const diferencia =
        Math.abs(
          pronostico.dt * 1000 -
            fechaObjetivo.getTime(),
        );

      if (
        diferencia <
        diferenciaMinima
      ) {
        diferenciaMinima =
          diferencia;

        pronosticoMasCercano =
          pronostico;
      }
    }

    return pronosticoMasCercano;
  }

  /**
   * ==========================================================
   * MAPEAR CLIMA ACTUAL
   * ==========================================================
   */
  private mapearClimaActual(
    current:
      OpenWeatherCurrentResponse,
  ): ClimaActualDto {
    return {
      temperatura:
        current.main.temp,

      condicion:
        this.mapearCondicion(
          current.weather[0]?.id,
        ),

      /**
       * OpenWeather devuelve viento
       * en m/s cuando utilizamos units=metric.
       *
       * Por lo tanto NO dividimos por 3.6.
       */
      viento:
        current.wind.speed,

      humedad:
        current.main.humidity,
    };
  }

  /**
   * ==========================================================
   * MAPEAR PRONÓSTICO DE ACTIVIDAD
   * ==========================================================
   */
  private mapearPronosticoActividad(
    hora:
      OpenWeatherForecastItem,
  ): PronosticoActividadDto {
    return {
      /**
       * OpenWeather:
       *
       * pop = 0.0 - 1.0
       *
       * Nuestro dominio:
       *
       * 0 - 100
       */
      probabilidad_lluvia:
        this.convertirProbabilidadLluvia(
          hora.pop,
        ),

      temperatura:
        hora.main.temp,

      /**
       * OpenWeather + units=metric
       * devuelve m/s.
       */
      viento:
        hora.wind.speed,

      condicion:
        this.mapearCondicion(
          hora.weather[0]?.id,
        ),
    };
  }

  /**
   * ==========================================================
   * MAPEAR PRONÓSTICO HORARIO
   * ==========================================================
   */
  private mapearPronosticoHora(
    hora:
      OpenWeatherForecastItem,
  ): PronosticoHora {
    const fecha =
      new Date(
        hora.dt * 1000,
      );

    return {
      fecha:
        fecha.toISOString(),

      probabilidad_lluvia:
        this.convertirProbabilidadLluvia(
          hora.pop,
        ),

      temperatura:
        hora.main.temp,

      viento:
        hora.wind.speed,
    };
  }

  /**
   * ==========================================================
   * PROBABILIDAD DE LLUVIA
   * ==========================================================
   *
   * OpenWeather devuelve:
   *
   * 0.00 = 0%
   * 0.25 = 25%
   * 0.70 = 70%
   * 1.00 = 100%
   */
  private convertirProbabilidadLluvia(
    probabilidad: number,
  ): number {
    return Math.round(
      probabilidad * 100,
    );
  }

  /**
   * ==========================================================
   * MAPEAR CONDICIÓN METEOROLÓGICA
   * ==========================================================
   *
   * Nuestro dominio:
   *
   * SOLEADO
   * NUBLADO
   * PARCIALMENTE_NUBLADO
   * LLUVIA
   * TORMENTA
   */
  private mapearCondicion(
    weatherId:
      | number
      | undefined,
  ):
    | "SOLEADO"
    | "NUBLADO"
    | "PARCIALMENTE_NUBLADO"
    | "LLUVIA"
    | "TORMENTA" {
    if (
      weatherId === undefined
    ) {
      return "NUBLADO";
    }

    /**
     * 2xx = tormenta.
     */
    if (
      weatherId >= 200 &&
      weatherId < 300
    ) {
      return "TORMENTA";
    }

    /**
     * 3xx = llovizna.
     *
     * 5xx = lluvia.
     */
    if (
      (
        weatherId >= 300 &&
        weatherId < 400
      ) ||
      (
        weatherId >= 500 &&
        weatherId < 600
      )
    ) {
      return "LLUVIA";
    }

    /**
     * 6xx = nieve.
     *
     * Nuestro dominio no contempla nieve,
     * por lo que la tratamos como nublado.
     */
    if (
      weatherId >= 600 &&
      weatherId < 700
    ) {
      return "NUBLADO";
    }

    /**
     * 7xx = niebla, humo, polvo, etc.
     */
    if (
      weatherId >= 700 &&
      weatherId < 800
    ) {
      return "NUBLADO";
    }

    /**
     * 800 = cielo despejado.
     */
    if (
      weatherId === 800
    ) {
      return "SOLEADO";
    }

    /**
     * 801 = pocas nubes.
     */
    if (
      weatherId === 801
    ) {
      return "PARCIALMENTE_NUBLADO";
    }

    /**
     * 802-804 = nublado.
     */
    if (
      weatherId >= 802 &&
      weatherId <= 804
    ) {
      return "NUBLADO";
    }

    return "NUBLADO";
  }

  /**
   * ==========================================================
   * NOMBRE DE UBICACIÓN
   * ==========================================================
   */
  private obtenerNombreUbicacion(
    ubicacion: Ubicacion,
  ): string {
    if (
      ubicacion.tipo === "ciudad"
    ) {
      return (
        `${ubicacion.ciudad}, ` +
        `${ubicacion.pais}`
      );
    }

    if (
      ubicacion.direccion
    ) {
      return ubicacion.direccion;
    }

    return (
      `${ubicacion.latitud}, ` +
      `${ubicacion.longitud}`
    );
  }
}
