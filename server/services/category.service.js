// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import { ApiError } from '../utils/ApiError.js';

async function activeCounts(field) {
  const rows = await Product.aggregate([{ $match: { isActive: true } }, { $group: { _id: `$${field}`, count: { $sum: 1 } } }]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
}

export async function listCategories({ includeInactive = false } = {}) {
  const filter = includeInactive ? {} : { isActive: true };
  const [categories, counts] = await Promise.all([
    Category.find(filter).sort({ sortOrder: 1, name: 1 }).lean(),
    activeCounts('category'),
  ]);
  return categories.map((c) => ({ ...c, productCount: counts.get(String(c._id)) || 0 }));
}

export async function getCategoryBySlug(slug) {
  const category = await Category.findOne({ slug, isActive: true }).lean();
  if (!category) throw ApiError.notFound('Category not found');
  const productCount = await Product.countDocuments({ category: category._id, isActive: true });
  return { ...category, productCount };
}

export async function createCategory(data) {
  return Category.create(data);
}

export async function updateCategory(id, data) {
  const category = await Category.findById(id);
  if (!category) throw ApiError.notFound('Category not found');
  Object.assign(category, data);
  await category.save();
  return category;
}

export async function deleteCategory(id) {
  const inUse = await Product.countDocuments({ category: id });
  if (inUse) throw ApiError.badRequest(`Cannot delete: ${inUse} product(s) still use this category`);
  const category = await Category.findByIdAndDelete(id);
  if (!category) throw ApiError.notFound('Category not found');
  return { id };
}

export { activeCounts };
