// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { slugify } from '../utils/slugify.js';

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    alt: { type: String, trim: true, default: '' },
  },
  { _id: false },
);

const specSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 80 },
    value: { type: String, required: true, trim: true, maxlength: 300 },
  },
  { _id: false },
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Product name is required'], trim: true, maxlength: 200 },
    slug: { type: String, unique: true, lowercase: true, index: true },
    sku: { type: String, trim: true, uppercase: true, sparse: true, unique: true },
    brand: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', required: true, index: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    subCategory: { type: String, trim: true, default: '', index: true },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    highlights: { type: [String], default: [] },
    price: { type: Number, required: true, min: [1, 'Price must be positive'] },
    mrp: { type: Number, required: true, min: 1 },
    discountPercent: { type: Number, default: 0, min: 0, max: 95 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    images: {
      type: [imageSchema],
      validate: { validator: (v) => Array.isArray(v) && v.length > 0, message: 'At least one image is required' },
    },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    numReviews: { type: Number, default: 0, min: 0 },
    specifications: { type: [specSchema], default: [] },
    tags: { type: [String], default: [], index: true },
    isFeatured: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true, index: true },
    soldCount: { type: Number, default: 0, min: 0 },
    // Provenance of dataset-derived products (see docs/DATASETS.md and docs/IMAGE_REPORT.md)
    source: {
      dataset: { type: String, default: '' },
      sourceId: { type: String, default: '' },
      imageLicense: { type: String, default: '' },
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

productSchema.index(
  { name: 'text', tags: 'text', subCategory: 'text', description: 'text' },
  { weights: { name: 10, tags: 6, subCategory: 4, description: 1 }, name: 'product_text_search' },
);
productSchema.index({ category: 1, price: 1 });
productSchema.index({ isActive: 1, createdAt: -1 });
productSchema.index({ rating: -1 });
productSchema.index({ soldCount: -1 });

productSchema.virtual('inStock').get(function inStock() {
  return this.stock > 0;
});

productSchema.virtual('isLowStock').get(function isLowStock() {
  return this.stock > 0 && this.stock <= env.lowStockThreshold;
});

productSchema.virtual('reviews', { ref: 'Review', localField: '_id', foreignField: 'product' });

export function computeDiscount(price, mrp) {
  if (!mrp || mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

productSchema.pre('validate', function derive() {
  if (this.isModified('name') || !this.slug) this.slug = slugify(this.name);
  if (this.mrp < this.price) this.mrp = this.price;
  this.discountPercent = computeDiscount(this.price, this.mrp);
});

export const Product = mongoose.model('Product', productSchema);
export default Product;
