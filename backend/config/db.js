import mongoose from 'mongoose';
import { env, isProd } from './env.js';
import { seedAgentCatalogue } from '../services/agentSeeder.js';

let connected = false;
let memoryServer = null;

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

  // Best-effort live BSC ingest so the marketplace is eligible even on ephemeral DB.
  // Anonymous tier works; no key required. Failure is logged, not fatal.
  try {
    const { Agent } = await import('../models/Agent.js');
    const indexedCount = await Agent.countDocuments({ source: 'indexed' });
    if (indexedCount === 0) {
      console.log('[db] No indexed agents — fetching live BSC agents from 8004scan (anonymous tier)...');
      const { listAgents, getAgentDetail } = await import('../services/scan8004Client.js');
      const { classifyAgent } = await import('../services/agentClassifier.js');
      const { computeTrust } = await import('../services/trustScoreService.js');

      const SEARCHES = ['Venus', 'liquidation', 'yield', 'grid trading', 'PancakeSwap'];
      const seen = new Map();
      for (const term of SEARCHES) {
        try {
          const r = await listAgents({ chainId: 56, search: term, limit: 8, offset: 0 });
          for (const it of r.items) {
            const key = `${it.chain_id}:${it.token_id || it.id}`;
            if (!seen.has(key)) seen.set(key, it);
          }
          await new Promise((res) => setTimeout(res, 600));
        } catch (e) {
          console.warn(`[db] 8004scan search "${term}" failed: ${e.message}`);
        }
        if (seen.size >= 16) break;
      }
      const candidates = Array.from(seen.values());
      let imported = 0;
      for (const raw of candidates) {
        const classificationInput = {
          name: raw.name || '',
          description: raw.description || '',
          tags: raw.tags || [],
          categories: raw.categories || [],
          services: raw.services || [],
        };
        const category = classifyAgent(classificationInput);
        if (!category) continue;
        let detail = null;
        try {
          const d = await getAgentDetail(raw.chain_id, raw.token_id);
          detail = d.detail;
          await new Promise((res) => setTimeout(res, 350));
        } catch {}
        const tokenId = raw.token_id || raw.id;
        const chainId = raw.chain_id || 56;
        const erc8004Id = `${chainId}:${String(tokenId)}`;
        const agentId = `8004-${chainId}-${String(tokenId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32)}`;
        const name = (detail?.name || raw.name || `Agent ${String(tokenId).slice(0, 8)}`).slice(0, 120);
        const description = (detail?.description || raw.description || '').slice(0, 2000) || `Registry agent ${name} — imported from 8004scan BSC registry.`;
        const endpoint = detail?.agent_url || detail?.endpoint || detail?.services?.a2a?.endpoint || '';
        const owner = detail?.owner_address || raw.owner_address || '';
        const tags = Array.isArray(detail?.tags) && detail.tags.length ? detail.tags : raw.tags || [];
        const services = detail?.services ? Object.values(detail.services).map((s) => s.endpoint || '').filter(Boolean) : [];
        const base = {
          agentId,
          name,
          tagline: description.slice(0, 120).split('.').slice(0, 1).join('.'),
          description,
          category,
          subcategory: (detail?.categories || []).join(', ').slice(0, 80) || 'Registry agent',
          avatar: '',
          ownerAddress: owner,
          chain: 'bnb',
          erc8004Id,
          endpoint: endpoint || services[0] || '',
          skills: tags.slice(0, 6).length ? tags.slice(0, 6) : ['discovered'],
          protocols: tags.filter((t) => /venus|pancake|bnb|bsc|defi/i.test(t)).slice(0, 4),
          tags: tags.slice(0, 12),
          pricing: { amount: 0, currency: 'BNB', model: 'per-task' },
          metrics: { executions: 0, successRate: null, avgResponseTime: null, activeSince: null, avgCost: null },
          trust: {},
          trustScore: null,
          verified: false,
          status: 'live',
          lastActiveAt: null,
          reviewCount: 0,
          ratingAvg: null,
          source: 'indexed',
        };
        const trust = computeTrust(base);
        base.trust = trust;
        base.trustScore = trust.overall;
        try {
          await Agent.updateOne({ erc8004Id }, { $set: base }, { upsert: true });
          imported++;
          if (imported >= 12) break;
        } catch (e) {
          console.warn(`[db] indexed upsert failed ${agentId}: ${e.message}`);
        }
      }
      console.log(`[db] Indexed ingest: imported ${imported} BSC agents (total seen ${seen.size})`);
    }
  } catch (e) {
    console.warn('[db] Indexed ingest skipped:', e.message);
  }
}

/**
 * Connect to MongoDB.
 *   - MONGODB_URI set        → connect to that database (Atlas/production).
 *   - unset + development    → start an in-memory Mongo and auto-seed.
 *   - unset + production     → boot without a DB; data endpoints report
 *                              SERVICE_UNAVAILABLE until one is configured.
 */
export async function connectDatabase() {
  mongoose.set('strictQuery', true);

  try {
    if (env.mongoUri) {
      await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 8000 });
      connected = true;
      bindConnectionEvents();
      console.log('[db] Connected to MongoDB');

      const count = await mongoose.connection.db.collection('agents').estimatedDocumentCount();
      if (count === 0) {
        console.warn('[db] No agents found — run `npm run seed` to populate the catalogue.');
      }
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
