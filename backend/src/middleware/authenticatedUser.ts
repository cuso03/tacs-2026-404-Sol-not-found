import { NextFunction, Request, Response } from 'express';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

/**
 * Adaptador temporal de identidad para desarrollo. Lee `X-User-Id`; debe
 * reemplazarse por un verificador de JWT Auth0 antes de exponer la API.
 */
export function requireAuthenticatedUser(req: Request, res: Response, next: NextFunction): void {
  const userId = req.header('x-user-id')?.trim();
  if (!userId) { res.status(401).json({ error: 'Se requiere el header X-User-Id.' }); return; }
  req.userId = userId;
  next();
}
