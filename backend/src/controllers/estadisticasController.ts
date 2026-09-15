import { Request, Response } from 'express';

import {EstadisticasStoreService} from "../services/estadisticasStoreService";

export function estadisticasController(service: EstadisticasStoreService) {
    async function getEstadisticas(req: Request, res: Response): Promise<void> {

        try{
            const result = await service.devolverEstadisticas()
            res.status(200).json(result);
        }
        catch(err){
            res.status(500).send("Ocurrio un error al intentar obtener estadisticas, error: " + err);
        }

    }

    return {getEstadisticas};
}