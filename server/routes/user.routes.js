// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { Router } from 'express';
import * as ctrl from '../controllers/user.controller.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  addressIdParam,
  addressSchema,
  addressUpdateSchema,
  updateProfileSchema,
} from '../validators/user.validators.js';

const router = Router();

router.use(protect);
router.get('/me', ctrl.getProfile);
router.put('/me', validate({ body: updateProfileSchema }), ctrl.updateProfile);
router.post('/me/addresses', validate({ body: addressSchema }), ctrl.addAddress);
router.put(
  '/me/addresses/:addressId',
  validate({ params: addressIdParam, body: addressUpdateSchema }),
  ctrl.updateAddress,
);
router.delete('/me/addresses/:addressId', validate({ params: addressIdParam }), ctrl.deleteAddress);

export default router;
