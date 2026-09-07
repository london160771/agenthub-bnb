/**
 * Presentation for the backend-authoritative agent capability field.
 * Unknown indexed states fail closed to watch-only so an old API response
 * cannot accidentally expose a hire action.
 */
export const AGENT_CAPABILITIES = Object.freeze({
  LOCAL_EXECUTABLE: 'seeded/local-executable',
  INDEXED_CATALOG_VERIFIED: 'indexed/catalog-verified',
  INDEXED_EXECUTABLE_FREE: 'indexed/executable-free',
  INDEXED_EXECUTABLE_PAID: 'indexed/executable-paid',
  INDEXED_EXECUTABLE_PAID_READY: 'indexed/executable-paid-ready',
  INDEXED_WATCH_ONLY: 'indexed/watch-only',
});

export const CAPABILITY_META = Object.freeze({
  [AGENT_CAPABILITIES.LOCAL_EXECUTABLE]: {
    label: 'Executable',
    detail: 'Free testnet run',
    description: 'Run this agent against live BNB Smart Chain Testnet data.',
    variant: 'ok',
  },
  [AGENT_CAPABILITIES.INDEXED_CATALOG_VERIFIED]: {
    label: 'Catalog',
    detail: 'Discovery only',
    description: 'The agent identity and public service metadata are available, but task execution is not verified here.',
    variant: 'info',
  },
  [AGENT_CAPABILITIES.INDEXED_EXECUTABLE_FREE]: {
    label: 'Executable',
    detail: 'Free external run',
    description: 'AgentHub has verified a free, read-only task and result contract for this BSC agent.',
    variant: 'ok',
  },
  [AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID]: {
    label: 'Executable',
    detail: 'Paid external run',
    description: 'AgentHub has verified a paid task and result contract for this BSC agent.',
    variant: 'ok',
  },
  [AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID_READY]: {
    label: 'Paid',
    detail: 'Payment verified',
    description: 'The exact payment requirement is verified. Task execution will be enabled after a real paid result is verified.',
    variant: 'warn',
  },
  [AGENT_CAPABILITIES.INDEXED_WATCH_ONLY]: {
    label: 'Watch-only',
    detail: 'Discovery only',
    description: 'This listing is discoverable, but AgentHub has not verified that it can accept a task and return a result.',
    variant: 'neutral',
  },
});

export function capabilityFor(agent) {
  return agent?.capability || AGENT_CAPABILITIES.INDEXED_WATCH_ONLY;
}
export function isLocallyExecutable(agent) {
  return capabilityFor(agent) === AGENT_CAPABILITIES.LOCAL_EXECUTABLE;
}

export function isExternallyExecutable(agent) {
  const capability = capabilityFor(agent);
  return capability === AGENT_CAPABILITIES.INDEXED_EXECUTABLE_FREE || capability === AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID;
}

/** Paid requirements are verified, so the user may begin payment confirmation. */
export function isPaymentReady(agent) {
  return capabilityFor(agent) === AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID_READY;
}

/** Selected settlement chain for a verified paid requirement. */
export function paymentChainIdFor(agent) {
  const chainId = Number(agent?.payment?.chainId);
  return Number.isInteger(chainId) && chainId > 0 ? chainId : 56;
}

/** A Hire page is available for free executors and paid agents ready for payment. */
export function isHireable(agent) {
  return isLocallyExecutable(agent) || isExternallyExecutable(agent) || isPaymentReady(agent);
}

export function isExecutable(agent) {
  return isLocallyExecutable(agent) || isExternallyExecutable(agent);
}

export function capabilityMetaFor(agent) {
  return CAPABILITY_META[capabilityFor(agent)] || CAPABILITY_META[AGENT_CAPABILITIES.INDEXED_WATCH_ONLY];
}

/** Small public badges used in marketplace surfaces. Keep protocol/state names internal. */
export function capabilityBadgesFor(agent) {
  const capability = capabilityFor(agent);
  if (capability === AGENT_CAPABILITIES.LOCAL_EXECUTABLE || capability === AGENT_CAPABILITIES.INDEXED_EXECUTABLE_FREE) {
    return [
      { label: 'Executable', variant: 'ok' },
      { label: 'Free', variant: 'neutral' },
    ];
  }
  if (capability === AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID) {
    return [
      { label: 'Executable', variant: 'ok' },
      { label: 'Paid', variant: 'brand' },
    ];
  }
  if (capability === AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID_READY) {
    return [{ label: 'Paid', variant: 'warn' }];
  }
  if (capability === AGENT_CAPABILITIES.INDEXED_CATALOG_VERIFIED) {
    return [{ label: 'Catalog', variant: 'info' }];
  }
  return [{ label: 'Watch-only', variant: 'neutral' }];
}

export function capabilityCopyFor(agent) {
  const meta = capabilityMetaFor(agent);
  return {
    label: meta.label,
    detail: meta.detail,
    description: meta.description,
  };
}

/**
 * One display price for every marketplace surface. Capability is authoritative
 * for free/local runs; verified payment metadata is authoritative for paid
 * indexed agents. Legacy seeded pricing is intentionally ignored.
 */
export function displayPricingFor(agent) {
  const capability = capabilityFor(agent);
  const free = capability === AGENT_CAPABILITIES.LOCAL_EXECUTABLE
    || capability === AGENT_CAPABILITIES.INDEXED_EXECUTABLE_FREE;
  if (free) return { amount: 0, currency: '', model: 'free', isFree: true };

  const paid = capability === AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID
    || capability === AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID_READY;
  const payment = agent?.payment || {};
  if (paid && payment.status === 'verified' && payment.amount != null) {
    return {
      amount: payment.amount,
      currency: payment.token || payment.currency || 'token',
      model: 'per-task',
      isFree: false,
    };
  }

  const pricing = agent?.pricing || {};
  return {
    amount: pricing.amount,
    currency: pricing.currency || 'BNB',
    model: pricing.model,
    isFree: pricing.amount === 0,
  };
}

/** Network copy derived from identity/payment metadata, not a global default. */
export function networkContextFor(agent) {
  const capability = capabilityFor(agent);
  if (capability === AGENT_CAPABILITIES.LOCAL_EXECUTABLE) {
    return { identity: null, execution: 'BNB Smart Chain Testnet', settlement: null };
  }

  const identity = agent?.capabilityDetails?.identity?.network
    || (Number(agent?.capabilityDetails?.identity?.chainId) === 56 ? 'BSC Mainnet' : null);
  const payment = agent?.capabilityDetails?.payment?.requirement || {};
  const settlement = agent?.payment?.settlementNetwork
    || agent?.capabilityDetails?.payment?.settlementNetwork
    || payment.settlementNetwork
    || (Number(agent?.payment?.chainId) === 56 ? 'BSC Mainnet' : null)
    || (Number(agent?.payment?.chainId) === 8453 ? 'Base Mainnet' : null);

  return {
    identity,
    execution: identity || (capability.startsWith('indexed/') ? 'External service' : null),
    settlement,
  };
}
