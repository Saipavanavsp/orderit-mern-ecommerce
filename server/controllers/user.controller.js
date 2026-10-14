// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import * as userService from '../services/user.service.js';
import * as notificationService from '../services/notification.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { paginationMeta, sendSuccess } from '../utils/response.js';

export const getProfile = asyncHandler(async (req, res) => sendSuccess(res, { user: req.user }));

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await userService.updateProfile(req.user._id, req.body);
  sendSuccess(res, { user }, { message: 'Profile updated' });
});

export const addAddress = asyncHandler(async (req, res) => {
  const addresses = await userService.addAddress(req.user._id, req.body);
  sendSuccess(res, { addresses }, { status: 201, message: 'Address added' });
});

export const updateAddress = asyncHandler(async (req, res) => {
  const addresses = await userService.updateAddress(req.user._id, req.params.addressId, req.body);
  sendSuccess(res, { addresses }, { message: 'Address updated' });
});

export const deleteAddress = asyncHandler(async (req, res) => {
  const addresses = await userService.deleteAddress(req.user._id, req.params.addressId);
  sendSuccess(res, { addresses }, { message: 'Address removed' });
});

export const listNotifications = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const { items, total, unread } = await notificationService.listForUser(req.user._id, { page, limit });
  sendSuccess(res, { notifications: items, unread }, { meta: paginationMeta(page, limit, total) });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.markRead(req.user._id, req.params.id);
  sendSuccess(res, { notification });
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  sendSuccess(res, await notificationService.markAllRead(req.user._id));
});
