/** Verified free read-only adapter for Assay Health (ERC-8004 BSC Mainnet 331753). */
import { TaskInputError } from '../agentExecutors.js';
import { getExternalAdapterKey } from '../agentCapabilities.js';

export const ASSAY_HEALTH_ID = '56:331753';
export const ASSAY_HEALTH_ENDPOINT = 'https://assay-ten-iota.vercel.app/api/agents/health';
export const ASSAY_HEALTH_CARD_URL = `${ASSAY_HEALTH_ENDPOINT}/card`;

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TIMEOUT_MS = 15_000;

function fail(message) {
  throw new TaskInputError(message);
}

export function parseAssayHealthInput(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Assay Health input must be an object.');
  if (Object.keys(input).some((key) => !['account', 'notes'].includes(key))) fail('Assay Health accepts only the account field.');
  const account = String(input.account || '').trim();
  if (!ADDRESS_RE.test(account)) fail('Enter a valid public BSC wallet address for Assay Health.');
  return { account };
}

async function request(input) {
  const parsed = parseAssayHealthInput(input);
  const url = new URL(ASSAY_HEALTH_ENDPOINT);
  url.searchParams.set('account', parsed.account);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers: { accept: 'application/json' }, signal: controller.signal });
    const raw = await response.text();
    let body;
    try { body = JSON.parse(raw); } catch { fail('Assay Health returned malformed JSON.'); }
    if (!response.ok) fail(`Assay Health returned HTTP ${response.status}.`);
    return { body, parsed, url: url.toString() };
  } catch (err) {
    if (err instanceof TaskInputError) throw err;
    if (err?.name === 'AbortError') fail('Assay Health did not respond within 15 seconds.');
    fail(`Assay Health could not be reached: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}

export function validateAssayHealthResponse(body, requestedAccount) {
  const parsed = parseAssayHealthInput({ account: requestedAccount });
  if (!body || typeof body !== 'object' || body.agent !== 'Assay Health' || body.category !== 'health') {
    fail('Assay Health returned an unsupported result shape.');
  }
  if (!ADDRESS_RE.test(String(body.account || '')) || String(body.account).toLowerCase() !== parsed.account.toLowerCase()) {
    fail('Assay Health returned a result for a different account.');
  }
  if (!Number.isSafeInteger(Number(body.block)) || Number(body.block) <= 0 || typeof body.at !== 'string' || Number.isNaN(Date.parse(body.at))) {
    fail('Assay Health returned no valid block or timestamp.');
  }
  if (!Number.isFinite(Number(body.comptrollerError)) || !Number.isFinite(Number(body.liquidityUsd)) || !Number.isFinite(Number(body.shortfallUsd))) {
    fail('Assay Health returned malformed liquidity data.');
  }
  if (typeof body.atRisk !== 'boolean' || typeof body.verdict !== 'string' || !body.verdict.trim() || typeof body.source !== 'string' || !body.source.trim()) {
    fail('Assay Health returned incomplete risk evidence.');
  }
  return body;
}

export async function executeAssayHealth({ agent, execution }) {
  if (getExternalAdapterKey(agent) !== 'assay-health' || String(agent?.erc8004Id || '') !== ASSAY_HEALTH_ID) {
    fail('This is not the verified Assay Health agent.');
  }
  const { body, parsed, url } = await request(execution.input || {});
  validateAssayHealthResponse(body, parsed.account);
  const blockNumber = Number(body.block);
  return {
    headline: body.verdict,
    summary: `Assay Health returned a real account-bound Venus liquidity and shortfall read at BSC Mainnet block #${blockNumber.toLocaleString('en-US')}. No wallet, payment, signing, or blockchain state change was used.`,
    fields: [
      { key: 'agent', label: 'External agent', value: 'Assay Health', source: 'external' },
      { key: 'account', label: 'Account', value: body.account, source: 'input' },
      { key: 'liquidityUsd', label: 'Liquidity (USD)', value: String(body.liquidityUsd), source: 'external' },
      { key: 'shortfallUsd', label: 'Shortfall (USD)', value: String(body.shortfallUsd), source: 'external' },
      { key: 'atRisk', label: 'At risk', value: body.atRisk ? 'Yes' : 'No', source: 'external', tone: body.atRisk ? 'bad' : 'ok' },
      { key: 'comptrollerError', label: 'Comptroller error', value: String(body.comptrollerError), source: 'external' },
      { key: 'block', label: 'BSC Mainnet block', value: `#${blockNumber.toLocaleString('en-US')}`, source: 'external' },
      { key: 'readAt', label: 'External read at', value: body.at, source: 'external' },
      { key: 'source', label: 'Provider source', value: body.source, source: 'external' },
    ],
    warnings: ['This is external HTTP read-only output, not an AgentHub RPC read or a liquidation recommendation.'],
    recommendation: 'Read-only Venus liquidity result returned. No funds were moved, signed, or broadcast.',
    hasSimulated: false,
    provenance: {
      source: 'external-http',
      transport: 'external-http',
      endpoint: ASSAY_HEALTH_ENDPOINT,
      metadataUrl: ASSAY_HEALTH_CARD_URL,
      chainId: 56,
      network: 'BSC Mainnet',
      blockNumber,
      readAt: body.at,
      explorer: 'https://bscscan.com',
    },
    rawResponse: body,
    reads: [{ method: 'HTTP GET', target: url, status: 200 }],
  };
}

export const assayHealthAdapter = Object.freeze({
  kind: 'execution',
  adapterKey: 'assay-health',
  endpoint: ASSAY_HEALTH_ENDPOINT,
  chainId: 56,
  canHandle: (agent) => getExternalAdapterKey(agent) === 'assay-health' && String(agent?.erc8004Id || '') === ASSAY_HEALTH_ID,
  execute: executeAssayHealth,
});
