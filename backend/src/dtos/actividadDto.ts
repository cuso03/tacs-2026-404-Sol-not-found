import { z } from 'zod';

const ubicacionSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('ciudad'), ciudad: z.string().trim().min(1).max(150), pais: z.string().trim().min(2).max(100) }).strict(),
  z.object({
    tipo: z.literal('coordenadas'), latitud: z.number().finite().min(-90).max(90), longitud: z.number().finite().min(-180).max(180),
    direccion: z.string().trim().min(1).max(250).optional(),
  }).strict(),
]);

/** Valida el payload público para dar de alta una actividad. */
export const crearActividadSchema = z.object({
  titulo: z.string().trim().min(1).max(150),
  descripcion: z.string().trim().min(1).max(2_000),
  tipo: z.enum(['aire_libre', 'techada', 'mixta']),
  ubicacion: ubicacionSchema,
  fecha_horario: z.iso.datetime({ offset: true }),
  min_participantes: z.number().int().positive(),
  max_participantes: z.number().int().positive(),
}).strict().refine((actividad) => actividad.max_participantes >= actividad.min_participantes, {
  message: 'max_participantes debe ser mayor o igual a min_participantes', path: ['max_participantes'],
});

export type CrearActividadDto = z.infer<typeof crearActividadSchema>;
