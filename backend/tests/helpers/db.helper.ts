import mongoose from 'mongoose';

/**
 * Limpia concurrentemente todas las colecciones existentes en la base de datos de test
 * sin recrear la conexión completa a MongoDB.
 */
export async function clearDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 1) {
    return;
  }

  const collections = mongoose.connection.collections;
  await Promise.all(
    Object.values(collections).map(async (collection) => {
      await collection.deleteMany({});
    })
  );
}
