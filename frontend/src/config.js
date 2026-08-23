/**
 * Static app configuration: navigation, categories, chains. Kept in one place
 * so layout components and pages stay consistent as the product grows.
 */

export const APP_NAME = 'AgentHub';
export const APP_TAGLINE = 'Find the right AI agent for the job.';

// Primary (desktop) navigation.
export const NAV_LINKS = [
  { label: 'Discover', to: '/discover' },
  { label: 'Find Agent', to: '/find' },
  { label: 'Compare', to: '/compare' },
  { label: 'Activity', to: '/activity' },
  { label: 'Dashboard', to: '/dashboard' },
];

// Mobile bottom navigation (icon names resolved in MobileNav).
export const MOBILE_NAV = [
  { label: 'Home', to: '/', icon: 'home' },
  { label: 'Discover', to: '/discover', icon: 'compass' },
  { label: 'Find', to: '/find', icon: 'sparkles' },
  { label: 'Activity', to: '/activity', icon: 'activity' },
  { label: 'Profile', to: '/dashboard', icon: 'user' },
];

// Agent categories used across discovery, filters and the finder.
export const CATEGORIES = [
  { id: 'monitoring', label: 'Monitoring', icon: 'radar' },
  { id: 'trading', label: 'Trading', icon: 'trending-up' },
  { id: 'health-factor', label: 'Health Factor', icon: 'heart-pulse' },
  { id: 'yield', label: 'Yield', icon: 'sprout' },
  { id: 'portfolio', label: 'Portfolio', icon: 'pie-chart' },
  { id: 'research', label: 'Research', icon: 'search' },
];

/**
 * BNB Smart Chain networks.
 *
 * Every value here is verified against official BNB Chain documentation — none
 * of it is guessed (AGENTS.md requires this):
 *   - chain ids 56 / 97 and the RPC hosts: BNB Chain JSON-RPC endpoint docs
 *     https://docs.bnbchain.org/bnb-smart-chain/developers/json_rpc/json-rpc-endpoint/
 *   - network names, tBNB symbol and explorers: https://chainlist.org/chain/97
 *   - testnet faucet: https://docs.bnbchain.org/bnb-smart-chain/developers/faucet/
 *
 * `rpcUrls` / `nativeCurrency` exist so the wallet can be asked to ADD the
 * network (EIP-3085 `wallet_addEthereumChain`) when it doesn't know it yet.
 * `decimals: 18` is what EIP-3085 requires for a native currency.
 */
export const CHAINS = {
  mainnet: {
    id: 56,
    key: 'mainnet',
    name: 'BNB Smart Chain',
    shortName: 'BSC',
    explorer: 'https://bscscan.com',
    currency: 'BNB',
    rpcUrls: ['https://bsc-dataseed.bnbchain.org'],
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  },
  testnet: {
    id: 97,
    key: 'testnet',
    name: 'BNB Smart Chain Testnet',
    shortName: 'BSC Testnet',
    explorer: 'https://testnet.bscscan.com',
    currency: 'tBNB',
    rpcUrls: ['https://bsc-testnet-dataseed.bnbchain.org'],
    nativeCurrency: { name: 'BNB', symbol: 'tBNB', decimals: 18 },
    // Where to get free test funds (capped at 0.3 tBNB/day per the docs).
    faucet: 'https://www.bnbchain.org/en/testnet-faucet',
  },
};

export const DEFAULT_CHAIN =
  CHAINS[import.meta.env.VITE_DEFAULT_CHAIN] || CHAINS.testnet;

// Labels for the `source` provenance field so we never present seeded data as
// verified on-chain fact. Mirrors the backend Agent.source enum.
export const SOURCE_LABELS = {
  verified: { label: 'Verified on-chain', variant: 'ok' },
  indexed: { label: 'Indexed', variant: 'info' },
  seeded: { label: 'AgentHub demo data', variant: 'warn' },
  demo: { label: 'Demo agent', variant: 'warn' },
};
