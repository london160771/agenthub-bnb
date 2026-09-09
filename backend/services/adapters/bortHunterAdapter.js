/**
 * Narrow read-only A2A adapter for BORT HUNTER AGENT (ERC-8004 BSC Mainnet
 * 338630). The provider exposes many owner/write skills, but AgentHub sends
 * exactly one allowlisted skill and never accepts a caller-selected method.
 */
import { TaskInputError } from '../agentExecutors.js';
import { getExternalAdapterKey } from '../agentCapabilities.js';

export const BORT_HUNTER_ID = '56:338630';
export const BORT_HUNTER_ENDPOINT = 'https://api.bortagent.xyz/api/a2a/11169';
export const BORT_HUNTER_CARD_URL = `${BORT_HUNTER_ENDPOINT}/card`;
export const BORT_ALLOWED_READ_SKILL = 'check_balance';
const TIMEOUT_MS = 45_000;

function fail(message) {
  throw new TaskInputError(message);
}

export function parseBortHunterInput(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('BORT Hunter input must be an object.');
  if (Object.keys(input).some((key) => !['skill', 'notes'].includes(key))) fail('BORT Hunter accepts only its explicit read-only skill.');
  if (String(input.skill || '').trim() !== BORT_ALLOWED_READ_SKILL) {
    fail('BORT Hunter exposes only the verified read-only check_balance skill through AgentHub.');
  }
  return { skill: BORT_ALLOWED_READ_SKILL };
}

async function request(input) {
  const parsed = parseBortHunterInput(input);
  const id = `agenthub-bort-${Date.now()}`;
  const body = {
    jsonrpc: '2.0',
    id,
    method: 'message/send',
    params: {
      message: {
        messageId: id,
        role: 'user',
        parts: [{ kind: 'text', text: JSON.stringify(parsed) }],
      },
    },
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(BORT_HUNTER_ENDPOINT, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const raw = await response.text();
    let json;
    try { json = JSON.parse(raw); } catch { fail('BORT Hunter returned malformed JSON.'); }
    if (!response.ok) fail(`BORT Hunter returned HTTP ${response.status}.`);
    return { json, parsed, requestId: id };
  } catch (err) {
    if (err instanceof TaskInputError) throw err;
    if (err?.name === 'AbortError') fail('BORT Hunter did not respond within 45 seconds.');
    fail(`BORT Hunter could not be reached: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}

export function validateBortHunterResponse(json, requestedSkill = BORT_ALLOWED_READ_SKILL) {
  parseBortHunterInput({ skill: requestedSkill });
  const result = json?.result;
  if (!json || json.jsonrpc !== '2.0' || !result || result.kind !== 'message' || result.role !== 'agent' || result.final !== true) {
    fail('BORT Hunter returned an incomplete A2A task result.');
  }
  const textPart = Array.isArray(result.parts)
    ? result.parts.find((part) => part?.kind === 'text' && typeof part.text === 'string' && part.text.trim())
    : null;
  if (!textPart || typeof result.messageId !== 'string' || !result.messageId.trim()) {
    fail('BORT Hunter returned no readable task result.');
  }
  if (!result.metadata || result.metadata.charged !== false) {
    fail('BORT Hunter did not return the required charged:false read-only metadata.');
  }
  return {
    text: textPart.text.trim(),
    messageId: result.messageId,
    metadata: {
      charged: false,
      ...(typeof result.metadata.budgetExceeded === 'boolean' ? { budgetExceeded: result.metadata.budgetExceeded } : {}),
    },
  };
}

export async function executeBortHunter({ agent, execution }) {
  if (getExternalAdapterKey(agent) !== 'bort-hunter' || String(agent?.erc8004Id || '') !== BORT_HUNTER_ID) {
    fail('This is not the verified BORT Hunter agent.');
  }
  const { json, parsed, requestId } = await request(execution.input || {});
  const result = validateBortHunterResponse(json, parsed.skill);
  const firstLine = result.text.split(/\r?\n/, 1)[0].slice(0, 180);
  const warnings = ['Provider metadata reports charged:false; no payment or transaction was used.'];
  if (result.metadata.budgetExceeded === true) warnings.push('Provider metadata reports budgetExceeded:true; the returned text may be bounded.');
  return {
    headline: firstLine || 'BORT Hunter returned a balance result',
    summary: 'BORT Hunter returned a real read-only A2A balance result from the BSC Mainnet agent. AgentHub sent only the allowlisted check_balance skill and did not expose trading or other write skills.',
    fields: [
      { key: 'agent', label: 'External agent', value: 'BORT HUNTER AGENT', source: 'external' },
      { key: 'skill', label: 'Requested skill', value: parsed.skill, source: 'input' },
      { key: 'providerMessageId', label: 'Provider message id', value: result.messageId, source: 'external' },
      { key: 'charged', label: 'Provider charged', value: 'No', source: 'external', tone: 'ok' },
      { key: 'answer', label: 'Provider answer', value: result.text, source: 'external' },
    ],
    warnings,
    recommendation: 'Read-only balance result returned. Trading, position, approval, and transfer skills are not callable through this AgentHub adapter.',
    hasSimulated: false,
    provenance: {
      source: 'external-a2a',
      transport: 'external-a2a-jsonrpc-0.3.0',
      endpoint: BORT_HUNTER_ENDPOINT,
      agentCardUrl: BORT_HUNTER_CARD_URL,
      chainId: 56,
      network: 'BSC Mainnet',
      blockNumber: null,
      readAt: new Date().toISOString(),
      providerMessageId: result.messageId,
      requestId,
      providerMetadata: result.metadata,
      explorer: 'https://bscscan.com',
    },
    rawResponse: json,
    reads: [{ method: 'HTTP POST A2A message/send check_balance', target: BORT_HUNTER_ENDPOINT, status: 200 }],
  };
}

export const bortHunterAdapter = Object.freeze({
  kind: 'execution',
  adapterKey: 'bort-hunter',
  endpoint: BORT_HUNTER_CARD_URL,
  taskEndpoint: BORT_HUNTER_ENDPOINT,
  chainId: 56,
  canHandle: (agent) => getExternalAdapterKey(agent) === 'bort-hunter' && String(agent?.erc8004Id || '') === BORT_HUNTER_ID,
  execute: executeBortHunter,
});
