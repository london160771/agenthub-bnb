/**
 * Marketplace filter, sort and price-bucket configuration shared by the
 * discover page and its controls. Values map directly to backend query params.
 */

// Sort options: `value` is the backend sort key (agentService SORTS).
export const SORT_OPTIONS = [
  { value: 'trust', label: 'Recommended' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'success', label: 'Most successful' },
  { value: 'executions', label: 'Most used' },
  { value: 'price-low', label: 'Lowest price' },
  { value: 'price-high', label: 'Highest price' },
  { value: 'recent', label: 'Recently active' },
];
export const DEFAULT_SORT = 'trust';

// Availability (maps to ?status=; 'all' clears it).
export const STATUS_OPTIONS = [
  { value: 'all', label: 'Any status' },
  { value: 'live', label: 'Live' },
  { value: 'beta', label: 'Beta' },
  { value: 'paused', label: 'Paused' },
];

// Minimum trust score (maps to ?minTrust=).
export const TRUST_OPTIONS = [
  { value: 'all', label: 'Any' },
  { value: '70', label: '70+' },
  { value: '80', label: '80+' },
  { value: '90', label: '90+' },
];

// Minimum success rate (maps to ?minSuccess=).
export const SUCCESS_OPTIONS = [
  { value: 'all', label: 'Any' },
  { value: '80', label: '80%+' },
  { value: '90', label: '90%+' },
  { value: '95', label: '95%+' },
];

/**
 * Price buckets, denominated in BNB. Mutually exclusive ranges → each agent
 * falls in exactly one bucket. `min`/`max` map to ?minPrice / ?maxPrice.
 * USD conversion is deferred to the wallet/blockchain phase.
 */
export const PRICE_BUCKETS = [
  { value: 'all', label: 'Any price', min: null, max: null },
  { value: 'free', label: 'Free', min: null, max: 0 },
  { value: 'low', label: '0.001–0.003 BNB', min: 0.001, max: 0.003 },
  { value: 'mid', label: '0.004–0.006 BNB', min: 0.004, max: 0.006 },
  { value: 'high', label: '0.007+ BNB', min: 0.007, max: null },
];

export function priceBucketById(value) {
  return PRICE_BUCKETS.find((b) => b.value === value) || PRICE_BUCKETS[0];
}
