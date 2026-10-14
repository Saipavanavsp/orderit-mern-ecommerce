// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import {
  durationToMs,
  randomToken,
  sha256,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/tokens.js';
import { sendPasswordResetEmail, sendWelcomeEmail } from './email.service.js';
import { notify } from './notification.service.js';

const MAX_SESSIONS = 5;
export const REFRESH_GRACE_MS = 20_000;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

async function issueTokens(user, userAgent = '') {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  const now = Date.now();
  const sessions = (user.refreshTokens || []).filter((t) => t.expiresAt.getTime() > now);
  sessions.push({
    hash: sha256(refreshToken),
    expiresAt: new Date(now + durationToMs(env.jwt.refreshExpires)),
    userAgent: userAgent.slice(0, 200),
  });
  // Tokens in their post-rotation grace window don't count towards the session cap.
  user.refreshTokens = [...sessions.filter((t) => t.replacedAt), ...sessions.filter((t) => !t.replacedAt).slice(-MAX_SESSIONS)];
  await user.save({ validateModifiedOnly: true });
  return { accessToken, refreshToken };
}

export async function register({ name, email, password, phone }, userAgent) {
  const exists = await User.exists({ email: email.toLowerCase() });
  if (exists) throw ApiError.conflict('An account with this email already exists');
  const user = await User.create({ name, email, password, phone });
  const fresh = await User.findById(user._id).select('+refreshTokens');
  const tokens = await issueTokens(fresh, userAgent);
  sendWelcomeEmail(user);
  notify(user._id, { type: 'account', title: 'Welcome to OrderIt', message: 'Your account has been created.' });
  return { user: fresh, tokens };
}

export async function login({ email, password }, { userAgent, app }) {
  const user = await User.findOne({ email: email.toLowerCase() }).select(
    '+password +failedLoginAttempts +lockUntil +refreshTokens',
  );
  const invalid = ApiError.unauthorized('Invalid email or password');
  if (!user) throw invalid;

  if (user.isLocked) {
    const minutes = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
    throw ApiError.locked(`Account locked after repeated failed logins. Try again in ${minutes} minute(s).`);
  }

  const ok = await user.comparePassword(password);
  if (!ok) {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    if (user.failedLoginAttempts >= env.security.maxLoginAttempts) {
      user.lockUntil = new Date(Date.now() + env.security.lockTimeMs);
      user.failedLoginAttempts = 0;
      await user.save({ validateModifiedOnly: true });
      throw ApiError.locked(
        `Too many failed attempts. Account locked for ${Math.round(env.security.lockTimeMs / 60000)} minutes.`,
      );
    }
    await user.save({ validateModifiedOnly: true });
    throw invalid;
  }

  if (!user.isActive) throw ApiError.forbidden('Your account has been deactivated. Please contact support.');
  if (app === 'admin' && user.role !== 'admin') throw ApiError.forbidden('Admin access only');

  user.failedLoginAttempts = 0;
  user.lockUntil = undefined;
  user.lastLoginAt = new Date();
  const tokens = await issueTokens(user, userAgent);
  return { user, tokens };
}

export async function refresh(refreshToken, userAgent) {
  if (!refreshToken) throw ApiError.unauthorized('No refresh token');
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized('Session expired. Please log in again.');
  }
  const user = await User.findById(payload.sub).select('+refreshTokens');
  if (!user || !user.isActive) throw ApiError.unauthorized('Session expired. Please log in again.');

  const hash = sha256(refreshToken);
  const entry = user.refreshTokens.find((t) => t.hash === hash);
  const inGrace = entry?.replacedAt && Date.now() - entry.replacedAt.getTime() < REFRESH_GRACE_MS;
  if (!entry || (entry.replacedAt && !inGrace)) {
    // A valid but already-rotated token was replayed after the grace window: treat it as theft
    // and revoke every session.
    user.refreshTokens = [];
    await user.save({ validateModifiedOnly: true });
    throw ApiError.unauthorized('Session is no longer valid. Please log in again.');
  }
  // Keep the old token briefly so parallel refreshes (two tabs, React StrictMode) don't log the user out.
  if (!entry.replacedAt) entry.replacedAt = new Date();
  user.refreshTokens = user.refreshTokens.filter((t) => !t.replacedAt || Date.now() - t.replacedAt.getTime() < REFRESH_GRACE_MS);
  const tokens = await issueTokens(user, userAgent);
  return { user, tokens };
}

export async function logout(refreshToken) {
  if (!refreshToken) return;
  try {
    const payload = verifyRefreshToken(refreshToken);
    await User.updateOne({ _id: payload.sub }, { $pull: { refreshTokens: { hash: sha256(refreshToken) } } });
  } catch {
    // Expired/invalid token: nothing to revoke.
  }
}

export async function forgotPassword(email) {
  const user = await User.findOne({ email: email.toLowerCase(), isActive: true });
  // Same response whether or not the account exists (prevents user enumeration).
  if (!user) return;
  const token = randomToken(32);
  user.passwordResetToken = sha256(token);
  user.passwordResetExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await user.save({ validateModifiedOnly: true });
  await sendPasswordResetEmail(user, `${env.clientUrl}/reset-password/${token}`);
}

export async function resetPassword(token, password) {
  const user = await User.findOne({
    passwordResetToken: sha256(token),
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordResetToken +passwordResetExpires +refreshTokens');
  if (!user) throw ApiError.badRequest('Reset link is invalid or has expired');
  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.refreshTokens = []; // sign out everywhere
  user.failedLoginAttempts = 0;
  user.lockUntil = undefined;
  await user.save();
  notify(user._id, { type: 'account', title: 'Password reset', message: 'Your password was reset successfully.' });
}

export async function changePassword(userId, currentPassword, newPassword, userAgent) {
  const user = await User.findById(userId).select('+password +refreshTokens');
  if (!user) throw ApiError.notFound('User not found');
  if (!(await user.comparePassword(currentPassword))) throw ApiError.badRequest('Current password is incorrect');
  if (currentPassword === newPassword) throw ApiError.badRequest('New password must differ from the current one');
  user.password = newPassword;
  user.refreshTokens = [];
  await user.save();
  notify(user._id, { type: 'account', title: 'Password changed', message: 'Your password was changed.' });
  return issueTokens(user, userAgent); // keep the current device signed in
}
