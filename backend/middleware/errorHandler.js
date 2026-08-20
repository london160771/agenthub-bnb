import { ApiError } from '../utils/apiResponse.js';
import { isProd } from '../config/env.js';

export function notFound(req, res) {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`,
    },
  });
}

// eslint-disable-next-line no-unused-vars -- Express requires the 4-arg signature.
export function errorHandler(err, req, res, next) {
  // Mongoose validation / cast errors -> 400
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors || {}).map((e) => e.message);
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', details },
    });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: `Invalid value for "${err.path}"` },
    });
  }

  const statusCode = err instanceof ApiError ? err.statusCode : err.statusCode || 500;
  const code = err.code || (statusCode === 500 ? 'INTERNAL_ERROR' : 'ERROR');
  const message =
    statusCode === 500 && isProd ? 'Something went wrong on our end.' : err.message;

  if (statusCode >= 500) {
    console.error('[error]', err);
  }

  const body = { success: false, error: { code, message } };
  if (err.details) body.error.details = err.details;
  res.status(statusCode).json(body);
}
