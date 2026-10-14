// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { api, del, download, get, patch, post, put } from './api.js';

export const authApi = {
  me: () => get('/auth/me'),
  session: () => get('/auth/session'),
  login: (body) => post('/auth/login', body),
  logout: () => post('/auth/logout'),
};

export const dashboardApi = {
  dashboard: () => get('/admin/dashboard'),
  sales: (params) => get('/admin/analytics/sales', params),
  topProducts: (limit = 10) => get('/admin/analytics/top-products', { limit }),
  categories: () => get('/admin/analytics/categories'),
  breakdowns: () => get('/admin/analytics/breakdowns'),
};

export const productApi = {
  list: (params) => get('/admin/products', params),
  get: (id) => get(`/admin/products/${id}`),
  create: (body) => post('/products', body),
  update: (id, body) => put(`/products/${id}`, body),
  remove: (id) => del(`/products/${id}`),
  bulkStatus: (ids, isActive) => put('/admin/products/bulk-status', { ids, isActive }),
  setStock: (id, stock) => patch(`/admin/products/${id}/stock`, { stock }),
  lowStock: (threshold) => get('/admin/inventory/low-stock', threshold ? { threshold } : undefined),
  exportCsv: () => download('/admin/export/products', undefined, 'products.csv'),
};

export const catalogApi = {
  categories: () => get('/categories', { all: 'true' }),
  createCategory: (body) => post('/categories', body),
  updateCategory: (id, body) => put(`/categories/${id}`, body),
  deleteCategory: (id) => del(`/categories/${id}`),
  brands: () => get('/brands', { all: 'true' }),
  createBrand: (body) => post('/brands', body),
  updateBrand: (id, body) => put(`/brands/${id}`, body),
  deleteBrand: (id) => del(`/brands/${id}`),
};

export const orderApi = {
  list: (params) => get('/admin/orders', params),
  get: (id) => get(`/admin/orders/${id}`),
  setStatus: (id, body) => put(`/admin/orders/${id}/status`, body),
  exportCsv: (params) => download('/admin/export/orders', params, 'orders.csv'),
};

export const userApi = {
  list: (params) => get('/admin/users', params),
  get: (id) => get(`/admin/users/${id}`),
  setStatus: (id, isActive) => put(`/admin/users/${id}/status`, { isActive }),
  setRole: (id, role) => put(`/admin/users/${id}/role`, { role }),
};

export const reviewApi = {
  list: (params) => get('/admin/reviews', params),
  setStatus: (id, status) => put(`/admin/reviews/${id}/status`, { status }),
  remove: (id) => del(`/admin/reviews/${id}`),
};

export const couponApi = {
  list: (params) => get('/admin/coupons', params),
  create: (body) => post('/admin/coupons', body),
  update: (id, body) => put(`/admin/coupons/${id}`, body),
  remove: (id) => del(`/admin/coupons/${id}`),
};

export const uploadApi = {
  images: (files) => {
    const form = new FormData();
    [...files].forEach((f) => form.append('images', f));
    return api.post('/uploads/images', form).then((r) => r.data);
  },
};
