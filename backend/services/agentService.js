/**
 * Read-side query logic for the agent marketplace.
 *
 * Parsing/validation of raw query strings happens in the controller; this
 * module receives already-coerced values and builds the Mongoose query.
 */
import { Agent, AGENT_CATEGORIES } from '../models/Agent.js';
import { decorateAgent } from './agentCapabilities.js';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 24;

const SORTS = {
  trust: { trustScore: -1, reviewCount: -1 },
  executions: { 'metrics.executions': -1 },
  success: { 'metrics.successRate': -1, 'metrics.executions': -1 },
  rating: { ratingAvg: -1, reviewCount: -1 },
  'price-low': { 'pricing.amount': 1 },
  'price-high': { 'pricing.amount': -1 },
  recent: { lastActiveAt: -1 },
};

export const AGENT_SORT_KEYS = Object.keys(SORTS);

// Exclude Mongo internals; the public identifier is `agentId`.
const PROJECTION = '-__v -_id';

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build the Mongoose filter object from coerced options.
 */
function buildFilter(opts) {
  const filter = {};

  if (opts.category) filter.category = opts.category;
  if (opts.status) filter.status = opts.status;
  if (opts.verified != null) filter.verified = opts.verified;
  if (opts.minTrust != null) filter.trustScore = { $gte: opts.minTrust };
  if (opts.minSuccess != null) filter['metrics.successRate'] = { $gte: opts.minSuccess };
  if (opts.minPrice != null || opts.maxPrice != null) {
    const price = {};
    if (opts.minPrice != null) price.$gte = opts.minPrice;
    if (opts.maxPrice != null) price.$lte = opts.maxPrice;
    filter['pricing.amount'] = price;
  }
  if (opts.protocol) filter.protocols = opts.protocol;
  if (opts.skill) filter.skills = opts.skill;

  if (opts.q) {
    const rx = new RegExp(escapeRegex(opts.q), 'i');
    filter.$or = [
      { name: rx },
      { tagline: rx },
      { description: rx },
      { skills: rx },
      { protocols: rx },
      { tags: rx },
      { subcategory: rx },
    ];
  }

  return filter;
}

/**
 * List agents with filtering, sorting and pagination.
 * @returns {Promise<{items:object[], total:number, page:number, limit:number, pages:number}>}
 */
export async function listAgents(opts = {}) {
  const page = Math.max(1, opts.page || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, opts.limit || DEFAULT_LIMIT));
  const sort = SORTS[opts.sort] || SORTS.trust;
  const filter = buildFilter(opts);

  const [items, total] = await Promise.all([
    Agent.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .select(PROJECTION)
      .lean(),
    Agent.countDocuments(filter),
  ]);

  return {
    items: items.map(decorateAgent),
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getAgentById(agentId) {
  const agent = await Agent.findOne({ agentId }).select(PROJECTION).lean();
  return decorateAgent(agent);
}

/**
 * Category counts for the discover sidebar. Always returns an entry for every
 * known category (0 when none), so the UI can render a stable list.
 */
export async function getCategoryFacets() {
  const rows = await Agent.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]);
  const counts = Object.fromEntries(rows.map((r) => [r._id, r.count]));
  const total = await Agent.estimatedDocumentCount();
  return {
    total,
    categories: AGENT_CATEGORIES.map((category) => ({
      category,
      count: counts[category] || 0,
    })),
  };
}
