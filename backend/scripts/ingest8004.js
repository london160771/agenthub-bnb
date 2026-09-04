/**
 * Ingest live BSC agents from 8004scan into the AgentHub catalogue.
 * Preserves the 17 seeded agents; upserts indexed agents by erc8004Id.
 * Usage: node scripts/ingest8004.js [--dry-run] [--limit 40] [--wipe-indexed]
 * Env: SCAN8004_API_KEY optional (anonymous works), SCAN8004_BASE_URL optional.
 */
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { Agent } from '../models/Agent.js';
import { listAgents, getAgentDetail } from '../services/scan8004Client.js';
import { classifyAgent } from '../services/agentClassifier.js';
import { computeTrust } from '../services/trustScoreService.js';

// DeFi-phrased searches — verified in §9A to return BSC DeFi agents while
// avoiding medical health bots. Never use raw category name.
const SEARCHES = [
  'Venus',
  'liquidation',
  'yield',
  'grid trading',
  'rebalancing',
  'PancakeSwap',
  'BNB',
  'defi',
];

// These exact identities have adapter-specific task schemas verified in
// Phase 11.1B. The general classifier is intentionally conservative, but
// overlapping DeFi vocabulary can still choose health-factor for a yield
// description; the verified service identity is the stronger category evidence.
const VERIFIED_EXTERNAL_CATEGORIES = Object.freeze({
  '56:331752': 'yield',
  '56:331751': 'trading',
  '56:331625': 'health-factor',
  '56:331698': 'portfolio',
});

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeRegistryAgent(raw) {
  // raw shapes vary; fields seen: id, tokenId, chainId/chain_id, name, description,
  // tags, categories, services, agent_url/endpoint, owner/ownerAddress, token_id,
  // created_tx_hash, created_block_number, metadata, etc.
  const chainId = raw.chainId ?? raw.chain_id ?? raw.chain ?? 56;
  const tokenId = raw.tokenId ?? raw.token_id ?? raw.id ?? raw.agentId ?? raw.agent_id;
  // name/description
  const name = raw.name || raw.agentName || `Agent ${String(tokenId).slice(0, 8)}`;
  const description = raw.description || raw.desc || '';
  const tags = Array.isArray(raw.tags) ? raw.tags : [];
  const categories = Array.isArray(raw.categories) ? raw.categories : [];
  const services = Array.isArray(raw.services) ? raw.services : Array.isArray(raw.service) ? raw.service : [];
  const endpoint = raw.agent_url || raw.agentUrl || raw.endpoint || raw.url || '';
  const owner = raw.owner || raw.ownerAddress || raw.creator || raw.owner_address || '';
  const txHash = raw.created_tx_hash || raw.createdTxHash || raw.tx_hash || '';
  const blockNo = raw.created_block_number ?? raw.createdBlockNumber ?? raw.block_number ?? null;

  const classificationInput = { name, description, tags, categories, services, endpoint };
  const category = classifyAgent(classificationInput);

  return {
    raw,
    chainId,
    tokenId,
    name,
    description: description || `Registry agent ${name} — imported from 8004scan BSC registry.`,
    tags,
    categories,
    services,
    endpoint,
    owner,
    txHash,
    blockNo,
    classificationInput,
    category,
  };
}

function publishedEndpoint(detail) {
  const direct = detail?.a2a_endpoint || detail?.agent_url || detail?.agentUrl || detail?.endpoint;
  if (direct) return direct;
  const services = detail?.services;
  if (services && !Array.isArray(services) && typeof services === 'object') {
    const endpoint = Object.values(services).find((service) => service?.endpoint)?.endpoint;
    if (endpoint) return endpoint;
  }
  const offchainServices = detail?.raw_metadata?.offchain_content?.services;
  if (Array.isArray(offchainServices)) {
    const endpoint = offchainServices.find((service) => service?.endpoint)?.endpoint;
    if (endpoint) return endpoint;
  }
  return '';
}

function publishedSkills(detail) {
  const offchainSkills = detail?.raw_metadata?.offchain_content?.skills;
  return Array.isArray(offchainSkills)
    ? offchainSkills.flatMap((skill) => [skill?.id, skill?.name]).filter(Boolean)
    : [];
}

function toAgentDoc(norm, detail = null) {
  // detail enriches same fields plus scores etc.
  const extraTags = detail && Array.isArray(detail.tags) ? detail.tags : [];
  const extraServices = detail && Array.isArray(detail.services) ? detail.services : [];
  const mergedTags = [...new Set([...norm.tags, ...extraTags])].slice(0, 12);
  const mergedServices = [...new Set([...norm.services, ...extraServices, ...publishedSkills(detail)])];

  const detailName = detail?.name || norm.name;
  const detailDesc = detail?.description || norm.description;
  const detailEndpoint = publishedEndpoint(detail) || norm.endpoint;
  const detailOwner = detail?.owner || detail?.ownerAddress || norm.owner;
  const txHash = detail?.created_tx_hash || detail?.createdTxHash || norm.txHash || '';
  const blockNo = detail?.created_block_number ?? detail?.createdBlockNumber ?? norm.blockNo;

  const tokenId = norm.tokenId;
  const chainId = Number(norm.chainId) || 56;
  const erc8004Id = `${chainId}:${String(tokenId)}`;
  const category = VERIFIED_EXTERNAL_CATEGORIES[erc8004Id] || norm.category;

  // Do not invent pricing/metrics — use registry if present, else neutral defaults.
  // Trust will be computed from whatever we have.
  const pricing = { amount: 0, currency: 'BNB', model: 'per-task' };
  // registry may have pricing fields — attempt to read safely
  if (detail && detail.pricing && typeof detail.pricing.amount === 'number') {
    pricing.amount = detail.pricing.amount;
    if (detail.pricing.currency) pricing.currency = detail.pricing.currency;
    if (detail.pricing.model) pricing.model = detail.pricing.model;
  }

  const agentId = `8004-${chainId}-${String(tokenId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32)}`;

  const base = {
    agentId,
    name: String(detailName).slice(0, 120),
    tagline: String(detailDesc).slice(0, 160).split('.').slice(0, 1).join('.').slice(0, 120) || detailName,
    description: String(detailDesc).slice(0, 2000),
    category, // verified adapter categories override overlapping keyword scores
    subcategory: mergedServices.slice(0, 2).join(', ').slice(0, 80) || 'Registry agent',
    avatar: '',
    ownerAddress: detailOwner || '',
    chain: 'bnb',
    erc8004Id,
    endpoint: detailEndpoint || '',
    skills: mergedServices.slice(0, 8).length ? mergedServices.slice(0, 8) : mergedTags.slice(0, 6),
    protocols: mergedTags.filter((t) => /venus|pancake|bnb|bsc|defi/i.test(t)).slice(0, 4),
    tags: mergedTags,
    pricing,
    metrics: {
      executions: 0,
      successRate: null,
      avgResponseTime: null,
      activeSince: null,
      avgCost: null,
    },
    trust: {}, // filled via computeTrust
    trustScore: null,
    verified: false, // indexed, not on-chain verified by us
    status: 'live',
    lastActiveAt: null,
    reviewCount: 0,
    ratingAvg: null,
    source: 'indexed',
    // stash evidence link for provenance (stored as extra field via Mixed? use raw storage)
    // We add two non-schema fields via setIfNeeded: they will be persisted if schema allows mixed via strict:false?
    // Instead store evidence in available fields and log it. Keep txHash/blockNo in description note?
  };

  // attach evidence as extra keys that Agent schema will ignore if not defined.
  // To preserve them, we store in a way that Mongoose strict will drop them unless added.
  // So we stash them in a separate object returned alongside.
  const evidence = { created_tx_hash: txHash, created_block_number: blockNo, registryChainId: chainId, registryTokenId: tokenId };

  const trust = computeTrust(base);
  base.trust = trust;
  base.trustScore = trust.overall;

  return { doc: base, evidence };
}

async function collectCandidates({ limitPerSearch = 20, maxTotal = 120 }) {
  const seen = new Map(); // key `${chainId}:${tokenId}` -> raw
  let rateLimited = false;

  for (const term of SEARCHES) {
    if (seen.size >= maxTotal) break;
    try {
      const res = await listAgents({ chainId: 56, search: term, limit: limitPerSearch, offset: 0 });
      console.log(`[ingest] search "${term}" -> ${res.items.length}/${res.total} (rate ${res.rateLimit?.remainingMinute}/${res.rateLimit?.limitMinute})`);
      // verify filter actually took effect: if term != '' and total == global-like large and search didn't change, warn
      for (const item of res.items) {
        const tokenId = item.tokenId ?? item.token_id ?? item.id ?? item.agentId;
        const chainId = item.chainId ?? item.chain_id ?? 56;
        const key = `${chainId}:${String(tokenId)}`;
        if (!seen.has(key)) seen.set(key, item);
        if (seen.size >= maxTotal) break;
      }
      // anonymous 30/min — be polite
      await sleep(700);
    } catch (err) {
      console.error(`[ingest] search "${term}" failed: ${err.message}`);
      if (String(err.message).toLowerCase().includes('rate')) rateLimited = true;
      await sleep(1500);
    }
  }
  console.log(`[ingest] collected ${seen.size} unique candidates`);
  return { seen, rateLimited };
}

async function run({ dryRun = false, limit = 40, wipeIndexed = false, limitPerSearch = 12 } = {}) {
  await connectDatabase();
  // guard — if still disconnected
  if (mongoose.connection.readyState !== 1) {
    console.error('[ingest] No database connection — aborting');
    process.exit(1);
  }

  if (wipeIndexed) {
    const r = await Agent.deleteMany({ source: 'indexed' });
    console.log(`[ingest] wiped ${r.deletedCount} indexed agents`);
  }

  const existingSeeded = await Agent.countDocuments({ source: 'seeded' });
  console.log(`[ingest] seeded agents present: ${existingSeeded}`);

  const { seen } = await collectCandidates({ limitPerSearch, maxTotal: limit * 3 });

  const candidates = Array.from(seen.values()).slice(0, limit * 2); // oversample for classification filter
  const norms = candidates.map(normalizeRegistryAgent);

  // filter to classifiable only, then cap to limit
  const classifiable = norms.filter((n) => n.category != null);
  console.log(`[ingest] classifiable ${classifiable.length}/${norms.length}`);
  const dropped = norms.length - classifiable.length;
  if (dropped > 0) console.log(`[ingest] dropped ${dropped} unclassifiable (medical/other)`);

  const selected = classifiable.slice(0, limit);
  console.log(`[ingest] selected ${selected.length} for import`);

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const norm of selected) {
    let detail = null;
    try {
      const res = await getAgentDetail(norm.chainId, norm.tokenId);
      detail = res.detail;
      await sleep(400);
    } catch (err) {
      console.warn(`[ingest] detail ${norm.chainId}:${norm.tokenId} failed: ${err.message} — using list data`);
    }

    const { doc } = toAgentDoc(norm, detail);
    if (dryRun) {
      console.log(`[dry-run] would upsert ${doc.agentId} [${doc.category}] "${doc.name}" erc8004Id=${doc.erc8004Id}`);
      imported++;
      continue;
    }

    try {
      // upsert by erc8004Id
      await Agent.updateOne(
        { erc8004Id: doc.erc8004Id },
        { $set: doc, $setOnInsert: { createdAt: new Date() } },
        { upsert: true },
      );
      imported++;
      console.log(`[ingest] upserted ${doc.agentId} [${doc.category}]`);
    } catch (err) {
      console.error(`[ingest] upsert failed ${doc.agentId}: ${err.message}`);
      failed++;
    }
  }

  const indexedCount = await Agent.countDocuments({ source: 'indexed' });
  const totalCount = await Agent.estimatedDocumentCount();
  console.log(`[ingest] done. imported=${imported} failed=${failed} indexed=${indexedCount} total=${totalCount} seeded=${existingSeeded}`);
  console.log(`[ingest] provenance: categories derived by AgentHub classifier, not 8004scan; trust = AgentHub metric; source='indexed' (not verified)`);

  await disconnectDatabase();
  return { imported, failed, indexedCount, totalCount };
}

// CLI
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const wipeIndexed = args.includes('--wipe-indexed');
const limitArg = args.find((a) => a.startsWith('--limit'));
const limit = limitArg ? Number(limitArg.split('=')[1] || limitArg.split(' ')[1]) || 40 : 40;

const isMain = process.argv[1] && import.meta.url.endsWith('ingest8004.js');
if (isMain) {
  run({ dryRun, limit, wipeIndexed }).catch((err) => {
    console.error('[ingest] fatal', err);
    process.exit(1);
  });
}

export { run, normalizeRegistryAgent, toAgentDoc };
