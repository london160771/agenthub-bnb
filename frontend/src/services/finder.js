import { api } from './api.js';

export function searchFinder(query, { limit = 12, signal } = {}) {
  return api.post('/finder', { query, limit }, { signal });
}

export function searchFinderGet(query, opts) {
  const qs = new URLSearchParams({ q: query });
  return api.get(`/finder?${qs.toString()}`, opts);
}
