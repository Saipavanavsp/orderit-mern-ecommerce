// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';

export async function updateProfile(userId, updates) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');
  Object.assign(user, updates);
  await user.save();
  return user;
}

function ensureSingleDefault(user, defaultId) {
  user.addresses.forEach((a) => {
    a.isDefault = String(a._id) === String(defaultId);
  });
}

export async function addAddress(userId, address) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');
  if (user.addresses.length >= 10) throw ApiError.badRequest('You can save up to 10 addresses');
  user.addresses.push(address);
  const added = user.addresses[user.addresses.length - 1];
  if (address.isDefault || user.addresses.length === 1) ensureSingleDefault(user, added._id);
  await user.save();
  return user.addresses;
}

export async function updateAddress(userId, addressId, updates) {
  const user = await User.findById(userId);
  const address = user?.addresses.id(addressId);
  if (!address) throw ApiError.notFound('Address not found');
  Object.assign(address, updates);
  if (updates.isDefault) ensureSingleDefault(user, address._id);
  await user.save();
  return user.addresses;
}

export async function deleteAddress(userId, addressId) {
  const user = await User.findById(userId);
  const address = user?.addresses.id(addressId);
  if (!address) throw ApiError.notFound('Address not found');
  const wasDefault = address.isDefault;
  address.deleteOne();
  if (wasDefault && user.addresses.length) user.addresses[0].isDefault = true;
  await user.save();
  return user.addresses;
}
