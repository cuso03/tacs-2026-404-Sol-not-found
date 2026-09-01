import { Request, Response } from 'express';
import { ActividadesService } from '../services/actividadesService';
import { paginacionSchema } from '../dtos/busquedaDto';

export function createUsuariosController(service: ActividadesService) {
  async function getDashboard(req: Request, res: Response): Promise<void> {
    const parsed = paginacionSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Parámetros de paginación inválidos', details: parsed.error.issues });
      return;
    }

    const { data, total } = await service.obtenerDashboardUsuario(req.userId!, parsed.data);
    
    res.status(200).json({
      data,
      meta: {
        total,
        page: parsed.data.page,
        limit: parsed.data.limit,
        totalPages: Math.ceil(total / parsed.data.limit)
      }
    });
  }

  return { getDashboard };
}