import { randomUUID } from 'node:crypto';
import { Actividad, NuevaActividad } from '../interfaces/models/actividad';
import { ActividadRepository } from '../interfaces/repositories/actividadRepository';

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
      estado: 'programada',
      participantes: [],
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

  /** Reemplaza una actividad existente y devuelve una copia del nuevo estado. */
  async update(actividad: Actividad): Promise<Actividad | undefined> {
    if (!this.actividades.has(actividad.id)) return undefined;
    const persisted = this.copy(actividad);
    this.actividades.set(persisted.id, persisted);
    return this.copy(persisted);
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
