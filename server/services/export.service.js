import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { toCSV } from '../utils/csv.js';

export async function ordersCsv({ status, from, to } = {}) {
  const filter = {};
  if (status && status !== 'all') filter.status = status;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = from;
    if (to) filter.createdAt.$lte = to;
  }
  const orders = await Order.find(filter).populate({ path: 'user', select: 'name email' }).sort({ createdAt: -1 }).lean();
  return toCSV(orders, [
    { label: 'Order Number', value: (o) => o.orderNumber },
    { label: 'Date', value: (o) => o.createdAt },
    { label: 'Customer', value: (o) => o.user?.name },
    { label: 'Email', value: (o) => o.user?.email },
    { label: 'Items', value: (o) => o.items.reduce((s, i) => s + i.quantity, 0) },
    { label: 'Products', value: (o) => o.items.map((i) => `${i.name} x${i.quantity}`).join('; ') },
    { label: 'Subtotal', value: (o) => o.itemsPrice },
    { label: 'Discount', value: (o) => o.discount },
    { label: 'Coupon', value: (o) => o.couponCode },
    { label: 'Tax', value: (o) => o.taxPrice },
    { label: 'Shipping', value: (o) => o.shippingPrice },
    { label: 'Total', value: (o) => o.totalPrice },
    { label: 'Payment Method', value: (o) => o.paymentMethod },
    { label: 'Payment Status', value: (o) => o.paymentStatus },
    { label: 'Order Status', value: (o) => o.status },
    { label: 'City', value: (o) => o.shippingAddress?.city },
    { label: 'State', value: (o) => o.shippingAddress?.state },
  ]);
}

export async function productsCsv() {
  const products = await Product.find()
    .populate([
      { path: 'brand', select: 'name' },
      { path: 'category', select: 'name' },
    ])
    .sort({ name: 1 })
    .lean();
  return toCSV(products, [
    { label: 'Name', value: (p) => p.name },
    { label: 'Slug', value: (p) => p.slug },
    { label: 'SKU', value: (p) => p.sku },
    { label: 'Brand', value: (p) => p.brand?.name },
    { label: 'Category', value: (p) => p.category?.name },
    { label: 'Sub-category', value: (p) => p.subCategory },
    { label: 'Price', value: (p) => p.price },
    { label: 'MRP', value: (p) => p.mrp },
    { label: 'Discount %', value: (p) => p.discountPercent },
    { label: 'Stock', value: (p) => p.stock },
    { label: 'Sold', value: (p) => p.soldCount },
    { label: 'Rating', value: (p) => p.rating },
    { label: 'Reviews', value: (p) => p.numReviews },
    { label: 'Active', value: (p) => (p.isActive ? 'yes' : 'no') },
    { label: 'Featured', value: (p) => (p.isFeatured ? 'yes' : 'no') },
  ]);
}
