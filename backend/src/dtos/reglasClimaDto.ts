import { z } from 'zod';

const horarioSchema = z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, 'Debe tener formato HH:mm');

/** Valida las reglas climáticas y de reprogramación de una actividad. */
export const reglasClimaSchema = z.object({
  probabilidad_lluvia_max: z.number().finite().min(0).max(100),
  temperatura_min: z.number().finite().min(-100).max(100),
  temperatura_max: z.number().finite().min(-100).max(100),
  viento_max: z.number().finite().min(0).max(500),
  horas_anticipacion: z.number().int().min(1).max(720),
  dias_max_reprogramacion: z.number().int().min(1).max(365),
  rango_horario: z.object({ horario_min: horarioSchema, horario_max: horarioSchema }).strict(),
}).strict().superRefine((reglas, ctx) => {
  if (reglas.temperatura_min > reglas.temperatura_max) {
    ctx.addIssue({ code: 'custom', path: ['temperatura_max'], message: 'temperatura_max debe ser mayor o igual a temperatura_min' });
  }
  if (reglas.rango_horario.horario_min >= reglas.rango_horario.horario_max) {
    ctx.addIssue({ code: 'custom', path: ['rango_horario', 'horario_max'], message: 'horario_max debe ser posterior a horario_min' });
  }
});

export type ReglasClimaDto = z.infer<typeof reglasClimaSchema>;
