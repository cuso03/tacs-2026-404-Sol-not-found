import { UsuarioModel } from '../infrastructure/mongo/usuarioModel';

export class UsuarioMongoRepository {
  /**
   * Sincroniza el usuario: si no existe lo crea, si existe actualiza su último acceso y datos.
   */
  async sincronizarPerfil(auth0Id: string, email?: string, nombre?: string): Promise<void> {
    await UsuarioModel.findOneAndUpdate(
      { auth0Id },
      { 
        $set: { email, nombre, ultimoAcceso: new Date() }
      },
      { upsert: true, new: true } // upsert: crea si no existe
    );
  }
}