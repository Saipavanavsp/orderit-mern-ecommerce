import mongoSanitize from 'express-mongo-sanitize';
import { filterXSS } from 'xss';

// Strip "$" and "." prefixed keys (NoSQL operator injection).
export const mongoSanitizer = mongoSanitize({ replaceWith: '_' });

// Fields whose exact value must be preserved (hashes are compared, never rendered).
const SKIP_KEYS = /password|token|signature/i;
const xssOptions = { whiteList: {}, stripIgnoreTag: true, stripIgnoreTagBody: ['script', 'style'] };

function clean(value, key = '') {
  if (typeof value === 'string') return SKIP_KEYS.test(key) ? value : filterXSS(value, xssOptions);
  if (Array.isArray(value)) return value.map((v) => clean(v, key));
  if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) value[k] = clean(value[k], k);
    return value;
  }
  return value;
}

// Removes HTML/script from every incoming string (body, query, params).
export function xssSanitizer(req, _res, next) {
  if (req.body) req.body = clean(req.body);
  if (req.query) req.query = clean(req.query);
  if (req.params) req.params = clean(req.params);
  next();
}
