import assert from 'node:assert/strict';
import test from 'node:test';
import { preparePayment } from '../services/payments/paymentService.js';
import { normalizePaymentRequirement } from '../services/payments/paymentRequirement.js';
import { getPaymentAdapter } from '../services/payments/registry.js';
import { PAYMENT_STATES } from '../services/payments/paymentStates.js';

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
