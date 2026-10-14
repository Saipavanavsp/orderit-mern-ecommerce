// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { Router } from 'express';
import * as ctrl from '../controllers/shopping.controller.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { validateCouponSchema } from '../validators/shopping.validators.js';

// Admin coupon management lives under /admin/coupons (see admin.routes.js).
const router = Router();

router.get('/available', ctrl.availableCoupons);
router.post('/validate', protect, validate({ body: validateCouponSchema }), ctrl.validateCoupon);

export default router;
