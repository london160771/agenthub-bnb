/**
 * Read-only normalization for an x402 v2 payment-required challenge.
 *
 * This module never signs, submits, or broadcasts a payment. It accepts only
 * values returned by the provider challenge plus independently supplied token
 * decimals; missing security-sensitive fields fail closed.
 */
const EVM_NETWORK_RE = /^eip155:(\d+)$/;
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export class X402ChallengeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'X402ChallengeError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new X402ChallengeError(code, message);
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseEvmNetwork(value) {
  const match = EVM_NETWORK_RE.exec(text(value));
  if (!match) return null;
  const chainId = Number(match[1]);
  return Number.isSafeInteger(chainId) && chainId > 0 ? { network: match[0], chainId } : null;
}

function amountNumber(amount, decimals) {
  const raw = text(amount);
  if (!/^\d+$/.test(raw) || BigInt(raw) <= 0n) return null;
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) return null;
  const whole = raw.length > decimals ? raw.slice(0, -decimals) : '0';
  const fraction = decimals === 0 ? '' : raw.slice(-decimals).padStart(decimals, '0');
  const value = Number(`${whole}.${fraction}`);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function normalizeOption(option, tokenDecimalsByNetwork = {}) {
  if (!option || typeof option !== 'object') return null;
  const network = parseEvmNetwork(option.network);
  const payTo = text(option.payTo);
  const asset = text(option.asset);
  const scheme = text(option.scheme).toLowerCase();
  if (!network || scheme !== 'exact' || !/^\d+$/.test(text(option.amount)) || BigInt(option.amount) <= 0n) return null;
  if (!ADDRESS_RE.test(payTo) || !ADDRESS_RE.test(asset)) return null;
  const decimals = tokenDecimalsByNetwork[network.network];
  const amount = amountNumber(option.amount, decimals);
  if (amount == null) return null;
  return {
    network: network.network,
    chainId: network.chainId,
    scheme,
    amountBaseUnits: text(option.amount),
    amount,
    payTo,
    tokenAddress: asset,
    tokenDecimals: decimals,
    token: text(option.extra?.name) || 'Token',
    maxTimeoutSeconds: Number.isInteger(option.maxTimeoutSeconds) ? option.maxTimeoutSeconds : null,
    extra: option.extra && typeof option.extra === 'object' ? { ...option.extra } : {},
  };
}

/**
 * Normalize a provider's JSON 402 challenge and select only an explicitly
 * offered EVM network. `tokenDecimalsByNetwork` must come from an independent
 * token-contract read; decimals are never inferred from the display symbol.
 */
export function normalizeX402Challenge(challenge, { preferredNetwork, tokenDecimalsByNetwork = {} } = {}) {
  if (!challenge || typeof challenge !== 'object') fail('X402_CHALLENGE_INVALID', 'The x402 challenge is not an object.');
  const version = Number(challenge.x402Version);
  if (version !== 2) fail('X402_VERSION_UNSUPPORTED', 'Only x402 version 2 challenges are supported.');
  const accepts = Array.isArray(challenge.accepts) ? challenge.accepts : [];
  const options = accepts.map((option) => normalizeOption(option, tokenDecimalsByNetwork)).filter(Boolean);
  if (options.length === 0) fail('X402_CHALLENGE_INCOMPLETE', 'The x402 challenge has no complete exact EVM settlement option.');

  const selected = options.find((option) => option.network === preferredNetwork) || null;
  if (!selected) fail('X402_NETWORK_NOT_OFFERED', 'The requested x402 settlement network was not offered by the provider.');

  const explicitlyOffered = accepts
    .map((option) => parseEvmNetwork(option?.network)?.network)
    .filter(Boolean);
  const observedSupported = Array.isArray(challenge.observedSupportedNetworks)
    ? challenge.observedSupportedNetworks.filter((network) => parseEvmNetwork(network))
    : [];

  const request = challenge.extensions?.bazaar?.info?.input || challenge.accepts?.[0]?.outputSchema?.input || null;
  return {
    version,
    scheme: selected.scheme,
    selected,
    // Preserve every explicitly offered EVM network, even when an option is
    // not selected because its token decimals have not been independently
    // verified. Only `selected` is usable for payment preparation.
    supportedNetworks: [...new Set([...explicitlyOffered, ...observedSupported])],
    request: request && typeof request === 'object' ? request : null,
    resource: challenge.resource && typeof challenge.resource === 'object' ? { ...challenge.resource } : null,
  };
}
