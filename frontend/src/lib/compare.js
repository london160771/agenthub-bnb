/**
 * COMPARE configuration and pure helpers (spec §39 phase 4).
 *
 * The comparison matrix is driven entirely by `COMPARE_SECTIONS` so rows stay
 * declarative: each row knows how to READ a value off an agent, how to FORMAT
 * it, and whether "higher" or "lower" is better. `computeBestByRow` then does
 * plain arithmetic over those already-displayed values — it never invents data,
 * and rows without data are simply not highlighted.
 *
 * Field names mirror the backend Agent document exactly (see AgentProfilePage):
 * the id is `agentId`, trust factors are flat on `trust`, and "last active" is
 * the top-level `lastActiveAt`.
 */
import { CATEGORIES } from '../config.js';
import { TRUST_FACTORS } from './trust.js';
import {
  formatBnb,
  formatCompactNumber,
  formatPercent,
  formatDuration,
  formatDate,
  relativeTime,
  confidenceLabel,
} from './format.js';

/** A matrix wider than 4 columns stops being comparable on any screen. */
export const MAX_COMPARE = 4;
/** Comparing needs at least two things to compare. */
export const MIN_COMPARE = 2;

const PRICING_MODEL_LABELS = {
  'per-task': 'Per task',
  subscription: 'Subscription',
  free: 'Free',
};

const categoryLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label || id || '—';
const shortAddress = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');

/**
 * Read the `?ids=a,b,c` param into a clean list: trimmed, de-duplicated and
 * capped at MAX_COMPARE so a hand-edited URL can never blow up the layout.
 */
export function parseIds(searchParams) {
  const raw = searchParams.get('ids') || '';
  const seen = new Set();
  const out = [];
  for (const part of raw.split(',')) {
    const id = part.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= MAX_COMPARE) break;
  }
  return out;
}

/** Append an id (no-op if already present or already at the cap). */
export function withId(ids, id) {
  if (!id || ids.includes(id) || ids.length >= MAX_COMPARE) return ids;
  return [...ids, id];
}

/** Remove an id. */
export function withoutId(ids, id) {
  return ids.filter((existing) => existing !== id);
}

/**
 * Ordered sections of comparable attributes.
 *
 * Row contract:
 *   key    — unique within the matrix
 *   label  — the pinned left-column text
 *   get    — (agent) => raw value, or null when there is no data
 *   format — (value, agent) => display string (nulls already handled by the
 *            format helpers, which render "—")
 *   kind   — 'score'  0–100 numeric, rendered with a bar
 *            'number' numeric, plain
 *            'text'   string
 *            'chips'  array of strings, rendered as badges
 *            'source' provenance value, rendered as a Badge via SOURCE_LABELS
 *   better — 'high' | 'low' to enable best-in-row highlighting, else null
 *   mono   — render the value in the mono font (addresses, endpoints)
 */
export const COMPARE_SECTIONS = [
  {
    key: 'trust',
    title: 'Trust',
    rows: [
      {
        key: 'trust-overall',
        label: 'Trust score',
        get: (a) => a.trustScore ?? a.trust?.overall ?? null,
        format: (v) => (v == null ? '—' : `${v} / 100`),
        kind: 'score',
        better: 'high',
      },
      {
        key: 'trust-confidence',
        label: 'Data confidence',
        get: (a) => a.trust?.confidence ?? null,
        format: (v) => confidenceLabel(v),
        kind: 'text',
        better: null,
      },
      // The five weighted factors behind the overall score.
      ...TRUST_FACTORS.map((f) => ({
        key: `trust-${f.key}`,
        label: `${f.label} (${Math.round(f.weight * 100)}%)`,
        get: (a) => a.trust?.[f.key] ?? null,
        format: (v) => (v == null ? 'No data' : String(v)),
        kind: 'score',
        better: 'high',
      })),
    ],
  },
  {
    key: 'pricing',
    title: 'Pricing',
    rows: [
      {
        key: 'price',
        label: 'Price',
        get: (a) => a.pricing?.amount ?? null,
        format: (v) => formatBnb(v),
        kind: 'number',
        better: 'low',
      },
      {
        key: 'pricing-model',
        label: 'Pricing model',
        get: (a) => a.pricing?.model ?? null,
        format: (v) => PRICING_MODEL_LABELS[v] || v || '—',
        kind: 'text',
        better: null,
      },
      {
        key: 'avg-cost',
        label: 'Avg cost / run',
        get: (a) => a.metrics?.avgCost ?? null,
        format: (v) => formatBnb(v),
        kind: 'number',
        better: 'low',
      },
    ],
  },
  {
    key: 'performance',
    title: 'Performance',
    rows: [
      {
        key: 'executions',
        label: 'Executions',
        get: (a) => a.metrics?.executions ?? null,
        format: (v) => formatCompactNumber(v),
        kind: 'number',
        better: 'high',
      },
      {
        key: 'success-rate',
        label: 'Success rate',
        get: (a) => a.metrics?.successRate ?? null,
        format: (v) => formatPercent(v),
        kind: 'number',
        better: 'high',
      },
      {
        key: 'avg-response',
        label: 'Avg response',
        get: (a) => a.metrics?.avgResponseTime ?? null,
        format: (v) => formatDuration(v),
        kind: 'number',
        better: 'low',
      },
      {
        key: 'rating',
        label: 'Rating',
        get: (a) => a.ratingAvg ?? null,
        format: (v, a) =>
          v == null ? '—' : `${v.toFixed(1)}★${a.reviewCount ? ` (${a.reviewCount})` : ''}`,
        kind: 'number',
        better: 'high',
      },
      {
        key: 'active-since',
        label: 'Active since',
        get: (a) => a.metrics?.activeSince ?? null,
        format: (v) => formatDate(v),
        kind: 'text',
        better: null,
      },
      {
        key: 'last-active',
        label: 'Last active',
        get: (a) => a.lastActiveAt ?? null,
        format: (v) => (v ? relativeTime(v) : '—'),
        kind: 'text',
        better: null,
      },
    ],
  },
  {
    key: 'identity',
    title: 'Identity & provenance',
    rows: [
      {
        key: 'source',
        label: 'Data source',
        get: (a) => a.source ?? null,
        format: (v) => v || '—',
        kind: 'source',
        better: null,
      },
      {
        key: 'verified',
        label: 'AgentHub-verified',
        get: (a) => a.verified ?? null,
        format: (v) => (v ? 'Yes' : 'No'),
        kind: 'text',
        better: null,
      },
      {
        key: 'erc8004',
        label: 'ERC-8004 ID',
        get: (a) => a.erc8004Id ?? null,
        format: (v) => (v ? `#${v}` : 'Not registered'),
        kind: 'text',
        better: null,
      },
      {
        key: 'owner',
        label: 'Owner',
        get: (a) => a.ownerAddress || null,
        format: (v) => (v ? shortAddress(v) : 'Not linked'),
        kind: 'text',
        better: null,
        mono: true,
      },
      {
        key: 'chain',
        label: 'Chain',
        get: () => 'BNB Smart Chain',
        format: (v) => v,
        kind: 'text',
        better: null,
      },
      {
        key: 'endpoint',
        label: 'Endpoint',
        get: (a) => a.endpoint || null,
        format: (v) => v || '—',
        kind: 'text',
        better: null,
        mono: true,
      },
    ],
  },
  {
    key: 'capabilities',
    title: 'Capabilities',
    rows: [
      {
        key: 'category',
        label: 'Category',
        get: (a) => a.category ?? null,
        format: (v) => categoryLabel(v),
        kind: 'text',
        better: null,
      },
      {
        key: 'subcategory',
        label: 'Subcategory',
        get: (a) => a.subcategory || null,
        format: (v) => v || '—',
        kind: 'text',
        better: null,
      },
      {
        key: 'skills',
        label: 'Skills',
        get: (a) => a.skills || [],
        kind: 'chips',
        variant: 'brand',
        better: null,
      },
      {
        key: 'protocols',
        label: 'Protocols',
        get: (a) => a.protocols || [],
        kind: 'chips',
        better: null,
      },
      {
        key: 'tags',
        label: 'Tags',
        get: (a) => a.tags || [],
        kind: 'chips',
        better: null,
      },
    ],
  },
];

/** Rows whose values can be ranked numerically. */
const COMPARABLE_KINDS = new Set(['score', 'number']);

/**
 * Which agents win a given row.
 *
 * Deliberately conservative so a highlight always means something:
 *  - only numeric rows with a `better` direction are ranked;
 *  - missing values are skipped, never treated as zero;
 *  - at least two agents must have data (nothing "wins" against no-one);
 *  - if every value is identical there is no winner to show;
 *  - genuine ties highlight every tied agent.
 *
 * @returns {Set<string>} winning `agentId`s (empty when no winner applies)
 */
export function computeBestByRow(agents = [], row) {
  const winners = new Set();
  if (!row?.better || !COMPARABLE_KINDS.has(row.kind)) return winners;

  const present = [];
  for (const agent of agents) {
    const value = row.get(agent);
    if (value == null || Number.isNaN(Number(value))) continue;
    present.push({ agentId: agent.agentId, value: Number(value) });
  }
  if (present.length < MIN_COMPARE) return winners;

  const values = present.map((p) => p.value);
  const best = row.better === 'low' ? Math.min(...values) : Math.max(...values);
  // All equal → no meaningful "best".
  if (values.every((v) => v === best)) return winners;

  for (const p of present) {
    if (p.value === best) winners.add(p.agentId);
  }
  return winners;
}
