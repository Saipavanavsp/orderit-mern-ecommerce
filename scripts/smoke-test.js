// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
// End-to-end smoke test against the RUNNING app (start it first with "npm run dev").
//   npm run smoke
// Flow: health -> register -> login -> browse -> search -> NL search -> add to cart -> coupon ->
//       checkout -> pay (test mode) -> view order -> admin login -> admin ships & delivers -> AI assistant.
import { getPorts } from './lib/env.js';

const ports = getPorts();
const API = process.env.SMOKE_API || `http://localhost:${ports.api}/api/v1`;
const results = [];

class Session {
  constructor(headers = {}) {
    this.cookies = new Map();
    this.headers = headers;
  }

  async req(method, path, body) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Origin: `http://localhost:${ports.client}`,
        ...this.headers,
        Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    for (const c of res.headers.getSetCookie?.() || []) {
      const [pair] = c.split(';');
      const [k, v] = pair.split('=');
      if (v) this.cookies.set(k, v);
      else this.cookies.delete(k);
    }
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json };
  }
}

async function step(name, fn) {
  const started = Date.now();
  try {
    const detail = await fn();
    results.push({ step: name, ok: true, ms: Date.now() - started, detail });
    console.log(`  PASS  ${name}${detail ? ` - ${detail}` : ''}`);
  } catch (err) {
    results.push({ step: name, ok: false, ms: Date.now() - started, detail: err.message });
    console.log(`  FAIL  ${name} - ${err.message}`);
    throw err;
  }
}

const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

async function urlStatus(url) {
  try {
    return (await fetch(url)).status;
  } catch (err) {
    return `unreachable (${err.cause?.code || err.message})`;
  }
}

async function main() {
  console.log(`\nOrderIt smoke test against ${API}\n`);
  const user = new Session();
  const admin = new Session({ 'X-Client-App': 'admin', Origin: `http://localhost:${ports.admin}` });
  const email = `smoke.${Date.now()}@example.com`;
  let product;
  let order;

  await step('URLs respond 200', async () => {
    const urls = [
      `${API}/health`,
      `http://localhost:${ports.client}/`,
      `http://localhost:${ports.admin}/`,
      `http://localhost:${ports.api}/api-docs/`,
    ];
    const codes = await Promise.all(urls.map(urlStatus));
    urls.forEach((u, i) => expect(codes[i] === 200, `${u} -> ${codes[i]}`));
    return urls.map((u, i) => `${u.replace('http://localhost', '')} ${codes[i]}`).join(', ');
  });
  await step('Health check reports database connected', async () => {
    const { json } = await user.req('GET', '/health');
    expect(json.data?.database === 'connected', `database: ${json.data?.database}`);
    return `payments=${json.data.integrations.payments}, ai=${json.data.integrations.ai}`;
  });
  await step('Register a new customer', async () => {
    const { status } = await user.req('POST', '/auth/register', { name: 'Smoke Tester', email, password: 'Smoke@12345', phone: '9876501234' });
    expect(status === 201, `status ${status}`);
    return email;
  });
  await step('Log out and log back in', async () => {
    await user.req('POST', '/auth/logout');
    const { status, json } = await user.req('POST', '/auth/login', { email, password: 'Smoke@12345' });
    expect(status === 200 && json.data.user.email === email, `status ${status}`);
    expect((await user.req('GET', '/auth/me')).status === 200, '/auth/me failed after login');
  });
  await step('Browse home page and categories', async () => {
    const home = await user.req('GET', '/products/home');
    const cats = await user.req('GET', '/categories');
    expect(home.json.data.featured.length > 0, 'no featured products');
    return `${cats.json.data.categories.length} categories, ${home.json.data.featured.length} featured`;
  });
  await step('Filter + sort + paginate products', async () => {
    const { json } = await user.req('GET', '/products?category=mobiles&sort=price_asc&inStock=true&limit=5&facets=true');
    expect(json.data.products.length > 0, 'no mobiles');
    const prices = json.data.products.map((p) => p.price);
    expect(prices.every((p, i) => i === 0 || p >= prices[i - 1]), 'not sorted');
    product = json.data.products.find((p) => p.price >= 1000) || json.data.products[0];
    return `${json.meta.total} mobiles, ${json.data.facets.brands.length} brands`;
  });
  await step('Keyword search + suggestions', async () => {
    const term = product.brand.name;
    const { json } = await user.req('GET', `/products?search=${encodeURIComponent(term)}`);
    const sug = await user.req('GET', `/products/suggestions?q=${encodeURIComponent(term.slice(0, 3))}`);
    expect(json.meta.total > 0 && sug.json.data.products.length > 0, 'no results');
    return `"${term}": ${json.meta.total} results`;
  });
  await step('Natural-language search', async () => {
    const { json } = await user.req('GET', `/ai/search?q=${encodeURIComponent('phone under 30000 with good camera')}`);
    expect(json.data.interpreted.maxPrice === 30000, 'price not parsed');
    expect(json.data.products.every((p) => p.price <= 30000), 'price filter not applied');
    return `${json.meta.total} matches, category=${json.data.interpreted.category}`;
  });
  await step('Product detail + recommendations', async () => {
    const d = await user.req('GET', `/products/${product.slug}`);
    const rel = await user.req('GET', `/products/${product.slug}/related`);
    expect(d.status === 200 && rel.json.data.products.length > 0, 'detail or related missing');
    return `${rel.json.data.products.length} "you may also like"`;
  });
  await step('Add to cart', async () => {
    const { status, json } = await user.req('POST', '/cart/items', { productId: product._id, quantity: 1 });
    expect(status === 201, `status ${status}: ${json.message}`);
    return `subtotal ₹${json.data.cart.totals.subtotal}`;
  });
  await step('Apply coupon WELCOME10', async () => {
    const { status, json } = await user.req('POST', '/cart/coupon', { code: 'WELCOME10' });
    expect(status === 200, `status ${status}: ${json.message}`);
    return `discount ₹${json.data.cart.totals.discount}, total ₹${json.data.cart.totals.total}`;
  });
  await step('Checkout (online payment)', async () => {
    const { status, json } = await user.req('POST', '/orders', {
      paymentMethod: 'razorpay',
      shippingAddress: { fullName: 'Smoke Tester', phone: '9876501234', line1: '1 Test Street', city: 'Pune', state: 'Maharashtra', postalCode: '411001' },
    });
    expect(status === 201, `status ${status}: ${json.message}`);
    order = json.data.order;
    return `${order.orderNumber} ₹${order.totalPrice}`;
  });
  await step('Pay (Razorpay test mode / signed simulation)', async () => {
    const pay = await user.req('POST', '/payments/create-order', { orderId: order._id });
    expect(pay.status === 201, `create-order ${pay.status}: ${pay.json.message}`);
    if (pay.json.data.mode !== 'simulation') return 'Razorpay keys configured - complete payment in the browser widget';
    const sim = await user.req('POST', '/payments/simulate', { orderId: order._id, providerOrderId: pay.json.data.providerOrderId, outcome: 'success' });
    const done = await user.req('PUT', `/orders/${order._id}/pay`, sim.json.data);
    expect(done.status === 200 && done.json.data.order.isPaid, `pay ${done.status}: ${done.json.message}`);
    return 'signature verified, order processing';
  });
  await step('View order in My Orders', async () => {
    const list = await user.req('GET', '/orders/my');
    const detail = await user.req('GET', `/orders/${order._id}`);
    expect(list.json.data.orders.some((o) => o._id === order._id), 'order not listed');
    return `status=${detail.json.data.order.status}, payment=${detail.json.data.order.paymentStatus}`;
  });
  await step('Admin login (admin app cookies)', async () => {
    const { status } = await admin.req('POST', '/auth/login', { email: 'admin@shopverse.com', password: 'ShopVerse@Admin2026' });
    expect(status === 200, `status ${status}`);
    const dash = await admin.req('GET', '/admin/dashboard');
    expect(dash.status === 200, 'dashboard failed');
    return `revenue ₹${dash.json.data.stats.revenue}, ${dash.json.data.stats.orders} orders`;
  });
  await step('Admin updates order status: shipped -> delivered', async () => {
    const s1 = await admin.req('PUT', `/admin/orders/${order._id}/status`, { status: 'shipped', trackingNumber: 'SMOKE123' });
    const s2 = await admin.req('PUT', `/admin/orders/${order._id}/status`, { status: 'delivered' });
    expect(s1.status === 200 && s2.status === 200, `${s1.json.message} / ${s2.json.message}`);
    const mine = await user.req('GET', `/orders/${order._id}`);
    expect(mine.json.data.order.status === 'delivered', 'customer does not see delivered');
    return mine.json.data.order.statusHistory.map((h) => h.status).join(' -> ');
  });
  await step('AI assistant answers a product question', async () => {
    const { json } = await user.req('POST', '/ai/chat', { messages: [{ role: 'user', content: 'Suggest a good phone under 30000' }] });
    expect(json.data?.reply?.length > 10, 'empty reply');
    return `[${json.data.source}] ${json.data.reply.slice(0, 90)}… (${json.data.products.length} product cards)`;
  });

  const ok = results.every((r) => r.ok);
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} steps passed.\n`);
  process.exitCode = ok ? 0 : 1; // let sockets close naturally (process.exit can trip a libuv assert on Windows)
}

main().catch(() => {
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} steps passed before the failure. Is "npm run dev" running and the DB seeded?\n`);
  process.exitCode = 1;
});
