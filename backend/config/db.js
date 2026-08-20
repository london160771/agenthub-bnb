import mongoose from 'mongoose';
import { env } from './env.js';

let connected = false;

export function isDbConnected() {
  return connected && mongoose.connection.readyState === 1;
}

/**
 * Connect to MongoDB if a URI is configured. The server still boots without a
 * database so the frontend can be developed against a running API; data
 * endpoints report a clear error when the DB is unavailable.
 */
export async function connectDatabase() {
  if (!env.mongoUri) {
    console.warn(
      '[db] MONGODB_URI not set — running without a database. ' +
        'Marketplace/data endpoints will return SERVICE_UNAVAILABLE until it is configured.',
    );
    return false;
  }

  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 8000 });
    connected = true;
    console.log('[db] Connected to MongoDB');

    mongoose.connection.on('disconnected', () => {
      connected = false;
      console.warn('[db] MongoDB disconnected');
    });
    mongoose.connection.on('reconnected', () => {
      connected = true;
      console.log('[db] MongoDB reconnected');
    });

    return true;
  } catch (err) {
    console.error('[db] Connection failed:', err.message);
    return false;
  }
}
