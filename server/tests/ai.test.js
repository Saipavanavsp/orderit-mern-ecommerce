import request from 'supertest';
import { app, API, closeTestDb, connectTestDb, createCatalog, createUserAgent } from './helpers/setup.js';
import { parseQuery, _resetBrandCache } from '../services/nlSearch.service.js';
import * as assistant from '../services/assistant.service.js';
import { env } from '../config/env.js';
import { Order } from '../models/Order.js';
import { Coupon } from '../models/Coupon.js';

let catalog;
const brands = [
  { name: 'Samsung', slug: 'samsung' },
  { name: "Levi's", slug: 'levis' },
];

beforeAll(async () => {
  await connectTestDb('ai');
  _resetBrandCache();
  catalog = await createCatalog();
  await Coupon.create({ code: 'WELCOME10', description: '10% off your first order', discountType: 'percent', discountValue: 10, expiresAt: new Date(Date.now() + 86_400_000) });
});
afterAll(async () => {
  assistant.setClient(null);
  await closeTestDb();
});

describe('Natural-language query parser', () => {
  test('phone under 20000 with good camera', () => {
    const { filters, keywords } = parseQuery('phone under 20000 with good camera', brands);
    expect(filters).toMatchObject({ category: ['mobiles'], maxPrice: 20000 });
    expect(keywords).toEqual(['camera']);
  });

  test('ranges, k / lakh units, brands, ratings, sort', () => {
    expect(parseQuery('samsung tv between 30k and 1 lakh', brands).filters).toMatchObject({
      category: ['tv-and-appliances'], brand: ['samsung'], minPrice: 30000, maxPrice: 100000,
    });
    expect(parseQuery('best rated laptop above ₹50,000', brands).filters).toMatchObject({
      category: ['electronics'], minPrice: 50000, rating: 4, sort: 'rating',
    });
    expect(parseQuery('cheapest 4 star washing machine', brands).filters).toMatchObject({
      category: ['tv-and-appliances'], subCategory: 'Washing Machines', rating: 4, sort: 'price_asc',
    });
    expect(parseQuery("levi's jeans deals", brands).filters).toMatchObject({ category: ['fashion'], brand: ['levis'], minDiscount: 20 });
  });

  test('product-type words map to exact sub-categories (not description matches)', () => {
    const h = parseQuery('best rated headphones', brands);
    expect(h.filters).toMatchObject({ category: ['electronics'], subCategory: 'Headphones & Earbuds', rating: 4 });
    expect(h.keywords).toEqual([]);
    expect(parseQuery('mobile charger under 2000', brands).filters).toMatchObject({ category: ['accessories'], subCategory: 'Chargers & Power Banks', maxPrice: 2000 });
    expect(parseQuery('smart watch for running', brands).filters).toMatchObject({ category: ['electronics'], subCategory: 'Smartwatches' });
    expect(parseQuery('casio watch', brands).filters).toMatchObject({ category: ['accessories'], subCategory: 'Watches' });
    // "camera" stays a feature keyword when the product is a phone
    const p = parseQuery('phone with good camera', brands);
    expect(p.filters.subCategory).toBeUndefined();
    expect(p.keywords).toEqual(['camera']);
  });
});

describe('GET /ai/search', () => {
  test('applies parsed filters and keyword relevance', async () => {
    const res = await request(app).get(`${API}/ai/search`).query({ q: 'phone under 20000 with good camera' });
    expect(res.status).toBe(200);
    expect(res.body.data.interpreted).toMatchObject({ maxPrice: 20000, category: ['mobiles'] });
    expect(res.body.data.products.map((p) => p.name)).toEqual(['Samsung Galaxy M14 5G']);
  });

  test('relaxes unmatched keywords but keeps filters', async () => {
    const res = await request(app).get(`${API}/ai/search`).query({ q: 'samsung phone under 20000 with stylus' });
    expect(res.body.data.interpreted.relaxed).toBe(true);
    expect(res.body.data.products.every((p) => p.price <= 20000)).toBe(true);
    expect(res.body.data.products.length).toBeGreaterThan(0);
  });
});

describe('POST /ai/chat (rule-based fallback, no API key)', () => {
  const ask = (content, extra = {}) => request(app).post(`${API}/ai/chat`).send({ messages: [{ role: 'user', content }], ...extra });

  test('recommends only catalog products for a product question', async () => {
    const res = await ask('Suggest a phone under 20000 with good camera');
    expect(res.status).toBe(200);
    expect(res.body.data.source).toBe('rule-based');
    expect(res.body.data.products[0].slug).toBe('samsung-galaxy-m14-5g');
    expect(res.body.data.reply).toMatch(/Samsung Galaxy M14 5G at ₹13,999/);
  });

  test('answers policy questions', async () => {
    expect((await ask('how much is shipping?')).body.data.reply).toMatch(/free on orders of ₹999/);
    expect((await ask('what is your return policy')).body.data.reply).toMatch(/7 days/);
    expect((await ask('any coupon codes?')).body.data.reply).toMatch(/WELCOME10/);
  });

  test('says so when nothing matches', async () => {
    const res = await ask('refrigerator under 500');
    expect(res.body.data.products).toHaveLength(0);
    expect(res.body.data.reply).toMatch(/could not find/);
  });

  test('validates the conversation', async () => {
    expect((await request(app).post(`${API}/ai/chat`).send({ messages: [] })).status).toBe(400);
    const lastAssistant = await request(app).post(`${API}/ai/chat`).send({ messages: [{ role: 'assistant', content: 'hi' }] });
    expect(lastAssistant.status).toBe(400);
  });
});

describe('POST /ai/chat (Claude path with a fake client)', () => {
  let lastRequest;
  const fake = (impl) => ({ beta: { messages: { create: async (req) => { lastRequest = req; return impl(req); } } } });

  beforeAll(() => {
    env.anthropic.enabled = true;
  });
  afterAll(() => {
    env.anthropic.enabled = false;
    assistant.setClient(null);
  });

  test('grounds Claude in our catalog and drops unknown product ids', async () => {
    assistant.setClient(
      fake(() => ({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Try the Samsung Galaxy M14 5G [[samsung-galaxy-m14-5g]] or a Pixel [[google-pixel-99]].' }],
      })),
    );
    const res = await request(app).post(`${API}/ai/chat`).send({ messages: [{ role: 'user', content: 'phone under 20000' }] });
    expect(res.body.data.source).toBe('claude');
    expect(res.body.data.reply).not.toMatch(/\[\[/);
    expect(res.body.data.products.map((p) => p.slug)).toEqual(['samsung-galaxy-m14-5g']);
    // request shape: server-side model, catalog in the user turn, stable system prompt
    expect(lastRequest.model).toBe(env.anthropic.model);
    expect(lastRequest.system).toMatch(/ShopVerse Assistant/);
    expect(lastRequest.messages.at(-1).content).toMatch(/<catalog>[\s\S]*samsung-galaxy-m14-5g/);
    expect(lastRequest.fallbacks).toBe('default');
  });

  test('falls back to rules on API errors and refusals', async () => {
    assistant.setClient(fake(() => { throw new Error('network down'); }));
    const err = await request(app).post(`${API}/ai/chat`).send({ messages: [{ role: 'user', content: 'phone under 20000' }] });
    expect(err.body.data.source).toBe('rule-based');
    assistant.setClient(fake(() => ({ stop_reason: 'refusal', content: [] })));
    const refusal = await request(app).post(`${API}/ai/chat`).send({ messages: [{ role: 'user', content: 'phone under 20000' }] });
    expect(refusal.body.data.source).toBe('rule-based');
  });
});

describe('Recommendations', () => {
  test('content-based + co-purchase signal', async () => {
    const [m14, , , jeans] = catalog.products;
    const { user } = await createUserAgent();
    await Order.create({
      orderNumber: 'OI-CO-1', user: user._id, paymentMethod: 'cod', itemsPrice: 1, taxPrice: 0, shippingPrice: 0, totalPrice: 1,
      shippingAddress: { fullName: 'A', phone: '9999999999', line1: 'x', city: 'y', state: 'z', postalCode: '111111' },
      items: [
        { product: m14._id, name: m14.name, slug: m14.slug, price: 1, quantity: 1 },
        { product: jeans._id, name: jeans.name, slug: jeans.slug, price: 1, quantity: 1 },
      ],
    });
    const res = await request(app).get(`${API}/ai/recommendations/${m14._id}`);
    const jeansRec = res.body.data.products.find((p) => p.slug === jeans.slug);
    expect(jeansRec.recommendation.reasons).toContain('frequently bought together');
    expect(res.body.data.products.find((p) => p.slug === m14.slug)).toBeUndefined();
  });

  test('personalised recommendations need login and use history', async () => {
    expect((await request(app).get(`${API}/ai/recommendations/me`)).status).toBe(401);
    const { agent } = await createUserAgent();
    await agent.post(`${API}/wishlist/${catalog.products[0]._id}`);
    const res = await agent.get(`${API}/ai/recommendations/me`);
    expect(res.body.data.basedOn).toBe(1);
    expect(res.body.data.products.length).toBeGreaterThan(0);
  });
});
