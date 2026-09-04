/** Verified free A2A health-factor task adapter (ERC-8004 BSC Mainnet 331625). */
import { TaskInputError } from '../agentExecutors.js';
import { getExternalAdapterKey } from '../agentCapabilities.js';

export const SMEAI_HEALTH_ENDPOINT = 'https://smeai-dev.vercel.app/api/a2a';
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TIMEOUT_MS = 15_000;

function fail(message) { throw new TaskInputError(message); }

function parseInput(input = {}) {
  const wallet = String(input.wallet || '').trim();
  if (!ADDRESS_RE.test(wallet)) fail('Enter a valid public BSC wallet address for the Venus health check.');
  return wallet;
}

async function request(wallet) {
  const id = `agenthub-smeai-health-${Date.now()}`;
  const body = { jsonrpc: '2.0', id, method: 'message/send', params: { message: {
    messageId: id,
    role: 'user',
    parts: [{ kind: 'text', text: JSON.stringify({ skill: 'health_factor', wallet }) }],
  } } };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(SMEAI_HEALTH_ENDPOINT, { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
    const raw = await response.text();
    let json;
    try { json = JSON.parse(raw); } catch { fail('SMEAI Health returned malformed JSON.'); }
    if (!response.ok) fail(`SMEAI Health returned HTTP ${response.status}.`);
    return { json, url: SMEAI_HEALTH_ENDPOINT };
  } catch (err) {
    if (err instanceof TaskInputError) throw err;
    if (err?.name === 'AbortError') fail('SMEAI Health did not respond within 15 seconds.');
    fail(`SMEAI Health could not be reached: ${err.message}`);
  } finally { clearTimeout(timer); }
}

function responseFor(json) {
  const result = json?.result;
  const data = result?.parts?.find((part) => part?.kind === 'data')?.data?.response;
  if (result?.kind !== 'message' || !data || typeof data !== 'object') fail('SMEAI Health returned no task result.');
  if (!ADDRESS_RE.test(String(data.wallet || '')) || !Number.isFinite(Number(data.block))) fail('SMEAI Health returned an unsupported task result.');
  return data;
}

export async function executeSmeaiHealth({ agent, execution }) {
  if (getExternalAdapterKey(agent) !== 'smeai-health') fail('This is not the verified SMEAI Health agent.');
  const wallet = parseInput(execution.input || {});
  const { json, url } = await request(wallet);
  const data = responseFor(json);
  const field = (key, label, value, source = 'external', opts = {}) => ({ key, label, value: String(value), source, ...opts });
  return {
    headline: data.verdict || 'SMEAI Health returned a Venus position result',
    summary: `SMEAI Health returned a real Venus health-factor task result through A2A at BSC Mainnet block #${data.block}. This is external service output, not an AgentHub RPC read or transaction.`,
    fields: [
      field('wallet', 'Wallet checked', data.wallet, 'input'),
      field('weightedCollateralUsd', 'Weighted collateral', `$${data.weightedCollateralUsd}`),
      field('totalBorrowedUsd', 'Total borrowed', `$${data.totalBorrowedUsd}`),
      field('healthFactor', 'Health factor', data.healthFactor == null ? 'Not applicable' : data.healthFactor),
      field('liquidatable', 'Liquidatable', data.liquidatable ? 'Yes' : 'No', 'external', { tone: data.liquidatable ? 'bad' : 'ok' }),
      field('block', 'BSC Mainnet block', `#${Number(data.block).toLocaleString('en-US')}`),
      field('readAt', 'External read at', data.block ? (json.result.parts.find((part) => part?.kind === 'data')?.data?.response?.at || 'Returned with task') : 'Returned with task'),
    ],
    warnings: ['This result came from a free external A2A service. It is not a signed action or a guarantee of future liquidation safety.'],
    recommendation: 'Read-only health-factor result returned. No funds were moved, signed, or broadcast.',
    hasSimulated: false,
    provenance: { source: 'external-http-a2a', transport: 'external-a2a', endpoint: SMEAI_HEALTH_ENDPOINT, agentCardUrl: SMEAI_HEALTH_ENDPOINT, chainId: 56, network: 'BSC Mainnet', blockNumber: Number(data.block), readAt: new Date().toISOString(), explorer: 'https://bscscan.com' },
    rawResponse: json,
    reads: [{ method: 'HTTP POST message/send', target: url, status: 200 }],
  };
}

export const smeaiHealthAdapter = Object.freeze({ kind: 'execution', adapterKey: 'smeai-health', endpoint: SMEAI_HEALTH_ENDPOINT, chainId: 56, canHandle: (agent) => getExternalAdapterKey(agent) === 'smeai-health', execute: executeSmeaiHealth });
