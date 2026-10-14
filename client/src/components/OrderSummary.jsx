import { formatAmount } from '../utils/format.js';

export function OrderSummary({ totals, couponCode, children, title = 'Price details' }) {
  if (!totals) return null;
  const row = 'flex justify-between py-1.5';
  return (
    <div className="card p-4">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      <dl className="text-sm">
        <div className={row}><dt className="text-fg">Subtotal</dt><dd>{formatAmount(totals.subtotal ?? totals.itemsPrice)}</dd></div>
        {(totals.discount || 0) > 0 && (
          <div className={`${row} text-success`}><dt>Coupon {couponCode && `(${couponCode})`}</dt><dd>− {formatAmount(totals.discount)}</dd></div>
        )}
        <div className={row}><dt className="text-fg">GST {totals.taxRate ? `(${Math.round(totals.taxRate * 100)}%)` : ''}</dt><dd>{formatAmount(totals.tax ?? totals.taxPrice)}</dd></div>
        <div className={row}>
          <dt className="text-fg">Shipping</dt>
          <dd>{(totals.shipping ?? totals.shippingPrice) === 0 ? <span className="text-success">Free</span> : formatAmount(totals.shipping ?? totals.shippingPrice)}</dd>
        </div>
        <div className="mt-2 flex justify-between border-t border-line pt-3 text-base font-semibold">
          <dt>Total</dt><dd>{formatAmount(totals.total ?? totals.totalPrice)}</dd>
        </div>
      </dl>
      {totals.freeShippingThreshold && totals.shipping > 0 && (
        <p className="mt-2 text-xs text-muted">Add items worth {formatAmount(totals.freeShippingThreshold - (totals.subtotal - totals.discount))} more for free delivery.</p>
      )}
      {children}
    </div>
  );
}
