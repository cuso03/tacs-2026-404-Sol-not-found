import { Actividad, NuevaActividad } from '../models/actividad';
import { Repository } from './repository';

/** Repositorio específico para las actividades. */
export interface ActividadRepository extends Repository<Actividad, NuevaActividad> {}
