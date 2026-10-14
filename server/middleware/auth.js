import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { cookieNames, verifyAccessToken } from '../utils/tokens.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function extractToken(req) {
  const header = req.get('authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return req.cookies?.[cookieNames(req).access];
}

async function resolveUser(token) {
  const payload = verifyAccessToken(token);
  const user = await User.findById(payload.sub).select('+passwordChangedAt');
  if (!user) throw ApiError.unauthorized('Account no longer exists');
  if (!user.isActive) throw ApiError.forbidden('Your account has been deactivated');
  if (user.passwordChangedAt && payload.iat * 1000 < user.passwordChangedAt.getTime()) {
    throw ApiError.unauthorized('Password changed recently. Please log in again.');
  }
  return user;
}

/** Requires a valid access token (cookie or Bearer header). */
export const protect = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized('Please log in to continue');
  try {
    req.user = await resolveUser(token);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw ApiError.unauthorized('Session expired. Please log in again.');
  }
  next();
});

/** Attaches req.user when a valid token is present; never fails. */
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (token) {
    try {
      req.user = await resolveUser(token);
    } catch {
      req.user = undefined;
    }
  }
  next();
});

/** Role-based access control. Use after protect. */
export const authorize =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    return next();
  };

export const adminOnly = [protect, authorize('admin')];
