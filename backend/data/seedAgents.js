/**
 * Curated seed catalogue for AgentHub.
 *
 * HONESTY RULES (spec §25, §29 and execution prompt §25):
 *   - Every entry is `source: 'seeded'` — clearly demo/curated data.
 *   - We do NOT fabricate on-chain identity: `erc8004Id` and `ownerAddress`
 *     are left empty for seeded agents. `verified` here means "AgentHub-reviewed
 *     listing", a marketplace concept, not an on-chain ERC-8004 verification.
 *   - Metrics are illustrative marketplace data, surfaced with a "seeded" label
 *     in the UI, never presented as verified blockchain facts.
 *
 * Real/indexed registry data (Phase 10) will arrive with source
 * 'verified'/'indexed' and populate the on-chain identity fields.
 */

const DAY = 86_400_000;
const daysAgo = (n) => new Date(Date.now() - n * DAY);

export const seedAgents = [
  // ---------------- Health Factor ----------------
  {
    agentId: 'venus-health-guardian',
    name: 'Venus Health Guardian',
    // RELABELLED in Phase 7 alongside the three overpromising listings. This is
    // the one agent whose reads are now fully real, which makes the two words it
    // got wrong matter more, not less: "continuously" and "alerts you". There is
    // no scheduler and no notification channel in this build — a run happens when
    // you hire it, once. The rest of the claim is now literally true, so the
    // description says exactly which contract calls produce the answer.
    tagline: 'Reads your Venus position live and derives a reconciled health factor.',
    description:
      "Reads your Venus Core Pool position directly from BNB testnet: which markets you have entered, your supply and debt in each, each market's liquidation weight, and the Comptroller's own liquidity verdict. Reports that verdict first — a non-zero shortfall means Venus can liquidate you right now — then derives a health factor, which is only shown when re-deriving Venus's own liquidity figure from our per-market reads matches it to the wei. One reading per run: there is no background scheduler and no alerting in this build, so re-run it to take a fresh reading.",
    category: 'health-factor',
    subcategory: 'Liquidation risk (Venus Core Pool)',
    skills: [
      'Health factor analysis',
      'Liquidation risk scoring',
      'Venus market reads',
      'On-chain reconciliation',
    ],
    protocols: ['Venus'],
    tags: ['defi', 'lending', 'risk', 'liquidation'],
    pricing: { amount: 0.004, currency: 'BNB', model: 'per-task' },
    metrics: { executions: 1842, successRate: 98.6, avgResponseTime: 2.8, activeSince: daysAgo(180), avgCost: 0.004 },
    verified: true,
    status: 'live',
    lastActiveAt: daysAgo(0),
    reviewCount: 41,
    ratingAvg: 4.8,
  },
  {
    agentId: 'radiant-liquidation-shield',
    name: 'Radiant Liquidation Shield',
    // RELABELLED in Phase 7. This listing used to promise Radiant position
    // monitoring, which the code cannot do: `hasVerifiedDeployment('Radiant')` is
    // false, because no verified Radiant contract address for BNB testnet is on
    // file and guessing one could read a stranger's position as the user's own.
    // Running it now returns exactly that answer, with the wallet's real balance.
    // The listing has to say so up front — the tagline is truncated on cards, so
    // the caveat comes first rather than after a promise.
    tagline: 'Radiant reads unsupported — no verified testnet deployment.',
    description:
      'Reads the wallet itself live on BNB testnet, then reports plainly that AgentHub has no verified Radiant Capital deployment on file for this chain — so no position, collateral ratio or liquidation warning is produced. Nothing is estimated in place of the missing data. For a real, reconciled liquidation reading today, use Venus Health Guardian.',
    category: 'health-factor',
    subcategory: 'Unsupported protocol — read blocked',
    skills: ['Wallet balance read', 'Unsupported-protocol disclosure'],
    protocols: ['Radiant'],
    tags: ['defi', 'lending', 'risk'],
    pricing: { amount: 0.005, currency: 'BNB', model: 'per-task' },
    metrics: { executions: 604, successRate: 96.1, avgResponseTime: 3.6, activeSince: daysAgo(95), avgCost: 0.005 },
    verified: false,
    status: 'live',
    lastActiveAt: daysAgo(1),
    reviewCount: 12,
    ratingAvg: 4.5,
  },

  // ---------------- Monitoring ----------------
  {
    agentId: 'defi-position-sentinel',
    name: 'DeFi Position Sentinel',
    tagline: 'One agent to monitor every DeFi position you hold.',
    description:
      'Aggregates your lending, LP and staking positions across major BNB Chain protocols and notifies you on meaningful changes — utilisation spikes, reward drops, or approaching thresholds.',
    category: 'monitoring',
    subcategory: 'Position monitoring',
    skills: ['Position monitoring', 'Threshold alerts', 'Multi-protocol tracking'],
    protocols: ['Venus', 'PancakeSwap', 'Alpaca Finance'],
    tags: ['defi', 'monitoring', 'alerts'],
    pricing: { amount: 0.006, currency: 'BNB', model: 'subscription' },
    metrics: { executions: 2310, successRate: 97.4, avgResponseTime: 3.1, activeSince: daysAgo(220), avgCost: 0.006 },
    verified: true,
    status: 'live',
    lastActiveAt: daysAgo(0),
    reviewCount: 58,
    ratingAvg: 4.7,
  },
  {
    agentId: 'whale-move-watcher',
    name: 'Whale Move Watcher',
    tagline: 'Alerts you when large wallets move a token you care about.',
    description:
      'Tracks large transfers and swaps for a chosen token or wallet on BNB Smart Chain and pushes an alert with context (amount, counterparties, exchange flows) so you are not the last to know.',
    category: 'monitoring',
    subcategory: 'Whale tracking',
    skills: ['Whale tracking', 'Transfer analysis', 'Exchange-flow detection'],
    protocols: ['BscScan'],
    tags: ['monitoring', 'onchain', 'alerts'],
    pricing: { amount: 0, currency: 'BNB', model: 'free' },
    metrics: { executions: 5120, successRate: 95.0, avgResponseTime: 1.9, activeSince: daysAgo(300), avgCost: 0 },
    verified: false,
    status: 'live',
    lastActiveAt: daysAgo(0),
    reviewCount: 33,
    ratingAvg: 4.3,
  },
  {
    agentId: 'gas-window-agent',
    name: 'Gas Window Agent',
    tagline: 'Tells you the cheapest time to transact on BNB Chain.',
    description:
      'Samples recent BNB Chain gas prices and predicts low-fee windows, notifying you when it is a good moment to batch or send transactions.',
    category: 'monitoring',
    subcategory: 'Gas optimisation',
    skills: ['Gas tracking', 'Fee prediction', 'Timing alerts'],
    protocols: ['BNB Chain'],
    tags: ['monitoring', 'gas', 'utility'],
    pricing: { amount: 0, currency: 'BNB', model: 'free' },
    metrics: { executions: 890, successRate: 92.3, avgResponseTime: 1.2, activeSince: daysAgo(60), avgCost: 0 },
    verified: false,
    status: 'beta',
    lastActiveAt: daysAgo(3),
    reviewCount: 7,
    ratingAvg: 4.0,
  },

  // ---------------- Yield ----------------
  {
    agentId: 'yield-route-optimizer',
    name: 'Yield Route Optimizer',
    tagline: 'Finds the best risk-adjusted yield across BNB Chain.',
    description:
      'Scans lending markets and LP pools across major BNB Chain protocols, compares net APY after fees, and recommends where to allocate for a target risk level. Read-only analysis — you keep custody.',
    category: 'yield',
    subcategory: 'Yield optimisation',
    skills: ['APY comparison', 'Risk-adjusted ranking', 'Protocol scanning'],
    protocols: ['Venus', 'PancakeSwap', 'Wombat', 'Thena'],
    tags: ['defi', 'yield', 'apy'],
    pricing: { amount: 0.008, currency: 'BNB', model: 'per-task' },
    metrics: { executions: 1476, successRate: 94.9, avgResponseTime: 4.2, activeSince: daysAgo(150), avgCost: 0.008 },
    verified: true,
    status: 'live',
    lastActiveAt: daysAgo(0),
    reviewCount: 27,
    ratingAvg: 4.6,
  },
  {
    agentId: 'stable-yield-scanner',
    name: 'Stable Yield Scanner',
    tagline: 'Best stablecoin yields, ranked by safety.',
    description:
      'Focuses on stablecoin strategies (lending and stable LPs), ranking opportunities by net APY and a conservative safety heuristic. Returns a shortlist with the trade-offs spelled out.',
    category: 'yield',
    subcategory: 'Stablecoin yield',
    skills: ['Stablecoin strategies', 'APY comparison', 'Safety heuristics'],
    protocols: ['Venus', 'Lista DAO', 'Wombat'],
    tags: ['defi', 'yield', 'stablecoin'],
    pricing: { amount: 0.003, currency: 'BNB', model: 'per-task' },
    metrics: { executions: 733, successRate: 96.7, avgResponseTime: 3.4, activeSince: daysAgo(110), avgCost: 0.003 },
    verified: false,
    status: 'live',
    lastActiveAt: daysAgo(2),
    reviewCount: 15,
    ratingAvg: 4.4,
  },
  {
    agentId: 'farm-reward-harvester',
    name: 'Farm Reward Harvester',
    // RELABELLED in Phase 7. The old tagline promised to spot when compounding is
    // "worth the gas", which needs BOTH sides of the comparison. The yield
    // executor reads the gas side for real and reports the reward side as
    // unavailable, because pending rewards need a verified MasterChef address per
    // farm and none is on file. Half a comparison advertised as a whole one is
    // the overpromise, so the tagline now names which half is missing.
    tagline: 'Prices the gas cost of compounding. Pending rewards not read.',
    description:
      "Reads your wallet balance and the live BNB testnet gas price, then prices what a compound or deposit transaction would cost at this block. It does NOT read your pending farm rewards: that needs a verified MasterChef contract address for each farm, which this build does not have, so the reward side of the comparison is reported as unavailable rather than estimated. You get the real cost, and an explicit gap where the reward figure would go.",
    category: 'yield',
    subcategory: 'Gas-cost analysis',
    skills: ['Gas cost of compounding', 'Wallet funding check'],
    protocols: ['PancakeSwap', 'Biswap'],
    tags: ['defi', 'yield', 'farming'],
    pricing: { amount: 0.002, currency: 'BNB', model: 'per-task' },
    metrics: { executions: 512, successRate: 93.5, avgResponseTime: 2.6, activeSince: daysAgo(80), avgCost: 0.002 },
    verified: false,
    status: 'live',
    lastActiveAt: daysAgo(4),
    reviewCount: 9,
    ratingAvg: 4.2,
  },

  // ---------------- Trading ----------------
  {
    agentId: 'dca-scheduler',
    name: 'DCA Scheduler',
    tagline: 'Dollar-cost-average into any BNB Chain token on your schedule.',
    description:
      'Prepares recurring swap intents for a token you choose at an interval and size you set. Each swap is signed by your own wallet — the agent never holds funds or keys.',
    category: 'trading',
    subcategory: 'Dollar-cost averaging',
    skills: ['DCA scheduling', 'Swap routing', 'Intent preparation'],
    protocols: ['PancakeSwap'],
    tags: ['trading', 'dca', 'swaps'],
    pricing: { amount: 0.0015, currency: 'BNB', model: 'per-task' },
    metrics: { executions: 1980, successRate: 99.1, avgResponseTime: 2.2, activeSince: daysAgo(200), avgCost: 0.0015 },
    verified: true,
    status: 'live',
    lastActiveAt: daysAgo(0),
    reviewCount: 44,
    ratingAvg: 4.7,
  },
  {
    agentId: 'limit-order-runner',
    name: 'Limit Order Runner',
    tagline: 'Set a target price; get a ready-to-sign swap when it hits.',
    description:
      'Monitors on-chain prices and prepares a swap for your signature when your target is reached. You review and confirm every transaction — no discretionary trading.',
    category: 'trading',
    subcategory: 'Limit orders',
    skills: ['Price triggers', 'Swap preparation', 'Slippage guards'],
    protocols: ['PancakeSwap', 'Thena'],
    tags: ['trading', 'limit-order'],
    pricing: { amount: 0.002, currency: 'BNB', model: 'per-task' },
    metrics: { executions: 1104, successRate: 97.8, avgResponseTime: 2.5, activeSince: daysAgo(130), avgCost: 0.002 },
    verified: false,
    status: 'live',
    lastActiveAt: daysAgo(1),
    reviewCount: 19,
    ratingAvg: 4.4,
  },
  {
    agentId: 'arbitrage-scout',
    name: 'Arbitrage Scout',
    tagline: 'Surfaces cross-DEX price gaps — you decide whether to act.',
    description:
      'Compares prices for a token across BNB Chain DEXes and reports profitable spreads after estimated fees and slippage. Reporting only; it does not execute trades autonomously.',
    category: 'trading',
    subcategory: 'Arbitrage research',
    skills: ['Cross-DEX comparison', 'Spread analysis', 'Fee modelling'],
    protocols: ['PancakeSwap', 'Biswap', 'Thena'],
    tags: ['trading', 'arbitrage', 'research'],
    pricing: { amount: 0.01, currency: 'BNB', model: 'per-task' },
    metrics: { executions: 388, successRate: 90.4, avgResponseTime: 5.1, activeSince: daysAgo(70), avgCost: 0.01 },
    verified: false,
    status: 'beta',
    lastActiveAt: daysAgo(6),
    reviewCount: 5,
    ratingAvg: 3.9,
  },

  // ---------------- Portfolio ----------------
  {
    agentId: 'portfolio-xray',
    name: 'Portfolio X-Ray',
    tagline: 'A clear breakdown of everything your wallet holds.',
    description:
      'Reads your BNB Chain wallet and produces a categorised portfolio breakdown — tokens, LP positions, lending and staking — with allocation, exposure and simple risk notes.',
    category: 'portfolio',
    subcategory: 'Portfolio analysis',
    skills: ['Portfolio breakdown', 'Allocation analysis', 'Exposure detection'],
    protocols: ['Venus', 'PancakeSwap', 'Lista DAO'],
    tags: ['portfolio', 'analytics'],
    pricing: { amount: 0.003, currency: 'BNB', model: 'per-task' },
    metrics: { executions: 1650, successRate: 98.0, avgResponseTime: 3.0, activeSince: daysAgo(160), avgCost: 0.003 },
    verified: true,
    status: 'live',
    lastActiveAt: daysAgo(0),
    reviewCount: 36,
    ratingAvg: 4.6,
  },
  {
    agentId: 'rebalance-advisor',
    name: 'Rebalance Advisor',
    // RELABELLED in Phase 7. A rebalancing plan requires the wallet's BEP-20
    // token positions, and the portfolio executor reports those as unavailable —
    // enumerating them needs a verified token registry or an indexer, neither of
    // which is configured. So "tells you what to trade" described a capability
    // that does not exist. What the run genuinely produces is a native-balance
    // read and gas headroom, and that is now what the listing claims.
    tagline: 'Reads native balance only — no token allocations or swap plans.',
    description:
      "Reads the wallet's native tBNB balance and transaction count live from BNB testnet and works out how much gas headroom it has at the current gas price. It does NOT produce a rebalancing plan or size any swaps: that needs your BEP-20 token positions, which require a verified token registry or an indexer this build does not have, so token holdings come back marked unavailable rather than guessed. Nothing is proposed, signed or sent.",
    category: 'portfolio',
    subcategory: 'Balance read — no rebalancing plan',
    skills: ['Native balance read', 'Gas headroom analysis'],
    protocols: ['PancakeSwap'],
    tags: ['portfolio', 'rebalance'],
    pricing: { amount: 0.004, currency: 'BNB', model: 'per-task' },
    metrics: { executions: 421, successRate: 95.5, avgResponseTime: 3.8, activeSince: daysAgo(90), avgCost: 0.004 },
    verified: false,
    status: 'live',
    lastActiveAt: daysAgo(2),
    reviewCount: 8,
    ratingAvg: 4.1,
  },
  {
    agentId: 'pnl-reporter',
    name: 'PnL Reporter',
    tagline: 'Realised and unrealised PnL for your BNB Chain wallet.',
    description:
      'Reconstructs your trade history to estimate realised and unrealised profit and loss per token, with a summary you can export. Best-effort cost basis from on-chain data.',
    category: 'portfolio',
    subcategory: 'PnL tracking',
    skills: ['PnL calculation', 'Cost-basis estimation', 'Reporting'],
    protocols: ['BscScan'],
    tags: ['portfolio', 'pnl', 'analytics'],
    pricing: { amount: 0.002, currency: 'BNB', model: 'per-task' },
    metrics: { executions: 967, successRate: 91.8, avgResponseTime: 4.5, activeSince: daysAgo(120), avgCost: 0.002 },
    verified: false,
    status: 'live',
    lastActiveAt: daysAgo(1),
    reviewCount: 14,
    ratingAvg: 4.2,
  },

  // ---------------- Research ----------------
  {
    agentId: 'token-due-diligence',
    name: 'Token Due Diligence',
    tagline: 'A fast, structured risk read on any BNB Chain token.',
    description:
      'Given a token address, compiles liquidity, holder concentration, contract flags and basic risk signals into a structured due-diligence summary. Signals, not financial advice.',
    category: 'research',
    subcategory: 'Token research',
    skills: ['Token analysis', 'Holder concentration', 'Liquidity checks', 'Risk flags'],
    protocols: ['BscScan', 'PancakeSwap'],
    tags: ['research', 'due-diligence', 'risk'],
    pricing: { amount: 0.005, currency: 'BNB', model: 'per-task' },
    metrics: { executions: 1320, successRate: 96.2, avgResponseTime: 4.0, activeSince: daysAgo(140), avgCost: 0.005 },
    verified: true,
    status: 'live',
    lastActiveAt: daysAgo(0),
    reviewCount: 29,
    ratingAvg: 4.5,
  },
  {
    agentId: 'contract-risk-scanner',
    name: 'Contract Risk Scanner',
    tagline: 'Heuristic red-flags for a smart contract before you approve it.',
    description:
      'Analyses a verified contract for common risk patterns — unlimited mint, ownership controls, honeypot heuristics, proxy upgradeability — and summarises what to check before interacting.',
    category: 'research',
    subcategory: 'Contract analysis',
    skills: ['Contract analysis', 'Risk heuristics', 'Approval safety'],
    protocols: ['BscScan'],
    tags: ['research', 'security', 'contracts'],
    pricing: { amount: 0.006, currency: 'BNB', model: 'per-task' },
    metrics: { executions: 655, successRate: 93.0, avgResponseTime: 5.5, activeSince: daysAgo(100), avgCost: 0.006 },
    verified: false,
    status: 'live',
    lastActiveAt: daysAgo(3),
    reviewCount: 11,
    ratingAvg: 4.3,
  },
  {
    agentId: 'airdrop-eligibility-scout',
    name: 'Airdrop Eligibility Scout',
    tagline: 'Checks which BNB Chain airdrops your wallet may qualify for.',
    description:
      'Reviews your wallet activity against known airdrop criteria and lists potential eligibility with the actions that typically matter. Heuristic guidance, not a guarantee.',
    category: 'research',
    subcategory: 'Airdrop research',
    skills: ['Eligibility checks', 'Activity analysis', 'Opportunity scanning'],
    protocols: ['BscScan'],
    tags: ['research', 'airdrop'],
    pricing: { amount: 0, currency: 'BNB', model: 'free' },
    metrics: { executions: 2044, successRate: 89.5, avgResponseTime: 3.3, activeSince: daysAgo(75), avgCost: 0 },
    verified: false,
    status: 'beta',
    lastActiveAt: daysAgo(5),
    reviewCount: 0,
    ratingAvg: null,
  },
];

export default seedAgents;
