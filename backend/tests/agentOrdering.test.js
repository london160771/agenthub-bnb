import assert from 'node:assert/strict';
import test from 'node:test';
import { AGENT_CAPABILITIES } from '../services/agentCapabilities.js';
import {
  DEFAULT_AVAILABILITY_PRIORITY,
  compareByDefaultAvailability,
} from '../services/agentService.js';

const sentinelsPayment = {
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
};

const indexedFree = (agentId, erc8004Id, endpoint, trustScore = 50) => ({
  agentId,
  source: 'indexed',
  erc8004Id,
  endpoint,
  trustScore,
});

const paidReady = (agentId, executionVerified = false) => ({
  agentId,
  source: 'indexed',
  erc8004Id: '56:258641',
  endpoint: 'https://smartsentinels.net/api/audit-mcp',
  executionProtocol: 'mcp',
  paymentProtocol: 'native-bnb',
  payment: sentinelsPayment,
  executionVerified,
});

test('default marketplace priority keeps executable external agents before built-ins and catalog records', () => {
  const agents = [
    { agentId: 'watch', source: 'indexed', erc8004Id: '56:999999' },
    { agentId: 'built-in', source: 'seeded' },
    paidReady('paid-ready'),
    { agentId: 'catalog', source: 'indexed', erc8004Id: '56:49467', endpoint: 'https://agent.brainonbnb.com/a2a' },
    indexedFree('free', '56:331752', 'https://assay-ten-iota.vercel.app/api/agents/yield'),
    paidReady('paid', true),
  ];

  const sorted = agents.sort(compareByDefaultAvailability);
  assert.deepEqual(sorted.map(({ agentId }) => agentId), [
    'paid',
    'paid-ready',
    'free',
    'built-in',
    'catalog',
    'watch',
  ]);
  assert.deepEqual(
    Object.values(DEFAULT_AVAILABILITY_PRIORITY),
    [0, 1, 2, 3, 4, 5],
  );
});

test('default marketplace ordering is deterministic within a capability group', () => {
  const agents = [
    indexedFree('free-zeta', '56:331752', 'https://assay-ten-iota.vercel.app/api/agents/yield', 80),
    indexedFree('free-alpha', '56:331751', 'https://assay-ten-iota.vercel.app/api/agents/grid', 80),
    indexedFree('free-beta', '56:331752', 'https://assay-ten-iota.vercel.app/api/agents/yield', 90),
  ];

  agents.sort(compareByDefaultAvailability);
  assert.deepEqual(agents.map(({ agentId }) => agentId), ['free-beta', 'free-alpha', 'free-zeta']);
});
