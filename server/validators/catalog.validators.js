// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { z } from 'zod';
import { booleanString, objectId, pagination } from './common.js';

export const SORT_OPTIONS = ['relevance', 'price_asc', 'price_desc', 'rating', 'newest', 'popularity', 'discount'];

const csv = z
  .string()
  .trim()
  .max(500)
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );

export const productListQuery = z
  .object({
    search: z.string().trim().max(100).optional(),
    category: csv.optional(),
    brand: csv.optional(),
    subCategory: z.string().trim().max(60).optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    rating: z.coerce.number().min(0).max(5).optional(),
    inStock: booleanString.optional(),
    featured: booleanString.optional(),
    minDiscount: z.coerce.number().min(0).max(95).optional(),
    tags: csv.optional(),
    sort: z.enum(SORT_OPTIONS).default('relevance'),
    facets: booleanString.optional(),
    ...pagination,
    limit: z.coerce.number().int().min(1).max(60).default(12),
  })
  .refine((q) => q.minPrice === undefined || q.maxPrice === undefined || q.minPrice <= q.maxPrice, {
    message: 'minPrice cannot be greater than maxPrice',
    path: ['minPrice'],
  });

export const suggestionQuery = z.object({ q: z.string().trim().min(1).max(100) });
export const slugParam = z.object({ slug: z.string().trim().min(1).max(140).regex(/^[a-z0-9-]+$/, 'Invalid slug') });

const imageInput = z.object({
  url: z.string().trim().min(1).max(1000),
  alt: z.string().trim().max(200).optional().default(''),
});
const specInput = z.object({ label: z.string().trim().min(1).max(80), value: z.string().trim().min(1).max(300) });

export const productCreateSchema = z
  .object({
    name: z.string().trim().min(3, 'Name must be at least 3 characters').max(200),
    sku: z.string().trim().max(40).optional(),
    brand: objectId,
    category: objectId,
    subCategory: z.string().trim().max(60).optional().default(''),
    description: z.string().trim().min(10, 'Description must be at least 10 characters').max(5000),
    highlights: z.array(z.string().trim().min(1).max(200)).max(10).optional().default([]),
    price: z.coerce.number().positive('Price must be greater than 0'),
    mrp: z.coerce.number().positive('MRP must be greater than 0'),
    stock: z.coerce.number().int().min(0, 'Stock cannot be negative'),
    images: z.array(imageInput).min(1, 'Add at least one image').max(8),
    specifications: z.array(specInput).max(40).optional().default([]),
    tags: z.array(z.string().trim().toLowerCase().min(1).max(30)).max(20).optional().default([]),
    isFeatured: z.boolean().optional().default(false),
    isActive: z.boolean().optional().default(true),
  })
  .refine((p) => p.mrp >= p.price, { message: 'MRP must be greater than or equal to price', path: ['mrp'] });

export const productUpdateSchema = z
  .object({
    name: z.string().trim().min(3).max(200),
    sku: z.string().trim().max(40),
    brand: objectId,
    category: objectId,
    subCategory: z.string().trim().max(60),
    description: z.string().trim().min(10).max(5000),
    highlights: z.array(z.string().trim().min(1).max(200)).max(10),
    price: z.coerce.number().positive(),
    mrp: z.coerce.number().positive(),
    stock: z.coerce.number().int().min(0),
    images: z.array(imageInput).min(1).max(8),
    specifications: z.array(specInput).max(40),
    tags: z.array(z.string().trim().toLowerCase().min(1).max(30)).max(20),
    isFeatured: z.boolean(),
    isActive: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');

export const adminProductListQuery = z.object({
  search: z.string().trim().max(100).optional(),
  category: objectId.optional(),
  brand: objectId.optional(),
  status: z.enum(['all', 'active', 'inactive']).default('all'),
  stock: z.enum(['all', 'low', 'out']).default('all'),
  sort: z.enum(['newest', 'name', 'price_asc', 'price_desc', 'stock_asc', 'stock_desc']).default('newest'),
  ...pagination,
});

export const bulkStatusSchema = z.object({
  ids: z.array(objectId).min(1, 'Select at least one product').max(200),
  isActive: z.boolean(),
});

export const stockUpdateSchema = z.object({ stock: z.coerce.number().int().min(0).max(100000) });

// Update schemas are declared without defaults: in Zod 4 `.partial()` would still apply them
// and silently reset fields the client did not send.
const categoryFields = {
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(500),
  image: z.string().trim().max(1000),
  subCategories: z.array(z.string().trim().min(1).max(60)).max(30),
  sortOrder: z.coerce.number().int().min(0).max(1000),
  isActive: z.boolean(),
};
export const categorySchema = z.object({
  name: categoryFields.name,
  description: categoryFields.description.optional().default(''),
  image: categoryFields.image.optional().default(''),
  subCategories: categoryFields.subCategories.optional().default([]),
  sortOrder: categoryFields.sortOrder.optional().default(0),
  isActive: categoryFields.isActive.optional().default(true),
});
export const categoryUpdateSchema = z.object(categoryFields).partial();

const brandFields = {
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(500),
  logo: z.string().trim().max(1000),
  categories: z.array(objectId).max(10),
  isActive: z.boolean(),
};
export const brandSchema = z.object({
  name: brandFields.name,
  description: brandFields.description.optional().default(''),
  logo: brandFields.logo.optional().default(''),
  categories: brandFields.categories.optional().default([]),
  isActive: brandFields.isActive.optional().default(true),
});
export const brandUpdateSchema = z.object(brandFields).partial();

export const brandListQuery = z.object({ category: z.string().trim().max(60).optional() });
