import { Router } from 'express';
import * as ctrl from '../controllers/product.controller.js';
import { adminOnly } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
import {
  productCreateSchema,
  productListQuery,
  productUpdateSchema,
  slugParam,
  suggestionQuery,
} from '../validators/catalog.validators.js';

const router = Router();

router.get('/', validate({ query: productListQuery }), ctrl.listProducts);
router.get('/home', ctrl.home);
router.get('/suggestions', validate({ query: suggestionQuery }), ctrl.suggestions);
router.get('/:slug', validate({ params: slugParam }), ctrl.getProduct);
router.get('/:slug/related', validate({ params: slugParam }), ctrl.related);

router.post('/', ...adminOnly, validate({ body: productCreateSchema }), ctrl.createProduct);
router.put('/:id', ...adminOnly, validate({ params: idParam, body: productUpdateSchema }), ctrl.updateProduct);
router.delete('/:id', ...adminOnly, validate({ params: idParam }), ctrl.deleteProduct);

export default router;
