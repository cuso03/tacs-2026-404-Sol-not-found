import { Request, Response } from 'express';
import { ActividadesService } from '../services/actividadesService';
import { paginacionSchema } from '../dtos/busquedaDto';
import { UsuarioMongoRepository } from '../repositories/usuarioMongoRepository';
import { rolesDelToken } from '../middleware/authenticatedUser';

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
  /**
   * Sincroniza el perfil del usuario autenticado (upsert). `email` y `nombre`
   * salen del access token ya verificado, nunca del body: el cliente no decide
   * qué se persiste. El `sub` es la unica identidad aceptada.
   *
   * Es PATCH y no GET porque escribe: un GET debe ser seguro y repeatable sin
   * efectos, y un prefetch o crawler no debe poder disparar la escritura.
   */
  async function syncPerfil(req: Request, res: Response): Promise<void> {
    const email = typeof req.auth?.email === 'string' ? req.auth.email : undefined;
    const nombre = typeof req.auth?.name === 'string' ? req.auth.name : undefined;

    await usuarioRepo.sincronizarPerfil(req.userId!, email, nombre);

    res.status(200).json({
      sub: req.userId,
      email: email ?? null,
      nombre: nombre ?? null,
      roles: rolesDelToken(req.auth),
    });
  }

  // 3. Exportamos ambas funciones para que el router las vea
  return { getDashboard, syncPerfil };
}