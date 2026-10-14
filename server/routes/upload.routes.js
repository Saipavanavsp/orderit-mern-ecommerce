// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { Router } from 'express';
import * as admin from '../controllers/admin.controller.js';
import { adminOnly } from '../middleware/auth.js';
import { imageUpload } from '../services/upload.service.js';

const router = Router();

// multipart/form-data, field name "images" (up to 5 files, JPG/PNG/WEBP, UPLOAD_MAX_SIZE_MB each)
router.post('/images', ...adminOnly, imageUpload.array('images', 5), admin.uploadImages);

export default router;
