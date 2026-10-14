import mongoose from 'mongoose';
import multer from 'multer';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { formatZodIssues } from './validate.js';

export function notFound(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

function normalize(err) {
  if (err instanceof ApiError) return err;
  if (err instanceof ZodError) return ApiError.badRequest('Validation failed', formatZodIssues(err));
  if (err instanceof mongoose.Error.CastError) return ApiError.badRequest(`Invalid ${err.path}: ${err.value}`);
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return ApiError.badRequest('Validation failed', details);
  }
  if (err?.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return ApiError.conflict(`A record with this ${field} already exists`);
  }
  if (err?.name === 'JsonWebTokenError' || err?.name === 'TokenExpiredError') {
    return ApiError.unauthorized('Invalid or expired session. Please log in again.');
  }
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : err.message;
    return ApiError.badRequest(msg);
  }
  if (err?.type === 'entity.parse.failed') return ApiError.badRequest('Malformed JSON body');
  if (err?.type === 'entity.too.large') return new ApiError(413, 'Request body too large');
  const wrapped = new ApiError(err?.statusCode || 500, err?.statusCode ? err.message : 'Internal server error');
  wrapped.isOperational = false;
  wrapped.original = err;
  return wrapped;
}

// Express identifies error middleware by its 4 arguments, so _next must stay.
export function errorHandler(err, req, res, _next) {
  const apiErr = normalize(err);
  if (apiErr.statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} ->`, apiErr.original || err);
  }
  const body = { success: false, message: apiErr.message };
  if (apiErr.details) body.errors = apiErr.details;
  // Never leak stack traces outside development.
  if (env.nodeEnv === 'development' && apiErr.statusCode >= 500) {
    body.stack = (apiErr.original || err)?.stack;
  }
  res.status(apiErr.statusCode).json(body);
}
