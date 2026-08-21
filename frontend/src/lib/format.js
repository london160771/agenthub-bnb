/**
 * Presentation helpers for agent data. Kept in one place so cards, filters and
 * (later) the profile page render values consistently and honestly — nulls are
 * shown as "—" / "Unrated" rather than invented.
 */

/** Format a BNB price. 0 → "Free". Trailing zeros trimmed. */
export function formatBnb(amount) {
  if (amount == null) return '—';
  if (amount === 0) return 'Free';
  const s = Number(amount).toFixed(4).replace(/\.?0+$/, '');
  return `${s} BNB`;
}

/** Compact number: 1842 → "1.8K", 1_200_000 → "1.2M". */
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
export function formatCompactNumber(n) {
  if (n == null) return '—';
  return compact.format(n);
}

/** Percentage stored 0..100 → "98.6%"; null → "—". */
export function formatPercent(n, digits = 1) {
  if (n == null) return '—';
  const v = Number(n);
  return `${Number.isInteger(v) ? v : v.toFixed(digits)}%`;
}

/** Seconds → "2.8s" / "1.2m"; null → "—". */
export function formatDuration(seconds) {
  if (seconds == null) return '—';
  const v = Number(seconds);
  if (v < 60) return `${Number.isInteger(v) ? v : v.toFixed(1)}s`;
  return `${(v / 60).toFixed(1)}m`;
}

/**
 * Qualitative tone for the AgentHub trust score (0..100). Returns a Badge
 * variant plus a short word. A null score is clearly "Unrated" — never invented.
 */
export function trustTone(score) {
  if (score == null) return { variant: 'neutral', word: 'Unrated' };
  if (score >= 85) return { variant: 'ok', word: 'Excellent' };
  if (score >= 70) return { variant: 'ok', word: 'Strong' };
  if (score >= 55) return { variant: 'warn', word: 'Fair' };
  return { variant: 'bad', word: 'Low' };
}

/** Confidence fraction (0..1) → short label describing data completeness. */
export function confidenceLabel(confidence) {
  if (confidence == null) return 'no data';
  if (confidence >= 0.99) return 'full data';
  if (confidence >= 0.6) return 'partial data';
  return 'limited data';
}

/** Relative time from an ISO date string, e.g. "3h ago", "2d ago". */
export function relativeTime(dateInput) {
  if (!dateInput) return 'unknown';
  const then = new Date(dateInput).getTime();
  if (Number.isNaN(then)) return 'unknown';
  const sec = Math.round((Date.now() - then) / 1000);
  if (sec < 60) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.round(day / 7);
  if (wk < 5) return `${wk}w ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(day / 365)}y ago`;
}
