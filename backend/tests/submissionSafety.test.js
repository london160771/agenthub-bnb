import assert from 'node:assert/strict';
import test from 'node:test';

import seedAgents from '../data/seedAgents.js';
import {
  AGENT_CAPABILITIES,
  LOCAL_EXECUTABLE_AGENT_IDS,
  getAgentCapability,
} from '../services/agentCapabilities.js';
import {
  isPaidExecutionEligibleAdapter,
  isPaidExecutionEligibleAgent,
} from '../services/adapters/registry.js';
import { buildUnavailableRebalanceTables } from '../services/agentExecutors.js';
import { responseFor as validateSmeaiHealthResponse } from '../services/adapters/smeaiHealthAdapter.js';
import {
  SentinelsResultValidationError,
  validateSentinelsResult,
} from '../services/adapters/sentinelsAuditAdapter.js';
import {
  actualExecutionCostFor,
  executionHistorySummary,
  redactExecutionForPublic,
} from '../services/executionService.js';
import {
  AGENT_REFRESH_INTERVAL_MS,
  assertProductionDatabaseConfiguration,
  productionDatabaseFailure,
} from '../config/db.js';
import { healthState } from '../routes/index.js';
import { sendHealthResponse } from '../routes/index.js';
import { prepareExecution } from '../services/executionPreparationService.js';
import { actualPaidCostFromVerifiedRequirement } from '../services/payments/paymentService.js';

const SENTINELS_ENDPOINT = 'https://smartsentinels.net/api/audit-mcp';
const PAYMENT_HASH = `0x${'a'.repeat(64)}`;

test('only the exact approved seeded agents remain locally executable', () => {
  const capabilities = seedAgents.map((agent) => ({
    agentId: agent.agentId,
    capability: getAgentCapability({ ...agent, source: 'seeded' }),
  }));
  const executable = capabilities
    .filter(({ capability }) => capability === AGENT_CAPABILITIES.LOCAL_EXECUTABLE)
    .map(({ agentId }) => agentId)
    .sort();
  assert.deepEqual(executable, [...LOCAL_EXECUTABLE_AGENT_IDS].sort());
  assert.equal(executable.length, 4);
  assert.equal(capabilities.filter(({ capability }) => capability === AGENT_CAPABILITIES.INDEXED_WATCH_ONLY).length, 14);
});

test('rebalancing never derives allocation, drift, or actions without common prices', () => {
  const { holdingsTable, assessmentTable } = buildUnavailableRebalanceTables([
    { address: '0x1111111111111111111111111111111111111111', symbol: 'WBNB', decimals: 18, balance: 1n, human: 1, isContract: true, targetWeight: 50 },
    { address: '0x2222222222222222222222222222222222222222', symbol: 'BUSD', decimals: 18, balance: 100n, human: 100, isContract: true, targetWeight: 50 },
    { address: '0x3333333333333333333333333333333333333333', symbol: null, decimals: null, balance: null, human: null, isContract: false, targetWeight: 0 },
  ]);
  assert.equal(holdingsTable.rows[2].asset.source, 'unavailable');
  assert.equal(holdingsTable.rows[2].decimals.source, 'unavailable');
  assert.equal(holdingsTable.rows[2].balance.source, 'unavailable');
  for (const row of assessmentTable.rows) {
    assert.equal(row.currentPct.source, 'unavailable');
    assert.equal(row.drift.source, 'unavailable');
    assert.equal(row.action.source, 'unavailable');
    assert.equal(row.size.source, 'unavailable');
    assert.equal(row.action.value, 'Unavailable');
  }
});

function smeaiResponse(wallet) {
  return {
    result: {
      kind: 'message',
      parts: [{ kind: 'data', data: { response: { wallet, block: 123 } } }],
    },
  };
}

test('SMEAI health response must match the requested wallet case-insensitively', () => {
  const requested = '0x111111111111111111111111111111111111aAaA';
  assert.equal(validateSmeaiHealthResponse(smeaiResponse(requested.toLowerCase()), requested).wallet, requested.toLowerCase());
  assert.throws(
    () => validateSmeaiHealthResponse(smeaiResponse('0x2222222222222222222222222222222222222222'), requested),
    /different wallet/i,
  );
});

test('actual execution cost ignores catalogue prices and uses verified paid metadata', () => {
  assert.deepEqual(actualExecutionCostFor({
    agentId: 'venus-health-guardian',
    source: 'seeded',
    pricing: { amount: 99, currency: 'BNB' },
  }), { cost: 0, currency: 'none' });

  const paid = {
    source: 'indexed',
    erc8004Id: '56:258641',
    endpoint: SENTINELS_ENDPOINT,
    executionProtocol: 'mcp',
    paymentProtocol: 'native-bnb',
    executionVerified: true,
    pricing: { amount: 99, currency: 'BNB' },
    payment: {
      status: 'verified', amount: 0.2, token: 'BNB', chainId: 56,
      recipient: '0x4E21F74143660ee576F4D2aC26BD30729a849f55',
      verification: {
        status: 'verified', source: 'test', method: 'test', endpoint: SENTINELS_ENDPOINT,
        verifiedAt: new Date('2026-09-04T00:00:00.000Z'),
      },
    },
  };
  assert.deepEqual(actualExecutionCostFor(paid), { cost: null, currency: 'none' });
  assert.deepEqual(actualPaidCostFromVerifiedRequirement({
    amount: 0.2,
    token: { symbol: 'BNB' },
    paymentVerified: true,
  }), { cost: 0.2, currency: 'BNB' });
  assert.throws(
    () => actualPaidCostFromVerifiedRequirement({ amount: 0.2, token: { symbol: 'BNB' }, paymentVerified: false }),
    /verified payment requirement/i,
  );
  const sentinels = { agentId: 'sentinels', name: 'Sentinels', ...paid, executionVerified: false };
  assert.equal(isPaidExecutionEligibleAgent(sentinels), false);
  const quickIntel = {
    source: 'indexed',
    erc8004Id: '56:6255',
    endpoint: 'https://x402.quickintel.io/v1/scan/full',
    executionProtocol: 'http',
    paymentProtocol: 'x402',
    payment: {
      type: 'x402', status: 'verified', amount: 0.03, token: 'USDC',
      amountBaseUnits: '30000',
      tokenAddress: '0x1111111111111111111111111111111111111111',
      tokenDecimals: 6, chainId: 8453, settlementNetwork: 'Base Mainnet',
      recipient: '0x2222222222222222222222222222222222222222',
      x402: { version: 2, scheme: 'exact' },
      verification: {
        status: 'verified', source: 'test', method: 'test',
        endpoint: 'https://x402.quickintel.io/v1/scan/full',
        verifiedAt: new Date('2026-09-04T00:00:00.000Z'),
      },
    },
  };
  assert.equal(getAgentCapability(quickIntel), AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID_READY);
  assert.equal(isPaidExecutionEligibleAgent(quickIntel), false);
  assert.equal(isPaidExecutionEligibleAdapter({ kind: 'execution', paid: true, paidExecutionEnabled: true, paymentProtocol: 'erc8183' }), true);
  const preflight = prepareExecution({ agent: sentinels, task: 'Audit.' });
  assert.equal(preflight.mode, 'preflight');
  assert.equal(preflight.state, 'PAYMENT_PREFLIGHT_ONLY');
  assert.equal(preflight.confirmation.enabled, false);
});

function sentinelsBody(value) {
  return { result: { content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }] } };
}

test('Sentinels rejects free text and non-substantive structured responses', () => {
  const rawFreeText = sentinelsBody('Audit accepted; check back later.');
  let rejected;
  try {
    validateSentinelsResult(rawFreeText, { paymentTxHash: PAYMENT_HASH });
    assert.fail('Expected unrecognized Sentinels free text to be rejected.');
  } catch (error) {
    rejected = error;
  }
  assert.ok(rejected instanceof SentinelsResultValidationError);
  assert.equal(rejected.rawResult, rawFreeText);
  assert.throws(
    () => validateSentinelsResult(sentinelsBody({ ok: true, message: 'accepted' }), { paymentTxHash: PAYMENT_HASH }),
    /without substantive audit fields/i,
  );
  assert.throws(
    () => validateSentinelsResult(sentinelsBody({ error: 'provider failed', vulnerabilities: [] }), { paymentTxHash: PAYMENT_HASH }),
    /error instead of an audit result/i,
  );
});

test('Sentinels validates substantive results and rejects mismatched binding evidence', () => {
  const valid = validateSentinelsResult(sentinelsBody({
    ok: true,
    findings: [],
    paymentTxHash: PAYMENT_HASH,
    contractName: 'Vault',
  }), { paymentTxHash: PAYMENT_HASH, contractName: 'vault' });
  assert.deepEqual(valid.structured.findings, []);
  assert.throws(
    () => validateSentinelsResult(sentinelsBody({ findings: [], paymentTxHash: `0x${'b'.repeat(64)}` }), { paymentTxHash: PAYMENT_HASH }),
    /different payment transaction/i,
  );
});

test('public execution projections remove raw task/provider/payment internals', () => {
  const execution = {
    executionId: 'exe_test', agentId: 'agent', userAddress: '0xsecret', task: 'safe summary',
    input: { solidityCode: 'private source' }, rawResult: { private: true },
    normalizedResult: { private: true }, paymentEvidence: { private: true },
    agentEndpoint: 'https://provider.invalid', output: { headline: 'Result', rawResponse: { private: true }, provenance: { chainId: 56 } }, steps: [],
    status: 'completed', cost: 0, currency: 'none', payment: { status: 'none', recipient: '0xrecipient' },
  };
  const detail = redactExecutionForPublic(execution);
  for (const key of ['userAddress', 'input', 'rawResult', 'normalizedResult', 'paymentEvidence', 'agentEndpoint']) {
    assert.equal(Object.hasOwn(detail, key), false);
  }
  assert.equal(Object.hasOwn(detail.payment, 'recipient'), false);
  assert.equal(Object.hasOwn(detail.output, 'rawResponse'), false);
  assert.equal(detail.output.headline, 'Result');
  assert.equal(detail.output.provenance.chainId, 56);
  const history = executionHistorySummary(execution);
  assert.equal(Object.hasOwn(history, 'output'), false);
  assert.equal(Object.hasOwn(history, 'steps'), false);
});

test('production database configuration and health fail closed', () => {
  assert.equal(AGENT_REFRESH_INTERVAL_MS, 12 * 60 * 60 * 1000);
  assert.throws(
    () => assertProductionDatabaseConfiguration({ production: true, mongoUri: '' }),
    /MONGODB_URI is required/i,
  );
  assert.throws(
    () => productionDatabaseFailure(new Error('connection refused'), { production: true }),
    /Production MongoDB connection failed/i,
  );
  assert.equal(productionDatabaseFailure(new Error('connection refused'), { production: false }), false);
  const unavailable = healthState({ dbConnected: false, aiConfigured: false, now: new Date('2026-09-07T00:00:00.000Z') });
  assert.equal(unavailable.healthy, false);
  assert.equal(unavailable.data.status, 'unhealthy');
  assert.equal(unavailable.data.db, 'disconnected');
  assert.equal(healthState({ dbConnected: true }).healthy, true);

  const response = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  sendHealthResponse(response, { dbConnected: false, aiConfigured: false, now: new Date('2026-09-07T00:00:00.000Z') });
  assert.equal(response.statusCode, 503);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, 'SERVICE_UNAVAILABLE');
  assert.equal(response.body.error.details.status, 'unhealthy');
});
