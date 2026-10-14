import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { Brand } from '../models/Brand.js';
import { Review } from '../models/Review.js';
import { Cart } from '../models/Cart.js';
import { Wishlist } from '../models/Wishlist.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex } from '../utils/format.js';
import { listCategories } from './category.service.js';

const LIST_FIELDS =
  'name slug brand category subCategory price mrp discountPercent stock images rating numReviews tags isFeatured soldCount createdAt';
const POPULATE = [
  { path: 'brand', select: 'name slug' },
  { path: 'category', select: 'name slug' },
];

export function toPublic(p) {
  if (!p) return p;
  const obj = typeof p.toObject === 'function' ? p.toObject() : p;
  return {
    ...obj,
    inStock: obj.stock > 0,
    isLowStock: obj.stock > 0 && obj.stock <= env.lowStockThreshold,
  };
}

async function resolveIds(Model, slugsOrIds) {
  if (!slugsOrIds?.length) return null;
  const ids = slugsOrIds.filter((v) => mongoose.isValidObjectId(v));
  const slugs = slugsOrIds.filter((v) => !mongoose.isValidObjectId(v));
  const docs = await Model.find({ $or: [{ _id: { $in: ids } }, { slug: { $in: slugs } }] }).select('_id').lean();
  return docs.map((d) => d._id);
}

/** Builds the Mongo filter for storefront listing (shared with AI natural-language search). */
export async function buildFilter(q) {
  const filter = { isActive: true };
  const categoryIds = await resolveIds(Category, q.category);
  if (categoryIds) filter.category = { $in: categoryIds };
  const brandIds = await resolveIds(Brand, q.brand);
  if (brandIds) filter.brand = { $in: brandIds };
  if (q.subCategory) filter.subCategory = new RegExp(`^${escapeRegex(q.subCategory)}$`, 'i');
  if (q.minPrice !== undefined || q.maxPrice !== undefined) {
    filter.price = {};
    if (q.minPrice !== undefined) filter.price.$gte = q.minPrice;
    if (q.maxPrice !== undefined) filter.price.$lte = q.maxPrice;
  }
  if (q.rating) filter.rating = { $gte: q.rating };
  if (q.inStock) filter.stock = { $gt: 0 };
  if (q.featured) filter.isFeatured = true;
  if (q.minDiscount) filter.discountPercent = { $gte: q.minDiscount };
  if (q.tags?.length) filter.tags = { $in: q.tags };
  return filter;
}

const SORTS = {
  price_asc: { price: 1, _id: 1 },
  price_desc: { price: -1, _id: 1 },
  rating: { rating: -1, numReviews: -1, _id: 1 },
  newest: { createdAt: -1, _id: 1 },
  popularity: { soldCount: -1, numReviews: -1, _id: 1 },
  discount: { discountPercent: -1, _id: 1 },
};

/** Regex fallback so partial words ("galax", "headph") still match. */
async function regexSearchClause(search) {
  const words = search.split(/\s+/).filter(Boolean).slice(0, 6).map(escapeRegex);
  const brandIds = await Brand.find({ name: new RegExp(words.join('|'), 'i') }).select('_id').lean();
  return {
    $and: words.map((w) => {
      const re = new RegExp(w, 'i');
      return {
        $or: [
          { name: re },
          { tags: re },
          { subCategory: re },
          ...(brandIds.length ? [{ brand: { $in: brandIds.map((b) => b._id) } }] : []),
        ],
      };
    }),
  };
}

async function facetsFor(filter) {
  const base = { ...filter };
  delete base.brand;
  delete base.price;
  const [brands, price] = await Promise.all([
    Product.aggregate([
      { $match: base },
      { $group: { _id: '$brand', count: { $sum: 1 } } },
      { $lookup: { from: 'brands', localField: '_id', foreignField: '_id', as: 'brand' } },
      { $unwind: '$brand' },
      { $project: { _id: 0, id: '$brand._id', name: '$brand.name', slug: '$brand.slug', count: 1 } },
      { $sort: { count: -1, name: 1 } },
    ]),
    Product.aggregate([{ $match: base }, { $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' } } }]),
  ]);
  return { brands, priceRange: price[0] ? { min: price[0].min, max: price[0].max } : { min: 0, max: 0 } };
}

export async function listProducts(q) {
  const filter = await buildFilter(q);
  const skip = (q.page - 1) * q.limit;
  let mode = 'browse';
  let sort = SORTS[q.sort] || SORTS.popularity;

  if (q.search) {
    const textFilter = { ...filter, $text: { $search: q.search } };
    const textCount = await Product.countDocuments(textFilter);
    if (textCount > 0) {
      mode = 'text';
      Object.assign(filter, { $text: { $search: q.search } });
      if (q.sort === 'relevance') sort = { score: { $meta: 'textScore' }, _id: 1 };
    } else {
      mode = 'regex';
      Object.assign(filter, await regexSearchClause(q.search));
    }
  } else if (q.sort === 'relevance') {
    sort = { isFeatured: -1, soldCount: -1, _id: 1 };
  }

  const projection = mode === 'text' ? { score: { $meta: 'textScore' } } : {};
  const [items, total] = await Promise.all([
    Product.find(filter, projection).select(LIST_FIELDS).populate(POPULATE).sort(sort).skip(skip).limit(q.limit).lean(),
    Product.countDocuments(filter),
  ]);
  const result = { items: items.map(toPublic), total, mode };
  if (q.facets) result.facets = await facetsFor(await buildFilter({ ...q, brand: undefined }));
  return result;
}

export async function searchSuggestions(q) {
  const re = new RegExp(escapeRegex(q), 'i');
  const [products, categories, brands] = await Promise.all([
    Product.find({ isActive: true, $or: [{ name: re }, { tags: re }] })
      .select('name slug price images')
      .sort({ soldCount: -1 })
      .limit(6)
      .lean(),
    Category.find({ isActive: true, name: re }).select('name slug').limit(3).lean(),
    Brand.find({ isActive: true, name: re }).select('name slug').limit(3).lean(),
  ]);
  return {
    products: products.map((p) => ({ name: p.name, slug: p.slug, price: p.price, image: p.images?.[0]?.url || '' })),
    categories,
    brands,
  };
}

export async function getProductBySlug(slug) {
  const product = await Product.findOne({ slug, isActive: true })
    .populate({ path: 'brand', select: 'name slug' })
    .populate({ path: 'category', select: 'name slug' })
    .lean();
  if (!product) throw ApiError.notFound('Product not found');
  return toPublic(product);
}

export async function getProductById(id, { includeInactive = false } = {}) {
  const filter = { _id: id };
  if (!includeInactive) filter.isActive = true;
  const product = await Product.findOne(filter).populate(POPULATE).lean();
  if (!product) throw ApiError.notFound('Product not found');
  return toPublic(product);
}

export async function homeSections() {
  const base = { isActive: true, stock: { $gt: 0 } };
  const find = (filter, sort, limit = 8) =>
    Product.find({ ...base, ...filter }).select(LIST_FIELDS).populate(POPULATE).sort(sort).limit(limit).lean();
  const [featured, deals, newArrivals, topRated, categories] = await Promise.all([
    find({ isFeatured: true }, { soldCount: -1 }),
    find({ discountPercent: { $gte: 20 } }, { discountPercent: -1 }),
    find({}, { createdAt: -1 }),
    find({ numReviews: { $gte: 3 } }, { rating: -1, numReviews: -1 }),
    listCategories(),
  ]);
  return {
    featured: featured.map(toPublic),
    deals: deals.map(toPublic),
    newArrivals: newArrivals.map(toPublic),
    topRated: topRated.map(toPublic),
    categories,
  };
}

// ---------- Admin ----------

async function assertRefs({ brand, category }) {
  if (brand && !(await Brand.exists({ _id: brand }))) throw ApiError.badRequest('Brand not found');
  if (category && !(await Category.exists({ _id: category }))) throw ApiError.badRequest('Category not found');
}

export async function createProduct(data) {
  await assertRefs(data);
  const product = await Product.create(data);
  return getProductById(product._id, { includeInactive: true });
}

export async function updateProduct(id, data) {
  const product = await Product.findById(id);
  if (!product) throw ApiError.notFound('Product not found');
  await assertRefs(data);
  if (data.price !== undefined && data.mrp === undefined && data.price > product.mrp) {
    throw ApiError.badRequest('Price cannot be greater than MRP');
  }
  if (data.mrp !== undefined && data.price === undefined && data.mrp < product.price) {
    throw ApiError.badRequest('MRP cannot be lower than price');
  }
  Object.assign(product, data);
  await product.save();
  return getProductById(product._id, { includeInactive: true });
}

export async function deleteProduct(id) {
  const product = await Product.findByIdAndDelete(id);
  if (!product) throw ApiError.notFound('Product not found');
  // Orders keep their own item snapshots, so only live references are cleaned up.
  await Promise.all([
    Review.deleteMany({ product: id }),
    Cart.updateMany({}, { $pull: { items: { product: id } } }),
    Wishlist.updateMany({}, { $pull: { products: id } }),
  ]);
  return { id };
}

export async function bulkUpdateStatus(ids, isActive) {
  const result = await Product.updateMany({ _id: { $in: ids } }, { isActive });
  return { matched: result.matchedCount, modified: result.modifiedCount };
}

export async function updateStock(id, stock) {
  const product = await Product.findByIdAndUpdate(id, { stock }, { new: true, runValidators: true });
  if (!product) throw ApiError.notFound('Product not found');
  return toPublic(product);
}

export async function adminListProducts(q) {
  const filter = {};
  if (q.search) {
    const re = new RegExp(escapeRegex(q.search), 'i');
    filter.$or = [{ name: re }, { sku: re }, { tags: re }];
  }
  if (q.category) filter.category = q.category;
  if (q.brand) filter.brand = q.brand;
  if (q.status === 'active') filter.isActive = true;
  if (q.status === 'inactive') filter.isActive = false;
  if (q.stock === 'low') filter.stock = { $gt: 0, $lte: env.lowStockThreshold };
  if (q.stock === 'out') filter.stock = 0;
  const sorts = {
    newest: { createdAt: -1 },
    name: { name: 1 },
    price_asc: { price: 1 },
    price_desc: { price: -1 },
    stock_asc: { stock: 1 },
    stock_desc: { stock: -1 },
  };
  const [items, total] = await Promise.all([
    Product.find(filter)
      .populate(POPULATE)
      .sort({ ...sorts[q.sort], _id: 1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .lean(),
    Product.countDocuments(filter),
  ]);
  return { items: items.map(toPublic), total };
}

export async function lowStockProducts(threshold = env.lowStockThreshold) {
  const items = await Product.find({ stock: { $lte: threshold } })
    .select('name slug sku stock price images isActive brand category')
    .populate(POPULATE)
    .sort({ stock: 1, name: 1 })
    .lean();
  return items.map(toPublic);
}
