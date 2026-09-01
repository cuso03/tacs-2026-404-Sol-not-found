import { Request, Response } from 'express';
import { ClimaService } from '../services/climaService';

/** Crea el controlador de consulta de clima por ID de actividad. */
export function createClimaController(service: ClimaService) {
  /** GET /api/actividades/:id/clima — devuelve clima actual y pronóstico para la actividad. */
  async function getClima(req: Request, res: Response): Promise<void> {
    const actividadId = req.params.id;
    if (typeof actividadId !== 'string') {
      res.status(404).json({ error: 'Actividad no encontrada' });
      return;
    }

    const result = await service.consultarClima(actividadId);
    if (result.status === 'not_found') {
      res.status(404).json({ error: 'Actividad no encontrada' });
      return;
    }
    if (result.status === 'weather_unavailable') {
      res.status(503).json({ error: 'Servicio de clima no disponible' });
      return;
    }

    res.status(200).json(result.data);
  }

  return { getClima };
}
