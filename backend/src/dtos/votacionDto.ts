import { z } from 'zod';

export const abrirVotacionSchema = z
  .object({
    alternativas: z
      .array(
        z
          .object({
            fecha_horario: z.iso.datetime({ offset: true }),
          })
          .strict(),
      )
      .min(1)
      .optional(),
    duracion_horas: z.number().int().min(1).max(168).default(24),
  })
  .strict();

export type AbrirVotacionDto = z.infer<typeof abrirVotacionSchema>;

/** Body válido para cerrar una votación: solicita la transición ABIERTA → CERRADA. */
export const cerrarVotacionSchema = z
  .object({
    estado: z.literal('CERRADA'),
  })
  .strict();

export type CerrarVotacionDto = z.infer<typeof cerrarVotacionSchema>;

/** Body válido para emitir o reemplazar el voto propio (PUT idempotente). */
export const emitirVotoSchema = z
  .object({
    alternativa_id: z.string().min(1),
  })
  .strict();

export type EmitirVotoDto = z.infer<typeof emitirVotoSchema>;
