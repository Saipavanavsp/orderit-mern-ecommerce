// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { Notification } from '../models/Notification.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

export async function notify(userId, { type = 'system', title, message, link = '' }) {
  try {
    return await Notification.create({ user: userId, type, title, message, link });
  } catch (err) {
    logger.warn(`Could not create notification: ${err.message}`);
    return null;
  }
}

export async function listForUser(userId, { page = 1, limit = 20 } = {}) {
  const filter = { user: userId };
  const [items, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ ...filter, isRead: false }),
  ]);
  return { items, total, unread };
}

export async function markRead(userId, id) {
  const n = await Notification.findOneAndUpdate(
    { _id: id, user: userId },
    { isRead: true, readAt: new Date() },
    { new: true },
  );
  if (!n) throw ApiError.notFound('Notification not found');
  return n;
}

export async function markAllRead(userId) {
  const result = await Notification.updateMany({ user: userId, isRead: false }, { isRead: true, readAt: new Date() });
  return { updated: result.modifiedCount };
}
