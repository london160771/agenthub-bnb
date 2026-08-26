/**
 * Lending-protocol adapter (liquidation risk).
 *
 * WHY THIS LAYER STILL EXISTS NOW THAT VENUS IS REAL: seeded agents advertise more
 * than one protocol, and only Venus has a verified BNB-testnet deployment and a
 * validated read path. This module is the honest boundary — it routes Venus to a
 * real on-chain read and tells the truth about everything else, instead of letting
 * an executor imply that any lending protocol can be read.
 *
 * WHAT CHANGED: this file used to return a deterministic MODELLED health factor,
 * derived from a hash of the wallet address, because no verified contract address
 * was on file. That path is gone. There is no longer any simulated position
 * anywhere in the lending flow: either Venus is read on-chain, or the caller is
 * told plainly that the protocol is unsupported. A hash-derived number that looked
 * like a health factor was the single most misleading thing in the codebase, and
 * deleting it — rather than keeping it as a fallback — is the point of this change.
 *
 * An unsupported protocol is NOT an error. It is a result with a reason, so the
 * execution page can explain it rather than show a failure.
 */
import { readVenusPosition, supportsProtocol, VENUS_CORE_POOL } from './venusAdapter.js';

/**
 * Protocols with a verified testnet deployment and a validated read path.
 * Adding one means verifying its addresses and reconciling its arithmetic against
 * the protocol's own figures — not just appending a name here.
 */
export const SUPPORTED_PROTOCOLS = [
  {
    name: VENUS_CORE_POOL.protocol,
    pool: VENUS_CORE_POOL.pool,
    comptroller: VENUS_CORE_POOL.comptroller,
    docs: VENUS_CORE_POOL.docs,
    explorer: VENUS_CORE_POOL.explorer,
  },
];

export function hasVerifiedDeployment(protocol) {
  return supportsProtocol(protocol);
}

/**
 * Risk band for a numeric health factor.
 *
 * The thresholds are anchored to a real meaning now that the number is real: 1.0 is
 * the liquidation point, because the health factor is liquidation-weighted
 * collateral divided by debt, and Venus liquidates exactly when that ratio falls
 * below 1. So `< 1.1` is "within 10% of liquidation", not an arbitrary cutoff.
 *
 * `LIQUIDATABLE` is separate from `CRITICAL` because it is a different statement:
 * not "this could be liquidated soon" but "this can be liquidated right now".
 */
export function riskBand(healthFactor) {
  if (healthFactor < 1) return { level: 'LIQUIDATABLE', tone: 'bad' };
  if (healthFactor < 1.1) return { level: 'CRITICAL', tone: 'bad' };
  if (healthFactor < 1.35) return { level: 'HIGH', tone: 'bad' };
  if (healthFactor < 1.8) return { level: 'MEDIUM', tone: 'warn' };
  return { level: 'LOW', tone: 'ok' };
}

/**
 * Overall risk level for a position, preferring the protocol's own verdict.
 *
 * Venus's `shortfall > 0` is authoritative: it is the protocol saying this account
 * is liquidatable, and it outranks any ratio we derive. Only when there is no
 * shortfall does the derived health factor decide the band, and `basis` records
 * which of the two answered so the UI can attribute it.
 */
export function positionRiskLevel(position) {
  if (position?.venus?.liquidatable) {
    return { level: 'LIQUIDATABLE', tone: 'bad', basis: 'protocol' };
  }
  if (typeof position?.healthFactor === 'number') {
    return { ...riskBand(position.healthFactor), basis: 'derived' };
  }
  if (position && position.hasPosition === false) {
    return { level: 'NO POSITION', tone: 'ok', basis: 'protocol' };
  }
  return { level: 'UNKNOWN', tone: 'warn', basis: 'none' };
}

/**
 * Read `address`'s liquidation risk on `protocol`.
 *
 * Renamed from `readHealthFactor` deliberately. The old name promised a single
 * number that Compound-family protocols do not store; this returns a position,
 * whose health factor may legitimately be absent (no debt, or an unpriced market)
 * without that being a failure. A caller forced to notice the rename is a caller
 * that will not silently mistake the new return value for the old one.
 *
 * @returns {Promise<{ supported: boolean, protocol: string, position: object|null,
 *   reason: string|null }>}
 */
export async function readLendingPosition({ address, protocol }) {
  if (!hasVerifiedDeployment(protocol)) {
    return {
      supported: false,
      protocol,
      position: null,
      reason:
        `AgentHub has no verified ${protocol} deployment on BNB testnet on file. ` +
        'Guessing a contract address could read the wrong contract entirely, so no ' +
        'position is reported rather than an invented one. Supported today: ' +
        `${SUPPORTED_PROTOCOLS.map((p) => `${p.name} ${p.pool}`).join(', ')}.`,
    };
  }

  return {
    supported: true,
    protocol: VENUS_CORE_POOL.protocol,
    position: await readVenusPosition(address),
    reason: null,
  };
}
