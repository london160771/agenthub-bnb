/**
 * Backend-authoritative execution capability.
 *
 * `source` describes provenance; this describes what AgentHub can actually do
 * with the record. The two must not be inferred from a name, hostname, or an
 * HTTP 200 response in the frontend.
 */
export const AGENT_CAPABILITIES = Object.freeze({
  LOCAL_EXECUTABLE: 'seeded/local-executable',
  INDEXED_CATALOG_VERIFIED: 'indexed/catalog-verified',
  INDEXED_EXECUTABLE: 'indexed/executable',
  INDEXED_WATCH_ONLY: 'indexed/watch-only',
});

export const BRAIN_A2A_ENDPOINT = 'https://agent.brainonbnb.com/a2a';
export const BRAIN_AGENT_CARD_URL = 'https://agent.brainonbnb.com/.well-known/agent-card.json';

// These are the exact ERC-8004 BSC Mainnet identities whose public AgentCard
// and catalog endpoint were verified. This is catalog evidence only; it is not
// evidence that any paid skill has returned a task result.
const BRAIN_CATALOG_IDENTITIES = new Set([
  '56:49467',
  '56:302257',
  '56:302258',
  '56:304493',
  '56:304494',
  '56:310460',
]);

// Exact identity + endpoint pairs independently probed during Phase 11.1B.
// The identity is the allowlist key; names, hostnames, AgentCards and HTTP
// status codes are not enough to enter this set. Each adapter still validates
// the task response at runtime before an execution can complete.
const VERIFIED_EXECUTION_IDENTITIES = new Map([
  [
    '56:331752',
    { adapterKey: 'assay-yield', endpoint: 'https://assay-ten-iota.vercel.app/api/agents/yield' },
  ],
  [
    '56:331751',
    { adapterKey: 'assay-grid', endpoint: 'https://assay-ten-iota.vercel.app/api/agents/grid' },
  ],
  [
    '56:331625',
    { adapterKey: 'smeai-health', endpoint: 'https://smeai-dev.vercel.app/api/a2a' },
  ],
  [
    '56:331698',
    { adapterKey: 'smeai-lp', endpoint: 'https://smeai-dev.vercel.app/api/a2a/lp' },
  ],
]);

function isBrainCatalogRecord(agent) {
  return (
    agent?.source === 'indexed' &&
    BRAIN_CATALOG_IDENTITIES.has(String(agent.erc8004Id || '')) &&
    String(agent.endpoint || '').replace(/\/$/, '') === BRAIN_A2A_ENDPOINT
  );
}

function executionRecordFor(agent) {
  if (agent?.source !== 'indexed') return null;
  const record = VERIFIED_EXECUTION_IDENTITIES.get(String(agent.erc8004Id || ''));
  if (!record) return null;

  // Older indexed rows may predate endpoint persistence. The exact ERC-8004
  // identity is still required, and a conflicting persisted endpoint fails
  // closed rather than silently routing to a different service.
  const persisted = String(agent.endpoint || '').replace(/\/$/, '');
  return !persisted || persisted === record.endpoint ? record : null;
}
/** Return the only capability state the API is allowed to expose for an agent. */
export function getAgentCapability(agent) {
  if (!agent) return AGENT_CAPABILITIES.INDEXED_WATCH_ONLY;
  if (agent.source === 'seeded' || agent.source === 'demo') {
    return AGENT_CAPABILITIES.LOCAL_EXECUTABLE;
  }
  if (isBrainCatalogRecord(agent)) {
    return AGENT_CAPABILITIES.INDEXED_CATALOG_VERIFIED;
  }
  if (executionRecordFor(agent)) {
    return AGENT_CAPABILITIES.INDEXED_EXECUTABLE;
  }
  return AGENT_CAPABILITIES.INDEXED_WATCH_ONLY;
}

export function isLocalExecutableAgent(agent) {
  return getAgentCapability(agent) === AGENT_CAPABILITIES.LOCAL_EXECUTABLE;
}

export function isCatalogVerifiedAgent(agent) {
  return getAgentCapability(agent) === AGENT_CAPABILITIES.INDEXED_CATALOG_VERIFIED;
}

export function isExternallyExecutableAgent(agent) {
  return getAgentCapability(agent) === AGENT_CAPABILITIES.INDEXED_EXECUTABLE;
}

export function getExternalAdapterKey(agent) {
  return isExternallyExecutableAgent(agent) ? executionRecordFor(agent)?.adapterKey || null : null;
}

/** Add the computed capability without persisting or trusting client input. */
export function decorateAgent(agent) {
  if (!agent) return agent;
  const capability = getAgentCapability(agent);
  const executionAdapter = getExternalAdapterKey(agent);
  return { ...agent, capability, ...(executionAdapter ? { executionAdapter } : {}) };
}
