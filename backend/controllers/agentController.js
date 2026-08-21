/**
 * HTTP layer for the agent marketplace. Parses and validates query params,
 * guards on database availability, and delegates to agentService.
 */
import { isDbConnected } from '../config/db.js';
import { AGENT_CATEGORIES, AGENT_STATUSES } from '../models/Agent.js';
import {
  listAgents,
  getAgentById,
  getCategoryFacets,
  AGENT_SORT_KEYS,
} from '../services/agentService.js';
import { ApiError, sendSuccess, asyncHandler } from '../utils/apiResponse.js';

function ensureDb() {
  if (!isDbConnected()) {
    throw ApiError.unavailable('The marketplace database is not available right now.');
  }
}

function parseIntParam(value, { min, max, fallback, name }) {
  if (value == null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw ApiError.badRequest(`"${name}" must be a number.`);
  }
  const rounded = Math.trunc(n);
  if (min != null && rounded < min) return min;
  if (max != null && rounded > max) return max;
  return rounded;
}

function parseNumberParam(value, { min, max, name }) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw ApiError.badRequest(`"${name}" must be a number.`);
  }
  if (min != null && n < min) throw ApiError.badRequest(`"${name}" must be >= ${min}.`);
  if (max != null && n > max) throw ApiError.badRequest(`"${name}" must be <= ${max}.`);
  return n;
}

/** GET /api/agents */
export const getAgents = asyncHandler(async (req, res) => {
  ensureDb();
  const q = req.query;

  const category = q.category ? String(q.category) : null;
  if (category && !AGENT_CATEGORIES.includes(category)) {
    throw ApiError.badRequest(`Unknown category "${category}".`, {
      allowed: AGENT_CATEGORIES,
    });
  }

  const status = q.status ? String(q.status) : null;
  if (status && !AGENT_STATUSES.includes(status)) {
    throw ApiError.badRequest(`Unknown status "${status}".`, { allowed: AGENT_STATUSES });
  }

  const sort = q.sort ? String(q.sort) : 'trust';
  if (!AGENT_SORT_KEYS.includes(sort)) {
    throw ApiError.badRequest(`Unknown sort "${sort}".`, { allowed: AGENT_SORT_KEYS });
  }

  let verified = null;
  if (q.verified === 'true') verified = true;
  else if (q.verified === 'false') verified = false;

  const result = await listAgents({
    q: q.q ? String(q.q).trim().slice(0, 100) : null,
    category,
    status,
    sort,
    verified,
    minTrust: parseNumberParam(q.minTrust, { min: 0, max: 100, name: 'minTrust' }),
    minSuccess: parseNumberParam(q.minSuccess, { min: 0, max: 100, name: 'minSuccess' }),
    minPrice: parseNumberParam(q.minPrice, { min: 0, name: 'minPrice' }),
    maxPrice: parseNumberParam(q.maxPrice, { min: 0, name: 'maxPrice' }),
    protocol: q.protocol ? String(q.protocol) : null,
    skill: q.skill ? String(q.skill) : null,
    page: parseIntParam(q.page, { min: 1, fallback: 1, name: 'page' }),
    limit: parseIntParam(q.limit, { min: 1, max: 100, fallback: 24, name: 'limit' }),
  });

  sendSuccess(res, result);
});

/** GET /api/agents/facets */
export const getAgentFacets = asyncHandler(async (req, res) => {
  ensureDb();
  const facets = await getCategoryFacets();
  sendSuccess(res, facets);
});

/** GET /api/agents/:agentId */
export const getAgent = asyncHandler(async (req, res) => {
  ensureDb();
  const agent = await getAgentById(String(req.params.agentId));
  if (!agent) {
    throw ApiError.notFound(`No agent found with id "${req.params.agentId}".`);
  }
  sendSuccess(res, agent);
});
