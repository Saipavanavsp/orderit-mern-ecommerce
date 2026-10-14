import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import apiRoutes from './routes/index.js';
import { mongoSanitizer, xssSanitizer } from './middleware/sanitize.js';
import { apiLimiter } from './middleware/rateLimiters.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { mountDocs } from './docs/swagger.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  if (env.isProd) app.set('trust proxy', 1); // behind Render / Railway proxies

  app.use(
    helmet({
      // Product images are loaded cross-origin by the two front-ends.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(
    cors({
      origin(origin, cb) {
        // Allow non-browser clients (curl, Postman, server-to-server) which send no Origin.
        if (!origin || env.corsOrigins.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-App'],
    }),
  );

  if (!env.isTest && env.logFormat !== 'none') app.use(morgan(env.logFormat));

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());
  app.use(mongoSanitizer);
  app.use(xssSanitizer);

  app.use('/uploads', express.static(env.paths.uploads, { maxAge: '7d', fallthrough: false }));

  mountDocs(app);

  app.use(env.apiPrefix, apiLimiter, apiRoutes);

  app.get('/', (_req, res) =>
    res.json({ success: true, data: { name: 'OrderIt API', docs: '/api-docs', health: `${env.apiPrefix}/health` } }),
  );

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

export default createApp;
