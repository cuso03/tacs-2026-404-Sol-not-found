export type EstadoActividad = 'PROPUESTA' | 'EN_VOTACION' | 'CONFIRMADA' | 'REPROGRAMADA' | 'CANCELADA' | 'FINALIZADA';
export type TipoActividad = 'aire_libre' | 'techada' | 'mixta';

export interface UbicacionCiudad {
  tipo: 'ciudad';
  ciudad: string;
  pais: string;
}

export interface UbicacionCoordenadas {
  tipo: 'coordenadas';
  latitud: number;
  longitud: number;
  direccion?: string;
}

export type Ubicacion = UbicacionCiudad | UbicacionCoordenadas;

export interface Actividad {
  id: string;
  titulo: string;
  descripcion: string;
  tipo: TipoActividad;
  ubicacion: Ubicacion;
  fecha_horario: string;
  min_participantes: number;
  max_participantes: number;
  creadorId: string;
  creadaEn: string;
  estado: EstadoActividad;
  participantes: string[];
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}