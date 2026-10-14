// Consistent JSON envelope: { success, message?, data, meta? }
export function sendSuccess(res, data = null, { status = 200, message, meta } = {}) {
  const body = { success: true };
  if (message) body.message = message;
  body.data = data;
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

export function paginationMeta(page, limit, total) {
  return { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) };
}
