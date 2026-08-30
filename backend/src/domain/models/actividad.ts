import type { EstadoActividad, ReglasClima } from './reglasClima';

export interface Actividad {
  id: string;
  titulo: string;
  tipo: 'AIRE_LIBRE' | 'TECHADA' | 'MIXTA';
  ubicacion: string;
  fecha_horario: string; // ISO 8601
  min_participantes: number;
  max_participantes: number;
  creadorId: string;
  estado: EstadoActividad;
  reglas_clima?: ReglasClima;
  participantes: string[]; // Array de userIds simulados
}