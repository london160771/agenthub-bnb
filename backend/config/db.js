import mongoose from 'mongoose';
import { env, isProd } from './env.js';
import { seedAgentCatalogue } from '../services/agentSeeder.js';

let connected = false;
let memoryServer = null;
let indexedRefreshPromise = null;

export function isDbConnected() {
  return connected && mongoose.connection.readyState === 1;
}

function bindConnectionEvents() {
  mongoose.connection.on('disconnected', () => {
    connected = false;
    console.warn('[db] MongoDB disconnected');
  });
  mongoose.connection.on('reconnected', () => {
    connected = true;
    console.log('[db] MongoDB reconnected');
  });
}

/**
 * Spin up an ephemeral in-memory MongoDB for local development when no
 * MONGODB_URI is configured, then seed the curated catalogue so the
 * marketplace is immediately usable with zero setup. The production code path
 * (real Mongoose connection) is identical — only the connection string differs.
 */
async function startInMemoryMongo() {
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  memoryServer = await MongoMemoryServer.create();
  const uri = memoryServer.getUri();
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  console.log('[db] Using in-memory MongoDB (development, no MONGODB_URI set)');

  const { inserted } = await seedAgentCatalogue({ wipe: false });
  if (inserted > 0) {
    console.log(`[db] Seeded ${inserted} demo agents into in-memory database`);
  }

}

function scheduleIndexedRefresh({ reason }) {
  const scanAuthMode = env.scan8004ApiKey ? 'configured API key' : 'anonymous tier';
  console.log(`[db] Starting incremental 8004scan refresh (${scanAuthMode}; ${reason})...`);
  indexedRefreshPromise = import('../services/indexedAgentIngestion.js')
    .then(({ refreshIndexedAgents }) => refreshIndexedAgents({ limit: 40 }))
    .then((result) => {
      console.log(
        `[db] Indexed refresh complete: before=${result.beforeIndexed} after=${result.afterIndexed} ` +
          `processed=${result.processed} inserted=${result.inserted} updated=${result.updated} failed=${result.failed}`,
      );
      return result;
    })
    .catch((err) => {
      console.warn(`[db] Indexed refresh skipped: ${err.message}`);
      return null;
    });
  return indexedRefreshPromise;
}

/** Used by verification scripts that need to wait for the background refresh. */
export function getIndexedRefreshPromise() {
  return indexedRefreshPromise || Promise.resolve(null);
}

/**
 * Connect to MongoDB.
 *   - MONGODB_URI set        → connect to that database (Atlas/production).
 *   - unset + development    → start an in-memory Mongo and auto-seed.
 *   - unset + production     → boot without a DB; data endpoints report
 *                              SERVICE_UNAVAILABLE until one is configured.
 */
export async function connectDatabase({ refresh = true } = {}) {
  mongoose.set('strictQuery', true);

  try {
    if (env.mongoUri) {
      await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 8000 });
      connected = true;
      bindConnectionEvents();
      console.log('[db] Connected to MongoDB');

      const { inserted } = await seedAgentCatalogue({ wipe: false });
      if (inserted > 0) {
        console.log(`[db] Added ${inserted} missing curated agents to MongoDB`);
      }
      if (refresh) scheduleIndexedRefresh({ reason: 'MongoDB connected' });
      return true;
    }

    if (isProd) {
      console.warn(
        '[db] MONGODB_URI not set in production — running without a database. ' +
          'Data endpoints will return SERVICE_UNAVAILABLE until it is configured.',
      );
      return false;
    }

    await startInMemoryMongo();
    connected = true;
    bindConnectionEvents();
    if (refresh) scheduleIndexedRefresh({ reason: 'in-memory development database' });
    return true;
  } catch (err) {
    console.error('[db] Connection failed:', err.message);
    connected = false;
    return false;
  }
}

/**
 * Cleanly tear down the connection (and the in-memory server, if any).
 * Used by scripts and tests so the process can exit.
 */
export async function disconnectDatabase() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
  connected = false;
}
