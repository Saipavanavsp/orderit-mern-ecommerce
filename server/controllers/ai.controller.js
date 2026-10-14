// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import * as assistant from '../services/assistant.service.js';
import * as recommendations from '../services/recommendation.service.js';
import { naturalLanguageSearch } from '../services/nlSearch.service.js';
import { env } from '../config/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { paginationMeta, sendSuccess } from '../utils/response.js';

export const chat = asyncHandler(async (req, res) => {
  sendSuccess(res, await assistant.chat(req.body));
});

export const status = asyncHandler(async (_req, res) => {
  sendSuccess(res, { assistant: env.anthropic.enabled ? 'claude' : 'rule-based', name: 'ShopVerse Assistant' });
});

export const search = asyncHandler(async (req, res) => {
  const { q, page, limit } = req.query;
  const result = await naturalLanguageSearch(q, { page, limit });
  sendSuccess(res, { interpreted: result.interpreted, products: result.products }, {
    meta: paginationMeta(page, limit, result.total),
  });
});

export const forProduct = asyncHandler(async (req, res) => {
  const products = await recommendations.recommendForProduct(req.params.productId, { limit: req.query.limit });
  sendSuccess(res, { products });
});

export const forUser = asyncHandler(async (req, res) => {
  sendSuccess(res, await recommendations.recommendForUser(req.user._id, { limit: req.query.limit }));
});
