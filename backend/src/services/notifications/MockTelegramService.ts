import { INotifier } from '../../interfaces/services/notifications/INotifier';

export class MockTelegramService implements INotifier {
  async notify(destinatarios: string[], mensaje: string): Promise<void> {
    // Simula el envío de notificaciones imprimiendo en la consola del contenedor Docker
    console.log(`\n[MockTelegramService] 🚀 ALERTA / NOTIFICACIÓN`);
    console.log(`[MockTelegramService] Destinatarios (UserIDs): [${destinatarios.join(', ')}]`);
    console.log(`[MockTelegramService] Mensaje: "${mensaje}"\n`);
  }
}