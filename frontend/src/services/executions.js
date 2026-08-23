import { api } from './api.js';

/**
 * Execution (hire record) API client. Thin wrappers in the same style as
 * services/agents.js.
 *
 * Note what is NOT here: nothing signs or broadcasts a transaction. Creating an
 * execution is an ordinary HTTP POST to our own backend — the cost shown on the
 * hire page is recorded, not charged.
 */

/**
 * POST /api/executions — hire an agent.
 *
 * Body: `{ agentId, userAddress, chainId, task, input }`. The backend derives
 * cost, currency and chain itself, so anything price-related sent from here
 * would be ignored.
 */
export function createExecution(body, opts) {
  return api.post('/executions', body, opts);
}

/** GET /api/executions/:executionId */
export function getExecution(executionId, opts) {
  return api.get(`/executions/${encodeURIComponent(executionId)}`, opts);
}
