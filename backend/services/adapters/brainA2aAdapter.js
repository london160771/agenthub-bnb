/**
 * Read-only adapter for the verified Brain public AgentCard and A2A catalog.
 *
 * This module intentionally has no `execute` method. A catalog response tells
 * us what a service advertises and how it says payment would work; it does not
 * prove that a requested skill ran or returned a task result.
 */
import {
  BRAIN_A2A_ENDPOINT,
  BRAIN_AGENT_CARD_URL,
  isCatalogVerifiedAgent,
} from '../agentCapabilities.js';

const CATEGORY_TO_SKILL = Object.freeze({
  'health-factor': 'health_factor',
  yield: 'yield_plan',
  trading: 'grid_plan',
  portfolio: 'rebalance_plan',
});

const REQUEST_TIMEOUT_MS = 12_000;

function withTimeout(signal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true });
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

async function getJson(url, options = {}) {
  const timeout = withTimeout(options.signal);
  try {
    const response = await fetch(url, {
      ...options,
      signal: timeout.signal,
      headers: { accept: 'application/json', ...(options.headers || {}) },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(`Brain A2A catalog request returned HTTP ${response.status}.`);
    }
    return body;
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error('Brain A2A catalog request timed out.');
    if (err?.message?.startsWith('Brain A2A')) throw err;
    throw new Error(`Brain A2A catalog request failed: ${err.message}`);
  } finally {
    timeout.clear();
  }
}

function assertCatalogRecord(agent) {
  if (!isCatalogVerifiedAgent(agent)) {
    throw new Error('This indexed agent has no verified catalog capability.');
  }
}

export function skillFor(category) {
  return CATEGORY_TO_SKILL[category] || null;
}

/** Retrieve the public AgentCard; this verifies discovery metadata only. */
export async function fetchBrainAgentCard({ signal } = {}) {
  return getJson(BRAIN_AGENT_CARD_URL, { signal });
}

/**
 * Retrieve Brain's advertised service catalog through A2A JSON-RPC.
 * The returned object is catalog metadata, never an execution result or quote.
 */
export async function fetchBrainCatalog({ agent, category, params = {}, signal } = {}) {
  assertCatalogRecord(agent);
  const skill = skillFor(category);
  const requestText = JSON.stringify({
    kind: 'catalog_request',
    skill: skill || undefined,
    params,
  });
  const id = `agenthub-catalog-${Date.now()}`;
  const body = {
    jsonrpc: '2.0',
    id,
    method: 'message/send',
    params: {
      message: {
        messageId: id,
        role: 'user',
        parts: [{ kind: 'text', text: requestText }],
      },
    },
};
  const raw = await getJson(BRAIN_A2A_ENDPOINT, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return {
    kind: 'catalog',
    transport: 'external-http-a2a',
    endpoint: BRAIN_A2A_ENDPOINT,
    chainId: 56,
    agentCardUrl: BRAIN_AGENT_CARD_URL,
    skillRequested: skill,
    response: raw,
  };
}

export const brainA2aAdapter = Object.freeze({
  kind: 'catalog',
  endpoint: BRAIN_A2A_ENDPOINT,
  chainId: 56,
  canHandle: isCatalogVerifiedAgent,
  skillFor,
  fetchAgentCard: fetchBrainAgentCard,
  fetchCatalog: fetchBrainCatalog,
});
