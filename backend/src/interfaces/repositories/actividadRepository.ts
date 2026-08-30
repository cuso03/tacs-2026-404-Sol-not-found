import { Actividad, NuevaActividad } from '../models/actividad';
//import { Repository } from './repository';
import { BuscarActividadesDto } from '../../dtos/busquedaDto';

export interface ActividadRepository {
  create(actividad: NuevaActividad): Promise<Actividad>;
  findById(id: string): Promise<Actividad | undefined>;
  update(actividad: Actividad): Promise<Actividad | undefined>;
  
  // Nuevos métodos
  findAll(filtros: BuscarActividadesDto): Promise<Actividad[]>;
  findDashboardByUser(userId: string): Promise<Actividad[]>;
}
