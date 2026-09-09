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
  INDEXED_EXECUTABLE_FREE: 'indexed/executable-free',
  INDEXED_EXECUTABLE_PAID: 'indexed/executable-paid',
  INDEXED_EXECUTABLE_PAID_READY: 'indexed/executable-paid-ready',
  INDEXED_WATCH_ONLY: 'indexed/watch-only',
});

// A built-in is executable only when its listing describes the exact local
// implementation behind it. Source provenance alone is never execution
// evidence: most seeded records are catalogue examples whose broader advertised
// behavior is intentionally not routed through a generic category executor.
export const LOCAL_EXECUTABLE_AGENT_IDS = new Set([
  'venus-health-guardian',
  'radiant-liquidation-shield',
  'grid-strategy-planner',
  'rebalance-advisor',
]);

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

// Exact identity + endpoint pairs independently probed during Phases 11.1B/11.2.
// The identity is the allowlist key; names, hostnames, AgentCards and HTTP
// status codes are not enough to enter this set. Each adapter still validates
// the task response at runtime before an execution can complete. Paid adapters
// must declare paid-ready only after the persisted payment contract evidence is
// verified. Whether a paid-ready record may actually run is decided separately
// by the exact adapter's paid-execution eligibility, not by this label alone.
const VERIFIED_EXECUTION_IDENTITIES = new Map([
  [
    '56:258641',
    { adapterKey: 'sentinels-audit', endpoint: 'https://smartsentinels.net/api/audit-mcp', executionProtocol: 'mcp', paymentProtocol: 'native-bnb', capability: AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID_READY },
  ],
  [
    '56:331752',
    { adapterKey: 'assay-yield', endpoint: 'https://assay-ten-iota.vercel.app/api/agents/yield', executionProtocol: 'http', paymentProtocol: 'none', capability: AGENT_CAPABILITIES.INDEXED_EXECUTABLE_FREE },
  ],
  [
    '56:331751',
    { adapterKey: 'assay-grid', endpoint: 'https://assay-ten-iota.vercel.app/api/agents/grid', executionProtocol: 'http', paymentProtocol: 'none', capability: AGENT_CAPABILITIES.INDEXED_EXECUTABLE_FREE },
  ],
  [
    '56:331625',
    { adapterKey: 'smeai-health', endpoint: 'https://smeai-dev.vercel.app/api/a2a', executionProtocol: 'a2a', paymentProtocol: 'none', capability: AGENT_CAPABILITIES.INDEXED_EXECUTABLE_FREE },
  ],
  [
    '56:331698',
    { adapterKey: 'smeai-lp', endpoint: 'https://smeai-dev.vercel.app/api/a2a/lp', executionProtocol: 'a2a', paymentProtocol: 'none', capability: AGENT_CAPABILITIES.INDEXED_EXECUTABLE_FREE },
  ],
  [
    '56:96231',
    { adapterKey: 'hodl-dance', endpoint: 'https://hodl.dance/.well-known/agent-card.json', executionProtocol: 'http', paymentProtocol: 'none', capability: AGENT_CAPABILITIES.INDEXED_EXECUTABLE_FREE },
  ],
  [
    '56:322090',
    {
      adapterKey: 'range-pilot',
      endpoint: 'https://range-pilot-watch.onrender.com/docs/agents/venus-borrow-buffer.html',
      taskEndpoint: 'https://range-pilot-watch.onrender.com/agents/venus-borrow-buffer/assess',
      executionProtocol: 'http',
      paymentProtocol: 'none',
      capability: AGENT_CAPABILITIES.INDEXED_EXECUTABLE_FREE,
    },
  ],
  [
    '56:322046',
    {
      adapterKey: 'range-pilot',
      endpoint: 'https://range-pilot-watch.onrender.com/docs/agents/venus-yield.html',
      taskEndpoint: 'https://range-pilot-watch.onrender.com/agents/venus-yield/assess',
      executionProtocol: 'http',
      paymentProtocol: 'none',
      capability: AGENT_CAPABILITIES.INDEXED_EXECUTABLE_FREE,
    },
  ],
  [
    '56:6255',
    {
      adapterKey: 'quick-intel',
      endpoint: 'https://x402.quickintel.io/v1/scan/full',
      executionProtocol: 'http',
      paymentProtocol: 'x402',
      capability: AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID_READY,
    },
  ],
  [
    '56:321995',
    {
      adapterKey: 'grid-band',
      endpoint: 'https://range-pilot-watch.onrender.com/docs/agents/grid-band.html',
      taskEndpoint: 'https://range-pilot-watch.onrender.com/agents/grid-band/assess',
      executionProtocol: 'http',
      paymentProtocol: 'none',
      capability: AGENT_CAPABILITIES.INDEXED_EXECUTABLE_FREE,
    },
  ],
  [
    '56:331753',
    {
      adapterKey: 'assay-health',
      endpoint: 'https://assay-ten-iota.vercel.app/api/agents/health',
      executionProtocol: 'http',
      paymentProtocol: 'none',
      capability: AGENT_CAPABILITIES.INDEXED_EXECUTABLE_FREE,
    },
  ],
  [
    '56:320966',
    {
      adapterKey: 'range-keeper',
      endpoint: 'https://trustlist-range-keeper.onrender.com/position',
      taskEndpoint: 'https://trustlist-range-keeper.onrender.com/position',
      executionProtocol: 'http',
      paymentProtocol: 'none',
      capability: AGENT_CAPABILITIES.INDEXED_EXECUTABLE_FREE,
    },
  ],
  [
    '56:338630',
    {
      adapterKey: 'bort-hunter',
      endpoint: 'https://api.bortagent.xyz/api/a2a/11169/card',
      taskEndpoint: 'https://api.bortagent.xyz/api/a2a/11169',
      executionProtocol: 'a2a',
      paymentProtocol: 'none',
      capability: AGENT_CAPABILITIES.INDEXED_EXECUTABLE_FREE,
    },
  ],
  [
    '56:338480',
    {
      adapterKey: 'hallmark-health',
      endpoint: 'https://hallmark-agents.vercel.app/a2a/health',
      taskEndpoint: 'https://hallmark-agents.vercel.app/x402/health/report',
      executionProtocol: 'a2a',
      paymentProtocol: 'x402',
      capability: AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID_READY,
    },
  ],
]);

const PAID_READY_PROTOCOLS = new Set(['x402', 'erc8183', 'native-bnb', 'custom']);

function isPaidReadyRecord(agent) {
  if (agent?.source !== 'indexed') return false;
  const identityChainId = Number(String(agent.erc8004Id || '').split(':')[0]);
  if (identityChainId !== 56 || !String(agent.endpoint || '').trim()) return false;
  if (!['http', 'a2a', 'mcp'].includes(String(agent.executionProtocol || '').toLowerCase())) return false;

  const protocol = String(agent.paymentProtocol || '').trim().toLowerCase();
  const payment = agent.payment || {};
  const verification = payment.verification || {};
  const amount = Number(payment.amount);
  const token = String(payment.token || payment.currency || '').trim();
  const destination = String(payment.recipient || payment.contract || '').trim();
  const executionRecord = executionRecordFor(agent);
  const x402 = payment.x402 || {};
  const x402Complete = protocol === 'x402' &&
    x402.version === 2 &&
    String(x402.scheme || '').toLowerCase() === 'exact' &&
    /^\d+$/.test(String(payment.amountBaseUnits || '')) &&
    /^0x[a-fA-F0-9]{40}$/.test(String(payment.tokenAddress || '')) &&
    Number.isInteger(payment.tokenDecimals) &&
    Boolean(payment.settlementNetwork);
  const settlementChain = Number(payment.chainId);
  const verificationEndpoint = String(verification.endpoint || '').replace(/\/$/, '');
  const agentEndpoint = String(agent.endpoint || '').replace(/\/$/, '');
  const x402Resource = typeof x402.resource === 'string'
    ? x402.resource
    : x402.resource?.url;
  const paymentEndpointMatches = verificationEndpoint === agentEndpoint || (
    protocol === 'x402' &&
    Boolean(x402Resource) &&
    verificationEndpoint === String(x402Resource).replace(/\/$/, '')
  );
  return (
    Boolean(executionRecord) &&
    PAID_READY_PROTOCOLS.has(protocol) &&
    payment.status === 'verified' &&
    verification.status === 'verified' &&
    paymentEndpointMatches &&
    Boolean(verification.source) &&
    Boolean(verification.method) &&
    Boolean(verification.verifiedAt) &&
    (settlementChain === 56 || (x402Complete && settlementChain === 8453)) &&
    Number.isFinite(amount) && amount > 0 &&
    Boolean(token) &&
    Boolean(destination) &&
    (protocol !== 'x402' || x402Complete)
  );
}

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
  if (persisted && persisted !== record.endpoint.replace(/\/$/, '')) return null;
  return record;
}

/**
 * Return the backend-owned execution evidence for an indexed identity.
 * Callers may use the returned protocol/adapter details for normalization, but
 * must not treat this as a task result: adapters still validate every response.
 */
export function getVerifiedExecutionDefinition(agent) {
  return executionRecordFor(agent);
}
/** Return the only capability state the API is allowed to expose for an agent. */
export function getAgentCapability(agent) {
  if (!agent) return AGENT_CAPABILITIES.INDEXED_WATCH_ONLY;
  if (agent.source === 'seeded' || agent.source === 'demo') {
    return LOCAL_EXECUTABLE_AGENT_IDS.has(String(agent.agentId || ''))
      ? AGENT_CAPABILITIES.LOCAL_EXECUTABLE
      : AGENT_CAPABILITIES.INDEXED_WATCH_ONLY;
  }
  if (isPaidReadyRecord(agent)) {
    if (agent.executionVerified === true) return AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID;
    return AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID_READY;
  }
  if (isBrainCatalogRecord(agent)) {
    return AGENT_CAPABILITIES.INDEXED_CATALOG_VERIFIED;
  }
  const executionRecord = executionRecordFor(agent);
  if (executionRecord) {
    // A paid identity may be known by adapter allowlist, but it is not
    // payment-ready until the persisted backend facts pass the full
    // fail-closed validation above. Never let a stale capability or identity
    // match bypass that requirement.
    const paidCapabilities = new Set([
      AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID,
      AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID_READY,
    ]);
    if (paidCapabilities.has(executionRecord.capability)) {
      return AGENT_CAPABILITIES.INDEXED_WATCH_ONLY;
    }
    return executionRecord.capability || AGENT_CAPABILITIES.INDEXED_EXECUTABLE_FREE;
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
  const capability = getAgentCapability(agent);
  return capability === AGENT_CAPABILITIES.INDEXED_EXECUTABLE_FREE || capability === AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID;
}

/** A verified payment contract exists for read-only preflight inspection. */
export function isPaymentReadyAgent(agent) {
  return getAgentCapability(agent) === AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID_READY;
}

/** Any indexed external task path, including one waiting for its first payment. */
export function isRemoteAgent(agent) {
  const capability = getAgentCapability(agent);
  return (
    capability === AGENT_CAPABILITIES.INDEXED_EXECUTABLE_FREE ||
    capability === AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID ||
    capability === AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID_READY
  );
}

export function getExternalAdapterKey(agent) {
  return isRemoteAgent(agent) ? executionRecordFor(agent)?.adapterKey || null : null;
}

/** Add the computed capability without persisting or trusting client input. */
export function decorateAgent(agent) {
  if (!agent) return agent;
  const capability = getAgentCapability(agent);
  const executionAdapter = getExternalAdapterKey(agent);
  return { ...agent, capability, ...(executionAdapter ? { executionAdapter } : {}) };
}
