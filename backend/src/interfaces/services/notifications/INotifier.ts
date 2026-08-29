export interface INotifier {
  notify(destinatarios: string[], mensaje: string): Promise<void>;
}