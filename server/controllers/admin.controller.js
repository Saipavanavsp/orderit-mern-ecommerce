// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import * as analytics from '../services/analytics.service.js';
import * as adminUsers from '../services/adminUser.service.js';
import * as exportService from '../services/export.service.js';
import { storeImage } from '../services/upload.service.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { paginationMeta, sendSuccess } from '../utils/response.js';

export const dashboard = asyncHandler(async (_req, res) => sendSuccess(res, await analytics.dashboard()));
export const summary = asyncHandler(async (_req, res) => sendSuccess(res, await analytics.summary()));
export const sales = asyncHandler(async (req, res) => sendSuccess(res, { series: await analytics.salesSeries(req.query) }));
export const topProducts = asyncHandler(async (req, res) =>
  sendSuccess(res, { products: await analytics.topProducts(req.query.limit) }),
);
export const categorySales = asyncHandler(async (_req, res) =>
  sendSuccess(res, { categories: await analytics.categorySales() }),
);
export const breakdowns = asyncHandler(async (_req, res) => {
  const [status, paymentMethods] = await Promise.all([analytics.statusBreakdown(), analytics.paymentMethodBreakdown()]);
  sendSuccess(res, { status, paymentMethods });
});

export const listUsers = asyncHandler(async (req, res) => {
  const { items, total } = await adminUsers.listUsers(req.query);
  sendSuccess(res, { users: items }, { meta: paginationMeta(req.query.page, req.query.limit, total) });
});
export const getUser = asyncHandler(async (req, res) => sendSuccess(res, await adminUsers.getUser(req.params.id)));
export const setUserStatus = asyncHandler(async (req, res) => {
  const user = await adminUsers.setStatus(req.params.id, req.body.isActive, req.user._id);
  sendSuccess(res, { user }, { message: user.isActive ? 'User activated' : 'User deactivated' });
});
export const setUserRole = asyncHandler(async (req, res) => {
  const user = await adminUsers.setRole(req.params.id, req.body.role, req.user._id);
  sendSuccess(res, { user }, { message: `Role changed to ${user.role}` });
});

function sendCsv(res, filename, csv) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(csv);
}
const stamp = () => new Date().toISOString().slice(0, 10);

export const exportOrders = asyncHandler(async (req, res) =>
  sendCsv(res, `orders-${stamp()}.csv`, await exportService.ordersCsv(req.query)),
);
export const exportProducts = asyncHandler(async (_req, res) =>
  sendCsv(res, `products-${stamp()}.csv`, await exportService.productsCsv()),
);

export const uploadImages = asyncHandler(async (req, res) => {
  const files = req.files || (req.file ? [req.file] : []);
  if (!files.length) throw ApiError.badRequest('Attach at least one image in the "images" field');
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const images = [];
  for (const file of files) images.push(await storeImage(file, baseUrl));
  sendSuccess(res, { images }, { status: 201, message: `${images.length} image(s) uploaded` });
});
