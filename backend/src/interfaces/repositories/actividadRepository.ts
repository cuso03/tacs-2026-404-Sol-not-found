import { Actividad, NuevaActividad } from '../models/actividad';
import { Repository } from './repository';
import { BuscarActividadesDto, PaginacionDto } from '../../dtos/busquedaDto';

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

/** Repositorio específico para las actividades. */
export interface ActividadRepository extends Repository<Actividad, NuevaActividad> {
  addParticipant(id: string, userId: string): Promise<InscribirParticipanteResult>;
  removeParticipant(id: string, userId: string): Promise<RemoverParticipanteResult>;
  findAll(filtros: BuscarActividadesDto): Promise<{ data: Actividad[], total: number }>;
  findDashboardByUser(userId: string, paginacion: PaginacionDto): Promise<{ data: Actividad[], total: number }>;
}