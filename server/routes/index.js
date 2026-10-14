import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import notificationRoutes from './notification.routes.js';
import productRoutes from './product.routes.js';
import categoryRoutes from './category.routes.js';
import brandRoutes from './brand.routes.js';
import cartRoutes from './cart.routes.js';
import wishlistRoutes from './wishlist.routes.js';
import couponRoutes from './coupon.routes.js';
import reviewRoutes from './review.routes.js';
import orderRoutes from './order.routes.js';
import paymentRoutes from './payment.routes.js';
import adminRoutes from './admin.routes.js';
import uploadRoutes from './upload.routes.js';
import aiRoutes from './ai.routes.js';

// Exported so tests can verify every route is documented in Swagger (tests/docs.test.js).
export const MOUNTS = [
  ['/health', healthRoutes],
  ['/auth', authRoutes],
  ['/users', userRoutes],
  ['/notifications', notificationRoutes],
  ['/products', productRoutes],
  ['/categories', categoryRoutes],
  ['/brands', brandRoutes],
  ['/cart', cartRoutes],
  ['/wishlist', wishlistRoutes],
  ['/coupons', couponRoutes],
  ['/reviews', reviewRoutes],
  ['/orders', orderRoutes],
  ['/payments', paymentRoutes],
  ['/admin', adminRoutes],
  ['/uploads', uploadRoutes],
  ['/ai', aiRoutes],
];

const router = Router();
for (const [path, routes] of MOUNTS) router.use(path, routes);

export default router;
