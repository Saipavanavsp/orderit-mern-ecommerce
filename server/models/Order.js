// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import mongoose from 'mongoose';

export const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];
export const PAYMENT_METHODS = ['razorpay', 'cod'];

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    image: { type: String, default: '' },
    brand: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const shippingAddressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    line1: { type: String, required: true },
    line2: { type: String, default: '' },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, default: 'India' },
  },
  { _id: false },
);

const statusEventSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    note: { type: String, default: '' },
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: {
      type: [orderItemSchema],
      validate: { validator: (v) => v.length > 0, message: 'Order must contain at least one item' },
    },
    shippingAddress: { type: shippingAddressSchema, required: true },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, required: true },
    itemsPrice: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    couponCode: { type: String, default: '' },
    taxPrice: { type: Number, required: true, min: 0 },
    shippingPrice: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ORDER_STATUSES, default: 'pending', index: true },
    statusHistory: { type: [statusEventSchema], default: [] },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'pending', index: true },
    isPaid: { type: Boolean, default: false },
    paidAt: Date,
    deliveredAt: Date,
    cancelledAt: Date,
    cancelReason: { type: String, default: '' },
    trackingNumber: { type: String, default: '' },
    // True once stock has been decremented for this order; used to restore stock on cancellation.
    inventoryReserved: { type: Boolean, default: false },
    paymentResult: {
      provider: { type: String, default: '' },
      providerOrderId: { type: String, default: '' },
      paymentId: { type: String, default: '' },
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

orderSchema.index({ createdAt: -1 });
orderSchema.index({ user: 1, createdAt: -1 });

orderSchema.virtual('itemCount').get(function itemCount() {
  return this.items.reduce((sum, i) => sum + i.quantity, 0);
});

orderSchema.virtual('isCancellable').get(function isCancellable() {
  return ['pending', 'processing'].includes(this.status);
});

export const Order = mongoose.model('Order', orderSchema);
export default Order;
