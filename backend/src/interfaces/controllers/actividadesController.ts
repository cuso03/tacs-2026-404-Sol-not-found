import { Request, Response } from 'express';
import { crearActividadSchema } from '../../dtos/actividadDto';
import { reglasClimaSchema } from '../../dtos/reglasClimaDto';
import { ActividadesService } from '../../services/actividadesService';

/** Construye los controladores HTTP de actividades con sus dependencias. */
export function createActividadesController(service: ActividadesService) {
  /** Valida y persiste una nueva actividad para el usuario autenticado. */
  async function create(req: Request, res: Response): Promise<void> {
    const parsed = crearActividadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos de actividad inválidos', details: parsed.error.issues });
      return;
    }
    const actividad = await service.crearActividad(parsed.data, req.userId!);
    res.status(201).json(actividad);
  }

  /** Valida, autoriza y vincula reglas de clima a una actividad existente. */
  async function configureRules(req: Request, res: Response): Promise<void> {
    const parsed = reglasClimaSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Reglas de clima inválidas', details: parsed.error.issues });
      return;
    }

    const result = await service.configurarReglasClima(req.params.id, parsed.data, req.userId!);
    if (result.status === 'not_found') {
      res.status(404).json({ error: 'Actividad no encontrada' });
      return;
    }
    if (result.status === 'forbidden') {
      res.status(403).json({ error: 'Solo el organizador puede configurar las reglas' });
      return;
    }
    res.status(200).json(result.actividad);
  }

  /** Endpoint diagnóstico conservado para consultar el estado de la API. */
  function getActividades(_req: Request, res: Response): void {
    res.status(200).json({ mensaje: '¡El backend de TACS está funcionando perfectamente!', actividades: [] });
  }

  return { create, configureRules, getActividades };
}
