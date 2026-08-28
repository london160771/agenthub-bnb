/**
 * 8004scan API client — verified 2026-08-26.
 * Base: https://api.8004scan.io/api/v1, auth X-API-Key (optional).
 * Anonymous tier works (30/min, 1k/day). See PROJECT_HANDOFF §9A.
 *
 * Envelope shapes differ by endpoint:
 *   GET /agents                -> { items, total, limit, offset }
 *   GET /agents/search/semantic -> { success, data }
 * Pagination is limit+offset; `page` is silently ignored.
 * Unsupported params fail silently with UNFILTERED results — callers must
 * verify that `total` changes when a filter is applied.
 */
import { env } from '../config/env.js';

const DEFAULT_TIMEOUT_MS = 15000;

function baseUrl() {
  return (env.scan8004BaseUrl || 'https://api.8004scan.io/api/v1').replace(/\/$/, '');
}

function apiKey() {
  return env.scan8004ApiKey || '';
}

function buildUrl(path, params = {}) {
  const url = new URL(`${baseUrl()}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === '') continue;
    url.searchParams.set(k, String(v));
  }
  return url.toString();
}

async function fetchJson(url, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const headers = { accept: 'application/json' };
  const key = apiKey();
  if (key) headers['X-API-Key'] = key;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, { headers, signal: controller.signal });
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error(`8004scan timed out after ${timeoutMs}ms`);
    throw new Error(`8004scan unreachable: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }

  // capture rate-limit headers for diagnostics
  const rateLimit = {
    tier: res.headers.get('x-ratelimit-tier'),
    limitMinute: res.headers.get('x-ratelimit-limit-minute'),
    remainingMinute: res.headers.get('x-ratelimit-remaining-minute'),
    limitDay: res.headers.get('x-ratelimit-limit-day'),
    remainingDay: res.headers.get('x-ratelimit-remaining-day'),
  };

  const text = await res.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`8004scan malformed JSON (HTTP ${res.status})`);
    }
  }

  if (!res.ok) {
    const msg = json?.message || json?.error || `HTTP ${res.status}`;
    throw new Error(`8004scan ${msg}`);
  }

  return { json, rateLimit, status: res.status };
}

/**
 * List agents. Verified working params: chain_id, search, limit, offset.
 * Others (chainId, q, name, sort, etc.) are silently ignored — callers must
 * not rely on them. This wrapper only exposes the verified subset.
 */
export async function listAgents({ chainId = 56, search = '', limit = 20, offset = 0 } = {}) {
  const url = buildUrl('/agents', {
    chain_id: chainId,
    search: search || undefined,
    limit,
    offset,
  });
  const { json, rateLimit } = await fetchJson(url);
  // normal envelope
  if (Array.isArray(json.items)) {
    return { items: json.items, total: json.total ?? json.items.length, limit: json.limit ?? limit, offset: json.offset ?? offset, rateLimit, raw: json };
  }
  // fallback — some deployments wrap in data
  if (Array.isArray(json.data)) {
    return { items: json.data, total: json.total ?? json.data.length, limit, offset, rateLimit, raw: json };
  }
  // unknown shape — surface raw but keep items empty
  return { items: [], total: 0, limit, offset, rateLimit, raw: json };
}

/**
 * Semantic search (separate envelope). Use cautiously — embeddings conflate
 * DeFi "health factor" with medical health. Caller should prefer keyword search
 * for category discovery.
 */
export async function semanticSearch({ q, limit = 20, offset = 0 } = {}) {
  const url = buildUrl('/agents/search/semantic', { q, limit, offset });
  const { json, rateLimit } = await fetchJson(url);
  const data = json.data || json.items || [];
  const items = Array.isArray(data) ? data : [];
  return { items, total: json.total ?? items.length, rateLimit, raw: json };
}

/**
 * Detail for a single agent. Needed for ingestion (tags, services, tx hash).
 * Endpoint: GET /agents/{chainId}/{tokenId}
 */
export async function getAgentDetail(chainId, tokenId) {
  const url = buildUrl(`/agents/${encodeURIComponent(chainId)}/${encodeURIComponent(tokenId)}`);
  const { json, rateLimit } = await fetchJson(url);
  // detail may be { data: {...}} or the object itself
  const detail = json.data || json.agent || json;
  return { detail, rateLimit, raw: json };
}

export const scan8004Client = { listAgents, semanticSearch, getAgentDetail, baseUrl };
