/**
 * Finder: natural-language query -> ranked agents.
 * Deterministic scoring (spec §27 / §10 recommended):
 *   40% task compatibility
 *   20% skill compatibility
 *   15% trust
 *   10% success
 *   10% price  (cheaper is better, within category)
 *    5% activity
 * Task/skill use keyword intent; price inverted; trust/success/activity normalized.
 * AI path is optional — when hasAiKey, classify intent via AI task classification,
 * otherwise deterministic intentFromQuery.
 */
import { classifyAgent, intentFromQuery } from './agentClassifier.js';
import { hasAiKey, env } from '../config/env.js';
import { Agent } from '../models/Agent.js';

const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'need', 'want', 'find', 'agent', 'help', 'please', 'an', 'a', 'to', 'of', 'in', 'on', 'is', 'it', 'my', 'me', 'i', 'you']);

function tokenize(q) {
  return String(q || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !STOP_WORDS.has(t) && t.length > 2);
}

function skillOverlapScore(agent, queryTokens) {
  const skillTokens = (agent.skills || []).join(' ').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const set = new Set(skillTokens);
  let hits = 0;
  for (const tok of queryTokens) if (set.has(tok)) hits++;
  if (queryTokens.length === 0) return 0;
  return Math.min(1, hits / Math.min(4, queryTokens.length));
}

function taskCompatScore(agent, intentCategory) {
  if (!intentCategory) return 0.3; // no clear intent -> neutral
  if (agent.category === intentCategory) return 1.0;
  // near neighbours get partial
  const neighbours = {
    'health-factor': ['yield', 'monitoring'],
    yield: ['health-factor', 'portfolio'],
    trading: ['yield', 'portfolio'],
    portfolio: ['yield', 'trading'],
    monitoring: ['research', 'health-factor'],
    research: ['monitoring'],
  };
  if ((neighbours[intentCategory] || []).includes(agent.category)) return 0.45;
  return 0.15;
}

function normalizedTrust(agent) {
  const t = agent.trustScore ?? agent.trust?.overall;
  return t == null ? 0.35 : t / 100;
}
function normalizedSuccess(agent) {
  const s = agent.metrics?.successRate;
  return s == null ? 0.35 : s / 100;
}
function normalizedActivity(agent) {
  const e = agent.metrics?.executions ?? 0;
  return Math.min(1, Math.log10(e + 1) / Math.log10(2000));
}
function normalizedPrice(agent, maxPriceInSet) {
  const p = agent.pricing?.amount ?? 0;
  if (maxPriceInSet <= 0) return 0.5;
  // cheaper = higher score, linear inverted
  return 1 - p / maxPriceInSet;
}

export function scoreAgent(agent, { intentCategory, queryTokens, maxPrice }) {
  const task = taskCompatScore(agent, intentCategory);
  const skill = skillOverlapScore(agent, queryTokens);
  const trust = normalizedTrust(agent);
  const success = normalizedSuccess(agent);
  const price = normalizedPrice(agent, maxPrice);
  const activity = normalizedActivity(agent);

  const score = 0.4 * task + 0.2 * skill + 0.15 * trust + 0.1 * success + 0.1 * price + 0.05 * activity;
  const pct = Math.round(score * 100);

  const reasons = [];
  if (task >= 0.9) reasons.push(`Strong category match: ${agent.category}`);
  else if (task >= 0.4) reasons.push(`Related category: ${agent.category}`);
  else reasons.push(`Category ${agent.category} — partial match`);
  if (skill > 0.3) reasons.push(`Skills overlap: ${(agent.skills || []).slice(0, 2).join(', ')}`);
  if (trust > 0.7) reasons.push(`High trust ${agent.trustScore ?? agent.trust?.overall}`);
  if (success > 0.8) reasons.push(`High success rate ${agent.metrics?.successRate}%`);

  return { score, pct, breakdown: { task, skill, trust, success, price, activity }, reasons };
}

async function aiClassifyIntent(query) {
  // Minimal AI-assisted classification — server-side only, never exposes key.
  // Falls back to deterministic on any failure. No new dependency.
  try {
    if (!hasAiKey) return null;
    // Generic OpenAI-compatible chat completions shape; works for many providers.
    // aiModel may be "claude-..." or "gpt-...".
    // If provider unsupported, we just return null and use fallback.
    const body = {
      model: env.aiModel,
      messages: [
        {
          role: 'system',
          content:
            'Classify the user request into one of: monitoring, trading, health-factor, yield, portfolio, research. Reply with just the category id, nothing else. If unclear, reply "none".',
        },
        { role: 'user', content: String(query).slice(0, 500) },
      ],
      max_tokens: 10,
      temperature: 0,
    };
    // Heuristic endpoint — try env-provided base? default to no-op if unknown.
    // We deliberately do NOT hardcode a vendor URL; if AI_API_KEY is set but we
    // don't know the endpoint, return null and use deterministic.
    // Expect AI_API_BASE optional; if absent, skip.
    const base = process.env.AI_API_BASE || process.env.AI_BASE_URL || '';
    if (!base) return null;
    const url = `${base.replace(/\/$/, '')}/chat/completions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${env.aiApiKey}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const text = json.choices?.[0]?.message?.content?.trim()?.toLowerCase() || '';
    const cats = ['monitoring', 'trading', 'health-factor', 'yield', 'portfolio', 'research'];
    for (const c of cats) if (text.includes(c)) return c;
    return null;
  } catch {
    return null;
  }
}

/**
 * Main entry: query string -> ranked results.
 * Returns { intentCategory, intentSource: 'ai'|'keyword'|'none', queryTokens, results: [{agent, score, pct, reasons}] }
 */
export async function findAgents(query, { limit = 12 } = {}) {
  const q = String(query || '').trim();
  if (!q) {
    return { intentCategory: null, intentSource: 'none', queryTokens: [], results: [] };
  }
  const queryTokens = tokenize(q);

  let intentCategory = await aiClassifyIntent(q);
  let intentSource = 'ai';
  if (!intentCategory) {
    intentCategory = intentFromQuery(q);
    intentSource = intentCategory ? 'keyword' : 'none';
    // if still none, try classifier on synthetic doc
    if (!intentCategory) {
      const pseudo = { name: q, description: q, tags: queryTokens };
      intentCategory = classifyAgent(pseudo);
      if (intentCategory) intentSource = 'keyword';
    }
  }

  // Fetch candidates — prefer DB agents matching intent category, plus broad search
  // Include both seeded and indexed; facets cover both.
  const filter = {};
  // Don't hard-filter by category; task compat handles ranking. Fetch all live/beta.
  const candidates = await Agent.find({ status: { $in: ['live', 'beta'] } })
    .select('-__v -_id')
    .lean();

  const maxPrice = Math.max(...candidates.map((a) => a.pricing?.amount ?? 0), 0.01);

  const scored = candidates.map((a) => {
    const s = scoreAgent(a, { intentCategory, queryTokens, maxPrice });
    return { agent: a, ...s };
  });

  // Boost search-relevance: if query tokens hit name/description/tags, add 0.08
  const qLower = q.toLowerCase();
  for (const r of scored) {
    const hay = `${r.agent.name} ${r.agent.description} ${r.agent.tagline} ${(r.agent.tags || []).join(' ')} ${(r.agent.skills || []).join(' ')}`.toLowerCase();
    let hits = 0;
    for (const tok of queryTokens) if (hay.includes(tok)) hits++;
    const boost = Math.min(0.08, hits * 0.02);
    r.score = Math.min(1, r.score + boost);
    r.pct = Math.round(r.score * 100);
  }

  scored.sort((a, b) => b.score - a.score);
  const results = scored.slice(0, limit);

  return { intentCategory, intentSource, queryTokens, results };
}
