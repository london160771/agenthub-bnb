/**
 * Verified free read-only adapter for Range Keeper (ERC-8004 BSC Mainnet
 * 320966). Only the provider's position lookup is exposed; no action route is
 * called or surfaced by this adapter.
 */
import { TaskInputError } from '../agentExecutors.js';
import { getExternalAdapterKey } from '../agentCapabilities.js';

export const RANGE_KEEPER_ID = '56:320966';
export const RANGE_KEEPER_ENDPOINT = 'https://trustlist-range-keeper.onrender.com/position';
export const RANGE_KEEPER_CARD_URL = 'https://trustlist-range-keeper.onrender.com/.well-known/agent-card.json';
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TIMEOUT_MS = 30_000;

function fail(message) {
  throw new TaskInputError(message);
}

export function parseRangeKeeperInput(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Range Keeper input must be an object.');
  if (Object.keys(input).some((key) => !['id', 'notes'].includes(key))) fail('Range Keeper accepts only the position id.');
  const rawId = String(input.id || '').trim();
  if (!/^\d+$/.test(rawId)) fail('Enter a positive PancakeSwap V3 position id.');
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1 || id > 1_000_000_000) fail('The Range Keeper position id is outside the supported range.');
  return { id };
}

async function request(input) {
  const parsed = parseRangeKeeperInput(input);
  const url = new URL(RANGE_KEEPER_ENDPOINT);
  url.searchParams.set('id', String(parsed.id));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers: { accept: 'application/json' }, signal: controller.signal });
    const raw = await response.text();
    let body;
    try { body = JSON.parse(raw); } catch { fail('Range Keeper returned malformed JSON.'); }
    if (!response.ok) fail(`Range Keeper returned HTTP ${response.status}.`);
    return { body, parsed, url: url.toString() };
  } catch (err) {
    if (err instanceof TaskInputError) throw err;
    if (err?.name === 'AbortError') fail('Range Keeper did not respond within 30 seconds.');
    fail(`Range Keeper could not be reached: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}

function finite(value) {
  return Number.isFinite(Number(value));
}

function integer(value) {
  return Number.isSafeInteger(Number(value));
}

export function validateRangeKeeperResponse(body, requestedId) {
  const parsed = parseRangeKeeperInput({ id: requestedId });
  if (!body || typeof body !== 'object' || !integer(body.token_id) || Number(body.token_id) !== parsed.id) {
    fail('Range Keeper returned a result for a different position.');
  }
  if (typeof body.pair !== 'string' || !body.pair.trim() || !finite(body.fee_bps) || typeof body.liquidity !== 'string' && typeof body.liquidity !== 'number') {
    fail('Range Keeper returned malformed position identity data.');
  }
  if (typeof body.closed !== 'boolean' || typeof body.in_range !== 'boolean' || !integer(body.tick_lower) || !integer(body.tick_upper) || !integer(body.tick_current) || !integer(body.range_width_ticks) || Number(body.range_width_ticks) <= 0) {
    fail('Range Keeper returned malformed range data.');
  }
  if (typeof body.drift_side !== 'string' || !body.drift_side.trim() || !finite(body.drift_ticks) || !finite(body.drift_pct) || !finite(body.position_in_range)) {
    fail('Range Keeper returned malformed drift data.');
  }
  if (!finite(body.price_lower) || !finite(body.price_upper) || !finite(body.price_current) || typeof body.action !== 'string' || !body.action.trim() || typeof body.reason !== 'string' || !body.reason.trim()) {
    fail('Range Keeper returned malformed status data.');
  }
  if (!ADDRESS_RE.test(String(body.pool || '')) || !body.uncollected_fees || typeof body.uncollected_fees !== 'object' || Array.isArray(body.uncollected_fees)) {
    fail('Range Keeper returned incomplete pool evidence.');
  }
  if (body.proposed != null && (typeof body.proposed !== 'object' || Array.isArray(body.proposed))) {
    fail('Range Keeper returned malformed proposed-range data.');
  }
  if (typeof body.execution !== 'string' || !body.execution.trim()) fail('Range Keeper returned no read-only execution statement.');
  return body;
}

/** Keep provider status fields explicit; never turn a proposed range into an action. */
export function normalizeRangeKeeperResult(body, requestedId) {
  validateRangeKeeperResponse(body, requestedId);
  return {
    tokenId: Number(body.token_id),
    pair: body.pair,
    pool: body.pool,
    status: body.closed ? 'closed' : 'open',
    liquidity: String(body.liquidity),
    inRange: body.in_range,
    driftSide: body.drift_side,
    driftPct: Number(body.drift_pct),
    currentPrice: Number(body.price_current),
    action: body.action,
    reason: body.reason,
  };
}

export async function executeRangeKeeper({ agent, execution }) {
  if (getExternalAdapterKey(agent) !== 'range-keeper' || String(agent?.erc8004Id || '') !== RANGE_KEEPER_ID) {
    fail('This is not the verified Range Keeper agent.');
  }
  const { body, parsed, url } = await request(execution.input || {});
  validateRangeKeeperResponse(body, parsed.id);
  return {
    headline: `${body.pair} position ${body.closed ? 'closed' : (body.in_range ? 'in range' : 'out of range')}`,
    summary: `Range Keeper returned a real read-only position lookup for token #${parsed.id}. It reported status and liquidity only; AgentHub did not withdraw, re-add, trade, sign, or send anything.`,
    fields: [
      { key: 'agent', label: 'External agent', value: 'Range Keeper', source: 'external' },
      { key: 'positionId', label: 'Position id', value: String(body.token_id), source: 'input' },
      { key: 'pair', label: 'Pair', value: body.pair, source: 'external' },
      { key: 'pool', label: 'Pool contract', value: body.pool, source: 'external' },
      { key: 'positionStatus', label: 'Position status', value: body.closed ? 'Closed' : 'Open', source: 'external' },
      { key: 'liquidity', label: 'Liquidity', value: String(body.liquidity), source: 'external' },
      { key: 'inRange', label: 'In range', value: body.in_range ? 'Yes' : 'No', source: 'external', tone: body.in_range ? 'ok' : 'warn' },
      { key: 'driftSide', label: 'Drift side', value: body.drift_side, source: 'external' },
      { key: 'driftPct', label: 'Drift', value: `${body.drift_pct}%`, source: 'external' },
      { key: 'priceCurrent', label: 'Current price', value: String(body.price_current), source: 'external' },
      { key: 'action', label: 'Provider action', value: body.action, source: 'external' },
      { key: 'reason', label: 'Provider reason', value: body.reason, source: 'external' },
    ],
    warnings: [
      'This adapter exposes only the read-only position lookup. Range changes and liquidity actions are not available through AgentHub.',
      'The provider did not return a block number or block-pinned receipt for this response.',
    ],
    recommendation: 'Read-only position status returned. Review the provider reason; no liquidity action was created or authorized.',
    hasSimulated: false,
    provenance: {
      source: 'external-http',
      transport: 'external-http',
      endpoint: RANGE_KEEPER_ENDPOINT,
      metadataUrl: RANGE_KEEPER_CARD_URL,
      chainId: 56,
      network: 'BSC Mainnet',
      blockNumber: null,
      readAt: new Date().toISOString(),
      poolAddress: body.pool,
      receiptId: null,
      explorer: 'https://bscscan.com',
    },
    rawResponse: body,
    reads: [{ method: 'HTTP GET read-only position lookup', target: url, status: 200 }],
  };
}

export const rangeKeeperAdapter = Object.freeze({
  kind: 'execution',
  adapterKey: 'range-keeper',
  endpoint: RANGE_KEEPER_ENDPOINT,
  chainId: 56,
  canHandle: (agent) => getExternalAdapterKey(agent) === 'range-keeper' && String(agent?.erc8004Id || '') === RANGE_KEEPER_ID,
  execute: executeRangeKeeper,
});
