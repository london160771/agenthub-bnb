import { PAYMENT_STATES, PaymentPreparationError } from './paymentStates.js';

/**
 * Shared protocol adapter contract. Every adapter can normalize/prepare a
 * requirement, but submission is deliberately disabled in this phase.
 */
export function createNoBroadcastPaymentAdapter(protocol) {
  return Object.freeze({
    protocol,

    prepare({ requirement, task = '' }) {
      if (!requirement) {
        throw new PaymentPreparationError(
          'PAYMENT_REQUIREMENT_MISSING',
          'A complete payment requirement is required before preparation.',
        );
      }

      return {
        state: PAYMENT_STATES.AWAITING_USER_CONFIRMATION,
        protocol,
        task,
        requirement,
        paymentRequest: null,
        quote: {
          kind: requirement.paymentVerified ? 'verified-requirement' : 'advertised-requirement',
          amount: requirement.amount,
          token: requirement.token,
          verified: requirement.paymentVerified === true,
        },
        confirmation: {
          required: true,
          enabled: false,
          reason: 'Payment submission is available only through the explicit wallet boundary.',
        },
        provenance: {
          payment: 'backend agent.payment metadata',
          execution: 'not executed',
          network: requirement.network.name,
        },
        transitions: [
          PAYMENT_STATES.PAYMENT_REQUIRED,
          PAYMENT_STATES.PAYMENT_PREPARED,
          PAYMENT_STATES.AWAITING_USER_CONFIRMATION,
        ],
      };
    },
  });
}
