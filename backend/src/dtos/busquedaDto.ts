import { z } from 'zod';
import { TIPOS_ACTIVIDAD } from '../interfaces/models/actividad';

export const buscarActividadesSchema = z.object({
  tipo: z.enum(TIPOS_ACTIVIDAD).optional(),
  fecha_desde: z.string().datetime({ offset: true }).optional(),
  ubicacion: z.string().trim().min(1).optional(),
});

export type BuscarActividadesDto = z.infer<typeof buscarActividadesSchema>;