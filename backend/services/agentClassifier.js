/**
 * Deterministic classifier: registry text -> AGENT_CATEGORIES.
 * Input: name + description + tags + services. Output: category id or null.
 * Why own classifier: 8004scan categories=[] always, tags sparse, semantic
 * search conflates DeFi health-factor with medical health (PROJECT_HANDOFF §9A).
 * Category names must never be passed straight into search.
 * Provenance for anything classified is `derived`.
 */
import { AGENT_CATEGORIES } from '../models/Agent.js';

// Each category gets weighted keywords. Score = sum weights of matched keywords.
// Threshold 8 prevents weak single-keyword guesses; DeFi-health needs both
// health-ish AND defi-ish terms to fire.
const KEYWORDS = {
  'health-factor': [
    { re: /venus/i, w: 6 },
    { re: /health\s*factor/i, w: 6 },
    { re: /liquidation/i, w: 5 },
    { re: /comptroller/i, w: 5 },
    { re: /lending/i, w: 4 },
    { re: /borrow/i, w: 3 },
    { re: /collateral/i, w: 3 },
    { re: /risk\s*oracle/i, w: 4 },
    { re: /position.*health/i, w: 4 },
  ],
  yield: [
    { re: /yield/i, w: 5 },
    { re: /apy/i, w: 5 },
    { re: /vault/i, w: 4 },
    { re: /farming/i, w: 4 },
    { re: /farm/i, w: 3 },
    { re: /stake/i, w: 3 },
    { re: /staking/i, w: 4 },
    { re: /earn/i, w: 3 },
    { re: /\bvenus\b.*\byield/i, w: 4 },
    { re: /optimizer/i, w: 3 },
  ],
  trading: [
    { re: /grid/i, w: 5 },
    { re: /trading/i, w: 4 },
    { re: /trade/i, w: 3 },
    { re: /pancakeswap/i, w: 4 },
    { re: /swap/i, w: 3 },
    { re: /arbitrage/i, w: 5 },
    { re: /dex/i, w: 3 },
    { re: /liquidity.*range/i, w: 4 },
  ],
  portfolio: [
    { re: /portfolio/i, w: 5 },
    { re: /rebalan/i, w: 6 },
    { re: /allocation/i, w: 4 },
    { re: /holdings/i, w: 3 },
    { re: /pnl/i, w: 4 },
    { re: /concentrated.*liquidity/i, w: 4 },
    { re: /range.*rebalancer/i, w: 5 },
  ],
  monitoring: [
    { re: /monitor/i, w: 5 },
    { re: /sentinel/i, w: 4 },
    { re: /watch/i, w: 3 },
    { re: /whale/i, w: 4 },
    { re: /alert/i, w: 3 },
    { re: /tracker/i, w: 3 },
    { re: /gas.*window/i, w: 4 },
  ],
  research: [
    { re: /research/i, w: 4 },
    { re: /due\s*diligence/i, w: 5 },
    { re: /audit/i, w: 4 },
    { re: /scanner/i, w: 3 },
    { re: /risk.*scan/i, w: 4 },
    { re: /analytics/i, w: 3 },
    { re: /intelligence/i, w: 3 },
  ],
};

// Exclusion: medical / non-DeFi health agents that would false-positive health-factor
const HEALTH_FACTOR_REQUIRE_DEFI = /venus|defi|liquidation|lending|borrow|collateral|comptroller|bnb|bsc/i;
const MEDICAL_EXCLUDE = /hydration|heart\s*rate|medical|medipulse|vitality|health\s*track|wellness|hospital/i;

function textOf(agentLike) {
  const parts = [
    agentLike.name || '',
    agentLike.description || '',
    Array.isArray(agentLike.tags) ? agentLike.tags.join(' ') : '',
    Array.isArray(agentLike.services) ? agentLike.services.join(' ') : '',
    Array.isArray(agentLike.categories) ? agentLike.categories.join(' ') : '',
    agentLike.agent_url || agentLike.endpoint || '',
  ];
  return parts.join(' ').toLowerCase();
}

export function classifyAgent(agentLike) {
  const text = textOf(agentLike);
  if (!text.trim()) return null;

  // medical health-factor guard — drop rather than misclassify
  const looksMedical = MEDICAL_EXCLUDE.test(text);
  // score each category
  let best = null;
  let bestScore = 0;
  const scores = {};
  for (const cat of AGENT_CATEGORIES) {
    const rules = KEYWORDS[cat] || [];
    let score = 0;
    for (const { re, w } of rules) {
      if (re.test(text)) score += w;
    }
    scores[cat] = score;
    if (score > bestScore) {
      bestScore = score;
      best = cat;
    }
  }

  if (!best || bestScore < 8) return null;

  // special: health-factor must have DeFi context unless score very high
  if (best === 'health-factor' && bestScore < 12 && !HEALTH_FACTOR_REQUIRE_DEFI.test(text)) {
    // try second best
    let second = null;
    let secondScore = 0;
    for (const cat of AGENT_CATEGORIES) {
      if (cat === best) continue;
      if (scores[cat] > secondScore) {
        secondScore = scores[cat];
        second = cat;
      }
    }
    if (second && secondScore >= 8) return second;
    if (looksMedical) return null;
    return null;
  }

  // portfolio vs trading disambiguation: portfolio needs stronger signal for LP range
  // already handled by thresholds

  return AGENT_CATEGORIES.includes(best) ? best : null;
}

export function classifyWithScores(agentLike) {
  const cat = classifyAgent(agentLike);
  const text = textOf(agentLike);
  return { category: cat, textSnippet: text.slice(0, 200) };
}

// For Finder query -> category intent (used for task compatibility weighting)
const FINDER_INTENT_KEYWORDS = {
  'health-factor': ['health factor', 'liquidation', 'venus', 'lending', 'borrow', 'collateral'],
  yield: ['yield', 'apy', 'farm', 'staking', 'vault', 'earn', 'interest'],
  trading: ['trade', 'trading', 'grid', 'swap', 'arbitrage', 'dex'],
  portfolio: ['portfolio', 'rebalance', 'allocation', 'holdings'],
  monitoring: ['monitor', 'watch', 'track', 'alert', 'whale'],
  research: ['research', 'due diligence', 'scan', 'audit', 'analytics'],
};

export function intentFromQuery(query) {
  const q = String(query || '').toLowerCase();
  const scores = {};
  for (const [cat, kws] of Object.entries(FINDER_INTENT_KEYWORDS)) {
    let s = 0;
    for (const kw of kws) if (q.includes(kw)) s += 1;
    scores[cat] = s;
  }
  let best = null;
  let bestScore = 0;
  for (const [cat, s] of Object.entries(scores)) {
    if (s > bestScore) {
      bestScore = s;
      best = cat;
    }
  }
  return bestScore > 0 ? best : null;
}
