/**
 * AgentHub Trust Score — an explainable, weighted marketplace score (0..100).
 *
 * This is AgentHub's own score, NOT an official BNB Chain endorsement.
 *
 * Weights (spec §26):
 *   Identity 30% · Performance (success) 25% · Activity 20% ·
 *   Reliability 15% · Reviews 10%
 *
 * When a factor's underlying data is unavailable we omit it and renormalise
 * across the factors we DO have, rather than inventing a value. `confidence`
 * reports the share of total weight that was backed by real data.
 */

export const TRUST_WEIGHTS = {
  identity: 0.3,
  performance: 0.25,
  activity: 0.2,
  reliability: 0.15,
  reviews: 0.1,
};

export const TRUST_FACTOR_LABELS = {
  identity: 'Identity',
  performance: 'Performance',
  activity: 'Activity',
  reliability: 'Reliability',
  reviews: 'Reviews',
};

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const DAY_MS = 86_400_000;

function identityFactor(agent) {
  // Always known — we can always tell what identity data exists.
  if (agent.verified && agent.erc8004Id) return 95;
  if (agent.erc8004Id) return 80;
  if (agent.verified) return 70; // AgentHub-verified listing, no on-chain id yet
  if (agent.source === 'indexed') return 55;
  return 45; // seeded/demo listing, unverified
}

function performanceFactor(agent) {
  const sr = agent.metrics?.successRate;
  return sr == null ? null : clamp(sr);
}

function activityFactor(agent) {
  const execs = agent.metrics?.executions ?? 0;
  const last = agent.lastActiveAt ? new Date(agent.lastActiveAt).getTime() : null;
  if (!execs && !last) return null;
  // Volume on a log scale: ~2000 executions approaches 100.
  const volume = clamp((Math.log10(execs + 1) / Math.log10(2000)) * 100);
  // Recency: <2 days ≈ 100, decaying to ~0 by 30 days.
  let recency = 50;
  if (last) {
    const days = (Date.now() - last) / DAY_MS;
    recency = clamp(100 - (days / 30) * 100);
  }
  return clamp(0.6 * volume + 0.4 * recency);
}

function reliabilityFactor(agent) {
  const sr = agent.metrics?.successRate;
  if (sr == null) return null;
  const execs = agent.metrics?.executions ?? 0;
  // Success rate tempered by sample size — few runs means less certainty.
  const sample = clamp((Math.log10(execs + 1) / Math.log10(1000)) * 100);
  return clamp(0.7 * sr + 0.3 * sample);
}

function reviewsFactor(agent) {
  if (!agent.reviewCount || agent.ratingAvg == null) return null;
  return clamp((agent.ratingAvg / 5) * 100);
}

/**
 * Compute the trust breakdown for an agent-like object.
 * Returns integer factor scores (or null when unavailable), the renormalised
 * overall score, and a confidence fraction (0..1).
 */
export function computeTrust(agent) {
  const factors = {
    identity: identityFactor(agent),
    performance: performanceFactor(agent),
    activity: activityFactor(agent),
    reliability: reliabilityFactor(agent),
    reviews: reviewsFactor(agent),
  };

  let weighted = 0;
  let availableWeight = 0;
  for (const [key, weight] of Object.entries(TRUST_WEIGHTS)) {
    const value = factors[key];
    if (value != null) {
      weighted += value * weight;
      availableWeight += weight;
    }
  }

  const round = (v) => (v == null ? null : Math.round(v));
  const overall = availableWeight > 0 ? Math.round(weighted / availableWeight) : null;

  return {
    overall,
    identity: round(factors.identity),
    performance: round(factors.performance),
    activity: round(factors.activity),
    reliability: round(factors.reliability),
    reviews: round(factors.reviews),
    confidence: Number(availableWeight.toFixed(2)),
  };
}
