// OpenAPI 3 spec built from one route registry. Request schemas are generated from the SAME Zod
// validators the routes use, so docs cannot drift from validation. tests/docs.test.js asserts that
// every Express route is listed here. The Postman collection is generated from this registry too.
import { z } from 'zod';
import { env } from '../config/env.js';
import * as authV from '../validators/auth.validators.js';
import * as userV from '../validators/user.validators.js';
import * as catV from '../validators/catalog.validators.js';
import * as shopV from '../validators/shopping.validators.js';
import * as orderV from '../validators/order.validators.js';
import * as adminV from '../validators/admin.validators.js';
import * as aiV from '../validators/ai.validators.js';

// [method, path, tag, summary, access, { body, query }]
// access: public | optional | user | admin
export const ROUTES = [
  ['get', '/health', 'Health', 'Service and database health check', 'public'],

  ['post', '/auth/register', 'Auth', 'Register a customer account (sets auth cookies)', 'public', { body: authV.registerSchema }],
  ['post', '/auth/login', 'Auth', 'Log in (rate limited, account lockout after 5 failures). Send X-Client-App: admin from the admin app', 'public', { body: authV.loginSchema }],
  ['post', '/auth/refresh', 'Auth', 'Rotate the refresh token cookie and issue a new access token', 'public'],
  ['post', '/auth/logout', 'Auth', 'Revoke the refresh token and clear cookies', 'public'],
  ['get', '/auth/me', 'Auth', 'Current user', 'user'],
  ['get', '/auth/session', 'Auth', 'Session bootstrap: always 200 with user or null; refreshes an expired access token from the refresh cookie', 'public'],
  ['post', '/auth/forgot-password', 'Auth', 'E-mail a password reset link (always 200)', 'public', { body: authV.forgotPasswordSchema }],
  ['post', '/auth/reset-password/{token}', 'Auth', 'Reset password with the e-mailed token', 'public', { body: authV.resetPasswordSchema }],
  ['put', '/auth/change-password', 'Auth', 'Change password (signs out other sessions)', 'user', { body: authV.changePasswordSchema }],

  ['get', '/users/me', 'Users', 'Get my profile', 'user'],
  ['put', '/users/me', 'Users', 'Update my profile', 'user', { body: userV.updateProfileSchema }],
  ['post', '/users/me/addresses', 'Users', 'Add an address', 'user', { body: userV.addressSchema }],
  ['put', '/users/me/addresses/{addressId}', 'Users', 'Update an address', 'user', { body: userV.addressUpdateSchema }],
  ['delete', '/users/me/addresses/{addressId}', 'Users', 'Delete an address', 'user'],

  ['get', '/notifications', 'Notifications', 'List my notifications', 'user', { query: userV.notificationListQuery }],
  ['put', '/notifications/read-all', 'Notifications', 'Mark all notifications read', 'user'],
  ['put', '/notifications/{id}/read', 'Notifications', 'Mark one notification read', 'user'],

  ['get', '/products', 'Products', 'List products: search, category, brand, price, rating, sort, pagination, facets', 'public', { query: catV.productListQuery }],
  ['get', '/products/home', 'Products', 'Home page sections (featured, deals, new arrivals, top rated, categories)', 'public'],
  ['get', '/products/suggestions', 'Products', 'Search-as-you-type suggestions', 'public', { query: catV.suggestionQuery }],
  ['get', '/products/{slug}', 'Products', 'Product detail by slug', 'public'],
  ['get', '/products/{slug}/related', 'Products', '"You may also like" (content-based + co-purchase)', 'public'],
  ['post', '/products', 'Products', 'Create product', 'admin', { body: catV.productCreateSchema }],
  ['put', '/products/{id}', 'Products', 'Update product', 'admin', { body: catV.productUpdateSchema }],
  ['delete', '/products/{id}', 'Products', 'Delete product (removes reviews, cart and wishlist references)', 'admin'],

  ['get', '/categories', 'Categories', 'List categories with product counts (?all=true for admins)', 'optional'],
  ['get', '/categories/{slug}', 'Categories', 'Category by slug', 'public'],
  ['post', '/categories', 'Categories', 'Create category', 'admin', { body: catV.categorySchema }],
  ['put', '/categories/{id}', 'Categories', 'Update category', 'admin', { body: catV.categoryUpdateSchema }],
  ['delete', '/categories/{id}', 'Categories', 'Delete category (blocked while products use it)', 'admin'],

  ['get', '/brands', 'Brands', 'List brands (optionally ?category=slug)', 'optional', { query: catV.brandListQuery }],
  ['post', '/brands', 'Brands', 'Create brand', 'admin', { body: catV.brandSchema }],
  ['put', '/brands/{id}', 'Brands', 'Update brand', 'admin', { body: catV.brandUpdateSchema }],
  ['delete', '/brands/{id}', 'Brands', 'Delete brand (blocked while products use it)', 'admin'],

  ['get', '/cart', 'Cart', 'Get my cart with live prices, coupon and totals', 'user'],
  ['delete', '/cart', 'Cart', 'Clear my cart', 'user'],
  ['post', '/cart/items', 'Cart', 'Add item (stock checked)', 'user', { body: shopV.addCartItemSchema }],
  ['put', '/cart/items/{productId}', 'Cart', 'Update item quantity', 'user', { body: shopV.updateCartItemSchema }],
  ['delete', '/cart/items/{productId}', 'Cart', 'Remove item', 'user'],
  ['post', '/cart/coupon', 'Cart', 'Apply coupon to cart', 'user', { body: shopV.couponCodeSchema }],
  ['delete', '/cart/coupon', 'Cart', 'Remove coupon', 'user'],

  ['get', '/wishlist', 'Wishlist', 'My wishlist', 'user'],
  ['post', '/wishlist/{productId}', 'Wishlist', 'Add to wishlist (idempotent)', 'user'],
  ['delete', '/wishlist/{productId}', 'Wishlist', 'Remove from wishlist', 'user'],

  ['get', '/coupons/available', 'Coupons', 'Active, non-expired coupons', 'public'],
  ['post', '/coupons/validate', 'Coupons', 'Check a coupon against a subtotal', 'user', { body: shopV.validateCouponSchema }],

  ['get', '/reviews/my', 'Reviews', 'My reviews', 'user'],
  ['get', '/reviews/product/{productId}', 'Reviews', 'Approved reviews + rating distribution', 'public', { query: shopV.reviewListQuery }],
  ['post', '/reviews/{productId}', 'Reviews', 'Write a review (pending moderation)', 'user', { body: shopV.reviewCreateSchema }],
  ['put', '/reviews/{id}', 'Reviews', 'Edit my review (re-moderated)', 'user', { body: shopV.reviewUpdateSchema }],
  ['delete', '/reviews/{id}', 'Reviews', 'Delete my review', 'user'],

  ['post', '/orders', 'Orders', 'Place order from cart (server-side totals, coupon re-validated)', 'user', { body: orderV.createOrderSchema }],
  ['get', '/orders/my', 'Orders', 'My orders', 'user', { query: orderV.myOrdersQuery }],
  ['get', '/orders/{id}', 'Orders', 'Order detail with status history', 'user'],
  ['put', '/orders/{id}/pay', 'Orders', 'Verify Razorpay signature and mark paid (decrements stock)', 'user', { body: orderV.payOrderSchema }],
  ['put', '/orders/{id}/cancel', 'Orders', 'Cancel order (restores stock, refunds if paid)', 'user', { body: orderV.cancelOrderSchema }],

  ['get', '/payments/config', 'Payments', 'Payment mode (razorpay or simulation) and public key id', 'public'],
  ['post', '/payments/create-order', 'Payments', 'Create a Razorpay (test) / simulated payment order', 'user', { body: orderV.createPaymentSchema }],
  ['post', '/payments/simulate', 'Payments', 'Simulation mode only: returns a signed payment result', 'user', { body: orderV.simulatePaymentSchema }],

  ['get', '/admin/dashboard', 'Admin', 'Dashboard KPIs, 30-day sales, top products, low stock', 'admin'],
  ['get', '/admin/analytics/summary', 'Admin', 'KPI summary', 'admin'],
  ['get', '/admin/analytics/sales', 'Admin', 'Revenue/orders time series', 'admin', { query: adminV.salesQuery }],
  ['get', '/admin/analytics/top-products', 'Admin', 'Top products by revenue', 'admin', { query: adminV.topProductsQuery }],
  ['get', '/admin/analytics/categories', 'Admin', 'Revenue by category', 'admin'],
  ['get', '/admin/analytics/breakdowns', 'Admin', 'Order status and payment method breakdowns', 'admin'],
  ['get', '/admin/products', 'Admin', 'All products incl. inactive, with filters', 'admin', { query: catV.adminProductListQuery }],
  ['put', '/admin/products/bulk-status', 'Admin', 'Bulk activate/deactivate products', 'admin', { body: catV.bulkStatusSchema }],
  ['get', '/admin/products/{id}', 'Admin', 'Product by id (incl. inactive)', 'admin'],
  ['patch', '/admin/products/{id}/stock', 'Admin', 'Set stock level', 'admin', { body: catV.stockUpdateSchema }],
  ['get', '/admin/inventory/low-stock', 'Admin', 'Low-stock and out-of-stock products', 'admin', { query: adminV.lowStockQuery }],
  ['get', '/admin/orders', 'Admin', 'All orders with filters and status counts', 'admin', { query: orderV.adminOrderListQuery }],
  ['get', '/admin/orders/{id}', 'Admin', 'Order detail with payments', 'admin'],
  ['put', '/admin/orders/{id}/status', 'Admin', 'Change status (processing, shipped, delivered, cancelled)', 'admin', { body: orderV.orderStatusSchema }],
  ['get', '/admin/users', 'Admin', 'Users with order stats', 'admin', { query: adminV.userListQuery }],
  ['get', '/admin/users/{id}', 'Admin', 'User with recent orders', 'admin'],
  ['put', '/admin/users/{id}/status', 'Admin', 'Activate / deactivate user', 'admin', { body: adminV.userStatusSchema }],
  ['put', '/admin/users/{id}/role', 'Admin', 'Change user role', 'admin', { body: adminV.userRoleSchema }],
  ['get', '/admin/reviews', 'Admin', 'Reviews for moderation', 'admin', { query: shopV.adminReviewListQuery }],
  ['put', '/admin/reviews/{id}/status', 'Admin', 'Approve / reject review', 'admin', { body: shopV.reviewStatusSchema }],
  ['delete', '/admin/reviews/{id}', 'Admin', 'Delete review', 'admin'],
  ['get', '/admin/coupons', 'Admin', 'List coupons', 'admin', { query: shopV.couponListQuery }],
  ['post', '/admin/coupons', 'Admin', 'Create coupon', 'admin', { body: shopV.couponCreateSchema }],
  ['put', '/admin/coupons/{id}', 'Admin', 'Update coupon', 'admin', { body: shopV.couponUpdateSchema }],
  ['delete', '/admin/coupons/{id}', 'Admin', 'Delete coupon', 'admin'],
  ['get', '/admin/export/orders', 'Admin', 'Export orders as CSV', 'admin', { query: adminV.exportOrdersQuery, csv: true }],
  ['get', '/admin/export/products', 'Admin', 'Export products as CSV', 'admin', { csv: true }],

  ['post', '/uploads/images', 'Uploads', 'Upload up to 5 product images (multipart field "images"; JPG/PNG/WEBP; Cloudinary or local)', 'admin', { multipart: true }],

  ['get', '/ai/status', 'AI', 'Which assistant engine is active (claude / rule-based)', 'public'],
  ['post', '/ai/chat', 'AI', 'ShopVerse Assistant chat (recommends only catalogue products)', 'public', { body: aiV.chatSchema }],
  ['get', '/ai/search', 'AI', 'Natural-language search, e.g. "phone under 20000 with good camera"', 'public', { query: aiV.nlSearchQuery }],
  ['get', '/ai/recommendations/me', 'AI', 'Personalised recommendations from my orders and wishlist', 'user', { query: aiV.recommendQuery }],
  ['get', '/ai/recommendations/{productId}', 'AI', 'Item-to-item recommendations with reasons', 'public', { query: aiV.recommendQuery }],
];

const toJson = (schema) => {
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });
  delete json.$schema;
  return json;
};

function queryParams(schema) {
  const json = toJson(schema);
  return Object.entries(json.properties || {}).map(([name, s]) => ({
    name,
    in: 'query',
    required: (json.required || []).includes(name),
    schema: s,
  }));
}

const errorResponse = (description) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});

export function buildOpenApiSpec() {
  const paths = {};
  for (const [method, path, tag, summary, access, opts = {}] of ROUTES) {
    const pathParams = [...path.matchAll(/\{(\w+)\}/g)].map((m) => ({ name: m[1], in: 'path', required: true, schema: { type: 'string' } }));
    const op = {
      tags: [tag],
      summary,
      operationId: `${method}${path.replace(/[{}]/g, '').replace(/\/(\w)/g, (_, c) => c.toUpperCase()).replace(/[^\w]/g, '')}`,
      parameters: [...pathParams, ...(opts.query ? queryParams(opts.query) : [])],
      responses: {
        200: opts.csv
          ? { description: 'CSV file', content: { 'text/csv': { schema: { type: 'string' } } } }
          : { description: 'Success', content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } },
        400: errorResponse('Validation error'),
      },
    };
    if (method === 'post' && !opts.multipart) op.responses[201] = { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } };
    if (access === 'user' || access === 'admin') {
      op.security = [{ cookieAuth: [] }, { bearerAuth: [] }];
      op.responses[401] = errorResponse('Not authenticated');
    }
    if (access === 'admin') {
      op.responses[403] = errorResponse('Admin role required');
      op.description = 'Admin only. From the admin dashboard send the header `X-Client-App: admin` (uses the oi_admin_* cookies).';
    }
    if (pathParams.length) op.responses[404] = errorResponse('Not found');
    if (opts.body) op.requestBody = { required: true, content: { 'application/json': { schema: toJson(opts.body) } } };
    if (opts.multipart) {
      op.requestBody = {
        required: true,
        content: { 'multipart/form-data': { schema: { type: 'object', properties: { images: { type: 'array', items: { type: 'string', format: 'binary' } } } } } },
      };
    }
    (paths[path] ||= {})[method] = op;
  }

  return {
    openapi: '3.0.3',
    info: {
      title: 'OrderIt API',
      version: '1.0.0',
      description:
        'REST API for the OrderIt (ShopVerse) e-commerce platform. Authentication uses HTTP-only cookies (`oi_access` / `oi_refresh`; admin app: `oi_admin_access` / `oi_admin_refresh`). Use "Try it out" after logging in via POST /auth/login in the same browser, or send `Authorization: Bearer <access token>`.',
    },
    servers: [{ url: `http://localhost:${env.port}${env.apiPrefix}`, description: 'Local development' }],
    tags: [...new Set(ROUTES.map((r) => r[2]))].map((name) => ({ name })),
    components: {
      securitySchemes: {
        cookieAuth: { type: 'apiKey', in: 'cookie', name: 'oi_access' },
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' },
            data: { type: 'object' },
            meta: { type: 'object', properties: { page: { type: 'integer' }, limit: { type: 'integer' }, total: { type: 'integer' }, pages: { type: 'integer' } } },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Validation failed' },
            errors: { type: 'array', items: { type: 'object', properties: { field: { type: 'string' }, message: { type: 'string' }, location: { type: 'string' } } } },
          },
        },
      },
    },
    paths,
  };
}
