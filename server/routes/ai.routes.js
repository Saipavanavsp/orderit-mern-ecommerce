import { Router } from 'express';
import * as ctrl from '../controllers/ai.controller.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { aiLimiter } from '../middleware/rateLimiters.js';
import { chatSchema, nlSearchQuery, productIdParam, recommendQuery } from '../validators/ai.validators.js';

const router = Router();

router.get('/status', ctrl.status);
router.post('/chat', aiLimiter, validate({ body: chatSchema }), ctrl.chat);
router.get('/search', validate({ query: nlSearchQuery }), ctrl.search);
router.get('/recommendations/me', protect, validate({ query: recommendQuery }), ctrl.forUser);
router.get(
  '/recommendations/:productId',
  validate({ params: productIdParam, query: recommendQuery }),
  ctrl.forProduct,
);

export default router;
