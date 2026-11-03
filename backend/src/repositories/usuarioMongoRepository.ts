import { UsuarioModel, ProveedorClima, IUsuarioDoc } from '../infrastructure/mongo/usuarioModel';

export class UsuarioMongoRepository {
  /**
   * Sincroniza el usuario: si no existe lo crea, si existe actualiza su último acceso y datos.
   * Un `email`/`nombre` ausente no pisa el valor ya guardado.
   */
  async sincronizarPerfil(
    auth0Id: string,
    email?: string,
    nombre?: string,
    proveedorClima?: ProveedorClima,
  ): Promise<IUsuarioDoc> {
    const datos: { email?: string; nombre?: string; proveedorClima?: ProveedorClima; ultimoAcceso: Date } = {
      ultimoAcceso: new Date(),
    };
    if (email !== undefined) datos.email = email;
    if (nombre !== undefined) datos.nombre = nombre;
    if (proveedorClima !== undefined) datos.proveedorClima = proveedorClima;

    const doc = await UsuarioModel.findOneAndUpdate(
      { auth0Id },
      { $set: datos, $setOnInsert: { creadoEn: new Date() } },
      { upsert: true, returnDocument: 'after' }
    );
    return doc!;
  }

  async buscarPorAuth0Id(auth0Id: string): Promise<IUsuarioDoc | null> {
    return UsuarioModel.findOne({ auth0Id });
  }

  async actualizarProveedorClima(auth0Id: string, proveedorClima: ProveedorClima): Promise<void> {
    await UsuarioModel.updateOne(
      { auth0Id },
      { $set: { proveedorClima, ultimoAcceso: new Date() } },
      { upsert: true }
    );
  }

  async obtenerProveedorClima(auth0Id: string): Promise<ProveedorClima> {
    const usuario = await UsuarioModel.findOne({ auth0Id }).select('proveedorClima').lean();
    return (usuario?.proveedorClima as ProveedorClima) ?? 'default';
  }
}
