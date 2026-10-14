import { Wishlist } from '../models/Wishlist.js';
import { Product } from '../models/Product.js';
import { ApiError } from '../utils/ApiError.js';
import { toPublic } from './product.service.js';

async function view(userId) {
  const wishlist =
    (await Wishlist.findOne({ user: userId }).populate({
      path: 'products',
      match: { isActive: true },
      select: 'name slug price mrp discountPercent stock images rating numReviews brand',
      populate: { path: 'brand', select: 'name slug' },
    })) || { products: [] };
  return { products: wishlist.products.map((p) => toPublic(p)), count: wishlist.products.length };
}

export const getWishlist = (userId) => view(userId);

export async function addToWishlist(userId, productId) {
  if (!(await Product.exists({ _id: productId, isActive: true }))) throw ApiError.notFound('Product not found');
  await Wishlist.updateOne({ user: userId }, { $addToSet: { products: productId } }, { upsert: true });
  return view(userId);
}

export async function removeFromWishlist(userId, productId) {
  await Wishlist.updateOne({ user: userId }, { $pull: { products: productId } });
  return view(userId);
}
