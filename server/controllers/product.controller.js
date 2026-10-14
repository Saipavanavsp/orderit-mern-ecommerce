import * as productService from '../services/product.service.js';
import * as recommendationService from '../services/recommendation.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { paginationMeta, sendSuccess } from '../utils/response.js';

export const listProducts = asyncHandler(async (req, res) => {
  const { items, total, facets, mode } = await productService.listProducts(req.query);
  sendSuccess(res, { products: items, facets, searchMode: mode }, {
    meta: paginationMeta(req.query.page, req.query.limit, total),
  });
});

export const home = asyncHandler(async (_req, res) => {
  sendSuccess(res, await productService.homeSections());
});

export const suggestions = asyncHandler(async (req, res) => {
  sendSuccess(res, await productService.searchSuggestions(req.query.q));
});

export const getProduct = asyncHandler(async (req, res) => {
  sendSuccess(res, { product: await productService.getProductBySlug(req.params.slug) });
});

export const related = asyncHandler(async (req, res) => {
  const product = await productService.getProductBySlug(req.params.slug);
  const products = await recommendationService.recommendForProduct(product._id, { limit: 8 });
  sendSuccess(res, { products });
});

export const createProduct = asyncHandler(async (req, res) => {
  const product = await productService.createProduct(req.body);
  sendSuccess(res, { product }, { status: 201, message: 'Product created' });
});

export const updateProduct = asyncHandler(async (req, res) => {
  const product = await productService.updateProduct(req.params.id, req.body);
  sendSuccess(res, { product }, { message: 'Product updated' });
});

export const deleteProduct = asyncHandler(async (req, res) => {
  sendSuccess(res, await productService.deleteProduct(req.params.id), { message: 'Product deleted' });
});

export const adminListProducts = asyncHandler(async (req, res) => {
  const { items, total } = await productService.adminListProducts(req.query);
  sendSuccess(res, { products: items }, { meta: paginationMeta(req.query.page, req.query.limit, total) });
});

export const adminGetProduct = asyncHandler(async (req, res) => {
  sendSuccess(res, { product: await productService.getProductById(req.params.id, { includeInactive: true }) });
});

export const bulkStatus = asyncHandler(async (req, res) => {
  const result = await productService.bulkUpdateStatus(req.body.ids, req.body.isActive);
  sendSuccess(res, result, { message: `${result.modified} product(s) updated` });
});

export const updateStock = asyncHandler(async (req, res) => {
  sendSuccess(res, { product: await productService.updateStock(req.params.id, req.body.stock) });
});

export const lowStock = asyncHandler(async (req, res) => {
  const threshold = req.query.threshold ? Number(req.query.threshold) : undefined;
  sendSuccess(res, { products: await productService.lowStockProducts(threshold) });
});
