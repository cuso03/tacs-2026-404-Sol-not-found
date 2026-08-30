import { Router } from 'express';
import { NotificacionesMockController } from '../controllers/NotificacionesMockController';

const router = Router();
const notificacionesController = new NotificacionesMockController();

// Con bind, estamos diciendo: “cuando llames a este método, usa notificacionesController como this”.
router.post('/simular-inicio', notificacionesController.simularMonitoreo.bind(notificacionesController));

export default router;