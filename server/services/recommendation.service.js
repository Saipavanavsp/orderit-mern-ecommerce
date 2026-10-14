import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { Order } from '../models/Order.js';
import { toPublic } from './product.service.js';

const CARD_FIELDS = 'name slug brand category subCategory price mrp discountPercent stock images rating numReviews tags';

/** Products bought in the same (non-cancelled) orders as productId, with co-occurrence counts. */
export async function coPurchaseCounts(productId) {
  const id = new mongoose.Types.ObjectId(String(productId));
  const rows = await Order.aggregate([
    { $match: { 'items.product': id, status: { $ne: 'cancelled' } } },
    { $unwind: '$items' },
    { $match: { 'items.product': { $ne: id } } },
    { $group: { _id: '$items.product', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 50 },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
}

function jaccard(a = [], b = []) {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a.map((t) => t.toLowerCase()));
  const setB = new Set(b.map((t) => t.toLowerCase()));
  let inter = 0;
  setA.forEach((t) => setB.has(t) && (inter += 1));
  return inter / (setA.size + setB.size - inter);
}

/**
 * Content-based similarity (category, sub-category, brand, tags, price band) blended with
 * co-purchase signal. Weights are documented in docs/capstone and tuned for explainability.
 */
export function similarityScore(base, candidate, coCount = 0) {
  let score = 0;
  const reasons = [];
  if (String(candidate.category?._id || candidate.category) === String(base.category?._id || base.category)) score += 2;
  if (base.subCategory && candidate.subCategory === base.subCategory) {
    score += 3;
    reasons.push('similar type');
  }
  if (String(candidate.brand?._id || candidate.brand) === String(base.brand?._id || base.brand)) {
    score += 1.5;
    reasons.push('same brand');
  }
  const tagSim = jaccard(base.tags, candidate.tags);
  score += tagSim * 3;
  if (tagSim > 0.2) reasons.push('shared features');
  const ratio = Math.min(base.price, candidate.price) / Math.max(base.price, candidate.price);
  score += ratio * 2; // 1.0 when prices match, approaches 0 as the gap widens
  if (ratio > 0.7) reasons.push('similar price');
  if (coCount) {
    score += Math.min(4, Math.log2(1 + coCount) * 2);
    reasons.push('frequently bought together');
  }
  score += (candidate.rating || 0) * 0.2;
  return { score, reasons };
}

/** "Recommended for you": merges item-to-item recommendations for recent purchases and wishlist items. */
export async function recommendForUser(userId, { limit = 8 } = {}) {
  const [orders, wishlist] = await Promise.all([
    Order.find({ user: userId, status: { $ne: 'cancelled' } }).sort({ createdAt: -1 }).limit(5).select('items.product').lean(),
    mongoose.model('Wishlist').findOne({ user: userId }).select('products').lean(),
  ]);
  const seeds = [...new Set([...orders.flatMap((o) => o.items.map((i) => String(i.product))), ...(wishlist?.products || []).map(String)])].slice(0, 6);
  if (!seeds.length) return { products: [], basedOn: 0 };
  const owned = new Set(seeds);
  const merged = new Map();
  for (const seed of seeds) {
    for (const p of await recommendForProduct(seed, { limit: 6 })) {
      if (owned.has(String(p._id))) continue;
      const prev = merged.get(String(p._id));
      if (!prev || prev.recommendation.score < p.recommendation.score) merged.set(String(p._id), p);
    }
  }
  const products = [...merged.values()].sort((a, b) => b.recommendation.score - a.recommendation.score).slice(0, limit);
  return { products, basedOn: seeds.length };
}

export async function recommendForProduct(productId, { limit = 8 } = {}) {
  const base = await Product.findById(productId).lean();
  if (!base) return [];
  const co = await coPurchaseCounts(productId);
  const coIds = [...co.keys()].map((k) => new mongoose.Types.ObjectId(k));
  const candidates = await Product.find({
    _id: { $ne: base._id },
    isActive: true,
    $or: [{ category: base.category }, { _id: { $in: coIds } }],
  })
    .select(CARD_FIELDS)
    .populate([
      { path: 'brand', select: 'name slug' },
      { path: 'category', select: 'name slug' },
    ])
    .limit(300)
    .lean();

  return candidates
    .map((c) => ({ c, ...similarityScore(base, c, co.get(String(c._id)) || 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ c, score, reasons }) => ({ ...toPublic(c), recommendation: { score: Math.round(score * 100) / 100, reasons } }));
}
