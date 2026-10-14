// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import * as cartService from '../services/cart.service.js';
import * as wishlistService from '../services/wishlist.service.js';
import * as couponService from '../services/coupon.service.js';
import * as reviewService from '../services/review.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { paginationMeta, sendSuccess } from '../utils/response.js';

// ----- Cart -----
export const getCart = asyncHandler(async (req, res) => sendSuccess(res, { cart: await cartService.getCart(req.user._id) }));

export const addCartItem = asyncHandler(async (req, res) => {
  const cart = await cartService.addItem(req.user._id, req.body.productId, req.body.quantity);
  sendSuccess(res, { cart }, { status: 201, message: 'Added to cart' });
});

export const updateCartItem = asyncHandler(async (req, res) => {
  const cart = await cartService.updateItem(req.user._id, req.params.productId, req.body.quantity);
  sendSuccess(res, { cart }, { message: 'Cart updated' });
});

export const removeCartItem = asyncHandler(async (req, res) => {
  sendSuccess(res, { cart: await cartService.removeItem(req.user._id, req.params.productId) }, { message: 'Item removed' });
});

export const clearCart = asyncHandler(async (req, res) => {
  sendSuccess(res, { cart: await cartService.clearCart(req.user._id) }, { message: 'Cart cleared' });
});

export const applyCoupon = asyncHandler(async (req, res) => {
  const cart = await cartService.applyCoupon(req.user._id, req.body.code);
  sendSuccess(res, { cart }, { message: `Coupon ${req.body.code} applied` });
});

export const removeCoupon = asyncHandler(async (req, res) => {
  sendSuccess(res, { cart: await cartService.removeCoupon(req.user._id) }, { message: 'Coupon removed' });
});

// ----- Wishlist -----
export const getWishlist = asyncHandler(async (req, res) =>
  sendSuccess(res, await wishlistService.getWishlist(req.user._id)),
);

export const addToWishlist = asyncHandler(async (req, res) => {
  const data = await wishlistService.addToWishlist(req.user._id, req.params.productId);
  sendSuccess(res, data, { status: 201, message: 'Added to wishlist' });
});

export const removeFromWishlist = asyncHandler(async (req, res) => {
  const data = await wishlistService.removeFromWishlist(req.user._id, req.params.productId);
  sendSuccess(res, data, { message: 'Removed from wishlist' });
});

// ----- Coupons -----
export const availableCoupons = asyncHandler(async (_req, res) =>
  sendSuccess(res, { coupons: await couponService.listAvailable() }),
);

export const validateCoupon = asyncHandler(async (req, res) => {
  const { coupon, discount } = await couponService.validateCoupon(req.body.code, req.user._id, req.body.subtotal);
  sendSuccess(res, { code: coupon.code, description: coupon.description, discount });
});

export const adminListCoupons = asyncHandler(async (req, res) => {
  const { items, total } = await couponService.listCoupons(req.query);
  sendSuccess(res, { coupons: items }, { meta: paginationMeta(req.query.page, req.query.limit, total) });
});

export const createCoupon = asyncHandler(async (req, res) => {
  sendSuccess(res, { coupon: await couponService.createCoupon(req.body) }, { status: 201, message: 'Coupon created' });
});

export const updateCoupon = asyncHandler(async (req, res) => {
  sendSuccess(res, { coupon: await couponService.updateCoupon(req.params.id, req.body) }, { message: 'Coupon updated' });
});

export const deleteCoupon = asyncHandler(async (req, res) => {
  sendSuccess(res, await couponService.deleteCoupon(req.params.id), { message: 'Coupon deleted' });
});

// ----- Reviews -----
export const productReviews = asyncHandler(async (req, res) => {
  const { items, total, distribution } = await reviewService.listProductReviews(req.params.productId, req.query);
  sendSuccess(res, { reviews: items, distribution }, { meta: paginationMeta(req.query.page, req.query.limit, total) });
});

export const createReview = asyncHandler(async (req, res) => {
  const review = await reviewService.createReview(req.user._id, req.params.productId, req.body);
  sendSuccess(res, { review }, { status: 201, message: 'Thanks! Your review will appear after moderation.' });
});

export const myReviews = asyncHandler(async (req, res) =>
  sendSuccess(res, { reviews: await reviewService.myReviews(req.user._id) }),
);

export const updateReview = asyncHandler(async (req, res) => {
  const review = await reviewService.updateOwnReview(req.user._id, req.params.id, req.body);
  sendSuccess(res, { review }, { message: 'Review updated and sent for moderation' });
});

export const deleteReview = asyncHandler(async (req, res) => {
  sendSuccess(res, await reviewService.deleteOwnReview(req.user._id, req.params.id), { message: 'Review deleted' });
});

export const adminListReviews = asyncHandler(async (req, res) => {
  const { items, total, counts } = await reviewService.adminListReviews(req.query);
  sendSuccess(res, { reviews: items, counts }, { meta: paginationMeta(req.query.page, req.query.limit, total) });
});

export const setReviewStatus = asyncHandler(async (req, res) => {
  const review = await reviewService.setReviewStatus(req.params.id, req.body.status);
  sendSuccess(res, { review }, { message: `Review ${req.body.status}` });
});

export const adminDeleteReview = asyncHandler(async (req, res) => {
  sendSuccess(res, await reviewService.adminDeleteReview(req.params.id), { message: 'Review deleted' });
});
