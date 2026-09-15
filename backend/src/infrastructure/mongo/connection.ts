import mongoose from 'mongoose';

/**
 * Conecta al MongoDB configurado con la variable de entorno MONGODB_URI.
 * No posee un valor por defecto en el código: la conexión es explícita.
 */
export async function connectToMongo(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Falta la variable de entorno MONGODB_URI para conectar a MongoDB.');
  }
  await mongoose.connect(uri);
}

/** Desconecta la instancia activa de mongoose. */
export async function disconnectFromMongo(): Promise<void> {
  await mongoose.disconnect();
}