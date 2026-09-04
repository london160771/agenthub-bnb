/**
 * States shared by every payment protocol. These are preparation states only
 * in Phase 11.3; no state below PAYMENT_SUBMITTED is reachable yet.
 */
export const PAYMENT_STATES = Object.freeze({
  FREE: 'FREE',
  PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',
  PAYMENT_PREPARED: 'PAYMENT_PREPARED',
  AWAITING_USER_CONFIRMATION: 'AWAITING_USER_CONFIRMATION',
  PAYMENT_SUBMITTED: 'PAYMENT_SUBMITTED',
  PAYMENT_CONFIRMED: 'PAYMENT_CONFIRMED',
  TASK_RUNNING: 'TASK_RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
});

export const PAYMENT_PROTOCOLS = Object.freeze({
  NONE: 'none',
  X402: 'x402',
  ERC8183: 'erc8183',
  NATIVE_BNB: 'native-bnb',
  CUSTOM: 'custom',
});

export class PaymentPreparationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'PaymentPreparationError';
    this.code = code;
    this.details = details;
  }
}
