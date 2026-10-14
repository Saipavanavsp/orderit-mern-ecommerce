// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { Router } from 'express';
import * as ctrl from '../controllers/catalog.controller.js';
import { adminOnly, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
import { brandListQuery, brandSchema, brandUpdateSchema } from '../validators/catalog.validators.js';

const router = Router();

router.get('/', optionalAuth, validate({ query: brandListQuery.loose() }), ctrl.listBrands);
router.post('/', ...adminOnly, validate({ body: brandSchema }), ctrl.createBrand);
router.put('/:id', ...adminOnly, validate({ params: idParam, body: brandUpdateSchema }), ctrl.updateBrand);
router.delete('/:id', ...adminOnly, validate({ params: idParam }), ctrl.deleteBrand);

export default router;
