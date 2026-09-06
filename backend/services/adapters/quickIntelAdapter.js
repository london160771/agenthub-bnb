/**
 * Quick Intel's verified HTTP task contract.
 *
 * The adapter records the published input/output contract but deliberately
 * stops before invocation until a future x402 payment executor supplies a
 * provider-valid payment proof. No payment or signature is created here.
 */
import { TaskInputError } from '../agentExecutors.js';
import { getExternalAdapterKey } from '../agentCapabilities.js';

export const QUICK_INTEL_ID = '56:6255';
export const QUICK_INTEL_ENDPOINT = 'https://x402.quickintel.io/v1/scan/full';
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

function validateInput(input = {}) {
  const chain = String(input.chain || '').trim().toLowerCase();
  const tokenAddress = String(input.tokenAddress || '').trim();
  if (chain !== 'base') throw new TaskInputError('Quick Intel currently exposes the verified Base security-scan request contract only.');
  if (!ADDRESS_RE.test(tokenAddress)) throw new TaskInputError('Quick Intel requires a valid EVM token contract address.');
  return { chain, tokenAddress };
}

export const quickIntelAdapter = Object.freeze({
  kind: 'execution',
  adapterKey: 'quick-intel',
  endpoint: QUICK_INTEL_ENDPOINT,
  chainId: 8453,
  paid: true,
  canHandle: (agent) => getExternalAdapterKey(agent) === 'quick-intel' && String(agent?.erc8004Id || '') === QUICK_INTEL_ID,
  execute: async ({ execution }) => {
    validateInput(execution?.input || {});
    throw new TaskInputError(
      'Quick Intel requires a provider-valid x402 payment proof. AgentHub has prepared the verified challenge, but no payment executor is enabled in this phase.',
    );
  },
});
