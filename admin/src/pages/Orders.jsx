import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { orderApi } from '../services/index.js';
import { errorMessage } from '../services/api.js';
import { useAsync, useDebounce, useDocumentTitle } from '../hooks/index.js';
import { useConfirm, useToast } from '../context/contexts.js';
import { Button, EmptyState, ErrorState, Field, PageHeader, Pagination, StatusBadge, TableSkeleton, Thumb } from '../components/ui.jsx';
import { Icon } from '../components/Icon.jsx';
import { ORDER_STATUS_STYLES, capitalize, formatAmount, formatDate, formatDateTime, formatPrice } from '../utils/format.js';

const PAYMENT_STYLES = { paid: 'bg-success-50 text-success', pending: 'bg-warning-50 text-warning', failed: 'bg-danger-50 text-danger', refunded: 'bg-subtle text-muted' };
const STATUSES = ['all', 'pending', 'processing', 'shipped', 'delivered', 'cancelled'];
// Mirrors server TRANSITIONS
const NEXT = { pending: ['processing', 'cancelled'], processing: ['shipped', 'cancelled'], shipped: ['delivered'], delivered: [], cancelled: [] };

export function OrdersList() {
  useDocumentTitle('Orders');
  const toast = useToast();
  const [f, setF] = useState({ status: 'all', paymentStatus: 'all', search: '', from: '', to: '', page: 1 });
  const search = useDebounce(f.search, 300);
  const params = { status: f.status, paymentStatus: f.paymentStatus, page: f.page, limit: 20, search: search || undefined, from: f.from || undefined, to: f.to ? `${f.to}T23:59:59` : undefined };
  const { data, loading, error, reload } = useAsync(() => orderApi.list(params), [JSON.stringify(params)]);
  const orders = data?.data.orders || [];
  const counts = data?.data.statusCounts || {};
  const set = (patch) => setF((x) => ({ ...x, page: 1, ...patch }));

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle={data ? `${data.meta.total} orders match` : undefined}
        actions={<button type="button" className="btn-outline" onClick={() => orderApi.exportCsv({ status: f.status, from: params.from, to: params.to }).catch((e) => toast.error(errorMessage(e)))}><Icon name="download" className="h-4 w-4" /> Export CSV</button>}
      />
      <div className="mb-3 flex gap-2 overflow-x-auto" role="tablist">
        {STATUSES.map((s) => (
          <button key={s} type="button" role="tab" aria-selected={f.status === s} onClick={() => set({ status: s })} className={`chip whitespace-nowrap ${f.status === s ? 'border-primary bg-primary text-white' : 'hover:bg-subtle'}`}>
            {capitalize(s)}{s !== 'all' && counts[s] ? ` (${counts[s]})` : ''}
          </button>
        ))}
      </div>
      <div className="card mb-4 grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <input className="input" aria-label="Search orders" placeholder="Order number, customer name or email" value={f.search} onChange={(e) => set({ search: e.target.value })} />
        <select className="input" aria-label="Payment status" value={f.paymentStatus} onChange={(e) => set({ paymentStatus: e.target.value })}>
          {['all', 'pending', 'paid', 'failed', 'refunded'].map((s) => <option key={s} value={s}>{s === 'all' ? 'Any payment status' : capitalize(s)}</option>)}
        </select>
        <input type="date" className="input" aria-label="From date" value={f.from} onChange={(e) => set({ from: e.target.value })} />
        <input type="date" className="input" aria-label="To date" value={f.to} onChange={(e) => set({ to: e.target.value })} />
      </div>
      {error ? <ErrorState message={error} onRetry={reload} /> : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead>
              {loading ? <TableSkeleton cols={7} /> : (
                <tbody>
                  {orders.map((o) => (
                    <tr key={o._id}>
                      <td><Link className="font-medium text-primary hover:underline" to={`/orders/${o._id}`}>#{o.orderNumber}</Link></td>
                      <td><p>{o.user?.name}</p><p className="text-xs text-muted">{o.user?.email}</p></td>
                      <td className="whitespace-nowrap text-muted">{formatDateTime(o.createdAt)}</td>
                      <td>{o.items.reduce((s, i) => s + i.quantity, 0)}</td>
                      <td className="whitespace-nowrap">{formatPrice(o.totalPrice)}</td>
                      <td><StatusBadge status={o.paymentStatus} styles={PAYMENT_STYLES} /><p className="mt-0.5 text-xs text-muted">{o.paymentMethod === 'cod' ? 'COD' : 'Online'}</p></td>
                      <td><StatusBadge status={o.status} styles={ORDER_STATUS_STYLES} /></td>
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>
          {!loading && orders.length === 0 && <EmptyState icon="package" title="No orders found" message="Try a different status or date range." />}
          <Pagination meta={data?.meta} onChange={(page) => setF((x) => ({ ...x, page }))} />
        </div>
      )}
    </>
  );
}

export function OrderDetail() {
  const { id } = useParams();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, loading, error, reload, setData } = useAsync(() => orderApi.get(id).then((r) => r.data), [id]);
  const [note, setNote] = useState('');
  const [tracking, setTracking] = useState('');
  const [busy, setBusy] = useState('');
  useDocumentTitle(data ? `Order ${data.order.orderNumber}` : 'Order');

  if (loading) return <div className="skeleton h-96" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const { order, payments } = data;
  const nextStatuses = NEXT[order.status].filter((s) => !(s === 'processing' && order.paymentMethod === 'razorpay' && !order.isPaid));

  const update = async (status) => {
    if (status === 'cancelled' && !(await confirm({ title: 'Cancel this order?', message: 'Stock will be restored and the customer notified. Paid orders are marked for refund.', confirmLabel: 'Cancel order', cancelLabel: 'Keep', danger: true }))) return;
    setBusy(status);
    try {
      const res = await orderApi.setStatus(order._id, { status, note, ...(tracking ? { trackingNumber: tracking } : {}) });
      setData((d) => ({ ...d, order: { ...res.data.order, user: d.order.user } }));
      setNote('');
      toast.success(res.message);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const a = order.shippingAddress;
  return (
    <>
      <PageHeader
        title={`Order #${order.orderNumber}`}
        subtitle={`Placed ${formatDateTime(order.createdAt)} by ${order.user?.name} (${order.user?.email})`}
        actions={<Link to="/orders" className="btn-outline"><Icon name="arrow-left" className="h-4 w-4" /> All orders</Link>}
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <section className="card overflow-hidden">
            <div className="flex items-center gap-3 p-4">
              <h2 className="font-semibold text-fg">Items</h2>
              <StatusBadge status={order.status} styles={ORDER_STATUS_STYLES} />
            </div>
            <table className="table">
              <thead><tr><th>Product</th><th>Price</th><th>Qty</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {order.items.map((i) => (
                  <tr key={i.product}>
                    <td><div className="flex items-center gap-3"><Thumb src={i.image} /><span className="line-clamp-2">{i.name}</span></div></td>
                    <td>{formatAmount(i.price)}</td><td>{i.quantity}</td><td className="text-right">{formatAmount(i.price * i.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="space-y-1 p-4 text-sm">
              {[['Subtotal', order.itemsPrice], [`Discount${order.couponCode ? ` (${order.couponCode})` : ''}`, -order.discount], ['GST', order.taxPrice], ['Shipping', order.shippingPrice]].map(([l, v]) => (
                <div key={l} className="flex justify-between"><dt className="text-muted">{l}</dt><dd>{v < 0 ? `− ${formatAmount(-v)}` : formatAmount(v)}</dd></div>
              ))}
              <div className="flex justify-between border-t border-line pt-2 font-semibold"><dt>Total</dt><dd>{formatAmount(order.totalPrice)}</dd></div>
            </dl>
          </section>
          <section className="card p-4">
            <h2 className="mb-3 font-semibold text-fg">Status history</h2>
            <ol className="space-y-3 border-l-2 border-line pl-4">
              {order.statusHistory.map((h, i) => (
                <li key={i} className="text-sm">
                  <p className="font-medium capitalize text-fg">{h.status}</p>
                  <p className="text-xs text-muted">{formatDateTime(h.at)}{h.note ? ` · ${h.note}` : ''}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <div className="space-y-6">
          <section className="card space-y-3 p-4">
            <h2 className="font-semibold text-fg">Update status</h2>
            {nextStatuses.length === 0 ? (
              <p className="text-sm text-muted">{order.status === 'pending' ? 'Waiting for online payment before the order can be processed.' : `This order is ${order.status}; no further changes are possible.`}</p>
            ) : (
              <>
                {nextStatuses.includes('shipped') && (
                  <Field label="Tracking number (optional)" id="tracking"><input id="tracking" className="input" value={tracking} onChange={(e) => setTracking(e.target.value)} /></Field>
                )}
                <Field label="Note (optional, visible in history)" id="note"><input id="note" className="input" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
                <div className="flex flex-wrap gap-2">
                  {nextStatuses.map((s) => (
                    <Button key={s} className={s === 'cancelled' ? 'btn-outline text-danger' : 'btn-primary'} loading={busy === s} disabled={Boolean(busy)} onClick={() => update(s)}>
                      {s === 'cancelled' ? 'Cancel order' : `Mark ${s}`}
                    </Button>
                  ))}
                </div>
              </>
            )}
          </section>
          <section className="card space-y-2 p-4 text-sm">
            <h2 className="font-semibold text-fg">Payment</h2>
            <p className="flex justify-between"><span className="text-muted">Method</span><span>{order.paymentMethod === 'cod' ? 'Cash on delivery' : 'Razorpay'}</span></p>
            <p className="flex justify-between"><span className="text-muted">Status</span><StatusBadge status={order.paymentStatus} styles={PAYMENT_STYLES} /></p>
            {order.paidAt && <p className="flex justify-between"><span className="text-muted">Paid at</span><span>{formatDateTime(order.paidAt)}</span></p>}
            {payments.length > 0 && (
              <ul className="mt-2 space-y-1 border-t border-line pt-2 text-xs text-muted">
                {payments.map((p) => <li key={p._id}>{p.provider} · {p.status} · {formatDate(p.createdAt)} {p.providerPaymentId && `· ${p.providerPaymentId}`}</li>)}
              </ul>
            )}
          </section>
          <section className="card p-4 text-sm">
            <h2 className="mb-2 font-semibold text-fg">Shipping address</h2>
            <p className="font-medium">{a.fullName}</p>
            <p className="text-muted">{[a.line1, a.line2, a.city, a.state, a.postalCode].filter(Boolean).join(', ')}</p>
            <p className="text-muted">{a.phone}</p>
            {order.trackingNumber && <p className="mt-2">Tracking: <strong>{order.trackingNumber}</strong></p>}
          </section>
        </div>
      </div>
    </>
  );
}
