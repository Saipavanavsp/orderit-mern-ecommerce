// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { Router } from 'express';
import * as ctrl from '../controllers/auth.controller.js';
import { optionalAuth, protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { loginLimiter, passwordResetLimiter, registerLimiter } from '../middleware/rateLimiters.js';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordParams,
  resetPasswordSchema,
} from '../validators/auth.validators.js';

const router = Router();

router.post('/register', registerLimiter, validate({ body: registerSchema }), ctrl.register);
router.post('/login', loginLimiter, validate({ body: loginSchema }), ctrl.login);
router.post('/refresh', ctrl.refresh);
router.post('/logout', ctrl.logout);
router.get('/me', protect, ctrl.me);
router.get('/session', optionalAuth, ctrl.session);
router.post('/forgot-password', passwordResetLimiter, validate({ body: forgotPasswordSchema }), ctrl.forgotPassword);
router.post(
  '/reset-password/:token',
  passwordResetLimiter,
  validate({ params: resetPasswordParams, body: resetPasswordSchema }),
  ctrl.resetPassword,
);
router.put('/change-password', protect, validate({ body: changePasswordSchema }), ctrl.changePassword);

export default router;
