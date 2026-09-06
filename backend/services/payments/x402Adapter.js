import { createNoBroadcastPaymentAdapter } from './noBroadcastAdapter.js';

const baseAdapter = createNoBroadcastPaymentAdapter('x402');

/**
 * x402 preparation exposes the provider challenge as a payment requirement,
 * not as an EVM transaction request. Signing/submission is intentionally not
 * implemented here, so this adapter cannot open a wallet by itself.
 */
export const x402Adapter = Object.freeze({
  ...baseAdapter,
  prepare(args) {
    const prepared = baseAdapter.prepare(args);
    const { requirement } = prepared;
    return {
      ...prepared,
      paymentRequest: {
        kind: 'x402-challenge',
        version: requirement.protocolVersion,
        scheme: requirement.scheme,
        network: requirement.network.name,
        networkId: requirement.network.chainId,
        amountBaseUnits: requirement.amountBaseUnits,
        tokenAddress: requirement.token.address,
        payTo: requirement.recipient,
        maxTimeoutSeconds: requirement.challenge?.maxTimeoutSeconds || null,
        supportedNetworks: requirement.challenge?.supportedNetworks || [],
        request: requirement.challenge?.request || null,
        resource: requirement.challenge?.resource || null,
      },
      confirmation: {
        required: true,
        enabled: false,
        reason: 'x402 signing and payment submission are not enabled; no wallet request will be made.',
      },
      provenance: {
        ...prepared.provenance,
        network: requirement.settlementNetwork || requirement.network.name,
        identityChain: 'BSC Mainnet (chain 56)',
      },
    };
  },
});
