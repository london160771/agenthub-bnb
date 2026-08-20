/**
 * Standard API envelope helpers so every endpoint returns a consistent shape:
 *   success -> { success: true, data }
 *   error   -> { success: false, error: { code, message, details? } }
 */

export class ApiError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

// Convenience factories for the most common failures.
ApiError.badRequest = (message, details) => new ApiError(400, 'BAD_REQUEST', message, details);
ApiError.notFound = (message = 'Resource not found') => new ApiError(404, 'NOT_FOUND', message);
ApiError.unavailable = (message = 'Service temporarily unavailable') =>
  new ApiError(503, 'SERVICE_UNAVAILABLE', message);

export function sendSuccess(res, data, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

export function sendError(res, statusCode, code, message, details) {
  const error = { code, message };
  if (details) error.details = details;
  return res.status(statusCode).json({ success: false, error });
}

/**
 * Wrap async route handlers so thrown/rejected errors reach the error handler.
 * (Express 5 forwards rejected promises, but this keeps intent explicit.)
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
