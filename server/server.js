// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection:', reason);
});

async function start() {
  try {
    await connectDB();
  } catch {
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(env.port, () => {
    logger.info(`OrderIt API listening on http://localhost:${env.port}${env.apiPrefix} (${env.nodeEnv}) - developed by Sai Pavan`);
    logger.info(`Swagger docs at http://localhost:${env.port}/api-docs`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(
        `Port ${env.port} is already in use. PowerShell: netstat -ano | findstr :${env.port}  then  taskkill /PID <pid> /F`,
      );
    } else {
      logger.error('Server error:', err);
    }
    process.exit(1);
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down gracefully...`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
