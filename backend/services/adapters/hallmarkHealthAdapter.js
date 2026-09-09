/**
 * Verified Hallmark x402 preflight definition (ERC-8004 BSC Mainnet 338480).
 *
 * This is intentionally a non-executing adapter. Its presence lets the generic
 * capability/preparation layer expose the exact payment challenge while the
 * paid execution registry continues to fail closed until a payment proof and
 * result validator are implemented for this provider.
 */
import { getExternalAdapterKey } from '../agentCapabilities.js';

export const HALLMARK_HEALTH_ID = '56:338480';
export const HALLMARK_HEALTH_A2A_ENDPOINT = 'https://hallmark-agents.vercel.app/a2a/health';
export const HALLMARK_HEALTH_ENDPOINT = 'https://hallmark-agents.vercel.app/x402/health/report';
export const HALLMARK_HEALTH_CARD_URL = 'https://hallmark-agents.vercel.app/health/.well-known/agent-card.json';

export const hallmarkHealthAdapter = Object.freeze({
  kind: 'execution',
  adapterKey: 'hallmark-health',
  endpoint: HALLMARK_HEALTH_A2A_ENDPOINT,
  taskEndpoint: HALLMARK_HEALTH_ENDPOINT,
  chainId: 56,
  paymentProtocol: 'x402',
  paid: false,
  paidExecutionEnabled: false,
  canHandle: (agent) => getExternalAdapterKey(agent) === 'hallmark-health' && String(agent?.erc8004Id || '') === HALLMARK_HEALTH_ID,
});
