import { Request, Response } from 'express';
import { crearActividadSchema } from '../../dtos/actividadDto';
import { reglasClimaSchema } from '../../dtos/reglasClimaDto';
import { ActividadesService } from '../../services/actividadesService';
import { buscarActividadesSchema } from '../../dtos/busquedaDto';

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

    const actividadId = req.params.id;
    if (typeof actividadId !== 'string') {
      res.status(404).json({ error: 'Actividad no encontrada' });
      return;
    }

    const result = await service.configurarReglasClima(actividadId, parsed.data, req.userId!);
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

  async function addParticipant(req: Request, res: Response): Promise<void> {
    const actividadId = req.params.id;
    if (typeof actividadId !== 'string') {
      res.status(404).json({ error: 'ACTIVITY_NOT_FOUND', message: 'Actividad no encontrada.' });
      return;
    }

    const result = await service.inscribirParticipante(actividadId, req.userId!);
    if (result.status === 'not_found') {
      res.status(404).json({ error: 'ACTIVITY_NOT_FOUND', message: 'Actividad no encontrada.' });
      return;
    }
    if (result.status === 'already_participating') {
      res.status(400).json({ error: 'ALREADY_PARTICIPATING', message: 'El usuario ya participa en la actividad.' });
      return;
    }
    if (result.status === 'full') {
      res.status(400).json({ error: 'ACTIVITY_FULL', message: 'La actividad alcanzó su cupo máximo.' });
      return;
    }
    res.status(201).json(result.actividad);
  }

  async function removeParticipant(req: Request, res: Response): Promise<void> {
    const actividadId = req.params.id;
    if (typeof actividadId !== 'string') {
      res.status(404).json({ error: 'ACTIVITY_NOT_FOUND', message: 'Actividad no encontrada.' });
      return;
    }

    const result = await service.removerParticipante(actividadId, req.userId!);
    if (result.status === 'not_found') {
      res.status(404).json({ error: 'ACTIVITY_NOT_FOUND', message: 'Actividad no encontrada.' });
      return;
    }
    if (result.status === 'not_participating') {
      res.status(400).json({ error: 'NOT_PARTICIPATING', message: 'El usuario no participa en la actividad.' });
      return;
    }
    if (result.status === 'organizer_cannot_leave') {
      res.status(400).json({ error: 'ORGANIZER_CANNOT_LEAVE', message: 'El organizador no puede darse de baja.' });
      return;
    }
    res.status(200).json(result.actividad);
  }

  /** Endpoint diagnóstico conservado para consultar el estado de la API. */
  async function search(req: Request, res: Response): Promise<void> {
    const parsed = buscarActividadesSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Parámetros de búsqueda inválidos', details: parsed.error.issues });
      return;
    }
    const resultados = await service.buscarActividades(parsed.data);
    res.status(200).json(resultados);
  }

  return { create, configureRules, addParticipant, removeParticipant, search };
}
