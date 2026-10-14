// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { Router } from 'express';
import * as ctrl from '../controllers/user.controller.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
import { notificationListQuery } from '../validators/user.validators.js';

const router = Router();

router.use(protect);
router.get('/', validate({ query: notificationListQuery }), ctrl.listNotifications);
router.put('/read-all', ctrl.markAllNotificationsRead);
router.put('/:id/read', validate({ params: idParam }), ctrl.markNotificationRead);

export default router;
