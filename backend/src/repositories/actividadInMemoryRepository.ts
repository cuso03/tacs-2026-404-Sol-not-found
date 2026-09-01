import { randomUUID } from 'node:crypto';
import { Actividad, NuevaActividad } from '../interfaces/models/actividad';
import {
  ActividadRepository,
  InscribirParticipanteResult,
  RemoverParticipanteResult,
} from '../interfaces/repositories/actividadRepository';
import { BuscarActividadesDto } from '../dtos/busquedaDto';

/**
 * Persistencia transitoria de actividades para desarrollo y pruebas.
 * Cada instancia posee su propio almacenamiento y se descarta al reiniciar.
 */
export class ActividadInMemoryRepository implements ActividadRepository {
  private readonly actividades = new Map<string, Actividad>();

  /** Genera el id y guarda una nueva actividad usando ese id como clave. */
  async create(actividad: NuevaActividad): Promise<Actividad> {
    const nueva: Actividad = {
      ...actividad,
      id: randomUUID(),
      votaciones: [],
    };
    const persisted = this.copy(nueva);
    this.actividades.set(persisted.id, persisted);
    return this.copy(persisted);
  }

  /** Busca una actividad por id sin exponer la referencia interna. */
  async findById(id: string): Promise<Actividad | undefined> {
    const actividad = this.actividades.get(id);
    return actividad ? this.copy(actividad) : undefined;
  }

  async findAll(filtros: BuscarActividadesDto): Promise<{ data: Actividad[], total: number }> {
    let resultados = Array.from(this.actividades.values());

    if (filtros.tipo) {
      resultados = resultados.filter(a => a.tipo === filtros.tipo);
    }
    if (filtros.fecha_desde) {
      const fechaFiltro = new Date(filtros.fecha_desde).getTime();
      resultados = resultados.filter(a => new Date(a.fecha_horario).getTime() >= fechaFiltro);
    }
    if (filtros.ubicacion) {
      const query = filtros.ubicacion.toLowerCase();
      resultados = resultados.filter(a => {
        if (a.ubicacion.tipo === 'ciudad') {
          return a.ubicacion.ciudad.toLowerCase().includes(query);
        }
        if (a.ubicacion.tipo === 'coordenadas' && a.ubicacion.direccion) {
          return a.ubicacion.direccion.toLowerCase().includes(query);
        }
        return false;
      });
    }

    resultados = resultados.filter(a => a.participantes.length < a.max_participantes);

    const total = resultados.length;
    const startIndex = (filtros.page - 1) * filtros.limit;
    const paginated = resultados.slice(startIndex, startIndex + filtros.limit);

    return { data: paginated.map(a => this.copy(a)), total };
  }

  async findDashboardByUser(userId: string, paginacion: import('../dtos/busquedaDto').PaginacionDto): Promise<{ data: Actividad[], total: number }> {
    const resultados = Array.from(this.actividades.values()).filter(a => {
      const esCreador = a.creadorId === userId;
      const esParticipante = a.participantes.includes(userId);
      return esCreador || esParticipante;
    });

    const total = resultados.length;
    const startIndex = (paginacion.page - 1) * paginacion.limit;
    const paginated = resultados.slice(startIndex, startIndex + paginacion.limit);

    return { data: paginated.map(a => this.copy(a)), total };
  }

  /** Reemplaza una actividad existente y devuelve una copia del nuevo estado. */
  async update(actividad: Actividad): Promise<Actividad | undefined> {
    if (!this.actividades.has(actividad.id)) return undefined;
    const persisted = this.copy(actividad);
    this.actividades.set(persisted.id, persisted);
    return this.copy(persisted);
  }

  async addParticipant(id: string, userId: string): Promise<InscribirParticipanteResult> {
    const actividad = this.actividades.get(id);
    if (!actividad) return { status: 'not_found' };
    if (actividad.participantes.includes(userId)) return { status: 'already_participating' };
    if (actividad.participantes.length >= actividad.max_participantes) return { status: 'full' };

    const updated = this.copy({ ...actividad, participantes: [...actividad.participantes, userId] });
    this.actividades.set(id, updated);
    return { status: 'created', actividad: this.copy(updated) };
  }

  async removeParticipant(id: string, userId: string): Promise<RemoverParticipanteResult> {
    const actividad = this.actividades.get(id);
    if (!actividad) return { status: 'not_found' };
    if (actividad.creadorId === userId) return { status: 'organizer_cannot_leave' };
    if (!actividad.participantes.includes(userId)) return { status: 'not_participating' };

    const updated = this.copy({
      ...actividad,
      participantes: actividad.participantes.filter((participante) => participante !== userId),
    });
    this.actividades.set(id, updated);
    return { status: 'removed', actividad: this.copy(updated) };
  }

  /** Crea una copia profunda de los objetos anidados mutables de la actividad. */
  private copy(actividad: Actividad): Actividad {
    const copy: Actividad = {
      ...actividad,
      participantes: [...actividad.participantes],
      votaciones: actividad.votaciones.map((v) => ({
        ...v,
        alternativas: v.alternativas.map((a) => ({ ...a })),
        votos: { ...v.votos },
      })),
    };
    if (copy.reglasClima) {
      copy.reglasClima = { ...copy.reglasClima, rango_horario: { ...copy.reglasClima.rango_horario } };
    }
    return copy;
  }
}
