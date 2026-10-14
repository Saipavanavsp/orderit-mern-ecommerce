// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { env } from '../config/env.js';
import { round2 } from '../utils/format.js';

/** Single source of truth for cart/checkout totals (the client only displays these numbers). */
export function computeTotals(lines, discount = 0) {
  const subtotal = round2(lines.reduce((sum, l) => sum + l.price * l.quantity, 0));
  const appliedDiscount = round2(Math.min(discount, subtotal));
  const taxable = subtotal - appliedDiscount;
  const tax = round2(taxable * env.pricing.taxRate);
  const shipping = subtotal === 0 || taxable >= env.pricing.freeShippingThreshold ? 0 : env.pricing.shippingFee;
  const total = round2(taxable + tax + shipping);
  return {
    subtotal,
    discount: appliedDiscount,
    tax,
    taxRate: env.pricing.taxRate,
    shipping,
    freeShippingThreshold: env.pricing.freeShippingThreshold,
    total,
  };
}
