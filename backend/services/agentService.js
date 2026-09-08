/**
 * Read-side query logic for the agent marketplace.
 *
 * Parsing/validation of raw query strings happens in the controller; this
 * module receives already-coerced values and builds the Mongoose query.
 */
import { Agent, AGENT_CATEGORIES } from '../models/Agent.js';
import { AGENT_CAPABILITIES, decorateAgent, getAgentCapability } from './agentCapabilities.js';
import { capabilityDetailsFor } from './agentCapabilityModel.js';
import { isPaidExecutionEligibleAgent } from './adapters/registry.js';

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

/**
 * The default marketplace view puts agents a judge can use first. The
 * capability is computed from the same backend-authoritative evidence used by
 * execution, never from a name, endpoint, price, or persisted snapshot.
 */
export const DEFAULT_AVAILABILITY_PRIORITY = Object.freeze({
  [AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID]: 0,
  [AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID_READY]: 1,
  [AGENT_CAPABILITIES.INDEXED_EXECUTABLE_FREE]: 2,
  [AGENT_CAPABILITIES.LOCAL_EXECUTABLE]: 3,
  [AGENT_CAPABILITIES.INDEXED_CATALOG_VERIFIED]: 4,
  [AGENT_CAPABILITIES.INDEXED_WATCH_ONLY]: 5,
});

export const DEFAULT_AVAILABILITY_SORT = 'availability';

export const AGENT_SORT_KEYS = [...Object.keys(SORTS), DEFAULT_AVAILABILITY_SORT];

// Exclude Mongo internals; the public identifier is `agentId`.
const PROJECTION = '-__v -_id';

function decorateForApi(agent) {
  if (!agent) return agent;
  const capabilityDetails = capabilityDetailsFor(agent);
  return {
    ...decorateAgent(agent),
    capabilityDetails: {
      ...capabilityDetails,
      execution: {
        ...capabilityDetails.execution,
        paidExecutionEligible: isPaidExecutionEligibleAgent(agent),
      },
    },
  };
}

export function summarizeCapabilities(agents) {
  return agents.reduce((summary, agent) => {
    const capability = getAgentCapability(agent);
    if (capability === AGENT_CAPABILITIES.INDEXED_EXECUTABLE_FREE) summary.freeExecutable += 1;
    else if (
      capability === AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID ||
      capability === AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID_READY
    ) summary.paid += 1;
    else if (capability === AGENT_CAPABILITIES.LOCAL_EXECUTABLE) summary.builtIn += 1;
    else summary.watchOnlyCatalog += 1;
    return summary;
  }, { freeExecutable: 0, paid: 0, builtIn: 0, watchOnlyCatalog: 0 });
}

function availabilityPriority(agent) {
  const capability = getAgentCapability(agent);
  return DEFAULT_AVAILABILITY_PRIORITY[capability] ?? DEFAULT_AVAILABILITY_PRIORITY[AGENT_CAPABILITIES.INDEXED_WATCH_ONLY];
}

/** Stable secondary ordering keeps the default marketplace calm between visits. */
export function compareByDefaultAvailability(a, b) {
  const priorityDelta = availabilityPriority(a) - availabilityPriority(b);
  if (priorityDelta !== 0) return priorityDelta;

  const trustDelta = (b.trustScore ?? -1) - (a.trustScore ?? -1);
  if (trustDelta !== 0) return trustDelta;

  const reviewDelta = (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
  if (reviewDelta !== 0) return reviewDelta;

  return String(a.agentId || '').localeCompare(String(b.agentId || ''));
}

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
  const sortKey = opts.sort || 'trust';
  const filter = buildFilter(opts);

  if (sortKey === DEFAULT_AVAILABILITY_SORT) {
    // Capability is derived in JavaScript from the authoritative allowlists
    // and verified payment facts, so fetch the full filtered set before
    // sorting and paginating. A Mongo sort on `capability` would trust a
    // snapshot field and could split a capability group across pages.
    const allAgents = await Agent.find(filter).select(PROJECTION).lean();
    const sorted = allAgents.sort(compareByDefaultAvailability);
    const start = (page - 1) * limit;
    return {
      items: sorted.slice(start, start + limit).map(decorateForApi),
      total: sorted.length,
      page,
      limit,
      pages: Math.max(1, Math.ceil(sorted.length / limit)),
      capabilitySummary: summarizeCapabilities(sorted),
    };
  }

  const sort = SORTS[sortKey] || SORTS.trust;

  const [items, total] = await Promise.all([
    Agent.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .select(PROJECTION)
      .lean(),
    Agent.countDocuments(filter),
  ]);

  const capabilitySummary = opts.includeSummary
    ? summarizeCapabilities(await Agent.find(filter).select(PROJECTION).lean())
    : undefined;

  return {
    items: items.map(decorateForApi),
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
    ...(capabilitySummary ? { capabilitySummary } : {}),
  };
}

export async function getAgentById(agentId) {
  const agent = await Agent.findOne({ agentId }).select(PROJECTION).lean();
  return decorateForApi(agent);
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
