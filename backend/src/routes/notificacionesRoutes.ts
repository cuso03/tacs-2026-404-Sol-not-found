import { Router } from 'express';
import { NotificacionesMockController } from '../controllers/NotificacionesMockController';

const router = Router();
const notificacionesController = new NotificacionesMockController();

// Ruta mock requerida para simular inicio y gatillar notificaciones[cite: 2]
router.post('/simular-inicio', notificacionesController.simularMonitoreo.bind(notificacionesController));

export default router;