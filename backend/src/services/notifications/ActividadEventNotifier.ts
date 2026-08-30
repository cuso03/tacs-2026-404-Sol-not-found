import { INotifier } from '../../interfaces/services/notifications/INotifier';
import { Actividad } from '../../domain/models/actividad';

export class ActividadEventNotifier {
  private notifier: INotifier;

  constructor(notifier: INotifier) {
    this.notifier = notifier;
  }

  // Se dispara cuando la votación es exitosa (Feature 6)
  public async notificarReprogramacion(actividad: Actividad, nuevaFecha: string): Promise<void> {
    const mensaje = `La actividad "${actividad.titulo}" ha sido REPROGRAMADA para el día ${nuevaFecha}.`;
    await this.notifier.notify(actividad.participantes, mensaje);
  }

  // Se dispara cuando no hay quórum o el creador la da de baja (Feature 1 o 6)
  public async notificarCancelacion(actividad: Actividad): Promise<void> {
    const mensaje = `Lamentamos informarte que la actividad "${actividad.titulo}" ha sido CANCELADA.`;
    await this.notifier.notify(actividad.participantes, mensaje);
  }

  // Se dispara cuando la actividad está a punto de suceder
  public async notificarInicioProximo(actividad: Actividad): Promise<void> {
    const mensaje = `¡Preparate! La actividad "${actividad.titulo}" está por comenzar en breve.`;
    await this.notifier.notify(actividad.participantes, mensaje);
  }
}