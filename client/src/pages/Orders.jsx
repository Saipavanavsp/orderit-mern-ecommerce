// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { orderApi } from '../services/index.js';
import { errorMessage } from '../services/api.js';
import { useAsync, useDocumentTitle } from '../hooks/index.js';
import { usePayment } from '../hooks/usePayment.jsx';
import { useToast } from '../context/contexts.js';
import { useConfirm } from '../context/contexts.js';
import { OrderTracker } from '../components/OrderTracker.jsx';
import { OrderSummary } from '../components/OrderSummary.jsx';
import { ProductImage } from '../components/ProductCard.jsx';
import { Breadcrumbs, Button, EmptyState, ErrorState, Pagination, StatusBadge } from '../components/ui.jsx';
import { Icon } from '../components/Icon.jsx';
import { ORDER_STATUS_STYLES, capitalize, formatAmount, formatDate } from '../utils/format.js';

const PAYMENT_STYLES = {
  paid: 'bg-success-50 text-success',
  pending: 'bg-warning-50 text-warning',
  failed: 'bg-danger-50 text-danger',
  refunded: 'bg-subtle text-muted',
};
const TABS = ['all', 'processing', 'shipped', 'delivered', 'cancelled'];

export function MyOrders() {
  useDocumentTitle('My orders');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAsync(() => orderApi.mine({ status, page, limit: 10 }), [status, page]);
  const orders = data?.data.orders || [];

  return (
    <div className="container-page py-6">
      <Breadcrumbs items={[{ label: 'My orders' }]} />
      <h1 className="mb-4 text-2xl font-semibold text-fg">My orders</h1>
      <div className="mb-4 flex gap-2 overflow-x-auto" role="tablist">
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={status === t} onClick={() => { setStatus(t); setPage(1); }} className={`chip whitespace-nowrap ${status === t ? 'border-primary bg-primary text-white' : 'hover:bg-subtle'}`}>
            {capitalize(t)}
          </button>
        ))}
      </div>
      {loading && <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-28 w-full" />)}</div>}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && orders.length === 0 && (
        <EmptyState icon="package" title="No orders yet" message={status === 'all' ? 'When you place an order it will show up here.' : `You have no ${status} orders.`} action={<Link className="btn-primary" to="/products">Start shopping</Link>} />
      )}
      <ul className="space-y-3">
        {orders.map((o) => (
          <li key={o._id}>
            <Link to={`/orders/${o._id}`} className="card block p-4 hover:border-primary">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3 text-sm">
                <div>
                  <p className="font-semibold text-fg">#{o.orderNumber}</p>
                  <p className="text-xs text-muted">Placed on {formatDate(o.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={o.status} styles={ORDER_STATUS_STYLES} />
                  <span className="font-semibold">{formatAmount(o.totalPrice)}</span>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex -space-x-2">
                  {o.items.slice(0, 3).map((i) => (
                    <div key={i.product} className="h-12 w-12 rounded border border-line bg-white p-0.5"><ProductImage src={i.image} alt="" /></div>
                  ))}
                </div>
                <p className="line-clamp-1 flex-1 text-sm text-muted">{o.items.map((i) => i.name).join(', ')}</p>
                {o.paymentMethod === 'razorpay' && o.paymentStatus === 'pending' && o.status !== 'cancelled' && <span className="text-xs font-medium text-warning">Payment pending</span>}
                <Icon name="chevron-right" className="h-4 w-4 text-muted" />
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <Pagination page={page} pages={data?.meta?.pages} onChange={setPage} />
    </div>
  );
}

export function OrderDetail() {
  const { id } = useParams();
  const toast = useToast();
  const confirm = useConfirm();
  const { pay, paymentModal } = usePayment();
  const [busy, setBusy] = useState(false);
  const { data: order, loading, error, reload, setData } = useAsync(() => orderApi.get(id).then((r) => r.data.order), [id]);
  useDocumentTitle(order ? `Order ${order.orderNumber}` : 'Order');

  if (loading) return <div className="container-page py-8"><div className="skeleton h-80 w-full" /></div>;
  if (error) return <div className="container-page py-10"><ErrorState message={error} onRetry={reload} /></div>;

  const awaitingPayment = order.paymentMethod === 'razorpay' && !order.isPaid && order.status === 'pending';

  const payNow = async () => {
    setBusy(true);
    try {
      const result = await pay(order);
      if (result === 'paid') toast.success('Payment successful. Your order is confirmed.');
      else if (result === 'failed') toast.error('Payment failed. Please try again.');
      await reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!(await confirm({ title: 'Cancel this order?', message: order.isPaid ? 'Your payment will be refunded to the original method.' : 'This cannot be undone.', confirmLabel: 'Cancel order', cancelLabel: 'Keep order', danger: true }))) return;
    setBusy(true);
    try {
      setData((await orderApi.cancel(order._id, 'Cancelled by customer')).data.order);
      toast.success('Order cancelled');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const a = order.shippingAddress;
  return (
    <div className="container-page py-6">
      <Breadcrumbs items={[{ label: 'My orders', to: '/orders' }, { label: `#${order.orderNumber}` }]} />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-fg">Order #{order.orderNumber}</h1>
          <p className="text-sm text-muted">Placed on {formatDate(order.createdAt, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <div className="flex gap-2">
          {awaitingPayment && <Button loading={busy} onClick={payNow}><Icon name="card" className="h-4 w-4" /> Pay {formatAmount(order.totalPrice)}</Button>}
          {order.isCancellable && <button type="button" className="btn-outline text-danger" disabled={busy} onClick={cancel}>Cancel order</button>}
        </div>
      </div>
      {awaitingPayment && <p className="mb-4 rounded-lg bg-warning-50 p-3 text-sm text-warning">Payment is pending. Complete it to confirm your order.</p>}
      <div className="card mb-6 p-5"><OrderTracker order={order} /></div>
      {order.trackingNumber && <p className="-mt-3 mb-6 text-sm text-muted">Tracking number: <strong className="text-fg">{order.trackingNumber}</strong></p>}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="card p-4">
          <h2 className="mb-2 font-semibold text-fg">Items</h2>
          <ul className="divide-y divide-line">
            {order.items.map((i) => (
              <li key={i.product} className="flex items-center gap-4 py-3">
                <Link to={`/product/${i.slug}`} className="h-16 w-16 shrink-0 bg-white p-1"><ProductImage src={i.image} alt="" /></Link>
                <div className="flex-1">
                  <Link to={`/product/${i.slug}`} className="line-clamp-2 text-sm text-fg hover:text-primary">{i.name}</Link>
                  <p className="text-xs text-muted">Qty {i.quantity} × {formatAmount(i.price)}</p>
                </div>
                <p className="text-sm font-medium">{formatAmount(i.price * i.quantity)}</p>
              </li>
            ))}
          </ul>
        </section>
        <div className="space-y-4">
          <OrderSummary totals={order} couponCode={order.couponCode} />
          <div className="card p-4 text-sm">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Payment</h2>
            <p className="flex items-center justify-between">
              <span>{order.paymentMethod === 'cod' ? 'Cash on delivery' : 'Online (Razorpay)'}</span>
              <StatusBadge status={order.paymentStatus} styles={PAYMENT_STYLES} />
            </p>
            <h2 className="mb-2 mt-4 text-sm font-semibold uppercase tracking-wide text-muted">Delivery address</h2>
            <p className="font-medium text-fg">{a.fullName}</p>
            <p className="text-muted">{[a.line1, a.line2, a.city, a.state, a.postalCode].filter(Boolean).join(', ')}</p>
            <p className="text-muted">Phone: {a.phone}</p>
          </div>
        </div>
      </div>
      {paymentModal}
    </div>
  );
}

export function OrderSuccess() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: order, loading, error } = useAsync(() => orderApi.get(id).then((r) => r.data.order), [id]);
  useDocumentTitle('Order confirmed');
  if (loading) return <div className="container-page py-10"><div className="skeleton h-64 w-full" /></div>;
  if (error) return <div className="container-page py-10"><ErrorState message={error} onRetry={() => navigate('/orders')} /></div>;
  return (
    <div className="container-page max-w-2xl py-12">
      <div className="card p-8 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-50 text-success"><Icon name="check" className="h-7 w-7" /></span>
        <h1 className="mt-4 text-2xl font-semibold text-fg">Thank you, your order is confirmed</h1>
        <p className="mt-2 text-sm text-muted">Order <strong className="text-fg">#{order.orderNumber}</strong> · {formatAmount(order.totalPrice)} · {order.paymentMethod === 'cod' ? 'Pay on delivery' : 'Paid online'}</p>
        <p className="mt-1 text-sm text-muted">A confirmation has been sent to your e-mail. Expected delivery in 3-7 business days.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to={`/orders/${order._id}`} className="btn-primary">Track order</Link>
          <Link to="/products" className="btn-outline">Continue shopping</Link>
        </div>
      </div>
    </div>
  );
}
