/**
 * External-agent adapter registry.
 *
 * Catalog adapters are useful for honest discovery metadata. Execution adapters
 * are a separate class and are deliberately empty until a real task/result
 * verification exists. Keeping the registry boundary now prevents a future
 * catalog adapter from being mistaken for an execution adapter.
 */
import { brainA2aAdapter } from './brainA2aAdapter.js';
import { assayYieldAdapter } from './assayYieldAdapter.js';
import { assayGridAdapter } from './assayGridAdapter.js';
import { smeaiHealthAdapter } from './smeaiHealthAdapter.js';
import { smeaiLpAdapter } from './smeaiLpAdapter.js';
import { AGENT_CAPABILITIES, getAgentCapability } from '../agentCapabilities.js';

const catalogAdapters = [brainA2aAdapter];
const executionAdapters = [assayYieldAdapter, assayGridAdapter, smeaiHealthAdapter, smeaiLpAdapter];

export function getCatalogAdapterForAgent(agent) {
  return catalogAdapters.find((adapter) => adapter.canHandle(agent)) || null;
}

export function getExecutionAdapterForAgent(agent) {
  if (getAgentCapability(agent) !== AGENT_CAPABILITIES.INDEXED_EXECUTABLE) return null;
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
