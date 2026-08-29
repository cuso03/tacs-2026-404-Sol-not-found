import { Router } from 'express';
import { getActividades } from '../controllers/actividadesController';

const router = Router();

// Esta ruta responderá cuando hagamos GET a la ruta base de actividades
router.get('/', getActividades);

export default router;