/**
 * Presentation vocabulary for executions.
 *
 * The most important thing in this file is `SOURCE_META`. The backend tags every
 * result value with where it came from, and this is where those tags become
 * something a person can read at a glance. A "simulated" number must never look
 * the same as a chain reading — so they get different words, different colours,
 * and different icons, not a shared footnote.
 */

/** Terminal statuses — nothing more will happen without user action. */
export const TERMINAL_STATUSES = ['completed', 'failed'];

export const isTerminal = (status) => TERMINAL_STATUSES.includes(status);

export const STATUS_META = {
  pending: { label: 'Queued', variant: 'warn', description: 'Waiting to start.' },
  running: { label: 'Running', variant: 'info', description: 'The agent is working now.' },
  completed: { label: 'Completed', variant: 'ok', description: 'Finished successfully.' },
  failed: { label: 'Failed', variant: 'bad', description: 'Stopped before finishing.' },
};

/**
 * How each provenance tag is presented.
 *
 * `weight: 'strong'` marks the two tags that carry a claim about reality —
 * they're the ones a reader must not mistake for each other.
 */
export const SOURCE_META = {
  chain: {
    label: 'On-chain',
    variant: 'ok',
    weight: 'strong',
    tooltip: 'Read live from BNB Smart Chain Testnet during this run.',
  },
  derived: {
    label: 'Calculated',
    variant: 'info',
    tooltip: 'Arithmetic on the on-chain readings above. The assumptions are stated.',
  },
  input: {
    label: 'Your input',
    variant: 'neutral',
    tooltip: 'Echoed back from the task you configured.',
  },
  simulated: {
    label: 'Simulated',
    variant: 'warn',
    weight: 'strong',
    tooltip: 'Modelled, NOT read from the blockchain. Do not treat this as a real position.',
  },
  unavailable: {
    label: 'Not available',
    variant: 'neutral',
    tooltip: 'This build has no verified data source for this, so it was left out rather than guessed.',
  },
};

export const sourceMeta = (source) => SOURCE_META[source] || SOURCE_META.input;

/** Tone → Badge variant for a result field's own emphasis (risk level, etc.). */
export const TONE_VARIANTS = {
  ok: 'ok',
  warn: 'warn',
  bad: 'bad',
  info: 'info',
};

/**
 * Millisecond duration → a human phrase.
 *
 * Sub-second runs are shown in milliseconds rather than "0.0s", because the
 * whole point of the agent-advantage story is that the number is small and real.
 */
export function formatMs(ms) {
  if (ms == null) return '—';
  const n = Number(ms);
  if (!Number.isFinite(n)) return '—';
  if (n < 1000) return `${Math.round(n)}ms`;
  if (n < 60_000) return `${(n / 1000).toFixed(1)}s`;
  const min = Math.floor(n / 60_000);
  const sec = Math.round((n % 60_000) / 1000);
  return `${min}m ${sec}s`;
}

/** A block explorer address link for the chain the execution ran on. */
export function explorerAddressUrl(explorer, address) {
  if (!explorer || !address) return null;
  return `${explorer.replace(/\/$/, '')}/address/${address}`;
}

/** A block explorer block link. */
export function explorerBlockUrl(explorer, blockNumber) {
  if (!explorer || blockNumber == null) return null;
  return `${explorer.replace(/\/$/, '')}/block/${blockNumber}`;
}

/**
 * How long to wait between polls while a run is in flight.
 *
 * Runs finish in a couple of seconds, so this is short enough to show real
 * progress and long enough not to hammer the API. Polling stops entirely once
 * the status is terminal — see ExecutionPage.
 */
export const POLL_INTERVAL_MS = 700;

/**
 * Give up after this long. A run that hasn't finished by now is stuck, and a
 * spinner that never resolves is the one outcome the spec explicitly forbids.
 */
export const POLL_TIMEOUT_MS = 60_000;
