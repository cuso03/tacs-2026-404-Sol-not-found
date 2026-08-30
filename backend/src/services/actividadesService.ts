import { Actividad, NuevaActividad, ReglasClima, DatosCreacionActividad } from '../interfaces/models/actividad';
import { ActividadRepository } from '../interfaces/repositories/actividadRepository';
import { BuscarActividadesDto } from '../dtos/busquedaDto';

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
  async crearActividad(datos: DatosCreacionActividad, creadorId: string): Promise<Actividad> {
    // Ensamblamos el objeto con los valores por defecto requeridos por el repositorio
    const actividadParaGuardar: NuevaActividad = { 
      ...datos, 
      creadorId, 
      creadaEn: new Date().toISOString(),
      estado: 'PROPUESTA', // Estado inicial según el ciclo de vida de la actividad
      participantes: [] 
    };

    return this.repository.create(actividadParaGuardar);
  }

  async buscarActividades(filtros: BuscarActividadesDto): Promise<Actividad[]> {
    return this.repository.findAll(filtros);
  }

  async obtenerDashboardUsuario(userId: string) {
    const actividades = await this.repository.findDashboardByUser(userId);
    
    // Mapeo DTO específico para el Dashboard
    return actividades.map(a => ({
      id: a.id,
      titulo: a.titulo,
      fecha_horario: a.fecha_horario,
      rol: a.creadorId === userId ? 'organizador' : 'participante',
      estado: a.estado,
      votacion_abierta: a.estado === 'EN_VOTACION' || !!a.votacionAbierta
    }));
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
}
