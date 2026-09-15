export type TipoActividad = 'aire_libre' | 'techada' | 'mixta';

export type Ubicacion =
  | { tipo: 'ciudad'; ciudad: string; pais: string }
  | { tipo: 'coordenadas'; latitud: number; longitud: number; direccion?: string };

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
  reglasClima?: ReglasClimaPayload;
  estado?: string;
  participantes?: string[];
}
