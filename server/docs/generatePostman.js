// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
// Generates docs/postman/OrderIt.postman_collection.json from the OpenAPI route registry.
//   npm run docs:postman
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROUTES } from './openapi.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const EXAMPLES = {
  'POST /auth/register': { name: 'Test Customer', email: 'test.customer@example.com', password: 'Customer@123', phone: '9876543210' },
  'POST /auth/login': { email: 'aarav.sharma@example.com', password: 'Customer@123' },
  'POST /auth/forgot-password': { email: 'aarav.sharma@example.com' },
  'POST /auth/reset-password/{token}': { password: 'NewPass@123' },
  'PUT /auth/change-password': { currentPassword: 'Customer@123', newPassword: 'Customer@456' },
  'PUT /users/me': { name: 'Aarav Sharma', phone: '9810012345' },
  'POST /users/me/addresses': { fullName: 'Aarav Sharma', phone: '9810012345', line1: 'B-42, Malviya Nagar', city: 'New Delhi', state: 'Delhi', postalCode: '110017' },
  'POST /cart/items': { productId: '{{productId}}', quantity: 1 },
  'PUT /cart/items/{productId}': { quantity: 2 },
  'POST /cart/coupon': { code: 'WELCOME10' },
  'POST /coupons/validate': { code: 'WELCOME10', subtotal: 15000 },
  'POST /reviews/{productId}': { rating: 5, title: 'Great value', comment: 'Battery easily lasts a full day and the camera is sharp.' },
  'POST /orders': { paymentMethod: 'razorpay', shippingAddress: { fullName: 'Aarav Sharma', phone: '9810012345', line1: 'B-42, Malviya Nagar', city: 'New Delhi', state: 'Delhi', postalCode: '110017' } },
  'POST /payments/create-order': { orderId: '{{orderId}}' },
  'POST /payments/simulate': { orderId: '{{orderId}}', providerOrderId: '{{providerOrderId}}', outcome: 'success' },
  'PUT /orders/{id}/pay': { razorpayOrderId: '{{providerOrderId}}', razorpayPaymentId: '{{paymentId}}', razorpaySignature: '{{signature}}' },
  'PUT /orders/{id}/cancel': { reason: 'Ordered by mistake' },
  'PUT /admin/orders/{id}/status': { status: 'shipped', trackingNumber: 'BLUEDART123456', note: 'Packed and handed to courier' },
  'PUT /admin/users/{id}/status': { isActive: false },
  'PUT /admin/users/{id}/role': { role: 'customer' },
  'PUT /admin/reviews/{id}/status': { status: 'approved' },
  'PUT /admin/products/bulk-status': { ids: ['{{productId}}'], isActive: false },
  'PATCH /admin/products/{id}/stock': { stock: 25 },
  'POST /admin/coupons': { code: 'DIWALI25', description: '25% off, up to ₹2,500', discountType: 'percent', discountValue: 25, maxDiscount: 2500, minOrderValue: 4999, expiresAt: '2030-12-31' },
  'POST /categories': { name: 'Gaming', description: 'Consoles and accessories' },
  'POST /brands': { name: 'Nothing' },
  'POST /ai/chat': { messages: [{ role: 'user', content: 'Suggest a phone under 20000 with a good camera' }] },
};
const QUERY_EXAMPLES = {
  'GET /products': 'search=samsung&category=mobiles&minPrice=10000&maxPrice=40000&rating=4&sort=price_asc&page=1&limit=12',
  'GET /products/suggestions': 'q=gal',
  'GET /ai/search': 'q=phone%20under%2020000%20with%20good%20camera',
};
const PATH_VARS = { slug: '{{productSlug}}', id: '{{id}}', productId: '{{productId}}', addressId: '{{addressId}}', token: '{{resetToken}}' };

function item([method, routePath, , summary, access]) {
  const key = `${method.toUpperCase()} ${routePath}`;
  const filled = routePath.replace(/\{(\w+)\}/g, (_, v) => PATH_VARS[v] || `{{${v}}}`);
  const query = QUERY_EXAMPLES[key];
  const headers = [{ key: 'Content-Type', value: 'application/json' }];
  if (access === 'admin') headers.push({ key: 'X-Client-App', value: 'admin' });
  const req = {
    method: method.toUpperCase(),
    header: headers,
    url: {
      raw: `{{baseUrl}}${filled}${query ? `?${query}` : ''}`,
      host: ['{{baseUrl}}'],
      path: filled.split('/').filter(Boolean),
      ...(query ? { query: query.split('&').map((q) => ({ key: q.split('=')[0], value: q.split('=')[1] })) } : {}),
    },
    description: `${summary}${access === 'admin' ? ' (admin - log in with "Admin login" first)' : access === 'user' ? ' (requires login)' : ''}`,
  };
  if (EXAMPLES[key]) req.body = { mode: 'raw', raw: JSON.stringify(EXAMPLES[key], null, 2) };
  if (key === 'POST /uploads/images') req.body = { mode: 'formdata', formdata: [{ key: 'images', type: 'file', src: [] }] };
  return { name: `${method.toUpperCase()} ${routePath} - ${summary}`, request: req };
}

const groups = {};
ROUTES.forEach((r) => (groups[r[2]] ||= []).push(item(r)));
groups.Auth.unshift({
  name: 'Admin login (sets admin cookies)',
  request: {
    method: 'POST',
    header: [{ key: 'Content-Type', value: 'application/json' }, { key: 'X-Client-App', value: 'admin' }],
    url: { raw: '{{baseUrl}}/auth/login', host: ['{{baseUrl}}'], path: ['auth', 'login'] },
    body: { mode: 'raw', raw: JSON.stringify({ email: 'admin@shopverse.com', password: 'ShopVerse@Admin2026' }, null, 2) },
  },
});

const collection = {
  info: {
    name: 'OrderIt API',
    description: 'Generated from server/docs/openapi.js. Postman keeps HTTP-only cookies automatically, so log in once and the other requests are authenticated.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:5001/api/v1' },
    { key: 'productSlug', value: '' },
    { key: 'productId', value: '' },
    { key: 'orderId', value: '' },
    { key: 'id', value: '' },
  ],
  item: Object.entries(groups).map(([name, items]) => ({ name, item: items })),
};

const out = path.join(root, 'docs', 'postman', 'OrderIt.postman_collection.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${JSON.stringify(collection, null, 2)}\n`);
console.log(`[postman] ${ROUTES.length + 1} requests in ${Object.keys(groups).length} folders -> ${path.relative(root, out)}`);
