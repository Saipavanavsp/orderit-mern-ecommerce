// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { Router } from 'express';
import * as ctrl from '../controllers/shopping.controller.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  addCartItemSchema,
  couponCodeSchema,
  productIdParam,
  updateCartItemSchema,
} from '../validators/shopping.validators.js';

const router = Router();

router.use(protect);
router.get('/', ctrl.getCart);
router.delete('/', ctrl.clearCart);
router.post('/items', validate({ body: addCartItemSchema }), ctrl.addCartItem);
router.put('/items/:productId', validate({ params: productIdParam, body: updateCartItemSchema }), ctrl.updateCartItem);
router.delete('/items/:productId', validate({ params: productIdParam }), ctrl.removeCartItem);
router.post('/coupon', validate({ body: couponCodeSchema }), ctrl.applyCoupon);
router.delete('/coupon', ctrl.removeCoupon);

export default router;
