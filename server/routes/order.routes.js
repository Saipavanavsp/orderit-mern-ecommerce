import { Router } from 'express';
import * as ctrl from '../controllers/order.controller.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { paymentLimiter } from '../middleware/rateLimiters.js';
import { idParam } from '../validators/common.js';
import { cancelOrderSchema, createOrderSchema, myOrdersQuery, payOrderSchema } from '../validators/order.validators.js';

const router = Router();

router.use(protect);
router.post('/', validate({ body: createOrderSchema }), ctrl.createOrder);
router.get('/my', validate({ query: myOrdersQuery }), ctrl.myOrders);
router.get('/:id', validate({ params: idParam }), ctrl.getOrder);
router.put('/:id/pay', paymentLimiter, validate({ params: idParam, body: payOrderSchema }), ctrl.payOrder);
router.put('/:id/cancel', validate({ params: idParam, body: cancelOrderSchema }), ctrl.cancelOrder);

export default router;
