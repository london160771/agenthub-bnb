/**
 * Turns the curated seed catalogue into full Agent documents and inserts them.
 *
 * Shared by two callers:
 *   - scripts/seed.js         (explicit `npm run seed` against a real MONGODB_URI)
 *   - config/db.js            (dev auto-seed into the in-memory Mongo when empty)
 *
 * Trust scores are ALWAYS derived here via computeTrust — never taken from the
 * seed file — so the score stays explainable and consistent with production.
 */
import { Agent } from '../models/Agent.js';
import { seedAgents } from '../data/seedAgents.js';
import { computeTrust } from './trustScoreService.js';

/**
 * Build a persistable Agent document from a raw seed entry.
 * Enforces the honesty invariants for seeded data: no fabricated on-chain
 * identity, explicit `source: 'seeded'`, and a computed trust breakdown.
 */
export function buildSeedDoc(raw) {
  const base = {
    ...raw,
    source: 'seeded',
    chain: 'bnb',
    // Seeded agents have no verified on-chain identity — never fabricate one.
    erc8004Id: null,
    ownerAddress: '',
  };

  const trust = computeTrust(base);
  return {
    ...base,
    trust,
    trustScore: trust.overall,
  };
}

export function buildSeedDocs() {
  return seedAgents.map(buildSeedDoc);
}

/**
 * Insert the seed catalogue.
 * @param {object} [opts]
 * @param {boolean} [opts.wipe=false]  Remove existing agents first (full reseed).
 * @returns {Promise<{inserted:number, skipped:boolean}>}
 */
export async function seedAgentCatalogue({ wipe = false } = {}) {
  if (wipe) {
    await Agent.deleteMany({});
  }

  const docs = buildSeedDocs();
  const existing = new Set(
    (await Agent.find({ agentId: { $in: docs.map((doc) => doc.agentId) } }).select('agentId').lean())
      .map((doc) => doc.agentId),
  );
  const missing = docs.filter((doc) => !existing.has(doc.agentId));
  if (missing.length > 0) await Agent.insertMany(missing, { ordered: false });
  return { inserted: missing.length, skipped: missing.length === 0 };
}
