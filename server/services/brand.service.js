import { Brand } from '../models/Brand.js';
import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import { ApiError } from '../utils/ApiError.js';
import { activeCounts } from './category.service.js';

export async function listBrands({ category, includeInactive = false } = {}) {
  const filter = includeInactive ? {} : { isActive: true };
  if (category) {
    const cat = await Category.findOne({ slug: category }).select('_id').lean();
    if (!cat) return [];
    const brandIds = await Product.distinct('brand', { category: cat._id, isActive: true });
    filter._id = { $in: brandIds };
  }
  const [brands, counts] = await Promise.all([
    Brand.find(filter).sort({ name: 1 }).populate({ path: 'categories', select: 'name slug' }).lean(),
    activeCounts('brand'),
  ]);
  return brands.map((b) => ({ ...b, productCount: counts.get(String(b._id)) || 0 }));
}

export async function createBrand(data) {
  return Brand.create(data);
}

export async function updateBrand(id, data) {
  const brand = await Brand.findById(id);
  if (!brand) throw ApiError.notFound('Brand not found');
  Object.assign(brand, data);
  await brand.save();
  return brand;
}

export async function deleteBrand(id) {
  const inUse = await Product.countDocuments({ brand: id });
  if (inUse) throw ApiError.badRequest(`Cannot delete: ${inUse} product(s) still use this brand`);
  const brand = await Brand.findByIdAndDelete(id);
  if (!brand) throw ApiError.notFound('Brand not found');
  return { id };
}
