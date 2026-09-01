import { Ubicacion } from "../interfaces/models/actividad";
import { PronosticoHora } from "../interfaces/models/pronostico";
import {
  ClimaResponseDto,
  ClimaActualDto,
  PronosticoActividadDto,
} from "../dtos/climaDto";
import { IWeatherProvider } from "../interfaces/services/IWeatherProvider";

/**
 * Respuesta de la API de Forecast de Open-Meteo.
 */
interface OpenMeteoForecastResponse {
  current: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    weather_code: number;
  };

  hourly: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m?: number[];
    precipitation_probability: number[];
    wind_speed_10m: number[];
    weather_code: number[];
  };
}

/**
 * Respuesta de la API de Geocoding de Open-Meteo.
 */
interface OpenMeteoGeocodingResponse {
  results?: OpenMeteoGeocodingResult[];
}

/**
 * Resultado individual de una búsqueda de ciudad.
 */
interface OpenMeteoGeocodingResult {
  latitude: number;
  longitude: number;
  name: string;
  country: string;
}

/**
 * Coordenadas utilizadas internamente por el adapter.
 */
interface Coordenadas {
  latitud: number;
  longitud: number;
}

/**
 * Se encarga de:
 *
 * - Resolver ubicaciones por coordenadas.
 * - Geocodificar ubicaciones por ciudad.
 * - Consultar el pronóstico.
 * - Transformar la respuesta de Open-Meteo
 *   a los modelos propios de la aplicación.
 */
export class OpenMeteoAdapter implements IWeatherProvider {
  private readonly forecastUrl =
    "https://api.open-meteo.com/v1/forecast";

  private readonly geocodingUrl =
    "https://geocoding-api.open-meteo.com/v1/search";

  /**
   * Cache simple de coordenadas.
   *
   * Evita consultar Geocoding repetidamente
   * para la misma ciudad.
   */
  private readonly cacheGeocoding =
    new Map<string, Coordenadas>();

  /**
   * Obtiene clima actual y pronóstico
   * para la fecha/hora de una actividad.
   */
  async getClima(
    ubicacion: Ubicacion,
    fecha_horario: string
  ): Promise<ClimaResponseDto> {
    const coordenadas =
      await this.resolverUbicacion(ubicacion);

    const fecha = new Date(fecha_horario);

    if (Number.isNaN(fecha.getTime())) {
      throw new Error(
        `Fecha inválida: ${fecha_horario}`
      );
    }

    const fechaInicio =
      this.formatearFecha(fecha);

    const fechaFin =
      this.formatearFecha(fecha);

    const params = new URLSearchParams({
      latitude: coordenadas.latitud.toString(),
      longitude: coordenadas.longitud.toString(),

      current: [
        "temperature_2m",
        "relative_humidity_2m",
        "wind_speed_10m",
        "weather_code",
      ].join(","),

      hourly: [
        "temperature_2m",
        "precipitation_probability",
        "wind_speed_10m",
        "weather_code",
      ].join(","),

      start_date: fechaInicio,
      end_date: fechaFin,

      timezone: "auto",
    });

    const data =
      await this.requestForecast(params);

    const climaActual: ClimaActualDto = {
      temperatura:
        data.current.temperature_2m,

      condicion:
        this.mapCondicion(
          data.current.weather_code
        ),

      viento:
        data.current.wind_speed_10m,

      humedad:
        data.current.relative_humidity_2m,
    };

    const indice =
      this.buscarHoraMasCercana(
        data.hourly.time,
        fecha
      );

    const pronosticoActividad: PronosticoActividadDto =
      {
        probabilidad_lluvia:
          data.hourly
            .precipitation_probability[indice],

        temperatura:
          data.hourly.temperature_2m[indice],

        viento:
          data.hourly.wind_speed_10m[indice],

        condicion:
          this.mapCondicion(
            data.hourly.weather_code[indice]
          ),
      };

    return {
      ubicacion:
        this.descripcionUbicacion(ubicacion),

      fecha_horario,

      clima_actual: climaActual,

      pronostico_actividad:
        pronosticoActividad,
    };
  }

  /**
   * Obtiene el pronóstico hora a hora
   * desde fechaDesde durante determinada
   * cantidad de días.
   */
  async obtenerPronostico(
    ubicacion: Ubicacion,
    fechaDesde: string,
    dias: number
  ): Promise<PronosticoHora[]> {
    if (dias <= 0) {
      throw new Error(
        "La cantidad de días debe ser mayor a 0"
      );
    }

    const fechaInicio =
      new Date(fechaDesde);

    if (
      Number.isNaN(
        fechaInicio.getTime()
      )
    ) {
      throw new Error(
        `Fecha inválida: ${fechaDesde}`
      );
    }

    const fechaFin =
      this.sumarDias(
        fechaInicio,
        dias - 1
      );

    const coordenadas =
      await this.resolverUbicacion(ubicacion);

    const params = new URLSearchParams({
      latitude:
        coordenadas.latitud.toString(),

      longitude:
        coordenadas.longitud.toString(),

      hourly: [
        "temperature_2m",
        "precipitation_probability",
        "wind_speed_10m",
      ].join(","),

      start_date:
        this.formatearFecha(fechaInicio),

      end_date:
        this.formatearFecha(fechaFin),

      timezone: "auto",
    });

    const data =
      await this.requestForecast(params);

    return data.hourly.time.map(
      (fecha, indice): PronosticoHora => ({
        fecha,

        probabilidad_lluvia:
          data.hourly
            .precipitation_probability[indice],

        temperatura:
          data.hourly
            .temperature_2m[indice],

        viento:
          data.hourly
            .wind_speed_10m[indice]/3.6,
      })
    );
  }

  /**
   * Resuelve cualquier tipo de Ubicacion
   * de tu dominio.
   *
   * - Coordenadas: se utilizan directamente.
   * - Ciudad: se consulta Geocoding.
   */
  private async resolverUbicacion(
    ubicacion: Ubicacion
  ): Promise<Coordenadas> {
    if (ubicacion.tipo === "coordenadas") {
      return {
        latitud: ubicacion.latitud,
        longitud: ubicacion.longitud,
      };
    }

    return this.geocodificarCiudad(
      ubicacion.ciudad,
      ubicacion.pais
    );
  }

  /**
   * Convierte ciudad + país en coordenadas
   * utilizando el Geocoding API de Open-Meteo.
   */
  private async geocodificarCiudad(
    ciudad: string,
    pais: string
  ): Promise<Coordenadas> {
    const cacheKey =
      `${ciudad.trim().toLowerCase()}|` +
      `${pais.trim().toLowerCase()}`;

    const cached =
      this.cacheGeocoding.get(cacheKey);

    if (cached) {
      return cached;
    }

    const params = new URLSearchParams({
      name: ciudad,
      count: "10",
      language: "es",
      format: "json",
    });

    const response =
      await fetch(
        `${this.geocodingUrl}?${params}`
      );

    if (!response.ok) {
      throw new Error(
        `Error consultando Geocoding de Open-Meteo: ` +
        `${response.status} ${response.statusText}`
      );
    }

    const data =
      (await response.json()) as
        OpenMeteoGeocodingResponse;

    if (
      !data.results ||
      data.results.length === 0
    ) {
      throw new Error(
        `No se encontró la ciudad ` +
        `"${ciudad}, ${pais}"`
      );
    }

    const resultado =
      this.buscarResultadoPais(
        data.results,
        pais
      );

    if (!resultado) {
      throw new Error(
        `No se encontró "${ciudad}" ` +
        `en el país "${pais}"`
      );
    }

    const coordenadas: Coordenadas = {
      latitud: resultado.latitude,
      longitud: resultado.longitude,
    };

    this.cacheGeocoding.set(
      cacheKey,
      coordenadas
    );

    return coordenadas;
  }

  /**
   * Intenta encontrar un resultado cuyo país
   * coincida con el solicitado.
   *
   * Si no hay coincidencia exacta,
   * devuelve el primer resultado.
   */
  private buscarResultadoPais(
    resultados: OpenMeteoGeocodingResult[],
    pais: string
  ): OpenMeteoGeocodingResult | undefined {
    const paisNormalizado =
      this.normalizarTexto(pais);

    return (
      resultados.find(
        (resultado) =>
          this.normalizarTexto(
            resultado.country
          ) === paisNormalizado
      ) ??
      resultados[0]
    );
  }

  /**
   * Realiza la consulta a Forecast API.
   */
  private async requestForecast(
    params: URLSearchParams
  ): Promise<OpenMeteoForecastResponse> {
    const response =
      await fetch(
        `${this.forecastUrl}?${params}`
      );

    if (!response.ok) {
      throw new Error(
        `Error consultando Open-Meteo: ` +
        `${response.status} ${response.statusText}`
      );
    }

    return (
      await response.json()
    ) as OpenMeteoForecastResponse;
  }

  /**
   * Traduce los weather_code de Open-Meteo
   * a las condiciones aceptadas por tu dominio.
   */
  private mapCondicion(
    weatherCode: number
  ) {
    // Cielo despejado
    if (weatherCode === 0) {
      return "SOLEADO" as const;
    }

    // Principalmente despejado,
    // parcialmente nublado
    if (
      [1, 2].includes(weatherCode)
    ) {
      return "PARCIALMENTE_NUBLADO" as const;
    }

    // Niebla y cielo cubierto
    if (
      [3, 45, 48].includes(weatherCode)
    ) {
      return "NUBLADO" as const;
    }

    // Llovizna, lluvia y showers
    if (
      [
        51,
        53,
        55,
        56,
        57,
        61,
        63,
        65,
        66,
        67,
        80,
        81,
        82,
      ].includes(weatherCode)
    ) {
      return "LLUVIA" as const;
    }

    // Tormentas
    if (
      [95, 96, 99].includes(weatherCode)
    ) {
      return "TORMENTA" as const;
    }

    // Fallback
    return "NUBLADO" as const;
  }

  /**
   * Busca la hora del pronóstico más cercana
   * a la fecha solicitada.
   */
  private buscarHoraMasCercana(
    horas: string[],
    fechaObjetivo: Date
  ): number {
    if (horas.length === 0) {
      throw new Error(
        "Open-Meteo no devolvió horas de pronóstico"
      );
    }

    let mejorIndice = 0;
    let menorDiferencia = Infinity;

    for (
      let i = 0;
      i < horas.length;
      i++
    ) {
      const fechaHora =
        new Date(horas[i]);

      const diferencia =
        Math.abs(
          fechaHora.getTime() -
          fechaObjetivo.getTime()
        );

      if (
        diferencia <
        menorDiferencia
      ) {
        menorDiferencia = diferencia;
        mejorIndice = i;
      }
    }

    return mejorIndice;
  }

  /**
   * Suma días manteniendo la fecha calendario.
   */
  private sumarDias(
    fecha: Date,
    dias: number
  ): Date {
    const resultado =
      new Date(fecha);

    resultado.setDate(
      resultado.getDate() + dias
    );

    return resultado;
  }

  /**
   * Formatea una fecha como YYYY-MM-DD,
   * que es el formato utilizado por
   * start_date/end_date de Open-Meteo.
   */
  private formatearFecha(
    fecha: Date
  ): string {
    const year =
      fecha.getFullYear();

    const month =
      String(
        fecha.getMonth() + 1
      ).padStart(2, "0");

    const day =
      String(
        fecha.getDate()
      ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  /**
   * Descripción legible de una ubicación
   * para el DTO de respuesta.
   */
  private descripcionUbicacion(
    ubicacion: Ubicacion
  ): string {
    if (
      ubicacion.tipo === "ciudad"
    ) {
      return `${ubicacion.ciudad}, ${ubicacion.pais}`;
    }

    return (
      ubicacion.direccion ??
      `${ubicacion.latitud}, ${ubicacion.longitud}`
    );
  }

  /**
   * Normaliza texto para comparar países.
   */
  private normalizarTexto(
    texto: string
  ): string {
    return texto
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .trim()
      .toLowerCase();
  }
}