// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { app, API, adminRequest, closeTestDb, connectTestDb, createCatalog, createUserAgent } from './helpers/setup.js';
import { Product } from '../models/Product.js';
import { Review } from '../models/Review.js';
import { env } from '../config/env.js';

let catalog;
let admin;
let adminUser;
let customer;
let customerUser;
const address = { fullName: 'Kavya Iyer', phone: '9123456780', line1: '14 Marine Drive', city: 'Mumbai', state: 'Maharashtra', postalCode: '400020' };

beforeAll(async () => {
  await connectTestDb('admin_api'); // "admin" is MongoDB's reserved system database
  catalog = await createCatalog();
  const a = await createUserAgent({ role: 'admin', admin: true });
  admin = adminRequest(a.agent);
  adminUser = a.user;
  ({ agent: customer, user: customerUser } = await createUserAgent({ name: 'Kavya Iyer' }));
});
afterAll(() => closeTestDb());

describe('Admin access control', () => {
  test('customers and anonymous users are blocked from /admin', async () => {
    expect((await request(app).get(`${API}/admin/dashboard`)).status).toBe(401);
    expect((await customer.get(`${API}/admin/dashboard`)).status).toBe(403);
  });
});

describe('Order management', () => {
  let orderId;

  test('admin moves a COD order through processing -> shipped -> delivered', async () => {
    await customer.post(`${API}/cart/items`).send({ productId: String(catalog.products[3]._id), quantity: 2 });
    const created = await customer.post(`${API}/orders`).send({ shippingAddress: address, paymentMethod: 'cod' });
    orderId = created.body.data.order._id;

    const list = await admin.get(`${API}/admin/orders?status=processing&search=kavya`);
    expect(list.body.data.orders.map((o) => o._id)).toContain(orderId);

    const invalid = await admin.put(`${API}/admin/orders/${orderId}/status`).send({ status: 'delivered' });
    expect(invalid.status).toBe(400);

    const shipped = await admin.put(`${API}/admin/orders/${orderId}/status`).send({ status: 'shipped', trackingNumber: 'BLR123' });
    expect(shipped.body.data.order.status).toBe('shipped');
    const delivered = await admin.put(`${API}/admin/orders/${orderId}/status`).send({ status: 'delivered' });
    expect(delivered.body.data.order).toMatchObject({ status: 'delivered', isPaid: true, paymentStatus: 'paid' });

    // customer sees tracking history and can no longer cancel
    const mine = await customer.get(`${API}/orders/${orderId}`);
    expect(mine.body.data.order.statusHistory.map((h) => h.status)).toEqual(['pending', 'processing', 'shipped', 'delivered']);
    expect((await customer.put(`${API}/orders/${orderId}/cancel`).send({})).status).toBe(400);
  });

  test('admin cancellation restores stock', async () => {
    const before = (await Product.findById(catalog.products[0]._id)).stock;
    await customer.post(`${API}/cart/items`).send({ productId: String(catalog.products[0]._id), quantity: 1 });
    const o = (await customer.post(`${API}/orders`).send({ shippingAddress: address, paymentMethod: 'cod' })).body.data.order;
    expect((await Product.findById(catalog.products[0]._id)).stock).toBe(before - 1);
    const res = await admin.put(`${API}/admin/orders/${o._id}/status`).send({ status: 'cancelled', note: 'Address unserviceable' });
    expect(res.body.data.order.status).toBe('cancelled');
    expect((await Product.findById(catalog.products[0]._id)).stock).toBe(before);
  });

  test('unpaid online orders cannot be processed', async () => {
    await customer.post(`${API}/cart/items`).send({ productId: String(catalog.products[3]._id), quantity: 1 });
    const o = (await customer.post(`${API}/orders`).send({ shippingAddress: address, paymentMethod: 'razorpay' })).body.data.order;
    const res = await admin.put(`${API}/admin/orders/${o._id}/status`).send({ status: 'processing' });
    expect(res.status).toBe(400);
  });

  test('order detail includes payments', async () => {
    const res = await admin.get(`${API}/admin/orders/${orderId}`);
    expect(res.body.data.payments[0]).toMatchObject({ provider: 'cod', status: 'paid' });
  });
});

describe('Dashboard & analytics', () => {
  test('dashboard reports revenue, counts, sales series and low stock', async () => {
    const res = await admin.get(`${API}/admin/dashboard`);
    expect(res.status).toBe(200);
    const { stats, sales, topProducts, lowStockProducts } = res.body.data;
    expect(stats.revenue).toBeCloseTo(2499 * 2 * 1.18, 0);
    expect(stats.paidOrders).toBe(1);
    expect(stats.products).toBe(4);
    expect(stats.lowStock).toBe(2); // S23 Ultra (3) + inactive phone (5); inventory counts inactive items too
    expect(sales).toHaveLength(30);
    expect(sales.at(-1).revenue).toBeGreaterThan(0);
    expect(topProducts[0].name).toMatch(/Jeans/);
    expect(lowStockProducts.map((p) => p.stock)).toEqual(expect.arrayContaining([0, 3]));
  });

  test('sales by month, top products, categories, breakdowns', async () => {
    const monthly = await admin.get(`${API}/admin/analytics/sales?days=90&groupBy=month`);
    expect(monthly.body.data.series.length).toBeGreaterThanOrEqual(3);
    const cats = await admin.get(`${API}/admin/analytics/categories`);
    expect(cats.body.data.categories[0]).toMatchObject({ category: 'Fashion', units: 2 });
    const br = await admin.get(`${API}/admin/analytics/breakdowns`);
    expect(br.body.data.status.length).toBeGreaterThan(0);
  });
});

describe('Products, inventory & exports', () => {
  test('admin lists all products incl. inactive and filters low stock', async () => {
    const all = await admin.get(`${API}/admin/products?status=all`);
    expect(all.body.meta.total).toBe(5);
    const low = await admin.get(`${API}/admin/products?stock=low`);
    expect(low.body.data.products.map((p) => p.name).sort()).toEqual(['Hidden Inactive Phone', 'Samsung Galaxy S23 Ultra']);
  });

  test('bulk status update and stock adjustment', async () => {
    const ids = catalog.products.slice(0, 2).map((p) => String(p._id));
    const res = await admin.put(`${API}/admin/products/bulk-status`).send({ ids, isActive: false });
    expect(res.body.data.modified).toBe(2);
    expect((await request(app).get(`${API}/products`)).body.meta.total).toBe(2);
    await admin.put(`${API}/admin/products/bulk-status`).send({ ids, isActive: true });
    const stock = await admin.patch(`${API}/admin/products/${ids[1]}/stock`).send({ stock: 50 });
    expect(stock.body.data.product.stock).toBe(50);
    const low = await admin.get(`${API}/admin/inventory/low-stock`);
    expect(low.body.data.products.every((p) => p.stock <= env.lowStockThreshold)).toBe(true);
  });

  test('exports orders and products as CSV', async () => {
    const orders = await admin.get(`${API}/admin/export/orders`);
    expect(orders.headers['content-type']).toMatch(/text\/csv/);
    expect(orders.headers['content-disposition']).toMatch(/orders-\d{4}-\d{2}-\d{2}\.csv/);
    expect(orders.text).toMatch(/Order Number,Date,Customer/);
    const products = await admin.get(`${API}/admin/export/products`);
    expect(products.text.split('\r\n').filter(Boolean)).toHaveLength(6); // header + 5
  });
});

describe('Users', () => {
  test('lists users with order stats and toggles status/role', async () => {
    const list = await admin.get(`${API}/admin/users?search=kavya`);
    expect(list.body.data.users[0]).toMatchObject({ name: 'Kavya Iyer', orders: 3 });
    expect(list.body.data.users[0].password).toBeUndefined();

    const off = await admin.put(`${API}/admin/users/${customerUser._id}/status`).send({ isActive: false });
    expect(off.body.data.user.isActive).toBe(false);
    expect((await customer.get(`${API}/auth/me`)).status).toBe(403);
    await admin.put(`${API}/admin/users/${customerUser._id}/status`).send({ isActive: true });

    const role = await admin.put(`${API}/admin/users/${customerUser._id}/role`).send({ role: 'admin' });
    expect(role.body.data.user.role).toBe('admin');
    await admin.put(`${API}/admin/users/${customerUser._id}/role`).send({ role: 'customer' });
  });

  test('admin cannot deactivate or demote themselves', async () => {
    expect((await admin.put(`${API}/admin/users/${adminUser._id}/status`).send({ isActive: false })).status).toBe(400);
    expect((await admin.put(`${API}/admin/users/${adminUser._id}/role`).send({ role: 'customer' })).status).toBe(400);
  });
});

describe('Review moderation', () => {
  test('approve, reject and delete reviews', async () => {
    const { agent } = await createUserAgent();
    const created = await agent.post(`${API}/reviews/${catalog.products[3]._id}`).send({ rating: 4, comment: 'Fits well and the denim is thick.' });
    const id = created.body.data.review._id;
    const pending = await admin.get(`${API}/admin/reviews?status=pending`);
    expect(pending.body.data.reviews.map((r) => r._id)).toContain(id);
    await admin.put(`${API}/admin/reviews/${id}/status`).send({ status: 'approved' });
    expect((await Product.findById(catalog.products[3]._id)).numReviews).toBe(1);
    await admin.put(`${API}/admin/reviews/${id}/status`).send({ status: 'rejected' });
    expect((await Product.findById(catalog.products[3]._id)).numReviews).toBe(0);
    expect((await admin.delete(`${API}/admin/reviews/${id}`)).status).toBe(200);
    expect(await Review.countDocuments({ _id: id })).toBe(0);
  });
});

describe('Coupon management', () => {
  test('CRUD with validation', async () => {
    const bad = await admin.post(`${API}/admin/coupons`).send({ code: 'BIG', discountType: 'percent', discountValue: 95, expiresAt: '2030-01-01' });
    expect(bad.status).toBe(400);
    const created = await admin.post(`${API}/admin/coupons`).send({ code: 'diwali25', discountType: 'percent', discountValue: 25, maxDiscount: 2000, expiresAt: '2030-01-01' });
    expect(created.status).toBe(201);
    expect(created.body.data.coupon.code).toBe('DIWALI25');
    const id = created.body.data.coupon._id;
    const upd = await admin.put(`${API}/admin/coupons/${id}`).send({ isActive: false });
    expect(upd.body.data.coupon).toMatchObject({ isActive: false, maxDiscount: 2000 });
    const list = await admin.get(`${API}/admin/coupons?status=inactive`);
    expect(list.body.data.coupons.map((c) => c.code)).toContain('DIWALI25');
    expect((await admin.delete(`${API}/admin/coupons/${id}`)).status).toBe(200);
  });
});

describe('Image uploads', () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );

  test('uploads a valid PNG to local storage', async () => {
    const res = await admin.post(`${API}/uploads/images`).attach('images', png, { filename: 'dot.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    const { url, storage } = res.body.data.images[0];
    expect(storage).toBe('local');
    const file = path.join(env.paths.uploads, url.split('/uploads/')[1]);
    expect(fs.existsSync(file)).toBe(true);
    fs.unlinkSync(file);
  });

  test('rejects disallowed types and spoofed content', async () => {
    const txt = await admin.post(`${API}/uploads/images`).attach('images', Buffer.from('hello'), { filename: 'a.txt', contentType: 'text/plain' });
    expect(txt.status).toBe(400);
    const spoof = await admin.post(`${API}/uploads/images`).attach('images', Buffer.from('not really a png file'), { filename: 'x.png', contentType: 'image/png' });
    expect(spoof.status).toBe(400);
    expect(spoof.body.message).toMatch(/not a valid image/);
  });

  test('rejects files above the size limit', async () => {
    const big = Buffer.concat([png, Buffer.alloc(env.uploadMaxBytes + 10)]);
    const res = await admin.post(`${API}/uploads/images`).attach('images', big, { filename: 'big.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/too large/);
  });

  test('customers cannot upload', async () => {
    const res = await customer.post(`${API}/uploads/images`).attach('images', png, { filename: 'dot.png', contentType: 'image/png' });
    expect(res.status).toBe(403);
  });
});
