import { ApiError } from '../utils/ApiError.js';

export function formatZodIssues(error) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}

/**
 * Validates and coerces req.body / req.query / req.params with Zod schemas.
 * Parsed (typed, defaulted) values replace the originals.
 */
export const validate =
  (schemas = {}) =>
  (req, _res, next) => {
    const errors = [];
    for (const key of ['params', 'query', 'body']) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(req[key] ?? {});
      if (result.success) {
        req[key] = result.data;
      } else {
        errors.push(...formatZodIssues(result.error).map((e) => ({ ...e, location: key })));
      }
    }
    if (errors.length) return next(ApiError.badRequest('Validation failed', errors));
    return next();
  };
