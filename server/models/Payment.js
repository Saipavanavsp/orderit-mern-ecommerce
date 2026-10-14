// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: String, enum: ['razorpay', 'simulation', 'cod'], required: true },
    providerOrderId: { type: String, default: '', index: true },
    providerPaymentId: { type: String, default: '' },
    amount: { type: Number, required: true, min: 0 }, // in rupees
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: ['created', 'paid', 'failed', 'refunded'], default: 'created' },
    failureReason: { type: String, default: '' },
  },
  { timestamps: true },
);

export const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;
