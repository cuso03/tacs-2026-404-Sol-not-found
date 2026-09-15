import { Actividad, NuevaActividad } from '../models/actividad';
import { Repository } from './repository';
import { BuscarActividadesDto, PaginacionDto } from '../../dtos/busquedaDto';

/** Repositorio específico para las actividades. */
export interface ActividadRepository extends Repository<Actividad, NuevaActividad> {
  findAll(filtros: BuscarActividadesDto): Promise<{ data: Actividad[], total: number }>;
  findParaMonitoreo(): Promise<Actividad[]>;
  findDashboardByUser(userId: string, paginacion: PaginacionDto): Promise<{ data: Actividad[], total: number }>;
}