import amqp from 'amqplib';
import { INotifier } from '../../interfaces/services/notifications/INotifier';

export class RabbitMQNotifier implements INotifier {
  private readonly url: string;
  private readonly queue = 'notificaciones_queue';

  constructor() {
    this.url = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
  }

  async notify(destinatarios: string[], mensaje: string): Promise<void> {
    try {
      const connection = await amqp.connect(this.url);
      const channel = await connection.createChannel();
      
      // Aseguramos que la cola exista y sea durable (no se borra si RabbitMQ se reinicia)
      await channel.assertQueue(this.queue, { durable: true });

      const payload = JSON.stringify({ destinatarios, mensaje });
      
      // Enviamos el mensaje marcándolo como persistente
      channel.sendToQueue(this.queue, Buffer.from(payload), { persistent: true });
      console.log(`[RabbitMQNotifier] Notificación encolada exitosamente.`);

      setTimeout(() => connection.close(), 500);
    } catch (error) {
      console.error('[RabbitMQNotifier] Error encolando mensaje:', error);
    }
  }
}