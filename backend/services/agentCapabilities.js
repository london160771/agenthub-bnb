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

function isBrainCatalogRecord(agent) {
  return (
    agent?.source === 'indexed' &&
    BRAIN_CATALOG_IDENTITIES.has(String(agent.erc8004Id || '')) &&
    String(agent.endpoint || '').replace(/\/$/, '') === BRAIN_A2A_ENDPOINT
  );
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
  return AGENT_CAPABILITIES.INDEXED_WATCH_ONLY;
}

export function isLocalExecutableAgent(agent) {
  return getAgentCapability(agent) === AGENT_CAPABILITIES.LOCAL_EXECUTABLE;
}

export function isCatalogVerifiedAgent(agent) {
  return getAgentCapability(agent) === AGENT_CAPABILITIES.INDEXED_CATALOG_VERIFIED;
}

/** Add the computed capability without persisting or trusting client input. */
export function decorateAgent(agent) {
  if (!agent) return agent;
  return { ...agent, capability: getAgentCapability(agent) };
}
