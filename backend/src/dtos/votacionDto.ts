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
