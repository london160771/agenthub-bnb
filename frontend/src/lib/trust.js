/**
 * Frontend mirror of the AgentHub trust model (backend `trustScoreService`,
 * spec §26). Kept in sync by hand so the profile page can EXPLAIN each factor —
 * its weight and what it measures — rather than showing an opaque number.
 *
 * This is AgentHub's OWN explainable score (0–100), not an official BNB Chain
 * endorsement.
 */
export const TRUST_FACTORS = [
  {
    key: 'identity',
    label: 'Identity',
    weight: 0.3,
    blurb: 'On-chain / registry identity. Verified ERC-8004 agents score highest; unverified demo listings score lowest.',
  },
  {
    key: 'performance',
    label: 'Performance',
    weight: 0.25,
    blurb: 'Task success rate across the agent’s executions.',
  },
  {
    key: 'activity',
    label: 'Activity',
    weight: 0.2,
    blurb: 'Execution volume and how recently the agent has been active.',
  },
  {
    key: 'reliability',
    label: 'Reliability',
    weight: 0.15,
    blurb: 'Success rate tempered by sample size — more runs means more certainty.',
  },
  {
    key: 'reviews',
    label: 'Reviews',
    weight: 0.1,
    blurb: 'Average rating from execution-gated reviews.',
  },
];

export const TRUST_DISCLAIMER =
  'This is AgentHub’s own explainable score, renormalised across the factors backed by real data (see confidence). It is not an official BNB Chain endorsement.';
