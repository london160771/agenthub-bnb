import { AGENT_CAPABILITIES, getAgentCapability, isPaymentReadyAgent } from '../agentCapabilities.js';
import { Agent } from '../../models/Agent.js';
import { Execution } from '../../models/Execution.js';
import { getPaymentAdapter } from './registry.js';
import { normalizePaymentRequirement } from './paymentRequirement.js';
import { NativeBnbPaymentError, verifyNativeBnbPayment } from './nativeBnbPaymentExecutor.js';
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
    paymentRequest: prepared.paymentRequest || null,
    quote: prepared.quote,
    confirmation: prepared.confirmation,
    provenance: { ...normalized.evidence, ...prepared.provenance },
    transitions: prepared.transitions,
  };
}

/**
 * Confirm a native-BNB payment for a pending paid execution. All chain facts
 * come from the persisted Agent record; the browser supplies only its public
 * wallet address and the hash returned by the injected wallet.
 */
export async function confirmNativeBnbPayment({ executionId, transactionHash, userAddress }) {
  const execution = await Execution.findOne({ executionId });
  if (!execution) throw new NativeBnbPaymentError('EXECUTION_NOT_FOUND', 'The pending paid execution was not found.');
  if (execution.payment?.status === 'confirmed') {
    const sameHash = String(execution.transactionHash || '').toLowerCase() === String(transactionHash || '').trim().toLowerCase();
    const sameWallet = String(execution.userAddress || '').toLowerCase() === String(userAddress || '').trim().toLowerCase();
    if (sameHash && sameWallet) {
      const result = execution.toObject();
      delete result.__v;
      delete result._id;
      return result;
    }
    throw new NativeBnbPaymentError('PAYMENT_ALREADY_PROCESSED', 'This execution already has a different confirmed payment.');
  }
  if (execution.payment?.status !== 'awaiting_confirmation') {
    throw new NativeBnbPaymentError('PAYMENT_ALREADY_PROCESSED', 'This execution is no longer waiting for payment confirmation.');
  }

  const agent = await Agent.findOne({ agentId: execution.agentId }).lean();
  if (!agent || (!isPaymentReadyAgent(agent) && getAgentCapability(agent) !== AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID)) {
    throw new NativeBnbPaymentError('PAYMENT_AGENT_NOT_READY', 'This agent does not have a verified native-BNB payment contract.');
  }
  if (agent.paymentProtocol !== PAYMENT_PROTOCOLS.NATIVE_BNB) {
    throw new NativeBnbPaymentError('PAYMENT_PROTOCOL_MISMATCH', 'This execution is not a native-BNB payment.');
  }
  if (String(execution.agentEndpoint || '') !== String(agent.endpoint || '')) {
    throw new NativeBnbPaymentError('PAYMENT_ENDPOINT_MISMATCH', 'The paid task endpoint changed before payment confirmation.');
  }
  if (String(execution.userAddress || '').toLowerCase() !== String(userAddress || '').trim().toLowerCase()) {
    throw new NativeBnbPaymentError('PAYMENT_SENDER_MISMATCH', 'The payment wallet does not match the wallet that created this execution.');
  }

  const duplicate = await Execution.findOne({ transactionHash: String(transactionHash || '').trim(), executionId: { $ne: executionId } }).select('executionId').lean();
  if (duplicate) throw new NativeBnbPaymentError('PAYMENT_TX_ALREADY_USED', 'That payment transaction has already been used for another execution.');

  const normalized = normalizePaymentRequirement(agent);
  if (!normalized.ok || normalized.protocol !== PAYMENT_PROTOCOLS.NATIVE_BNB) {
    throw new NativeBnbPaymentError('PAYMENT_REQUIREMENT_INCOMPLETE', 'The saved native-BNB payment requirement is incomplete.');
  }
  const verified = await verifyNativeBnbPayment({
    requirement: normalized.requirement,
    transactionHash,
    userAddress,
  });

  const confirmed = await Execution.findOneAndUpdate(
    { executionId, 'payment.status': 'awaiting_confirmation', transactionHash: '' },
    {
      $set: {
        transactionHash: verified.transactionHash,
        payment: {
          protocol: PAYMENT_PROTOCOLS.NATIVE_BNB,
          status: 'confirmed',
          amount: normalized.requirement.amount,
          token: 'BNB',
          chainId: verified.chainId,
          recipient: verified.recipient,
          transactionHash: verified.transactionHash,
          verifiedAt: verified.verifiedAt,
          blockNumber: verified.blockNumber,
        },
        paymentEvidence: {
          status: 'verified',
          protocol: PAYMENT_PROTOCOLS.NATIVE_BNB,
          chainId: verified.chainId,
          recipient: verified.recipient,
          valueWei: verified.valueWei,
          transactionHash: verified.transactionHash,
          blockNumber: verified.blockNumber,
          verifiedAt: verified.verifiedAt,
          provenance: 'public BSC Mainnet receipt verification by AgentHub',
        },
      },
    },
    { new: true },
  );
  if (!confirmed) throw new NativeBnbPaymentError('PAYMENT_ALREADY_PROCESSED', 'This execution was confirmed by another request.');
  const result = confirmed.toObject();
  delete result.__v;
  delete result._id;
  return result;
}
