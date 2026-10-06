import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { beforeAll, afterAll, beforeEach } from 'vitest';
import { clearDatabase } from './helpers/db.helper';
import { startTestAuth, stopTestAuth } from './helpers/auth/testAuth';

// Asegurar que el entorno de ejecución sea 'test'
process.env.NODE_ENV = 'test';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  await startTestAuth();
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGODB_URI = uri;
  await mongoose.connect(uri);
});

beforeEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});
