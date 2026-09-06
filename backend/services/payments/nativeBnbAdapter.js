import { buildNativeBnbPaymentRequest } from './nativeBnbPaymentExecutor.js';
import { createNoBroadcastPaymentAdapter } from './noBroadcastAdapter.js';

const baseAdapter = createNoBroadcastPaymentAdapter('native-bnb');

/** Generic native-BNB preparation; the wallet remains the only submitter. */
export const nativeBnbAdapter = Object.freeze({
  ...baseAdapter,
  prepare(args) {
    const prepared = baseAdapter.prepare(args);
    return {
      ...prepared,
      paymentRequest: prepared.requirement.paymentVerified
        ? buildNativeBnbPaymentRequest({ requirement: prepared.requirement })
        : null,
    };
  },
});
