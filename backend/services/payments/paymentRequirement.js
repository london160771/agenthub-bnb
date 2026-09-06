import { PAYMENT_PROTOCOLS, PAYMENT_STATES } from './paymentStates.js';

const MAINNET_CHAIN_ID = 56;
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const NETWORKS = Object.freeze({
  56: { chainId: 56, name: 'BNB Smart Chain Mainnet', currency: 'BNB' },
  97: { chainId: 97, name: 'BNB Smart Chain Testnet', currency: 'tBNB' },
  8453: { chainId: 8453, name: 'Base Mainnet', currency: 'ETH' },
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
  const tokenDecimals = integer(payment.tokenDecimals);
  const amountBaseUnits = text(payment.amountBaseUnits);
  const derivedAmount = amountBaseUnits && tokenDecimals != null && /^\d+$/.test(amountBaseUnits)
    ? Number(amountBaseUnits) / (10 ** tokenDecimals)
    : null;
  const amount = typeof payment.amount === 'number' && Number.isFinite(payment.amount) && payment.amount > 0
    ? payment.amount
    : derivedAmount;
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

  if (protocol === PAYMENT_PROTOCOLS.NATIVE_BNB) {
    if (token.toUpperCase() !== 'BNB') {
      return fail('PAYMENT_TOKEN_MISMATCH', 'Native-BNB payment requires the BNB token symbol.', ['payment.token=BNB']);
    }
    if (!ADDRESS_RE.test(recipient)) {
      return fail('PAYMENT_RECIPIENT_INVALID', 'Native-BNB payment requires a concrete recipient address.', ['payment.recipient']);
    }
    if (payment.tokenAddress || contract) {
      return fail('PAYMENT_NATIVE_TRANSFER_INVALID', 'Native-BNB payment cannot include an ERC-20 token or contract calldata target.');
    }
  }

  if (protocol === PAYMENT_PROTOCOLS.X402 && payment.status === 'verified') {
    const x402 = payment.x402 || {};
    if (x402.version !== 2) missing.push('payment.x402.version=2');
    if (String(x402.scheme || '').toLowerCase() !== 'exact') missing.push('payment.x402.scheme=exact');
    if (!amountBaseUnits || !/^\d+$/.test(amountBaseUnits)) missing.push('payment.amountBaseUnits');
    if (!ADDRESS_RE.test(text(payment.tokenAddress))) missing.push('payment.tokenAddress');
    if (tokenDecimals == null) missing.push('payment.tokenDecimals');
    if (!text(payment.settlementNetwork)) missing.push('payment.settlementNetwork');
  }

  const identityChainId = integer(Number(String(agent?.erc8004Id || '').split(':')[0]));
  // x402 explicitly permits settlement on a chain different from the
  // ERC-8004 identity chain. Other indexed payment protocols remain bound to
  // the identity chain until their settlement facts say otherwise.
  if ((protocol !== PAYMENT_PROTOCOLS.X402 || payment.status !== 'verified') && identityChainId != null && identityChainId !== chainId) {
    return fail(
      'PAYMENT_NETWORK_MISMATCH',
      'Payment network does not match the agent identity network.',
      [`agent identity chain ${identityChainId}`, `payment chain ${chainId}`],
    );
  }
  if (agent?.source === 'indexed' && (protocol !== PAYMENT_PROTOCOLS.X402 || payment.status !== 'verified') && chainId !== MAINNET_CHAIN_ID) {
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
      decimals: tokenDecimals,
    },
    recipient: recipient || null,
    contract: contract || null,
    requiresWallet: typeof payment.requiresWallet === 'boolean' ? payment.requiresWallet : null,
    requiresMainnetTx: typeof payment.requiresMainnetTx === 'boolean' ? payment.requiresMainnetTx : null,
    amountBaseUnits: amountBaseUnits || null,
    settlementNetwork: text(payment.settlementNetwork) || network.name,
    scheme: protocol === PAYMENT_PROTOCOLS.X402 ? text(payment.x402?.scheme).toLowerCase() || null : null,
    protocolVersion: protocol === PAYMENT_PROTOCOLS.X402 ? payment.x402?.version || null : null,
    challenge: protocol === PAYMENT_PROTOCOLS.X402 ? payment.x402 || null : null,
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
