const BASE_URL = import.meta.env.VITE_API_URL || '/api';

/** Error thrown by the API layer, carrying a stable code + HTTP status. */
export class ApiError extends Error {
  constructor(message, { code, status, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code || 'ERROR';
    this.status = status;
    // Structured extras from the backend envelope, e.g. the existing
    // `executionId` returned with a duplicate-hire 409. Null when absent.
    this.details = details ?? null;
  }
}

async function request(path, { method = 'GET', body, signal, headers } = {}) {
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body != null ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError('Cannot reach the AgentHub API. Is the server running?', {
      code: 'NETWORK_ERROR',
    });
  }

  // Parse JSON when present; tolerate empty bodies.
  let payload = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!res.ok || (payload && payload.success === false)) {
    const error = (payload && payload.error) || {};
    throw new ApiError(error.message || `Request failed (${res.status})`, {
      code: error.code || 'HTTP_ERROR',
      status: res.status,
      details: error.details,
    });
  }

  return payload ? payload.data : null;
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
  del: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
};

export const getHealth = (opts) => api.get('/health', opts);
