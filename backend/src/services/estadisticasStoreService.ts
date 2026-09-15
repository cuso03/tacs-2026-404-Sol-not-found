import {IEstadisticasStore} from "../utils/IEstadisticasStore";

export class EstadisticasStoreService {
    constructor(private stats: IEstadisticasStore) {}

    async devolverEstadisticas(){
        return await this.stats.obtener();
    }
}