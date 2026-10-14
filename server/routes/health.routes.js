// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { Router } from 'express';
import { dbState } from '../config/db.js';
import { env } from '../config/env.js';

const router = Router();

router.get('/', (_req, res) => {
  const db = dbState();
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      service: 'orderit-api',
      environment: env.nodeEnv,
      database: db,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      integrations: {
        payments: env.razorpay.enabled ? 'razorpay-test' : 'simulation',
        uploads: env.cloudinary.enabled ? 'cloudinary' : 'local',
        email: env.smtp.enabled ? 'smtp' : 'console',
        ai: env.anthropic.enabled ? 'anthropic' : 'rule-based',
      },
    },
  });
});

export default router;
