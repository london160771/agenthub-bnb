/**
 * HIRE configuration and pure helpers (spec §39 phase 5).
 *
 * The hire form is driven entirely by `HIRE_FIELDS`, in the same declarative
 * spirit as `lib/compare.js`: each field knows its own label, type, validation
 * bounds and help text, so `TaskConfigForm` renders whatever the agent's
 * category asks for without a single per-category branch in JSX.
 *
 * Why per-category fields at all? A health-factor agent needs a position wallet
 * and a warning threshold; a trading agent needs an amount and a schedule.
 * Seeded agents carry no input schema of their own (see backend/data/seedAgents.js),
 * so the category is the honest basis for deciding which questions to ask.
 *
 * Field contract:
 *   key         — unique within the form; becomes a key of `Execution.input`
 *   label       — visible label
 *   type        — 'address' | 'number' | 'select' | 'text' | 'textarea'
 *   required    — blocks submission when empty
 *   placeholder — example value (never a real-looking address)
 *   help        — one line under the field, in plain language
 *   unit        — suffix shown inside the field ('%', 'tBNB', …)
 *   min / max   — numeric bounds, validated as well as passed to the input
 *   step        — numeric input granularity
 *   options     — [{ value, label }] for selects
 *   optionsFrom — build options from agent data instead ('protocols')
 *   default     — initial value; 'wallet' means "prefill the connected address"
 *   wallet      — true when the field means "somebody's wallet", so offering the
 *                 connected address makes sense. Not every address is a wallet:
 *                 a token contract field must not invite you to paste your own.
 *   maxLength   — for text/textarea
 */
import { CATEGORIES } from '../config.js';
import { isAddress } from './wallet.js';

/** Kept in step with the backend's `task` column limit (300 chars). */
export const MAX_TASK_LENGTH = 300;

const DEPTH_OPTIONS = [
  { value: 'quick', label: 'Quick — headline findings only' },
  { value: 'standard', label: 'Standard — balanced report' },
  { value: 'deep', label: 'Deep — full breakdown' },
];

const FREQUENCY_OPTIONS = [
  { value: '5m', label: 'Every 5 minutes' },
  { value: '1h', label: 'Every hour' },
  { value: '6h', label: 'Every 6 hours' },
  { value: '24h', label: 'Once a day' },
];

const SCHEDULE_OPTIONS = [
  { value: 'once', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

/**
 * Optional free-text field appended to every category. Last, because it's the
 * escape hatch for anything the typed fields don't cover.
 */
const NOTES_FIELD = {
  key: 'notes',
  label: 'Anything else the agent should know',
  type: 'textarea',
  required: false,
  placeholder: 'Optional context, constraints or preferences.',
  maxLength: 500,
};

export const HIRE_FIELDS = {
  'health-factor': [
    {
      key: 'positionWallet',
      label: 'Wallet holding the position',
      type: 'address',
      required: true,
      placeholder: '0x…',
      help: 'The address whose lending position should be watched. Read-only — the agent never moves funds.',
      wallet: true,
      default: 'wallet',
    },
    {
      key: 'protocol',
      label: 'Lending protocol',
      type: 'select',
      required: true,
      optionsFrom: 'protocols',
      help: 'Taken from the protocols this agent lists support for.',
    },
    {
      key: 'warnBelow',
      label: 'Warn me when health factor drops below',
      type: 'number',
      required: true,
      default: 1.5,
      min: 1,
      max: 5,
      step: 0.1,
      help: 'A health factor of 1.0 is the liquidation point, so a buffer above it gives you time to react.',
    },
  ],

  research: [
    {
      key: 'tokenAddress',
      label: 'Token or contract address',
      type: 'address',
      required: true,
      placeholder: '0x…',
      help: 'The BEP-20 token or contract to investigate.',
    },
    {
      key: 'depth',
      label: 'Analysis depth',
      type: 'select',
      required: true,
      options: DEPTH_OPTIONS,
      default: 'standard',
    },
  ],

  portfolio: [
    {
      key: 'walletAddress',
      label: 'Wallet to analyse',
      type: 'address',
      required: true,
      placeholder: '0x…',
      help: 'Read-only analysis of public on-chain balances and positions.',
      wallet: true,
      default: 'wallet',
    },
    {
      key: 'targetAllocation',
      label: 'Target allocation (rebalancing)',
      type: 'text',
      required: false,
      placeholder: '0xTokenA:60,0xTokenB:40',
      help: 'For rebalancing analysis: comma-separated 0xAddress:weight (weights sum 100). Leave blank for native-only report.',
      maxLength: 500,
    },
    {
      key: 'reportDepth',
      label: 'Report depth',
      type: 'select',
      required: true,
      options: [
        { value: 'summary', label: 'Summary — key numbers' },
        { value: 'full', label: 'Full — position by position' },
      ],
      default: 'summary',
    },
  ],

  trading: [
    {
      key: 'tokenAddress',
      label: 'Token to trade',
      type: 'address',
      required: true,
      placeholder: '0x…',
      help: 'The BEP-20 token the strategy should target.',
    },
    {
      key: 'amountPerTrade',
      label: 'Amount per trade',
      type: 'number',
      required: true,
      min: 0.0001,
      max: 1000,
      step: 0.0001,
      unit: 'tBNB',
      help: 'Test-network amount only. For grid planning, still required as fallback.',
    },
    {
      key: 'schedule',
      label: 'Schedule',
      type: 'select',
      required: true,
      options: SCHEDULE_OPTIONS,
      default: 'weekly',
    },
    {
      key: 'maxSlippage',
      label: 'Maximum slippage',
      type: 'number',
      required: true,
      default: 0.5,
      min: 0.1,
      max: 20,
      step: 0.1,
      unit: '%',
      help: 'How far the fill price may drift from the quote before the trade is abandoned.',
    },
    {
      key: 'lowerBound',
      label: 'Grid lower bound',
      type: 'number',
      required: false,
      min: 0.0001,
      max: 1000000,
      step: 0.0001,
      help: 'For grid planning: lower price. Leave blank for DCA mode.',
    },
    {
      key: 'upperBound',
      label: 'Grid upper bound',
      type: 'number',
      required: false,
      min: 0.0001,
      max: 1000000,
      step: 0.0001,
      help: 'For grid planning: upper price (must be > lower).',
    },
    {
      key: 'gridLevels',
      label: 'Grid levels',
      type: 'number',
      required: false,
      min: 2,
      max: 50,
      step: 1,
      help: 'Number of price levels (2–50).',
    },
    {
      key: 'capitalPerLevel',
      label: 'Capital per level',
      type: 'number',
      required: false,
      min: 0.0001,
      max: 1000,
      step: 0.0001,
      unit: 'tBNB',
      help: 'Capital committed per grid level.',
    },
    {
      key: 'referencePrice',
      label: 'Reference price (optional)',
      type: 'number',
      required: false,
      min: 0.0001,
      max: 1000000,
      step: 0.0001,
      help: 'If blank, tries Venus oracle for listed tokens; otherwise provide price.',
    },
  ],

  monitoring: [
    {
      key: 'watchTarget',
      label: 'Wallet or token to watch',
      type: 'address',
      required: true,
      placeholder: '0x…',
      help: 'Any public address on BNB Smart Chain.',
      // Offered but not prefilled: watching your own wallet is a common case, but
      // so is watching someone else's, so neither should be assumed.
      wallet: true,
    },
    {
      key: 'changeThreshold',
      label: 'Alert me on moves larger than',
      type: 'number',
      required: true,
      default: 10,
      min: 0.1,
      max: 100,
      step: 0.1,
      unit: '%',
    },
    {
      key: 'frequency',
      label: 'Check frequency',
      type: 'select',
      required: true,
      options: FREQUENCY_OPTIONS,
      default: '1h',
    },
  ],

  yield: [
    {
      key: 'allocationAmount',
      label: 'Amount to allocate',
      type: 'number',
      required: true,
      min: 0.0001,
      max: 10000,
      step: 0.0001,
      unit: 'tBNB',
      help: 'Test-network amount only — nothing is deposited in this phase.',
    },
    {
      key: 'riskLevel',
      label: 'Risk level',
      type: 'select',
      required: true,
      options: [
        { value: 'conservative', label: 'Conservative — established pools' },
        { value: 'balanced', label: 'Balanced' },
        { value: 'aggressive', label: 'Aggressive — higher yield, higher risk' },
      ],
      default: 'balanced',
    },
    {
      key: 'minApy',
      label: 'Minimum net APY',
      type: 'number',
      required: false,
      min: 0,
      max: 1000,
      step: 0.1,
      unit: '%',
      help: 'Optional. Leave blank to consider every opportunity.',
    },
  ],
};

/**
 * Fields for an agent, with `optionsFrom` resolved against the agent document
 * and the shared notes field appended.
 *
 * An unknown category falls back to notes only, rather than guessing at fields
 * we have no basis for.
 */
export function fieldsFor(agent) {
  const base = HIRE_FIELDS[agent?.category] || [];
  const resolved = base.map((field) => {
    if (field.optionsFrom !== 'protocols') return field;
    const protocols = agent?.protocols || [];
    return { ...field, options: protocols.map((p) => ({ value: p, label: p })) };
  });
  return [...resolved, NOTES_FIELD];
}

/**
 * Initial form values. Address fields marked `default: 'wallet'` prefill from
 * the connected address so the common case is one tap; single-option selects
 * preselect because there is nothing to choose.
 */
export function defaultValuesFor(agent, address) {
  const values = {};
  for (const field of fieldsFor(agent)) {
    if (field.default === 'wallet') {
      values[field.key] = address || '';
    } else if (field.default != null) {
      values[field.key] = field.default;
    } else if (field.type === 'select') {
      const options = field.options || [];
      values[field.key] = options.length === 1 ? options[0].value : '';
    } else {
      values[field.key] = '';
    }
  }
  return values;
}

/**
 * Per-field validation. Returns `{ [key]: message }` — empty means valid.
 * Messages say what to do, not just what's wrong.
 */
export function validateHireInput(agent, values = {}) {
  const errors = {};

  for (const field of fieldsFor(agent)) {
    const raw = values[field.key];
    const empty = raw == null || String(raw).trim() === '';

    if (empty) {
      if (field.required) errors[field.key] = 'This is required.';
      continue; // optional + empty is fine; nothing else to check
    }

    if (field.type === 'address' && !isAddress(String(raw))) {
      errors[field.key] = 'Enter a full address: 0x followed by 40 characters.';
      continue;
    }

    if (field.type === 'number') {
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        errors[field.key] = 'Enter a number.';
      } else if (field.min != null && n < field.min) {
        errors[field.key] = `Must be ${field.min} or more.`;
      } else if (field.max != null && n > field.max) {
        errors[field.key] = `Must be ${field.max} or less.`;
      }
      continue;
    }

    if (field.type === 'select') {
      const allowed = (field.options || []).map((o) => o.value);
      if (allowed.length > 0 && !allowed.includes(String(raw))) {
        errors[field.key] = 'Choose one of the listed options.';
      }
      continue;
    }

    if (field.maxLength && String(raw).length > field.maxLength) {
      errors[field.key] = `Keep this under ${field.maxLength} characters.`;
    }
  }

  return errors;
}

/**
 * Form values → the `input` object stored on the execution.
 * Empty optional fields are dropped rather than stored as '' , and numeric
 * fields are stored as numbers so the record is queryable later.
 */
export function toInputPayload(agent, values = {}) {
  const payload = {};
  for (const field of fieldsFor(agent)) {
    const raw = values[field.key];
    if (raw == null || String(raw).trim() === '') continue;
    payload[field.key] =
      field.type === 'number' ? Number(raw) : String(raw).trim();
  }
  return payload;
}

const categoryLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label || id || 'task';
const shortish = (v) => (isAddress(String(v)) ? `${String(v).slice(0, 6)}…${String(v).slice(-4)}` : String(v));

/**
 * A one-line, human-readable description of the job — this becomes
 * `Execution.task`, which is what the activity list and execution page show.
 * Built from the same values the user just confirmed, and truncated to the
 * backend's limit so a long note can never fail the request.
 */
export function buildTaskSummary(agent, values = {}) {
  const fields = fieldsFor(agent).filter((f) => f.key !== 'notes');
  const parts = [];
  for (const field of fields) {
    const raw = values[field.key];
    if (raw == null || String(raw).trim() === '') continue;
    parts.push(`${field.label.toLowerCase()}: ${shortish(raw)}${field.unit ? ` ${field.unit}` : ''}`);
  }

  const head = `${agent?.name || 'Agent'} — ${categoryLabel(agent?.category).toLowerCase()} task`;
  const summary = parts.length > 0 ? `${head} (${parts.join('; ')})` : head;
  return summary.length > MAX_TASK_LENGTH
    ? `${summary.slice(0, MAX_TASK_LENGTH - 1)}…`
    : summary;
}
