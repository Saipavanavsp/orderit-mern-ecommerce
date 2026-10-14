import { Router } from 'express';
import * as ctrl from '../controllers/catalog.controller.js';
import { adminOnly, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
import { categorySchema, categoryUpdateSchema, slugParam } from '../validators/catalog.validators.js';

const router = Router();

router.get('/', optionalAuth, ctrl.listCategories);
router.get('/:slug', validate({ params: slugParam }), ctrl.getCategory);
router.post('/', ...adminOnly, validate({ body: categorySchema }), ctrl.createCategory);
router.put('/:id', ...adminOnly, validate({ params: idParam, body: categoryUpdateSchema }), ctrl.updateCategory);
router.delete('/:id', ...adminOnly, validate({ params: idParam }), ctrl.deleteCategory);

export default router;
