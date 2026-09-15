import { isValidObjectId } from 'mongoose';
import { Actividad, NuevaActividad } from '../interfaces/models/actividad';
import { ActividadRepository } from '../interfaces/repositories/actividadRepository';
import { BuscarActividadesDto, PaginacionDto } from '../dtos/busquedaDto';
import { ActividadModel, toActividad } from '../infrastructure/mongo/actividadModel';

export class ActividadMongoRepository implements ActividadRepository {
  async create(actividad: NuevaActividad): Promise<Actividad> {
    const doc = await ActividadModel.create({
      ...actividad,
      votaciones: [],
    });
    return toActividad(doc);
  }

  async findById(id: string): Promise<Actividad | undefined> {
    if (!isValidObjectId(id)) {
      return undefined;
    }
    const doc = await ActividadModel.findById(id);
    if (!doc) return undefined;
    return toActividad(doc);
  }

  async update(actividad: Actividad): Promise<Actividad | undefined> {
    if (!isValidObjectId(actividad.id)) {
      return undefined;
    }
    const { id, ...resto } = actividad;
    const dataToUpdate: any = { ...resto };

    if (Array.isArray(actividad.votaciones)) {
      dataToUpdate.votaciones = actividad.votaciones.map((v: any) => {
        const { id: vId, ...vRest } = v;
        return {
          ...vRest,
          ...(vId && isValidObjectId(vId) ? { _id: vId } : {}),
          alternativas: (v.alternativas ?? []).map((a: any) => {
            const { id: aId, ...aRest } = a;
            return {
              ...aRest,
              ...(aId && isValidObjectId(aId) ? { _id: aId } : {}),
            };
          }),
        };
      });
    }

    const doc = await ActividadModel.findByIdAndUpdate(
      id,
      { $set: dataToUpdate },
      { returnDocument: 'after', runValidators: true }
    );
    if (!doc) return undefined;
    return toActividad(doc);
  }

  async findAll(filtros: BuscarActividadesDto): Promise<{ data: Actividad[]; total: number }> {
    const query: any = {};
    const exprConditions: any[] = [
      { $lt: [{ $size: { $ifNull: ['$participantes', []] } }, '$max_participantes'] },
    ];

    if (filtros.tipo) {
      query.tipo = filtros.tipo;
    }

    if (filtros.fecha_desde) {
      exprConditions.push({
        $gte: [{ $toDate: '$fecha_horario' }, new Date(filtros.fecha_desde)],
      });
    }

    if (filtros.ubicacion) {
      const escaped = filtros.ubicacion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      query.$or = [
        { 'ubicacion.tipo': 'ciudad', 'ubicacion.ciudad': { $regex: regex } },
        { 'ubicacion.tipo': 'coordenadas', 'ubicacion.direccion': { $regex: regex } },
      ];
    }

    if (exprConditions.length === 1) {
      query.$expr = exprConditions[0];
    } else if (exprConditions.length > 1) {
      query.$expr = { $and: exprConditions };
    }

    const total = await ActividadModel.countDocuments(query);
    const skip = (filtros.page - 1) * filtros.limit;
    const docs = await ActividadModel.find(query).skip(skip).limit(filtros.limit);

    return {
      data: docs.map(toActividad),
      total,
    };
  }

  async findParaMonitoreo(): Promise<Actividad[]> {
    const docs = await ActividadModel.find({ estado: { $in: ['PROPUESTA', 'CONFIRMADA', 'REPROGRAMADA'] } });
    return docs.map(toActividad);
  }

  async findDashboardByUser(userId: string, paginacion: PaginacionDto): Promise<{ data: Actividad[]; total: number }> {
    const query = {
      $or: [{ creadorId: userId }, { participantes: userId }],
    };

    const total = await ActividadModel.countDocuments(query);
    const skip = (paginacion.page - 1) * paginacion.limit;
    const docs = await ActividadModel.find(query).skip(skip).limit(paginacion.limit);

    return {
      data: docs.map(toActividad),
      total,
    };
  }
}
