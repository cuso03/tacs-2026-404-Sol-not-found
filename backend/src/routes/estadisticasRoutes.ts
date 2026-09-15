import { Router } from 'express';
import {EstadisticasStoreService} from "../services/estadisticasStoreService";
import {requireAdmin} from "../middleware/authenticatedUser";
import {estadisticasController} from "../controllers/estadisticasController";

export function createEstadisticasRouter(service: EstadisticasStoreService): Router {
    const router = Router();
    const controller = estadisticasController(service);

    router.get('/', requireAdmin, controller.getEstadisticas);


    return router;
}