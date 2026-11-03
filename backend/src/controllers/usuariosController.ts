import { Request, Response } from 'express';
import { ActividadesService } from '../services/actividadesService';
import { paginacionSchema } from '../dtos/busquedaDto';
import { UsuarioMongoRepository } from '../repositories/usuarioMongoRepository';
import { rolesDelToken } from '../middleware/authenticatedUser';
import { z } from 'zod';

const preferenciaClimaSchema = z.object({
  proveedorClima: z.enum(['default', 'legacy']),
});

export function createUsuariosController(
  service: ActividadesService, 
  usuarioRepo: UsuarioMongoRepository
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

  /**
   * Sincroniza el perfil del usuario autenticado (upsert). `email` y `nombre`
   * salen del access token ya verificado, nunca del body: el cliente no decide
   * qué se persiste. El `sub` es la única identidad aceptada.
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

  /**
   * Obtiene la preferencia de proveedor de clima del usuario autenticado ('default' | 'legacy').
   */
  async function getPreferencias(req: Request, res: Response): Promise<void> {
    const proveedorClima = await usuarioRepo.obtenerProveedorClima(req.userId!);
    res.status(200).json({
      sub: req.userId,
      proveedorClima,
    });
  }

  /**
   * Permite cambiar la preferencia de proveedor de clima ('default' | 'legacy').
   */
  async function actualizarPreferencia(req: Request, res: Response): Promise<void> {
    const parsed = preferenciaClimaSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Preferencia inválida. Debe ser "default" o "legacy"', details: parsed.error.issues });
      return;
    }

    await usuarioRepo.actualizarProveedorClima(req.userId!, parsed.data.proveedorClima);
    res.status(200).json({
      sub: req.userId,
      proveedorClima: parsed.data.proveedorClima,
    });
  }

  return { getDashboard, syncPerfil, getPreferencias, actualizarPreferencia };
}
