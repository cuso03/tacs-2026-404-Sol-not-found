import mongoose, { Schema, Document } from 'mongoose';

export interface IUsuarioDoc extends Document {
  auth0Id: string;
  email?: string;
  nombre?: string;
  creadoEn: Date;
  ultimoAcceso: Date;
}

const UsuarioSchema = new Schema({
  auth0Id: { type: String, required: true, unique: true },
  email: { type: String },
  nombre: { type: String },
  creadoEn: { type: Date, default: Date.now },
  ultimoAcceso: { type: Date, default: Date.now }
});

export const UsuarioModel = mongoose.model<IUsuarioDoc>('Usuario', UsuarioSchema);