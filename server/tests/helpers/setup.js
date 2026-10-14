import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../../app.js';
import { User } from '../../models/User.js';
import { Category } from '../../models/Category.js';
import { Brand } from '../../models/Brand.js';
import { Product } from '../../models/Product.js';

export const app = createApp();
export const API = '/api/v1';
export const PASSWORD = 'Password@123';

export async function connectTestDb(name) {
  const base = process.env.TEST_MONGO_URI;
  await mongoose.connect(`${base.replace(/\/$/, '')}/${name}`);
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
}

export async function closeTestDb() {
  try {
    await mongoose.connection.dropDatabase();
  } finally {
    await mongoose.disconnect(); // always release the connection so Jest can exit
  }
}

/** Creates a user directly and returns a supertest agent holding its auth cookies. */
export async function createUserAgent({ role = 'customer', email, name = 'Test User', admin = false } = {}) {
  const userEmail = email || `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.com`;
  const user = await User.create({ name, email: userEmail, password: PASSWORD, role });
  const agent = request.agent(app);
  const req = agent.post(`${API}/auth/login`).send({ email: userEmail, password: PASSWORD });
  if (admin) req.set('X-Client-App', 'admin');
  const res = await req;
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, user, admin };
}

/** Wraps an agent so every request carries the admin app header. */
export function adminRequest(agent) {
  const wrap = (method) => (url) => agent[method](url).set('X-Client-App', 'admin');
  return { get: wrap('get'), post: wrap('post'), put: wrap('put'), delete: wrap('delete'), patch: wrap('patch') };
}

export async function createCatalog() {
  const mobiles = await Category.create({ name: 'Mobiles', subCategories: ['Smartphones'] });
  const fashion = await Category.create({ name: 'Fashion', subCategories: ['Men'] });
  const samsung = await Brand.create({ name: 'Samsung', categories: [mobiles._id] });
  const levis = await Brand.create({ name: "Levi's", categories: [fashion._id] });
  const base = { images: [{ url: 'https://example.com/p.jpg', alt: 'p' }], description: 'Test product description' };
  const products = await Product.create([
    { ...base, name: 'Samsung Galaxy M14 5G', brand: samsung._id, category: mobiles._id, subCategory: 'Smartphones', price: 13999, mrp: 17999, stock: 25, rating: 4.2, tags: ['5g', 'camera'], soldCount: 50 },
    { ...base, name: 'Samsung Galaxy S23 Ultra', brand: samsung._id, category: mobiles._id, subCategory: 'Smartphones', price: 104999, mrp: 124999, stock: 3, rating: 4.7, tags: ['camera', 'flagship'], soldCount: 10, isFeatured: true },
    { ...base, name: 'Samsung Galaxy A15', brand: samsung._id, category: mobiles._id, subCategory: 'Smartphones', price: 18999, mrp: 19999, stock: 0, rating: 3.9, tags: ['budget'] },
    { ...base, name: "Levi's 511 Slim Fit Jeans", brand: levis._id, category: fashion._id, subCategory: 'Men', price: 2499, mrp: 3999, stock: 40, rating: 4.4, tags: ['denim'] },
    { ...base, name: 'Hidden Inactive Phone', brand: samsung._id, category: mobiles._id, price: 9999, mrp: 9999, stock: 5, isActive: false },
  ]);
  return { mobiles, fashion, samsung, levis, products };
}
