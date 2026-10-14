import mongoose from 'mongoose';
import { Review } from '../models/Review.js';
import { Product } from '../models/Product.js';
import { Order } from '../models/Order.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex } from '../utils/format.js';
import { notify } from './notification.service.js';

const SORTS = { newest: { createdAt: -1 }, highest: { rating: -1, createdAt: -1 }, lowest: { rating: 1, createdAt: -1 } };

export async function listProductReviews(productId, { page, limit, sort = 'newest' }) {
  const filter = { product: productId, status: 'approved' };
  const [items, total, dist] = await Promise.all([
    Review.find(filter)
      .populate({ path: 'user', select: 'name' })
      .sort(SORTS[sort] || SORTS.newest)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Review.countDocuments(filter),
    Review.aggregate([
      { $match: { product: new mongoose.Types.ObjectId(String(productId)), status: 'approved' } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
    ]),
  ]);
  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  dist.forEach((d) => {
    distribution[d._id] = d.count;
  });
  return { items, total, distribution };
}

export async function createReview(userId, productId, { rating, title, comment }) {
  const product = await Product.findOne({ _id: productId, isActive: true }).select('_id name');
  if (!product) throw ApiError.notFound('Product not found');
  if (await Review.exists({ product: productId, user: userId })) {
    throw ApiError.conflict('You have already reviewed this product. Edit your existing review instead.');
  }
  const purchased = await Order.exists({
    user: userId,
    'items.product': productId,
    $or: [{ isPaid: true }, { status: 'delivered' }],
  });
  return Review.create({
    product: productId,
    user: userId,
    rating,
    title,
    comment,
    isVerifiedPurchase: Boolean(purchased),
    status: 'pending',
  });
}

export async function myReviews(userId) {
  return Review.find({ user: userId }).populate({ path: 'product', select: 'name slug images' }).sort({ createdAt: -1 }).lean();
}

export async function updateOwnReview(userId, reviewId, updates) {
  const review = await Review.findOne({ _id: reviewId, user: userId });
  if (!review) throw ApiError.notFound('Review not found');
  Object.assign(review, updates, { status: 'pending' }); // edited reviews are re-moderated
  await review.save();
  await Review.recalculateProductRating(review.product);
  return review;
}

export async function deleteOwnReview(userId, reviewId) {
  const review = await Review.findOneAndDelete({ _id: reviewId, user: userId });
  if (!review) throw ApiError.notFound('Review not found');
  await Review.recalculateProductRating(review.product);
  return { id: reviewId };
}

// ---------- Admin moderation ----------
export async function adminListReviews({ page, limit, status, rating, search }) {
  const filter = {};
  if (status && status !== 'all') filter.status = status;
  if (rating) filter.rating = rating;
  if (search) filter.comment = new RegExp(escapeRegex(search), 'i');
  const [items, total, counts] = await Promise.all([
    Review.find(filter)
      .populate({ path: 'user', select: 'name email' })
      .populate({ path: 'product', select: 'name slug images' })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Review.countDocuments(filter),
    Review.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);
  return { items, total, counts: Object.fromEntries(counts.map((c) => [c._id, c.count])) };
}

export async function setReviewStatus(reviewId, status) {
  const review = await Review.findById(reviewId).populate({ path: 'product', select: 'name slug' });
  if (!review) throw ApiError.notFound('Review not found');
  review.status = status;
  await review.save();
  await Review.recalculateProductRating(review.product._id);
  notify(review.user, {
    type: 'review',
    title: `Review ${status}`,
    message: `Your review of ${review.product.name} was ${status}.`,
    link: `/product/${review.product.slug}`,
  });
  return review;
}

export async function adminDeleteReview(reviewId) {
  const review = await Review.findByIdAndDelete(reviewId);
  if (!review) throw ApiError.notFound('Review not found');
  await Review.recalculateProductRating(review.product);
  return { id: reviewId };
}
