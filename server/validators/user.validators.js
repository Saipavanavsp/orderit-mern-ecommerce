import { z } from 'zod';
import { objectId, pagination, phone } from './common.js';

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(60).optional(),
    phone: phone.optional().or(z.literal('')),
    avatar: z.string().trim().url().max(500).optional().or(z.literal('')),
  })
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');

const addressFields = {
  label: z.string().trim().max(30),
  fullName: z.string().trim().min(2, 'Full name is required').max(80),
  phone,
  line1: z.string().trim().min(3, 'Address line 1 is required').max(120),
  line2: z.string().trim().max(120),
  city: z.string().trim().min(2, 'City is required').max(60),
  state: z.string().trim().min(2, 'State is required').max(60),
  postalCode: z.string().trim().regex(/^\d{6}$/, 'Enter a valid 6-digit PIN code'),
  country: z.string().trim().max(60),
  isDefault: z.boolean(),
};

export const addressSchema = z.object({
  ...addressFields,
  label: addressFields.label.optional().default('Home'),
  line2: addressFields.line2.optional().default(''),
  country: addressFields.country.optional().default('India'),
  isDefault: addressFields.isDefault.optional().default(false),
});

// No defaults here (Zod 4 partial() would apply them and overwrite saved values).
export const addressUpdateSchema = z
  .object(addressFields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');

export const addressIdParam = z.object({ addressId: objectId });

export const notificationListQuery = z.object({ ...pagination });
