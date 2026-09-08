import mongoose from 'mongoose';
import { env, isProd } from './env.js';
import { seedAgentCatalogue } from '../services/agentSeeder.js';

let connected = false;
let memoryServer = null;
let indexedRefreshPromise = null;
let indexedRefreshInFlightPromise = null;
let indexedRefreshInterval = null;
let connectionListenersBound = false;
let reconnectTimer = null;
let reconnectAttempt = 0;
let hasConnectedOnce = false;
let shutdownRequested = false;
let mongoClientListenersBound = false;
let connectInFlight = false;

const DB_CONNECT_OPTIONS = Object.freeze({
  serverSelectionTimeoutMS: 8000,
  connectTimeoutMS: 10000,
  heartbeatFrequencyMS: 10000,
});
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30000;
export const AGENT_REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000;

export function isDbConnected() {
  // Mongoose's live state is authoritative. The appConnected flag is only
  // retained for diagnostics and must not make a healthy connection appear
  // unavailable after a missed or reordered lifecycle event.
  return mongoose.connection.readyState === 1;
}

export function assertProductionDatabaseConfiguration({ production = isProd, mongoUri = env.mongoUri } = {}) {
  if (production && !String(mongoUri || '').trim()) {
    throw new Error('MONGODB_URI is required in production; AgentHub will not start without persistent storage.');
  }
}

export function productionDatabaseFailure(error, { production = isProd } = {}) {
  if (!production) return false;
  const startupError = new Error(`Production MongoDB connection failed: ${error?.message || 'unknown connection error'}`);
  startupError.cause = error;
  throw startupError;
}

function connectionState() {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return {
    appConnected: connected,
    mongooseReadyState: mongoose.connection.readyState,
    mongooseReadyStateName: states[mongoose.connection.readyState] || 'unknown',
  };
}

function topologySummary(topology) {
  if (!topology) return undefined;
  const servers = topology.servers instanceof Map
    ? [...topology.servers.entries()].map(([address, server]) => ({
        address,
        type: server?.description?.type,
        error: server?.description?.error?.message,
      }))
    : undefined;
  return {
    type: topology.type,
    compatible: topology.compatible,
    logicalSessionTimeoutMinutes: topology.logicalSessionTimeoutMinutes,
    servers,
  };
}

function clientTopologySummary() {
  const client = mongoose.connection.getClient?.();
  return topologySummary(client?.topology?.description);
}

function errorSummary(error) {
  return {
    name: error?.name,
    message: error?.message,
    code: error?.code,
    codeName: error?.codeName,
    reason: topologySummary(error?.reason),
  };
}

function logConnectionEvent(event, details = {}) {
  console.warn(`[db] MongoDB ${event}`, JSON.stringify({
    ...connectionState(),
    topology: clientTopologySummary(),
    ...details,
  }));
}

function bindMongoClientEvents() {
  if (mongoClientListenersBound) return;
  const client = mongoose.connection.getClient?.();
  if (!client) return;
  mongoClientListenersBound = true;

  client.on('serverDescriptionChanged', (event) => {
    logConnectionEvent('serverDescriptionChanged', {
      address: event?.address,
      previous: event?.previousDescription?.type,
      current: event?.newDescription?.type,
      error: event?.newDescription?.error?.message,
    });
  });
  client.on('topologyDescriptionChanged', (event) => {
    logConnectionEvent('topologyDescriptionChanged', {
      previousType: event?.previousDescription?.type,
      currentType: event?.newDescription?.type,
    });
  });
  client.on('serverHeartbeatStarted', (event) => {
    console.log('[db] MongoDB serverHeartbeatStarted', JSON.stringify({ address: event?.connectionId }));
  });
  client.on('serverHeartbeatSucceeded', (event) => {
    console.log('[db] MongoDB serverHeartbeatSucceeded', JSON.stringify({
      address: event?.connectionId,
      durationMS: event?.duration,
    }));
  });
  client.on('serverHeartbeatFailed', (event) => {
    logConnectionEvent('serverHeartbeatFailed', {
      address: event?.connectionId,
      failure: errorSummary(event?.failure),
    });
  });
}

function bindConnectionEvents() {
  if (connectionListenersBound) return;
  connectionListenersBound = true;

  mongoose.connection.on('connecting', () => {
    logConnectionEvent(hasConnectedOnce ? 'reconnecting' : 'connecting');
  });
  mongoose.connection.on('connected', () => {
    connected = true;
    bindMongoClientEvents();
    if (!hasConnectedOnce) {
      console.log('[db] MongoDB connected');
      hasConnectedOnce = true;
    }
    reconnectAttempt = 0;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  });
  mongoose.connection.on('disconnected', () => {
    connected = false;
    logConnectionEvent('disconnected');
    scheduleReconnect();
  });
  mongoose.connection.on('reconnected', () => {
    connected = true;
    bindMongoClientEvents();
    logConnectionEvent('reconnected');
    reconnectAttempt = 0;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  });
  mongoose.connection.on('error', (err) => {
    logConnectionEvent('connection error', { error: errorSummary(err) });
  });
}

function scheduleReconnect() {
  if (!env.mongoUri || shutdownRequested || reconnectTimer || connectInFlight || isDbConnected()) return;
  if (mongoose.connection.readyState === 2) return;

  reconnectAttempt += 1;
  const delay = Math.min(
    RECONNECT_BASE_DELAY_MS * 2 ** Math.min(reconnectAttempt - 1, 5),
    RECONNECT_MAX_DELAY_MS,
  );
  console.warn(`[db] MongoDB reconnecting in ${delay}ms (attempt ${reconnectAttempt})`);
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    if (
      shutdownRequested ||
      connectInFlight ||
      isDbConnected() ||
      mongoose.connection.readyState === 2
    ) return;

    connectInFlight = true;
    try {
      logConnectionEvent('reconnect attempt', { attempt: reconnectAttempt });
      await mongoose.connect(env.mongoUri, DB_CONNECT_OPTIONS);
      bindMongoClientEvents();
      connected = true;
    } catch (err) {
      connected = false;
      connectInFlight = false;
      logConnectionEvent('reconnect failed', {
        attempt: reconnectAttempt,
        error: errorSummary(err),
      });
      scheduleReconnect();
    } finally {
      connectInFlight = false;
    }
  }, delay);
  reconnectTimer.unref?.();
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
  await mongoose.connect(uri, DB_CONNECT_OPTIONS);
  console.log('[db] Using in-memory MongoDB (development, no MONGODB_URI set)');

  const { inserted } = await seedAgentCatalogue({ wipe: false });
  if (inserted > 0) {
    console.log(`[db] Seeded ${inserted} demo agents into in-memory database`);
  }

}

function scheduleIndexedRefresh({ reason, scheduled = false }) {
  if (indexedRefreshInFlightPromise) {
    if (scheduled) console.log('[db] Scheduled 8004scan refresh skipped: already running');
    return indexedRefreshInFlightPromise;
  }

  const scanAuthMode = env.scan8004ApiKey ? 'configured API key' : 'anonymous tier';
  if (scheduled) {
    console.log('[db] Scheduled 8004scan refresh started');
  } else {
    console.log(`[db] Starting incremental 8004scan refresh (${scanAuthMode}; ${reason})...`);
  }

  const refreshPromise = import('../services/indexedAgentIngestion.js')
    .then(({ refreshIndexedAgents }) => refreshIndexedAgents({ limit: 40 }))
    .then((result) => {
      const summary =
        `before=${result.beforeIndexed} after=${result.afterIndexed} ` +
        `processed=${result.processed} inserted=${result.inserted} updated=${result.updated} failed=${result.failed}`;
      if (scheduled) {
        console.log(`[db] Scheduled 8004scan refresh completed: ${summary}`);
      } else {
        console.log(`[db] Indexed refresh complete: ${summary}`);
      }
      return result;
    })
    .catch((err) => {
      if (scheduled) {
        console.warn(`[db] Scheduled 8004scan refresh failed: ${err.message}`);
      } else {
        console.warn(`[db] Indexed refresh skipped: ${err.message}`);
      }
      return null;
    });

  indexedRefreshInFlightPromise = refreshPromise.finally(() => {
    indexedRefreshInFlightPromise = null;
  });
  indexedRefreshPromise = indexedRefreshInFlightPromise;
  return indexedRefreshPromise;
}

function startIndexedRefreshSchedule() {
  if (indexedRefreshInterval) return;

  indexedRefreshInterval = setInterval(() => {
    if (shutdownRequested) return;
    scheduleIndexedRefresh({ reason: '12-hour schedule', scheduled: true });
  }, AGENT_REFRESH_INTERVAL_MS);
  indexedRefreshInterval.unref?.();
}

/** Used by verification scripts that need to wait for the background refresh. */
export function getIndexedRefreshPromise() {
  return indexedRefreshPromise || Promise.resolve(null);
}

/**
 * Connect to MongoDB.
 *   - MONGODB_URI set        → connect to that database (Atlas/production).
 *   - unset + development    → start an in-memory Mongo and auto-seed.
 *   - unset + production     → fail startup; persistence is required.
 */
export async function connectDatabase({ refresh = true } = {}) {
  mongoose.set('strictQuery', true);
  shutdownRequested = false;
  bindConnectionEvents();
  assertProductionDatabaseConfiguration();

  try {
    if (env.mongoUri) {
      connectInFlight = true;
      await mongoose.connect(env.mongoUri, DB_CONNECT_OPTIONS);
      bindMongoClientEvents();
      connected = true;

      const { inserted } = await seedAgentCatalogue({ wipe: false });
      if (inserted > 0) {
        console.log(`[db] Added ${inserted} missing curated agents to MongoDB`);
      }
      const { restoreVerifiedPaymentMetadata } = await import('../services/indexedAgentIngestion.js');
      await restoreVerifiedPaymentMetadata();
      if (refresh) {
        scheduleIndexedRefresh({ reason: 'MongoDB connected' });
        startIndexedRefreshSchedule();
      }
      return true;
    }

    await startInMemoryMongo();
    connected = true;
    bindConnectionEvents();
    if (refresh) {
      scheduleIndexedRefresh({ reason: 'in-memory development database' });
      startIndexedRefreshSchedule();
    }
    return true;
  } catch (err) {
    logConnectionEvent('initial connection failed', { error: errorSummary(err) });
    connected = false;
    connectInFlight = false;
    productionDatabaseFailure(err);
    scheduleReconnect();
    return false;
  } finally {
    connectInFlight = false;
  }
}

/**
 * Cleanly tear down the connection (and the in-memory server, if any).
 * Used by scripts and tests so the process can exit.
 */
export async function disconnectDatabase() {
  shutdownRequested = true;
  if (indexedRefreshInterval) {
    clearInterval(indexedRefreshInterval);
    indexedRefreshInterval = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
  connected = false;
}
