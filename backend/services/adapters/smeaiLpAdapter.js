/** Verified free A2A LP-position task adapter (ERC-8004 BSC Mainnet 331698). */
import { TaskInputError } from '../agentExecutors.js';
import { getExternalAdapterKey } from '../agentCapabilities.js';

export const SMEAI_LP_ENDPOINT = 'https://smeai-dev.vercel.app/api/a2a/lp';
const TIMEOUT_MS = 15_000;
function fail(message) { throw new TaskInputError(message); }

function parseTokenId(input = {}) {
  const tokenId = Number(input.tokenId);
  if (!Number.isInteger(tokenId) || tokenId < 1 || tokenId > 1_000_000_000) fail('Enter a valid PancakeSwap V3 position NFT id.');
  return String(tokenId);
}

async function request(tokenId) {
  const id = `agenthub-smeai-lp-${Date.now()}`;
  const body = { jsonrpc: '2.0', id, method: 'message/send', params: { message: {
    messageId: id,
    role: 'user',
    parts: [{ kind: 'text', text: JSON.stringify({ skill: 'lp_range', tokenId }) }],
  } } };
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(SMEAI_LP_ENDPOINT, { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
    const raw = await response.text(); let json;
    try { json = JSON.parse(raw); } catch { fail('SMEAI LP returned malformed JSON.'); }
    if (!response.ok) fail(`SMEAI LP returned HTTP ${response.status}.`);
    return { json, url: SMEAI_LP_ENDPOINT };
  } catch (err) {
    if (err instanceof TaskInputError) throw err;
    if (err?.name === 'AbortError') fail('SMEAI LP did not respond within 15 seconds.');
    fail(`SMEAI LP could not be reached: ${err.message}`);
  } finally { clearTimeout(timer); }
}

function responseFor(json, tokenId) {
  const result = json?.result;
  const data = result?.parts?.find((part) => part?.kind === 'data')?.data?.response;
  if (result?.kind !== 'message' || !data || typeof data !== 'object' || String(data.tokenId) !== tokenId) fail('SMEAI LP returned no matching task result.');
  if (!Number.isFinite(Number(data.block)) || typeof data.pair !== 'string' || typeof data.inRange !== 'boolean') fail('SMEAI LP returned an unsupported task result.');
  return data;
}

export async function executeSmeaiLp({ agent, execution }) {
  if (getExternalAdapterKey(agent) !== 'smeai-lp') fail('This is not the verified SMEAI LP agent.');
  const tokenId = parseTokenId(execution.input || {}); const { json, url } = await request(tokenId); const data = responseFor(json, tokenId);
  const field = (key, label, value, source = 'external', opts = {}) => ({ key, label, value: String(value), source, ...opts });
  return {
    headline: data.verdict,
    summary: `SMEAI LP returned a real PancakeSwap V3 position-analysis task result through A2A at BSC Mainnet block #${data.block}. This is portfolio analysis only; no liquidity position was changed.`,
    fields: [
      field('tokenId', 'Position NFT', data.tokenId, 'input'),
      field('pair', 'Pair', data.pair),
      field('feeTier', 'Fee tier', `${data.feeTier}%`),
      field('currentTick', 'Current tick', data.currentTick),
      field('inRange', 'In range', data.inRange ? 'Yes' : 'No', 'external', { tone: data.inRange ? 'ok' : 'warn' }),
      field('roomUpPct', 'Room upward', `${Number(data.roomUpPct).toFixed(2)}%`),
      field('roomDownPct', 'Room downward', `${Number(data.roomDownPct).toFixed(2)}%`),
      field('block', 'BSC Mainnet block', `#${Number(data.block).toLocaleString('en-US')}`),
    ],
    warnings: ['This is external portfolio analysis, not a rebalancing instruction or trade execution.'],
    recommendation: 'Read-only LP position result returned. AgentHub does not move liquidity or place orders.',
    hasSimulated: false,
    provenance: { source: 'external-http-a2a', transport: 'external-a2a', endpoint: SMEAI_LP_ENDPOINT, agentCardUrl: SMEAI_LP_ENDPOINT, chainId: 56, network: 'BSC Mainnet', blockNumber: Number(data.block), readAt: new Date().toISOString(), explorer: 'https://bscscan.com' },
    rawResponse: json,
    reads: [{ method: 'HTTP POST message/send', target: url, status: 200 }],
  };
}

export const smeaiLpAdapter = Object.freeze({ kind: 'execution', adapterKey: 'smeai-lp', endpoint: SMEAI_LP_ENDPOINT, chainId: 56, canHandle: (agent) => getExternalAdapterKey(agent) === 'smeai-lp', execute: executeSmeaiLp });
