// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { User } from '../models/User.js';
import { Order } from '../models/Order.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex } from '../utils/format.js';
import { notify } from './notification.service.js';

export async function listUsers({ page, limit, search, role, status }) {
  const filter = {};
  if (search) {
    const re = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: re }, { email: re }, { phone: re }];
  }
  if (role && role !== 'all') filter.role = role;
  if (status === 'active') filter.isActive = true;
  if (status === 'inactive') filter.isActive = false;
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  const stats = await Order.aggregate([
    { $match: { user: { $in: users.map((u) => u._id) } } },
    {
      $group: {
        _id: '$user',
        orders: { $sum: 1 },
        spent: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$totalPrice', 0] } },
      },
    },
  ]);
  const byUser = new Map(stats.map((s) => [String(s._id), s]));
  const items = users.map(({ password: _p, refreshTokens: _r, ...u }) => ({
    ...u,
    orders: byUser.get(String(u._id))?.orders || 0,
    totalSpent: Math.round(byUser.get(String(u._id))?.spent || 0),
  }));
  return { items, total };
}

export async function getUser(id) {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');
  const orders = await Order.find({ user: id })
    .select('orderNumber totalPrice status paymentStatus createdAt')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();
  return { user, orders };
}

export async function setStatus(id, isActive, actingAdminId) {
  if (String(id) === String(actingAdminId)) throw ApiError.badRequest('You cannot change your own account status');
  const user = await User.findById(id).select('+refreshTokens');
  if (!user) throw ApiError.notFound('User not found');
  user.isActive = isActive;
  if (!isActive) user.refreshTokens = []; // force sign-out everywhere
  await user.save({ validateModifiedOnly: true });
  notify(user._id, {
    type: 'account',
    title: isActive ? 'Account reactivated' : 'Account deactivated',
    message: isActive ? 'Your account is active again.' : 'Your account has been deactivated by an administrator.',
  });
  return user;
}

export async function setRole(id, role, actingAdminId) {
  if (String(id) === String(actingAdminId)) throw ApiError.badRequest('You cannot change your own role');
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');
  if (user.role === 'admin' && role !== 'admin') {
    const admins = await User.countDocuments({ role: 'admin', isActive: true });
    if (admins <= 1) throw ApiError.badRequest('At least one active admin is required');
  }
  user.role = role;
  await user.save({ validateModifiedOnly: true });
  return user;
}
