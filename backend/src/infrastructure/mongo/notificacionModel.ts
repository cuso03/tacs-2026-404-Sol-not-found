import mongoose, { Schema, Document } from 'mongoose';

export interface INotificacionDoc extends Document {
  actividadId: string;
  tipoEvento: 'ALERTA' | 'REPROGRAMACION' | 'CANCELACION' | 'INICIO';
  mensaje: string;
  destinatarios: string[];
  enviadaEn: Date;
}

const NotificacionSchema = new Schema({
  actividadId: { type: String, required: true },
  tipoEvento: { type: String, required: true, enum: ['ALERTA', 'REPROGRAMACION', 'CANCELACION', 'INICIO'] },
  mensaje: { type: String, required: true },
  destinatarios: [{ type: String }],
  enviadaEn: { type: Date, default: Date.now }
});

export const NotificacionModel = mongoose.model<INotificacionDoc>('Notificacion', NotificacionSchema);