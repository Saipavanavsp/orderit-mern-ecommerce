import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchCart, resetCart } from '../store/cartSlice.js';
import { loadSession } from '../store/authSlice.js';
import { orderApi } from '../services/index.js';
import { errorMessage, fieldErrors } from '../services/api.js';
import { useDocumentTitle } from '../hooks/index.js';
import { usePayment } from '../hooks/usePayment.jsx';
import { useToast } from '../context/contexts.js';
import { AddressForm } from '../components/AddressForm.jsx';
import { OrderSummary } from '../components/OrderSummary.jsx';
import { ProductImage } from '../components/ProductCard.jsx';
import { Breadcrumbs, Button } from '../components/ui.jsx';
import { Icon } from '../components/Icon.jsx';
import { EMPTY_ADDRESS, validateAddress } from '../utils/validation.js';
import { formatPrice } from '../utils/format.js';

function Step({ n, title, children }) {
  return (
    <section className="card p-5">
      <h2 className="mb-4 flex items-center gap-3 text-base font-semibold text-fg">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-50 text-sm text-primary-700">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function Checkout() {
  useDocumentTitle('Checkout');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const user = useSelector((s) => s.auth.user);
  const { cart } = useSelector((s) => s.cart);
  const saved = user?.addresses || [];
  const [addressId, setAddressId] = useState(saved.find((a) => a.isDefault)?._id || saved[0]?._id || 'new');
  const [address, setAddress] = useState({ ...EMPTY_ADDRESS, fullName: user?.name || '', phone: user?.phone || '' });
  const [saveAddress, setSaveAddress] = useState(true);
  const [errors, setErrors] = useState({});
  const [method, setMethod] = useState('razorpay');
  const [placing, setPlacing] = useState(false);
  const { pay, paymentModal } = usePayment();

  useEffect(() => {
    dispatch(fetchCart());
  }, [dispatch]);

  if (cart && cart.items.length === 0 && !placing) return <Navigate to="/cart" replace />;

  const placeOrder = async () => {
    const body = { paymentMethod: method };
    if (addressId === 'new') {
      const errs = validateAddress(address);
      setErrors(errs);
      if (Object.keys(errs).length) {
        toast.error('Please fix the highlighted address fields');
        return;
      }
      body.shippingAddress = address;
      body.saveAddress = saveAddress;
    } else body.addressId = addressId;

    setPlacing(true);
    let order;
    try {
      order = (await orderApi.create(body)).data.order;
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err));
      setPlacing(false);
      return;
    }
    if (body.saveAddress) dispatch(loadSession());
    // The server has emptied the cart; refresh the badge only after leaving this page so the
    // payment dialog is not unmounted mid-flow.
    const leave = (to) => {
      navigate(to, { replace: true });
      dispatch(resetCart());
      dispatch(fetchCart());
    };

    if (method === 'cod') {
      leave(`/order-success/${order._id}`);
      return;
    }
    try {
      const result = await pay(order);
      if (result === 'paid') leave(`/order-success/${order._id}`);
      else {
        toast.error(result === 'failed' ? 'Payment failed. You can retry from your order.' : 'Payment not completed. You can pay from your order page.');
        leave(`/orders/${order._id}`);
      }
    } catch (err) {
      toast.error(errorMessage(err));
      leave(`/orders/${order._id}`);
    }
  };

  if (!cart) return <div className="container-page py-10"><div className="skeleton h-72 w-full" /></div>;

  return (
    <div className="container-page py-6">
      <Breadcrumbs items={[{ label: 'Cart', to: '/cart' }, { label: 'Checkout' }]} />
      <h1 className="mb-5 text-2xl font-semibold text-fg">Checkout</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Step n={1} title="Delivery address">
            <div className="space-y-3">
              {saved.map((a) => (
                <label key={a._id} className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm ${addressId === a._id ? 'border-primary bg-primary-50/50' : 'border-line'}`}>
                  <input type="radio" name="address" className="mt-1 accent-primary" checked={addressId === a._id} onChange={() => setAddressId(a._id)} />
                  <span>
                    <span className="font-medium text-fg">{a.fullName}</span> <span className="text-muted">· {a.phone}</span>
                    <span className="block text-muted">{[a.line1, a.line2, a.city, a.state, a.postalCode].filter(Boolean).join(', ')}</span>
                  </span>
                </label>
              ))}
              {saved.length > 0 && (
                <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${addressId === 'new' ? 'border-primary bg-primary-50/50' : 'border-line'}`}>
                  <input type="radio" name="address" className="accent-primary" checked={addressId === 'new'} onChange={() => setAddressId('new')} />
                  <Icon name="plus" className="h-4 w-4" /> Deliver to a new address
                </label>
              )}
              {addressId === 'new' && (
                <div className="pt-2">
                  <AddressForm value={address} onChange={setAddress} errors={errors} />
                  <label className="mt-4 flex items-center gap-2 text-sm text-fg">
                    <input type="checkbox" className="accent-primary" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} /> Save this address for next time
                  </label>
                </div>
              )}
            </div>
          </Step>

          <Step n={2} title="Payment method">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['razorpay', 'card', 'Pay online', 'UPI, cards, net banking (Razorpay test mode)'],
                ['cod', 'truck', 'Cash on delivery', 'Pay when your order arrives'],
              ].map(([value, icon, label, sub]) => (
                <label key={value} className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm ${method === value ? 'border-primary bg-primary-50/50' : 'border-line'}`}>
                  <input type="radio" name="method" className="mt-1 accent-primary" checked={method === value} onChange={() => setMethod(value)} />
                  <span>
                    <span className="flex items-center gap-2 font-medium text-fg"><Icon name={icon} className="h-4 w-4" /> {label}</span>
                    <span className="block text-xs text-muted">{sub}</span>
                  </span>
                </label>
              ))}
            </div>
          </Step>

          <Step n={3} title={`Review items (${cart.itemCount})`}>
            <ul className="divide-y divide-line">
              {cart.items.map((i) => (
                <li key={i._id} className="flex items-center gap-3 py-3">
                  <div className="h-14 w-14 shrink-0 bg-white p-1"><ProductImage src={i.product.image} alt="" /></div>
                  <p className="line-clamp-2 flex-1 text-sm text-fg">{i.product.name}</p>
                  <p className="text-sm text-muted">× {i.quantity}</p>
                  <p className="w-24 text-right text-sm font-medium">{formatPrice(i.lineTotal)}</p>
                </li>
              ))}
            </ul>
            <Link to="/cart" className="mt-2 inline-block text-sm text-primary hover:underline">Edit cart</Link>
          </Step>
        </div>

        <div className="lg:sticky lg:top-32 lg:self-start">
          <OrderSummary totals={cart.totals} couponCode={cart.coupon?.code} title="Order summary">
            <Button className="btn-primary mt-4 w-full py-3" loading={placing} disabled={cart.hasUnavailableItems} onClick={placeOrder}>
              {method === 'cod' ? 'Place order' : 'Place order & pay'}
            </Button>
            <p className="mt-2 text-center text-xs text-muted">By placing the order you agree to our terms and 7-day return policy.</p>
          </OrderSummary>
        </div>
      </div>
      {paymentModal}
    </div>
  );
}
