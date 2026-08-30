import { Actividad, NuevaActividad, ReglasClima } from '../interfaces/models/actividad';
import {
  ActividadRepository,
  InscribirParticipanteResult,
  RemoverParticipanteResult,
} from '../interfaces/repositories/actividadRepository';

/** Resultado posible al intentar configurar reglas para una actividad. */
export type ConfigurarReglasResult =
  | { status: 'not_found' }
  | { status: 'forbidden' }
  | { status: 'updated'; actividad: Actividad };

/**
 * Contiene los casos de uso de actividades independientes del protocolo HTTP.
 * Se inyecta un repositorio, por lo que sus métodos se prueban sin Express ni
 * una fuente de persistencia externa.
 */
export class ActividadesService {
  constructor(private readonly repository: ActividadRepository) {}

  /** Crea una actividad y delega la generación de su id al repositorio. */
  async crearActividad(datos: Omit<NuevaActividad, 'creadorId' | 'creadaEn' | 'participantes'>, creadorId: string): Promise<Actividad> {
    return this.repository.create({ ...datos, creadorId, creadaEn: new Date().toISOString(), participantes: [creadorId] });
  }

  /**
   * Asocia reglas climáticas a una actividad si el solicitante es su organizador.
   * La autorización se mantiene aquí para que no dependa del adaptador HTTP.
   */
  async configurarReglasClima(actividadId: string, reglasClima: ReglasClima, solicitanteId: string): Promise<ConfigurarReglasResult> {
    const actividad = await this.repository.findById(actividadId);
    if (!actividad) return { status: 'not_found' };
    if (actividad.creadorId !== solicitanteId) return { status: 'forbidden' };

    const updated = await this.repository.update({ ...actividad, reglasClima });
    return updated ? { status: 'updated', actividad: updated } : { status: 'not_found' };
  }

  async inscribirParticipante(actividadId: string, userId: string): Promise<InscribirParticipanteResult> {
    return this.repository.addParticipant(actividadId, userId);
  }

  async removerParticipante(actividadId: string, userId: string): Promise<RemoverParticipanteResult> {
    return this.repository.removeParticipant(actividadId, userId);
  }
}
