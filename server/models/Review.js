import mongoose from 'mongoose';

export const REVIEW_STATUSES = ['pending', 'approved', 'rejected'];

const reviewSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true, maxlength: 120, default: '' },
    comment: { type: String, required: true, trim: true, minlength: 3, maxlength: 2000 },
    status: { type: String, enum: REVIEW_STATUSES, default: 'pending', index: true },
    isVerifiedPurchase: { type: Boolean, default: false },
    source: { type: String, default: '' },
  },
  { timestamps: true },
);

reviewSchema.index({ product: 1, user: 1 }, { unique: true });

/** Recomputes rating/numReviews on the product from approved reviews only. */
reviewSchema.statics.recalculateProductRating = async function recalculate(productId) {
  const [stats] = await this.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(String(productId)), status: 'approved' } },
    { $group: { _id: '$product', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  await mongoose.model('Product').updateOne(
    { _id: productId },
    { rating: stats ? Math.round(stats.avg * 10) / 10 : 0, numReviews: stats ? stats.count : 0 },
  );
};

export const Review = mongoose.model('Review', reviewSchema);
export default Review;
