import { Product } from '../models/Product.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

/**
 * Atomically decrements stock for every order line. Each update only succeeds when enough stock
 * remains ({ stock: { $gte: qty } }), so concurrent checkouts can never oversell. If any line fails,
 * the lines already decremented are rolled back (works without replica-set transactions).
 */
export async function reserveStock(items) {
  const done = [];
  for (const item of items) {
    const res = await Product.updateOne(
      { _id: item.product, stock: { $gte: item.quantity } },
      { $inc: { stock: -item.quantity, soldCount: item.quantity } },
    );
    if (res.modifiedCount !== 1) {
      await releaseStock(done);
      throw new ApiError(409, `Sorry, "${item.name}" no longer has enough stock`);
    }
    done.push(item);
  }
}

/** Restores stock (e.g. on cancellation) and reverses sold counts. */
export async function releaseStock(items) {
  for (const item of items) {
    try {
      await Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity, soldCount: -item.quantity } });
    } catch (err) {
      logger.error(`Failed to restore stock for ${item.product}: ${err.message}`);
    }
  }
}

export async function assertAvailable(items) {
  const products = await Product.find({ _id: { $in: items.map((i) => i.product) } }).select('stock isActive name');
  const byId = new Map(products.map((p) => [String(p._id), p]));
  for (const item of items) {
    const p = byId.get(String(item.product));
    if (!p || !p.isActive) throw ApiError.badRequest(`"${item.name}" is no longer available`);
    if (p.stock < item.quantity) throw new ApiError(409, `Only ${p.stock} unit(s) of "${item.name}" left`);
  }
}
