// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { Router } from 'express';
import * as ctrl from '../controllers/shopping.controller.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { productIdParam } from '../validators/shopping.validators.js';

const router = Router();

router.use(protect);
router.get('/', ctrl.getWishlist);
router.post('/:productId', validate({ params: productIdParam }), ctrl.addToWishlist);
router.delete('/:productId', validate({ params: productIdParam }), ctrl.removeFromWishlist);

export default router;
