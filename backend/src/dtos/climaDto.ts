import { z } from 'zod';

/** Condiciones climáticas permitidas — SOLEADO, NUBLADO, PARCIALMENTE_NUBLADO, LLUVIA y TORMENTA (en mayúsculas). */
const condicionSchema = z.enum(['SOLEADO', 'NUBLADO', 'PARCIALMENTE_NUBLADO', 'LLUVIA', 'TORMENTA']);

/** Clima actual — debe incluir humedad. */
export const climaActualSchema = z
  .object({
    temperatura: z.number().finite(),
    condicion: condicionSchema,
    viento: z.number().finite().min(0),
    humedad: z.number().finite().min(0).max(100),
  })
  .strict();

/** Pronóstico para la hora de la actividad — sin humedad, con probabilidad_lluvia. */
export const pronosticoActividadSchema = z
  .object({
    probabilidad_lluvia: z.number().finite().min(0).max(100),
    temperatura: z.number().finite(),
    viento: z.number().finite().min(0),
    condicion: condicionSchema,
  })
  .strict();

/** Consulta de clima — ubicación, fecha/horario, clima actual y pronóstico para la actividad. */
export const climaResponseSchema = z
  .object({
    ubicacion: z.string().trim().min(1),
    fecha_horario: z.string().trim().min(1),
    clima_actual: climaActualSchema,
    pronostico_actividad: pronosticoActividadSchema,
  })
  .strict();

export const weatherForecastSchema = z
  .object({
    ubicacion: z.string().trim().min(1),
    fecha_horario: z.string().trim().min(1),
    probabilidad_lluvia: z.number().finite().min(0).max(100),
    temperatura: z.number().finite(),
    viento: z.number().finite().min(0),
    condicion: condicionSchema,
  })
  .strict();

export type ClimaActualDto = z.infer<typeof climaActualSchema>;
export type PronosticoActividadDto = z.infer<typeof pronosticoActividadSchema>;
export type ClimaResponseDto = z.infer<typeof climaResponseSchema>;
export type WeatherForecastDto = z.infer<typeof weatherForecastSchema>;
