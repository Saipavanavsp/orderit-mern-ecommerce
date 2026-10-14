import { del, get, post, put } from './api.js';

export const authApi = {
  me: () => get('/auth/me'),
  session: () => get('/auth/session'),
  login: (body) => post('/auth/login', body),
  register: (body) => post('/auth/register', body),
  logout: () => post('/auth/logout'),
  forgotPassword: (email) => post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => post(`/auth/reset-password/${token}`, { password }),
  changePassword: (body) => put('/auth/change-password', body),
};

export const userApi = {
  updateProfile: (body) => put('/users/me', body),
  addAddress: (body) => post('/users/me/addresses', body),
  updateAddress: (id, body) => put(`/users/me/addresses/${id}`, body),
  deleteAddress: (id) => del(`/users/me/addresses/${id}`),
  notifications: (params) => get('/notifications', params),
  readAllNotifications: () => put('/notifications/read-all'),
  readNotification: (id) => put(`/notifications/${id}/read`),
};

export const catalogApi = {
  home: () => get('/products/home'),
  products: (params) => get('/products', params),
  product: (slug) => get(`/products/${slug}`),
  related: (slug) => get(`/products/${slug}/related`),
  suggestions: (q) => get('/products/suggestions', { q }),
  categories: () => get('/categories'),
  category: (slug) => get(`/categories/${slug}`),
  brands: (category) => get('/brands', category ? { category } : undefined),
};

export const shopApi = {
  cart: () => get('/cart'),
  addToCart: (productId, quantity = 1) => post('/cart/items', { productId, quantity }),
  updateCartItem: (productId, quantity) => put(`/cart/items/${productId}`, { quantity }),
  removeCartItem: (productId) => del(`/cart/items/${productId}`),
  clearCart: () => del('/cart'),
  applyCoupon: (code) => post('/cart/coupon', { code }),
  removeCoupon: () => del('/cart/coupon'),
  coupons: () => get('/coupons/available'),
  wishlist: () => get('/wishlist'),
  addToWishlist: (productId) => post(`/wishlist/${productId}`),
  removeFromWishlist: (productId) => del(`/wishlist/${productId}`),
  reviews: (productId, params) => get(`/reviews/product/${productId}`, params),
  createReview: (productId, body) => post(`/reviews/${productId}`, body),
  myReviews: () => get('/reviews/my'),
};

export const orderApi = {
  create: (body) => post('/orders', body),
  mine: (params) => get('/orders/my', params),
  get: (id) => get(`/orders/${id}`),
  cancel: (id, reason) => put(`/orders/${id}/cancel`, { reason }),
  pay: (id, body) => put(`/orders/${id}/pay`, body),
  paymentConfig: () => get('/payments/config'),
  createPayment: (orderId) => post('/payments/create-order', { orderId }),
  simulatePayment: (body) => post('/payments/simulate', body),
};

export const aiApi = {
  chat: (messages, productSlug) => post('/ai/chat', { messages, productSlug }),
  search: (params) => get('/ai/search', params),
  recommendations: (productId) => get(`/ai/recommendations/${productId}`),
  forMe: () => get('/ai/recommendations/me'),
};
