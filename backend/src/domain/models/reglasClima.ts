export type EstadoActividad = 'PROPUESTA' | 'CONFIRMADA' | 'EN_VOTACION' | 'REPROGRAMADA' | 'CANCELADA' | 'FINALIZADA';

export interface ReglasClima {
  probabilidad_lluvia_max: number;
  temperatura_min: number;
  temperatura_max: number;
  viento_max: number;
  horas_anticipacion: number;
  dias_max_reprogramacion: number;
  rango_horario: { horario_min: string; horario_max: string };
}