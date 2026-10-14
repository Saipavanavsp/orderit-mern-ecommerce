// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { z } from 'zod';
import { objectId, pagination, phone } from './common.js';

export const shippingAddressSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required').max(80),
  phone,
  line1: z.string().trim().min(3, 'Address line 1 is required').max(120),
  line2: z.string().trim().max(120).optional().default(''),
  city: z.string().trim().min(2, 'City is required').max(60),
  state: z.string().trim().min(2, 'State is required').max(60),
  postalCode: z.string().trim().regex(/^\d{6}$/, 'Enter a valid 6-digit PIN code'),
  country: z.string().trim().max(60).optional().default('India'),
});

export const createOrderSchema = z
  .object({
    addressId: objectId.optional(),
    shippingAddress: shippingAddressSchema.optional(),
    saveAddress: z.boolean().optional().default(false),
    paymentMethod: z.enum(['razorpay', 'cod'], { message: 'Choose a payment method' }),
  })
  .refine((v) => v.addressId || v.shippingAddress, {
    message: 'Provide a shipping address',
    path: ['shippingAddress'],
  });

export const payOrderSchema = z.object({
  razorpayOrderId: z.string().trim().min(5).max(100),
  razorpayPaymentId: z.string().trim().min(5).max(100),
  razorpaySignature: z.string().trim().regex(/^[a-f0-9]{64}$/i, 'Invalid signature'),
});

export const cancelOrderSchema = z.object({ reason: z.string().trim().max(300).optional().default('') });

export const myOrdersQuery = z.object({
  ...pagination,
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(['all', 'pending', 'processing', 'shipped', 'delivered', 'cancelled']).default('all'),
});

export const createPaymentSchema = z.object({ orderId: objectId });

export const simulatePaymentSchema = z.object({
  orderId: objectId,
  providerOrderId: z.string().trim().min(5).max(100),
  outcome: z.enum(['success', 'failure']).default('success'),
});

export const adminOrderListQuery = z.object({
  ...pagination,
  status: z.enum(['all', 'pending', 'processing', 'shipped', 'delivered', 'cancelled']).default('all'),
  paymentStatus: z.enum(['all', 'pending', 'paid', 'failed', 'refunded']).default('all'),
  paymentMethod: z.enum(['razorpay', 'cod']).optional(),
  search: z.string().trim().max(100).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const orderStatusSchema = z.object({
  status: z.enum(['processing', 'shipped', 'delivered', 'cancelled']),
  note: z.string().trim().max(300).optional().default(''),
  trackingNumber: z.string().trim().max(60).optional(),
});
