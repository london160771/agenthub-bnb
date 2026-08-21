import { api } from './api.js';

/**
 * Agent marketplace API client. Thin wrappers over the shared `api` helper that
 * build query strings and hit the backend /api/agents endpoints.
 */

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    // Skip empty/false so we never send noise params to the API.
    if (value == null || value === '' || value === false) continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

/** GET /api/agents — list with filters, sort and pagination. */
export function listAgents(params, opts) {
  return api.get(`/agents${buildQuery(params)}`, opts);
}

/** GET /api/agents/facets — category counts for the discover tabs. */
export function getAgentFacets(opts) {
  return api.get('/agents/facets', opts);
}

/** GET /api/agents/:agentId — a single agent (used by the profile page later). */
export function getAgent(agentId, opts) {
  return api.get(`/agents/${encodeURIComponent(agentId)}`, opts);
}
