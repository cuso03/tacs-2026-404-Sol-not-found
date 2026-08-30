import { Request, Response } from 'express';
import { ActividadesService } from '../../services/actividadesService';

export function createUsuariosController(service: ActividadesService) {
  async function getDashboard(req: Request, res: Response): Promise<void> {
    const actividades = await service.obtenerDashboardUsuario(req.userId!);
    res.status(200).json(actividades);
  }

  return { getDashboard };
}