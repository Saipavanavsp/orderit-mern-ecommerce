// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { randomToken } from '../utils/tokens.js';

const ALLOWED = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

if (env.cloudinary.enabled) {
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
    secure: true,
  });
}

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.uploadMaxBytes, files: 5 },
  fileFilter(_req, file, cb) {
    if (!ALLOWED[file.mimetype]) return cb(ApiError.badRequest('Only JPG, PNG or WEBP images are allowed'));
    return cb(null, true);
  },
});

/** Checks the real file signature, so a renamed .exe cannot pass as image/png. */
export function detectImageType(buffer) {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

function uploadToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder: 'orderit/products', resource_type: 'image' }, (err, result) =>
        err ? reject(err) : resolve(result.secure_url),
      )
      .end(buffer);
  });
}

export async function storeImage(file, baseUrl) {
  const realType = detectImageType(file.buffer);
  if (!realType || realType !== file.mimetype) throw ApiError.badRequest('File content is not a valid image');
  if (env.cloudinary.enabled) {
    try {
      return { url: await uploadToCloudinary(file.buffer), storage: 'cloudinary' };
    } catch (err) {
      throw new ApiError(502, `Image upload failed: ${err.message}`);
    }
  }
  const name = `${Date.now()}-${randomToken(6)}.${ALLOWED[realType]}`;
  await fs.mkdir(env.paths.uploads, { recursive: true });
  await fs.writeFile(path.join(env.paths.uploads, name), file.buffer);
  return { url: `${baseUrl}/uploads/${name}`, storage: 'local' };
}
