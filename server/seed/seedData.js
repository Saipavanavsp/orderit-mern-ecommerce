// Seeds the database from the curated dataset in server/seed/data/.
//   npm run seed            -> clears seed collections, then inserts everything
//   npm run seed:destroy    -> only clears the collections
// Refuses to run against NODE_ENV=production unless --force is passed.
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { User, Category, Brand, Product, Cart, Wishlist, Order, Review, Coupon, Payment, Notification } from '../models/index.js';
import { computeTotals } from '../services/pricing.service.js';
import { CATEGORY_INFO, DATA_DIR } from './pipeline/config.js';

export const ADMIN = { name: 'Store Admin', email: 'admin@shopverse.com', password: 'ShopVerse@Admin2026' };
export const CUSTOMER_PASSWORD = 'Customer@123';
const CUSTOMERS = [
  ['Aarav Sharma', 'aarav.sharma@example.com', '9810012345', 'New Delhi', 'Delhi', '110017', 'B-42, Malviya Nagar'],
  ['Diya Patel', 'diya.patel@example.com', '9898023456', 'Ahmedabad', 'Gujarat', '380015', '12 Satellite Road'],
  ['Rohan Iyer', 'rohan.iyer@example.com', '9840034567', 'Chennai', 'Tamil Nadu', '600040', '7 Anna Nagar 2nd Avenue'],
  ['Ananya Reddy', 'ananya.reddy@example.com', '9849045678', 'Hyderabad', 'Telangana', '500034', 'Plot 18, Banjara Hills'],
  ['Kabir Mehta', 'kabir.mehta@example.com', '9820056789', 'Mumbai', 'Maharashtra', '400050', '21 Hill Road, Bandra West'],
  ['Ishita Banerjee', 'ishita.banerjee@example.com', '9830067890', 'Kolkata', 'West Bengal', '700019', '5 Ballygunge Place'],
  ['Vihaan Gupta', 'vihaan.gupta@example.com', '9876078901', 'Jaipur', 'Rajasthan', '302017', '33 Malviya Nagar Sector 6'],
  ['Meera Nair', 'meera.nair@example.com', '9847089012', 'Kochi', 'Kerala', '682020', 'Kadavanthra, Ponoth Road'],
  ['Arjun Singh', 'arjun.singh@example.com', '9815090123', 'Chandigarh', 'Chandigarh', '160022', 'House 210, Sector 35'],
  ['Saanvi Kulkarni', 'saanvi.kulkarni@example.com', '9822001234', 'Pune', 'Maharashtra', '411004', '9 Prabhat Road, Erandwane'],
];
const CATEGORY_CODES = { Mobiles: 'MOB', Electronics: 'ELE', 'TV & Appliances': 'TVA', 'Home Appliances': 'HOM', Fashion: 'FAS', Accessories: 'ACC' };
const MODELS = [Notification, Payment, Order, Review, Cart, Wishlist, Coupon, Product, Brand, Category, User];

// Small deterministic PRNG so demo orders are identical on every run.
function prng(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const DAY = 86_400_000;
const log = (...a) => console.log('[seed]', ...a);

function loadData() {
  const productsPath = path.join(DATA_DIR, 'products.json');
  if (!fs.existsSync(productsPath)) throw new Error(`Missing ${productsPath}. Run "npm run dataset:build" or restore the file from git.`);
  const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
  const reviewsPath = path.join(DATA_DIR, 'reviews.json');
  const reviews = fs.existsSync(reviewsPath) ? JSON.parse(fs.readFileSync(reviewsPath, 'utf8')) : {};
  if (env.imageSource !== 'licensed') return { products, reviews };

  // Licensed-image mode: only products with an approved licensed image mapping are seeded.
  const mapPath = path.join(DATA_DIR, 'licensed-images.json');
  const map = fs.existsSync(mapPath) ? JSON.parse(fs.readFileSync(mapPath, 'utf8')) : {};
  const licensed = products
    .filter((p) => map[p.source.sourceId]?.length)
    .map((p) => ({
      ...p,
      images: map[p.source.sourceId].map((i) => ({ url: i.url, alt: p.name })),
      source: { ...p.source, imageLicense: map[p.source.sourceId][0].license || 'licensed' },
    }));
  log(`IMAGE_SOURCE=licensed: ${licensed.length}/${products.length} products have approved licensed images.`);
  return { products: licensed, reviews };
}

async function destroy() {
  for (const Model of MODELS) {
    const { deletedCount } = await Model.deleteMany({});
    log(`cleared ${Model.collection.name.padEnd(14)} (${deletedCount})`);
  }
}

async function seedUsers() {
  const admin = await User.create({ ...ADMIN, role: 'admin', phone: '9000000001' });
  const customers = [];
  for (const [name, email, phone, city, state, postalCode, line1] of CUSTOMERS) {
    customers.push(
      await User.create({
        name, email, phone, password: CUSTOMER_PASSWORD,
        addresses: [{ label: 'Home', fullName: name, phone, line1, city, state, postalCode, isDefault: true }],
      }),
    );
  }
  return { admin, customers };
}

async function seedCatalog(data) {
  const subByCat = {};
  data.forEach((p) => ((subByCat[p.category] ||= new Set()).add(p.subCategory)));
  const categories = {};
  for (const [name, info] of Object.entries(CATEGORY_INFO)) {
    const sample = data.find((p) => p.category === name && p.isFeatured) || data.find((p) => p.category === name);
    categories[name] = await Category.create({
      name, description: info.description, sortOrder: info.sortOrder,
      subCategories: [...(subByCat[name] || [])], image: sample?.images[0]?.url || '',
    });
  }
  const brandCats = {};
  data.forEach((p) => ((brandCats[p.brand] ||= new Set()).add(p.category)));
  const brands = {};
  for (const [name, cats] of Object.entries(brandCats).sort()) {
    brands[name] = await Brand.create({ name, categories: [...cats].map((c) => categories[c]._id) });
  }

  // Validate through the model (slug, discount%, schema rules), then insert raw so createdAt can be backdated.
  const rand = prng(42);
  const counters = {};
  const docs = [];
  for (const p of data) {
    counters[p.category] = (counters[p.category] || 0) + 1;
    const doc = new Product({
      name: p.name,
      sku: `OI-${CATEGORY_CODES[p.category]}-${String(counters[p.category]).padStart(3, '0')}`,
      brand: brands[p.brand]._id,
      category: categories[p.category]._id,
      subCategory: p.subCategory,
      description: p.description,
      highlights: p.highlights,
      price: p.price,
      mrp: p.mrp,
      stock: p.stock,
      images: p.images,
      specifications: p.specifications,
      tags: p.tags,
      isFeatured: Boolean(p.isFeatured),
      source: p.source,
    });
    await doc.validate();
    const created = new Date(Date.now() - Math.floor(rand() * 120) * DAY - Math.floor(rand() * DAY));
    docs.push({ ...doc.toObject({ virtuals: false }), createdAt: created, updatedAt: created });
  }
  // Slugs must be unique: suffix duplicates deterministically.
  const slugs = new Map();
  docs.forEach((d) => {
    const n = slugs.get(d.slug) || 0;
    slugs.set(d.slug, n + 1);
    if (n) d.slug = `${d.slug}-${n + 1}`;
  });
  await Product.collection.insertMany(docs);
  return { categories, brands, products: await Product.find().lean() };
}

async function seedReviews(products, reviewsBySource, customers) {
  const docs = [];
  products.forEach((p, pi) => {
    const list = reviewsBySource[p.source?.sourceId] || [];
    list.slice(0, customers.length).forEach((r, ri) => {
      const user = customers[(pi + ri) % customers.length];
      const at = new Date(r.createdAt);
      docs.push({
        product: p._id, user: user._id, rating: r.rating, title: r.title || '', comment: r.comment,
        status: 'approved', isVerifiedPurchase: r.verified, source: 'amazon-reviews-2023',
        createdAt: Number.isNaN(at.getTime()) ? new Date() : at, updatedAt: new Date(),
      });
    });
  });
  if (docs.length) await Review.collection.insertMany(docs);
  // Ratings are computed from the seeded (approved) reviews, exactly like the live app does.
  const stats = await Review.aggregate([{ $match: { status: 'approved' } }, { $group: { _id: '$product', avg: { $avg: '$rating' }, n: { $sum: 1 } } }]);
  if (stats.length) {
    await Product.bulkWrite(stats.map((s) => ({ updateOne: { filter: { _id: s._id }, update: { rating: Math.round(s.avg * 10) / 10, numReviews: s.n } } })));
  }
  return docs.length;
}

async function seedCoupons() {
  const now = Date.now();
  return Coupon.insertMany([
    { code: 'WELCOME10', description: '10% off your first order, up to ₹1,000', discountType: 'percent', discountValue: 10, maxDiscount: 1000, minOrderValue: 999, expiresAt: new Date(now + 180 * DAY), perUserLimit: 1 },
    { code: 'FLAT500', description: '₹500 off on orders above ₹4,999', discountType: 'flat', discountValue: 500, minOrderValue: 4999, expiresAt: new Date(now + 90 * DAY), perUserLimit: 2 },
    { code: 'FESTIVE15', description: '15% off electronics season sale, up to ₹3,000', discountType: 'percent', discountValue: 15, maxDiscount: 3000, minOrderValue: 9999, expiresAt: new Date(now + 60 * DAY), usageLimit: 500, perUserLimit: 1 },
    { code: 'SAVE200', description: '₹200 off on orders above ₹1,499', discountType: 'flat', discountValue: 200, minOrderValue: 1499, expiresAt: new Date(now + 120 * DAY), perUserLimit: 0 },
    { code: 'MONSOON20', description: 'Expired monsoon offer', discountType: 'percent', discountValue: 20, maxDiscount: 2000, expiresAt: new Date(now - 10 * DAY), startsAt: new Date(now - 70 * DAY) },
    { code: 'STAFF50', description: 'Internal test coupon (inactive)', discountType: 'percent', discountValue: 50, maxDiscount: 5000, expiresAt: new Date(now + 365 * DAY), isActive: false },
  ]);
}

/** Demo order history so dashboards, analytics and co-purchase recommendations have data. */
async function seedOrders(products, customers) {
  const rand = prng(7);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const inStock = products.filter((p) => p.stock > 0);
  const orders = [];
  const payments = [];
  const sold = {};
  for (let i = 0; i < 72; i += 1) {
    const user = pick(customers);
    const created = new Date(Date.now() - Math.floor(rand() * 45) * DAY - Math.floor(rand() * 20) * 3_600_000);
    const first = pick(inStock);
    // Co-purchases: second item usually from the same category
    const pool = rand() < 0.7 ? inStock.filter((p) => String(p.category) === String(first.category) && p._id !== first._id) : inStock;
    const lines = [first, ...(rand() < 0.45 ? [pick(pool)] : [])].filter((p, idx, arr) => arr.findIndex((x) => x._id === p._id) === idx);
    const items = lines.map((p) => ({ product: p._id, name: p.name, slug: p.slug, image: p.images[0]?.url || '', price: p.price, quantity: p.price > 20000 ? 1 : 1 + Math.floor(rand() * 2) }));
    const totals = computeTotals(items, 0);
    const r = rand();
    const status = r < 0.55 ? 'delivered' : r < 0.7 ? 'shipped' : r < 0.85 ? 'processing' : r < 0.93 ? 'cancelled' : 'pending';
    const method = status === 'pending' ? 'razorpay' : rand() < 0.65 ? 'razorpay' : 'cod';
    // Mirrors the live app: online orders are paid before processing; COD is paid on delivery;
    // a cancelled paid order keeps isPaid and is marked refunded.
    const paidOnline = method === 'razorpay' && status !== 'pending';
    const isPaid = paidOnline || (method === 'cod' && status === 'delivered');
    const paymentStatus = status === 'cancelled' ? (paidOnline ? 'refunded' : 'failed') : isPaid ? 'paid' : 'pending';
    const at = (h) => new Date(created.getTime() + h * 3_600_000);
    const history = [{ status: 'pending', note: 'Order placed', at: at(0) }];
    if (['processing', 'shipped', 'delivered'].includes(status)) history.push({ status: 'processing', note: method === 'cod' ? 'Cash on delivery order confirmed' : 'Payment received via razorpay', at: at(0.2) });
    if (['shipped', 'delivered'].includes(status)) history.push({ status: 'shipped', note: 'Handed to courier', at: at(30) });
    if (status === 'delivered') history.push({ status: 'delivered', note: '', at: at(90) });
    if (status === 'cancelled') history.push({ status: 'cancelled', note: 'Cancelled by customer', at: at(2) });
    const orderId = new mongoose.Types.ObjectId();
    orders.push({
      _id: orderId,
      orderNumber: `OIS${String(created.getFullYear()).slice(2)}${String(created.getMonth() + 1).padStart(2, '0')}${String(created.getDate()).padStart(2, '0')}${String(i).padStart(3, '0')}`,
      user: user._id, items, shippingAddress: (({ fullName, phone, line1, line2, city, state, postalCode, country }) => ({ fullName, phone, line1, line2, city, state, postalCode, country }))(user.addresses[0]),
      paymentMethod: method, itemsPrice: totals.subtotal, discount: 0, couponCode: '', taxPrice: totals.tax, shippingPrice: totals.shipping, totalPrice: totals.total,
      status, statusHistory: history, paymentStatus,
      isPaid, paidAt: isPaid ? (method === 'cod' ? at(90) : at(0.2)) : undefined, deliveredAt: status === 'delivered' ? at(90) : undefined,
      cancelledAt: status === 'cancelled' ? at(2) : undefined, cancelReason: status === 'cancelled' ? 'Cancelled by customer' : '',
      trackingNumber: ['shipped', 'delivered'].includes(status) ? `BLUEDART${100000 + i}` : '',
      inventoryReserved: false, // historic demo orders do not touch current stock levels
      paymentResult: { provider: method === 'cod' ? 'cod' : 'simulation', providerOrderId: '', paymentId: '' },
      createdAt: created, updatedAt: created, __v: 0,
    });
    payments.push({
      order: orderId, user: user._id, provider: method === 'cod' ? 'cod' : 'simulation', providerOrderId: method === 'cod' ? '' : `sim_order_seed${i}`,
      providerPaymentId: paidOnline ? `sim_pay_seed${i}` : '', amount: totals.total, currency: 'INR',
      status: paymentStatus === 'pending' ? 'created' : paymentStatus, createdAt: created, updatedAt: created,
    });
    if (status !== 'cancelled') items.forEach((it) => (sold[it.product] = (sold[it.product] || 0) + it.quantity));
  }
  await Order.collection.insertMany(orders);
  await Payment.collection.insertMany(payments);
  await Product.bulkWrite(Object.entries(sold).map(([id, n]) => ({ updateOne: { filter: { _id: new mongoose.Types.ObjectId(id) }, update: { soldCount: n * 3 + Math.floor(n) } } })));
  return orders.length;
}

async function main() {
  const destroyOnly = process.argv.includes('--destroy');
  if (env.isProd && !process.argv.includes('--force')) {
    throw new Error('Refusing to seed/destroy with NODE_ENV=production. Re-run with --force if you are sure.');
  }
  const safeUri = env.mongoUri.replace(/\/\/[^@]*@/, '//<credentials>@');
  log(`Connecting to ${safeUri}`);
  try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 5000 });
  } catch (err) {
    throw new Error(
      `Cannot connect to MongoDB (${err.message}).\n  Start it with "net start MongoDB" (Administrator PowerShell) or "npm run db:local",\n  or set an Atlas MONGO_URI in server/.env.`,
      { cause: err },
    );
  }
  await Promise.all(MODELS.map((m) => m.init()));

  log('Clearing existing data...');
  await destroy();
  if (destroyOnly) {
    log('Destroy complete. All seed collections are empty.');
    return;
  }

  const { products: data, reviews } = loadData();
  if (data.length < 1) throw new Error('No products to seed.');
  const { admin, customers } = await seedUsers();
  log(`users: 1 admin + ${customers.length} customers`);
  const { categories, brands, products } = await seedCatalog(data);
  log(`categories: ${Object.keys(categories).length}, brands: ${Object.keys(brands).length}, products: ${products.length}`);
  const reviewCount = await seedReviews(products, reviews, customers);
  log(`reviews: ${reviewCount} (from the Amazon Reviews 2023 dataset, approved)`);
  const coupons = await seedCoupons();
  log(`coupons: ${coupons.map((c) => c.code).join(', ')}`);
  const orderCount = await seedOrders(products, customers);
  log(`demo orders: ${orderCount}`);
  await Notification.insertMany([admin, ...customers].map((u) => ({ user: u._id, type: 'account', title: 'Welcome to OrderIt', message: 'Your account is ready. Happy shopping!' })));

  const perCat = await Product.aggregate([{ $group: { _id: '$category', n: { $sum: 1 } } }]);
  const catName = Object.fromEntries(Object.values(categories).map((c) => [String(c._id), c.name]));
  log('products per category:', perCat.map((c) => `${catName[String(c._id)]}=${c.n}`).join(', '));
  log('---------------------------------------------------------------');
  log(`Admin login     : ${ADMIN.email} / ${ADMIN.password}`);
  log(`Customer logins : ${CUSTOMERS[0][1]} (and 9 more) / ${CUSTOMER_PASSWORD}`);
  log('Seeding completed successfully.');
}

main()
  .catch((err) => {
    console.error(`[seed] ERROR: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
