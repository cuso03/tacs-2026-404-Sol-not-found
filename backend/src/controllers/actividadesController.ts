import { Request, Response } from 'express';

export const getActividades = (req: Request, res: Response) => {
    // Retornamos un mensaje de éxito y un array vacío simulando las actividades
    res.status(200).json({
        mensaje: "¡El backend de TACS está funcionando perfectamente!",
        actividades: []
    });
};