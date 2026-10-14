// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { z } from 'zod';
import { objectId } from './common.js';

export const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(1000),
      }),
    )
    .min(1)
    .max(20)
    .transform((m) => m.slice(-10))
    .refine((m) => m[m.length - 1].role === 'user', 'The last message must be from the user'),
  productSlug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/)
    .max(140)
    .optional(),
});

export const nlSearchQuery = z.object({
  q: z.string().trim().min(2, 'Type at least 2 characters').max(200),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12),
});

export const productIdParam = z.object({ productId: objectId });
export const recommendQuery = z.object({ limit: z.coerce.number().int().min(1).max(20).default(8) });
