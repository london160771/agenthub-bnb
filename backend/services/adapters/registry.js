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
import { gridBandAdapter } from './gridBandAdapter.js';
import { assayHealthAdapter } from './assayHealthAdapter.js';
import { rangeKeeperAdapter } from './rangeKeeperAdapter.js';
import { bortHunterAdapter } from './bortHunterAdapter.js';
import { hallmarkHealthAdapter } from './hallmarkHealthAdapter.js';
import {
  AGENT_CAPABILITIES,
  getAgentCapability,
} from '../agentCapabilities.js';

const catalogAdapters = [brainA2aAdapter];
const executionAdapters = [
  assayYieldAdapter,
  assayGridAdapter,
  smeaiHealthAdapter,
  smeaiLpAdapter,
  hodlDanceAdapter,
  sentinelsAuditAdapter,
  rangePilotAdapter,
  quickIntelAdapter,
  gridBandAdapter,
  assayHealthAdapter,
  rangeKeeperAdapter,
  bortHunterAdapter,
  hallmarkHealthAdapter,
];

export function getCatalogAdapterForAgent(agent) {
  return catalogAdapters.find((adapter) => adapter.canHandle(agent)) || null;
}

export function getExecutionAdapterForAgent(agent) {
  const capability = getAgentCapability(agent);
  if (
    ![
      AGENT_CAPABILITIES.INDEXED_EXECUTABLE_FREE,
      AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID,
      AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID_READY,
    ].includes(capability)
  ) return null;
  return executionAdapters.find((adapter) => adapter.canHandle(agent)) || null;
}

/**
 * A paid adapter must opt into execution explicitly. This keeps payment-ready
 * discovery/preflight separate from a verified payment executor, while giving
 * future exact-identity adapters (including ERC-8183) a small extension point.
 */
export function isPaidExecutionEligibleAdapter(adapter) {
  return Boolean(
    adapter?.kind === 'execution'
      && adapter.paid === true
      && adapter.paidExecutionEnabled === true
      && typeof adapter.paymentProtocol === 'string'
      && adapter.paymentProtocol.trim() !== '',
  );
}

export function isPaidExecutionEligibleAgent(agent) {
  const adapter = getExecutionAdapterForAgent(agent);
  return Boolean(
    isPaidExecutionEligibleAdapter(adapter)
      && String(adapter.paymentProtocol || '').toLowerCase() === String(agent?.paymentProtocol || '').toLowerCase(),
  );
}

// Compatibility name for callers that may be added later. It never returns a
// catalog adapter, so catalog retrieval cannot accidentally complete a hire.
export function getAdapterForAgent(agent) {
  return getExecutionAdapterForAgent(agent);
}

export function isExecutableAgent(agent) {
  const adapter = getExecutionAdapterForAgent(agent);
  const capability = getAgentCapability(agent);
  return Boolean(
    adapter
      && (capability === AGENT_CAPABILITIES.INDEXED_EXECUTABLE_FREE || isPaidExecutionEligibleAgent(agent)),
  );
}

export const adapterRegistry = Object.freeze({
  catalogAdapters,
  executionAdapters,
  getAdapterForAgent,
  getCatalogAdapterForAgent,
  getExecutionAdapterForAgent,
  isPaidExecutionEligibleAdapter,
  isPaidExecutionEligibleAgent,
  isExecutableAgent,
});
