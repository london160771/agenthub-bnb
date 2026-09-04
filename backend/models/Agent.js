import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Data provenance for every agent. This is a core honesty guarantee of the
 * product: the UI must never present seeded/demo data as verified on-chain fact.
 *   - verified: identity confirmed on-chain (e.g. ERC-8004 registry)
 *   - indexed:  discovered from an external index, not independently verified
 *   - seeded:   curated AgentHub catalogue entry (demo metrics)
 *   - demo:     purpose-built demo/adapter agent
 */
export const AGENT_SOURCES = ['verified', 'indexed', 'seeded', 'demo'];
export const AGENT_CATEGORIES = [
  'monitoring',
  'trading',
  'yield',
  'health-factor',
  'portfolio',
  'research',
];
export const AGENT_STATUSES = ['live', 'beta', 'paused'];

const PricingSchema = new Schema(
  {
    amount: { type: Number, default: null, min: 0 },
    currency: { type: String, default: '' },
    // per-task | subscription | free
    model: { type: String, default: 'unknown' },
  },
  { _id: false },
);

const PaymentSchema = new Schema(
  {
    type: { type: String, enum: ['free', 'x402', 'erc8183', 'other', 'unknown'], default: 'unknown' },
    status: { type: String, enum: ['advertised', 'verified', 'unknown'], default: 'unknown' },
    amount: { type: Number, default: null, min: 0 },
    token: { type: String, default: null },
    currency: { type: String, default: null },
    requiresWallet: { type: Boolean, default: null },
    requiresMainnetTx: { type: Boolean, default: null },
  },
  { _id: false },
);

const MetricsSchema = new Schema(
  {
    executions: { type: Number, default: 0, min: 0 },
    // Percentages stored 0..100. Nullable when there isn't enough data.
    successRate: { type: Number, default: null, min: 0, max: 100 },
    // Average response time in seconds.
    avgResponseTime: { type: Number, default: null, min: 0 },
    activeSince: { type: Date, default: null },
    // Average cost per execution, in the agent's pricing currency.
    avgCost: { type: Number, default: null, min: 0 },
  },
  { _id: false },
);

/**
 * Breakdown of the AgentHub trust score (0..100 each). Computed by
 * trustScoreService — never hand-authored — so it stays explainable.
 */
const TrustSchema = new Schema(
  {
    overall: { type: Number, default: null, min: 0, max: 100 },
    identity: { type: Number, default: null, min: 0, max: 100 },
    performance: { type: Number, default: null, min: 0, max: 100 },
    activity: { type: Number, default: null, min: 0, max: 100 },
    reliability: { type: Number, default: null, min: 0, max: 100 },
    reviews: { type: Number, default: null, min: 0, max: 100 },
    // Fraction of factors we had real data for (0..1) — drives a confidence label.
    confidence: { type: Number, default: null, min: 0, max: 1 },
  },
  { _id: false },
);

const AgentSchema = new Schema(
  {
    // Public, URL-safe identifier used in /agents/:agentId.
    agentId: { type: String, required: true, unique: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    tagline: { type: String, default: '' },
    category: { type: String, required: true, enum: AGENT_CATEGORIES, index: true },
    subcategory: { type: String, default: '' },
    // Optional avatar URL; the UI renders initials when absent (no broken images).
    avatar: { type: String, default: '' },

    // On-chain identity. Null/empty for seeded agents — never fabricated.
    ownerAddress: { type: String, default: '' },
    chain: { type: String, default: 'bnb' },
    erc8004Id: { type: String, default: null },
    endpoint: { type: String, default: '' },
    serviceEndpoints: { type: [String], default: [] },

    skills: { type: [String], default: [], index: true },
    protocols: { type: [String], default: [] },
    tags: { type: [String], default: [] },

    pricing: { type: PricingSchema, default: () => ({}) },
    payment: { type: PaymentSchema, default: () => ({}) },
    metrics: { type: MetricsSchema, default: () => ({}) },
    trust: { type: TrustSchema, default: () => ({}) },
    // Denormalised overall trust for cheap sorting/filtering; mirrors trust.overall.
    trustScore: { type: Number, default: null, min: 0, max: 100, index: true },

    verified: { type: Boolean, default: false },
    status: { type: String, enum: AGENT_STATUSES, default: 'live', index: true },
    lastActiveAt: { type: Date, default: null },

    reviewCount: { type: Number, default: 0, min: 0 },
    ratingAvg: { type: Number, default: null, min: 0, max: 5 },

    source: { type: String, enum: AGENT_SOURCES, default: 'seeded', index: true },
    // Snapshot only; API capability remains computed by agentCapabilities.js.
    capability: { type: String, default: null },
    lastIndexedAt: { type: Date, default: null },
    lastVerifiedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Text index powers keyword search across the most relevant fields.
AgentSchema.index({
  name: 'text',
  description: 'text',
  tagline: 'text',
  skills: 'text',
  protocols: 'text',
  tags: 'text',
});

export const Agent = mongoose.model('Agent', AgentSchema);
