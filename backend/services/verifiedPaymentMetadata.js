import { normalizeX402Challenge } from './payments/x402Challenge.js';
import {
  HALLMARK_HEALTH_A2A_ENDPOINT,
  HALLMARK_HEALTH_ENDPOINT,
} from './adapters/hallmarkHealthAdapter.js';

const QUICK_INTEL_CHALLENGE = Object.freeze({
  x402Version: 2,
  // Captured from the live 402 response. These are only provider-offered
  // network identifiers; settlement facts are selected and verified below
  // only for Base, where token decimals were independently read.
  observedSupportedNetworks: Object.freeze([
    'eip155:8453', 'eip155:1', 'eip155:42161', 'eip155:10', 'eip155:137',
    'eip155:43114', 'eip155:130', 'eip155:59144', 'eip155:4326', 'eip155:146',
    'eip155:999', 'eip155:57073', 'eip155:143', 'eip155:2741',
  ]),
  accepts: [Object.freeze({
    scheme: 'exact',
    network: 'eip155:8453',
    amount: '30000',
    payTo: '0x3dBDfB6E5dCFa8f51AA07bC3aDf18a62b186C362',
    maxTimeoutSeconds: 3600,
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    extra: Object.freeze({ name: 'USD Coin', version: '2' }),
  })],
  extensions: Object.freeze({
    bazaar: Object.freeze({
      info: Object.freeze({
        input: Object.freeze({
          type: 'http',
          method: 'POST',
          bodyType: 'json',
          body: Object.freeze({ chain: 'base', tokenAddress: '0xa4a2e2ca3fbfe21aed83471d28b6f65a233c6e00' }),
        }),
      }),
    }),
  }),
  resource: Object.freeze({ url: 'https://x402.quickintel.io/v1/scan/full', mimeType: 'application/json' }),
});

// Token decimals come from an independent read-only Base USDC contract call,
// not from the display symbol in the provider challenge.
const QUICK_INTEL_X402 = normalizeX402Challenge(QUICK_INTEL_CHALLENGE, {
  preferredNetwork: 'eip155:8453',
  tokenDecimalsByNetwork: { 'eip155:8453': 6 },
});

// Captured from the live HTTP 402 response at the Hallmark health report
// endpoint. The exact integer amount and the provider's payment metadata are
// retained for read-only preflight; no payment proof is present or implied.
const HALLMARK_HEALTH_CHALLENGE = Object.freeze({
  x402Version: 2,
  resource: Object.freeze({ url: HALLMARK_HEALTH_ENDPOINT, mimeType: 'application/json' }),
  accepts: [Object.freeze({
    scheme: 'exact',
    network: 'eip155:56',
    amount: '250000000000000000',
    asset: '0x55d398326f99059fF775485246999027B3197955',
    payTo: '0x38c6Fc4a5525B37f9545423A7132157f69ce08dA',
    maxTimeoutSeconds: 120,
    extra: Object.freeze({
      name: 'USDT',
      version: '1',
      decimals: 18,
      assetTransferMethod: 'permit2-exact',
    }),
    maxAmountRequired: '250000000000000000',
    resource: HALLMARK_HEALTH_ENDPOINT,
    mimeType: 'application/json',
  })],
});

const HALLMARK_HEALTH_X402 = normalizeX402Challenge(HALLMARK_HEALTH_CHALLENGE, {
  preferredNetwork: 'eip155:56',
  tokenDecimalsByNetwork: { 'eip155:56': 18 },
});

/**
 * Backend-owned facts independently verified from a published service
 * contract. These facts are persisted into Agent.payment; they are not a
 * frontend capability override and do not prove that a paid task succeeded.
 */
const VERIFIED_PAYMENT_RECORDS = Object.freeze([
  Object.freeze({
    erc8004Id: '56:258641',
    endpoint: 'https://smartsentinels.net/api/audit-mcp',
    paymentProtocol: 'native-bnb',
    payment: Object.freeze({
      type: 'native-bnb',
      status: 'verified',
      amount: 0.2,
      token: 'BNB',
      tokenAddress: null,
      tokenDecimals: 18,
      currency: 'BNB',
      chainId: 56,
      recipient: '0x4E21F74143660ee576F4D2aC26BD30729a849f55',
      contract: null,
      requiresWallet: true,
      requiresMainnetTx: true,
      requiresTokenApproval: false,
      effect: 'One direct native BNB transfer authorizes the Sentinels Audit MCP task; no token approval or ERC-8183 funding is required.',
      verification: Object.freeze({
        status: 'verified',
        source: 'AgentHub independent verification of the published Sentinels MCP payment contract',
        method: 'MCP tool contract and public BSC Mainnet settlement facts reviewed without payment',
        endpoint: 'https://smartsentinels.net/api/audit-mcp',
      }),
    }),
  }),
  Object.freeze({
    erc8004Id: '56:6255',
    endpoint: 'https://x402.quickintel.io/v1/scan/full',
    executionProtocol: 'http',
    paymentProtocol: 'x402',
    payment: Object.freeze({
      type: 'x402',
      status: 'verified',
      amount: QUICK_INTEL_X402.selected.amount,
      amountBaseUnits: QUICK_INTEL_X402.selected.amountBaseUnits,
      token: 'USDC',
      tokenAddress: QUICK_INTEL_X402.selected.tokenAddress,
      tokenDecimals: QUICK_INTEL_X402.selected.tokenDecimals,
      currency: 'USDC',
      // This is the selected settlement chain, not the ERC-8004 identity chain.
      chainId: QUICK_INTEL_X402.selected.chainId,
      settlementNetwork: 'Base Mainnet',
      recipient: QUICK_INTEL_X402.selected.payTo,
      contract: null,
      requiresWallet: null,
      requiresMainnetTx: null,
      requiresTokenApproval: null,
      effect: 'The provider requires an x402 exact payment authorization for one security scan. AgentHub prepares the challenge only; no wallet signature or payment is requested in this phase.',
      x402: Object.freeze({
        version: QUICK_INTEL_X402.version,
        scheme: QUICK_INTEL_X402.scheme,
        network: QUICK_INTEL_X402.selected.network,
        amountBaseUnits: QUICK_INTEL_X402.selected.amountBaseUnits,
        payTo: QUICK_INTEL_X402.selected.payTo,
        asset: QUICK_INTEL_X402.selected.tokenAddress,
        maxTimeoutSeconds: QUICK_INTEL_X402.selected.maxTimeoutSeconds,
        supportedNetworks: QUICK_INTEL_X402.supportedNetworks,
        request: QUICK_INTEL_X402.request,
        resource: 'https://x402.quickintel.io/v1/scan/full',
      }),
      verification: Object.freeze({
        status: 'verified',
        source: 'AgentHub independent verification of the live Quick Intel HTTP 402 challenge',
        method: 'HTTP 402 payment-required challenge plus read-only Base USDC decimals contract call; no payment submitted',
        endpoint: 'https://x402.quickintel.io/v1/scan/full',
      }),
    }),
  }),
  Object.freeze({
    erc8004Id: '56:338480',
    // 8004scan persists the A2A card endpoint as the agent endpoint. The paid
    // x402 task resource is retained inside payment.x402.resource below.
    endpoint: HALLMARK_HEALTH_A2A_ENDPOINT,
    executionProtocol: 'a2a',
    paymentProtocol: 'x402',
    payment: Object.freeze({
      type: 'x402',
      status: 'verified',
      amount: HALLMARK_HEALTH_X402.selected.amount,
      amountBaseUnits: HALLMARK_HEALTH_X402.selected.amountBaseUnits,
      token: 'USDT',
      tokenAddress: HALLMARK_HEALTH_X402.selected.tokenAddress,
      tokenDecimals: HALLMARK_HEALTH_X402.selected.tokenDecimals,
      currency: 'USDT',
      chainId: HALLMARK_HEALTH_X402.selected.chainId,
      settlementNetwork: 'BSC Mainnet',
      recipient: HALLMARK_HEALTH_X402.selected.payTo,
      contract: null,
      requiresWallet: null,
      requiresMainnetTx: null,
      requiresTokenApproval: null,
      effect: 'The provider requires an x402 exact payment authorization for one priced Venus position report. AgentHub exposes the verified challenge only; no wallet signature, approval, or payment is requested.',
      x402: Object.freeze({
        version: HALLMARK_HEALTH_X402.version,
        scheme: HALLMARK_HEALTH_X402.scheme,
        network: HALLMARK_HEALTH_X402.selected.network,
        amountBaseUnits: HALLMARK_HEALTH_X402.selected.amountBaseUnits,
        payTo: HALLMARK_HEALTH_X402.selected.payTo,
        asset: HALLMARK_HEALTH_X402.selected.tokenAddress,
        maxTimeoutSeconds: HALLMARK_HEALTH_X402.selected.maxTimeoutSeconds,
        supportedNetworks: HALLMARK_HEALTH_X402.supportedNetworks,
        request: HALLMARK_HEALTH_X402.request,
        resource: HALLMARK_HEALTH_ENDPOINT,
        extra: HALLMARK_HEALTH_X402.selected.extra,
      }),
      verification: Object.freeze({
        status: 'verified',
        source: 'AgentHub independent verification of the live Hallmark HTTP 402 challenge',
        method: 'HTTP 402 payment-required challenge with x402 v2 exact BSC Mainnet USDT metadata; no payment submitted',
        endpoint: HALLMARK_HEALTH_ENDPOINT,
        verifiedAt: new Date('2026-09-09T02:09:00.000Z'),
      }),
    }),
  }),
]);

function normalizeEndpoint(value) {
  return String(value || '').trim().replace(/\/$/, '');
}

/** Return a copy for an exact identity and either its known endpoint or no persisted endpoint. */
export function getVerifiedPaymentMetadata(agent) {
  if (agent?.source !== 'indexed') return null;
  const identity = String(agent.erc8004Id || '');
  const endpoint = normalizeEndpoint(agent.endpoint);
  const match = VERIFIED_PAYMENT_RECORDS.find(
    (record) => record.erc8004Id === identity && (!endpoint || normalizeEndpoint(record.endpoint) === endpoint),
  );
  if (!match) return null;
  return {
    erc8004Id: match.erc8004Id,
    endpoint: match.endpoint,
    executionProtocol: match.executionProtocol || null,
    paymentProtocol: match.paymentProtocol,
    payment: {
      ...match.payment,
      verification: { ...match.payment.verification },
    },
  };
}

export { VERIFIED_PAYMENT_RECORDS };
