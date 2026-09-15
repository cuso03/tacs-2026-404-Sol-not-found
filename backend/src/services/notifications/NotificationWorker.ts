import amqp from 'amqplib';
import { TelegramService } from './TelegramService';

export class NotificationWorker {
  private readonly url: string;
  private readonly queue = 'notificaciones_queue';

  constructor(private telegramService: TelegramService) {
    this.url = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
  }

  async iniciar(): Promise<void> {
    try {
      const connection = await amqp.connect(this.url);
      const channel = await connection.createChannel();
      await channel.assertQueue(this.queue, { durable: true });

      console.log('[NotificationWorker] Conectado a RabbitMQ. Escuchando mensajes...');

      channel.consume(this.queue, async (msg) => {
        if (msg !== null) {
          const payload = JSON.parse(msg.content.toString());
          
          await this.telegramService.notify(payload.destinatarios, payload.mensaje);
          
          channel.ack(msg);
        }
      });
    } catch (error) {
      console.error('[NotificationWorker] RabbitMQ no está listo. Reintentando en 5 segundos...');
      // Si falla, espera 5 segundos y vuelve a llamarse a sí mismo
      setTimeout(() => this.iniciar(), 5000);
    }
  }
}