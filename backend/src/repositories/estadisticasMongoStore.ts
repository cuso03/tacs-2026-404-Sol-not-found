import { IEstadisticasStore } from '../utils/IEstadisticasStore';
import { EstadisticaModel } from '../infrastructure/mongo/estadisticasModel';

export class EstadisticasMongoStore implements IEstadisticasStore {
  async incrementar(metrica: string, cantidad: number = 1): Promise<void> {
    await EstadisticaModel.findOneAndUpdate(
      { metrica },
      { $inc: { cantidad } },
      { upsert: true, new: true }
    );
  }

  async obtener(): Promise<Record<string, number>> {
    const documentos = await EstadisticaModel.find().exec();
    const resultado: Record<string, number> = {};
    
    for (const doc of documentos) {
      resultado[doc.metrica] = doc.cantidad;
    }
    
    return resultado;
  }

  async reset(): Promise<void> {
    await EstadisticaModel.deleteMany({});
  }
}