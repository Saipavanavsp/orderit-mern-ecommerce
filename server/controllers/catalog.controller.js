import * as categoryService from '../services/category.service.js';
import * as brandService from '../services/brand.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

const wantsAll = (req) => req.query.all === 'true' && req.user?.role === 'admin';

export const listCategories = asyncHandler(async (req, res) => {
  sendSuccess(res, { categories: await categoryService.listCategories({ includeInactive: wantsAll(req) }) });
});

export const getCategory = asyncHandler(async (req, res) => {
  sendSuccess(res, { category: await categoryService.getCategoryBySlug(req.params.slug) });
});

export const createCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.createCategory(req.body);
  sendSuccess(res, { category }, { status: 201, message: 'Category created' });
});

export const updateCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.updateCategory(req.params.id, req.body);
  sendSuccess(res, { category }, { message: 'Category updated' });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  sendSuccess(res, await categoryService.deleteCategory(req.params.id), { message: 'Category deleted' });
});

export const listBrands = asyncHandler(async (req, res) => {
  const brands = await brandService.listBrands({ category: req.query.category, includeInactive: wantsAll(req) });
  sendSuccess(res, { brands });
});

export const createBrand = asyncHandler(async (req, res) => {
  const brand = await brandService.createBrand(req.body);
  sendSuccess(res, { brand }, { status: 201, message: 'Brand created' });
});

export const updateBrand = asyncHandler(async (req, res) => {
  const brand = await brandService.updateBrand(req.params.id, req.body);
  sendSuccess(res, { brand }, { message: 'Brand updated' });
});

export const deleteBrand = asyncHandler(async (req, res) => {
  sendSuccess(res, await brandService.deleteBrand(req.params.id), { message: 'Brand deleted' });
});
