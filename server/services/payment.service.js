// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { env } from '../config/env.js';
import { Order } from '../models/Order.js';
import { Payment } from '../models/Payment.js';
import { ApiError } from '../utils/ApiError.js';
import { randomToken } from '../utils/tokens.js';
import { markOrderPaid } from './order.service.js';

let razorpay;
const getRazorpay = () => {
  if (!razorpay) razorpay = new Razorpay({ key_id: env.razorpay.keyId, key_secret: env.razorpay.keySecret });
  return razorpay;
};

export const paymentMode = () => (env.razorpay.enabled ? 'razorpay' : 'simulation');

/** Razorpay signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export function computeSignature(providerOrderId, paymentId, secret) {
  return crypto.createHmac('sha256', secret).update(`${providerOrderId}|${paymentId}`).digest('hex');
}

export function verifySignature(providerOrderId, paymentId, signature, secret) {
  const expected = Buffer.from(computeSignature(providerOrderId, paymentId, secret), 'hex');
  const given = Buffer.from(String(signature || ''), 'hex');
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

const secretFor = (provider) => (provider === 'razorpay' ? env.razorpay.keySecret : env.razorpay.simulationSecret);

async function loadPayableOrder(userId, orderId) {
  const order = await Order.findOne({ _id: orderId, user: userId }).populate({ path: 'user', select: 'name email phone' });
  if (!order) throw ApiError.notFound('Order not found');
  if (order.paymentMethod !== 'razorpay') throw ApiError.badRequest('This order is not an online payment order');
  if (order.isPaid) throw ApiError.badRequest('This order is already paid');
  if (order.status === 'cancelled') throw ApiError.badRequest('This order was cancelled');
  return order;
}

export function getConfig() {
  return { mode: paymentMode(), keyId: env.razorpay.enabled ? env.razorpay.keyId : '', currency: 'INR' };
}

/** Step 1: create a provider order for the amount stored on our order (never trust client amounts). */
export async function createPaymentOrder(userId, orderId) {
  const order = await loadPayableOrder(userId, orderId);
  const amountPaise = Math.round(order.totalPrice * 100);
  const provider = paymentMode();
  let providerOrderId;
  if (provider === 'razorpay') {
    try {
      const rzpOrder = await getRazorpay().orders.create({
        amount: amountPaise,
        currency: 'INR',
        receipt: order.orderNumber,
        notes: { orderId: String(order._id) },
      });
      providerOrderId = rzpOrder.id;
    } catch (err) {
      throw new ApiError(502, `Payment gateway error: ${err?.error?.description || err.message}`);
    }
  } else {
    providerOrderId = `sim_order_${randomToken(8)}`;
  }
  await Payment.create({ order: order._id, user: userId, provider, providerOrderId, amount: order.totalPrice });
  return {
    mode: provider,
    keyId: provider === 'razorpay' ? env.razorpay.keyId : '',
    providerOrderId,
    amount: amountPaise,
    currency: 'INR',
    orderNumber: order.orderNumber,
    prefill: { name: order.user.name, email: order.user.email, contact: order.user.phone || '' },
  };
}

/** Simulation-only: plays the role of the Razorpay checkout widget and returns a signed result. */
export async function simulatePayment(userId, { orderId, providerOrderId, outcome }) {
  if (paymentMode() !== 'simulation') throw ApiError.badRequest('Simulation is disabled when Razorpay keys are set');
  await loadPayableOrder(userId, orderId);
  const payment = await Payment.findOne({ order: orderId, user: userId, providerOrderId, provider: 'simulation' });
  if (!payment) throw ApiError.notFound('Payment session not found. Start the payment again.');
  if (outcome === 'failure') {
    payment.status = 'failed';
    payment.failureReason = 'Simulated failure (card declined)';
    await payment.save();
    return { status: 'failed', reason: payment.failureReason };
  }
  const paymentId = `sim_pay_${randomToken(8)}`;
  return {
    status: 'authorized',
    razorpayOrderId: providerOrderId,
    razorpayPaymentId: paymentId,
    razorpaySignature: computeSignature(providerOrderId, paymentId, env.razorpay.simulationSecret),
  };
}

/** Step 2 (PUT /orders/:id/pay): verify the signature server-side, then mark the order paid. */
export async function verifyAndPay(userId, orderId, { razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  const order = await loadPayableOrder(userId, orderId);
  const payment = await Payment.findOne({ order: order._id, providerOrderId: razorpayOrderId });
  if (!payment) throw ApiError.badRequest('Unknown payment session');
  if (!verifySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature, secretFor(payment.provider))) {
    payment.status = 'failed';
    payment.failureReason = 'Signature verification failed';
    await payment.save();
    throw ApiError.badRequest('Payment verification failed');
  }
  payment.status = 'paid';
  payment.providerPaymentId = razorpayPaymentId;
  await payment.save();
  try {
    return await markOrderPaid(order, {
      provider: payment.provider,
      providerOrderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
    });
  } catch (err) {
    payment.status = 'refunded';
    payment.failureReason = err.message;
    await payment.save();
    throw err;
  }
}

export async function listPaymentsForOrder(orderId) {
  return Payment.find({ order: orderId }).sort({ createdAt: -1 }).lean();
}
