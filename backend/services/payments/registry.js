import { erc8183Adapter } from './erc8183Adapter.js';
import { nativeBnbAdapter } from './nativeBnbAdapter.js';
import { x402Adapter } from './x402Adapter.js';

const adapters = new Map([
  [x402Adapter.protocol, x402Adapter],
  [erc8183Adapter.protocol, erc8183Adapter],
  [nativeBnbAdapter.protocol, nativeBnbAdapter],
]);

export function getPaymentAdapter(protocol) {
  return adapters.get(protocol) || null;
}

export const paymentAdapterRegistry = Object.freeze({
  getPaymentAdapter,
  protocols: [...adapters.keys()],
});
