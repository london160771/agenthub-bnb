import { getAgentCapability } from '../agentCapabilities.js';
import { getPaymentAdapter } from './registry.js';
import { normalizePaymentRequirement } from './paymentRequirement.js';
import { PAYMENT_PROTOCOLS, PAYMENT_STATES } from './paymentStates.js';

/** Build a safe, read-only payment plan from a backend-loaded Agent record. */
export function preparePayment({ agent, task = '' }) {
  const normalized = normalizePaymentRequirement(agent);
  if (!normalized.ok) return { ...normalized, agent: { agentId: agent?.agentId, name: agent?.name } };
  if (normalized.protocol === PAYMENT_PROTOCOLS.NONE) {
    return {
      ...normalized,
      agent: { agentId: agent.agentId, name: agent.name },
      confirmation: { required: false, enabled: false },
      transitions: [PAYMENT_STATES.FREE],
    };
  }

  const adapter = getPaymentAdapter(normalized.protocol);
  if (!adapter) {
    return {
      ok: false,
      state: PAYMENT_STATES.FAILED,
      agent: { agentId: agent.agentId, name: agent.name },
      error: {
        code: 'PAYMENT_ADAPTER_UNAVAILABLE',
        message: `No payment adapter is registered for ${normalized.protocol}.`,
      },
    };
  }

  const prepared = adapter.prepare({ requirement: normalized.requirement, task });
  return {
    ok: true,
    state: prepared.state,
    agent: { agentId: agent.agentId, name: agent.name },
    capability: getAgentCapability(agent),
    protocol: normalized.protocol,
    requirement: prepared.requirement,
    quote: prepared.quote,
    confirmation: prepared.confirmation,
    provenance: { ...normalized.evidence, ...prepared.provenance },
    transitions: prepared.transitions,
  };
}
