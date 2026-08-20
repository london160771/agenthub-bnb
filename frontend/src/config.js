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

// BNB Smart Chain networks. chainIds are canonical (56 mainnet, 97 testnet).
export const CHAINS = {
  mainnet: {
    id: 56,
    key: 'mainnet',
    name: 'BNB Smart Chain',
    shortName: 'BSC',
    explorer: 'https://bscscan.com',
    currency: 'BNB',
  },
  testnet: {
    id: 97,
    key: 'testnet',
    name: 'BNB Smart Chain Testnet',
    shortName: 'BSC Testnet',
    explorer: 'https://testnet.bscscan.com',
    currency: 'tBNB',
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
