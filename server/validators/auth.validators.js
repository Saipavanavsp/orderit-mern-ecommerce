import { z } from 'zod';
import { email, password, phone } from './common.js';

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60),
  email,
  password,
  phone: phone.optional().or(z.literal('')),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required').max(72),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordParams = z.object({ token: z.string().regex(/^[a-f\d]{64}$/i, 'Invalid reset token') });
export const resetPasswordSchema = z.object({ password });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: password,
});
