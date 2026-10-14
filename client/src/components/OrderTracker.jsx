// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { Icon } from './Icon.jsx';
import { formatDateTime } from '../utils/format.js';

const STEPS = ['pending', 'processing', 'shipped', 'delivered'];
const LABELS = { pending: 'Order placed', processing: 'Confirmed', shipped: 'Shipped', delivered: 'Delivered' };

export function OrderTracker({ order }) {
  if (order.status === 'cancelled') {
    const ev = order.statusHistory.find((h) => h.status === 'cancelled');
    return (
      <div className="rounded-lg border border-danger/30 bg-danger-50 p-4 text-sm text-danger">
        <p className="font-semibold">Order cancelled {ev && `on ${formatDateTime(ev.at)}`}</p>
        {order.cancelReason && <p className="mt-1">Reason: {order.cancelReason}</p>}
        {order.paymentStatus === 'refunded' && <p className="mt-1">Your payment will be refunded to the original method in 5-7 business days.</p>}
      </div>
    );
  }
  const current = STEPS.indexOf(order.status);
  const at = (s) => order.statusHistory.find((h) => h.status === s)?.at;
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Order progress">
      {STEPS.map((s, i) => {
        const done = i <= current;
        return (
          <li key={s} className="relative flex flex-col items-center text-center">
            {i > 0 && <span className={`absolute right-1/2 top-4 h-0.5 w-full ${i <= current ? 'bg-primary' : 'bg-line'}`} aria-hidden="true" />}
            <span className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 ${done ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-muted'}`}>
              {done ? <Icon name="check" className="h-4 w-4" /> : <span className="text-xs">{i + 1}</span>}
            </span>
            <span className={`mt-2 text-xs font-medium ${done ? 'text-fg' : 'text-muted'}`}>{LABELS[s]}</span>
            {at(s) && <span className="text-[11px] text-muted">{formatDateTime(at(s))}</span>}
          </li>
        );
      })}
    </ol>
  );
}
