/** Contrato base para las fuentes de persistencia de la aplicación. */
export interface Repository<T, CreateData, Id = string> {
  create(entity: CreateData): Promise<T>;
  findById(id: Id): Promise<T | undefined>;
  update(entity: T): Promise<T | undefined>;
}
