/**
 * External-agent adapter registry.
 *
 * Catalog adapters are useful for honest discovery metadata. Execution adapters
 * are a separate class and only contain exact-identity adapters with verified
 * task/result evidence. Keeping the registry boundary prevents a catalog
 * adapter from being mistaken for an execution adapter.
 */
import { brainA2aAdapter } from './brainA2aAdapter.js';
import { assayYieldAdapter } from './assayYieldAdapter.js';
import { assayGridAdapter } from './assayGridAdapter.js';
import { smeaiHealthAdapter } from './smeaiHealthAdapter.js';
import { smeaiLpAdapter } from './smeaiLpAdapter.js';
import { hodlDanceAdapter } from './hodlDanceAdapter.js';
import { sentinelsAuditAdapter } from './sentinelsAuditAdapter.js';
import { rangePilotAdapter } from './rangePilotAdapter.js';
import { quickIntelAdapter } from './quickIntelAdapter.js';
import { isExternallyExecutableAgent } from '../agentCapabilities.js';
import { isPaymentReadyAgent } from '../agentCapabilities.js';

const catalogAdapters = [brainA2aAdapter];
const executionAdapters = [assayYieldAdapter, assayGridAdapter, smeaiHealthAdapter, smeaiLpAdapter, hodlDanceAdapter, sentinelsAuditAdapter, rangePilotAdapter, quickIntelAdapter];

export function getCatalogAdapterForAgent(agent) {
  return catalogAdapters.find((adapter) => adapter.canHandle(agent)) || null;
}

export function getExecutionAdapterForAgent(agent) {
  if (!isExternallyExecutableAgent(agent) && !isPaymentReadyAgent(agent)) return null;
  return executionAdapters.find((adapter) => adapter.canHandle(agent)) || null;
}

// Compatibility name for callers that may be added later. It never returns a
// catalog adapter, so catalog retrieval cannot accidentally complete a hire.
export function getAdapterForAgent(agent) {
  return getExecutionAdapterForAgent(agent);
}

export function isExecutableAgent(agent) {
  return Boolean(getExecutionAdapterForAgent(agent));
}

export const adapterRegistry = Object.freeze({
  catalogAdapters,
  executionAdapters,
  getAdapterForAgent,
  getCatalogAdapterForAgent,
  getExecutionAdapterForAgent,
  isExecutableAgent,
});
