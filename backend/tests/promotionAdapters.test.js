import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AGENT_CAPABILITIES,
  getAgentCapability,
} from '../services/agentCapabilities.js';
import {
  getExecutionAdapterForAgent,
  isExecutableAgent,
  isPaidExecutionEligibleAgent,
} from '../services/adapters/registry.js';
import {
  parseGridBandInput,
  validateGridBandResponse,
} from '../services/adapters/gridBandAdapter.js';
import {
  parseAssayHealthInput,
  validateAssayHealthResponse,
} from '../services/adapters/assayHealthAdapter.js';
import {
  normalizeRangeKeeperResult,
  validateRangeKeeperResponse,
} from '../services/adapters/rangeKeeperAdapter.js';
import {
  BORT_ALLOWED_READ_SKILL,
  parseBortHunterInput,
  validateBortHunterResponse,
} from '../services/adapters/bortHunterAdapter.js';
import { preserveVerifiedPayment } from '../services/indexedAgentIngestion.js';
import { prepareExecution } from '../services/executionPreparationService.js';

function indexedAgent(erc8004Id, endpoint, executionProtocol = 'http') {
  return {
    source: 'indexed',
    erc8004Id,
    endpoint,
    executionProtocol,
    paymentProtocol: 'none',
    payment: { type: 'unknown', status: 'unknown' },
  };
}

function gridBandResponse(overrides = {}) {
  return {
    schemaVersion: '1.0.0',
    agent: { id: 'grid-band', category: 'Grid Trading' },
    status: 'completed',
    chainId: 56,
    request: { poolId: 'WBNB-USDT-500', boundaries: [-100000, 0, 100000] },
    assessment: {
      currentTick: -66261,
      placement: { kind: 'within_declared_grid', bandIndex: 0 },
      observedCrossings: [],
    },
    evidence: {
      block: { number: 120795692, timestamp: '2026-09-09T02:09:02.000Z' },
      contractAddresses: { pool: '0x36696169C63e42cd08ce11f5deeBbCeBae652050' },
      sourceLinks: ['https://bscscan.com/address/0x36696169C63e42cd08ce11f5deeBbCeBae652050'],
      observedAt: '2026-09-09T02:09:03.359Z',
    },
    unknowns: ['Crossings are indeterminate from a single observation.'],
    limitations: ['Point-in-time evidence can become stale.'],
    observedAt: '2026-09-09T02:09:03.359Z',
    receiptId: '7a295656a02338a3d1a300351bd68fe755aebf1c87292747c6b46a41ad2f82b4',
    ...overrides,
  };
}

test('GridBand validates the verified task and rejects malformed responses', () => {
  const input = { poolId: 'WBNB-USDT-500', boundaries: [-100000, 0, 100000] };
  assert.deepEqual(parseGridBandInput(input), input);
  assert.deepEqual(parseGridBandInput({ ...input, boundaries: '-100000,0,100000' }), input);
  assert.deepEqual(validateGridBandResponse(gridBandResponse(), input), gridBandResponse());
  assert.throws(
    () => validateGridBandResponse(gridBandResponse({ request: { ...input, boundaries: [-100000, 100000, 0] } }), input),
    /different grid request/i,
  );
  assert.throws(
    () => validateGridBandResponse(gridBandResponse({ evidence: { ...gridBandResponse().evidence, sourceLinks: [] } }), input),
    /source links/i,
  );
  assert.throws(
    () => parseGridBandInput({ ...input, boundaries: [100000, 0, -100000] }),
    /strictly ascending/i,
  );
});

test('Assay Health enforces account binding and malformed response rejection', () => {
  const requested = '0x111111111111111111111111111111111111aAaA';
  const body = {
    agent: 'Assay Health',
    category: 'health',
    account: requested.toLowerCase(),
    block: '120795693',
    at: '2026-09-09T02:09:04.007Z',
    comptrollerError: 0,
    liquidityUsd: 0,
    shortfallUsd: 0,
    atRisk: false,
    verdict: 'No open borrow, or no collateral posted. Nothing to protect.',
    source: 'Venus Comptroller getAccountLiquidity(), read live',
  };
  assert.equal(parseAssayHealthInput({ account: requested }).account, requested);
  assert.equal(validateAssayHealthResponse(body, requested).account, requested.toLowerCase());
  assert.throws(
    () => validateAssayHealthResponse({ ...body, account: '0x2222222222222222222222222222222222222222' }, requested),
    /different account/i,
  );
  assert.throws(
    () => validateAssayHealthResponse({ ...body, liquidityUsd: 'not-a-number' }, requested),
    /malformed liquidity/i,
  );
});

test('Range Keeper normalizes only the read-only position status', () => {
  const body = {
    token_id: 7238953,
    pair: 'Cake/USDT',
    fee_bps: 25,
    liquidity: '0',
    closed: true,
    tick_lower: 4850,
    tick_upper: 5450,
    tick_current: 8269,
    range_width_ticks: 600,
    in_range: false,
    drift_side: 'above',
    drift_ticks: 2820,
    drift_pct: 24.564,
    position_in_range: 5.6983,
    price_lower: 1.6241356257032216,
    price_upper: 1.7245613905709394,
    price_current: 2.2861259446577544,
    action: 'none',
    reason: 'This position has no liquidity left, so there is nothing to keep in range.',
    proposed: null,
    pool: '0x7f51c8aaa6b0599abd16674e2b17fec7a9f674a1',
    uncollected_fees: { Cake: '0', USDT: '0' },
    execution: 'This agent does not execute.',
  };
  assert.equal(validateRangeKeeperResponse(body, 7238953), body);
  assert.deepEqual(normalizeRangeKeeperResult(body, 7238953), {
    tokenId: 7238953,
    pair: 'Cake/USDT',
    pool: '0x7f51c8aaa6b0599abd16674e2b17fec7a9f674a1',
    status: 'closed',
    liquidity: '0',
    inRange: false,
    driftSide: 'above',
    driftPct: 24.564,
    currentPrice: 2.2861259446577544,
    action: 'none',
    reason: 'This position has no liquidity left, so there is nothing to keep in range.',
  });
  assert.throws(
    () => validateRangeKeeperResponse({ ...body, token_id: 7238954 }, 7238953),
    /different position/i,
  );
});

test('BORT accepts only the explicit read-only check_balance skill', () => {
  assert.deepEqual(parseBortHunterInput({ skill: BORT_ALLOWED_READ_SKILL }), { skill: BORT_ALLOWED_READ_SKILL });
  const response = {
    jsonrpc: '2.0',
    id: 'agenthub-bort-test',
    result: {
      kind: 'message',
      role: 'agent',
      parts: [{ kind: 'text', text: 'BNB: 0.100061 BNB. Source: get_my_holdings.' }],
      messageId: 'a2a-11169-test',
      final: true,
      metadata: { budgetExceeded: true, charged: false },
    },
  };
  assert.deepEqual(validateBortHunterResponse(response), {
    text: 'BNB: 0.100061 BNB. Source: get_my_holdings.',
    messageId: 'a2a-11169-test',
    metadata: { charged: false, budgetExceeded: true },
  });
  assert.throws(
    () => parseBortHunterInput({ skill: 'buy_token' }),
    /only the verified read-only check_balance/i,
  );
  assert.throws(
    () => parseBortHunterInput({ skill: 'check_balance', method: 'message/send' }),
    /only its explicit read-only skill/i,
  );
  assert.throws(
    () => validateBortHunterResponse({ ...response, result: { ...response.result, metadata: { charged: true } } }),
    /charged:false/i,
  );
});

test('the four promoted agents are indexed executable-free through exact adapters', () => {
  const agents = [
    indexedAgent('56:321995', 'https://range-pilot-watch.onrender.com/docs/agents/grid-band.html'),
    indexedAgent('56:331753', 'https://assay-ten-iota.vercel.app/api/agents/health'),
    indexedAgent('56:320966', 'https://trustlist-range-keeper.onrender.com/position'),
    indexedAgent('56:338630', 'https://api.bortagent.xyz/api/a2a/11169/card', 'a2a'),
  ];
  assert.deepEqual(agents.map(getAgentCapability), [
    AGENT_CAPABILITIES.INDEXED_EXECUTABLE_FREE,
    AGENT_CAPABILITIES.INDEXED_EXECUTABLE_FREE,
    AGENT_CAPABILITIES.INDEXED_EXECUTABLE_FREE,
    AGENT_CAPABILITIES.INDEXED_EXECUTABLE_FREE,
  ]);
  assert.deepEqual(agents.map((agent) => getExecutionAdapterForAgent(agent)?.adapterKey), [
    'grid-band',
    'assay-health',
    'range-keeper',
    'bort-hunter',
  ]);
  assert.equal(agents.every(isExecutableAgent), true);
});

test('Venus Liquidation Guard retains exact x402 preflight metadata but no paid executor', () => {
  const incoming = indexedAgent('56:338480', 'https://hallmark-agents.vercel.app/a2a/health', 'a2a');
  const persisted = preserveVerifiedPayment(null, incoming);
  assert.equal(getAgentCapability(persisted), AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID_READY);
  assert.equal(persisted.payment.amount, 0.25);
  assert.equal(persisted.payment.amountBaseUnits, '250000000000000000');
  assert.equal(persisted.payment.token, 'USDT');
  assert.equal(persisted.payment.tokenDecimals, 18);
  assert.equal(persisted.payment.chainId, 56);
  assert.equal(persisted.payment.x402.version, 2);
  assert.equal(persisted.payment.x402.scheme, 'exact');
  assert.equal(persisted.payment.x402.network, 'eip155:56');
  assert.equal(persisted.payment.x402.asset, '0x55d398326f99059fF775485246999027B3197955');
  assert.equal(persisted.payment.x402.payTo, '0x38c6Fc4a5525B37f9545423A7132157f69ce08dA');
  assert.equal(persisted.payment.x402.maxTimeoutSeconds, 120);
  assert.equal(persisted.payment.x402.extra.assetTransferMethod, 'permit2-exact');
  assert.equal(persisted.payment.x402.resource, 'https://hallmark-agents.vercel.app/x402/health/report');
  assert.equal(persisted.payment.verification.verifiedAt.toISOString(), '2026-09-09T02:09:00.000Z');

  const adapter = getExecutionAdapterForAgent(persisted);
  assert.equal(adapter?.adapterKey, 'hallmark-health');
  assert.equal(Object.hasOwn(adapter, 'execute'), false);
  assert.equal(isPaidExecutionEligibleAgent(persisted), false);
  assert.equal(isExecutableAgent(persisted), false);

  const preflight = prepareExecution({
    agent: persisted,
    task: 'Assess this public Venus position.',
    input: { borrower: '0x1111111111111111111111111111111111111111', chainId: 56 },
  });
  assert.equal(preflight.ok, true);
  assert.equal(preflight.mode, 'preflight');
  assert.equal(preflight.state, 'PAYMENT_PREFLIGHT_ONLY');
  assert.equal(preflight.confirmation.enabled, false);
  assert.equal(preflight.paymentRequest.networkId, 56);
  assert.equal(preflight.paymentRequest.amountBaseUnits, '250000000000000000');
  assert.equal(preflight.paymentRequest.payTo, '0x38c6Fc4a5525B37f9545423A7132157f69ce08dA');
});
