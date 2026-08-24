/**
 * Lending-protocol adapter (health factor).
 *
 * WHY THIS FILE EXISTS AS AN ADAPTER: a health factor is not a native chain
 * value. It comes from a specific lending protocol's contracts — Venus's
 * Comptroller, Radiant's LendingPool — read through their ABIs at their deployed
 * addresses. AgentHub currently has **no verified testnet addresses** for those
 * protocols, and AGENTS.md forbids guessing contract addresses. So instead of
 * quietly inventing a plausible-looking contract call, this module:
 *
 *   1. Declares a per-protocol slot for a verified testnet deployment.
 *   2. Reports `verified: false` while that slot is empty.
 *   3. Returns a clearly-labelled MODELLED health factor so the product flow can
 *      be demonstrated end to end.
 *
 * Nothing downstream may present a modelled value as an on-chain reading — every
 * field this module returns carries `source: 'simulated'`, and the execution page
 * renders that label next to the number.
 *
 * TO MAKE THIS REAL: fill in a deployment below with an address verified on
 * https://testnet.bscscan.com (confirm the contract is the protocol's, not a
 * lookalike), add its ABI selector, and switch `readHealthFactor` to an
 * `eth_call`. The output contract stays identical; only `source` changes to
 * 'chain'. That is the whole remaining gap.
 */

/**
 * Verified testnet deployments, keyed by the protocol names seeded agents use.
 * Deliberately empty: an unverified address here would be worse than none.
 */
const DEPLOYMENTS = {
  // 'Venus':  { comptroller: '0x…', verifiedAt: 'https://testnet.bscscan.com/address/0x…' },
  // 'Radiant': { lendingPool: '0x…', verifiedAt: '…' },
};

export function hasVerifiedDeployment(protocol) {
  return Boolean(DEPLOYMENTS[protocol]);
}

/**
 * Deterministic 32-bit hash. Used so a given wallet always models to the SAME
 * health factor: a number that changed on every refresh would both look like
 * noise and imply live monitoring that isn't happening.
 */
function stableHash(input) {
  let h = 0x811c9dc5; // FNV-1a offset basis
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** 0..1, stable per (address, protocol). */
function stableUnit(address, protocol) {
  return stableHash(`${String(address).toLowerCase()}:${protocol}`) / 0xffffffff;
}

export function riskBand(healthFactor) {
  if (healthFactor < 1.1) return { level: 'CRITICAL', tone: 'bad' };
  if (healthFactor < 1.35) return { level: 'HIGH', tone: 'bad' };
  if (healthFactor < 1.8) return { level: 'MEDIUM', tone: 'warn' };
  return { level: 'LOW', tone: 'ok' };
}

/**
 * A health factor for `address` on `protocol`.
 *
 * @returns {{ verified: boolean, source: 'chain'|'simulated', healthFactor: number,
 *   collateralUsd: number, borrowUsd: number, liquidationThreshold: number,
 *   note: string }}
 */
export function readHealthFactor({ address, protocol }) {
  if (hasVerifiedDeployment(protocol)) {
    // Unreachable while DEPLOYMENTS is empty. Left as the explicit seam so the
    // real path is obvious to whoever fills it in.
    throw new Error(`Deployment configured for ${protocol} but no on-chain read implemented yet.`);
  }

  const u = stableUnit(address, protocol);
  // 1.05 … 3.05 — spans every risk band, so demos can show a warning as well as
  // an all-clear depending on the wallet.
  const healthFactor = Number((1.05 + u * 2).toFixed(2));
  // Position sizes scale off a second, independent hash so they don't correlate
  // suspiciously with the health factor.
  const v = stableUnit(`${address}#size`, protocol);
  const collateralUsd = Math.round((500 + v * 24_500) / 10) * 10;
  const borrowUsd = Math.round((collateralUsd * 0.8) / healthFactor / 10) * 10;

  return {
    verified: false,
    source: 'simulated',
    protocol,
    healthFactor,
    collateralUsd,
    borrowUsd,
    liquidationThreshold: 0.8,
    note:
      `AgentHub has no verified ${protocol} testnet contract address on file, and ` +
      `guessing one would risk reading the wrong contract. This position is a ` +
      `deterministic model, not an on-chain reading.`,
  };
}
