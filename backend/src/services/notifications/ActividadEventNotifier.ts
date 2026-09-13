import { INotifier } from '../../interfaces/services/notifications/INotifier';
import { Actividad } from '../../interfaces/models/actividad';
import { NotificacionMongoRepository } from '../../repositories/notificacionMongoRepository';

export class ActividadEventNotifier {
  constructor(
    private notifier: INotifier,
    private notificacionRepo: NotificacionMongoRepository // Nueva dependencia
  ) {}

  public async notificarReprogramacion(actividad: Actividad, nuevaFecha: string): Promise<void> {
    const mensaje = `La actividad "${actividad.titulo}" ha sido REPROGRAMADA para el día ${nuevaFecha}.`;
    
    // Guardamos en la base de datos (Auditoría)
    await this.notificacionRepo.registrar(actividad.id!, 'REPROGRAMACION', mensaje, actividad.participantes);
    
    // Despachamos a la cola (Ejecución real)
    await this.notifier.notify(actividad.participantes, mensaje);
  }

  // Se dispara cuando no hay quórum o el creador la da de baja (Feature 1 o 6)
  public async notificarCancelacion(actividad: Actividad): Promise<void> {
    const mensaje = `Lamentamos informarte que la actividad "${actividad.titulo}" ha sido CANCELADA.`;
    await this.notificacionRepo.registrar(actividad.id!, 'CANCELACION', mensaje, actividad.participantes);
    await this.notifier.notify(actividad.participantes, mensaje);
  }

  // Se dispara cuando la actividad está a punto de suceder
  public async notificarInicioProximo(actividad: Actividad): Promise<void> {
    const mensaje = `¡Preparate! La actividad "${actividad.titulo}" está por comenzar en breve.`;
    await this.notificacionRepo.registrar(actividad.id!, 'INICIO', mensaje, actividad.participantes);
    await this.notifier.notify(actividad.participantes, mensaje);
  }
}