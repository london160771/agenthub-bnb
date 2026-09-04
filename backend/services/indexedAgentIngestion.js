/**
 * Incremental 8004scan -> Agent catalogue refresh.
 *
 * This module assumes the caller has already connected Mongoose. It never
 * opens or closes a database connection, so startup refreshes and the CLI use
 * the same persistence boundary without creating a second Mongoose client.
 */
import { Agent } from '../models/Agent.js';
import { listAgents, getAgentDetail } from './scan8004Client.js';
import { classifyAgent } from './agentClassifier.js';
import { computeTrust } from './trustScoreService.js';
import { getAgentCapability } from './agentCapabilities.js';

const SEARCHES = [
  // Keep targeted provider searches ahead of broad terms so known paid
  // candidates are not crowded out by the first broad result pages.
  'Sentinels', 'Quick Intel',
  'Venus', 'liquidation', 'yield', 'grid trading', 'rebalancing',
  'PancakeSwap', 'BNB', 'defi', 'trading', 'portfolio', 'security',
  'audit', 'lending', 'liquidity', 'LP',
];

const VERIFIED_EXTERNAL_CATEGORIES = Object.freeze({
  '56:331752': 'yield',
  '56:331751': 'trading',
  '56:331625': 'health-factor',
  '56:331698': 'portfolio',
  '56:96231': 'trading',
});

const PAYMENT_TYPES = new Set(['free', 'x402', 'erc8183', 'other', 'unknown']);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizePaymentType(value) {
  const type = asText(value).toLowerCase();
  if (!type) return 'unknown';
  if (type.includes('x402')) return 'x402';
  if (type.includes('8183') || type.includes('erc-8183')) return 'erc8183';
  if (type === 'free' || type === 'none') return 'free';
  return PAYMENT_TYPES.has(type) ? type : 'other';
}

function paymentSources(detail, raw) {
  const offchain = detail?.raw_metadata?.offchain_content || {};
  const directPaymentKeys = new Set([
    'paymentType', 'payment_type', 'price', 'payment', 'pricing',
    'paymentRequirements', 'payment_requirements', 'x402', 'erc8183', 'x402_supported',
  ]);
  const values = [
    detail && Object.keys(detail).some((key) => directPaymentKeys.has(key)) ? detail : null,
    raw && Object.keys(raw).some((key) => directPaymentKeys.has(key)) ? raw : null,
    detail?.payment,
    detail?.paymentRequirements,
    detail?.payment_requirements,
    detail?.pricing,
    offchain.payment,
    offchain.paymentRequirements,
    offchain.payment_requirements,
    offchain.pricing,
  ];
  const paymentKeys = new Set([
    'type', 'paymentType', 'payment_type', 'protocol', 'amount', 'price', 'value',
    'token', 'paymentToken', 'payment_token', 'asset', 'currency', 'symbol',
    'requiresWallet', 'requiresMainnetTx',
  ]);
  const sources = values.filter((value) => (
    value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).some((key) => paymentKeys.has(key))
  ));
  const x402Supported = detail?.x402_supported === true || raw?.x402_supported === true || offchain.x402support === true;
  if (x402Supported) sources.push({ type: 'x402' });
  return sources;
}

function extractPaymentMetadata(detail, raw) {
  const sources = paymentSources(detail, raw);
  const merged = Object.assign({}, ...sources);
  const amount = asNumber(merged.amount ?? merged.price ?? merged.value);
  const token = asText(merged.token ?? merged.paymentToken ?? merged.payment_token ?? merged.asset);
  const currency = asText(merged.currency ?? merged.symbol) || token;
  const type = normalizePaymentType(merged.type ?? merged.paymentType ?? merged.payment_type ?? merged.protocol);
  const hasExplicitEvidence = sources.length > 0 || amount != null || token || type !== 'unknown';

  return {
    type: type === 'unknown' && amount === 0 ? 'free' : type,
    status: hasExplicitEvidence ? 'advertised' : 'unknown',
    amount,
    token: token || null,
    currency: currency || null,
    requiresWallet: typeof merged.requiresWallet === 'boolean' ? merged.requiresWallet : null,
    requiresMainnetTx: typeof merged.requiresMainnetTx === 'boolean' ? merged.requiresMainnetTx : null,
  };
}

function normalizeRegistryAgent(raw) {
  const chainId = raw.chainId ?? raw.chain_id ?? raw.chain ?? 56;
  const tokenId = raw.tokenId ?? raw.token_id ?? raw.id ?? raw.agentId ?? raw.agent_id;
  const name = raw.name || raw.agentName || `Agent ${String(tokenId).slice(0, 8)}`;
  const description = raw.description || raw.desc || '';
  const tags = Array.isArray(raw.tags) ? raw.tags : [];
  const categories = Array.isArray(raw.categories) ? raw.categories : [];
  const services = Array.isArray(raw.services)
    ? raw.services
    : Array.isArray(raw.service)
      ? raw.service
      : [];
  const endpoint = raw.agent_url || raw.agentUrl || raw.endpoint || raw.url || '';

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
    owner: raw.owner || raw.ownerAddress || raw.creator || raw.owner_address || '',
    category: classifyAgent({ name, description, tags, categories, services, endpoint }),
  };
}

function publishedEndpoint(detail) {
  const direct = detail?.a2a_endpoint || detail?.agent_url || detail?.agentUrl || detail?.endpoint;
  if (direct) return direct;
  const services = detail?.services;
  if (Array.isArray(services)) return services.find((service) => service?.endpoint)?.endpoint || '';
  if (services && typeof services === 'object') {
    const endpoints = Object.values(services).map((service) => service?.endpoint).filter(asText);
    const operational = endpoints.find((endpoint) => !/github\.com\/agntcy\/oasf/i.test(endpoint));
    if (operational) return operational;
  }
  const offchainServices = detail?.raw_metadata?.offchain_content?.services;
  if (Array.isArray(offchainServices)) {
    return offchainServices.find((service) => service?.endpoint && !/github\.com\/agntcy\/oasf/i.test(service.endpoint))?.endpoint
      || offchainServices.find((service) => service?.endpoint)?.endpoint || '';
  }
  if (services && typeof services === 'object') {
    return Object.values(services).find((service) => service?.endpoint)?.endpoint || '';
  }
  return '';
}

function publishedServiceEndpoints(norm, detail) {
  const values = [norm.endpoint];
  const services = detail?.services;
  if (Array.isArray(services)) values.push(...services.map((service) => service?.endpoint));
  if (services && typeof services === 'object' && !Array.isArray(services)) {
    values.push(...Object.values(services).map((service) => service?.endpoint));
  }
  const offchainServices = detail?.raw_metadata?.offchain_content?.services;
  if (Array.isArray(offchainServices)) values.push(...offchainServices.map((service) => service?.endpoint));
  return [...new Set(values.map(asText).filter(Boolean))];
}

function publishedSkills(detail) {
  const skills = detail?.raw_metadata?.offchain_content?.skills;
  return Array.isArray(skills)
    ? skills.flatMap((skill) => [skill?.id, skill?.name]).map(asText).filter(Boolean)
    : [];
}

function toAgentDoc(norm, detail = null) {
  const extraTags = detail && Array.isArray(detail.tags) ? detail.tags : [];
  const extraServices = detail && Array.isArray(detail.services)
    ? detail.services.map((service) => (typeof service === 'string' ? service : service?.name || service?.id || ''))
    : [];
  const mergedTags = [...new Set([...norm.tags, ...extraTags].map(asText).filter(Boolean))].slice(0, 12);
  const mergedServices = [...new Set([...norm.services, ...extraServices, ...publishedSkills(detail)].map(asText).filter(Boolean))];
  const chainId = Number(norm.chainId) || 56;
  const tokenId = norm.tokenId;
  const erc8004Id = `${chainId}:${String(tokenId)}`;
  const detailName = detail?.name || norm.name;
  const detailDesc = detail?.description || norm.description;
  const endpoint = publishedEndpoint(detail) || norm.endpoint;
  const serviceEndpoints = publishedServiceEndpoints(norm, detail);
  const payment = extractPaymentMetadata(detail, norm.raw);
  const pricing = {
    amount: payment.amount,
    currency: payment.currency || '',
    model: payment.amount == null ? 'unknown' : 'per-task',
  };

  const base = {
    agentId: `8004-${chainId}-${String(tokenId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32)}`,
    name: String(detailName).slice(0, 120),
    tagline: String(detailDesc).slice(0, 160).split('.').slice(0, 1).join('.').slice(0, 120) || detailName,
    description: String(detailDesc).slice(0, 2000),
    category: VERIFIED_EXTERNAL_CATEGORIES[erc8004Id] || classifyAgent({
      name: detailName,
      description: detailDesc,
      tags: [...norm.tags, ...extraTags],
      categories: [...norm.categories, ...(Array.isArray(detail?.categories) ? detail.categories : [])],
      services: mergedServices,
      endpoint,
    }) || norm.category,
    subcategory: mergedServices.slice(0, 2).join(', ').slice(0, 80) || 'Registry agent',
    avatar: '',
    ownerAddress: detail?.owner || detail?.ownerAddress || detail?.owner_address || norm.owner || '',
    chain: 'bnb',
    erc8004Id,
    endpoint: endpoint || serviceEndpoints[0] || '',
    serviceEndpoints,
    skills: mergedServices.slice(0, 8).length ? mergedServices.slice(0, 8) : mergedTags.slice(0, 6),
    protocols: mergedTags.filter((tag) => /venus|pancake|bnb|bsc|defi/i.test(tag)).slice(0, 4),
    tags: mergedTags,
    pricing,
    payment,
    metrics: { executions: 0, successRate: null, avgResponseTime: null, activeSince: null, avgCost: null },
    trust: {},
    trustScore: null,
    verified: false,
    status: 'live',
    lastActiveAt: null,
    reviewCount: 0,
    ratingAvg: null,
    source: 'indexed',
    lastIndexedAt: new Date(),
    lastVerifiedAt: null,
  };

  const trust = computeTrust(base);
  base.trust = trust;
  base.trustScore = trust.overall;
  base.capability = getAgentCapability(base);
  return { doc: base, evidence: { chainId, tokenId } };
}

async function collectCandidates({ limitPerSearch = 20, maxTotal = 120, logger = console } = {}) {
  const seen = new Map();
  let rateLimited = false;
  for (const term of SEARCHES) {
    if (seen.size >= maxTotal) break;
    try {
      const result = await listAgents({ chainId: 56, search: term, limit: limitPerSearch, offset: 0 });
      logger.log(`[ingest] search "${term}" -> ${result.items.length}/${result.total} (rate ${result.rateLimit?.remainingMinute ?? 'n/a'}/${result.rateLimit?.limitMinute ?? 'n/a'})`);
      for (const item of result.items) {
        const tokenId = item.tokenId ?? item.token_id ?? item.id ?? item.agentId;
        const chainId = item.chainId ?? item.chain_id ?? 56;
        const key = `${chainId}:${String(tokenId)}`;
        if (!seen.has(key)) seen.set(key, item);
        if (seen.size >= maxTotal) break;
      }
      await sleep(700);
    } catch (err) {
      logger.warn(`[ingest] search "${term}" failed: ${err.message}`);
      if (String(err.message).toLowerCase().includes('rate')) rateLimited = true;
      await sleep(1500);
    }
  }
  logger.log(`[ingest] collected ${seen.size} unique candidates`);
  return { seen, rateLimited };
}

/** Refresh indexed records while preserving all saved records on failure. */
export async function refreshIndexedAgents({ limit = 40, limitPerSearch = 20, dryRun = false, wipeIndexed = false, logger = console } = {}) {
  if (wipeIndexed) {
    const result = await Agent.deleteMany({ source: 'indexed' });
    logger.log(`[ingest] explicitly wiped ${result.deletedCount} indexed agents`);
  }
  const beforeIndexed = await Agent.countDocuments({ source: 'indexed' });
  const { seen, rateLimited } = await collectCandidates({ limitPerSearch, maxTotal: limit * 3, logger });
  const norms = Array.from(seen.values()).map(normalizeRegistryAgent);
  // Some real agents publish category, skills, and payment protocol only in
  // detail metadata. Do not discard a list row before fetching its detail.
  const selected = norms.slice(0, limit);
  let processed = 0;
  let inserted = 0;
  let updated = 0;
  let failed = 0;
  let skipped = 0;

  logger.log(`[ingest] collected ${norms.length} candidates; selected ${selected.length} for detail verification`);
  for (const norm of selected) {
    let detail = null;
    try {
      const result = await getAgentDetail(norm.chainId, norm.tokenId);
      detail = result.detail;
      await sleep(400);
    } catch (err) {
      logger.warn(`[ingest] detail ${norm.chainId}:${norm.tokenId} failed: ${err.message} — using list data`);
    }

    const { doc } = toAgentDoc(norm, detail);
    if (!doc.category) {
      skipped++;
      logger.warn(`[ingest] skipping ${doc.agentId}: no supported marketplace category in published metadata`);
      continue;
    }
    if (dryRun) {
      logger.log(`[dry-run] would upsert ${doc.agentId} [${doc.category}] "${doc.name}" erc8004Id=${doc.erc8004Id}`);
      processed++;
      continue;
    }

    try {
      const result = await Agent.updateOne(
        { erc8004Id: doc.erc8004Id },
        { $set: doc, $setOnInsert: { createdAt: new Date() } },
        { upsert: true },
      );
      processed++;
      if (result.upsertedCount || result.upsertedId) inserted++;
      else updated++;
    } catch (err) {
      logger.error(`[ingest] upsert failed ${doc.agentId}: ${err.message}`);
      failed++;
    }
  }

  const afterIndexed = await Agent.countDocuments({ source: 'indexed' });
  return { beforeIndexed, afterIndexed, seen: seen.size, selected: selected.length, processed, inserted, updated, failed, skipped, rateLimited };
}

export { collectCandidates, normalizeRegistryAgent, toAgentDoc, SEARCHES };
