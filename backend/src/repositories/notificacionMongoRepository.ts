import { NotificacionModel } from '../infrastructure/mongo/notificacionModel';

export class NotificacionMongoRepository {
  async registrar(
    actividadId: string, 
    tipoEvento: 'ALERTA' | 'REPROGRAMACION' | 'CANCELACION' | 'INICIO',
    mensaje: string, 
    destinatarios: string[]
  ): Promise<void> {
    await NotificacionModel.create({
      actividadId,
      tipoEvento,
      mensaje,
      destinatarios
    });
  }
}