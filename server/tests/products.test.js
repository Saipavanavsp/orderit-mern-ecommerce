// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import request from 'supertest';
import { app, API, adminRequest, closeTestDb, connectTestDb, createCatalog, createUserAgent } from './helpers/setup.js';

let catalog;
let admin;
let customer;

beforeAll(async () => {
  await connectTestDb('products');
  catalog = await createCatalog();
  const a = await createUserAgent({ role: 'admin', admin: true });
  admin = adminRequest(a.agent);
  customer = (await createUserAgent()).agent;
});
afterAll(() => closeTestDb());

describe('GET /products (listing, filters, sort, pagination)', () => {
  test('lists only active products with pagination meta', async () => {
    const res = await request(app).get(`${API}/products`);
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(4);
    expect(res.body.data.products.find((p) => p.name === 'Hidden Inactive Phone')).toBeUndefined();
    expect(res.body.data.products[0]).toHaveProperty('inStock');
  });

  test('filters by category slug, brand and price range', async () => {
    const res = await request(app).get(`${API}/products?category=mobiles&brand=samsung&minPrice=10000&maxPrice=20000`);
    expect(res.status).toBe(200);
    const names = res.body.data.products.map((p) => p.name).sort();
    expect(names).toEqual(['Samsung Galaxy A15', 'Samsung Galaxy M14 5G']);
  });

  test('filters by rating and stock', async () => {
    const res = await request(app).get(`${API}/products?rating=4&inStock=true`);
    expect(res.body.data.products.every((p) => p.rating >= 4 && p.stock > 0)).toBe(true);
  });

  test('sorts by price ascending and descending', async () => {
    const asc = await request(app).get(`${API}/products?sort=price_asc`);
    const prices = asc.body.data.products.map((p) => p.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    const desc = await request(app).get(`${API}/products?sort=price_desc&limit=1`);
    expect(desc.body.data.products[0].name).toBe('Samsung Galaxy S23 Ultra');
  });

  test('paginates', async () => {
    const res = await request(app).get(`${API}/products?limit=2&page=2&sort=price_asc`);
    expect(res.body.data.products).toHaveLength(2);
    expect(res.body.meta).toMatchObject({ page: 2, limit: 2, total: 4, pages: 2 });
  });

  test('full-text search and partial-word fallback', async () => {
    const text = await request(app).get(`${API}/products?search=jeans`);
    expect(text.body.data.searchMode).toBe('text');
    expect(text.body.data.products[0].name).toMatch(/Jeans/);
    const partial = await request(app).get(`${API}/products?search=galax`);
    expect(partial.body.data.searchMode).toBe('regex');
    expect(partial.body.meta.total).toBe(3);
  });

  test('returns facets for the filter sidebar', async () => {
    const res = await request(app).get(`${API}/products?category=mobiles&facets=true`);
    expect(res.body.data.facets.brands[0]).toMatchObject({ name: 'Samsung', count: 3 });
    expect(res.body.data.facets.priceRange).toEqual({ min: 13999, max: 104999 });
  });

  test('validates query parameters', async () => {
    const res = await request(app).get(`${API}/products?minPrice=500&maxPrice=100`);
    expect(res.status).toBe(400);
    const bad = await request(app).get(`${API}/products?sort=random`);
    expect(bad.status).toBe(400);
  });
});

describe('Product detail, suggestions, home, related', () => {
  test('gets a product by slug with brand and category', async () => {
    const res = await request(app).get(`${API}/products/samsung-galaxy-m14-5g`);
    expect(res.status).toBe(200);
    expect(res.body.data.product.brand.name).toBe('Samsung');
    expect(res.body.data.product.discountPercent).toBe(22);
  });

  test('404 for unknown or inactive product', async () => {
    expect((await request(app).get(`${API}/products/does-not-exist`)).status).toBe(404);
    expect((await request(app).get(`${API}/products/hidden-inactive-phone`)).status).toBe(404);
  });

  test('search suggestions', async () => {
    const res = await request(app).get(`${API}/products/suggestions?q=sam`);
    expect(res.body.data.products.length).toBeGreaterThan(0);
    expect(res.body.data.brands[0].name).toBe('Samsung');
  });

  test('home sections and related products', async () => {
    const home = await request(app).get(`${API}/products/home`);
    expect(home.body.data.featured[0].name).toBe('Samsung Galaxy S23 Ultra');
    expect(home.body.data.categories.find((c) => c.slug === 'mobiles').productCount).toBe(3);
    const rel = await request(app).get(`${API}/products/samsung-galaxy-m14-5g/related`);
    expect(rel.body.data.products.map((p) => p.slug)).not.toContain('samsung-galaxy-m14-5g');
    expect(rel.body.data.products[0].recommendation.reasons).toContain('same brand');
  });
});

describe('Admin product CRUD', () => {
  const payload = () => ({
    name: 'Samsung Galaxy Tab S9',
    brand: String(catalog.samsung._id),
    category: String(catalog.mobiles._id),
    subCategory: 'Tablets',
    description: 'An 11-inch AMOLED tablet with S Pen included.',
    price: 72999,
    mrp: 85999,
    stock: 12,
    images: [{ url: 'https://example.com/tab.jpg', alt: 'Tab S9' }],
    specifications: [{ label: 'Display', value: '11 inch AMOLED' }],
    tags: ['tablet'],
  });

  test('customers cannot create products', async () => {
    const res = await customer.post(`${API}/products`).send(payload());
    expect(res.status).toBe(403);
  });

  test('unauthenticated users cannot create products', async () => {
    expect((await request(app).post(`${API}/products`).send(payload())).status).toBe(401);
  });

  test('admin creates, updates and deletes a product', async () => {
    const created = await admin.post(`${API}/products`).send(payload());
    expect(created.status).toBe(201);
    const { _id, slug, discountPercent } = created.body.data.product;
    expect(slug).toBe('samsung-galaxy-tab-s9');
    expect(discountPercent).toBe(15);

    const updated = await admin.put(`${API}/products/${_id}`).send({ price: 69999, stock: 4 });
    expect(updated.status).toBe(200);
    expect(updated.body.data.product.price).toBe(69999);
    expect(updated.body.data.product.isLowStock).toBe(true);

    const del = await admin.delete(`${API}/products/${_id}`);
    expect(del.status).toBe(200);
    expect((await request(app).get(`${API}/products/samsung-galaxy-tab-s9`)).status).toBe(404);
  });

  test('rejects price above MRP and missing images', async () => {
    const res = await admin.post(`${API}/products`).send({ ...payload(), mrp: 100, images: [] });
    expect(res.status).toBe(400);
    const fields = res.body.errors.map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(['images']));
  });
});

describe('Categories & brands', () => {
  test('lists categories and brands with product counts', async () => {
    const cats = await request(app).get(`${API}/categories`);
    expect(cats.body.data.categories.map((c) => c.name)).toEqual(['Fashion', 'Mobiles']);
    const brands = await request(app).get(`${API}/brands?category=fashion`);
    expect(brands.body.data.brands.map((b) => b.name)).toEqual(["Levi's"]);
  });

  test('admin manages categories; delete blocked while in use', async () => {
    const created = await admin.post(`${API}/categories`).send({ name: 'Home Appliances' });
    expect(created.status).toBe(201);
    expect(created.body.data.category.slug).toBe('home-appliances');
    const upd = await admin.put(`${API}/categories/${created.body.data.category._id}`).send({ sortOrder: 3 });
    expect(upd.body.data.category.description).toBe('');
    expect((await admin.delete(`${API}/categories/${created.body.data.category._id}`)).status).toBe(200);
    expect((await admin.delete(`${API}/categories/${catalog.mobiles._id}`)).status).toBe(400);
  });

  test('admin manages brands; duplicates rejected', async () => {
    const created = await admin.post(`${API}/brands`).send({ name: 'Sony' });
    expect(created.status).toBe(201);
    expect((await admin.post(`${API}/brands`).send({ name: 'Sony' })).status).toBe(409);
    expect((await admin.delete(`${API}/brands/${created.body.data.brand._id}`)).status).toBe(200);
  });
});
