import { api } from './api.js';

/** Prepare a backend-authoritative payment requirement without submitting it. */
export function preparePayment(body, opts) {
  return api.post('/payments/prepare', body, opts);
}

/** Verify a wallet-confirmed payment before a paid external task runs. */
export function confirmPayment(executionId, body, opts) {
  return api.post(`/payments/${encodeURIComponent(executionId)}/confirm`, body, opts);
}
