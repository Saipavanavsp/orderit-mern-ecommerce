import * as authService from '../services/auth.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { clearAuthCookies, cookieNames, setAuthCookies } from '../utils/tokens.js';

const ua = (req) => req.get('user-agent') || '';

export const register = asyncHandler(async (req, res) => {
  const { user, tokens } = await authService.register(req.body, ua(req));
  setAuthCookies(req, res, tokens);
  sendSuccess(res, { user }, { status: 201, message: 'Account created' });
});

export const login = asyncHandler(async (req, res) => {
  const { user, tokens } = await authService.login(req.body, { userAgent: ua(req), app: cookieNames(req).app });
  setAuthCookies(req, res, tokens);
  sendSuccess(res, { user }, { message: 'Logged in' });
});

export const refresh = asyncHandler(async (req, res) => {
  try {
    const { user, tokens } = await authService.refresh(req.cookies?.[cookieNames(req).refresh], ua(req));
    setAuthCookies(req, res, tokens);
    sendSuccess(res, { user }, { message: 'Session refreshed' });
  } catch (err) {
    clearAuthCookies(req, res);
    throw err;
  }
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.cookies?.[cookieNames(req).refresh]);
  clearAuthCookies(req, res);
  sendSuccess(res, null, { message: 'Logged out' });
});

export const me = asyncHandler(async (req, res) => {
  sendSuccess(res, { user: req.user });
});

/**
 * Session bootstrap for page loads: always 200 with { user | null } (guests do not produce 401
 * console errors). If the access token expired but the refresh cookie is valid, the session is
 * refreshed (rotated) in the same request.
 */
export const session = asyncHandler(async (req, res) => {
  const names = cookieNames(req);
  if (req.user) return sendSuccess(res, { user: names.app === 'admin' && req.user.role !== 'admin' ? null : req.user });
  const refreshToken = req.cookies?.[names.refresh];
  if (!refreshToken) return sendSuccess(res, { user: null });
  try {
    const { user, tokens } = await authService.refresh(refreshToken, ua(req));
    if (names.app === 'admin' && user.role !== 'admin') {
      clearAuthCookies(req, res);
      return sendSuccess(res, { user: null });
    }
    setAuthCookies(req, res, tokens);
    return sendSuccess(res, { user });
  } catch {
    clearAuthCookies(req, res);
    return sendSuccess(res, { user: null });
  }
});

export const forgotPassword = asyncHandler(async (req, res) => {
  await authService.forgotPassword(req.body.email);
  sendSuccess(res, null, { message: 'If an account exists for this email, a reset link has been sent.' });
});

export const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.params.token, req.body.password);
  clearAuthCookies(req, res);
  sendSuccess(res, null, { message: 'Password updated. Please log in with your new password.' });
});

export const changePassword = asyncHandler(async (req, res) => {
  const tokens = await authService.changePassword(
    req.user._id,
    req.body.currentPassword,
    req.body.newPassword,
    ua(req),
  );
  setAuthCookies(req, res, tokens);
  sendSuccess(res, null, { message: 'Password changed successfully' });
});
