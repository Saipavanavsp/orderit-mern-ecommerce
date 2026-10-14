// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import * as orderService from '../services/order.service.js';
import * as paymentService from '../services/payment.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { paginationMeta, sendSuccess } from '../utils/response.js';

export const createOrder = asyncHandler(async (req, res) => {
  const order = await orderService.createOrder(req.user._id, req.body);
  sendSuccess(res, { order }, { status: 201, message: 'Order placed' });
});

export const myOrders = asyncHandler(async (req, res) => {
  const { items, total } = await orderService.listMyOrders(req.user._id, req.query);
  sendSuccess(res, { orders: items }, { meta: paginationMeta(req.query.page, req.query.limit, total) });
});

export const getOrder = asyncHandler(async (req, res) => {
  const order = await orderService.getOrder(req.params.id, {
    userId: req.user._id,
    isAdmin: req.user.role === 'admin',
  });
  sendSuccess(res, { order });
});

export const payOrder = asyncHandler(async (req, res) => {
  const order = await paymentService.verifyAndPay(req.user._id, req.params.id, req.body);
  sendSuccess(res, { order }, { message: 'Payment successful' });
});

export const cancelOrder = asyncHandler(async (req, res) => {
  const order = await orderService.cancelMyOrder(req.user._id, req.params.id, req.body.reason);
  sendSuccess(res, { order }, { message: 'Order cancelled' });
});

export const paymentConfig = asyncHandler(async (_req, res) => sendSuccess(res, paymentService.getConfig()));

export const createPayment = asyncHandler(async (req, res) => {
  const data = await paymentService.createPaymentOrder(req.user._id, req.body.orderId);
  sendSuccess(res, data, { status: 201 });
});

export const simulatePayment = asyncHandler(async (req, res) => {
  sendSuccess(res, await paymentService.simulatePayment(req.user._id, req.body));
});

// ----- Admin -----
export const adminListOrders = asyncHandler(async (req, res) => {
  const { items, total, statusCounts } = await orderService.adminListOrders(req.query);
  sendSuccess(res, { orders: items, statusCounts }, { meta: paginationMeta(req.query.page, req.query.limit, total) });
});

export const adminGetOrder = asyncHandler(async (req, res) => {
  const order = await orderService.getOrder(req.params.id, { isAdmin: true });
  const payments = await paymentService.listPaymentsForOrder(order._id);
  sendSuccess(res, { order, payments });
});

export const adminUpdateStatus = asyncHandler(async (req, res) => {
  const order = await orderService.adminUpdateStatus(req.params.id, req.body, req.user._id);
  sendSuccess(res, { order }, { message: `Order marked ${order.status}` });
});
