// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(serverRoot, '.env'), quiet: true });

const bool = (fallback) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? fallback : ['true', '1', 'yes'].includes(v.toLowerCase())));

const num = (fallback) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? fallback : Number(v)))
    .pipe(z.number().finite());

const str = (fallback) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? fallback : v));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: num(5001),
  API_PREFIX: str('/api/v1'),
  CLIENT_URL: str('http://localhost:5173'),
  ADMIN_URL: str('http://localhost:5174'),
  CORS_ORIGINS: str('http://localhost:5173,http://localhost:5174,http://localhost:3000'),
  MONGO_URI: str('mongodb://127.0.0.1:27017/shopverse'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES: str('15m'),
  JWT_REFRESH_EXPIRES: str('7d'),
  COOKIE_SECURE: bool(false),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  COOKIE_DOMAIN: str(''),
  BCRYPT_SALT_ROUNDS: num(12),
  MAX_LOGIN_ATTEMPTS: num(5),
  LOCK_TIME_MINUTES: num(15),
  TAX_RATE: num(0.18),
  FREE_SHIPPING_THRESHOLD: num(999),
  SHIPPING_FEE: num(49),
  LOW_STOCK_THRESHOLD: num(10),
  CLOUDINARY_CLOUD_NAME: str(''),
  CLOUDINARY_API_KEY: str(''),
  CLOUDINARY_API_SECRET: str(''),
  UPLOAD_MAX_SIZE_MB: num(2),
  SMTP_HOST: str(''),
  SMTP_PORT: num(587),
  SMTP_USER: str(''),
  SMTP_PASS: str(''),
  MAIL_FROM: str('OrderIt <no-reply@orderit.local>'),
  RAZORPAY_KEY_ID: str(''),
  RAZORPAY_KEY_SECRET: str(''),
  PAYMENT_SIMULATION_SECRET: str('orderit-simulation-secret'),
  ANTHROPIC_API_KEY: str(''),
  ANTHROPIC_MODEL: str('claude-opus-5-5'),
  IMAGE_SOURCE: z.enum(['dataset', 'licensed']).default('dataset'),
  LOG_FORMAT: str('dev'),
});

// Tests run without a .env file, so provide safe throwaway secrets there.
if (process.env.NODE_ENV === 'test') {
  process.env.JWT_ACCESS_SECRET ||= 'test-access-secret-that-is-long-enough-123456';
  process.env.JWT_REFRESH_SECRET ||= 'test-refresh-secret-that-is-long-enough-123456';
}

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('\n[config] Invalid environment configuration (server/.env):');
  for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  console.error('  Copy server/.env.example to server/.env and fill in the values.\n');
  process.exit(1);
}

const e = parsed.data;

export const env = {
  nodeEnv: e.NODE_ENV,
  isProd: e.NODE_ENV === 'production',
  isTest: e.NODE_ENV === 'test',
  port: e.PORT,
  apiPrefix: e.API_PREFIX,
  clientUrl: e.CLIENT_URL,
  adminUrl: e.ADMIN_URL,
  corsOrigins: e.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
  mongoUri: e.MONGO_URI,
  jwt: {
    accessSecret: e.JWT_ACCESS_SECRET,
    refreshSecret: e.JWT_REFRESH_SECRET,
    accessExpires: e.JWT_ACCESS_EXPIRES,
    refreshExpires: e.JWT_REFRESH_EXPIRES,
  },
  cookie: { secure: e.COOKIE_SECURE, sameSite: e.COOKIE_SAMESITE, domain: e.COOKIE_DOMAIN || undefined },
  security: {
    saltRounds: e.NODE_ENV === 'test' ? 4 : e.BCRYPT_SALT_ROUNDS,
    maxLoginAttempts: e.MAX_LOGIN_ATTEMPTS,
    lockTimeMs: e.LOCK_TIME_MINUTES * 60 * 1000,
  },
  pricing: {
    taxRate: e.TAX_RATE,
    freeShippingThreshold: e.FREE_SHIPPING_THRESHOLD,
    shippingFee: e.SHIPPING_FEE,
  },
  lowStockThreshold: e.LOW_STOCK_THRESHOLD,
  cloudinary: {
    cloudName: e.CLOUDINARY_CLOUD_NAME,
    apiKey: e.CLOUDINARY_API_KEY,
    apiSecret: e.CLOUDINARY_API_SECRET,
    enabled: Boolean(e.CLOUDINARY_CLOUD_NAME && e.CLOUDINARY_API_KEY && e.CLOUDINARY_API_SECRET),
  },
  uploadMaxBytes: e.UPLOAD_MAX_SIZE_MB * 1024 * 1024,
  smtp: {
    host: e.SMTP_HOST,
    port: e.SMTP_PORT,
    user: e.SMTP_USER,
    pass: e.SMTP_PASS,
    from: e.MAIL_FROM,
    enabled: Boolean(e.SMTP_HOST),
  },
  razorpay: {
    keyId: e.RAZORPAY_KEY_ID,
    keySecret: e.RAZORPAY_KEY_SECRET,
    enabled: Boolean(e.RAZORPAY_KEY_ID && e.RAZORPAY_KEY_SECRET),
    simulationSecret: e.PAYMENT_SIMULATION_SECRET,
  },
  anthropic: { apiKey: e.ANTHROPIC_API_KEY, model: e.ANTHROPIC_MODEL, enabled: Boolean(e.ANTHROPIC_API_KEY) },
  imageSource: e.IMAGE_SOURCE,
  logFormat: e.LOG_FORMAT,
  paths: {
    root: serverRoot,
    uploads: path.join(serverRoot, 'uploads'),
  },
};
