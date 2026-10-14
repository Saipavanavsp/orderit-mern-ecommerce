import request from 'supertest';
import { app, API, closeTestDb, connectTestDb, createCatalog, createUserAgent } from './helpers/setup.js';
import { Product } from '../models/Product.js';
import { Coupon } from '../models/Coupon.js';
import { Payment } from '../models/Payment.js';
import { Notification } from '../models/Notification.js';
import { getOutbox } from '../services/email.service.js';

let catalog;
const address = {
  fullName: 'Arjun Mehta',
  phone: '9876543210',
  line1: '221B Residency Road',
  city: 'Bengaluru',
  state: 'Karnataka',
  postalCode: '560025',
};
const stockOf = async (id) => (await Product.findById(id)).stock;

beforeAll(async () => {
  await connectTestDb('orders');
  catalog = await createCatalog();
  await Coupon.create({
    code: 'SAVE5', discountType: 'percent', discountValue: 5, expiresAt: new Date(Date.now() + 86_400_000), perUserLimit: 1,
  });
});
afterAll(() => closeTestDb());

async function fillCart(agent, product, quantity = 1) {
  const res = await agent.post(`${API}/cart/items`).send({ productId: String(product._id), quantity });
  expect(res.status).toBe(201);
}

async function payOnline(agent, orderId, outcome = 'success') {
  const pay = await agent.post(`${API}/payments/create-order`).send({ orderId });
  expect(pay.status).toBe(201);
  expect(pay.body.data.mode).toBe('simulation');
  const sim = await agent
    .post(`${API}/payments/simulate`)
    .send({ orderId, providerOrderId: pay.body.data.providerOrderId, outcome });
  return { pay: pay.body.data, sim: sim.body.data };
}

describe('Checkout validation', () => {
  test('requires login, a non-empty cart and an address', async () => {
    expect((await request(app).post(`${API}/orders`).send({})).status).toBe(401);
    const { agent } = await createUserAgent();
    const empty = await agent.post(`${API}/orders`).send({ shippingAddress: address, paymentMethod: 'cod' });
    expect(empty.status).toBe(400);
    expect(empty.body.message).toMatch(/cart is empty/);
    const noAddr = await agent.post(`${API}/orders`).send({ paymentMethod: 'cod' });
    expect(noAddr.status).toBe(400);
    const badPin = await agent.post(`${API}/orders`).send({ shippingAddress: { ...address, postalCode: '12' }, paymentMethod: 'cod' });
    expect(badPin.body.errors[0].field).toBe('shippingAddress.postalCode');
  });
});

describe('Online payment flow (Razorpay simulation)', () => {
  let agent;
  let orderId;
  const jeans = () => catalog.products[3];

  test('creates a pending order from the cart with coupon and server-side totals', async () => {
    ({ agent } = await createUserAgent());
    await fillCart(agent, jeans(), 2);
    await agent.post(`${API}/cart/coupon`).send({ code: 'SAVE5' });
    const res = await agent.post(`${API}/orders`).send({ shippingAddress: address, paymentMethod: 'razorpay', saveAddress: true });
    expect(res.status).toBe(201);
    const { order } = res.body.data;
    orderId = order._id;
    expect(order.status).toBe('pending');
    expect(order.paymentStatus).toBe('pending');
    expect(order.itemsPrice).toBe(4998);
    expect(order.discount).toBeCloseTo(249.9, 1);
    expect(order.totalPrice).toBeCloseTo((4998 - 249.9) * 1.18, 1);
    expect(order.orderNumber).toMatch(/^OI\d{6}[A-F0-9]{6}$/);
    // cart cleared, address saved, stock untouched until payment
    expect((await agent.get(`${API}/cart`)).body.data.cart.items).toHaveLength(0);
    expect((await agent.get(`${API}/users/me`)).body.data.user.addresses).toHaveLength(1);
    expect(await stockOf(jeans()._id)).toBe(40);
  });

  test('rejects a forged payment signature', async () => {
    const { pay } = await payOnline(agent, orderId);
    const res = await agent.put(`${API}/orders/${orderId}/pay`).send({
      razorpayOrderId: pay.providerOrderId,
      razorpayPaymentId: 'pay_forged123',
      razorpaySignature: 'a'.repeat(64),
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Payment verification failed');
    expect(await stockOf(jeans()._id)).toBe(40);
  });

  test('verifies a valid signature, marks paid and decrements inventory', async () => {
    const { sim } = await payOnline(agent, orderId);
    expect(sim.status).toBe('authorized');
    const res = await agent.put(`${API}/orders/${orderId}/pay`).send(sim);
    expect(res.status).toBe(200);
    const { order } = res.body.data;
    expect(order.isPaid).toBe(true);
    expect(order.paymentStatus).toBe('paid');
    expect(order.status).toBe('processing');
    expect(await stockOf(jeans()._id)).toBe(38);
    expect((await Product.findById(jeans()._id)).soldCount).toBe(2);
    expect(await Payment.countDocuments({ order: orderId, status: 'paid' })).toBe(1);
    expect(getOutbox().some((m) => m.subject.includes(order.orderNumber))).toBe(true);
    expect(await Notification.countDocuments({ user: order.user, type: 'payment' })).toBe(1);
  });

  test('cannot pay twice', async () => {
    const again = await agent.post(`${API}/payments/create-order`).send({ orderId });
    expect(again.status).toBe(400);
  });

  test('coupon is single-use per user', async () => {
    await fillCart(agent, jeans(), 1);
    const res = await agent.post(`${API}/cart/coupon`).send({ code: 'SAVE5' });
    expect(res.body.message).toMatch(/already used/);
  });

  test('lists my orders and fetches one; other users get 404', async () => {
    const list = await agent.get(`${API}/orders/my`);
    expect(list.body.data.orders).toHaveLength(1);
    expect(list.body.data.orders[0].itemCount).toBe(2);
    expect((await agent.get(`${API}/orders/${orderId}`)).body.data.order.statusHistory.map((s) => s.status)).toEqual([
      'pending',
      'processing',
    ]);
    const { agent: other } = await createUserAgent();
    expect((await other.get(`${API}/orders/${orderId}`)).status).toBe(404);
  });

  test('cancelling a paid order restores stock and marks refund', async () => {
    const res = await agent.put(`${API}/orders/${orderId}/cancel`).send({ reason: 'Ordered by mistake' });
    expect(res.status).toBe(200);
    expect(res.body.data.order.status).toBe('cancelled');
    expect(res.body.data.order.paymentStatus).toBe('refunded');
    expect(await stockOf(jeans()._id)).toBe(40);
    const twice = await agent.put(`${API}/orders/${orderId}/cancel`).send({});
    expect(twice.status).toBe(400);
  });

  test('simulated payment failure keeps the order pending', async () => {
    const { agent: a } = await createUserAgent();
    await fillCart(a, jeans(), 1);
    const order = (await a.post(`${API}/orders`).send({ shippingAddress: address, paymentMethod: 'razorpay' })).body.data.order;
    const { sim } = await payOnline(a, order._id, 'failure');
    expect(sim.status).toBe('failed');
    expect((await a.get(`${API}/orders/${order._id}`)).body.data.order.paymentStatus).toBe('pending');
  });
});

describe('Cash on delivery & inventory', () => {
  test('COD order is confirmed and reserves stock immediately', async () => {
    const { agent } = await createUserAgent();
    const m14 = catalog.products[0];
    const before = await stockOf(m14._id);
    await fillCart(agent, m14, 3);
    const res = await agent.post(`${API}/orders`).send({ shippingAddress: address, paymentMethod: 'cod' });
    expect(res.status).toBe(201);
    expect(res.body.data.order.status).toBe('processing');
    expect(res.body.data.order.isPaid).toBe(false);
    expect(await stockOf(m14._id)).toBe(before - 3);

    const cancel = await agent.put(`${API}/orders/${res.body.data.order._id}/cancel`).send({});
    expect(cancel.body.data.order.paymentStatus).toBe('failed');
    expect(await stockOf(m14._id)).toBe(before);
  });

  test('never oversells under concurrent checkouts', async () => {
    const s23 = catalog.products[1]; // stock 3
    const buyers = await Promise.all([1, 2].map(() => createUserAgent()));
    for (const b of buyers) await fillCart(b.agent, s23, 2);
    const results = await Promise.all(
      buyers.map((b) => b.agent.post(`${API}/orders`).send({ shippingAddress: address, paymentMethod: 'cod' })),
    );
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409]);
    expect(await stockOf(s23._id)).toBe(1);
  });

  test('rejects checkout when stock dropped after adding to cart', async () => {
    const { agent } = await createUserAgent();
    const jeans = catalog.products[3];
    await fillCart(agent, jeans, 2);
    await Product.updateOne({ _id: jeans._id }, { stock: 1 });
    const res = await agent.post(`${API}/orders`).send({ shippingAddress: address, paymentMethod: 'cod' });
    expect(res.status).toBe(400);
    await Product.updateOne({ _id: jeans._id }, { stock: 40 });
  });
});

describe('Payments config', () => {
  test('exposes mode but never secrets', async () => {
    const res = await request(app).get(`${API}/payments/config`);
    expect(res.body.data).toEqual({ mode: 'simulation', keyId: '', currency: 'INR' });
  });
});
