/**
 * Pure wallet helpers — no React, no side effects.
 *
 * Scope note: this module reads and formats public wallet data (addresses,
 * chain ids) and builds the parameter objects for the two standard wallet RPC
 * calls we use. It never touches private keys, seed phrases or signatures, and
 * it never builds a transaction.
 */

/**
 * Shape check for an EVM address: 0x + 40 hex characters.
 *
 * This is NOT an EIP-55 checksum validation — a mixed-case address that fails
 * the checksum still passes here. It catches typos and wrong-length pastes,
 * which is what a form needs; claiming more would overstate the guarantee.
 */
export function isAddress(value) {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

/** 0x1234…abcd — enough to recognise an address without the full 42 characters. */
export function shortAddress(address, { lead = 6, tail = 4 } = {}) {
  if (typeof address !== 'string' || address.length < lead + tail) return address || '';
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}

/** Wallets talk hex chain ids: 97 → "0x61". */
export function toHexChainId(id) {
  return `0x${Number(id).toString(16)}`;
}

/** Hex or decimal chain id from a wallet → a plain number, or null. */
export function parseChainId(value) {
  if (value == null) return null;
  const n = typeof value === 'string' ? Number.parseInt(value, 16) : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * EIP-3085 parameters for `wallet_addEthereumChain`, built from a CHAINS entry
 * so the verified values in config.js stay the single source of truth.
 */
export function chainParamsFor(chain) {
  return {
    chainId: toHexChainId(chain.id),
    chainName: chain.name,
    nativeCurrency: chain.nativeCurrency,
    rpcUrls: chain.rpcUrls,
    blockExplorerUrls: [chain.explorer],
  };
}

/**
 * Turn an EIP-1193 provider error into something a person can act on.
 * Codes are from EIP-1193 / MetaMask's documented set.
 */
export function walletErrorMessage(err) {
  switch (err?.code) {
    case 4001:
      return 'You dismissed the wallet request. Nothing was changed.';
    case 4902:
      return "Your wallet doesn't know this network yet. Approve the prompt to add it.";
    case -32002:
      return 'Your wallet already has a pending request — open it and finish there first.';
    default:
      return err?.message || 'Your wallet returned an unexpected error.';
  }
}
