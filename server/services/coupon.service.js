// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { Coupon } from '../models/Coupon.js';
import { ApiError } from '../utils/ApiError.js';
import { formatINR, round2 } from '../utils/format.js';

export function discountFor(coupon, subtotal) {
  if (coupon.discountType === 'flat') return Math.min(coupon.discountValue, subtotal);
  const raw = (subtotal * coupon.discountValue) / 100;
  return round2(coupon.maxDiscount ? Math.min(raw, coupon.maxDiscount) : raw);
}

/** Throws a user-friendly ApiError when the coupon cannot be used; returns { coupon, discount } otherwise. */
export async function validateCoupon(code, userId, subtotal) {
  const coupon = await Coupon.findOne({ code: String(code).toUpperCase().trim() });
  if (!coupon || !coupon.isActive) throw ApiError.badRequest('This coupon code is not valid');
  const now = Date.now();
  if (coupon.startsAt && coupon.startsAt.getTime() > now) throw ApiError.badRequest('This coupon is not active yet');
  if (coupon.expiresAt.getTime() < now) throw ApiError.badRequest('This coupon has expired');
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
    throw ApiError.badRequest('This coupon has reached its usage limit');
  }
  if (coupon.perUserLimit && userId) {
    const uses = coupon.usedBy.filter((u) => String(u) === String(userId)).length;
    if (uses >= coupon.perUserLimit) throw ApiError.badRequest('You have already used this coupon');
  }
  if (subtotal < coupon.minOrderValue) {
    throw ApiError.badRequest(`Add items worth ${formatINR(coupon.minOrderValue - subtotal)} more to use this coupon`);
  }
  return { coupon, discount: discountFor(coupon, subtotal) };
}

/** Atomically records a use; guards against races on the usage limit. */
export async function redeemCoupon(code, userId) {
  const coupon = await Coupon.findOne({ code });
  if (!coupon) return;
  const filter = { _id: coupon._id };
  if (coupon.usageLimit) filter.usedCount = { $lt: coupon.usageLimit };
  const updated = await Coupon.updateOne(filter, { $inc: { usedCount: 1 }, $push: { usedBy: userId } });
  if (!updated.modifiedCount) throw ApiError.badRequest('This coupon has reached its usage limit');
}

export async function releaseCoupon(code, userId) {
  const coupon = await Coupon.findOne({ code });
  if (!coupon) return;
  const idx = coupon.usedBy.findIndex((u) => String(u) === String(userId));
  if (idx >= 0) coupon.usedBy.splice(idx, 1);
  coupon.usedCount = Math.max(0, coupon.usedCount - 1);
  await coupon.save();
}

export async function listAvailable() {
  const now = new Date();
  return Coupon.find({ isActive: true, expiresAt: { $gt: now }, startsAt: { $lte: now } })
    .select('code description discountType discountValue minOrderValue maxDiscount expiresAt')
    .sort({ minOrderValue: 1 })
    .lean();
}

// ---------- Admin ----------
export async function listCoupons({ page, limit, search, status }) {
  const filter = {};
  if (search) filter.code = new RegExp(String(search).replace(/[^A-Z0-9]/gi, ''), 'i');
  if (status === 'active') Object.assign(filter, { isActive: true, expiresAt: { $gt: new Date() } });
  if (status === 'expired') filter.expiresAt = { $lte: new Date() };
  if (status === 'inactive') filter.isActive = false;
  const [items, total] = await Promise.all([
    Coupon.find(filter).select('-usedBy').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Coupon.countDocuments(filter),
  ]);
  return { items: items.map((c) => ({ ...c, isExpired: c.expiresAt < new Date() })), total };
}

export async function createCoupon(data) {
  return Coupon.create(data);
}

export async function updateCoupon(id, data) {
  const coupon = await Coupon.findById(id);
  if (!coupon) throw ApiError.notFound('Coupon not found');
  Object.assign(coupon, data);
  await coupon.save();
  return coupon;
}

export async function deleteCoupon(id) {
  const coupon = await Coupon.findByIdAndDelete(id);
  if (!coupon) throw ApiError.notFound('Coupon not found');
  return { id };
}
