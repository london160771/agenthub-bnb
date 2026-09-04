import { api } from './api.js';

/** Prepare a backend-authoritative payment requirement without submitting it. */
export function preparePayment(body, opts) {
  return api.post('/payments/prepare', body, opts);
}
