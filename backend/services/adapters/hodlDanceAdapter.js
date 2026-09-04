/**
 * Verified free read-only adapter for HODL.DANCE (ERC-8004 BSC Mainnet 96231).
 *
 * The published AgentCard exposes both read and write skills. AgentHub only
 * uses the public token-list REST task here; quote/trade/create skills require
 * a private key and are deliberately not part of this adapter.
 */
import { TaskInputError } from '../agentExecutors.js';
import { getExternalAdapterKey } from '../agentCapabilities.js';

export const HODL_DANCE_ENDPOINT = 'https://hodl.dance/api/tokens';
export const HODL_DANCE_CARD_URL = 'https://hodl.dance/.well-known/agent-card.json';
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const SORTS = new Set(['newest', 'market_cap', 'progress', 'volume']);
const TIMEOUT_MS = 15_000;

function fail(message) { throw new TaskInputError(message); }

function parseInput(input = {}) {
  const sort = input.sort == null || String(input.sort).trim() === '' ? 'volume' : String(input.sort).trim();
  if (!SORTS.has(sort)) fail('Choose a supported HODL.DANCE token sort.');
  const limit = input.limit == null || String(input.limit).trim() === '' ? 5 : Number(input.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) fail('HODL.DANCE accepts a limit from 1 to 20.');
  const offset = input.offset == null || String(input.offset).trim() === '' ? 0 : Number(input.offset);
  if (!Number.isInteger(offset) || offset < 0 || offset > 1000) fail('HODL.DANCE accepts an offset from 0 to 1000.');
  const search = input.search == null ? '' : String(input.search).trim();
  if (search.length > 80) fail('HODL.DANCE search text must be 80 characters or fewer.');
  return { sort, limit, offset, search };
}

async function request(params) {
  const url = new URL(HODL_DANCE_ENDPOINT);
  url.searchParams.set('sort', params.sort);
  url.searchParams.set('limit', String(params.limit));
  url.searchParams.set('offset', String(params.offset));
  if (params.search) url.searchParams.set('search', params.search);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers: { accept: 'application/json' }, signal: controller.signal });
    const raw = await response.text();
    let body;
    try { body = JSON.parse(raw); } catch { fail('HODL.DANCE returned malformed JSON.'); }
    if (!response.ok) fail(`HODL.DANCE returned HTTP ${response.status}.`);
    return { body, url: url.toString() };
  } catch (err) {
    if (err instanceof TaskInputError) throw err;
    if (err?.name === 'AbortError') fail('HODL.DANCE did not respond within 15 seconds.');
    fail(`HODL.DANCE could not be reached: ${err.message}`);
  } finally { clearTimeout(timer); }
}

function validate(body, params) {
  const data = body?.data;
  if (!body || body.success !== true || !data || !Array.isArray(data.tokens)) fail('HODL.DANCE returned an unsupported token-list result.');
  for (const token of data.tokens) {
    if (!token || !ADDRESS_RE.test(String(token.address || '')) || typeof token.name !== 'string' || typeof token.symbol !== 'string') fail('HODL.DANCE returned a malformed token row.');
    if (token.chainId != null && Number(token.chainId) !== 56) fail('HODL.DANCE returned a token from an unexpected chain.');
  }
  if (data.total != null && !Number.isFinite(Number(data.total))) fail('HODL.DANCE returned an invalid total.');
  if (data.limit != null && Number(data.limit) !== params.limit) fail('HODL.DANCE returned an unexpected limit.');
  if (data.offset != null && Number(data.offset) !== params.offset) fail('HODL.DANCE returned an unexpected offset.');
}

function cell(value, opts = {}) {
  return { value: value == null ? 'Not reported' : String(value), source: 'external', ...opts };
}

export async function executeHodlDance({ agent, execution }) {
  if (getExternalAdapterKey(agent) !== 'hodl-dance') fail('This is not the verified HODL.DANCE agent.');
  const params = parseInput(execution.input || {});
  const { body, url } = await request(params);
  validate(body, params);
  const tokens = body.data.tokens;
  return {
    headline: `HODL.DANCE returned ${tokens.length} live token listings`,
    summary: 'HODL.DANCE returned a real read-only BSC Mainnet token-list task result through external HTTP. No quote, trade, wallet, signing, payment, or blockchain transaction was used.',
    fields: [
      { key: 'agent', label: 'External agent', value: 'HODL.DANCE', source: 'external' },
      { key: 'tokens', label: 'Tokens returned', value: String(tokens.length), source: 'external' },
      { key: 'total', label: 'Matching tokens', value: String(body.data.total ?? 'Not reported'), source: 'external' },
      { key: 'sort', label: 'Sort', value: params.sort, source: 'input' },
      { key: 'readAt', label: 'External read at', value: new Date().toISOString(), source: 'external' },
    ],
    tables: [{
      title: 'HODL.DANCE token listings',
      note: 'Values are copied from the verified external response. AgentHub does not calculate a price, quote, recommendation, or trade instruction.',
      columns: [
        { key: 'name', label: 'Name' }, { key: 'symbol', label: 'Symbol' }, { key: 'address', label: 'BSC address' },
        { key: 'price', label: 'Current price' }, { key: 'marketCap', label: 'Market cap' }, { key: 'volume', label: '24h volume' }, { key: 'trades', label: 'Trades' },
      ],
      rows: tokens.map((token) => ({
        name: cell(token.name), symbol: cell(token.symbol), address: cell(token.address),
        price: cell(token.current_price), marketCap: cell(token.market_cap), volume: cell(token.volume_24h), trades: cell(token.trade_count),
      })),
    }],
    warnings: [
      'This is external HTTP data from HODL.DANCE, not a BSC RPC read or blockchain execution.',
      'HODL.DANCE write skills require a private key; AgentHub did not use them.',
      'Listings are informational and are not a trading recommendation.',
    ],
    recommendation: 'Read-only token-list result returned. No funds were moved and no transaction was signed or broadcast.',
    hasSimulated: false,
    provenance: { source: 'external-http', transport: 'external-http', endpoint: HODL_DANCE_ENDPOINT, metadataUrl: HODL_DANCE_CARD_URL, chainId: 56, network: 'BSC Mainnet', readAt: new Date().toISOString(), explorer: 'https://bscscan.com' },
    rawResponse: body,
    reads: [{ method: 'HTTP GET', target: url, status: 200 }],
  };
}

export const hodlDanceAdapter = Object.freeze({
  kind: 'execution', adapterKey: 'hodl-dance', endpoint: HODL_DANCE_CARD_URL, chainId: 56,
  canHandle: (agent) => getExternalAdapterKey(agent) === 'hodl-dance', execute: executeHodlDance,
});
