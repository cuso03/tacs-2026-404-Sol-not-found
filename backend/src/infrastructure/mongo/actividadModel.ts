import { Schema, model, InferSchemaType, HydratedDocument } from 'mongoose';
import { Actividad, ESTADOS_ACTIVIDAD, TIPOS_ACTIVIDAD } from '../../interfaces/models/actividad';
import { ESTADOS_VOTACION } from '../../interfaces/models/votacion';

// Value objects embebidos sin identidad propia (_id: false)
const ubicacionSchema = new Schema(
  {
    tipo: { type: String, enum: ['ciudad', 'coordenadas'], required: true },
    ciudad: { type: String },
    pais: { type: String },
    latitud: { type: Number },
    longitud: { type: Number },
    direccion: { type: String },
  },
  { _id: false }
);

const rangoHorarioSchema = new Schema(
  {
    horario_min: { type: String, required: true },
    horario_max: { type: String, required: true },
  },
  { _id: false }
);

const reglasClimaSchema = new Schema(
  {
    probabilidad_lluvia_max: { type: Number, required: true },
    temperatura_min: { type: Number, required: true },
    temperatura_max: { type: Number, required: true },
    viento_max: { type: Number, required: true },
    horas_anticipacion: { type: Number, required: true },
    dias_max_reprogramacion: { type: Number, required: true },
    rango_horario: { type: rangoHorarioSchema, required: true },
  },
  { _id: false }
);

// Subdocumentos embebidos con identificador nativo de MongoDB (_id)
const alternativaSchema = new Schema({
  fecha_horario: { type: String, required: true },
});

const votacionSchema = new Schema({
  abiertaEn: { type: String, required: true },
  cierraEn: { type: String, required: true },
  duracionHoras: { type: Number, required: true },
  automatica: { type: Boolean, required: true },
  alternativas: [alternativaSchema],
  votos: { type: Map, of: String, default: () => new Map() },
  estado: { type: String, enum: ESTADOS_VOTACION, required: true, default: 'ABIERTA' },
  cerradaEn: { type: String, required: false },
});

// Schema raíz de la colección 'actividades'
export const actividadSchema = new Schema(
  {
    titulo: { type: String, required: true },
    descripcion: { type: String, required: true },
    tipo: { type: String, enum: TIPOS_ACTIVIDAD, required: true },
    ubicacion: { type: ubicacionSchema, required: true },
    fecha_horario: { type: String, required: true },
    min_participantes: { type: Number, required: true },
    max_participantes: { type: Number, required: true },
    creadorId: { type: String, required: true, index: true },
    creadaEn: { type: String, required: true },
    reglasClima: { type: reglasClimaSchema, required: false, default: undefined },
    estado: { type: String, enum: ESTADOS_ACTIVIDAD, required: true },
    participantes: { type: [String], default: [], index: true },
    votaciones: [votacionSchema],
  },
  {
    collection: 'actividades',
    versionKey: false,
  }
);

actividadSchema.index({ tipo: 1, fecha_horario: 1 });

// Inferencia automática de tipos con Mongoose moderno
export type ActividadSchemaType = InferSchemaType<typeof actividadSchema>;
export type ActividadDocument = HydratedDocument<ActividadSchemaType>;

export const ActividadModel = model<ActividadDocument>('Actividad', actividadSchema);

/** Transforma un documento Mongoose a la entidad de dominio Actividad */
export function toActividad(doc: ActividadDocument): Actividad {
  const raw = doc.toObject({ flattenMaps: true });
  return {
    id: doc._id.toString(),
    titulo: raw.titulo,
    descripcion: raw.descripcion,
    tipo: raw.tipo,
    ubicacion: raw.ubicacion as Actividad['ubicacion'],
    fecha_horario: raw.fecha_horario,
    min_participantes: raw.min_participantes,
    max_participantes: raw.max_participantes,
    creadorId: raw.creadorId,
    creadaEn: raw.creadaEn,
    reglasClima: raw.reglasClima
      ? {
          probabilidad_lluvia_max: raw.reglasClima.probabilidad_lluvia_max,
          temperatura_min: raw.reglasClima.temperatura_min,
          temperatura_max: raw.reglasClima.temperatura_max,
          viento_max: raw.reglasClima.viento_max,
          horas_anticipacion: raw.reglasClima.horas_anticipacion,
          dias_max_reprogramacion: raw.reglasClima.dias_max_reprogramacion,
          rango_horario: {
            horario_min: raw.reglasClima.rango_horario.horario_min,
            horario_max: raw.reglasClima.rango_horario.horario_max,
          },
        }
      : undefined,
    estado: raw.estado,
    participantes: Array.isArray(raw.participantes) ? [...raw.participantes] : [],
    votaciones: Array.isArray(raw.votaciones)
      ? raw.votaciones.map((v: any) => ({
          id: v._id?.toString() ?? v.id,
          abiertaEn: v.abiertaEn,
          cierraEn: v.cierraEn,
          duracionHoras: v.duracionHoras,
          automatica: v.automatica,
          alternativas: Array.isArray(v.alternativas)
            ? v.alternativas.map((a: any) => ({
                id: a._id?.toString() ?? a.id,
                fecha_horario: a.fecha_horario,
              }))
            : [],
          votos: v.votos instanceof Map ? Object.fromEntries(v.votos) : v.votos ? { ...v.votos } : {},
          estado: v.estado ?? 'ABIERTA',
          cerradaEn: v.cerradaEn,
        }))
      : [],
  };
}
