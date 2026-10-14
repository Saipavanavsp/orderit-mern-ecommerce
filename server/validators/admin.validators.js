import { z } from 'zod';
import { pagination } from './common.js';

export const userListQuery = z.object({
  ...pagination,
  search: z.string().trim().max(100).optional(),
  role: z.enum(['all', 'customer', 'admin']).default('all'),
  status: z.enum(['all', 'active', 'inactive']).default('all'),
});

export const userStatusSchema = z.object({ isActive: z.boolean() });
export const userRoleSchema = z.object({ role: z.enum(['customer', 'admin']) });

export const salesQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  groupBy: z.enum(['day', 'month']).default('day'),
});

export const topProductsQuery = z.object({ limit: z.coerce.number().int().min(1).max(50).default(10) });

export const lowStockQuery = z.object({ threshold: z.coerce.number().int().min(0).max(1000).optional() });

export const exportOrdersQuery = z.object({
  status: z.enum(['all', 'pending', 'processing', 'shipped', 'delivered', 'cancelled']).default('all'),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
