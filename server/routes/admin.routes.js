import { Router } from 'express';
import * as admin from '../controllers/admin.controller.js';
import * as products from '../controllers/product.controller.js';
import * as orders from '../controllers/order.controller.js';
import * as shopping from '../controllers/shopping.controller.js';
import { adminOnly } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
import {
  exportOrdersQuery,
  lowStockQuery,
  salesQuery,
  topProductsQuery,
  userListQuery,
  userRoleSchema,
  userStatusSchema,
} from '../validators/admin.validators.js';
import { adminProductListQuery, bulkStatusSchema, stockUpdateSchema } from '../validators/catalog.validators.js';
import { adminOrderListQuery, orderStatusSchema } from '../validators/order.validators.js';
import {
  adminReviewListQuery,
  couponCreateSchema,
  couponListQuery,
  couponUpdateSchema,
  reviewStatusSchema,
} from '../validators/shopping.validators.js';

const router = Router();
router.use(...adminOnly);

// Dashboard & analytics
router.get('/dashboard', admin.dashboard);
router.get('/analytics/summary', admin.summary);
router.get('/analytics/sales', validate({ query: salesQuery }), admin.sales);
router.get('/analytics/top-products', validate({ query: topProductsQuery }), admin.topProducts);
router.get('/analytics/categories', admin.categorySales);
router.get('/analytics/breakdowns', admin.breakdowns);

// Products & inventory (create/update/delete live on /products)
router.get('/products', validate({ query: adminProductListQuery }), products.adminListProducts);
router.put('/products/bulk-status', validate({ body: bulkStatusSchema }), products.bulkStatus);
router.get('/products/:id', validate({ params: idParam }), products.adminGetProduct);
router.patch('/products/:id/stock', validate({ params: idParam, body: stockUpdateSchema }), products.updateStock);
router.get('/inventory/low-stock', validate({ query: lowStockQuery }), products.lowStock);

// Orders
router.get('/orders', validate({ query: adminOrderListQuery }), orders.adminListOrders);
router.get('/orders/:id', validate({ params: idParam }), orders.adminGetOrder);
router.put('/orders/:id/status', validate({ params: idParam, body: orderStatusSchema }), orders.adminUpdateStatus);

// Users
router.get('/users', validate({ query: userListQuery }), admin.listUsers);
router.get('/users/:id', validate({ params: idParam }), admin.getUser);
router.put('/users/:id/status', validate({ params: idParam, body: userStatusSchema }), admin.setUserStatus);
router.put('/users/:id/role', validate({ params: idParam, body: userRoleSchema }), admin.setUserRole);

// Review moderation
router.get('/reviews', validate({ query: adminReviewListQuery }), shopping.adminListReviews);
router.put('/reviews/:id/status', validate({ params: idParam, body: reviewStatusSchema }), shopping.setReviewStatus);
router.delete('/reviews/:id', validate({ params: idParam }), shopping.adminDeleteReview);

// Coupons
router.get('/coupons', validate({ query: couponListQuery }), shopping.adminListCoupons);
router.post('/coupons', validate({ body: couponCreateSchema }), shopping.createCoupon);
router.put('/coupons/:id', validate({ params: idParam, body: couponUpdateSchema }), shopping.updateCoupon);
router.delete('/coupons/:id', validate({ params: idParam }), shopping.deleteCoupon);

// CSV exports
router.get('/export/orders', validate({ query: exportOrdersQuery }), admin.exportOrders);
router.get('/export/products', admin.exportProducts);

export default router;
