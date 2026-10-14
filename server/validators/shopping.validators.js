import { z } from 'zod';
import { objectId, pagination } from './common.js';

export const productIdParam = z.object({ productId: objectId });

export const addCartItemSchema = z.object({
  productId: objectId,
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1').max(10).default(1),
});

export const updateCartItemSchema = z.object({
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1').max(10, 'Maximum 10 units per item'),
});

export const couponCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3, 'Enter a coupon code')
    .max(20)
    .regex(/^[A-Za-z0-9]+$/, 'Coupon codes contain only letters and numbers')
    .transform((v) => v.toUpperCase()),
});

export const validateCouponSchema = couponCodeSchema.extend({ subtotal: z.coerce.number().min(0) });

const couponFields = {
  code: couponCodeSchema.shape.code,
  description: z.string().trim().max(200),
  discountType: z.enum(['percent', 'flat']),
  discountValue: z.coerce.number().positive(),
  minOrderValue: z.coerce.number().min(0),
  maxDiscount: z.coerce.number().min(0),
  startsAt: z.coerce.date(),
  expiresAt: z.coerce.date(),
  usageLimit: z.coerce.number().int().min(0),
  perUserLimit: z.coerce.number().int().min(0),
  isActive: z.boolean(),
};

export const couponCreateSchema = z
  .object({
    ...couponFields,
    description: couponFields.description.optional().default(''),
    minOrderValue: couponFields.minOrderValue.optional().default(0),
    maxDiscount: couponFields.maxDiscount.optional().default(0),
    startsAt: couponFields.startsAt.optional(),
    usageLimit: couponFields.usageLimit.optional().default(0),
    perUserLimit: couponFields.perUserLimit.optional().default(1),
    isActive: couponFields.isActive.optional().default(true),
  })
  .refine((c) => c.discountType !== 'percent' || c.discountValue <= 90, {
    message: 'Percentage discount cannot exceed 90%',
    path: ['discountValue'],
  })
  .refine((c) => !c.startsAt || c.expiresAt > c.startsAt, {
    message: 'Expiry must be after the start date',
    path: ['expiresAt'],
  });

export const couponUpdateSchema = z
  .object(couponFields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');

export const couponListQuery = z.object({
  ...pagination,
  search: z.string().trim().max(20).optional(),
  status: z.enum(['all', 'active', 'expired', 'inactive']).default('all'),
});

export const reviewCreateSchema = z.object({
  rating: z.coerce.number().int().min(1, 'Rating must be 1-5').max(5, 'Rating must be 1-5'),
  title: z.string().trim().max(120).optional().default(''),
  comment: z.string().trim().min(10, 'Review must be at least 10 characters').max(2000),
});

export const reviewUpdateSchema = z
  .object({
    rating: z.coerce.number().int().min(1).max(5),
    title: z.string().trim().max(120),
    comment: z.string().trim().min(10).max(2000),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');

export const reviewListQuery = z.object({
  ...pagination,
  limit: z.coerce.number().int().min(1).max(50).default(10),
  sort: z.enum(['newest', 'highest', 'lowest']).default('newest'),
});

export const adminReviewListQuery = z.object({
  ...pagination,
  status: z.enum(['all', 'pending', 'approved', 'rejected']).default('all'),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  search: z.string().trim().max(100).optional(),
});

export const reviewStatusSchema = z.object({ status: z.enum(['approved', 'rejected', 'pending']) });
