import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { applyCoupon, fetchCart, removeCartItem, removeCoupon, selectCartBusy, updateCartItem } from '../store/cartSlice.js';
import { shopApi } from '../services/index.js';
import { useAsync, useDocumentTitle } from '../hooks/index.js';
import { useToast } from '../context/contexts.js';
import { useConfirm } from '../context/contexts.js';
import { OrderSummary } from '../components/OrderSummary.jsx';
import { ProductImage } from '../components/ProductCard.jsx';
import { Breadcrumbs, Button, EmptyState, QuantitySelector } from '../components/ui.jsx';
import { Icon } from '../components/Icon.jsx';
import { formatPrice } from '../utils/format.js';

function CouponBox({ cart }) {
  const dispatch = useDispatch();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { data: coupons } = useAsync(() => shopApi.coupons().then((r) => r.data.coupons), []);

  const apply = async (value) => {
    const c = value.trim().toUpperCase();
    if (!c) return setError('Enter a coupon code');
    setBusy(true);
    const res = await dispatch(applyCoupon(c));
    setBusy(false);
    if (applyCoupon.fulfilled.match(res)) {
      setError('');
      setCode('');
      toast.success(`Coupon ${c} applied`);
    } else setError(res.payload);
    return undefined;
  };

  if (cart.coupon) {
    return (
      <div className="mt-4 flex items-center justify-between rounded-lg border border-success/40 bg-success-50 p-3 text-sm">
        <span className="flex items-center gap-2 text-success"><Icon name="tag" className="h-4 w-4" /> <strong>{cart.coupon.code}</strong> applied</span>
        <button type="button" className="text-xs font-medium text-danger hover:underline" onClick={() => dispatch(removeCoupon())}>Remove</button>
      </div>
    );
  }
  return (
    <div className="mt-4">
      {cart.couponError && <p className="mb-2 rounded bg-warning-50 p-2 text-xs text-warning">{cart.couponError}</p>}
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); apply(code); }}>
        <label htmlFor="coupon" className="sr-only">Coupon code</label>
        <input id="coupon" className="input uppercase" placeholder="Coupon code" value={code} maxLength={20} onChange={(e) => setCode(e.target.value)} />
        <Button type="submit" className="btn-outline" loading={busy}>Apply</Button>
      </form>
      {error && <p className="field-error" role="alert">{error}</p>}
      {coupons?.length > 0 && (
        <ul className="mt-3 space-y-2">
          {coupons.slice(0, 3).map((c) => (
            <li key={c.code} className="flex items-center justify-between gap-2 rounded border border-dashed border-line p-2 text-xs">
              <span><strong className="text-fg">{c.code}</strong> <span className="text-muted">{c.description}</span></span>
              <button type="button" className="shrink-0 font-medium text-primary hover:underline" onClick={() => apply(c.code)}>Apply</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Cart() {
  useDocumentTitle('Your cart');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { cart, loading } = useSelector((s) => s.cart);
  const busy = useSelector(selectCartBusy);

  useEffect(() => {
    dispatch(fetchCart());
  }, [dispatch]);

  const changeQty = async (item, quantity) => {
    const res = await dispatch(updateCartItem({ productId: item.product._id, quantity }));
    if (updateCartItem.rejected.match(res)) toast.error(res.payload);
  };
  const remove = async (item) => {
    if (!(await confirm({ title: 'Remove item?', message: `Remove ${item.product.name} from your cart?`, confirmLabel: 'Remove', danger: true }))) return;
    const res = await dispatch(removeCartItem(item.product._id));
    if (removeCartItem.fulfilled.match(res)) toast.success('Item removed');
  };

  if (loading || !cart) {
    return (
      <div className="container-page grid gap-6 py-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="skeleton h-28 w-full" />)}</div>
        <div className="skeleton h-64 w-full" />
      </div>
    );
  }

  if (!cart.items.length) {
    return (
      <div className="container-page py-10">
        <EmptyState icon="cart" title="Your cart is empty" message="Browse our catalogue and add products you like." action={<Link to="/products" className="btn-primary">Start shopping</Link>} />
      </div>
    );
  }

  return (
    <div className="container-page py-6">
      <Breadcrumbs items={[{ label: 'Cart' }]} />
      <h1 className="mb-5 text-2xl font-semibold text-fg">Shopping cart <span className="text-base font-normal text-muted">({cart.itemCount} item{cart.itemCount === 1 ? '' : 's'})</span></h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <ul className="space-y-3">
          {cart.items.map((item) => (
            <li key={item._id} className={`card flex gap-4 p-4 ${!item.available ? 'opacity-70' : ''}`}>
              <Link to={`/product/${item.product.slug}`} className="h-24 w-24 shrink-0 bg-white p-1 sm:h-28 sm:w-28">
                <ProductImage src={item.product.image} alt={item.product.name} />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="text-xs uppercase tracking-wide text-muted">{item.product.brand}</p>
                <Link to={`/product/${item.product.slug}`} className="line-clamp-2 text-sm font-medium text-fg hover:text-primary">{item.product.name}</Link>
                <p className="mt-1 text-sm">
                  <span className="font-semibold">{formatPrice(item.price)}</span>
                  {item.product.mrp > item.price && <span className="ml-2 text-muted line-through">{formatPrice(item.product.mrp)}</span>}
                </p>
                {!item.available && <p className="mt-1 text-xs font-medium text-danger">Currently unavailable - remove it to check out</p>}
                {item.available && item.quantity > item.maxQuantity && <p className="mt-1 text-xs font-medium text-danger">Only {item.maxQuantity} left - reduce the quantity</p>}
                {item.priceChanged && <p className="mt-1 text-xs text-muted">Price updated since you added this item</p>}
                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3">
                  <QuantitySelector value={item.quantity} max={Math.max(item.maxQuantity, 1)} disabled={busy || !item.available} onChange={(q) => changeQty(item, q)} />
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-semibold">{formatPrice(item.lineTotal)}</span>
                    <button type="button" onClick={() => remove(item)} className="flex items-center gap-1 text-sm text-muted hover:text-danger">
                      <Icon name="trash" className="h-4 w-4" /> Remove
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <div className="space-y-4 lg:sticky lg:top-32 lg:self-start">
          <OrderSummary totals={cart.totals} couponCode={cart.coupon?.code}>
            <CouponBox cart={cart} />
            <button type="button" className="btn-primary mt-4 w-full py-3" disabled={cart.hasUnavailableItems || busy} onClick={() => navigate('/checkout')}>
              Proceed to checkout
            </button>
            {cart.hasUnavailableItems && <p className="mt-2 text-xs text-danger">Remove unavailable items to continue.</p>}
          </OrderSummary>
        </div>
      </div>
    </div>
  );
}
