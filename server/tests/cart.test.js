// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import request from 'supertest';
import { app, API, closeTestDb, connectTestDb, createCatalog, createUserAgent } from './helpers/setup.js';
import { Coupon } from '../models/Coupon.js';
import { Review } from '../models/Review.js';
import { Product } from '../models/Product.js';

let catalog;
let agent;
let m14;
let s23;
let a15;
let jeans;
const day = 86_400_000;

beforeAll(async () => {
  await connectTestDb('cart');
  catalog = await createCatalog();
  [m14, s23, a15, jeans] = catalog.products;
  agent = (await createUserAgent()).agent;
  await Coupon.create([
    { code: 'WELCOME10', discountType: 'percent', discountValue: 10, maxDiscount: 500, minOrderValue: 999, expiresAt: new Date(Date.now() + 30 * day) },
    { code: 'FLAT500', discountType: 'flat', discountValue: 500, minOrderValue: 4999, expiresAt: new Date(Date.now() + 30 * day) },
    { code: 'OLD20', discountType: 'percent', discountValue: 20, expiresAt: new Date(Date.now() - day) },
    { code: 'LIMITED', discountType: 'flat', discountValue: 100, usageLimit: 1, usedCount: 1, expiresAt: new Date(Date.now() + day) },
  ]);
});
afterAll(() => closeTestDb());

describe('Cart', () => {
  test('requires login', async () => {
    expect((await request(app).get(`${API}/cart`)).status).toBe(401);
  });

  test('starts empty with zero totals', async () => {
    const res = await agent.get(`${API}/cart`);
    expect(res.body.data.cart.items).toHaveLength(0);
    expect(res.body.data.cart.totals.total).toBe(0);
  });

  test('adds items and computes subtotal, GST, shipping, total', async () => {
    await agent.post(`${API}/cart/items`).send({ productId: String(jeans._id), quantity: 1 });
    const res = await agent.get(`${API}/cart`);
    const { totals } = res.body.data.cart;
    expect(totals.subtotal).toBe(2499);
    expect(totals.tax).toBeCloseTo(2499 * 0.18, 2);
    expect(totals.shipping).toBe(0); // above free shipping threshold
    expect(totals.total).toBeCloseTo(2499 * 1.18, 2);
  });

  test('adding the same product increments quantity', async () => {
    const res = await agent.post(`${API}/cart/items`).send({ productId: String(jeans._id), quantity: 2 });
    expect(res.status).toBe(201);
    expect(res.body.data.cart.items[0].quantity).toBe(3);
    expect(res.body.data.cart.itemCount).toBe(3);
  });

  test('updates quantity and enforces stock', async () => {
    const upd = await agent.put(`${API}/cart/items/${jeans._id}`).send({ quantity: 1 });
    expect(upd.body.data.cart.items[0].quantity).toBe(1);
    await agent.post(`${API}/cart/items`).send({ productId: String(s23._id), quantity: 1 });
    const tooMany = await agent.put(`${API}/cart/items/${s23._id}`).send({ quantity: 5 }); // stock 3
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.message).toMatch(/3 unit/);
  });

  test('rejects out-of-stock and invalid products', async () => {
    expect((await agent.post(`${API}/cart/items`).send({ productId: String(a15._id) })).status).toBe(400);
    expect((await agent.post(`${API}/cart/items`).send({ productId: 'abc' })).status).toBe(400);
    expect((await agent.post(`${API}/cart/items`).send({ productId: '64b000000000000000000000' })).status).toBe(404);
  });

  test('removes an item', async () => {
    const res = await agent.delete(`${API}/cart/items/${s23._id}`);
    expect(res.body.data.cart.items.map((i) => i.product.slug)).toEqual([jeans.slug]);
  });

  test('charges shipping below the free-shipping threshold', async () => {
    const cheap = await Product.create({
      name: 'Cheap Cable', brand: catalog.samsung._id, category: catalog.mobiles._id, description: 'USB C cable',
      price: 299, mrp: 499, stock: 50, images: [{ url: 'https://example.com/c.jpg' }],
    });
    const { agent: other } = await createUserAgent();
    const res = await other.post(`${API}/cart/items`).send({ productId: String(cheap._id), quantity: 1 });
    expect(res.body.data.cart.totals.shipping).toBe(49);
  });
});

describe('Coupons', () => {
  test('lists available (non-expired) coupons', async () => {
    const res = await request(app).get(`${API}/coupons/available`);
    const codes = res.body.data.coupons.map((c) => c.code);
    expect(codes).toEqual(expect.arrayContaining(['WELCOME10', 'FLAT500']));
    expect(codes).not.toContain('OLD20');
  });

  test('applies a percent coupon to the cart', async () => {
    const res = await agent.post(`${API}/cart/coupon`).send({ code: 'welcome10' });
    expect(res.status).toBe(200);
    const { totals, coupon } = res.body.data.cart;
    expect(coupon.code).toBe('WELCOME10');
    expect(totals.discount).toBeCloseTo(249.9, 1);
    expect(totals.total).toBeCloseTo((2499 - 249.9) * 1.18, 1);
  });

  test('rejects coupons below min order, expired or exhausted', async () => {
    const min = await agent.post(`${API}/cart/coupon`).send({ code: 'FLAT500' });
    expect(min.status).toBe(400);
    expect(min.body.message).toMatch(/more to use this coupon/);
    expect((await agent.post(`${API}/cart/coupon`).send({ code: 'OLD20' })).body.message).toMatch(/expired/);
    expect((await agent.post(`${API}/cart/coupon`).send({ code: 'LIMITED' })).body.message).toMatch(/usage limit/);
    expect((await agent.post(`${API}/cart/coupon`).send({ code: 'NOPE99' })).status).toBe(400);
  });

  test('validate endpoint and removing a coupon', async () => {
    const v = await agent.post(`${API}/coupons/validate`).send({ code: 'FLAT500', subtotal: 6000 });
    expect(v.body.data.discount).toBe(500);
    const res = await agent.delete(`${API}/cart/coupon`);
    expect(res.body.data.cart.totals.discount).toBe(0);
  });
});

describe('Wishlist', () => {
  test('adds (idempotently) and removes products', async () => {
    await agent.post(`${API}/wishlist/${m14._id}`);
    const again = await agent.post(`${API}/wishlist/${m14._id}`);
    expect(again.body.data.count).toBe(1);
    const list = await agent.get(`${API}/wishlist`);
    expect(list.body.data.products[0].name).toBe(m14.name);
    const removed = await agent.delete(`${API}/wishlist/${m14._id}`);
    expect(removed.body.data.count).toBe(0);
  });
});

describe('Reviews', () => {
  let reviewId;

  test('creates a pending review; duplicates are rejected', async () => {
    const res = await agent.post(`${API}/reviews/${m14._id}`).send({ rating: 5, title: 'Great', comment: 'Battery lasts two days easily.' });
    expect(res.status).toBe(201);
    expect(res.body.data.review.status).toBe('pending');
    reviewId = res.body.data.review._id;
    const dup = await agent.post(`${API}/reviews/${m14._id}`).send({ rating: 4, comment: 'Second review attempt' });
    expect(dup.status).toBe(409);
  });

  test('validates rating and comment length', async () => {
    const res = await agent.post(`${API}/reviews/${s23._id}`).send({ rating: 9, comment: 'short' });
    expect(res.status).toBe(400);
  });

  test('pending reviews are hidden; approval updates product rating', async () => {
    const hidden = await request(app).get(`${API}/reviews/product/${m14._id}`);
    expect(hidden.body.data.reviews).toHaveLength(0);
    await Review.findByIdAndUpdate(reviewId, { status: 'approved' });
    await Review.recalculateProductRating(m14._id);
    const shown = await request(app).get(`${API}/reviews/product/${m14._id}`);
    expect(shown.body.data.reviews).toHaveLength(1);
    expect(shown.body.data.distribution['5']).toBe(1);
    const product = await Product.findById(m14._id);
    expect(product.rating).toBe(5);
    expect(product.numReviews).toBe(1);
  });

  test('user can edit and delete own review', async () => {
    const mine = await agent.get(`${API}/reviews/my`);
    expect(mine.body.data.reviews).toHaveLength(1);
    const upd = await agent.put(`${API}/reviews/${reviewId}`).send({ rating: 4 });
    expect(upd.body.data.review.status).toBe('pending');
    const { agent: stranger } = await createUserAgent();
    expect((await stranger.delete(`${API}/reviews/${reviewId}`)).status).toBe(404);
    expect((await agent.delete(`${API}/reviews/${reviewId}`)).status).toBe(200);
    expect((await Product.findById(m14._id)).numReviews).toBe(0);
  });
});
