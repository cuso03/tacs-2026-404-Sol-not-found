import mongoose, { Schema, Document } from 'mongoose';

export interface IEstadisticaDoc extends Document {
  metrica: string;
  cantidad: number;
}

const EstadisticaSchema = new Schema({
  metrica: { type: String, required: true, unique: true },
  cantidad: { type: Number, required: true, default: 0 }
});

export const EstadisticaModel = mongoose.model<IEstadisticaDoc>('Estadistica', EstadisticaSchema);