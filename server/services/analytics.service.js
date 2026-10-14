// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { Order } from '../models/Order.js';
import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { Review } from '../models/Review.js';
import { env } from '../config/env.js';

const TZ = 'Asia/Kolkata';
const PAID = { paymentStatus: 'paid' };

function sinceDays(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (days - 1));
  return d;
}

export async function summary() {
  const [revenueAgg, orders, pendingOrders, users, products, lowStock, outOfStock, pendingReviews, todayAgg] =
    await Promise.all([
      Order.aggregate([{ $match: PAID }, { $group: { _id: null, revenue: { $sum: '$totalPrice' }, count: { $sum: 1 } } }]),
      Order.countDocuments(),
      Order.countDocuments({ status: { $in: ['pending', 'processing'] } }),
      User.countDocuments({ role: 'customer' }),
      Product.countDocuments({ isActive: true }),
      Product.countDocuments({ stock: { $gt: 0, $lte: env.lowStockThreshold } }),
      Product.countDocuments({ stock: 0 }),
      Review.countDocuments({ status: 'pending' }),
      Order.aggregate([
        { $match: { ...PAID, paidAt: { $gte: sinceDays(1) } } },
        { $group: { _id: null, revenue: { $sum: '$totalPrice' }, count: { $sum: 1 } } },
      ]),
    ]);
  const revenue = revenueAgg[0]?.revenue || 0;
  const paidOrders = revenueAgg[0]?.count || 0;
  return {
    revenue: Math.round(revenue),
    paidOrders,
    averageOrderValue: paidOrders ? Math.round(revenue / paidOrders) : 0,
    orders,
    pendingOrders,
    users,
    products,
    lowStock,
    outOfStock,
    pendingReviews,
    todayRevenue: Math.round(todayAgg[0]?.revenue || 0),
    todayOrders: todayAgg[0]?.count || 0,
  };
}

/** Revenue and order count per day (or month), with empty buckets filled with zeros. */
export async function salesSeries({ days = 30, groupBy = 'day' } = {}) {
  const from = sinceDays(days);
  const format = groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d';
  const rows = await Order.aggregate([
    { $match: { ...PAID, paidAt: { $gte: from } } },
    {
      $group: {
        _id: { $dateToString: { format, date: '$paidAt', timezone: TZ } },
        revenue: { $sum: '$totalPrice' },
        orders: { $sum: 1 },
        items: { $sum: { $sum: '$items.quantity' } },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  const byKey = new Map(rows.map((r) => [r._id, r]));
  const series = [];
  const cursor = new Date(from);
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  while (cursor <= new Date()) {
    const dayKey = fmt.format(cursor);
    const key = groupBy === 'month' ? dayKey.slice(0, 7) : dayKey;
    if (!series.length || series[series.length - 1].date !== key) {
      const r = byKey.get(key);
      series.push({ date: key, revenue: Math.round(r?.revenue || 0), orders: r?.orders || 0, items: r?.items || 0 });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return series;
}

export async function topProducts(limit = 5) {
  return Order.aggregate([
    { $match: PAID },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product',
        name: { $first: '$items.name' },
        image: { $first: '$items.image' },
        unitsSold: { $sum: '$items.quantity' },
        revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: limit },
  ]);
}

export async function categorySales() {
  return Order.aggregate([
    { $match: PAID },
    { $unwind: '$items' },
    { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'p' } },
    { $unwind: { path: '$p', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'categories', localField: 'p.category', foreignField: '_id', as: 'c' } },
    { $unwind: { path: '$c', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: { $ifNull: ['$c.name', 'Uncategorised'] },
        revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        units: { $sum: '$items.quantity' },
      },
    },
    { $project: { _id: 0, category: '$_id', revenue: { $round: ['$revenue', 0] }, units: 1 } },
    { $sort: { revenue: -1 } },
  ]);
}

export async function statusBreakdown() {
  const rows = await Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  return rows.map((r) => ({ status: r._id, count: r.count }));
}

export async function paymentMethodBreakdown() {
  const rows = await Order.aggregate([
    { $match: { status: { $ne: 'cancelled' } } },
    { $group: { _id: '$paymentMethod', count: { $sum: 1 }, value: { $sum: '$totalPrice' } } },
  ]);
  return rows.map((r) => ({ method: r._id, count: r.count, value: Math.round(r.value) }));
}

export async function recentOrders(limit = 6) {
  return Order.find()
    .select('orderNumber totalPrice status paymentStatus paymentMethod createdAt user')
    .populate({ path: 'user', select: 'name email' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

export async function dashboard() {
  const [stats, sales, top, status, recent, lowStockProducts] = await Promise.all([
    summary(),
    salesSeries({ days: 30 }),
    topProducts(5),
    statusBreakdown(),
    recentOrders(),
    Product.find({ stock: { $lte: env.lowStockThreshold } }).select('name slug stock images').sort({ stock: 1 }).limit(6).lean(),
  ]);
  return { stats, sales, topProducts: top, statusBreakdown: status, recentOrders: recent, lowStockProducts };
}
