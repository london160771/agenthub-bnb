/**
 * Verified read-only adapter for GridBand Observer (ERC-8004 BSC Mainnet
 * 321995). The public registry endpoint is a documentation URL; the task
 * endpoint is kept separate so a metadata refresh cannot silently route a
 * task to a different service.
 */
import { TaskInputError } from '../agentExecutors.js';
import { getExternalAdapterKey } from '../agentCapabilities.js';

export const GRID_BAND_ID = '56:321995';
export const GRID_BAND_DOCS = 'https://range-pilot-watch.onrender.com/docs/agents/grid-band.html';
export const GRID_BAND_ENDPOINT = 'https://range-pilot-watch.onrender.com/agents/grid-band/assess';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const VERIFIED_POOL_ID = 'WBNB-USDT-500';
const TIMEOUT_MS = 30_000;

function fail(message) {
  throw new TaskInputError(message);
}

function parseBoundaries(value) {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',').map((item) => item.trim()).filter(Boolean)
      : null;
  if (!values || values.length !== 3) {
    fail('GridBand requires exactly three ascending tick boundaries, for example -100000,0,100000.');
  }
  const boundaries = values.map((value) => Number(value));
  if (boundaries.some((value) => !Number.isSafeInteger(value))) {
    fail('GridBand boundaries must be whole-number ticks.');
  }
  if (!(boundaries[0] < boundaries[1] && boundaries[1] < boundaries[2])) {
    fail('GridBand boundaries must be strictly ascending.');
  }
  return boundaries;
}

export function parseGridBandInput(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    fail('GridBand input must be an object.');
  }
  const keys = Object.keys(input);
  if (keys.some((key) => !['poolId', 'boundaries', 'notes'].includes(key))) {
    fail('GridBand accepts only poolId and boundaries.');
  }
  const poolId = String(input.poolId || '').trim();
  if (poolId !== VERIFIED_POOL_ID) {
    fail(`GridBand currently supports only the verified ${VERIFIED_POOL_ID} pool.`);
  }
  return { poolId, boundaries: parseBoundaries(input.boundaries) };
}

async function request(input) {
  const parsed = parseGridBandInput(input);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(GRID_BAND_ENDPOINT, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(parsed),
      signal: controller.signal,
    });
    const raw = await response.text();
    let body;
    try { body = JSON.parse(raw); } catch { fail('GridBand returned malformed JSON.'); }
    if (!response.ok) fail(`GridBand returned HTTP ${response.status}.`);
    return { body, parsed };
  } catch (err) {
    if (err instanceof TaskInputError) throw err;
    if (err?.name === 'AbortError') fail('GridBand did not respond within 30 seconds.');
    fail(`GridBand could not be reached: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}

function sameBoundaries(left, right) {
  return Array.isArray(left) && left.length === right.length && left.every((value, index) => Number(value) === right[index]);
}

function validTimestamp(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function validBlock(value) {
  return Number.isSafeInteger(Number(value)) && Number(value) > 0;
}

export function validateGridBandResponse(body, input) {
  const parsed = parseGridBandInput(input);
  if (!body || typeof body !== 'object' || body.schemaVersion !== '1.0.0') {
    fail('GridBand returned an unsupported result shape.');
  }
  if (body.agent?.id !== 'grid-band' || body.status !== 'completed' || Number(body.chainId) !== 56) {
    fail('GridBand did not return a completed BSC Mainnet observation.');
  }
  if (
    body.request?.poolId !== parsed.poolId ||
    !sameBoundaries(body.request?.boundaries, parsed.boundaries)
  ) {
    fail('GridBand returned a result for a different grid request.');
  }
  if (!body.assessment || typeof body.assessment !== 'object') {
    fail('GridBand returned no assessment payload.');
  }
  if (!Number.isSafeInteger(Number(body.assessment.currentTick))) {
    fail('GridBand returned no valid current tick.');
  }
  if (!body.assessment.placement || typeof body.assessment.placement.kind !== 'string' || !Number.isInteger(Number(body.assessment.placement.bandIndex))) {
    fail('GridBand returned no valid placement evidence.');
  }
  if (!Array.isArray(body.assessment.observedCrossings)) {
    fail('GridBand returned no crossings observation.');
  }
  if (!validBlock(body.evidence?.block?.number) || !validTimestamp(body.evidence?.block?.timestamp)) {
    fail('GridBand returned no valid block evidence.');
  }
  if (!ADDRESS_RE.test(String(body.evidence?.contractAddresses?.pool || ''))) {
    fail('GridBand returned no valid pool contract evidence.');
  }
  if (!Array.isArray(body.evidence?.sourceLinks) || body.evidence.sourceLinks.length === 0 || body.evidence.sourceLinks.some((link) => typeof link !== 'string' || !link.trim())) {
    fail('GridBand returned no source links.');
  }
  if (!validTimestamp(body.evidence?.observedAt || body.observedAt) || typeof body.receiptId !== 'string' || !body.receiptId.trim()) {
    fail('GridBand returned incomplete observation receipt evidence.');
  }
  for (const key of ['unknowns', 'limitations']) {
    if (!Array.isArray(body[key]) || body[key].some((value) => typeof value !== 'string')) {
      fail(`GridBand returned malformed ${key}.`);
    }
  }
  return body;
}

function external(value, opts = {}) {
  return { value: value == null ? 'Not reported' : String(value), source: 'external', ...opts };
}

export async function executeGridBand({ agent, execution }) {
  if (getExternalAdapterKey(agent) !== 'grid-band' || String(agent?.erc8004Id || '') !== GRID_BAND_ID) {
    fail('This is not the verified GridBand Observer agent.');
  }
  const { body, parsed } = await request(execution.input || {});
  validateGridBandResponse(body, parsed);
  const observedAt = body.evidence.observedAt || body.observedAt;
  const blockNumber = Number(body.evidence.block.number);
  return {
    headline: `GridBand placed ${parsed.poolId} inside the declared grid`,
    summary: `GridBand returned a real, read-only PancakeSwap V3 observation at BSC Mainnet block #${blockNumber.toLocaleString('en-US')}. It reported placement only; no trade, quote, wallet, signing, or transaction was used.`,
    fields: [
      { key: 'agent', label: 'External agent', value: 'GridBand Observer', source: 'external' },
      { key: 'poolId', label: 'Pool', value: parsed.poolId, source: 'input' },
      { key: 'poolAddress', label: 'Pool contract', value: body.evidence.contractAddresses.pool, source: 'external' },
      { key: 'currentTick', label: 'Current tick', value: String(body.assessment.currentTick), source: 'external' },
      { key: 'boundaries', label: 'Declared tick boundaries', value: parsed.boundaries.join(', '), source: 'input' },
      { key: 'placement', label: 'Grid placement', value: body.assessment.placement.kind, source: 'external' },
      { key: 'bandIndex', label: 'Band index', value: String(body.assessment.placement.bandIndex), source: 'external' },
      { key: 'crossings', label: 'Observed crossings', value: String(body.assessment.observedCrossings.length), source: 'external' },
      { key: 'block', label: 'BSC Mainnet block', value: `#${blockNumber.toLocaleString('en-US')}`, source: 'external' },
      { key: 'receiptId', label: 'Observation receipt', value: body.receiptId, source: 'external' },
      { key: 'observedAt', label: 'Observed at', value: observedAt, source: 'external' },
    ],
    warnings: [
      'This is external HTTP read-only output, not a trade execution or financial recommendation.',
      ...body.unknowns.map((value) => `Provider limitation: ${value}`),
      ...body.limitations.map((value) => `Provider limitation: ${value}`),
    ],
    recommendation: 'Read-only grid placement returned. Review the block-pinned evidence separately; AgentHub did not place or authorize an order.',
    hasSimulated: false,
    provenance: {
      source: 'external-http',
      transport: 'external-http',
      endpoint: GRID_BAND_ENDPOINT,
      metadataUrl: GRID_BAND_DOCS,
      chainId: 56,
      network: 'BSC Mainnet',
      blockNumber,
      readAt: observedAt,
      receiptId: body.receiptId,
      poolAddress: body.evidence.contractAddresses.pool,
      sourceLinks: body.evidence.sourceLinks,
      explorer: 'https://bscscan.com',
    },
    rawResponse: body,
    reads: [{ method: 'HTTP POST read-only assessment', target: GRID_BAND_ENDPOINT, status: 200 }],
  };
}

export const gridBandAdapter = Object.freeze({
  kind: 'execution',
  adapterKey: 'grid-band',
  endpoint: GRID_BAND_DOCS,
  taskEndpoint: GRID_BAND_ENDPOINT,
  chainId: 56,
  canHandle: (agent) => getExternalAdapterKey(agent) === 'grid-band' && String(agent?.erc8004Id || '') === GRID_BAND_ID,
  execute: executeGridBand,
});
