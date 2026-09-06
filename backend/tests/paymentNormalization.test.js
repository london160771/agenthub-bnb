import assert from 'node:assert/strict';
import test from 'node:test';
import { preparePayment } from '../services/payments/paymentService.js';
import { normalizePaymentRequirement } from '../services/payments/paymentRequirement.js';
import { getPaymentAdapter } from '../services/payments/registry.js';
import { PAYMENT_STATES } from '../services/payments/paymentStates.js';
import { buildNativeBnbPaymentRequest } from '../services/payments/nativeBnbPaymentExecutor.js';
import { sentinelsAuditAdapter } from '../services/adapters/sentinelsAuditAdapter.js';
import {
  AGENT_CAPABILITIES,
  getAgentCapability,
  isPaymentReadyAgent,
  isExternallyExecutableAgent,
} from '../services/agentCapabilities.js';
import { preserveVerifiedPayment } from '../services/indexedAgentIngestion.js';
import { getVerifiedPaymentMetadata } from '../services/verifiedPaymentMetadata.js';
import { normalizeAgentCapability } from '../services/agentCapabilityModel.js';
import { prepareExecution } from '../services/executionPreparationService.js';
import { normalizeX402Challenge } from '../services/payments/x402Challenge.js';

const completeX402Agent = {
  agentId: '8004-56-paid-test',
  name: 'Paid test agent',
  source: 'indexed',
  erc8004Id: '56:123',
  paymentProtocol: 'x402',
  payment: {
    type: 'x402',
    status: 'advertised',
    chainId: 56,
    amount: 0.03,
    token: 'USDC',
    recipient: '0x1111111111111111111111111111111111111111',
    requiresWallet: true,
    requiresMainnetTx: true,
    effect: 'Authorize one analysis request.',
  },
};

test('free agents normalize to FREE without a payment requirement', () => {
  const result = normalizePaymentRequirement({ paymentProtocol: 'none', payment: { type: 'free' } });
  assert.equal(result.ok, true);
  assert.equal(result.state, PAYMENT_STATES.FREE);
  assert.equal(result.requirement, null);
});

test('paid metadata fails closed when a required fact is missing', () => {
  const result = normalizePaymentRequirement({
    source: 'indexed',
    erc8004Id: '56:123',
    paymentProtocol: 'x402',
    payment: { type: 'x402', status: 'advertised', amount: 0.03, token: 'USDC' },
  });
  assert.equal(result.ok, false);
  assert.equal(result.state, PAYMENT_STATES.FAILED);
  assert.deepEqual(result.error.missing, [
    'payment.chainId',
    'payment.recipient or payment.contract',
  ]);
});

test('complete paid requirements prepare for confirmation but never submit', () => {
  const result = preparePayment({ agent: completeX402Agent, task: 'Analyze this contract.' });
  assert.equal(result.ok, true);
  assert.equal(result.state, PAYMENT_STATES.AWAITING_USER_CONFIRMATION);
  assert.equal(result.requirement.network.chainId, 56);
  assert.equal(result.requirement.amount, 0.03);
  assert.equal(result.requirement.token.symbol, 'USDC');
  assert.equal(result.confirmation.enabled, false);
  assert.equal(result.quote.verified, false);
  assert.deepEqual(result.transitions, [
    PAYMENT_STATES.PAYMENT_REQUIRED,
    PAYMENT_STATES.PAYMENT_PREPARED,
    PAYMENT_STATES.AWAITING_USER_CONFIRMATION,
  ]);
});

test('x402 v2 challenge normalization preserves settlement-chain separation', () => {
  const result = normalizeX402Challenge({
    x402Version: 2,
    accepts: [{
      scheme: 'exact',
      network: 'eip155:8453',
      amount: '30000',
      payTo: '0x3dBDfB6E5dCFa8f51AA07bC3aDf18a62b186C362',
      maxTimeoutSeconds: 3600,
      asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      extra: { name: 'USD Coin', version: '2' },
    }],
    extensions: { bazaar: { info: { input: { type: 'http', method: 'POST', bodyType: 'json' } } } },
  }, { preferredNetwork: 'eip155:8453', tokenDecimalsByNetwork: { 'eip155:8453': 6 } });
  assert.equal(result.selected.chainId, 8453);
  assert.equal(result.selected.amountBaseUnits, '30000');
  assert.equal(result.selected.amount, 0.03);
  assert.equal(result.selected.tokenDecimals, 6);
  assert.equal(result.selected.payTo, '0x3dBDfB6E5dCFa8f51AA07bC3aDf18a62b186C362');
});

test('verified Quick Intel facts become paid-ready only through persisted metadata', () => {
  const incoming = {
    source: 'indexed',
    erc8004Id: '56:6255',
    endpoint: 'https://x402.quickintel.io/v1/scan/full',
    executionProtocol: 'http',
    payment: { type: 'unknown', status: 'unknown' },
  };
  const persisted = preserveVerifiedPayment(null, incoming);
  assert.equal(persisted.paymentProtocol, 'x402');
  assert.equal(persisted.payment.status, 'verified');
  assert.equal(persisted.payment.amountBaseUnits, '30000');
  assert.equal(persisted.payment.chainId, 8453);
  assert.equal(persisted.payment.tokenDecimals, 6);
  assert.equal(getAgentCapability(persisted), AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID_READY);
  const plan = preparePayment({ agent: persisted, task: 'Scan a token.' });
  assert.equal(plan.paymentRequest.kind, 'x402-challenge');
  assert.equal(plan.paymentRequest.networkId, 8453);
  assert.equal(plan.paymentRequest.amountBaseUnits, '30000');
  assert.equal(plan.paymentRequest.maxTimeoutSeconds, 3600);
  assert.equal(plan.paymentRequest.resource, 'https://x402.quickintel.io/v1/scan/full');
  assert.equal(plan.paymentRequest.supportedNetworks.includes('eip155:56'), false);
  assert.equal(plan.paymentRequest.supportedNetworks.includes('eip155:8453'), true);
  assert.equal(plan.confirmation.enabled, false);
});

test('all Phase 11.3 protocol adapters expose preparation only', () => {
  for (const protocol of ['x402', 'erc8183', 'native-bnb']) {
    const adapter = getPaymentAdapter(protocol);
    assert.equal(typeof adapter.prepare, 'function');
    assert.equal(Object.hasOwn(adapter, 'submit'), false);
  }
});

test('network mismatch fails closed for indexed Mainnet identity', () => {
  const result = normalizePaymentRequirement({
    ...completeX402Agent,
    payment: { ...completeX402Agent.payment, chainId: 97 },
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'PAYMENT_NETWORK_MISMATCH');
});

test('complete verified payment metadata is paid-ready but not executable', () => {
  const agent = {
    source: 'indexed',
    erc8004Id: '56:258641',
    endpoint: 'https://smartsentinels.net/api/audit-mcp',
    executionProtocol: 'mcp',
    paymentProtocol: 'native-bnb',
    payment: {
      type: 'native-bnb',
      status: 'verified',
      amount: 0.2,
      token: 'BNB',
      chainId: 56,
      recipient: '0x4E21F74143660ee576F4D2aC26BD30729a849f55',
      verification: {
        status: 'verified',
        source: 'test verification source',
        method: 'test contract review',
        endpoint: 'https://smartsentinels.net/api/audit-mcp',
        verifiedAt: new Date('2026-09-04T00:00:00.000Z'),
      },
    },
  };

  assert.equal(getAgentCapability(agent), AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID_READY);
  assert.equal(isPaymentReadyAgent(agent), true);
  assert.equal(isExternallyExecutableAgent(agent), false);

  const plan = preparePayment({ agent, task: 'Audit Solidity.' });
  assert.equal(plan.paymentRequest.chainId, 56);
  assert.equal(plan.paymentRequest.to, agent.payment.recipient);
  assert.equal(plan.paymentRequest.valueWei, '200000000000000000');
  assert.equal(plan.paymentRequest.value, '0x2c68af0bb140000');
});

test('verified Sentinels facts restore through the indexed persistence merge', () => {
  const incoming = {
    source: 'indexed',
    erc8004Id: '56:258641',
    endpoint: 'https://smartsentinels.net/api/audit-mcp',
    executionProtocol: 'mcp',
    paymentProtocol: null,
    payment: { type: 'unknown', status: 'unknown' },
  };
  const verified = getVerifiedPaymentMetadata(incoming);
  assert.equal(verified.payment.amount, 0.2);
  const persisted = preserveVerifiedPayment(null, incoming);
  assert.equal(persisted.paymentProtocol, 'native-bnb');
  assert.equal(persisted.payment.status, 'verified');
  assert.equal(persisted.payment.requiresTokenApproval, false);
  assert.equal(persisted.payment.verification.status, 'verified');
  assert.equal(getAgentCapability(persisted), AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID_READY);
});

test('Sentinels cannot become paid-ready from identity and endpoint alone', () => {
  const incomplete = {
    source: 'indexed',
    erc8004Id: '56:258641',
    endpoint: 'https://smartsentinels.net/api/audit-mcp',
    executionProtocol: 'mcp',
    capability: AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID_READY,
    paymentProtocol: null,
    payment: { type: 'unknown', status: 'unknown' },
  };

  assert.equal(getAgentCapability(incomplete), AGENT_CAPABILITIES.INDEXED_WATCH_ONLY);
  assert.equal(isPaymentReadyAgent(incomplete), false);
  assert.equal(isExternallyExecutableAgent(incomplete), false);
});

test('paid capability is promoted only after a validated task result', async () => {
  const agent = {
    source: 'indexed',
    erc8004Id: '56:258641',
    endpoint: 'https://smartsentinels.net/api/audit-mcp',
    executionProtocol: 'mcp',
    paymentProtocol: 'native-bnb',
    payment: {
      status: 'verified',
      amount: 0.2,
      token: 'BNB',
      tokenDecimals: 18,
      chainId: 56,
      recipient: '0x4E21F74143660ee576F4D2aC26BD30729a849f55',
      verification: {
        status: 'verified',
        source: 'test verification source',
        method: 'test contract review',
        endpoint: 'https://smartsentinels.net/api/audit-mcp',
        verifiedAt: new Date('2026-09-04T00:00:00.000Z'),
      },
    },
  };
  assert.equal(getAgentCapability({ ...agent, executionVerified: true }), AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID);
  await assert.rejects(
    () => sentinelsAuditAdapter.execute({ agent, execution: { input: { solidityCode: 'contract Example {}' }, payment: { status: 'awaiting_confirmation' }, transactionHash: '' } }),
    /payment is not confirmed/i,
  );
});

test('verified payment facts survive refresh only for the same endpoint', () => {
  const existing = {
    source: 'indexed',
    erc8004Id: '56:258641',
    endpoint: 'https://smartsentinels.net/api/audit-mcp',
    paymentProtocol: 'native-bnb',
    executionProtocol: 'mcp',
    lastVerifiedAt: new Date('2026-09-04T00:00:00.000Z'),
    payment: {
      status: 'verified',
      type: 'native-bnb',
      amount: 0.2,
      token: 'BNB',
      chainId: 56,
      recipient: '0x4E21F74143660ee576F4D2aC26BD30729a849f55',
    },
  };
  const incoming = {
    source: 'indexed',
    erc8004Id: '56:258641',
    endpoint: existing.endpoint,
    paymentProtocol: null,
    executionProtocol: 'mcp',
    payment: { status: 'unknown', type: 'unknown' },
  };

  const preserved = preserveVerifiedPayment(existing, incoming);
  assert.equal(preserved.payment.amount, 0.2);
  assert.equal(preserved.paymentProtocol, 'native-bnb');
  assert.equal(preserved.capability, AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID_READY);

  const changedEndpoint = preserveVerifiedPayment(existing, { ...incoming, endpoint: 'https://new.example/mcp' });
  assert.equal(changedEndpoint.payment.status, 'unknown');
});

test('verified paid execution survives refresh for the same endpoint', () => {
  const existing = {
    source: 'indexed',
    erc8004Id: '56:258641',
    endpoint: 'https://smartsentinels.net/api/audit-mcp',
    executionProtocol: 'mcp',
    executionVerified: true,
    paymentProtocol: 'native-bnb',
    payment: { status: 'verified', amount: 0.2, token: 'BNB', chainId: 56, recipient: '0x4E21F74143660ee576F4D2aC26BD30729a849f55' },
  };
  const incoming = { ...existing, executionVerified: false, payment: { status: 'unknown' } };
  const preserved = preserveVerifiedPayment(existing, incoming);
  assert.equal(preserved.executionVerified, true);
  assert.equal(preserved.capability, AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID);
});

test('missing refresh endpoint cannot erase a saved verified payment contract', () => {
  const existing = {
    source: 'indexed',
    erc8004Id: '56:258641',
    endpoint: 'https://smartsentinels.net/api/audit-mcp',
    executionProtocol: 'mcp',
    paymentProtocol: 'native-bnb',
    payment: { status: 'verified', amount: 0.2, token: 'BNB', chainId: 56, recipient: '0x4E21F74143660ee576F4D2aC26BD30729a849f55' },
  };
  const refreshed = preserveVerifiedPayment(existing, {
    source: 'indexed',
    erc8004Id: '56:258641',
    endpoint: '',
    executionProtocol: null,
    paymentProtocol: null,
    payment: { status: 'unknown', type: 'unknown' },
  });
  assert.equal(refreshed.endpoint, existing.endpoint);
  assert.equal(refreshed.executionProtocol, existing.executionProtocol);
  assert.equal(refreshed.paymentProtocol, existing.paymentProtocol);
  assert.equal(refreshed.payment.status, 'verified');
});

test('generic capability model normalizes verified free execution without payment facts', () => {
  const details = normalizeAgentCapability({
    source: 'indexed',
    erc8004Id: '56:331752',
    endpoint: 'https://assay-ten-iota.vercel.app/api/agents/yield',
    executionProtocol: 'http',
    payment: { type: 'unknown', status: 'unknown' },
  });
  assert.equal(details.capability, AGENT_CAPABILITIES.INDEXED_EXECUTABLE_FREE);
  assert.equal(details.execution.verified, true);
  assert.equal(details.execution.protocol, 'http');
  assert.equal(details.payment.protocol, 'none');
  assert.deepEqual(details.blockers, []);
});

test('generic preparation fails closed for an indexed record without task/result evidence', () => {
  const unverified = {
    source: 'indexed',
    erc8004Id: '56:999999',
    endpoint: 'https://example.invalid/task',
    executionProtocol: 'http',
    paymentProtocol: 'custom',
    payment: { type: 'other', status: 'advertised', amount: 0.05, token: 'USDC', chainId: 56, contract: '0x1111111111111111111111111111111111111111' },
  };
  const details = normalizeAgentCapability(unverified);
  assert.equal(details.capability, AGENT_CAPABILITIES.INDEXED_WATCH_ONLY);
  assert.equal(details.execution.verified, false);
  assert.ok(details.blockers.some((blocker) => /verified adapter/i.test(blocker)));
  const prepared = prepareExecution({
    agent: { agentId: '8004-56-999999', name: 'Unverified', ...unverified },
    task: 'test',
  });
  assert.equal(prepared.ok, false);
  assert.equal(prepared.error.code, 'EXECUTION_ADAPTER_UNAVAILABLE');
});
