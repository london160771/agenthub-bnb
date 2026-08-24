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

/**
 * POST /api/executions/:executionId/run — start (or retry) the agent's work.
 *
 * Returns as soon as the run is claimed, not when it finishes, so the caller
 * polls `getExecution` for progress. `data.started` is false when another
 * request already owns the run — which is a normal outcome, not an error.
 *
 * This still signs nothing: the agent reads public chain data and writes a
 * result. No transaction is created.
 */
export function runExecution(executionId, opts) {
  return api.post(`/executions/${encodeURIComponent(executionId)}/run`, undefined, opts);
}
