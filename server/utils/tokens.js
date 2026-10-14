// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const DURATION = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

export function durationToMs(value) {
  const match = String(value).match(/^(\d+)([smhd])$/);
  if (!match) return Number(value) * 1000;
  return Number(match[1]) * DURATION[match[2]];
}

export const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

export function signAccessToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpires,
  });
}

export function signRefreshToken(user) {
  return jwt.sign({ sub: String(user._id), jti: randomToken(16) }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpires,
  });
}

export const verifyAccessToken = (token) => jwt.verify(token, env.jwt.accessSecret);
export const verifyRefreshToken = (token) => jwt.verify(token, env.jwt.refreshSecret);

/**
 * The customer store and admin dashboard both talk to the same API host, so browsers would share
 * cookies between them. The admin app sends "X-Client-App: admin" and gets separately named cookies.
 */
export function cookieNames(req) {
  const isAdminApp = req.get('x-client-app') === 'admin';
  return isAdminApp
    ? { access: 'oi_admin_access', refresh: 'oi_admin_refresh', app: 'admin' }
    : { access: 'oi_access', refresh: 'oi_refresh', app: 'client' };
}

function baseCookie() {
  return {
    httpOnly: true,
    secure: env.cookie.secure,
    sameSite: env.cookie.sameSite,
    domain: env.cookie.domain,
  };
}

export function setAuthCookies(req, res, { accessToken, refreshToken }) {
  const names = cookieNames(req);
  res.cookie(names.access, accessToken, {
    ...baseCookie(),
    path: '/',
    maxAge: durationToMs(env.jwt.accessExpires),
  });
  res.cookie(names.refresh, refreshToken, {
    ...baseCookie(),
    path: `${env.apiPrefix}/auth`,
    maxAge: durationToMs(env.jwt.refreshExpires),
  });
}

export function clearAuthCookies(req, res) {
  const names = cookieNames(req);
  res.clearCookie(names.access, { ...baseCookie(), path: '/' });
  res.clearCookie(names.refresh, { ...baseCookie(), path: `${env.apiPrefix}/auth` });
}
