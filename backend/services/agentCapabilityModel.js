/**
 * Single normalized view of what AgentHub can safely do with an agent record.
 *
 * This is deliberately derived on the backend from persisted data plus the
 * exact, independently verified execution definitions. A name, hostname,
 * AgentCard, catalog response, or HTTP status never upgrades capability.
 */
import {
  AGENT_CAPABILITIES,
  getAgentCapability,
  getVerifiedExecutionDefinition,
} from './agentCapabilities.js';
import { normalizePaymentRequirement } from './payments/paymentRequirement.js';

const MAINNET_CHAIN_ID = 56;
const EXECUTION_PROTOCOLS = new Set(['http', 'a2a', 'mcp']);

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function identityChainId(agent) {
  const value = Number(String(agent?.erc8004Id || '').split(':')[0]);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function freePayment(definition) {
  if (definition?.paymentProtocol !== 'none') return null;
  return {
    protocol: 'none',
    status: 'free',
    verified: true,
    evidence: 'verified execution definition; no payment is part of the published task contract',
  };
}

function paymentDetails(agent, definition) {
  const free = freePayment(definition);
  if (free) return free;
  const normalized = normalizePaymentRequirement(agent);
  if (!normalized.ok) {
    return {
      protocol: text(agent?.paymentProtocol) || text(agent?.payment?.type) || null,
      status: agent?.payment?.status || 'unknown',
      verified: false,
      error: normalized.error,
    };
  }
  return {
    protocol: normalized.protocol,
    status: normalized.requirement?.paymentVerified ? 'verified' : 'advertised',
    verified: normalized.requirement?.paymentVerified === true,
    requirement: normalized.requirement,
    evidence: normalized.evidence,
  };
}

function blockersFor(agent, capability, definition, payment, chainId, protocol, endpoint) {
  const blockers = [];
  if (agent?.source !== 'indexed') {
    if (capability !== AGENT_CAPABILITIES.LOCAL_EXECUTABLE) {
      blockers.push('this seeded listing is not allowlisted for the local executor that matches its advertised task');
    }
    return blockers;
  }
  if (chainId !== MAINNET_CHAIN_ID) blockers.push('indexed identity is not on BSC Mainnet (chain 56)');
  if (!endpoint) blockers.push('no published execution endpoint is persisted');
  if (endpoint && !EXECUTION_PROTOCOLS.has(protocol)) blockers.push(`unsupported execution protocol: ${protocol || 'unknown'}`);
  if (!definition) blockers.push('no independently verified adapter has returned a real task result for this identity');
  if (payment?.error) blockers.push(payment.error.message || 'payment requirement is incomplete or unsupported');
  if (capability === AGENT_CAPABILITIES.INDEXED_CATALOG_VERIFIED) {
    blockers.push('catalog/AgentCard evidence does not prove task execution');
  }
  if (capability === AGENT_CAPABILITIES.INDEXED_WATCH_ONLY && blockers.length === 0) {
    blockers.push('execution remains watch-only until a real task/result probe is independently verified');
  }
  return [...new Set(blockers)];
}

/** Normalize identity, execution, payment, capability, blockers, and evidence. */
export function normalizeAgentCapability(agent) {
  const capability = getAgentCapability(agent);
  const definition = getVerifiedExecutionDefinition(agent);
  const chainId = identityChainId(agent);
  const endpoint = text(agent?.endpoint) || text(definition?.endpoint);
  // A verified adapter's observed protocol is authoritative for execution. The
  // latest registry metadata can advertise a different transport while the
  // published endpoint and independently verified task contract remain stable.
  const protocol = definition?.executionProtocol || text(agent?.executionProtocol).toLowerCase() || null;
  const payment = paymentDetails(agent, definition);
  return {
    identity: {
      erc8004Id: text(agent?.erc8004Id) || null,
      chainId,
      network: chainId === MAINNET_CHAIN_ID ? 'BSC Mainnet' : chainId ? `chain ${chainId}` : null,
    },
    execution: {
      protocol,
      endpoint,
      adapterKey: definition?.adapterKey || null,
      verified: Boolean(definition),
      resultVerified: agent?.executionVerified === true || definition?.capability === AGENT_CAPABILITIES.INDEXED_EXECUTABLE_FREE,
      evidence: definition
        ? 'exact ERC-8004 identity mapped to an AgentHub adapter with prior real task/result evidence'
        : null,
    },
    payment,
    capability,
    blockers: blockersFor(agent, capability, definition, payment, chainId, protocol, endpoint),
  };
}

export function capabilityDetailsFor(agent) {
  return normalizeAgentCapability(agent);
}
