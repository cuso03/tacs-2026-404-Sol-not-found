/** Valores permitidos para el entorno físico de una actividad. */
export const TIPOS_ACTIVIDAD = ['aire_libre', 'techada', 'mixta'] as const;
export type TipoActividad = (typeof TIPOS_ACTIVIDAD)[number];

/** Ubicación identificada por ciudad y país para una consulta climática general. */
export interface UbicacionCiudad {
  tipo: 'ciudad';
  ciudad: string;
  pais: string;
}

/** Ubicación geográfica exacta, preferida para consultas de pronóstico. */
export interface UbicacionCoordenadas {
  tipo: 'coordenadas';
  latitud: number;
  longitud: number;
  direccion?: string;
}

/** Punto donde se realizará la actividad. */
export type Ubicacion = UbicacionCiudad | UbicacionCoordenadas;

/** Franja horaria permitida para una eventual reprogramación. */
export interface RangoHorario {
  horario_min: string;
  horario_max: string;
}

/** Condiciones climáticas, aviso y reprogramación configurados por el organizador. */
export interface ReglasClima {
  probabilidad_lluvia_max: number;
  temperatura_min: number;
  temperatura_max: number;
  viento_max: number;
  horas_anticipacion: number;
  dias_max_reprogramacion: number;
  rango_horario: RangoHorario;
}

/** Datos de una actividad persistida por la aplicación. */
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
  reglasClima?: ReglasClima;
}

/** Datos de negocio para crear una actividad, antes de ser persistida. */
export type NuevaActividad = Omit<Actividad, 'id' | 'reglasClima'>;
