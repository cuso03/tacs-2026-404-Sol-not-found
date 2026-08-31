import { INotifier } from '../../interfaces/services/notifications/INotifier';

export class TelegramService implements INotifier {
  private readonly botToken: string;
  private readonly defaultChatId: string;

  constructor() {
    // Lo ideal es que estas variables vengan del archivo .env
    this.botToken = process.env.TELEGRAM_BOT_TOKEN as string;
    this.defaultChatId = process.env.TELEGRAM_CHAT_ID as string;
  }

  async notify(destinatarios: string[], mensaje: string): Promise<void> {
    // Por ahora, enviaremos la alerta a tu chat de prueba.
    // En un futuro, deberías buscar en la base de datos el Chat ID asociado a cada "userId" del array de destinatarios.
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.defaultChatId,
          text: mensaje,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`[TelegramService] Error al enviar mensaje:`, errorData);
      } else {
        console.log(`[TelegramService] 🚀 Mensaje enviado a Telegram correctamente.`);
      }
    } catch (error) {
      console.error(`[TelegramService] Falla de red intentando contactar a Telegram:`, error);
    }
  }
}