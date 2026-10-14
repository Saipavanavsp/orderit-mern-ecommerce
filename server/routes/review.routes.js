// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { Router } from 'express';
import * as ctrl from '../controllers/shopping.controller.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
import {
  productIdParam,
  reviewCreateSchema,
  reviewListQuery,
  reviewUpdateSchema,
} from '../validators/shopping.validators.js';

// Admin moderation lives under /admin/reviews (see admin.routes.js).
const router = Router();

router.get('/my', protect, ctrl.myReviews);
router.get('/product/:productId', validate({ params: productIdParam, query: reviewListQuery }), ctrl.productReviews);
router.post('/:productId', protect, validate({ params: productIdParam, body: reviewCreateSchema }), ctrl.createReview);
router.put('/:id', protect, validate({ params: idParam, body: reviewUpdateSchema }), ctrl.updateReview);
router.delete('/:id', protect, validate({ params: idParam }), ctrl.deleteReview);

export default router;
