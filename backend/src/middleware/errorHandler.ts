import { NextFunction, Request, Response } from 'express';

/**
 * Maneja errores no capturados por los controladores. Debe registrarse al
 * final de la app, después de todas las rutas. Express 5 reenvía aquí las
 * promesas rechazadas de los handlers asíncronos.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[ErrorHandler]', err);

  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' });
}