// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { Router } from 'express';
import * as ctrl from '../controllers/order.controller.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { paymentLimiter } from '../middleware/rateLimiters.js';
import { createPaymentSchema, simulatePaymentSchema } from '../validators/order.validators.js';

const router = Router();

router.get('/config', ctrl.paymentConfig);
router.post('/create-order', protect, paymentLimiter, validate({ body: createPaymentSchema }), ctrl.createPayment);
router.post('/simulate', protect, paymentLimiter, validate({ body: simulatePaymentSchema }), ctrl.simulatePayment);

export default router;
