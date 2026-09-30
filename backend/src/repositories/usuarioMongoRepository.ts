import { UsuarioModel } from '../infrastructure/mongo/usuarioModel';

export class UsuarioMongoRepository {
  /**
   * Sincroniza el usuario: si no existe lo crea, si existe actualiza su último acceso y datos.
   * Un `email`/`nombre` ausente no pisa el valor ya guardado.
   */
  async sincronizarPerfil(auth0Id: string, email?: string, nombre?: string): Promise<void> {
    const datos: { email?: string; nombre?: string; ultimoAcceso: Date } = { ultimoAcceso: new Date() };
    if (email !== undefined) datos.email = email;
    if (nombre !== undefined) datos.nombre = nombre;

    await UsuarioModel.findOneAndUpdate(
      { auth0Id },
      { $set: datos },
      { upsert: true, returnDocument: 'after' } // upsert: crea si no existe
    );
  }
}