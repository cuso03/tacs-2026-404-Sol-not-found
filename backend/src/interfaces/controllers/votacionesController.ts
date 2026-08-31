import { Request, Response } from 'express';
import { abrirVotacionSchema } from '../../dtos/votacionDto';
import { VotacionService } from '../../services/votacionService';

/** Construye los controladores HTTP de votaciones con sus dependencias. */
export function createVotacionesController(service: VotacionService) {
  /** Retorna fechas disponibles según pronóstico y reglas de la actividad. */
  async function getFechasDisponibles(req: Request, res: Response): Promise<void> {
    const actividadId = req.params.id;
    if (typeof actividadId !== 'string') {
      res.status(404).json({ error: 'Actividad no encontrada' });
      return;
    }

    const result = await service.obtenerFechasDisponibles(actividadId);

    if (result.status === 'not_found') {
      res.status(404).json({ error: 'Actividad no encontrada' });
      return;
    }
    if (result.status === 'no_rules') {
      res.status(400).json({ error: 'La actividad no tiene reglas climáticas configuradas' });
      return;
    }

    res.status(200).json({ fechas: result.fechas });
  }

  /** Abre una votación de reprogramación. Solo el organizador puede hacerlo. */
  async function abrirVotacion(req: Request, res: Response): Promise<void> {
    const actividadId = req.params.id;
    if (typeof actividadId !== 'string') {
      res.status(404).json({ error: 'Actividad no encontrada' });
      return;
    }

    const parsed = abrirVotacionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos de votación inválidos', details: parsed.error.issues });
      return;
    }

    const result = await service.abrirVotacion(actividadId, req.userId!, parsed.data);

    if (result.status === 'not_found') {
      res.status(404).json({ error: 'Actividad no encontrada' });
      return;
    }
    if (result.status === 'forbidden') {
      res.status(403).json({ error: 'Solo el organizador puede abrir una votación' });
      return;
    }
    if (result.status === 'already_voting') {
      res.status(409).json({ error: 'Ya existe una votación activa para esta actividad' });
      return;
    }
    if (result.status === 'no_rules') {
      res.status(400).json({ error: 'La actividad no tiene reglas climáticas configuradas' });
      return;
    }

    res.status(201).json(result.actividad);
  }

  /** Registra un voto en la votación indicada. Solo participantes inscritos. */
  async function votar(req: Request, res: Response): Promise<void> {
    const actividadId = req.params.id;
    const votacionId = req.params.votacionId;
    const alternativaId = req.params.alternativaId;
    if (typeof actividadId !== 'string' || typeof votacionId !== 'string' || typeof alternativaId !== 'string') {
      res.status(404).json({ error: 'Actividad no encontrada' });
      return;
    }

    const result = await service.votar(actividadId, votacionId, req.userId!, alternativaId);

    if (result.status === 'not_found') {
      res.status(404).json({ error: 'Actividad no encontrada' });
      return;
    }
    if (result.status === 'voting_not_found') {
      res.status(404).json({ error: 'Votación no encontrada' });
      return;
    }
    if (result.status === 'voting_closed') {
      res.status(409).json({ error: 'La votación no está abierta' });
      return;
    }
    if (result.status === 'not_participant') {
      res.status(403).json({ error: 'Solo los participantes inscritos pueden votar' });
      return;
    }
    if (result.status === 'invalid_alternative') {
      res.status(400).json({ error: 'La alternativa indicada no es válida' });
      return;
    }

    res.status(200).json(result.votacion);
  }

  /** Cierra manualmente una votación de reprogramación. Solo el organizador puede hacerlo. */
  async function cerrarVotacion(req: Request, res: Response): Promise<void> {
    const actividadId = req.params.id;
    const votacionId = req.params.votacionId;
    if (typeof actividadId !== 'string' || typeof votacionId !== 'string') {
      res.status(404).json({ error: 'Actividad no encontrada' });
      return;
    }

    const result = await service.cerrarVotacionManual(actividadId, votacionId, req.userId!);

    if (result.status === 'not_found') {
      res.status(404).json({ error: 'Actividad no encontrada' });
      return;
    }
    if (result.status === 'voting_not_found') {
      res.status(404).json({ error: 'Votación no encontrada' });
      return;
    }
    if (result.status === 'forbidden') {
      res.status(403).json({ error: 'Solo el organizador puede cerrar la votación' });
      return;
    }
    if (result.status === 'voting_closed') {
      res.status(409).json({ error: 'La votación ya está cerrada' });
      return;
    }

    res.status(200).json(result.actividad);
  }

  /** Retorna los resultados parciales de la votación indicada. */
  async function getResultados(req: Request, res: Response): Promise<void> {
    const actividadId = req.params.id;
    const votacionId = req.params.votacionId;
    if (typeof actividadId !== 'string' || typeof votacionId !== 'string') {
      res.status(404).json({ error: 'Actividad no encontrada' });
      return;
    }

    const result = await service.obtenerResultados(actividadId, votacionId);

    if (result.status === 'not_found') {
      res.status(404).json({ error: 'Actividad no encontrada' });
      return;
    }
    if (result.status === 'voting_not_found') {
      res.status(404).json({ error: 'Votación no encontrada' });
      return;
    }

    res.status(200).json({
      votacion: result.votacion,
      conteo: result.conteo,
      totalVotos: result.totalVotos,
    });
  }

  return { getFechasDisponibles, abrirVotacion, votar, cerrarVotacion, getResultados };
}
