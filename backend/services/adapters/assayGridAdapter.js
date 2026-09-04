/** Verified read-only adapter for Assay Grid (ERC-8004 BSC Mainnet 331751). */
import { TaskInputError } from '../agentExecutors.js';
import { getExternalAdapterKey } from '../agentCapabilities.js';

export const ASSAY_GRID_ENDPOINT = 'https://assay-ten-iota.vercel.app/api/agents/grid';
export const ASSAY_GRID_CARD_URL = `${ASSAY_GRID_ENDPOINT}/card`;
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TIMEOUT_MS = 15_000;

function fail(message) { throw new TaskInputError(message); }

function parseInput(input = {}) {
  const pool = String(input.pool || '').trim();
  if (!ADDRESS_RE.test(pool)) fail('Enter a valid PancakeSwap V3 pool address.');
  const steps = input.steps == null || String(input.steps).trim() === '' ? null : Number(input.steps);
  const spacingBps = input.spacingBps == null || String(input.spacingBps).trim() === '' ? null : Number(input.spacingBps);
  if (steps != null && (!Number.isInteger(steps) || steps < 1 || steps > 20)) fail('Grid steps must be a whole number from 1 to 20.');
  if (spacingBps != null && (!Number.isFinite(spacingBps) || spacingBps <= 0 || spacingBps > 10_000)) fail('Grid spacing must be between 0 and 10,000 basis points.');
  return { pool, steps, spacingBps };
}

async function request(input) {
  const parsed = parseInput(input);
  const url = new URL(ASSAY_GRID_ENDPOINT);
  url.searchParams.set('pool', parsed.pool);
  if (parsed.steps != null) url.searchParams.set('steps', String(parsed.steps));
  if (parsed.spacingBps != null) url.searchParams.set('spacingBps', String(parsed.spacingBps));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers: { accept: 'application/json' }, signal: controller.signal });
    const raw = await response.text();
    let body;
    try { body = JSON.parse(raw); } catch { fail('Assay Grid returned malformed JSON.'); }
    if (!response.ok) fail(`Assay Grid returned HTTP ${response.status}.`);
    return { body, url: url.toString(), parsed };
  } catch (err) {
    if (err instanceof TaskInputError) throw err;
    if (err?.name === 'AbortError') fail('Assay Grid did not respond within 15 seconds.');
    fail(`Assay Grid could not be reached: ${err.message}`);
  } finally { clearTimeout(timer); }
}

function validate(body, parsed) {
  if (!body || body.agent !== 'Assay Grid' || !Array.isArray(body.levels)) fail('Assay Grid returned an unsupported result shape.');
  if (!ADDRESS_RE.test(String(body.pool || '')) || String(body.pool).toLowerCase() !== parsed.pool.toLowerCase()) fail('Assay Grid returned a result for a different pool.');
  if (!Number.isFinite(Number(body.block)) || Number.isNaN(Date.parse(body.at)) || !Number.isFinite(Number(body.tick)) || !Number.isFinite(Number(body.midPriceRatio))) fail('Assay Grid returned no valid pool state.');
  for (const level of body.levels) {
    if (!level || !['buy', 'sell'].includes(level.side) || !Number.isFinite(Number(level.price))) fail('Assay Grid returned a malformed level.');
  }
}

function externalCell(value, opts = {}) { return { value: String(value), source: 'external', ...opts }; }

export async function executeAssayGrid({ agent, execution }) {
  if (getExternalAdapterKey(agent) !== 'assay-grid') fail('This is not the verified Assay Grid agent.');
  const { body, url, parsed } = await request(execution.input || {});
  validate(body, parsed);
  const rows = body.levels.map((level, index) => ({
    level: externalCell(index + 1),
    side: externalCell(level.side.toUpperCase()),
    price: externalCell(level.price),
  }));
  return {
    headline: body.verdict || `Assay Grid returned ${body.levels.length} live levels`,
    summary: `Assay Grid returned live PancakeSwap V3 pool data through an external HTTP service at BSC Mainnet block #${body.block}. This is a strategy plan only; no order was placed or signed.`,
    fields: [
      { key: 'agent', label: 'External agent', value: body.agent, source: 'external' },
      { key: 'pool', label: 'Pool', value: body.pool, source: 'external' },
      { key: 'tick', label: 'Current tick', value: String(body.tick), source: 'external' },
      { key: 'midPriceRatio', label: 'Mid-price ratio', value: String(body.midPriceRatio), source: 'external' },
      { key: 'spacingBps', label: 'Spacing', value: `${body.spacingBps} bps`, source: 'external' },
      { key: 'block', label: 'BSC Mainnet block', value: `#${Number(body.block).toLocaleString('en-US')}`, source: 'external' },
      { key: 'readAt', label: 'External read at', value: body.at, source: 'external' },
    ],
    tables: [{
      title: 'Assay Grid result',
      note: 'Levels are copied from the verified external response. They are not orders, quotes, or transaction calldata.',
      columns: [
        { key: 'level', label: 'Level' },
        { key: 'side', label: 'Side' },
        { key: 'price', label: 'Price' },
      ],
      rows,
    }],
    warnings: ['This is external HTTP/A2A-advertised service output, not a BSC RPC read and not a trade execution.'],
    recommendation: 'Read-only grid analysis returned. Review the plan separately before taking any action; AgentHub does not place orders.',
    hasSimulated: false,
    provenance: {
      source: 'external-http-a2a',
      transport: 'external-http',
      endpoint: ASSAY_GRID_ENDPOINT,
      metadataUrl: ASSAY_GRID_CARD_URL,
      chainId: 56,
      network: 'BSC Mainnet',
      blockNumber: Number(body.block),
      readAt: body.at,
      explorer: 'https://bscscan.com',
    },
    rawResponse: body,
    reads: [{ method: 'HTTP GET', target: url, status: 200 }],
  };
}

export const assayGridAdapter = Object.freeze({
  kind: 'execution',
  adapterKey: 'assay-grid',
  endpoint: ASSAY_GRID_ENDPOINT,
  chainId: 56,
  canHandle: (agent) => getExternalAdapterKey(agent) === 'assay-grid',
  execute: executeAssayGrid,
});
