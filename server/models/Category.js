// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import mongoose from 'mongoose';
import { slugify } from '../utils/slugify.js';

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 60 },
    slug: { type: String, unique: true, lowercase: true, index: true },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    image: { type: String, default: '' },
    subCategories: { type: [String], default: [] },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

categorySchema.virtual('products', { ref: 'Product', localField: '_id', foreignField: 'category', count: true });

categorySchema.pre('validate', function setSlug() {
  if (this.isModified('name') || !this.slug) this.slug = slugify(this.name);
});

export const Category = mongoose.model('Category', categorySchema);
export default Category;
