import mongoose, { Schema, Document } from 'mongoose';

export type ProveedorClima = 'default' | 'legacy';

export interface IUsuarioDoc extends Document {
  auth0Id: string;
  email?: string;
  nombre?: string;
  proveedorClima: ProveedorClima;
  creadoEn: Date;
  ultimoAcceso: Date;
}

const UsuarioSchema = new Schema({
  auth0Id: { type: String, required: true, unique: true },
  email: { type: String },
  nombre: { type: String },
  proveedorClima: {
    type: String,
    enum: ['default', 'legacy'],
    default: 'default',
  },
  creadoEn: { type: Date, default: Date.now },
  ultimoAcceso: { type: Date, default: Date.now },
});

export const UsuarioModel = mongoose.model<IUsuarioDoc>('Usuario', UsuarioSchema);
