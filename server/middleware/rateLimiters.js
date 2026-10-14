// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const handler = (_req, res, _next, options) =>
  res.status(options.statusCode).json({ success: false, message: options.message });

function limiter({ windowMinutes, max, message }) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    // Tests hit endpoints many times in a few seconds; lockout logic is tested separately.
    limit: env.isTest ? 10_000 : max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message,
    handler,
  });
}

export const apiLimiter = limiter({ windowMinutes: 15, max: 1000, message: 'Too many requests, please slow down.' });
export const loginLimiter = limiter({
  windowMinutes: 15,
  max: 10,
  message: 'Too many login attempts. Please try again in 15 minutes.',
});
export const registerLimiter = limiter({
  windowMinutes: 60,
  max: 10,
  message: 'Too many accounts created from this IP. Please try again later.',
});
export const passwordResetLimiter = limiter({
  windowMinutes: 15,
  max: 5,
  message: 'Too many password reset requests. Please try again later.',
});
export const paymentLimiter = limiter({
  windowMinutes: 15,
  max: 30,
  message: 'Too many payment attempts. Please try again later.',
});
export const aiLimiter = limiter({ windowMinutes: 1, max: 20, message: 'Too many assistant requests. Please wait a moment.' });
