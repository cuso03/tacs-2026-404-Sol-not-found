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
    const persisted = this.copy({ ...actividad, id: randomUUID() });
    this.actividades.set(persisted.id, persisted);
    return this.copy(persisted);
  }

  /** Busca una actividad por id sin exponer la referencia interna. */
  async findById(id: string): Promise<Actividad | undefined> {
    const actividad = this.actividades.get(id);
    return actividad ? this.copy(actividad) : undefined;
  }

  async findAll(filtros: BuscarActividadesDto): Promise<Actividad[]> {
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

    // Filtrar cupos disponibles (Preparación para Feature 4)
    resultados = resultados.filter(a => a.participantes.length < a.max_participantes);

    return resultados.map(a => this.copy(a));
  }

  async findDashboardByUser(userId: string): Promise<Actividad[]> {
    const resultados = Array.from(this.actividades.values()).filter(a => {
      const esCreador = a.creadorId === userId;
      const esParticipante = a.participantes.includes(userId);
      return esCreador || esParticipante;
    });
    return resultados.map(a => this.copy(a));
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
    const copied = { ...actividad, participantes: [...actividad.participantes] };
    return actividad.reglasClima
      ? { ...copied, reglasClima: { ...actividad.reglasClima, rango_horario: { ...actividad.reglasClima.rango_horario } } }
      : copied;
  }
}
