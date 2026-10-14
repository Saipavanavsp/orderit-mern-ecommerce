// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import crypto from 'node:crypto';
import { Order } from '../models/Order.js';
import { User } from '../models/User.js';
import { Cart } from '../models/Cart.js';
import { Payment } from '../models/Payment.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex, formatINR } from '../utils/format.js';
import { buildCartView } from './cart.service.js';
import { computeTotals } from './pricing.service.js';
import { redeemCoupon, releaseCoupon, validateCoupon } from './coupon.service.js';
import { assertAvailable, releaseStock, reserveStock } from './inventory.service.js';
import { sendOrderConfirmationEmail, sendOrderStatusEmail } from './email.service.js';
import { notify } from './notification.service.js';

// Allowed admin transitions. delivered and cancelled are final.
export const TRANSITIONS = {
  pending: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

function generateOrderNumber() {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `OI${ymd}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function resolveAddress(user, { addressId, shippingAddress }) {
  if (addressId) {
    const saved = user.addresses.id(addressId);
    if (!saved) throw ApiError.badRequest('Selected address not found');
    const { fullName, phone, line1, line2, city, state, postalCode, country } = saved;
    return { fullName, phone, line1, line2, city, state, postalCode, country };
  }
  return shippingAddress;
}

export async function createOrder(userId, input) {
  const user = await User.findById(userId);
  const cart = await Cart.findOne({ user: userId });
  if (!cart || !cart.items.length) throw ApiError.badRequest('Your cart is empty');
  const view = await buildCartView(cart, userId);
  if (view.hasUnavailableItems) {
    throw ApiError.badRequest('Some items in your cart are unavailable. Please review your cart.');
  }

  const items = view.items.map((i) => ({
    product: i.product._id,
    name: i.product.name,
    slug: i.product.slug,
    image: i.product.image,
    brand: i.product.brand,
    price: i.price,
    quantity: i.quantity,
  }));
  await assertAvailable(items);

  let discount = 0;
  let couponCode = '';
  if (cart.couponCode) {
    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    ({ discount } = await validateCoupon(cart.couponCode, userId, subtotal)); // re-validated server side
    couponCode = cart.couponCode;
  }
  const totals = computeTotals(items, discount);
  const shippingAddress = resolveAddress(user, input);

  if (input.saveAddress && input.shippingAddress && user.addresses.length < 10) {
    user.addresses.push({ ...input.shippingAddress, isDefault: user.addresses.length === 0 });
    await user.save();
  }

  const isCod = input.paymentMethod === 'cod';
  if (isCod) await reserveStock(items); // COD orders are confirmed immediately
  if (couponCode) {
    try {
      await redeemCoupon(couponCode, userId);
    } catch (err) {
      if (isCod) await releaseStock(items);
      throw err;
    }
  }

  let order;
  for (let attempt = 0; attempt < 3 && !order; attempt += 1) {
    try {
      order = await Order.create({
        orderNumber: generateOrderNumber(),
        user: userId,
        items,
        shippingAddress,
        paymentMethod: input.paymentMethod,
        itemsPrice: totals.subtotal,
        discount: totals.discount,
        couponCode,
        taxPrice: totals.tax,
        shippingPrice: totals.shipping,
        totalPrice: totals.total,
        status: isCod ? 'processing' : 'pending',
        statusHistory: [
          { status: 'pending', note: 'Order placed' },
          ...(isCod ? [{ status: 'processing', note: 'Cash on delivery order confirmed' }] : []),
        ],
        inventoryReserved: isCod,
        paymentResult: { provider: isCod ? 'cod' : '' },
      });
    } catch (err) {
      if (err?.code !== 11000 || attempt === 2) {
        if (isCod) await releaseStock(items);
        if (couponCode) await releaseCoupon(couponCode, userId);
        throw err;
      }
    }
  }

  cart.items = [];
  cart.couponCode = '';
  await cart.save();

  if (isCod) {
    await Payment.create({ order: order._id, user: userId, provider: 'cod', amount: order.totalPrice, status: 'created' });
    sendOrderConfirmationEmail(user, order);
  }
  notify(userId, {
    type: 'order',
    title: `Order ${order.orderNumber} placed`,
    message: isCod
      ? `Your order of ${formatINR(order.totalPrice)} is confirmed. Pay on delivery.`
      : `Complete the payment of ${formatINR(order.totalPrice)} to confirm your order.`,
    link: `/orders/${order._id}`,
  });
  return order;
}

/** Called after a verified online payment. */
export async function markOrderPaid(order, { provider, providerOrderId, paymentId }) {
  const user = await User.findById(order.user);
  try {
    await reserveStock(order.items);
  } catch (err) {
    // Payment captured but stock vanished: cancel and refund (simulated) instead of overselling.
    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancelReason = 'Item went out of stock before payment completed';
    order.paymentStatus = 'refunded';
    order.isPaid = false;
    order.statusHistory.push({ status: 'cancelled', note: `${err.message}. Payment will be refunded.` });
    await order.save();
    if (order.couponCode) await releaseCoupon(order.couponCode, order.user);
    notify(order.user, { type: 'payment', title: 'Order cancelled', message: `${err.message}. Your payment will be refunded.`, link: `/orders/${order._id}` });
    throw err;
  }
  order.isPaid = true;
  order.paidAt = new Date();
  order.paymentStatus = 'paid';
  order.inventoryReserved = true;
  order.status = 'processing';
  order.statusHistory.push({ status: 'processing', note: `Payment received via ${provider}` });
  order.paymentResult = { provider, providerOrderId, paymentId };
  await order.save();
  sendOrderConfirmationEmail(user, order);
  notify(order.user, {
    type: 'payment',
    title: 'Payment successful',
    message: `We received ${formatINR(order.totalPrice)} for order ${order.orderNumber}.`,
    link: `/orders/${order._id}`,
  });
  return order;
}

async function applyCancellation(order, { reason, by }) {
  if (order.inventoryReserved) {
    await releaseStock(order.items);
    order.inventoryReserved = false;
  }
  if (order.couponCode) await releaseCoupon(order.couponCode, order.user);
  if (order.isPaid) order.paymentStatus = 'refunded';
  else if (order.paymentStatus === 'pending') order.paymentStatus = 'failed';
  order.status = 'cancelled';
  order.cancelledAt = new Date();
  order.cancelReason = reason || '';
  order.statusHistory.push({ status: 'cancelled', note: reason || 'Order cancelled', by });
  await Payment.updateMany(
    { order: order._id, status: { $in: ['created', 'paid'] } },
    { status: order.isPaid ? 'refunded' : 'failed' },
  );
}

export async function cancelMyOrder(userId, orderId, reason) {
  const order = await Order.findOne({ _id: orderId, user: userId });
  if (!order) throw ApiError.notFound('Order not found');
  if (!order.isCancellable) throw ApiError.badRequest(`Orders that are ${order.status} cannot be cancelled`);
  await applyCancellation(order, { reason: reason || 'Cancelled by customer', by: userId });
  await order.save();
  notify(userId, { type: 'order', title: 'Order cancelled', message: `Order ${order.orderNumber} was cancelled.`, link: `/orders/${order._id}` });
  return order;
}

export async function listMyOrders(userId, { page, limit, status }) {
  const filter = { user: userId };
  if (status && status !== 'all') filter.status = status;
  const [items, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Order.countDocuments(filter),
  ]);
  return { items, total };
}

export async function getOrder(orderId, { userId, isAdmin }) {
  const filter = { _id: orderId };
  if (!isAdmin) filter.user = userId;
  const order = await Order.findOne(filter).populate({ path: 'user', select: 'name email phone' });
  if (!order) throw ApiError.notFound('Order not found');
  return order;
}

// ---------- Admin ----------
export async function adminListOrders({ page, limit, status, paymentStatus, paymentMethod, search, from, to }) {
  const filter = {};
  if (status && status !== 'all') filter.status = status;
  if (paymentStatus && paymentStatus !== 'all') filter.paymentStatus = paymentStatus;
  if (paymentMethod) filter.paymentMethod = paymentMethod;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = from;
    if (to) filter.createdAt.$lte = to;
  }
  if (search) {
    const re = new RegExp(escapeRegex(search), 'i');
    const users = await User.find({ $or: [{ email: re }, { name: re }] }).select('_id').lean();
    filter.$or = [{ orderNumber: re }, { user: { $in: users.map((u) => u._id) } }];
  }
  const [items, total, statusCounts] = await Promise.all([
    Order.find(filter)
      .populate({ path: 'user', select: 'name email' })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
    Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);
  return { items, total, statusCounts: Object.fromEntries(statusCounts.map((s) => [s._id, s.count])) };
}

export async function adminUpdateStatus(orderId, { status, note, trackingNumber }, adminId) {
  const order = await Order.findById(orderId);
  if (!order) throw ApiError.notFound('Order not found');
  if (!TRANSITIONS[order.status].includes(status)) {
    throw ApiError.badRequest(`Cannot change status from ${order.status} to ${status}`);
  }
  if (status === 'processing' && order.paymentMethod === 'razorpay' && !order.isPaid) {
    throw ApiError.badRequest('Online orders can be processed only after payment');
  }

  if (status === 'cancelled') {
    await applyCancellation(order, { reason: note || 'Cancelled by store', by: adminId });
  } else {
    order.status = status;
    order.statusHistory.push({ status, note: note || '', by: adminId });
    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (status === 'delivered') {
      order.deliveredAt = new Date();
      if (order.paymentMethod === 'cod' && !order.isPaid) {
        order.isPaid = true;
        order.paidAt = new Date();
        order.paymentStatus = 'paid';
        await Payment.updateMany({ order: order._id, provider: 'cod' }, { status: 'paid' });
      }
    }
  }
  await order.save();

  const user = await User.findById(order.user);
  if (user) sendOrderStatusEmail(user, order);
  notify(order.user, {
    type: 'order',
    title: `Order ${order.status}`,
    message: `Your order ${order.orderNumber} is now ${order.status}.`,
    link: `/orders/${order._id}`,
  });
  return order;
}
