// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { Cart } from '../models/Cart.js';
import { Product } from '../models/Product.js';
import { ApiError } from '../utils/ApiError.js';
import { computeTotals } from './pricing.service.js';
import { validateCoupon } from './coupon.service.js';

export const MAX_QTY_PER_ITEM = 10;
const PRODUCT_FIELDS = 'name slug price mrp discountPercent stock images isActive brand';

async function getOrCreate(userId) {
  return (await Cart.findOne({ user: userId })) || Cart.create({ user: userId, items: [] });
}

/** Builds the API representation: live prices, availability, coupon and totals. */
export async function buildCartView(cart, userId) {
  await cart.populate({ path: 'items.product', select: PRODUCT_FIELDS, populate: { path: 'brand', select: 'name' } });
  const items = cart.items
    .filter((i) => i.product) // product deleted
    .map((i) => {
      const p = i.product;
      const available = p.isActive && p.stock > 0;
      return {
        _id: i._id,
        product: {
          _id: p._id,
          name: p.name,
          slug: p.slug,
          price: p.price,
          mrp: p.mrp,
          discountPercent: p.discountPercent,
          stock: p.stock,
          image: p.images?.[0]?.url || '',
          brand: p.brand?.name || '',
        },
        quantity: i.quantity,
        price: p.price,
        lineTotal: p.price * i.quantity,
        available,
        maxQuantity: Math.min(MAX_QTY_PER_ITEM, p.stock),
        priceChanged: i.priceAtAdd !== p.price,
      };
    });

  const purchasable = items.filter((i) => i.available && i.quantity <= i.maxQuantity);
  let discount = 0;
  let coupon = null;
  let couponError = '';
  if (cart.couponCode) {
    try {
      const subtotal = purchasable.reduce((s, i) => s + i.lineTotal, 0);
      const result = await validateCoupon(cart.couponCode, userId, subtotal);
      discount = result.discount;
      coupon = {
        code: result.coupon.code,
        description: result.coupon.description,
        discountType: result.coupon.discountType,
        discountValue: result.coupon.discountValue,
      };
    } catch (err) {
      couponError = err.message;
    }
  }

  return {
    _id: cart._id,
    items,
    itemCount: items.reduce((s, i) => s + i.quantity, 0),
    couponCode: cart.couponCode,
    coupon,
    couponError,
    totals: computeTotals(purchasable, discount),
    hasUnavailableItems: items.length !== purchasable.length,
  };
}

export async function getCart(userId) {
  return buildCartView(await getOrCreate(userId), userId);
}

async function loadPurchasableProduct(productId) {
  const product = await Product.findById(productId).select('price stock isActive name');
  if (!product || !product.isActive) throw ApiError.notFound('Product not found');
  if (product.stock < 1) throw ApiError.badRequest(`${product.name} is out of stock`);
  return product;
}

export async function addItem(userId, productId, quantity = 1) {
  const product = await loadPurchasableProduct(productId);
  const cart = await getOrCreate(userId);
  const existing = cart.items.find((i) => String(i.product) === String(productId));
  const desired = (existing?.quantity || 0) + quantity;
  const max = Math.min(MAX_QTY_PER_ITEM, product.stock);
  if (desired > max) {
    throw ApiError.badRequest(
      product.stock < MAX_QTY_PER_ITEM
        ? `Only ${product.stock} unit(s) of ${product.name} available`
        : `You can buy at most ${MAX_QTY_PER_ITEM} units of an item`,
    );
  }
  if (existing) {
    existing.quantity = desired;
    existing.priceAtAdd = product.price;
  } else {
    cart.items.push({ product: product._id, quantity, priceAtAdd: product.price });
  }
  await cart.save();
  return buildCartView(cart, userId);
}

export async function updateItem(userId, productId, quantity) {
  const cart = await getOrCreate(userId);
  const item = cart.items.find((i) => String(i.product) === String(productId));
  if (!item) throw ApiError.notFound('Item is not in your cart');
  const product = await loadPurchasableProduct(productId);
  if (quantity > Math.min(MAX_QTY_PER_ITEM, product.stock)) {
    throw ApiError.badRequest(`Only ${Math.min(MAX_QTY_PER_ITEM, product.stock)} unit(s) available`);
  }
  item.quantity = quantity;
  item.priceAtAdd = product.price;
  await cart.save();
  return buildCartView(cart, userId);
}

export async function removeItem(userId, productId) {
  const cart = await getOrCreate(userId);
  const before = cart.items.length;
  cart.items = cart.items.filter((i) => String(i.product) !== String(productId));
  if (cart.items.length === before) throw ApiError.notFound('Item is not in your cart');
  await cart.save();
  return buildCartView(cart, userId);
}

export async function clearCart(userId) {
  const cart = await getOrCreate(userId);
  cart.items = [];
  cart.couponCode = '';
  await cart.save();
  return buildCartView(cart, userId);
}

export async function applyCoupon(userId, code) {
  const cart = await getOrCreate(userId);
  const view = await buildCartView(cart, userId);
  if (!view.items.length) throw ApiError.badRequest('Add items to your cart before applying a coupon');
  await validateCoupon(code, userId, view.totals.subtotal); // throws with a helpful message
  cart.couponCode = code.toUpperCase();
  await cart.save();
  return buildCartView(cart, userId);
}

export async function removeCoupon(userId) {
  const cart = await getOrCreate(userId);
  cart.couponCode = '';
  await cart.save();
  return buildCartView(cart, userId);
}
