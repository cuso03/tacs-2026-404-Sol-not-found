export type EstadoActividad = 'PROPUESTA' | 'EN_VOTACION' | 'CONFIRMADA' | 'REPROGRAMADA' | 'CANCELADA' | 'FINALIZADA';
export type TipoActividad = 'aire_libre' | 'techada' | 'mixta';
export type EstadoVotacion = 'ABIERTA' | 'CERRADA';
export type CondicionClima = 'SOLEADO' | 'NUBLADO' | 'PARCIALMENTE_NUBLADO' | 'LLUVIA' | 'TORMENTA';

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

export interface Alternativa {
  id: string;
  fecha_horario: string;
}

export interface Votacion {
  id: string;
  abiertaEn: string;
  cierraEn: string;
  duracionHoras: number;
  automatica: boolean;
  alternativas: Alternativa[];
  votos: Record<string, string>;
  estado: EstadoVotacion;
  cerradaEn?: string;
}

export interface Actividad extends CrearActividadPayload {
  id: string;
  creadorId: string;
  creadaEn: string;
  estado: EstadoActividad;
  participantes: string[];
  reglasClima?: ReglasClimaPayload;
  votaciones: Votacion[];
}

export interface ActividadResumenUsuario {
  id: string;
  titulo: string;
  fecha_horario: string;
  rol: 'organizador' | 'participante';
  estado: EstadoActividad;
  votacion_abierta: boolean;
}

export interface CondicionesActuales {
  temperatura: number;
  condicion: CondicionClima;
  viento: number;
  humedad: number;
}

export interface PronosticoActividad {
  probabilidad_lluvia: number;
  temperatura: number;
  viento: number;
  condicion: CondicionClima;
}

export interface ClimaActividad {
  ubicacion: string;
  fecha_horario: string;
  clima_actual: CondicionesActuales;
  pronostico_actividad: PronosticoActividad;
}

export interface ResultadosVotacion {
  votacion: Votacion;
  conteo: Record<string, number>;
  totalVotos: number;
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

export type Estadisticas = Record<string, number>;

export interface SimulacionMonitoreoResponse {
  mensaje: string;
  actividadEvaluada: string;
}
