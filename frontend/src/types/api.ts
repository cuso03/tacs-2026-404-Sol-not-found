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

export interface CrearActividadPayload {
  titulo: string;
  descripcion: string;
  tipo: TipoActividad;
  ubicacion: Ubicacion;
  fecha_horario: string;
  min_participantes: number;
  max_participantes: number;
}

export interface ReglasClimaPayload {
  probabilidad_lluvia_max: number;
  temperatura_min: number;
  temperatura_max: number;
  viento_max: number;
  horas_anticipacion: number;
  dias_max_reprogramacion: number;
  rango_horario: { horario_min: string; horario_max: string };
}

export interface Actividad extends CrearActividadPayload {
  id: string;
  creadorId: string;
  creadaEn: string;
  estado: EstadoActividad;
  participantes: string[];
  reglasClima?: ReglasClimaPayload;
  votaciones?: unknown[];
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
