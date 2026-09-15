import { Actividad, NuevaActividad, ReglasClima, DatosCreacionActividad } from '../interfaces/models/actividad';
import { ActividadRepository } from '../interfaces/repositories/actividadRepository';
import { BuscarActividadesDto, PaginacionDto } from '../dtos/busquedaDto';
import {IEstadisticasStore} from "../utils/IEstadisticasStore";

export type ConfigurarReglasResult =
  | { status: 'not_found' }
  | { status: 'forbidden' }
  | { status: 'updated'; actividad: Actividad };

export type InscribirParticipanteResult =
  | { status: 'created'; actividad: Actividad }
  | { status: 'not_found' }
  | { status: 'already_participating' }
  | { status: 'full' };

export type RemoverParticipanteResult =
  | { status: 'removed'; actividad: Actividad }
  | { status: 'not_found' }
  | { status: 'not_participating' }
  | { status: 'organizer_cannot_leave' };

export class ActividadesService {
  constructor(private readonly repository: ActividadRepository, private statsStore: IEstadisticasStore) {}

  async crearActividad(datos: DatosCreacionActividad, creadorId: string): Promise<Actividad> {
    const actividadParaGuardar: NuevaActividad = {
      ...datos,
      creadorId,
      creadaEn: new Date().toISOString(),
      estado: 'PROPUESTA',
      participantes: [creadorId],
    };
    await this.statsStore.incrementar('Actividad_Creada');
    return this.repository.create(actividadParaGuardar);
  }

  // Ahora retorna directamente la promesa con { data, total }
  async buscarActividades(filtros: BuscarActividadesDto): Promise<{ data: Actividad[], total: number }> {
    return this.repository.findAll(filtros);
  }

  /** Recupera una actividad por su id, incluso si está llena y no figura en la búsqueda. */
  async buscarPorId(actividadId: string): Promise<Actividad | undefined> {
    return this.repository.findById(actividadId);
  }

  // Recibe la paginación, busca, extrae el total, y solo mapea el array "data"
  async obtenerDashboardUsuario(userId: string, paginacion: PaginacionDto) {
    const result = await this.repository.findDashboardByUser(userId, paginacion);

    const mappedData = result.data.map(a => ({
      id: a.id,
      titulo: a.titulo,
      fecha_horario: a.fecha_horario,
      rol: a.creadorId === userId ? 'organizador' : 'participante',
      estado: a.estado,
      votacion_abierta: a.estado === 'EN_VOTACION'
    }));

    return { data: mappedData, total: result.total };
  }

  async configurarReglasClima(actividadId: string, reglasClima: ReglasClima, solicitanteId: string): Promise<ConfigurarReglasResult> {
    const actividad = await this.repository.findById(actividadId);
    if (!actividad) return { status: 'not_found' };
    if (actividad.creadorId !== solicitanteId) return { status: 'forbidden' };

    const updated = await this.repository.update({ ...actividad, reglasClima });
    return updated ? { status: 'updated', actividad: updated } : { status: 'not_found' };
  }

  async inscribirParticipante(actividadId: string, userId: string): Promise<InscribirParticipanteResult> {
    const actividad = await this.repository.findById(actividadId);
    if (!actividad) return { status: 'not_found' };
    if (actividad.participantes.includes(userId)) return { status: 'already_participating' };
    if (actividad.participantes.length >= actividad.max_participantes) return { status: 'full' };

    const updated = await this.repository.update({
      ...actividad,
      participantes: [...actividad.participantes, userId],
    });
    if (!updated) return { status: 'not_found' };
    return { status: 'created', actividad: updated };
  }

  async removerParticipante(actividadId: string, userId: string): Promise<RemoverParticipanteResult> {
    const actividad = await this.repository.findById(actividadId);
    if (!actividad) return { status: 'not_found' };
    if (actividad.creadorId === userId) return { status: 'organizer_cannot_leave' };
    if (!actividad.participantes.includes(userId)) return { status: 'not_participating' };

    const updated = await this.repository.update({
      ...actividad,
      participantes: actividad.participantes.filter((participante) => participante !== userId),
    });
    if (!updated) return { status: 'not_found' };
    return { status: 'removed', actividad: updated };
  }
}