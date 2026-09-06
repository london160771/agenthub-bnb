/**
 * Verified free read-only adapters for the two published Range Pilot agents.
 *
 * The provider publishes separate task paths and schemas for Venus borrow
 * health and Venus yield observation. Both return a completed, block-pinned
 * BSC Mainnet assessment receipt and explicitly provide no wallet, payment,
 * signing, transaction, or calldata interface.
 */
import { TaskInputError } from '../agentExecutors.js';
import { getExternalAdapterKey } from '../agentCapabilities.js';

export const RANGE_PILOT_HEALTH_ID = '56:322090';
export const RANGE_PILOT_YIELD_ID = '56:322046';
export const RANGE_PILOT_HEALTH_DOCS = 'https://range-pilot-watch.onrender.com/docs/agents/venus-borrow-buffer.html';
export const RANGE_PILOT_YIELD_DOCS = 'https://range-pilot-watch.onrender.com/docs/agents/venus-yield.html';
export const RANGE_PILOT_HEALTH_ENDPOINT = 'https://range-pilot-watch.onrender.com/agents/venus-borrow-buffer/assess';
export const RANGE_PILOT_YIELD_ENDPOINT = 'https://range-pilot-watch.onrender.com/agents/venus-yield/assess';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const HEALTH_ID = RANGE_PILOT_HEALTH_ID;
const YIELD_ID = RANGE_PILOT_YIELD_ID;
const ALLOWED_MARKETS = new Set(['core-vUSDC', 'core-vUSDT']);
const TIMEOUT_MS = 30_000;

function fail(message) {
  throw new TaskInputError(message);
}

function getIdentity(agent) {
  const identity = String(agent?.erc8004Id || '');
  if (getExternalAdapterKey(agent) !== 'range-pilot' || ![HEALTH_ID, YIELD_ID].includes(identity)) {
    fail('This is not a verified Range Pilot agent.');
  }
  return identity;
}

function parseHealthInput(input = {}) {
  const accountAddress = String(input.accountAddress || '').trim();
  if (!ADDRESS_RE.test(accountAddress)) fail('Enter a valid public BSC wallet address for the Venus assessment.');
  const warningRatio = input.warningRatio == null || String(input.warningRatio).trim() === ''
    ? '1.25'
    : String(input.warningRatio).trim();
  const numericWarningRatio = Number(warningRatio);
  if (!Number.isFinite(numericWarningRatio) || numericWarningRatio < 1 || numericWarningRatio > 3) {
    fail('The warning ratio must be between 1.00 and 3.00.');
  }
  return { accountAddress, warningRatio };
}

function parseYieldInput(input = {}) {
  const assetId = String(input.assetId || 'usd-stablecoins').trim();
  if (assetId !== 'usd-stablecoins') fail('Range Pilot Yield only supports the published usd-stablecoins assessment.');
  const rawMarkets = input.markets == null || String(input.markets).trim() === ''
    ? ['core-vUSDC', 'core-vUSDT']
    : String(input.markets).split(',').map((value) => value.trim()).filter(Boolean);
  if (rawMarkets.length === 0 || rawMarkets.length > 2 || rawMarkets.some((market) => !ALLOWED_MARKETS.has(market))) {
    fail('Choose only the published core-vUSDC and core-vUSDT markets.');
  }
  return { assetId, markets: [...new Set(rawMarkets)] };
}

async function request(endpoint, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const raw = await response.text();
    let json;
    try { json = JSON.parse(raw); } catch { fail('Range Pilot returned malformed JSON.'); }
    if (!response.ok) fail(`Range Pilot returned HTTP ${response.status}.`);
    return { json, endpoint, status: response.status };
  } catch (err) {
    if (err instanceof TaskInputError) throw err;
    if (err?.name === 'AbortError') fail('Range Pilot did not respond within 30 seconds.');
    fail(`Range Pilot could not be reached: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}

function commonValidate(body, expectedChainId = 56) {
  if (!body || body.status !== 'completed' || Number(body.chainId) !== expectedChainId) {
    fail('Range Pilot returned no completed BSC Mainnet assessment.');
  }
  if (!body.assessment || typeof body.assessment !== 'object') fail('Range Pilot returned no assessment payload.');
  if (!Number.isFinite(Number(body.evidence?.block?.number))) fail('Range Pilot returned no valid block evidence.');
  if (!body.receiptId || typeof body.receiptId !== 'string') fail('Range Pilot returned no assessment receipt.');
  if (Number.isNaN(Date.parse(body.observedAt || body.evidence?.observedAt))) fail('Range Pilot returned no valid observation timestamp.');
}

function cell(value, source = 'external', opts = {}) {
  return { value: value == null ? 'Not reported' : String(value), source, ...opts };
}

function evidenceFields(body) {
  return [
    { key: 'chain', label: 'Assessment chain', value: 'BSC Mainnet (56)', source: 'external' },
    { key: 'block', label: 'Pinned block', value: `#${Number(body.evidence.block.number).toLocaleString('en-US')}`, source: 'external' },
    { key: 'observedAt', label: 'Observed at', value: body.observedAt || body.evidence.observedAt, source: 'external' },
    { key: 'receiptId', label: 'Assessment receipt', value: body.receiptId, source: 'external' },
  ];
}

function warningFields(body) {
  const values = [...(Array.isArray(body.unknowns) ? body.unknowns : []), ...(Array.isArray(body.limitations) ? body.limitations : [])];
  return values.slice(0, 4).map((value) => `Provider limitation: ${value}`);
}

function healthResult(body, input) {
  commonValidate(body);
  if (body.agent?.id !== 'venus-borrow-buffer' || body.request?.accountAddress?.toLowerCase() !== input.accountAddress.toLowerCase()) {
    fail('Range Pilot returned a result for a different health assessment.');
  }
  const assessment = body.assessment;
  return {
    headline: `Range Pilot health assessment: ${assessment.assessmentState || 'completed'}`,
    summary: 'Range Pilot returned a real, read-only Venus BSC Mainnet health assessment with a block-pinned evidence receipt. No AgentHub RPC call, wallet, payment, signing, or transaction was used.',
    fields: [
      { key: 'agent', label: 'External agent', value: 'Range Pilot · Venus Borrow Buffer', source: 'external' },
      { key: 'account', label: 'Account reference', value: input.accountAddress, source: 'input' },
      { key: 'assessmentState', label: 'Assessment state', value: assessment.assessmentState || 'Not reported', source: 'external' },
      { key: 'collateralRatio', label: 'Collateral ratio', value: assessment.collateralRatio ?? 'Not reported', source: 'external' },
      { key: 'borrowValue', label: 'Borrow value', value: assessment.borrowValue?.decimal ?? 'Not reported', source: 'external' },
      { key: 'enteredMarkets', label: 'Entered markets', value: Array.isArray(assessment.enteredMarkets) ? assessment.enteredMarkets.join(', ') || 'None reported' : 'Not reported', source: 'external' },
      ...evidenceFields(body),
    ],
    warnings: [
      'This is external HTTP read-only output, not a BSC RPC read or blockchain execution.',
      ...warningFields(body),
    ],
    recommendation: 'Read-only health result returned. It is informational and does not authorize any repayment, deposit, withdrawal, or liquidation action.',
    hasSimulated: false,
    provenance: {
      source: 'external-http',
      transport: 'external-http',
      endpoint: RANGE_PILOT_HEALTH_ENDPOINT,
      metadataUrl: RANGE_PILOT_HEALTH_DOCS,
      chainId: 56,
      network: 'BSC Mainnet',
      blockNumber: Number(body.evidence.block.number),
      readAt: body.observedAt || body.evidence.observedAt,
      receiptId: body.receiptId,
      explorer: 'https://bscscan.com',
    },
    rawResponse: body,
    reads: [{ method: 'HTTP POST read-only assessment', target: RANGE_PILOT_HEALTH_ENDPOINT, status: 200 }],
  };
}

function yieldResult(body, input) {
  commonValidate(body);
  if (body.agent?.id !== 'venus-yield' || body.request?.assetId !== input.assetId || !Array.isArray(body.assessment?.markets)) {
    fail('Range Pilot returned a result for a different yield assessment.');
  }
  const markets = body.assessment.markets;
  if (markets.length === 0 || markets.some((market) => !ALLOWED_MARKETS.has(market.marketId) || !market.marketAddress || !market.underlying?.address)) {
    fail('Range Pilot returned malformed market evidence.');
  }
  const returnedIds = markets.map((market) => market.marketId).sort().join(',');
  const requestedIds = [...input.markets].sort().join(',');
  if (returnedIds !== requestedIds) fail('Range Pilot returned a different market set than requested.');
  return {
    headline: `Range Pilot yield assessment: ${markets.length} Venus markets observed`,
    summary: 'Range Pilot returned a real, read-only Venus BSC Mainnet yield assessment with block-pinned market evidence. No AgentHub RPC call, wallet, payment, signing, or transaction was used.',
    fields: [
      { key: 'agent', label: 'External agent', value: 'Range Pilot · Venus Yield Lens', source: 'external' },
      { key: 'assetId', label: 'Assessment set', value: input.assetId, source: 'input' },
      { key: 'markets', label: 'Markets returned', value: String(markets.length), source: 'external' },
      { key: 'highestRate', label: 'Highest displayed rate', value: body.assessment.highestObservedDisplayedSupplyRateAmongQueriedAllowlistedMarkets?.displayedSupplyRatePercent == null ? 'Not reported' : `${body.assessment.highestObservedDisplayedSupplyRateAmongQueriedAllowlistedMarkets.displayedSupplyRatePercent}%`, source: 'external' },
      ...evidenceFields(body),
    ],
    tables: [{
      title: 'Range Pilot Venus market observations',
      note: 'Values are copied from the external block-pinned assessment. The comparison excludes incentives and is not a promise of future returns.',
      columns: [
        { key: 'market', label: 'Market' },
        { key: 'address', label: 'vToken address' },
        { key: 'underlying', label: 'Underlying' },
        { key: 'supplyRate', label: 'Displayed supply rate' },
      ],
      rows: markets.map((market) => ({
        market: cell(market.marketSymbol || market.marketId),
        address: cell(market.marketAddress),
        underlying: cell(`${market.underlying.symbol || 'Unknown'} (${market.underlying.address})`),
        supplyRate: cell(market.displayedSupplyRatePercent == null ? null : `${market.displayedSupplyRatePercent}%`),
      })),
    }],
    warnings: [
      'This is external HTTP read-only output, not a BSC RPC read or blockchain execution.',
      ...warningFields(body),
    ],
    recommendation: 'Read-only yield result returned. Rates are point-in-time observations, not a deposit recommendation or guaranteed return.',
    hasSimulated: false,
    provenance: {
      source: 'external-http',
      transport: 'external-http',
      endpoint: RANGE_PILOT_YIELD_ENDPOINT,
      metadataUrl: RANGE_PILOT_YIELD_DOCS,
      chainId: 56,
      network: 'BSC Mainnet',
      blockNumber: Number(body.evidence.block.number),
      readAt: body.observedAt || body.evidence.observedAt,
      receiptId: body.receiptId,
      explorer: 'https://bscscan.com',
    },
    rawResponse: body,
    reads: [{ method: 'HTTP POST read-only assessment', target: RANGE_PILOT_YIELD_ENDPOINT, status: 200 }],
  };
}

export async function executeRangePilot({ agent, execution }) {
  const identity = getIdentity(agent);
  if (identity === HEALTH_ID) {
    const input = parseHealthInput(execution.input || {});
    const response = await request(RANGE_PILOT_HEALTH_ENDPOINT, input);
    return healthResult(response.json, input);
  }
  const input = parseYieldInput(execution.input || {});
  const response = await request(RANGE_PILOT_YIELD_ENDPOINT, input);
  return yieldResult(response.json, input);
}

export const rangePilotAdapter = Object.freeze({
  kind: 'execution',
  adapterKey: 'range-pilot',
  endpoint: RANGE_PILOT_HEALTH_ENDPOINT,
  chainId: 56,
  canHandle: (agent) => getExternalAdapterKey(agent) === 'range-pilot' && [HEALTH_ID, YIELD_ID].includes(String(agent?.erc8004Id || '')),
  execute: executeRangePilot,
});
