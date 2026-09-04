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
  INDEXED_WATCH_ONLY: 'indexed/watch-only',
});

export const CAPABILITY_META = Object.freeze({
  [AGENT_CAPABILITIES.LOCAL_EXECUTABLE]: {
    label: 'Local executor',
    variant: 'warn',
  },
  [AGENT_CAPABILITIES.INDEXED_CATALOG_VERIFIED]: {
    label: 'Mainnet agent · catalog verified',
    variant: 'info',
  },
  [AGENT_CAPABILITIES.INDEXED_EXECUTABLE_FREE]: {
    label: 'Mainnet agent · free execution verified',
    variant: 'ok',
  },
  [AGENT_CAPABILITIES.INDEXED_EXECUTABLE_PAID]: {
    label: 'Mainnet agent · paid execution verified',
    variant: 'ok',
  },
  [AGENT_CAPABILITIES.INDEXED_WATCH_ONLY]: {
    label: 'Indexed · watch-only',
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

export function isExecutable(agent) {
  return isLocallyExecutable(agent) || isExternallyExecutable(agent);
}

export function capabilityMetaFor(agent) {
  return CAPABILITY_META[capabilityFor(agent)] || CAPABILITY_META[AGENT_CAPABILITIES.INDEXED_WATCH_ONLY];
}
