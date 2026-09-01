import { z } from 'zod';
import { TIPOS_ACTIVIDAD } from '../interfaces/models/actividad';

export const paginacionSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const buscarActividadesSchema = paginacionSchema.extend({
  tipo: z.enum(TIPOS_ACTIVIDAD).optional(),
  fecha_desde: z.string().datetime({ offset: true }).optional(),
  ubicacion: z.string().trim().min(1).optional(),
});

export type PaginacionDto = z.infer<typeof paginacionSchema>;
export type BuscarActividadesDto = z.infer<typeof buscarActividadesSchema>;