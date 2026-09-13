import { Request, Response } from 'express';
import { ActividadesService } from '../services/actividadesService';
import { paginacionSchema } from '../dtos/busquedaDto';
import { UsuarioMongoRepository } from '../repositories/usuarioMongoRepository';

export function createUsuariosController(
  service: ActividadesService, 
  usuarioRepo: UsuarioMongoRepository // 1. Recibimos el repo inyectado
) {
  async function getDashboard(req: Request, res: Response): Promise<void> {
    const parsed = paginacionSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Parámetros de paginación inválidos', details: parsed.error.issues });
      return;
    }

    const { data, total } = await service.obtenerDashboardUsuario(req.userId!, parsed.data);
    
    res.status(200).json({
      data,
      meta: {
        total,
        page: parsed.data.page,
        limit: parsed.data.limit,
        totalPages: Math.ceil(total / parsed.data.limit)
      }
    });
  }

  // 2. Agregamos la palabra clave 'async function'
  async function syncPerfil(req: Request, res: Response): Promise<void> {
    const auth0Id = req.userId!;
    const { email, nombre } = req.body; 

    // Ahora usuarioRepo existe en el alcance de este archivo
    await usuarioRepo.sincronizarPerfil(auth0Id, email, nombre);
    
    res.status(200).json({ status: 'Perfil sincronizado localmente' });
  }

  // 3. Exportamos ambas funciones para que el router las vea
  return { getDashboard, syncPerfil };
}