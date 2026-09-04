import { PAYMENT_PROTOCOLS, PAYMENT_STATES } from './paymentStates.js';

const MAINNET_CHAIN_ID = 56;
const NETWORKS = Object.freeze({
  56: { chainId: 56, name: 'BNB Smart Chain Mainnet', currency: 'BNB' },
  97: { chainId: 97, name: 'BNB Smart Chain Testnet', currency: 'tBNB' },
});

const PAID_PROTOCOLS = new Set([
  PAYMENT_PROTOCOLS.X402,
  PAYMENT_PROTOCOLS.ERC8183,
  PAYMENT_PROTOCOLS.NATIVE_BNB,
  PAYMENT_PROTOCOLS.CUSTOM,
]);

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function integer(value) {
  return Number.isInteger(value) && value > 0 ? value : null;
}

function normalizeProtocol(agent) {
  const explicit = text(agent?.paymentProtocol).toLowerCase();
  if (explicit === 'none' || explicit === 'free') return PAYMENT_PROTOCOLS.NONE;
  if (PAID_PROTOCOLS.has(explicit)) return explicit;

  const type = text(agent?.payment?.type).toLowerCase();
  if (type === 'free') return PAYMENT_PROTOCOLS.NONE;
  if (type === 'other') return PAYMENT_PROTOCOLS.CUSTOM;
  if (PAID_PROTOCOLS.has(type)) return type === 'other' ? PAYMENT_PROTOCOLS.CUSTOM : type;
  return explicit || type || null;
}

function fail(code, message, missing = []) {
  return {
    ok: false,
    state: PAYMENT_STATES.FAILED,
    error: { code, message, missing },
    requirement: null,
  };
}

/**
 * Normalize only backend-persisted payment metadata. The request body is not
 * accepted as a source of amount, token, network, or recipient data.
 */
export function normalizePaymentRequirement(agent) {
  const protocol = normalizeProtocol(agent);
  if (protocol === PAYMENT_PROTOCOLS.NONE) {
    return {
      ok: true,
      state: PAYMENT_STATES.FREE,
      protocol: PAYMENT_PROTOCOLS.NONE,
      requirement: null,
      evidence: { paymentStatus: 'free', paymentVerified: false },
    };
  }

  if (!PAID_PROTOCOLS.has(protocol)) {
    return fail(
      'PAYMENT_PROTOCOL_UNKNOWN',
      'Payment protocol is not explicitly identified in the agent record.',
      ['paymentProtocol'],
    );
  }

  const payment = agent?.payment || {};
  const chainId = integer(payment.chainId);
  const amount = typeof payment.amount === 'number' && Number.isFinite(payment.amount) && payment.amount > 0
    ? payment.amount
    : null;
  const token = text(payment.token || payment.currency);
  const recipient = text(payment.recipient);
  const contract = text(payment.contract);
  const destination = recipient || contract;
  const missing = [];

  if (chainId == null) missing.push('payment.chainId');
  if (!token) missing.push('payment.token');
  if (amount == null) missing.push('payment.amount');
  if (!destination) missing.push('payment.recipient or payment.contract');
  if (missing.length > 0) {
    return fail(
      'PAYMENT_REQUIREMENT_INCOMPLETE',
      'Payment preparation stopped because the agent record lacks a complete, consistent requirement.',
      missing,
    );
  }

  const identityChainId = integer(Number(String(agent?.erc8004Id || '').split(':')[0]));
  if (identityChainId != null && identityChainId !== chainId) {
    return fail(
      'PAYMENT_NETWORK_MISMATCH',
      'Payment network does not match the agent identity network.',
      [`agent identity chain ${identityChainId}`, `payment chain ${chainId}`],
    );
  }
  if (agent?.source === 'indexed' && chainId !== MAINNET_CHAIN_ID) {
    return fail(
      'INDEXED_PAYMENT_NOT_MAINNET',
      'Indexed Mainnet agents may only declare payment requirements on BNB Smart Chain Mainnet.',
      ['payment.chainId=56'],
    );
  }

  const network = NETWORKS[chainId];
  if (!network) {
    return fail('PAYMENT_NETWORK_UNSUPPORTED', 'Payment network is not supported by AgentHub.', [`chain ${chainId}`]);
  }

  const requirement = {
    protocol,
    network,
    amount,
    token: {
      symbol: token,
      address: text(payment.tokenAddress) || null,
      decimals: integer(payment.tokenDecimals),
    },
    recipient: recipient || null,
    contract: contract || null,
    requiresWallet: typeof payment.requiresWallet === 'boolean' ? payment.requiresWallet : null,
    requiresMainnetTx: typeof payment.requiresMainnetTx === 'boolean' ? payment.requiresMainnetTx : null,
    effect: text(payment.effect) || 'Payment would authorize the requested external agent task.',
    advertised: payment.status === 'advertised',
    paymentVerified: payment.status === 'verified',
  };

  return {
    ok: true,
    state: PAYMENT_STATES.PAYMENT_REQUIRED,
    protocol,
    requirement,
    evidence: {
      paymentStatus: payment.status || 'unknown',
      paymentVerified: payment.status === 'verified',
      executionVerified: false,
      provenance: 'backend agent.payment metadata',
    },
  };
}
